import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type Token,
  type ActionPerformed,
  type PushNotificationSchema,
} from "@capacitor/push-notifications";
import { supabase, isMockMode } from "../lib/supabase";
import { fcmConfig } from "../config/fcmConfig";

// Base64URL helper
function base64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Convert PEM PKCS#8 private key string to ArrayBuffer for WebCrypto
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN[ A-Z_-]+-----/g, "")
    .replace(/-----END[ A-Z_-]+-----/g, "")
    .replace(/[\r\n\s]/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Cache Google OAuth2 token for 55 minutes
let cachedGoogleToken: { token: string; expiresAt: number } | null = null;

async function getGoogleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > now + 60) {
    return cachedGoogleToken.token;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: fcmConfig.clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedClaims = base64url(new TextEncoder().encode(JSON.stringify(claims)));
  const dataToSign = new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`);

  const keyBuffer = pemToArrayBuffer(fcmConfig.privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, dataToSign);
  const jwt = `${encodedHeader}.${encodedClaims}.${base64url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const resData = await response.json();
  if (!response.ok || !resData.access_token) {
    throw new Error(`Failed to get Google Access Token: ${JSON.stringify(resData)}`);
  }

  cachedGoogleToken = {
    token: resData.access_token,
    expiresAt: now + (resData.expires_in || 3600),
  };

  return resData.access_token;
}

class PushNotificationService {
  private isInitialized = false;
  private currentUserId: string | null = null;
  private currentToken: string | null = null;
  private onConversationClickCallback: ((conversationId: string) => void) | null = null;

  public async init(
    userId: string,
    onConversationClick?: (conversationId: string) => void
  ): Promise<void> {
    this.currentUserId = userId;
    if (onConversationClick) {
      this.onConversationClickCallback = onConversationClick;
    }

    // Global listener for deep links triggered from MainActivity
    (window as any).handleNotificationDeepLink = (convId: string) => {
      if (convId && this.onConversationClickCallback) {
        this.onConversationClickCallback(convId);
      }
    };

    // Global listener for direct replies triggered from Android notification shade
    (window as any).handleDirectReply = async (payload: { conversationId: string; content: string } | string, contentText?: string) => {
      try {
        let conversationId = "";
        let content = "";
        if (typeof payload === "object" && payload !== null) {
          conversationId = payload.conversationId;
          content = payload.content;
        } else if (typeof payload === "string") {
          conversationId = payload;
          content = contentText || "";
        }
        if (!conversationId || !content) return;

        console.log("[PushNotification] Handling direct reply for:", conversationId, content);
        const { chatService } = await import("./chatService");
        const { useStore } = await import("../hooks/useStore");
        const currentUser = useStore.getState().user;
        if (currentUser?.id) {
          await chatService.sendMessage(conversationId, currentUser.id, content);
          useStore.getState().fetchConversations();
        }
      } catch (err) {
        console.error("[PushNotification] Error handling direct reply in webview:", err);
      }
    };

    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // Sync session to native Android SharedPreferences
    this.syncAuthWithNative(userId);

    // Check if there was a pending notification click on cold start
    if (typeof (window as any).KBNativeBridge?.getPendingConversationId === "function") {
      const pendingConvId = (window as any).KBNativeBridge.getPendingConversationId();
      if (pendingConvId && this.onConversationClickCallback) {
        this.onConversationClickCallback(pendingConvId);
      }
    }

    if (this.isInitialized) {
      if (this.currentToken && !isMockMode && supabase) {
        await this.saveTokenToDatabase(userId, this.currentToken);
      }
      return;
    }

    try {
      // 1. Create high-priority notification channel for Android (WhatsApp/Messenger style)
      await PushNotifications.createChannel({
        id: "messages",
        name: "Messages",
        description: "New chat and group messages",
        importance: 5, // IMPORTANCE_HIGH: heads-up notification with sound & vibration
        visibility: 1, // VISIBILITY_PUBLIC
        sound: "default",
        vibration: true,
        lights: true,
        lightColor: "#6366f1",
      }).catch((err) => {
        console.warn("Error creating messages notification channel:", err);
      });

      // 1b. Create high-priority notification channel for Incoming Calls (ringtone & full-screen)
      await PushNotifications.createChannel({
        id: "calls",
        name: "Incoming Calls",
        description: "Incoming voice and video calls",
        importance: 5, // IMPORTANCE_HIGH
        visibility: 1, // VISIBILITY_PUBLIC
        sound: "default",
        vibration: true,
        lights: true,
        lightColor: "#10b981",
      }).catch((err) => {
        console.warn("Error creating calls notification channel:", err);
      });

      // 2. Add listeners before requesting permissions or registering
      this.setupListeners();

      // 3. Request permissions
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive !== "granted") {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive === "granted") {
        await PushNotifications.register();
        this.isInitialized = true;
      } else {
        console.warn("Push notification permission was not granted:", permStatus.receive);
      }
    } catch (err) {
      console.error("Error initializing push notifications:", err);
    }
  }

  public async syncAuthWithNative(userId: string): Promise<void> {
    if (!Capacitor.isNativePlatform() || !supabase) return;
    try {
      if (typeof (window as any).KBNativeBridge?.syncUserAuth === "function") {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token || "";
        const { data: profile } = await supabase.from("profiles").select("username, full_name").eq("id", userId).maybeSingle();
        const userName = profile?.username || profile?.full_name || "User";
        (window as any).KBNativeBridge.syncUserAuth(userId, userName, token);
      }
    } catch (e) {
      console.warn("Error syncing auth with native:", e);
    }
  }

  private setupListeners(): void {
    PushNotifications.removeAllListeners().catch(() => {});

    // Token successfully received from FCM
    PushNotifications.addListener("registration", async (token: Token) => {
      this.currentToken = token.value;
      if (this.currentUserId && !isMockMode && supabase) {
        await this.saveTokenToDatabase(this.currentUserId, token.value);
      }
    });

    PushNotifications.addListener("registrationError", (error: any) => {
      console.error("Push registration error:", error);
    });

    // Foreground push notification
    PushNotifications.addListener("pushNotificationReceived", (notification: PushNotificationSchema) => {
      console.log("Foreground push notification received:", notification);
    });

    // User tapped notification -> Deep link to chat
    PushNotifications.addListener("pushNotificationActionPerformed", (action: ActionPerformed) => {
      const data = action.notification.data;
      const conversationId = data?.conversationId || data?.conversation_id;

      if (conversationId && this.onConversationClickCallback) {
        this.onConversationClickCallback(conversationId);
      }
    });
  }

  private async saveTokenToDatabase(userId: string, token: string): Promise<void> {
    try {
      console.log("[PushNotification] Registering device token in Supabase for user:", userId);
      const { error } = await supabase.from("user_push_tokens").upsert(
        {
          user_id: userId,
          token: token,
          platform: Capacitor.getPlatform(),
          device_info: {
            userAgent: navigator.userAgent,
            platform: Capacitor.getPlatform(),
            registered_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" }
      );

      if (error) {
        console.warn("[PushNotification] Could not save push token to user_push_tokens:", error.message);
      } else {
        console.log("[PushNotification] Push token successfully registered in database!");
      }
    } catch (err) {
      console.warn("[PushNotification] Error saving push token to database:", err);
    }
  }

  public async unregister(userId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      if (this.currentToken && !isMockMode && supabase) {
        await supabase
          .from("user_push_tokens")
          .delete()
          .eq("user_id", userId)
          .eq("token", this.currentToken);
      }
      this.currentUserId = null;
      this.currentToken = null;
      this.isInitialized = false;
      await PushNotifications.removeAllListeners().catch(() => {});
    } catch (err) {
      console.warn("Error unregistering push notifications:", err);
    }
  }

  public setConversationClickCallback(callback: (conversationId: string) => void): void {
    this.onConversationClickCallback = callback;
  }

  public async sendPushNotification(params: {
    conversationId: string;
    senderId: string;
    senderName: string;
    content: string;
    mediaType?: string | null;
  }): Promise<void> {
    if (isMockMode || !supabase) return;

    const notificationTitle = params.senderName || "Kotha Barta";
    const notificationBody =
      params.content && params.content.trim() !== ""
        ? params.content
        : params.mediaType
        ? `Sent a ${params.mediaType}`
        : "Sent a new message";

    // Path 1: Direct FCM v1 Dispatch
    try {
      // 1. Get recipients in the conversation
      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", params.conversationId)
        .neq("user_id", params.senderId);

      if (members && members.length > 0) {
        const recipientUserIds = members.map((m: any) => m.user_id);

        // 2. Filter blocked users
        const { data: blocks } = await supabase
          .from("blocks")
          .select("blocker_id")
          .in("blocker_id", recipientUserIds)
          .eq("blocked_id", params.senderId);

        const blockerIds = new Set((blocks || []).map((b: any) => b.blocker_id));
        const activeRecipients = recipientUserIds.filter((id: string) => !blockerIds.has(id));

        if (activeRecipients.length > 0) {
          // 3. Fetch active device tokens
          console.log("[PushNotification] Active recipients for push notification:", activeRecipients);
          const { data: pushTokens, error: tokenErr } = await supabase
            .from("user_push_tokens")
            .select("id, token")
            .in("user_id", activeRecipients);

          if (tokenErr) {
            console.error("[PushNotification] Error fetching user_push_tokens:", tokenErr.message);
          }
          console.log("[PushNotification] Tokens found for recipients:", pushTokens?.length || 0);

          if (pushTokens && pushTokens.length > 0) {
            // 4. Get Google OAuth2 Access Token
            const accessToken = await getGoogleAccessToken();
            const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${fcmConfig.projectId}/messages:send`;

            // 5. Send FCM message to each token
            const staleIds: string[] = [];
            for (const item of pushTokens) {
              try {
                const res = await fetch(fcmEndpoint, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    message: {
                      token: item.token,
                      notification: {
                        title: String(notificationTitle),
                        body: String(notificationBody),
                      },
                      data: {
                        conversationId: String(params.conversationId),
                        senderId: String(params.senderId),
                        senderName: String(params.senderName || "Someone"),
                        title: String(notificationTitle),
                        body: String(notificationBody),
                        type: "chat_message",
                      },
                      android: {
                        priority: "high",
                        notification: {
                          channel_id: "messages",
                          sound: "default",
                          click_action: "FCM_PLUGIN_ACTIVITY",
                          icon: "ic_stat_notify",
                        },
                      },
                    },
                  }),
                });

                if (res.status === 404 || res.status === 400) {
                  const errBody = await res.json().catch(() => ({}));
                  if (
                    res.status === 404 ||
                    errBody.error?.message?.includes("UNREGISTERED") ||
                    errBody.error?.details?.some((d: any) => d.errorCode === "UNREGISTERED")
                  ) {
                    staleIds.push(item.id);
                  }
                }
              } catch (e) {
                console.warn("FCM send error for token:", e);
              }
            }

            // Cleanup stale tokens
            if (staleIds.length > 0) {
              await supabase.from("user_push_tokens").delete().in("id", staleIds);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Direct FCM dispatch error:", err);
    }

    // Path 2: Also trigger Edge Function if available
    try {
      await supabase.functions.invoke("send-push-notification", {
        body: {
          conversationId: params.conversationId,
          senderId: params.senderId,
          senderName: params.senderName,
          content: notificationBody,
          mediaType: params.mediaType || null,
        },
      });
    } catch {
      // Ignored since direct FCM handled it
    }
  }

  public async sendBroadcastPush(title: string, body: string): Promise<void> {
    if (isMockMode || !supabase) return;

    try {
      const { data: tokens, error } = await supabase
        .from("user_push_tokens")
        .select("id, token");

      if (error || !tokens || tokens.length === 0) return;

      const googleToken = await getGoogleAccessToken();
      const staleIds: string[] = [];

      for (const item of tokens) {
        try {
          const res = await fetch(
            `https://fcm.googleapis.com/v1/projects/${fcmConfig.projectId}/messages:send`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${googleToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: {
                  token: item.token,
                  notification: {
                    title: title,
                    body: body,
                  },
                  data: {
                    type: "system_announcement",
                  },
                  android: {
                    priority: "high",
                    notification: {
                      channel_id: "messages",
                      sound: "default",
                    },
                  },
                },
              }),
            }
          );

          if (res.status === 404 || res.status === 400) {
            const errBody = await res.json().catch(() => ({}));
            if (
              res.status === 404 ||
              errBody.error?.message?.includes("UNREGISTERED") ||
              errBody.error?.details?.some((d: any) => d.errorCode === "UNREGISTERED")
            ) {
              staleIds.push(item.id);
            }
          }
        } catch (e) {
          console.warn("FCM broadcast error for token:", e);
        }
      }

      if (staleIds.length > 0) {
        await supabase.from("user_push_tokens").delete().in("id", staleIds);
      }
    } catch (err) {
      console.warn("sendBroadcastPush error:", err);
    }
  }

  public async sendDirectUserPush(
    userId: string,
    title: string,
    body: string,
    dataPayload?: Record<string, string>
  ): Promise<void> {
    if (isMockMode || !supabase) return;

    try {
      const { data: tokens, error } = await supabase
        .from("user_push_tokens")
        .select("id, token")
        .eq("user_id", userId);

      if (error || !tokens || tokens.length === 0) return;

      const googleToken = await getGoogleAccessToken();
      const staleIds: string[] = [];

      for (const item of tokens) {
        try {
          const res = await fetch(
            `https://fcm.googleapis.com/v1/projects/${fcmConfig.projectId}/messages:send`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${googleToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: {
                  token: item.token,
                  notification: {
                    title: title,
                    body: body,
                  },
                  data: {
                    type: dataPayload?.type || "account_status",
                    ...dataPayload,
                  },
                  android: {
                    priority: "high",
                    notification: {
                      channel_id: "messages",
                      sound: "default",
                    },
                  },
                },
              }),
            }
          );

          if (res.status === 404 || res.status === 400) {
            const errBody = await res.json().catch(() => ({}));
            if (
              res.status === 404 ||
              errBody.error?.message?.includes("UNREGISTERED") ||
              errBody.error?.details?.some((d: any) => d.errorCode === "UNREGISTERED")
            ) {
              staleIds.push(item.id);
            }
          }
        } catch (e) {
          console.warn("FCM direct user push error for token:", e);
        }
      }

      if (staleIds.length > 0) {
        await supabase.from("user_push_tokens").delete().in("id", staleIds);
      }
    } catch (err) {
      console.warn("sendDirectUserPush error:", err);
    }
  }

  public async sendCallPush(params: {
    callId: string;
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    callType: "voice" | "video";
    receiverId: string;
  }): Promise<void> {
    if (isMockMode || !supabase) return;

    try {
      // 1. Fetch active device tokens for the receiver
      const { data: tokens, error } = await supabase
        .from("user_push_tokens")
        .select("id, token")
        .eq("user_id", params.receiverId);

      if (error || !tokens || tokens.length === 0) {
        console.log("[PushNotification] No push tokens found for call receiver:", params.receiverId);
        return;
      }

      console.log(`[PushNotification] Sending high-priority incoming call push to ${tokens.length} device(s)`);
      const googleToken = await getGoogleAccessToken();
      const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${fcmConfig.projectId}/messages:send`;
      const staleIds: string[] = [];

      const callTitle = `${params.callerName || "Someone"} is calling...`;
      const callBody = `Incoming ${params.callType === "video" ? "video" : "voice"} call`;

      for (const item of tokens) {
        try {
          const res = await fetch(fcmEndpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${googleToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: item.token,
                notification: {
                  title: callTitle,
                  body: callBody,
                },
                data: {
                  type: "incoming_call",
                  callId: String(params.callId),
                  callerId: String(params.callerId),
                  callerName: String(params.callerName || "User"),
                  callerAvatar: String(params.callerAvatar || ""),
                  callType: String(params.callType),
                  title: callTitle,
                  body: callBody,
                },
                android: {
                  priority: "high",
                  notification: {
                    channel_id: "calls",
                    sound: "default",
                    click_action: "FCM_PLUGIN_ACTIVITY",
                    icon: "ic_stat_notify",
                  },
                },
              },
            }),
          });

          if (res.status === 404 || res.status === 400) {
            const errBody = await res.json().catch(() => ({}));
            if (
              res.status === 404 ||
              errBody.error?.message?.includes("UNREGISTERED") ||
              errBody.error?.details?.some((d: any) => d.errorCode === "UNREGISTERED")
            ) {
              staleIds.push(item.id);
            }
          }
        } catch (e) {
          console.warn("[PushNotification] FCM call push error for token:", e);
        }
      }

      if (staleIds.length > 0) {
        await supabase.from("user_push_tokens").delete().in("id", staleIds);
      }
    } catch (err) {
      console.warn("[PushNotification] sendCallPush error:", err);
    }
  }

  public async sendCallCancelledPush(params: {
    callId: string;
    receiverId: string;
  }): Promise<void> {
    if (isMockMode || !supabase) return;

    try {
      const { data: tokens, error } = await supabase
        .from("user_push_tokens")
        .select("id, token")
        .eq("user_id", params.receiverId);

      if (error || !tokens || tokens.length === 0) return;

      const googleToken = await getGoogleAccessToken();
      const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${fcmConfig.projectId}/messages:send`;
      const staleIds: string[] = [];

      for (const item of tokens) {
        try {
          const res = await fetch(fcmEndpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${googleToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: item.token,
                data: {
                  type: "call_cancelled",
                  callId: String(params.callId),
                },
                android: {
                  priority: "high",
                },
              },
            }),
          });

          if (res.status === 404 || res.status === 400) {
            const errBody = await res.json().catch(() => ({}));
            if (
              res.status === 404 ||
              errBody.error?.message?.includes("UNREGISTERED") ||
              errBody.error?.details?.some((d: any) => d.errorCode === "UNREGISTERED")
            ) {
              staleIds.push(item.id);
            }
          }
        } catch (e) {
          console.warn("[PushNotification] FCM call cancel push error for token:", e);
        }
      }

      if (staleIds.length > 0) {
        await supabase.from("user_push_tokens").delete().in("id", staleIds);
      }
    } catch (err) {
      console.warn("[PushNotification] sendCallCancelledPush error:", err);
    }
  }
}

export const pushNotificationService = new PushNotificationService();

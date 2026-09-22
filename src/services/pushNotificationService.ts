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

  public isReady(): boolean {
    return this.isInitialized;
  }

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

    // Global listener for native Android FCM token bridge
    (window as any).handleNativeFcmToken = async (token: string) => {
      console.log("[PushNotification] Received native FCM token via bridge:", token);
      if (token) {
        this.currentToken = token;
        try {
          localStorage.setItem("kb_fcm_token", token);
        } catch (ignored) {}
        if (this.currentUserId && !isMockMode && supabase) {
          await this.saveTokenToDatabase(this.currentUserId, token);
        }
      }
    };

    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // 1. Sync session to native Android SharedPreferences
    this.syncAuthWithNative(userId);

    // 2. Check if token already exists in localStorage and sync to database
    try {
      const cachedToken = localStorage.getItem("kb_fcm_token");
      if (cachedToken && !isMockMode && supabase) {
        this.currentToken = cachedToken;
        await this.saveTokenToDatabase(userId, cachedToken);
      }
    } catch (ignored) {}

    // 3. Check if token already exists in native Android bridge
    try {
      if (typeof (window as any).KBNativeBridge?.getFcmToken === "function") {
        const nativeToken = (window as any).KBNativeBridge.getFcmToken();
        if (nativeToken && !isMockMode && supabase) {
          this.currentToken = nativeToken;
          localStorage.setItem("kb_fcm_token", nativeToken);
          await this.saveTokenToDatabase(userId, nativeToken);
        }
      }
    } catch (ignored) {}

    // 4. Trigger native token refresh
    try {
      if (typeof (window as any).KBNativeBridge?.refreshFcmToken === "function") {
        (window as any).KBNativeBridge.refreshFcmToken();
      }
    } catch (ignored) {}

    // Check if there was a pending notification click on cold start
    if (typeof (window as any).KBNativeBridge?.getPendingConversationId === "function") {
      const pendingConvId = (window as any).KBNativeBridge.getPendingConversationId();
      if (pendingConvId && this.onConversationClickCallback) {
        this.onConversationClickCallback(pendingConvId);
      }
    }

    try {
      // 5. Create high-priority notification channel for Android (WhatsApp/Messenger style)
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

      // 6. Add Capacitor listeners
      this.setupListeners();

      // 7. Request permissions in background (non-blocking)
      PushNotifications.checkPermissions().then(async (permStatus) => {
        if (permStatus.receive !== "granted") {
          await PushNotifications.requestPermissions().catch(() => {});
        }
      }).catch(() => {});

      // 8. ALWAYS register with FCM on native platform regardless of UI notification status
      await PushNotifications.register().catch((err) => {
        console.warn("[PushNotification] PushNotifications.register warning:", err);
      });
      this.isInitialized = true;
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
      console.log("[PushNotification] Token received from Capacitor registration listener:", token.value);
      this.currentToken = token.value;
      try {
        localStorage.setItem("kb_fcm_token", token.value);
      } catch (ignored) {}
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

  public async saveTokenToDatabase(userId: string, token: string): Promise<boolean> {
    if (!userId || !token || isMockMode || !supabase) return false;
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
        return false;
      } else {
        console.log("[PushNotification] Push token successfully registered in database for user:", userId);
        return true;
      }
    } catch (err) {
      console.warn("[PushNotification] Error saving push token to database:", err);
      return false;
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
        let activeRecipients = recipientUserIds.filter((id: string) => !blockerIds.has(id));

        // Filter out recipients who muted this conversation
        if (activeRecipients.length > 0) {
          try {
            const { data: mutePrefs } = await supabase
              .from("user_conversation_prefs")
              .select("user_id, is_muted, mute_until")
              .eq("conversation_id", params.conversationId)
              .in("user_id", activeRecipients)
              .eq("is_muted", true);

            if (mutePrefs && mutePrefs.length > 0) {
              const nowTime = Date.now();
              const mutedUserIds = new Set(
                mutePrefs
                  .filter((p: any) => !p.mute_until || new Date(p.mute_until).getTime() > nowTime)
                  .map((p: any) => p.user_id)
              );
              activeRecipients = activeRecipients.filter((id: string) => !mutedUserIds.has(id));
            }
          } catch (muteErr) {
            console.warn("[PushNotification] Could not verify mute prefs:", muteErr);
          }
        }

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
                      // DATA-ONLY payload — no top-level "notification" field.
                      // This ensures Android always calls KothaBartaMessagingService.onMessageReceived()
                      // even when the app is in background/killed, so our custom notification
                      // with the inline RemoteInput reply button is always built correctly.
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
    conversationId?: string;
  }): Promise<void> {
    if (isMockMode || !supabase) return;

    try {
      // Check if receiver muted calls for this conversation / caller
      try {
        let conversationId = params.conversationId;
        if (!conversationId) {
          // Check if there is a 1-on-1 conversation
          const { data: myMemberships } = await supabase
            .from("conversation_members")
            .select("conversation_id")
            .eq("user_id", params.receiverId);

          if (myMemberships && myMemberships.length > 0) {
            const convIds = myMemberships.map((m: any) => m.conversation_id);
            const { data: callerMemberships } = await supabase
              .from("conversation_members")
              .select("conversation_id")
              .in("conversation_id", convIds)
              .eq("user_id", params.callerId)
              .limit(1);

            if (callerMemberships && callerMemberships.length > 0) {
              conversationId = callerMemberships[0].conversation_id;
            }
          }
        }

        if (conversationId) {
          const { data: pref } = await supabase
            .from("user_conversation_prefs")
            .select("is_muted, mute_until, mute_type")
            .eq("user_id", params.receiverId)
            .eq("conversation_id", conversationId)
            .maybeSingle();

          if (pref && pref.is_muted && pref.mute_type === "all") {
            if (!pref.mute_until || new Date(pref.mute_until).getTime() > Date.now()) {
              console.log("[PushNotification] Call push suppressed: receiver muted calls for this conversation");
              return;
            }
          }
        }
      } catch (muteCheckErr) {
        console.warn("[PushNotification] Error checking call mute pref:", muteCheckErr);
      }

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
                  ttl: "60s",
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

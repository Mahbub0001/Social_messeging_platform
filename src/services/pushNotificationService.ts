import { Capacitor } from "@capacitor/core";
import { PushNotifications, type Token, type ActionPerformed, type PushNotificationSchema } from "@capacitor/push-notifications";
import { supabase, isMockMode } from "../lib/supabase";

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

    // Push notifications are only supported on native mobile platforms (Android/iOS)
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    if (this.isInitialized) {
      // Already initialized, but re-registering for current user
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
        console.warn("Error creating notification channel:", err);
      });

      // 2. Add listeners before requesting permissions or registering
      this.setupListeners();

      // 3. Request permissions
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === "prompt") {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive === "granted") {
        await PushNotifications.register();
        this.isInitialized = true;
      } else {
        console.warn("Push notification permission was denied by user.");
      }
    } catch (err) {
      console.error("Error initializing push notifications:", err);
    }
  }

  private setupListeners(): void {
    // Remove existing listeners to avoid duplicates
    PushNotifications.removeAllListeners().catch(() => {});

    // Token successfully received from FCM
    PushNotifications.addListener("registration", async (token: Token) => {
      this.currentToken = token.value;
      if (this.currentUserId && !isMockMode && supabase) {
        await this.saveTokenToDatabase(this.currentUserId, token.value);
      }
    });

    // Token registration error
    PushNotifications.addListener("registrationError", (error: any) => {
      console.error("Push registration error:", error);
    });

    // Notification received while app is in foreground
    PushNotifications.addListener("pushNotificationReceived", (notification: PushNotificationSchema) => {
      // In foreground, app can show in-app banner or let the system channel display
      console.log("Foreground push notification received:", notification);
    });

    // Notification tapped / action performed by user
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
        // Table might not exist yet if user hasn't run the SQL migration
        console.warn("Could not save push token to user_push_tokens (table may need migration):", error.message);
      }
    } catch (err) {
      console.warn("Error saving push token to database:", err);
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

    try {
      // Trigger Supabase Edge Function to dispatch FCM push
      await supabase.functions.invoke("send-push-notification", {
        body: {
          conversationId: params.conversationId,
          senderId: params.senderId,
          senderName: params.senderName,
          content:
            params.content ||
            (params.mediaType ? `Sent a ${params.mediaType}` : "Sent a message"),
          mediaType: params.mediaType || null,
        },
      });
    } catch (err) {
      console.warn("Push notification dispatch failed or Edge Function not deployed:", err);
    }
  }
}

export const pushNotificationService = new PushNotificationService();

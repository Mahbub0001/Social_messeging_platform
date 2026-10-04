import { PushNotifications, type ActionPerformed, type PushNotificationSchema, type Token } from "@capacitor/push-notifications";
import { supabase, isMockMode } from "../lib/supabase";

const PUSH_TIMEOUT_MS = 12_000;

class PushNotificationService {
  private isInitialized = false;
  private currentUserId: string | null = null;
  private currentToken: string | null = null;
  private onConversationClickCallback: ((conversationId: string) => void) | null = null;

  private async dispatchServerPush(payload: Record<string, unknown>): Promise<void> {
    if (!supabase) return;
    let timer: number | undefined;
    const request = supabase.functions.invoke("send-push-notification", { body: payload });
    const timeout = new Promise<never>((_, reject) => { timer = window.setTimeout(() => reject(new Error("Push dispatch timed out")), PUSH_TIMEOUT_MS); });
    try { const { error } = await Promise.race([request, timeout]); if (error) throw error; }
    finally { if (timer !== undefined) window.clearTimeout(timer); }
  }

  private async syncIncomingConversation(data: Record<string, unknown> | undefined): Promise<void> {
    const id = data?.conversationId ?? data?.conversation_id;
    if (typeof id !== "string" || !id) return;
    try {
      const { useStore } = await import("../hooks/useStore");
      const state = useStore.getState();
      await state.fetchConversations();
      if (state.activeConversationId === id) await state.fetchMessages(id);
    } catch (error) { console.warn("[PushNotification] Conversation refresh failed:", error); }
  }

  public isReady(): boolean { return this.isInitialized; }

  public async init(userId: string, onConversationClick?: (conversationId: string) => void): Promise<void> {
    this.currentUserId = userId;
    if (onConversationClick) this.onConversationClickCallback = onConversationClick;
    if (this.isInitialized || isMockMode) return;
    await PushNotifications.requestPermissions();
    await PushNotifications.register();
    PushNotifications.addListener("registration", (token: Token) => { this.currentToken = token.value; if (this.currentUserId) void this.saveTokenToDatabase(this.currentUserId, token.value); });
    PushNotifications.addListener("registrationError", (error) => console.warn("[PushNotification] Registration failed:", error));
    PushNotifications.addListener("pushNotificationReceived", (notification: PushNotificationSchema) => { void this.syncIncomingConversation(notification.data as Record<string, unknown>); });
    PushNotifications.addListener("pushNotificationActionPerformed", (action: ActionPerformed) => {
      const data = (action.notification.data || {}) as Record<string, unknown>;
      void this.syncIncomingConversation(data);
      const id = data.conversationId ?? data.conversation_id;
      if (typeof id === "string" && id) this.onConversationClickCallback?.(id);
    });
    this.isInitialized = true;
  }

  public async syncAuthWithNative(userId: string): Promise<void> { this.currentUserId = userId; if (this.currentToken) await this.saveTokenToDatabase(userId, this.currentToken); }
  public syncMutedConversationsWithNative(userId: string): void { void userId; /* Native service refreshes this on launch. */ }

  public async saveTokenToDatabase(userId: string, token: string): Promise<boolean> {
    if (isMockMode || !supabase || !token) return false;
    const { error } = await supabase.from("user_push_tokens").upsert({ user_id: userId, token, platform: "android", updated_at: new Date().toISOString() }, { onConflict: "user_id,token" });
    if (error) { console.warn("[PushNotification] Token save failed:", error.message); return false; }
    return true;
  }

  public async unregister(userId: string): Promise<void> { if (!isMockMode && supabase) await supabase.from("user_push_tokens").delete().eq("user_id", userId); this.currentToken = null; }
  public setConversationClickCallback(callback: (conversationId: string) => void): void { this.onConversationClickCallback = callback; }

  public async sendPushNotification(params: { recipientUserIds?: string[]; conversationId: string; senderId: string; senderName?: string; notificationTitle?: string; content: string; mediaType?: string | null; blockerIds?: Set<string>; }): Promise<void> {
    if (isMockMode || !supabase) return;
    const recipients = params.recipientUserIds?.filter((id) => !params.blockerIds?.has(id));
    try { await this.dispatchServerPush({ action: "chat_message", conversationId: params.conversationId, recipientUserIds: recipients, content: params.content, mediaType: params.mediaType || null }); }
    catch (error) { console.warn("[PushNotification] Chat push failed:", error); }
  }

  public async sendBroadcastPush(title: string, body: string): Promise<void> { if (isMockMode || !supabase) return; try { await this.dispatchServerPush({ action: "system_broadcast", title, content: body }); } catch (error) { console.warn("[PushNotification] Broadcast push failed:", error); } }

  public async sendDirectUserPush(userId: string, title: string, body: string, dataPayload?: Record<string, string>): Promise<void> {
    if (isMockMode || !supabase) return;
    try { await this.dispatchServerPush({ action: "user_push", targetUserId: userId, title, content: body, data: dataPayload || { type: "account_status" } }); }
    catch (error) { console.warn("[PushNotification] Direct push failed:", error); }
  }

  public async sendCallPush(params: { callerId: string; callerName?: string; receiverId: string; callId: string; conversationId?: string; callType: "voice" | "video"; callerAvatar?: string; }): Promise<void> {
    if (isMockMode || !supabase || !params.conversationId) return;
    try { await this.dispatchServerPush({ action: "incoming_call", receiverId: params.receiverId, callId: params.callId, conversationId: params.conversationId, callType: params.callType, callerAvatar: params.callerAvatar || "" }); }
    catch (error) { console.warn("[PushNotification] Call push failed:", error); }
  }

  public async sendCallCancelledPush(params: { callId: string; receiverId: string; conversationId?: string }): Promise<void> {
    if (isMockMode || !supabase || !params.conversationId) return;
    try { await this.dispatchServerPush({ action: "call_cancelled", receiverId: params.receiverId, callId: params.callId, conversationId: params.conversationId }); }
    catch (error) { console.warn("[PushNotification] Call cancel push failed:", error); }
  }
}

export const pushNotificationService = new PushNotificationService();

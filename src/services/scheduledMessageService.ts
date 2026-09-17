import { chatService } from "./chatService";
import { supabase, isMockMode } from "../lib/supabase";
import { audioSynthesizer } from "../utils/audio";

export interface ScheduledMessage {
  id: string;
  senderId: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar?: string;
  conversationId: string;
  message: string;
  scheduledAt: string; // ISO 8601 string
  displayTime?: string; // Human readable description like "আজ রাত ৯:০০ টা"
  status: "pending" | "sent" | "failed" | "cancelled";
  createdAt: string;
  sentAt?: string;
  error?: string;
}

const STORAGE_KEY = "kb_scheduled_messages";

class ScheduledMessageServiceClass {
  private intervalId: any = null;
  private isProcessing = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      this.startDaemon();
    }
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error("[ScheduledMessageService] Listener error:", e);
      }
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("kb_scheduled_messages_changed"));
    }
  }

  public getStoredMessages(): ScheduledMessage[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.error("[ScheduledMessageService] Failed to read from localStorage:", e);
      return [];
    }
  }

  private saveStoredMessages(messages: ScheduledMessage[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      this.notify();
    } catch (e) {
      console.error("[ScheduledMessageService] Failed to save to localStorage:", e);
    }
  }

  public getPendingMessages(userId?: string): ScheduledMessage[] {
    const list = this.getStoredMessages();
    return list.filter((m) => {
      const matchesUser = userId ? m.senderId === userId : true;
      return matchesUser && m.status === "pending";
    });
  }

  public getAllMessages(userId?: string): ScheduledMessage[] {
    const list = this.getStoredMessages();
    return list.filter((m) => (userId ? m.senderId === userId : true));
  }

  public async scheduleMessage(params: {
    senderId: string;
    receiverId: string;
    receiverName: string;
    receiverAvatar?: string;
    conversationId: string;
    message: string;
    scheduledAt: string | Date;
    displayTime?: string;
  }): Promise<ScheduledMessage> {
    const scheduledDate =
      typeof params.scheduledAt === "string"
        ? new Date(params.scheduledAt)
        : params.scheduledAt;

    const newItem: ScheduledMessage = {
      id: "sch-" + Math.random().toString(36).substring(2, 10) + "-" + Date.now(),
      senderId: params.senderId,
      receiverId: params.receiverId,
      receiverName: params.receiverName,
      receiverAvatar: params.receiverAvatar,
      conversationId: params.conversationId,
      message: params.message,
      scheduledAt: scheduledDate.toISOString(),
      displayTime:
        params.displayTime ||
        scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    const current = this.getStoredMessages();
    this.saveStoredMessages([newItem, ...current]);

    // Attempt Supabase sync gracefully
    if (!isMockMode && supabase) {
      supabase
        .from("scheduled_messages")
        .insert({
          id: newItem.id,
          sender_id: newItem.senderId,
          receiver_id: newItem.receiverId,
          conversation_id: newItem.conversationId,
          message: newItem.message,
          scheduled_at: newItem.scheduledAt,
          status: newItem.status,
        })
        .then((res: any) => {
          const error = res?.error;
          if (error && error.code !== "42P01") {
            // 42P01 means table does not exist yet; ignore silently
            console.warn("[ScheduledMessageService] Supabase sync note:", error.message);
          }
        })
        .catch(() => {});
    }

    return newItem;
  }

  public cancelMessage(id: string): boolean {
    const messages = this.getStoredMessages();
    const target = messages.find((m) => m.id === id);
    if (!target) return false;

    target.status = "cancelled";
    this.saveStoredMessages(messages);

    if (!isMockMode && supabase) {
      supabase
        .from("scheduled_messages")
        .update({ status: "cancelled" })
        .eq("id", id)
        .catch(() => {});
    }

    return true;
  }

  public startDaemon() {
    if (this.intervalId) return;

    // Check immediately on startup
    this.processQueue();

    // Check every 8 seconds for accurate dispatch
    this.intervalId = setInterval(() => {
      this.processQueue();
    }, 8000);
  }

  public stopDaemon() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const messages = this.getStoredMessages();
      const now = Date.now();
      let hasUpdates = false;

      for (const item of messages) {
        if (item.status !== "pending") continue;

        const targetTime = new Date(item.scheduledAt).getTime();
        if (targetTime <= now) {
          console.log(`[ScheduledMessageService] Executing scheduled message to ${item.receiverName}: "${item.message}"`);

          try {
            const result = await chatService.sendMessage(
              item.conversationId,
              item.senderId,
              item.message
            );

            if (result.error) {
              item.status = "failed";
              item.error = result.error.message || "Failed to send";
            } else {
              item.status = "sent";
              item.sentAt = new Date().toISOString();

              // Play audio chime and trigger notification
              audioSynthesizer.playMessageNotification();

              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Bhuiyan AI - শিডিউল মেসেজ পাঠানো হয়েছে", {
                  body: `${item.receiverName} কে "${item.message}" পাঠানো হয়েছে।`,
                  icon: "/favicon.svg",
                });
              }
            }
          } catch (err: any) {
            item.status = "failed";
            item.error = err?.message || "Execution exception";
          }

          hasUpdates = true;
        }
      }

      if (hasUpdates) {
        this.saveStoredMessages(messages);
      }
    } catch (err) {
      console.error("[ScheduledMessageService] Error in processQueue:", err);
    } finally {
      this.isProcessing = false;
    }
  }
}

export const scheduledMessageService = new ScheduledMessageServiceClass();

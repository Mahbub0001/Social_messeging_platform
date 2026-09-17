import { chatService } from "./chatService";
import { friendService } from "./friendService";
import { scheduledMessageService, type ScheduledMessage } from "./scheduledMessageService";
import { useStore } from "../hooks/useStore";
import type { Profile } from "./mockDb";

export interface AiActionResult {
  type: "send_message" | "start_call" | "schedule_message" | "list_scheduled" | "cancel_scheduled" | "general_reply";
  success: boolean;
  message: string;
  data?: any;
}

export interface AiChatMessage {
  id: string;
  sender: "user" | "bhuiyan_ai";
  text: string;
  actionResult?: AiActionResult;
  timestamp: string;
}

// Read API keys safely with multiple fallbacks
export const getGroqApiKey = (): string => {
  // 1. Check browser localStorage (set via in-app UI)
  if (typeof window !== "undefined") {
    const local = localStorage.getItem("kb_groq_api_key");
    if (local && local.trim()) return local.trim();
  }

  // 2. Check process.env (Vercel runtime or Vite define)
  const gProcess = (globalThis as any).process;
  const pKey = gProcess?.env?.GROQ_API_KEY || gProcess?.env?.VITE_GROQ_API_KEY;
  if (pKey && pKey.trim()) return pKey.trim();

  // 3. Check import.meta.env
  const metaKey =
    (import.meta as any).env?.GROQ_API_KEY ||
    (import.meta as any).env?.VITE_GROQ_API_KEY;
  if (metaKey && metaKey.trim()) return metaKey.trim();

  return "";
};

export const setGroqApiKey = (key: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("kb_groq_api_key", key.trim());
  }
};

export const getGroqModel = (): string => {
  const gProcess = (globalThis as any).process;
  return (
    gProcess?.env?.MODEL_NAME ||
    gProcess?.env?.model_name ||
    gProcess?.env?.VITE_MODEL_NAME ||
    (import.meta as any).env?.model_name ||
    (import.meta as any).env?.VITE_MODEL_NAME ||
    "llama-3.3-70b-versatile"
  );
};

// Groq Function Calling Tool Definitions
const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "send_message",
      description: "Send an instant direct message to a friend or contact in the chat app.",
      parameters: {
        type: "object",
        properties: {
          recipient_name: {
            type: "string",
            description: "The name or username of the friend to send the message to (e.g., 'Nibir', 'Nuha').",
          },
          message: {
            type: "string",
            description: "The exact text message content to send.",
          },
        },
        required: ["recipient_name", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_call",
      description: "Place a voice or video call to a friend or contact in the chat app.",
      parameters: {
        type: "object",
        properties: {
          recipient_name: {
            type: "string",
            description: "The name or username of the contact to call.",
          },
          call_type: {
            type: "string",
            enum: ["voice", "video"],
            description: "Type of call. Defaults to 'voice'.",
          },
        },
        required: ["recipient_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_message",
      description:
        "Schedule a message to be sent to a contact at a specific future time or date (e.g. at 9:00 PM, tomorrow morning, etc.).",
      parameters: {
        type: "object",
        properties: {
          recipient_name: {
            type: "string",
            description: "The name of the recipient.",
          },
          message: {
            type: "string",
            description: "The message text to be delivered.",
          },
          scheduled_iso_time: {
            type: "string",
            description:
              "ISO 8601 formatted date-time string (e.g., '2026-09-17T21:00:00') in local time when the message should be sent.",
          },
          time_description: {
            type: "string",
            description: "Human readable time description in Bengali or English (e.g., 'আজ রাত ৯:০০ টা' or 'Tonight at 9:00 PM').",
          },
        },
        required: ["recipient_name", "message", "scheduled_iso_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_scheduled_messages",
      description: "List all pending scheduled messages that have not yet been sent.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_scheduled_message",
      description: "Cancel a scheduled message using recipient name or message ID.",
      parameters: {
        type: "object",
        properties: {
          recipient_name: {
            type: "string",
            description: "Name of the recipient whose scheduled message should be cancelled.",
          },
          scheduled_id: {
            type: "string",
            description: "Optional specific scheduled message ID.",
          },
        },
      },
    },
  },
];

class AiAgentServiceClass {
  /**
   * Helper to find a friend by name
   */
  private async resolveFriend(
    recipientName: string,
    currentUserId: string
  ): Promise<Profile | null> {
    const cleanName = recipientName.trim().toLowerCase();

    // 1. Fetch user's friends list
    const { data: friends } = await friendService.getFriends(currentUserId);
    if (friends && friends.length > 0) {
      // Exact match
      const exact = friends.find((f) => f.username.toLowerCase() === cleanName);
      if (exact) return exact;

      // Substring match
      const sub = friends.find(
        (f) =>
          f.username.toLowerCase().includes(cleanName) ||
          cleanName.includes(f.username.toLowerCase())
      );
      if (sub) return sub;
    }

    // 2. Check store conversations
    const conversations = useStore.getState().conversations;
    for (const conv of conversations) {
      if (conv.is_group) continue;
      const otherMember = conv.members?.find((m) => m.id !== currentUserId);
      if (
        otherMember &&
        (otherMember.username.toLowerCase().includes(cleanName) ||
          cleanName.includes(otherMember.username.toLowerCase()))
      ) {
        return otherMember;
      }
    }

    return null;
  }

  /**
   * Helper to find or create 1-to-1 conversation with a friend
   */
  private async getOrCreateConversationId(
    currentUserId: string,
    friendId: string
  ): Promise<string> {
    const conversations = useStore.getState().conversations;

    // Check existing 1-on-1 conversation
    const existing = conversations.find(
      (c) =>
        !c.is_group &&
        c.members?.some((m) => m.id === friendId) &&
        c.members?.some((m) => m.id === currentUserId)
    );

    if (existing) {
      return existing.id;
    }

    // Create a new 1-on-1 conversation
    const { data: newConv } = await chatService.createConversation(
      [currentUserId, friendId],
      null,
      false
    );

    if (newConv) {
      useStore.getState().addConversation(newConv);
      return newConv.id;
    }

    // Fallback ID if mock
    return `conv-${currentUserId}-${friendId}`;
  }

  /**
   * Parse target date intelligently (handling cases where only time was supplied)
   */
  private parseScheduledDate(isoTime: string): Date {
    let date = new Date(isoTime);
    if (isNaN(date.getTime())) {
      // If relative or time-only, default to today
      const match = isoTime.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        date = new Date();
        date.setHours(parseInt(match[1], 10), parseInt(match[2], 10), 0, 0);
      } else {
        date = new Date(Date.now() + 60 * 60 * 1000); // 1 hr default
      }
    }

    // If time is earlier than current time today, assume user meant upcoming time or tomorrow
    if (date.getTime() < Date.now() - 60000) {
      date.setDate(date.getDate() + 1);
    }

    return date;
  }

  /**
   * Main entry point to process a command with Bhuiyan AI
   */
  public async executeCommand(
    prompt: string,
    history: { role: "user" | "assistant"; content: string }[] = []
  ): Promise<{ replyText: string; actionResult?: AiActionResult }> {
    const apiKey = getGroqApiKey();
    const model = getGroqModel();
    const currentUser = useStore.getState().user;

    if (!apiKey) {
      return {
        replyText:
          "⚠️ Groq API Key পাওয়া যায়নি! অনুগ্রহ করে আপনার `.env` ফাইলে `GROQ_API_KEY` সঠিকভাবে সেট করুন।",
      };
    }

    if (!currentUser) {
      return {
        replyText: "অনুগ্রহ করে প্রথমে অ্যাকাউন্টে লগইন করুন।",
      };
    }

    // Load available friends context for precision resolution
    const { data: friends } = await friendService.getFriends(currentUser.id);
    const friendsContext = (friends || []).map((f) => ({
      id: f.id,
      username: f.username,
    }));

    const now = new Date();
    const localTimeString = now.toLocaleString("bn-BD", {
      timeZone: "Asia/Dhaka",
      dateStyle: "full",
      timeStyle: "medium",
    });

    const systemPrompt = `You are "Bhuiyan AI", an intelligent, high-speed, proactive autonomous assistant for the user's Chat Web App.
Current Real-World Date & Time: ${now.toISOString()} (${now.toLocaleString()} / Bangladesh time: ${localTimeString}).

The user's active friends are:
${JSON.stringify(friendsContext, null, 2)}

Your capabilities:
1. "send_message": If the user asks to send a message to someone (e.g. "Nibir k 'hi' msg pathao", "Nuha ke text pathao"), extract recipient_name and message, and call the send_message tool.
2. "start_call": If the user asks to call someone (e.g. "Nibir k call dao", "Nuha k video call koro"), extract recipient_name and call_type (voice or video) and call start_call.
3. "schedule_message": If the user specifies a time (e.g. "Nuha k raat 9 tay 'kmn aso' msg pathao", "send message at 9:00pm"), compute the exact ISO timestamp for that time (today or appropriate date in ${now.getFullYear()}), and call schedule_message with recipient_name, message, scheduled_iso_time, and time_description.
4. "list_scheduled_messages": If user asks to check, show, or list scheduled messages.
5. "cancel_scheduled_message": If user asks to cancel or remove a scheduled message.

Language Guideline:
- Always respond courteously in the language the user used (natural conversational Bengali, Banglish, or English).
- When an action is taken, confirm clearly with an emoji (e.g. "✅ নিবিড়কে বার্তাটি পাঠানো হয়েছে!", "📞 কল দেওয়া হচ্ছে...", "⏰ বার্তাটি রাত ৯:০০ টায় পাঠানোর জন্য শিডিউল করা হয়েছে।").`;

    const messagesPayload = [
      { role: "system", content: systemPrompt },
      ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: prompt },
    ];

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: messagesPayload,
          tools: AI_TOOLS,
          tool_choice: "auto",
          temperature: 0.3,
          max_tokens: 600,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[Bhuiyan AI] Groq API Error:", errorData);
        return {
          replyText: `Groq API ত্রুটি (${response.status}): ${errorData?.error?.message || "সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না।"}`,
        };
      }

      const data = await response.json();
      const choice = data.choices?.[0]?.message;
      const toolCalls = choice?.tool_calls;

      // If no tool was called, return standard conversation text
      if (!toolCalls || toolCalls.length === 0) {
        return {
          replyText:
            choice?.content || "আমি আপনার কথাটি বুঝতে পেরেছি। আপনার জন্য কি করতে পারি?",
        };
      }

      // Execute primary tool call
      const firstCall = toolCalls[0];
      const fnName = firstCall.function.name;
      let args: any = {};
      try {
        args = JSON.parse(firstCall.function.arguments);
      } catch (e) {
        console.error("Failed to parse tool arguments:", e);
      }

      // ==========================================
      // ACTION 1: SEND MESSAGE
      // ==========================================
      if (fnName === "send_message") {
        const targetFriend = await this.resolveFriend(args.recipient_name, currentUser.id);
        if (!targetFriend) {
          return {
            replyText: `দুঃখিত, '${args.recipient_name}' নামের কাউকে আপনার ফ্রেন্ডলিস্ট বা চ্যাটে পাওয়া যায়নি। অনুগ্রহ করে সঠিক নামটি বলুন।`,
            actionResult: {
              type: "send_message",
              success: false,
              message: `User '${args.recipient_name}' not found`,
            },
          };
        }

        const convId = await this.getOrCreateConversationId(currentUser.id, targetFriend.id);
        const sendResult = await chatService.sendMessage(convId, currentUser.id, args.message);

        if (sendResult.error) {
          return {
            replyText: `মেসেজ পাঠাতে সমস্যা হয়েছে: ${sendResult.error.message}`,
            actionResult: {
              type: "send_message",
              success: false,
              message: sendResult.error.message,
            },
          };
        }

        // Auto-focus conversation so user sees it live
        useStore.getState().setActiveConversationId(convId);
        useStore.getState().fetchMessages(convId);

        return {
          replyText: `✅ **${targetFriend.username}** কে সফলভাবে বার্তা পাঠানো হয়েছে:\n> "${args.message}"`,
          actionResult: {
            type: "send_message",
            success: true,
            message: `Message sent to ${targetFriend.username}`,
            data: {
              recipient: targetFriend.username,
              avatar: targetFriend.avatar_url,
              content: args.message,
              conversationId: convId,
            },
          },
        };
      }

      // ==========================================
      // ACTION 2: START CALL
      // ==========================================
      if (fnName === "start_call") {
        const targetFriend = await this.resolveFriend(args.recipient_name, currentUser.id);
        if (!targetFriend) {
          return {
            replyText: `দুঃখিত, '${args.recipient_name}' নামের বন্ধুকে পাওয়া যায়নি।`,
            actionResult: {
              type: "start_call",
              success: false,
              message: `Friend not found`,
            },
          };
        }

        const callType = args.call_type === "video" ? "video" : "voice";
        const convId = await this.getOrCreateConversationId(currentUser.id, targetFriend.id);

        // Trigger store call action
        useStore.getState().startCall(targetFriend, callType, convId);

        return {
          replyText: `📞 **${targetFriend.username}** এর সাথে ${callType === "video" ? "ভিডিও" : "ভয়েস"} কল শুরু করা হচ্ছে...`,
          actionResult: {
            type: "start_call",
            success: true,
            message: `Call initiated to ${targetFriend.username}`,
            data: {
              recipient: targetFriend.username,
              avatar: targetFriend.avatar_url,
              callType,
            },
          },
        };
      }

      // ==========================================
      // ACTION 3: SCHEDULE MESSAGE
      // ==========================================
      if (fnName === "schedule_message") {
        const targetFriend = await this.resolveFriend(args.recipient_name, currentUser.id);
        if (!targetFriend) {
          return {
            replyText: `দুঃখিত, '${args.recipient_name}' নামের বন্ধুকে পাওয়া যায়নি। অনুগ্রহ করে সঠিক ফ্রেন্ডের নাম বলুন।`,
            actionResult: {
              type: "schedule_message",
              success: false,
              message: `Friend not found`,
            },
          };
        }

        const convId = await this.getOrCreateConversationId(currentUser.id, targetFriend.id);
        const scheduledDate = this.parseScheduledDate(args.scheduled_iso_time);

        const scheduledItem = await scheduledMessageService.scheduleMessage({
          senderId: currentUser.id,
          receiverId: targetFriend.id,
          receiverName: targetFriend.username,
          receiverAvatar: targetFriend.avatar_url,
          conversationId: convId,
          message: args.message,
          scheduledAt: scheduledDate,
          displayTime:
            args.time_description ||
            scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });

        const formattedTime = scheduledDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });

        return {
          replyText: `⏰ **${targetFriend.username}** এর জন্য বার্তাটি শিডিউল করা হয়েছে!\n- **সময়:** ${args.time_description || formattedTime}\n- **বার্তা:** "${args.message}"\n\nনির্ধারিত সময়ে স্বয়ংক্রিয়ভাবে মেসেজটি পাঠানো হবে।`,
          actionResult: {
            type: "schedule_message",
            success: true,
            message: `Scheduled for ${targetFriend.username}`,
            data: scheduledItem,
          },
        };
      }

      // ==========================================
      // ACTION 4: LIST SCHEDULED
      // ==========================================
      if (fnName === "list_scheduled_messages") {
        const pending = scheduledMessageService.getPendingMessages(currentUser.id);
        if (pending.length === 0) {
          return {
            replyText: "আপনার বর্তমানে কোনো পেন্ডিং শিডিউলড মেসেজ নেই।",
            actionResult: {
              type: "list_scheduled",
              success: true,
              message: "No pending scheduled messages",
              data: [],
            },
          };
        }

        const listStr = pending
          .map(
            (p, idx) =>
              `${idx + 1}. **${p.receiverName}** — "${p.message}" (সময়: ${p.displayTime || new Date(p.scheduledAt).toLocaleTimeString()})`
          )
          .join("\n");

        return {
          replyText: `📋 **আপনার পেন্ডিং শিডিউল মেসেজসমূহ:**\n\n${listStr}`,
          actionResult: {
            type: "list_scheduled",
            success: true,
            message: "List retrieved",
            data: pending,
          },
        };
      }

      // ==========================================
      // ACTION 5: CANCEL SCHEDULED
      // ==========================================
      if (fnName === "cancel_scheduled_message") {
        const pending = scheduledMessageService.getPendingMessages(currentUser.id);
        let target: ScheduledMessage | undefined;

        if (args.scheduled_id) {
          target = pending.find((p) => p.id === args.scheduled_id);
        } else if (args.recipient_name) {
          target = pending.find((p) =>
            p.receiverName.toLowerCase().includes(args.recipient_name.toLowerCase())
          );
        }

        if (target) {
          scheduledMessageService.cancelMessage(target.id);
          return {
            replyText: `🗑️ ${target.receiverName} এর জন্য নির্ধারিত শিডিউল মেসেজটি বাতিল করা হয়েছে।`,
            actionResult: {
              type: "cancel_scheduled",
              success: true,
              message: "Cancelled successfully",
              data: target,
            },
          };
        }

        return {
          replyText: "বাতিল করার মতো কোনো উপযুক্ত শিডিউল মেসেজ পাওয়া যায়নি।",
          actionResult: {
            type: "cancel_scheduled",
            success: false,
            message: "Target not found",
          },
        };
      }

      return {
        replyText: choice?.content || "অ্যাকশন সম্পন্ন হয়েছে।",
      };
    } catch (err: any) {
      console.error("[Bhuiyan AI] Execution Exception:", err);
      return {
        replyText: `একটি ত্রুটি ঘটেছে: ${err?.message || "অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।"}`,
      };
    }
  }
}

export const aiAgentService = new AiAgentServiceClass();

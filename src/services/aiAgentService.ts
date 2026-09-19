import { chatService } from "./chatService";
import { friendService } from "./friendService";
import { scheduledMessageService, type ScheduledMessage } from "./scheduledMessageService";
import { newsService } from "./newsService";
import { weatherService } from "./weatherService";
import { useStore } from "../hooks/useStore";
import type { Profile } from "./mockDb";

export interface AiActionResult {
  type:
    | "send_message"
    | "start_call"
    | "schedule_message"
    | "list_scheduled"
    | "cancel_scheduled"
    | "latest_news"
    | "weather"
    | "general_reply";
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

// Declare build-time defined globals from Vite
declare const __GROQ_API_KEY__: string | undefined;
declare const __GROQ_MODEL__: string | undefined;
declare const process: any;

// Read API key safely from Vite environment / build
export const getGroqApiKey = (): string => {
  // 1. Check Vite define constant __GROQ_API_KEY__
  try {
    if (typeof __GROQ_API_KEY__ !== "undefined" && __GROQ_API_KEY__ && __GROQ_API_KEY__.trim()) {
      return __GROQ_API_KEY__.trim();
    }
  } catch {}

  // 2. Check standard Vite import.meta.env
  try {
    const meta = import.meta as any;
    const metaKey = meta.env?.VITE_GROQ_API_KEY || meta.env?.GROQ_API_KEY;
    if (metaKey && metaKey.trim()) return metaKey.trim();
  } catch {}

  // 3. Check process.env (replaced by Vite define)
  try {
    if (typeof process !== "undefined" && process?.env) {
      const pKey = process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY;
      if (pKey && pKey.trim()) return pKey.trim();
    }
  } catch {}

  // 4. Browser localStorage fallback (if set)
  if (typeof window !== "undefined") {
    const local = localStorage.getItem("kb_groq_api_key");
    if (local && local.trim()) return local.trim();
  }

  return "";
};

export const setGroqApiKey = (key: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("kb_groq_api_key", key.trim());
  }
};

export const getGroqModel = (): string => {
  try {
    const meta = import.meta as any;
    const envModel =
      meta.env?.VITE_MODEL_NAME ||
      meta.env?.MODEL_NAME ||
      meta.env?.model_name;
    if (envModel && envModel !== "llama-3.3-70b-versatile" && envModel.trim()) {
      return envModel.trim();
    }
  } catch {}

  try {
    if (
      typeof __GROQ_MODEL__ !== "undefined" &&
      __GROQ_MODEL__ &&
      __GROQ_MODEL__ !== "llama-3.3-70b-versatile"
    ) {
      return __GROQ_MODEL__.trim();
    }
  } catch {}

  try {
    if (typeof process !== "undefined" && process?.env) {
      const pModel =
        process.env.VITE_MODEL_NAME ||
        process.env.MODEL_NAME ||
        process.env.model_name;
      if (pModel && pModel !== "llama-3.3-70b-versatile" && pModel.trim()) {
        return pModel.trim();
      }
    }
  } catch {}

  // Active verified Groq model with full tool calling
  return "qwen/qwen3.8-27b";
};

// Groq Function Calling Tool Definitions
const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "send_message",
      description: "Send an instant direct message to one friend or to ALL friends at once. If the user says 'shob friends ke pathao', 'everyone', 'all friends', 'shobai ke', 'shob k', or similar, use recipient_name='ALL' to broadcast to everyone.",
      parameters: {
        type: "object",
        properties: {
          recipient_name: {
            type: "string",
            description: "The name or username of the friend to message. Set to 'ALL' to send to all friends in the user's friend list (use when user says 'shob friends ke', 'everyone', 'shobai ke', 'all friends', etc.).",
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
  {
    type: "function",
    function: {
      name: "get_weather",
      description:
        "Get real-time weather and temperature for a city or district (e.g. Narsingdi, Dhaka, Chittagong, Sylhet, etc.). Call this ONLY when user asks about weather, temperature, rain, or climate for a location.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description:
              "The name of the city or district (e.g. 'Narsingdi', 'Dhaka', 'Chittagong').",
          },
        },
        required: ["location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_latest_news",
      description:
        "Fetch the latest journalism news articles and headlines from newspapers (Prothom Alo, BBC). Call this ONLY when user EXPLICITLY asks for news, headlines, newspapers, current political/world events, or breaking news reports (e.g. 'ajker news ki', 'khobor bolo', 'breaking news', 'khelar khobor'). NEVER call this for weather, temperatures, math, code, general questions, or chatting.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["bangladesh", "world", "sports", "technology", "entertainment", "general"],
            description:
              "Category of news. Use 'bangladesh' for general/local news, 'world' for international news, 'sports' for sports/cricket/football, 'technology' for tech/AI.",
          },
          query: {
            type: "string",
            description:
              "Optional specific topic or keyword for newspaper headlines (e.g. 'cricket', 'election', 'dr yunus'). Do NOT use for weather.",
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
   * Helper to extract recipient from text
   */
  private extractRecipient(text: string): string {
    const match = text.match(/^([a-zA-Z0-9_\u0980-\u09FF]+)\s*(?:k|ke|কে)?/i);
    return match ? match[1].trim() : "";
  }

  /**
   * Helper to extract direct message
   */
  private extractDirectMessage(prompt: string): string {
    const quoteMatch = prompt.match(/["'“‘](.+?)["'”’]/);
    if (quoteMatch) return quoteMatch[1];

    const midMatch = prompt.match(
      /^[a-zA-Z0-9_\u0980-\u09FF]+\s*(?:k|ke|কে)?\s+(.+?)\s+(?:msg|message|text|মেসেজ)?\s*(?:pathao|pathaio|dao|পাঠাও|পাঠাইও|দাও)/i
    );
    if (midMatch && midMatch[1]?.trim()) return midMatch[1].trim();

    const match = prompt.match(
      /(?:msg|message|text|মেসেজ)?\s*(?:pathao|pathaio|dao|পাঠাও|পাঠাইও|দাও)\s*(.*)/i
    );
    if (match && match[1]?.trim()) return match[1].trim();

    return "Hi!";
  }

  private extractScheduledMessage(prompt: string): string {
    const quoteMatch = prompt.match(/["'“‘](.+?)["'”’]/);
    if (quoteMatch) return quoteMatch[1];

    const likheMatch = prompt.match(
      /(?:likhe|bole|লিখে|বলে)\s*(?:msg|message|text|মেসেজ)?\s*(?:pathao|pathaio|dao|পাঠাও|পাঠাইও|দাও)/i
    );
    if (likheMatch) {
      const beforeLikhe = prompt.substring(0, likheMatch.index);
      const cleaned = beforeLikhe
        .replace(/^[a-zA-Z0-9_\u0980-\u09FF]+\s*(?:k|ke|কে)?/i, "")
        .replace(/(?:raat|rat|shondha|shokal|রাত|সন্ধ্যা|সকাল)?\s*\d{1,2}(?:[:.]\d{2})?\s*(?:tay|টায়|ta|টা|e|এ)?/gi, "")
        .trim();
      if (cleaned) return cleaned;
    }

    return "কেমন আছো?";
  }

  /**
   * Helper to parse schedule details from prompt and/or reply
   */
  private parseScheduleDetails(
    prompt: string,
    replyText: string = ""
  ): {
    isoTime: string;
    timeDesc: string;
    message: string;
  } {
    const combined = (prompt + " " + replyText).toLowerCase();

    // 1. Check relative minutes (e.g. "5 min por", "10 minute por", "in 5 minutes")
    const minMatch = combined.match(/(\d+)\s*(min|minute|মিনিট)\s*(por|পর|later)/i);
    if (minMatch) {
      const mins = parseInt(minMatch[1], 10);
      const targetDate = new Date(Date.now() + mins * 60 * 1000);
      return {
        isoTime: targetDate.toISOString(),
        timeDesc: `${mins} মিনিট পর`,
        message: this.extractScheduledMessage(prompt),
      };
    }

    let targetHours = 21;
    let targetMinutes = 0;

    const colonTimeMatch = combined.match(/(\d{1,2})[:.](\d{2})/);
    if (colonTimeMatch) {
      targetHours = parseInt(colonTimeMatch[1], 10);
      targetMinutes = parseInt(colonTimeMatch[2], 10);
    } else {
      const hourMatch = combined.match(/(\d{1,2})\s*(tay|টায়|ta|টা|pm|am)/i);
      if (hourMatch) {
        targetHours = parseInt(hourMatch[1], 10);
        targetMinutes = 0;
      }
    }

    const isNightOrEvening = /raat|rat|shondha|রাত|সন্ধ্যা|pm/i.test(combined);
    const isMorning = /shokal|সকাল|am/i.test(combined);
    const isAfternoon = /dupur|bikel|দুপুর|বিকেল/i.test(combined);

    if ((isNightOrEvening || isAfternoon) && targetHours < 12) {
      targetHours += 12;
    } else if (isMorning && targetHours === 12) {
      targetHours = 0;
    }

    const targetDate = new Date();
    targetDate.setHours(targetHours, targetMinutes, 0, 0);

    let timeDesc = "";
    if (targetDate.getTime() < Date.now() - 2 * 60 * 1000) {
      targetDate.setDate(targetDate.getDate() + 1);
      timeDesc = `আগামীকাল ${targetHours > 12 ? targetHours - 12 : targetHours}:${targetMinutes < 10 ? "0" + targetMinutes : targetMinutes} ${targetHours >= 12 ? "PM" : "AM"}`;
    } else {
      timeDesc = `আজ ${targetHours > 12 ? targetHours - 12 : targetHours}:${targetMinutes < 10 ? "0" + targetMinutes : targetMinutes} ${targetHours >= 12 ? "PM" : "AM"}`;
    }

    return {
      isoTime: targetDate.toISOString(),
      timeDesc,
      message: this.extractScheduledMessage(prompt),
    };
  }

  /**
   * Deterministic Intent Fallback parser when LLM returns simulated plain text
   */
  private detectIntentFallback(
    userPrompt: string,
    aiReplyText: string,
    friends: { id: string; username: string }[]
  ): { toolName: string; args: any } | null {
    const text = userPrompt.toLowerCase();
    const reply = (aiReplyText || "").toLowerCase();

    // 1. Check CALL intent
    const isCall =
      /\b(call|video call|voice call|phone|ফোন|কল|ডায়াল)\b/i.test(text) ||
      /কল করা হচ্ছে|কল শুরু করা হচ্ছে|call initiated/i.test(reply);

    if (isCall && !text.includes("scheduled") && !text.includes("শিডিউল")) {
      const friend = friends.find(
        (f) => text.includes(f.username.toLowerCase()) || reply.includes(f.username.toLowerCase())
      );
      const recipientName = friend ? friend.username : this.extractRecipient(text);
      if (recipientName) {
        const isVideo = text.includes("video") || text.includes("ভিডিও");
        return {
          toolName: "start_call",
          args: {
            recipient_name: recipientName,
            call_type: isVideo ? "video" : "voice",
          },
        };
      }
    }

    // 2. Check SCHEDULE intent
    const isSchedule =
      /\b(raat|rat|shondha|shokal|bikel|dupur|রাত|সন্ধ্যা|সকাল|বিকেল|দুপুর|pm|am|কাল|আগামীকাল|tomorrow)\b/i.test(text) ||
      /\b\d{1,2}[:.]\d{2}\b/.test(text) ||
      /\b\d{1,2}\s*(tay|টায়|ta|টা)\b/i.test(text) ||
      /\b\d+\s*(min|minute|মিনিট)\s*(por|পর|later)\b/i.test(text) ||
      /শিডিউল|schedule/i.test(text) ||
      /শিডিউল করা হয়েছে|শিডিউল করা হলো|scheduled/i.test(reply);

    const isMessage =
      /\b(msg|message|text|মেসেজ|বার্তা|পাঠাও|পাঠাইও|লিখ|লিখে|send)\b/i.test(text);

    if (isSchedule && isMessage) {
      const friend = friends.find(
        (f) => text.includes(f.username.toLowerCase()) || reply.includes(f.username.toLowerCase())
      );
      const recipientName = friend ? friend.username : this.extractRecipient(text);
      if (recipientName) {
        const parsed = this.parseScheduleDetails(userPrompt, aiReplyText);
        return {
          toolName: "schedule_message",
          args: {
            recipient_name: recipientName,
            message: parsed.message,
            scheduled_iso_time: parsed.isoTime,
            time_description: parsed.timeDesc,
          },
        };
      }
    }

    // 3. Check DIRECT SEND MESSAGE intent
    if (isMessage && !isSchedule) {
      const friend = friends.find(
        (f) => text.includes(f.username.toLowerCase()) || reply.includes(f.username.toLowerCase())
      );
      const recipientName = friend ? friend.username : this.extractRecipient(text);
      if (recipientName) {
        const msgContent = this.extractDirectMessage(userPrompt);
        return {
          toolName: "send_message",
          args: {
            recipient_name: recipientName,
            message: msgContent,
          },
        };
      }
    }

    // 4. Check LIST SCHEDULED intent
    if (/পেন্ডিং|শিডিউল মেসেজ|scheduled message|scheduled list|শিডিউল লিস্ট/i.test(text)) {
      return {
        toolName: "list_scheduled_messages",
        args: {},
      };
    }

    // 5. Check WEATHER & TEMPERATURE intent
    const isWeather =
      /\b(temperature|temparature|weather|temp|তাপমাত্রা|আবহাওয়া|আবহাওয়া|গরম|ঠান্ডা|বৃষ্টির পূর্বাভাস)\b/i.test(
        text
      );

    if (isWeather && !isMessage && !isCall && !isSchedule) {
      // Clean query and extract location
      const cleanLoc = text
        .replace(
          /te|e|তে|এ|এর|র|akn|ekhon|এখন|koto|kemon|আজকে|আজকের|কত|কেমন|বলো|জানাও|কী|কি|temperature|temparature|weather|temp|তাপমাত্রা|আবহাওয়া|আবহাওয়া/gi,
          ""
        )
        .trim();

      return {
        toolName: "get_weather",
        args: {
          location: cleanLoc.length > 1 ? cleanLoc : "Dhaka",
        },
      };
    }

    // 6. Check LATEST NEWS / LIVE UPDATE intent (STRICTLY for news)
    const isNews =
      /\b(news|khobor|breaking|shongbad|সংবাদ|খবর|তাজা খবর|আজকের খবর|লেটেস্ট খবর|খেলার খবর|বিশ্ব সংবাদ)\b/i.test(
        text
      ) ||
      /\b(আজকের|আজকে|লেটেস্ট|তাজা)\s+(খবর|সংবাদ|হেডলাইন)\b/i.test(text);

    if (isNews && !isMessage && !isCall && !isSchedule && !isWeather) {
      let category = "bangladesh";
      if (/\b(world|international|biddho|বিশ্ব|আন্তর্জাতিক)\b/i.test(text)) {
        category = "world";
      } else if (/\b(khela|sports|cricket|football|খেলা|ক্রিকেট|ফুটবল)\b/i.test(text)) {
        category = "sports";
      } else if (/\b(tech|technology|ai|প্রযুক্তি)\b/i.test(text)) {
        category = "technology";
      }

      const cleanedQuery = text
        .replace(
          /আজকের|আজকে|লেটেস্ট|তাজা|খবর|সংবাদ|হেডলাইন|বলো|জানাও|দেখাও|দাও|কি|news|latest|update|ki|bolo|dekhao/gi,
          ""
        )
        .trim();

      return {
        toolName: "get_latest_news",
        args: {
          category,
          query: cleanedQuery.length > 2 ? cleanedQuery : undefined,
        },
      };
    }

    return null;
  }

  /**
   * Centralized tool action executor
   */
  private async executeAction(
    fnName: string,
    args: any,
    currentUser: { id: string; [key: string]: any }
  ): Promise<{ replyText: string; actionResult?: AiActionResult }> {
    // ==========================================
    // ACTION 1: SEND MESSAGE
    // ==========================================
    if (fnName === "send_message") {
      const rawRecipient = (args.recipient_name || "").trim();
      const isAllFriends =
        /^(ALL|all|shobai|shob|everyone|সবাই|শবাই|all_friends|allfrds)$/i.test(rawRecipient) ||
        /shob (friend|frnd|contact)|all friend|sobai|সব বন্ধু|সকলকে/i.test(rawRecipient);

      // ── BROADCAST: send to every friend ────────────────────────────────
      if (isAllFriends) {
        const { data: allFriends } = await friendService.getFriends(currentUser.id);
        if (!allFriends || allFriends.length === 0) {
          return {
            replyText: "আপনার ফ্রেন্ডলিস্ট খালি। কোনো বন্ধু নেই যাকে মেসেজ পাঠানো যাবে।",
            actionResult: {
              type: "send_message",
              success: false,
              message: "Friend list is empty",
            },
          };
        }

        const succeeded: string[] = [];
        const failed: string[] = [];

        for (const friend of allFriends) {
          try {
            const convId = await this.getOrCreateConversationId(currentUser.id, friend.id);
            const result = await chatService.sendMessage(convId, currentUser.id, args.message);
            if (result.error) {
              failed.push(friend.username);
            } else {
              succeeded.push(friend.username);
            }
          } catch {
            failed.push(friend.username);
          }
        }

        const total = allFriends.length;
        const successText =
          succeeded.length > 0
            ? `✅ **${succeeded.length}/${total}** জন বন্ধুকে সফলভাবে মেসেজ পাঠানো হয়েছে:\n${succeeded.map((n) => `• ${n}`).join("\n")}`
            : "";
        const failText =
          failed.length > 0
            ? `\n⚠️ পাঠানো যায়নি: ${failed.join(", ")}`
            : "";

        return {
          replyText: `${successText}${failText}\n\n> **বার্তা:** "${args.message}"`,
          actionResult: {
            type: "send_message",
            success: succeeded.length > 0,
            message: `Broadcast sent to ${succeeded.length}/${total} friends`,
            data: { recipients: succeeded, message: args.message },
          },
        };
      }

      // ── SINGLE RECIPIENT ────────────────────────────────────────────────
      const targetFriend = await this.resolveFriend(rawRecipient, currentUser.id);
      if (!targetFriend) {
        return {
          replyText: `দুঃখিত, '${rawRecipient}' নামের কাউকে আপনার ফ্রেন্ডলিস্ট বা চ্যাটে পাওয়া যায়নি। অনুগ্রহ করে সঠিক নামটি বলুন।`,
          actionResult: {
            type: "send_message",
            success: false,
            message: `User '${rawRecipient}' not found`,
          },
        };
      }

      const convId = await this.getOrCreateConversationId(currentUser.id, targetFriend.id);
      const sendResult = await chatService.sendMessage(convId, currentUser.id, args.message);

      if (sendResult.error) {
        return {
          replyText: `মেসেজ পাঠাতে সমস্যা হয়েছে: ${sendResult.error.message}`,
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
        replyText: `✅ **${targetFriend.username}** কে সফলভাবে বার্তা পাঠানো হয়েছে:\n> "${args.message}"`,
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

    // ==========================================
    // ACTION 6: GET LATEST NEWS
    // ==========================================
    if (fnName === "get_latest_news") {
      const category = args.category || "bangladesh";
      const query = args.query;
      const result = await newsService.getLatestNews(category, query);

      if (!result.success || result.articles.length === 0) {
        return {
          replyText:
            "দুঃখিত, এই মুহূর্তে নির্দিষ্ট বিষয়ের ওপর কোনো লাইভ সংবাদ পাওয়া যায়নি। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।",
          actionResult: {
            type: "latest_news",
            success: false,
            message: "No news found",
            data: { articles: [] },
          },
        };
      }

      return {
        replyText: result.summary,
        actionResult: {
          type: "latest_news",
          success: true,
          message: `সর্বশেষ ${result.articles.length}টি তাজা সংবাদ সংগ্রহ করা হয়েছে`,
          data: {
            category: result.category,
            articles: result.articles,
          },
        },
      };
    }

    // ==========================================
    // ACTION 7: GET WEATHER (CONCISE)
    // ==========================================
    if (fnName === "get_weather") {
      const location = args.location || "Dhaka";
      const result = await weatherService.getWeather(location);
      return {
        replyText: result.text,
        actionResult: {
          type: "weather",
          success: result.success,
          message: result.success ? `${location}-এর আবহাওয়া` : "আবহাওয়া তথ্য পাওয়া যায়নি",
          data: result.data,
        },
      };
    }

    return {
      replyText: "অ্যাকশন সম্পন্ন হয়েছে।",
    };
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
          "⚠️ AI সার্ভার বর্তমানে সংযুক্ত হতে পারছে না। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।",
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

    const systemPrompt = `You are "Bhuiyan AI", a sharp, helpful, and concise assistant for the user's Chat Web App.
Current Real-World Date & Time: ${now.toISOString()} (Bangladesh time: ${localTimeString}).

Active friends list:
${JSON.stringify(friendsContext, null, 2)}

CORE PRINCIPLES (খুবই গুরুত্বপূর্ণ নিয়মাবলি):
1. BE CONCISE & DIRECT (সংক্ষিপ্ত ও সরাসরি উত্তর):
   - By default, keep your answers short, crisp, natural, and directly to the point.
   - For general questions, greetings, facts, or advice, respond in 1 to 2 clear sentences.
   - NEVER dump long essays, irrelevant info, or unsolicited news.

2. NEWS VS GENERAL QUESTIONS (সংবাদ বনাম সাধারণ প্রশ্ন):
   - ONLY call "get_latest_news" if the user EXPLICITLY asks for news, headlines, newspapers, or breaking news (যেমন: "আজকের খবর কি?", "খবর বলো", "breaking news", "লেটেস্ট নিউজ").
   - NEVER call "get_latest_news" for weather, temperatures, math, code, facts, greetings, or normal questions.

3. WEATHER & TEMPERATURE (আবহাওয়া ও তাপমাত্রা):
   - When asked about weather or temperature for any city/location (e.g. "Narsingdi te akn temparature koto?", "ঢাকাতে আবহাওয়া কেমন?"):
     YOU MUST CALL the "get_weather" tool with the location name. Do NOT call news!

4. ACTION TOOLS:
   - Call "start_call" to place voice or video calls.
   - Call "schedule_message" to schedule messages for future times.
   - Call "send_message" to send instant direct messages.
     → If user says "shob friends ke pathao", "everyone", "all friends", "shobai ke", "সব বন্ধুদের পাঠাও", use recipient_name="ALL" — this broadcasts to every friend.
   - Call "list_scheduled_messages" / "cancel_scheduled_message" to manage scheduled messages.
   - For everything else, respond directly in concise, friendly conversational text.`;

    const messagesPayload = [
      { role: "system", content: systemPrompt },
      ...history.slice(-4).map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: prompt },
    ];

    try {
      let response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
          temperature: 0.1,
          max_tokens: 600,
        }),
      });

      // If initial model returns 404, fallback automatically to qwen/qwen3.8-27b
      if (!response.ok && response.status === 404 && model !== "qwen/qwen3.8-27b") {
        console.warn(`[Bhuiyan AI] Model ${model} returned 404. Falling back to qwen/qwen3.8-27b...`);
        response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "qwen/qwen3.8-27b",
            messages: messagesPayload,
            tools: AI_TOOLS,
            tool_choice: "auto",
            temperature: 0.1,
            max_tokens: 600,
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[Bhuiyan AI] Groq API Error:", errorData);
        // Even if Groq API returns network error, attempt local intent extraction fallback
        const offlineFallback = this.detectIntentFallback(prompt, "", friendsContext);
        if (offlineFallback) {
          return await this.executeAction(offlineFallback.toolName, offlineFallback.args, currentUser);
        }
        return {
          replyText: `দুঃখিত, সার্ভারের সাথে সংযোগ স্থাপনে সমস্যা হচ্ছে (${response.status})। কিছুক্ষণ পর পুনরায় চেষ্টা করুন।`,
        };
      }

      const data = await response.json();
      const choice = data.choices?.[0]?.message;
      const toolCalls = choice?.tool_calls;

      let fnName = "";
      let args: any = {};

      if (toolCalls && toolCalls.length > 0) {
        const firstCall = toolCalls[0];
        fnName = firstCall.function.name;
        try {
          args = JSON.parse(firstCall.function.arguments);
        } catch (e) {
          console.error("Failed to parse tool arguments:", e);
        }
      }

      // If model failed to call structured tool or returned plain text simulating the action:
      if (!fnName) {
        const fallback = this.detectIntentFallback(prompt, choice?.content || "", friendsContext);
        if (fallback) {
          fnName = fallback.toolName;
          args = fallback.args;
        }
      }

      if (fnName) {
        return await this.executeAction(fnName, args, currentUser);
      }

      return {
        replyText:
          choice?.content || "আমি আপনার কথাটি বুঝতে পেরেছি। আপনার জন্য কি করতে পারি?",
      };
    } catch (err: any) {
      console.error("[Bhuiyan AI] Execution Exception:", err);
      // Intent fallback on error
      const offlineFallback = this.detectIntentFallback(prompt, "", friendsContext);
      if (offlineFallback) {
        return await this.executeAction(offlineFallback.toolName, offlineFallback.args, currentUser);
      }
      return {
        replyText: `একটি ত্রুটি ঘটেছে: ${err?.message || "অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।"}`,
      };
    }
  }
}

export const aiAgentService = new AiAgentServiceClass();

import { create } from "zustand";
import { authService } from "../services/authService";
import type { UserSession } from "../services/authService";
import { chatService } from "../services/chatService";
import type { ConversationWithDetails, MessageWithSender } from "../services/chatService";
import type { Profile } from "../services/mockDb";
import { audioSynthesizer } from "../utils/audio";

interface AppState {
  // Auth state
  user: UserSession["user"] | null;
  session: UserSession | null;
  authLoading: boolean;
  setSession: (session: UserSession | null) => void;
  initializeAuth: () => () => void;

  // Conversations state
  conversations: ConversationWithDetails[];
  activeConversationId: string | null;
  conversationsLoading: boolean;
  fetchConversations: () => Promise<void>;
  setActiveConversationId: (id: string | null) => void;
  addConversation: (conv: ConversationWithDetails) => void;
  updateConversationLastMessage: (convId: string, lastMessage: any) => void;

  // Messages state
  messages: { [conversationId: string]: MessageWithSender[] };
  messagesLoading: boolean;
  fetchMessages: (conversationId: string) => Promise<void>;
  addMessage: (conversationId: string, message: MessageWithSender) => void;
  updateMessageInStore: (conversationId: string, message: MessageWithSender) => void;

  // Typing state
  typingUsers: { [conversationId: string]: string[] }; // conversationId -> array of user_ids typing
  setTypingUser: (conversationId: string, userId: string, isTyping: boolean) => void;

  // Presence state
  onlineUsers: string[]; // array of userIds
  setOnlineUsers: (userIds: string[]) => void;

  // Calling state
  callState: "idle" | "dialing" | "receiving" | "active";
  callType: "voice" | "video" | null;
  callPartner: Profile | null;
  startCall: (partner: Profile, type: "voice" | "video") => void;
  receiveCall: (partner: Profile, type: "voice" | "video") => void;
  acceptCall: () => void;
  endCall: () => void;

  // Theme state
  theme: "light" | "dark";
  toggleTheme: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Auth initial state
  user: null,
  session: null,
  authLoading: true,
  
  // Calling initial state
  callState: "idle",
  callType: null,
  callPartner: null,

  startCall: (partner, type) => set({ callState: "dialing", callPartner: partner, callType: type }),
  receiveCall: (partner, type) => set({ callState: "receiving", callPartner: partner, callType: type }),
  acceptCall: () => set({ callState: "active" }),
  endCall: () => set({ callState: "idle", callPartner: null, callType: null }),

  setSession: (session) =>
    set({
      session,
      user: session ? session.user : null,
      authLoading: false,
    }),

  initializeAuth: () => {
    set({ authLoading: true });
    // Listen for authentication state modifications
    const unsubscribe = authService.onAuthStateChange((session) => {
      set({
        session,
        user: session ? session.user : null,
        authLoading: false,
      });

      if (session?.user) {
        // Fetch conversations once logged in
        get().fetchConversations();
      } else {
        // Clear state on logout
        set({ conversations: [], activeConversationId: null, messages: {} });
      }
    });

    return unsubscribe;
  },

  // Conversations initial state
  conversations: [],
  activeConversationId: null,
  conversationsLoading: false,

  fetchConversations: async () => {
    const userId = get().user?.id;
    if (!userId) return;

    set({ conversationsLoading: true });
    const { data, error } = await chatService.getConversations(userId);
    if (!error && data) {
      set({ conversations: data, conversationsLoading: false });
    } else {
      set({ conversationsLoading: false });
    }
  },

  setActiveConversationId: (id) => set({ activeConversationId: id }),

  addConversation: (conv) => {
    const list = get().conversations;
    if (!list.some((c) => c.id === conv.id)) {
      set({ conversations: [conv, ...list] });
    }
  },

  updateConversationLastMessage: (convId, lastMessage) => {
    const list = get().conversations;
    const updated = list.map((c) => {
      if (c.id === convId) {
        return { ...c, last_message: lastMessage };
      }
      return c;
    });
    
    // Sort conversations: move updated one to top
    updated.sort((a, b) => {
      const timeA = new Date(a.last_message ? a.last_message.created_at : a.created_at).getTime();
      const timeB = new Date(b.last_message ? b.last_message.created_at : b.created_at).getTime();
      return timeB - timeA;
    });

    set({ conversations: updated });
  },

  // Messages initial state
  messages: {},
  messagesLoading: false,

  fetchMessages: async (conversationId) => {
    // If messages already loaded and cache has records, we could load them, but let's fetch to sync
    set({ messagesLoading: true });
    const { data, error } = await chatService.getMessages(conversationId);
    if (!error && data) {
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: data,
        },
        messagesLoading: false,
      }));
    } else {
      set({ messagesLoading: false });
    }
  },

  addMessage: (conversationId, message) => {
    set((state) => {
      const chatMessages = state.messages[conversationId] || [];
      // Prevent duplicates
      if (chatMessages.some((m) => m.id === message.id)) {
        return state;
      }

      // Play sound ping if message from someone else
      if (message.sender_id !== state.user?.id) {
        audioSynthesizer.playMessageNotification();
      }

      return {
        messages: {
          ...state.messages,
          [conversationId]: [...chatMessages, message],
        },
      };
    });

    // Update last message in conversation list
    get().updateConversationLastMessage(conversationId, message);
  },

  updateMessageInStore: (conversationId, message) => {
    set((state) => {
      const chatMessages = state.messages[conversationId] || [];
      const updatedMessages = chatMessages.map((m) => (m.id === message.id ? message : m));
      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
      };
    });

    // If last message updated, sync conversation list too
    const currentConv = get().conversations.find((c) => c.id === conversationId);
    if (currentConv?.last_message?.id === message.id) {
      get().updateConversationLastMessage(conversationId, message);
    }
  },

  // Typing initial state
  typingUsers: {},
  setTypingUser: (conversationId, userId, isTyping) => {
    set((state) => {
      const typing = state.typingUsers[conversationId] || [];
      let updatedTyping;
      if (isTyping) {
        updatedTyping = typing.includes(userId) ? typing : [...typing, userId];
      } else {
        updatedTyping = typing.filter((id) => id !== userId);
      }
      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: updatedTyping,
        },
      };
    });
  },

  // Presence initial state
  onlineUsers: [],
  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),

  // Theme initial state
  theme: (typeof window !== "undefined" && localStorage.getItem("kb_theme") === "light") ? "light" : "dark",

  toggleTheme: () => {
    const nextTheme = get().theme === "dark" ? "light" : "dark";
    set({ theme: nextTheme });
    if (typeof window !== "undefined") {
      localStorage.setItem("kb_theme", nextTheme);
    }
  },
}));

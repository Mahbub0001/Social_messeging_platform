export interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  bio: string;
  is_online: boolean;
  last_seen: string;
}

export interface Conversation {
  id: string;
  name: string | null;
  avatar_url: string | null;
  is_group: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  media_url?: string;
  media_type?: 'image' | 'file' | 'audio';
  reply_to_message_id?: string | null;
  is_edited: boolean;
  created_at: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

// Initial data to seed if LocalStorage is empty
const SEED_PROFILES: Profile[] = [
  {
    id: "bot-id",
    username: "কোথাবার্তা বট (Kotha Barta Bot)",
    avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=kothabarta",
    bio: "I am an automated assistant here to guide you through the features of Kotha Barta!",
    is_online: true,
    last_seen: new Date().toISOString(),
  },
  {
    id: "sajeeb-id",
    username: "Sajeeb Rahman (Developer)",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=sajeeb",
    bio: "Full Stack Engineer | React + Supabase Specialist. Ask me anything about this portfolio project!",
    is_online: true,
    last_seen: new Date().toISOString(),
  },
  {
    id: "anika-id",
    username: "Anika Tabassum (Designer)",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=anika",
    bio: "UI/UX Designer. Focused on creating beautiful, accessible, and delightful interfaces.",
    is_online: false,
    last_seen: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
  }
];

const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-bot",
    name: null,
    avatar_url: null,
    is_group: false,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "conv-sajeeb",
    name: null,
    avatar_url: null,
    is_group: false,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "conv-group-team",
    name: "Kotha Barta Project Team",
    avatar_url: "https://api.dicebear.com/7.x/identicon/svg?seed=team",
    is_group: true,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const getSeedMessages = (_currentUserId: string): Message[] => [
  // Bot Chat Messages
  {
    id: "msg-b1",
    conversation_id: "conv-bot",
    sender_id: "bot-id",
    content: "Welcome to Kotha Barta (কোথাবার্তা)! 👋",
    is_edited: false,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: "msg-b2",
    conversation_id: "conv-bot",
    sender_id: "bot-id",
    content: "Since this application is running in Mock Mode, you can test all premium features here! Send me a message, and I'll reply instantly.",
    is_edited: false,
    created_at: new Date(Date.now() - 3600000 * 23.9).toISOString(),
  },
  // Sajeeb Chat Messages
  {
    id: "msg-s1",
    conversation_id: "conv-sajeeb",
    sender_id: "sajeeb-id",
    content: "Hey there! Thanks for checking out Kotha Barta. I built this app to showcase real-time communication flows.",
    is_edited: false,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: "msg-s2",
    conversation_id: "conv-sajeeb",
    sender_id: "sajeeb-id",
    content: "It supports instant delivery, message editing, soft deletions, emoji reactions, and profile updates. Give it a spin!",
    is_edited: false,
    created_at: new Date(Date.now() - 3600000 * 4.9).toISOString(),
  },
  // Group Chat Messages
  {
    id: "msg-g1",
    conversation_id: "conv-group-team",
    sender_id: "anika-id",
    content: "Hi team! I uploaded the new style guide for the chat reactions. Check it out.",
    is_edited: false,
    created_at: new Date(Date.now() - 3600000 * 10).toISOString(),
  },
  {
    id: "msg-g2",
    conversation_id: "conv-group-team",
    sender_id: "sajeeb-id",
    content: "Looks great, Anika! I've already integrated the reactions module. The hover-to-react feels super smooth.",
    is_edited: false,
    created_at: new Date(Date.now() - 3600000 * 9.5).toISOString(),
  }
];

class MockDatabase {
  private getStorageItem<T>(key: string, defaultValue: T): T {
    const item = localStorage.getItem(`kb_${key}`);
    return item ? JSON.parse(item) : defaultValue;
  }

  private setStorageItem<T>(key: string, value: T): void {
    localStorage.setItem(`kb_${key}`, JSON.stringify(value));
  }

  // Database initialization
  public init(currentUserId: string = "user-demo-id", currentUsername: string = "Recruiter Guest") {
    // Check if profiles seeded
    let profiles = this.getStorageItem<Profile[]>("profiles", []);
    if (profiles.length === 0) {
      const currentUserProfile: Profile = {
        id: currentUserId,
        username: currentUsername,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUsername)}`,
        bio: "Evaluating this awesome portfolio project!",
        is_online: true,
        last_seen: new Date().toISOString(),
      };
      profiles = [...SEED_PROFILES, currentUserProfile];
      this.setStorageItem("profiles", profiles);

      // Seed conversations
      this.setStorageItem("conversations", SEED_CONVERSATIONS);

      // Seed conversation members
      const members: ConversationMember[] = [
        // Bot Chat
        { id: "mem-b1", conversation_id: "conv-bot", user_id: "bot-id", role: "member", joined_at: new Date().toISOString() },
        { id: "mem-b2", conversation_id: "conv-bot", user_id: currentUserId, role: "member", joined_at: new Date().toISOString() },
        // Sajeeb Chat
        { id: "mem-s1", conversation_id: "conv-sajeeb", user_id: "sajeeb-id", role: "member", joined_at: new Date().toISOString() },
        { id: "mem-s2", conversation_id: "conv-sajeeb", user_id: currentUserId, role: "member", joined_at: new Date().toISOString() },
        // Group Chat
        { id: "mem-g1", conversation_id: "conv-group-team", user_id: "sajeeb-id", role: "admin", joined_at: new Date().toISOString() },
        { id: "mem-g2", conversation_id: "conv-group-team", user_id: "anika-id", role: "member", joined_at: new Date().toISOString() },
        { id: "mem-g3", conversation_id: "conv-group-team", user_id: currentUserId, role: "member", joined_at: new Date().toISOString() },
      ];
      this.setStorageItem("conversation_members", members);

      // Seed messages
      this.setStorageItem("messages", getSeedMessages(currentUserId));

      // Seed reactions
      const reactions: MessageReaction[] = [
        { id: "r1", message_id: "msg-s1", user_id: currentUserId, emoji: "❤️", created_at: new Date().toISOString() },
        { id: "r2", message_id: "msg-g1", user_id: "sajeeb-id", emoji: "👍", created_at: new Date().toISOString() },
      ];
      this.setStorageItem("message_reactions", reactions);

      // Seed Friend Requests
      const requests: FriendRequest[] = [
        { id: "fr1", sender_id: "sajeeb-id", receiver_id: currentUserId, status: "accepted", created_at: new Date().toISOString() },
        { id: "fr2", sender_id: "anika-id", receiver_id: currentUserId, status: "pending", created_at: new Date().toISOString() },
      ];
      this.setStorageItem("friend_requests", requests);
    }
  }

  // Getters & Setters matching Supabase Schema
  public getProfiles(): Profile[] {
    return this.getStorageItem<Profile[]>("profiles", []);
  }

  public saveProfiles(profiles: Profile[]): void {
    this.setStorageItem("profiles", profiles);
  }

  public getConversations(): Conversation[] {
    return this.getStorageItem<Conversation[]>("conversations", []);
  }

  public saveConversations(conversations: Conversation[]): void {
    this.setStorageItem("conversations", conversations);
  }

  public getConversationMembers(): ConversationMember[] {
    return this.getStorageItem<ConversationMember[]>("conversation_members", []);
  }

  public saveConversationMembers(members: ConversationMember[]): void {
    this.setStorageItem("conversation_members", members);
  }

  public getMessages(): Message[] {
    return this.getStorageItem<Message[]>("messages", []);
  }

  public saveMessages(messages: Message[]): void {
    this.setStorageItem("messages", messages);
  }

  public getReactions(): MessageReaction[] {
    return this.getStorageItem<MessageReaction[]>("message_reactions", []);
  }

  public saveReactions(reactions: MessageReaction[]): void {
    this.setStorageItem("message_reactions", reactions);
  }

  public getFriendRequests(): FriendRequest[] {
    return this.getStorageItem<FriendRequest[]>("friend_requests", []);
  }

  public saveFriendRequests(requests: FriendRequest[]): void {
    this.setStorageItem("friend_requests", requests);
  }
}

export const mockDb = new MockDatabase();
// Initialize immediately on load if needed
if (typeof window !== "undefined") {
  mockDb.init();
}

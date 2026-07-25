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
  media_type?: 'image' | 'file' | 'audio' | 'call';
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

export interface Block {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  caption?: string;
  created_at: string;
  expires_at: string;
}

export interface StoryView {
  id: string;
  story_id: string;
  viewer_id: string;
  viewed_at: string;
}

// Initial data to seed if LocalStorage is empty
const SEED_PROFILES: Profile[] = [
  {
    id: "bot-id",
    username: "কথাবার্তা বট (Kotha Barta Bot)",
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
    content: "Welcome to Kotha Barta (কথাবার্তা)! 👋",
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

      // Seed blocks
      this.setStorageItem("blocks", []);

      // Seed stories (from mock users so friends can see them)
      const now = new Date();
      const addHours = (h: number) => new Date(now.getTime() + h * 3600000).toISOString();
      const seedStories: Story[] = [
        {
          id: "story-s1",
          user_id: "sajeeb-id",
          media_url: "https://images.unsplash.com/photo-1571171637578-41bc2dd41cd2?w=600&h=800&fit=crop",
          media_type: "image",
          caption: "Building something cool today!",
          created_at: addHours(-3),
          expires_at: addHours(21),
        },
        {
          id: "story-s2",
          user_id: "anika-id",
          media_url: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=800&fit=crop",
          media_type: "image",
          caption: "New design mockups ready",
          created_at: addHours(-5),
          expires_at: addHours(19),
        },
        {
          id: "story-s3",
          user_id: "sajeeb-id",
          media_url: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&h=800&fit=crop",
          media_type: "image",
          caption: "Sunset vibes 🌅",
          created_at: addHours(-26),
          expires_at: addHours(-2),
        },
      ];
      this.setStorageItem("stories", seedStories);
      this.setStorageItem("story_views", []);
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

  public getBlocks(): Block[] {
    return this.getStorageItem<Block[]>("blocks", []);
  }

  public saveBlocks(blocks: Block[]): void {
    this.setStorageItem("blocks", blocks);
  }

  public getStories(): Story[] {
    return this.getStorageItem<Story[]>("stories", []);
  }

  public saveStories(stories: Story[]): void {
    this.setStorageItem("stories", stories);
  }

  public getStoryViews(): StoryView[] {
    return this.getStorageItem<StoryView[]>("story_views", []);
  }

  public saveStoryViews(views: StoryView[]): void {
    this.setStorageItem("story_views", views);
  }

  public getActiveStories(userId: string) {
    const profiles = this.getProfiles();
    const stories = this.getStories();
    const views = this.getStoryViews();
    const requests = this.getFriendRequests();
    const blocks = this.getBlocks();
    const now = new Date();

    const friendIds = requests
      .filter((r) => r.status === "accepted" && (r.sender_id === userId || r.receiver_id === userId))
      .map((r) => (r.sender_id === userId ? r.receiver_id : r.sender_id));

    const blockedIds = blocks
      .filter((b) => b.blocker_id === userId)
      .map((b) => b.blocked_id);

    const active = stories.filter(
      (s) =>
        new Date(s.expires_at) > now &&
        friendIds.includes(s.user_id) &&
        !blockedIds.includes(s.user_id)
    );

    return active.map((s) => {
      const user = profiles.find((p) => p.id === s.user_id);
      const storyViewers = views.filter((v) => v.story_id === s.id);
      return {
        ...s,
        user,
        viewCount: storyViewers.length,
        hasViewed: storyViewers.some((v) => v.viewer_id === userId),
      };
    });
  }

  public getUserStories(userId: string) {
    const stories = this.getStories();
    const profiles = this.getProfiles();
    const views = this.getStoryViews();

    const userStories = stories
      .filter((s) => s.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return userStories.map((s) => {
      const user = profiles.find((p) => p.id === s.user_id);
      const storyViews = views
        .filter((v) => v.story_id === s.id)
        .map((v) => ({
          viewer_id: v.viewer_id,
          viewed_at: v.viewed_at,
          user: profiles.find((p) => p.id === v.viewer_id),
        }));
      return { ...s, user, story_views: storyViews, viewCount: storyViews.length };
    });
  }

  public getAllPreviousStories() {
    const stories = this.getStories();
    const profiles = this.getProfiles();
    const views = this.getStoryViews();

    return stories
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((s) => {
        const user = profiles.find((p) => p.id === s.user_id);
        const storyViews = views.filter((v) => v.story_id === s.id);
        return { ...s, user, story_views: storyViews, viewCount: storyViews.length };
      });
  }

  public createStory(userId: string, mediaUrl: string, mediaType: "image" | "video", caption?: string) {
    const stories = this.getStories();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const newStory: Story = {
      id: `story-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      media_url: mediaUrl,
      media_type: mediaType,
      caption,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    this.saveStories([newStory, ...stories]);
    return newStory;
  }

  public recordStoryView(storyId: string, viewerId: string) {
    const views = this.getStoryViews();
    const alreadyViewed = views.some((v) => v.story_id === storyId && v.viewer_id === viewerId);
    if (alreadyViewed) return;

    const newView: StoryView = {
      id: `sv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      story_id: storyId,
      viewer_id: viewerId,
      viewed_at: new Date().toISOString(),
    };

    this.saveStoryViews([...views, newView]);
  }

  public getStoryViewers(storyId: string) {
    const views = this.getStoryViews();
    const profiles = this.getProfiles();

    return views
      .filter((v) => v.story_id === storyId)
      .map((v) => ({
        viewer_id: v.viewer_id,
        viewed_at: v.viewed_at,
        user: profiles.find((p) => p.id === v.viewer_id),
      }))
      .sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime());
  }

  public deleteStory(storyId: string) {
    const stories = this.getStories();
    const views = this.getStoryViews();
    this.saveStories(stories.filter((s) => s.id !== storyId));
    this.saveStoryViews(views.filter((v) => v.story_id !== storyId));
  }
}

export const mockDb = new MockDatabase();
// Initialize immediately on load if needed
if (typeof window !== "undefined") {
  mockDb.init();
}

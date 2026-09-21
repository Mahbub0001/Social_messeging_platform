import { supabase, isMockMode } from "../lib/supabase";
import { mockDb } from "./mockDb";

export interface FeedReaction {
  userId: string;
  username: string;
  reactionType: "love" | "haha" | "wow" | "sad" | "angry" | "like";
  createdAt: string;
}

export interface FeedComment {
  id: string;
  postId: string;
  userId: string;
  author: {
    id: string;
    username: string;
    avatar_url?: string | null;
  };
  content: string;
  createdAt: string;
}

export interface FeedPost {
  id: string;
  userId: string;
  author: {
    id: string;
    username: string;
    avatar_url?: string | null;
    bio?: string | null;
    role?: "admin" | "user";
  };
  content: string;
  mediaUrls: string[];
  mediaType: "none" | "image" | "video";
  createdAt: string;
  reactions: Record<string, FeedReaction[]>;
  userReaction?: "love" | "haha" | "wow" | "sad" | "angry" | "like" | null;
  sharesCount: number;
  repostedFrom?: FeedPost | null;
  commentsCount: number;
  comments?: FeedComment[];
}

const STORAGE_KEY = "kb_feed_posts_v1";

const SEED_POSTS: FeedPost[] = [
  {
    id: "seed-post-1",
    userId: "mahbub-admin-id",
    author: {
      id: "mahbub-admin-id",
      username: "Mahbub (কথাবার্তা ক্রিয়েটর)",
      avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=mahbub0001",
      bio: "Creator & Lead Developer of Kotha Barta (কথাবার্তা) 🚀",
      role: "admin",
    },
    content:
      "স্বাগতম সবাইকে কথাবার্তা (Kotha Barta)-র নতুন সোশ্যাল কমিউনিটি ফিডে! 🌟\nএখানে আপনি নিজের ভাবনা, ছবি ও ভিডিও শেয়ার করতে পারেন, বন্ধুদের পোস্টে রিঅ্যাকশন দিতে পারেন এবং চ্যাটেও সরাসরি শেয়ার করতে পারবেন। আপনার মূল্যবান মতামত ও ফিডব্যাক শেয়ার করুন! 💬✨ #KothaBarta #Community #Welcome",
    mediaUrls: [
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80",
    ],
    mediaType: "image",
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    reactions: {
      love: [
        {
          userId: "sajeeb-id",
          username: "Sajeeb Rahman",
          reactionType: "love",
          createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        },
      ],
      wow: [
        {
          userId: "anika-id",
          username: "Anika Tabassum",
          reactionType: "wow",
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
      ],
      like: [
        {
          userId: "bot-id",
          username: "কথাবার্তা বট",
          reactionType: "like",
          createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
        },
      ],
    },
    userReaction: null,
    sharesCount: 3,
    repostedFrom: null,
    commentsCount: 2,
    comments: [
      {
        id: "seed-c1",
        postId: "seed-post-1",
        userId: "sajeeb-id",
        author: {
          id: "sajeeb-id",
          username: "Sajeeb Rahman",
          avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=sajeeb",
        },
        content:
          "ফিড ফিচারটি অসাধারণ হয়েছে! স্প্রিং অ্যানিমেশন আর রিঅ্যাকশন পিকার দারুণ কাজ করছে। 🔥",
        createdAt: new Date(Date.now() - 3600000 * 2.5).toISOString(),
      },
      {
        id: "seed-c2",
        postId: "seed-post-1",
        userId: "anika-id",
        author: {
          id: "anika-id",
          username: "Anika Tabassum",
          avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=anika",
        },
        content:
          "UI ডিজাইন এবং গ্লাস মরফিজম ইফেক্ট খুবই আকর্ষণীয় হয়েছে! শুভকামনা পুরো টিমের জন্য। ❤️",
        createdAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      },
    ],
  },
  {
    id: "seed-post-2",
    userId: "anika-id",
    author: {
      id: "anika-id",
      username: "Anika Tabassum (Designer)",
      avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=anika",
      bio: "UI/UX Designer. Focused on creating beautiful, accessible interfaces.",
      role: "user",
    },
    content:
      "নতুন ড্যাশবোর্ড এবং মোবাইল বটম ন্যাভিগেশনের ডিজাইন কনসেপ্ট রেডি! 🎨\nডার্ক মোড এবং ব্লার ব্যাকগ্রাউন্ডের কম্বিনেশনটা কেমন লাগছে জানাবেন। আপনাদের মতামত আমাদের জন্য খুবই গুরুত্বপূর্ণ! 📱💡 #UIDesign #MobileFirst #ChatApp",
    mediaUrls: [
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1200&auto=format&fit=crop&q=80",
    ],
    mediaType: "image",
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    reactions: {
      love: [
        {
          userId: "mahbub-admin-id",
          username: "Mahbub",
          reactionType: "love",
          createdAt: new Date(Date.now() - 3600000 * 7).toISOString(),
        },
      ],
      like: [
        {
          userId: "sajeeb-id",
          username: "Sajeeb Rahman",
          reactionType: "like",
          createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
        },
      ],
    },
    userReaction: null,
    sharesCount: 2,
    repostedFrom: null,
    commentsCount: 1,
    comments: [
      {
        id: "seed-c3",
        postId: "seed-post-2",
        userId: "mahbub-admin-id",
        author: {
          id: "mahbub-admin-id",
          username: "Mahbub",
          avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=mahbub0001",
        },
        content:
          "অসাধারণ কালার প্যালেট! বিশেষ করে মোবাইল ভিউতে খুব ক্লিন লাগছে। 👏",
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
    ],
  },
  {
    id: "seed-post-3",
    userId: "sajeeb-id",
    author: {
      id: "sajeeb-id",
      username: "Sajeeb Rahman (Developer)",
      avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=sajeeb",
      bio: "Full Stack Engineer | React + Supabase Specialist.",
      role: "user",
    },
    content:
      "Kotha Barta v2.0 আর্কিটেকচার আপডেট লাইভ! 🚀\n- ফ্রেমার মোশন অ্যানিমেটেড রিঅ্যাকশন ডক (Love, Wow, Sad, Angry, Like)\n- ইনস্ট্যান্ট ১-ক্লিক শেয়ারিং (চ্যাটে ও ফিডে)\n- ফুল অফলাইন-ফার্স্ট ক্যাশিং ও অটো-সিঙ্ক মেকানিজম\nসবাই টেস্ট করে দেখুন এবং কোনো বাগ পেলে জানান! 💻⚡ #WebDev #React #OpenSource",
    mediaUrls: [],
    mediaType: "none",
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    reactions: {
      wow: [
        {
          userId: "mahbub-admin-id",
          username: "Mahbub",
          reactionType: "wow",
          createdAt: new Date(Date.now() - 3600000 * 16).toISOString(),
        },
      ],
      like: [
        {
          userId: "bot-id",
          username: "কথাবার্তা বট",
          reactionType: "like",
          createdAt: new Date(Date.now() - 3600000 * 15).toISOString(),
        },
      ],
    },
    userReaction: null,
    sharesCount: 5,
    repostedFrom: null,
    commentsCount: 0,
    comments: [],
  },
];

export class FeedService {
  /**
   * Reads posts from localStorage cache. If cache is empty, seeds default posts.
   */
  private readFromCache(): FeedPost[] {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return [...SEED_POSTS];
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.saveToCache(SEED_POSTS);
        return [...SEED_POSTS];
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      this.saveToCache(SEED_POSTS);
      return [...SEED_POSTS];
    } catch (err) {
      console.error("feedService: error reading cache", err);
      return [...SEED_POSTS];
    }
  }

  /**
   * Persists posts array to localStorage cache and broadcasts custom update event.
   */
  private saveToCache(posts: FeedPost[]): void {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
      window.dispatchEvent(
        new CustomEvent("kb_feed_updated", { detail: { count: posts.length } })
      );
    } catch (err) {
      console.error("feedService: error saving cache", err);
    }
  }

  /**
   * Maps Supabase rows (supporting both camelCase and snake_case) to standard FeedPost models.
   */
  private mapSupabasePosts(rows: any[]): FeedPost[] {
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id || row.userId,
      author: row.author || {
        id: row.user_id || row.userId,
        username: row.username || "User",
        avatar_url: row.avatar_url || null,
        bio: row.bio || null,
        role: row.role || "user",
      },
      content: row.content || "",
      mediaUrls: row.media_urls || row.mediaUrls || [],
      mediaType: row.media_type || row.mediaType || "none",
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      reactions: row.reactions || {},
      userReaction: row.user_reaction || row.userReaction || null,
      sharesCount: row.shares_count ?? row.sharesCount ?? 0,
      repostedFrom: row.reposted_from || row.repostedFrom || null,
      commentsCount:
        row.comments_count ??
        row.commentsCount ??
        (Array.isArray(row.comments) ? row.comments.length : 0),
      comments: row.comments || [],
    }));
  }

  /**
   * Resolves author metadata for a given user ID from mockDb, current session, or Supabase.
   */
  private async getAuthorProfile(userId: string): Promise<FeedPost["author"]> {
    const isMahbubId =
      userId === "mahbub-admin-id" || userId.toLowerCase().includes("mahbub");
    if (isMahbubId) {
      return {
        id: userId,
        username: "Mahbub (কথাবার্তা ক্রিয়েটর)",
        avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=mahbub0001",
        bio: "Creator & Lead Developer of Kotha Barta (কথাবার্তা) 🚀",
        role: "admin",
      };
    }

    // 1. Look in mockDb profiles
    try {
      const profiles = mockDb.getProfiles();
      const found = profiles.find((p) => p.id === userId);
      if (found) {
        const isMahbub = found.username?.toLowerCase().includes("mahbub");
        return {
          id: found.id,
          username: found.username,
          avatar_url: found.avatar_url || null,
          bio: found.bio || null,
          role: isMahbub ? "admin" : "user",
        };
      }
    } catch {
      // Continue to next fallback
    }

    // 2. Look in localStorage mock session user
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      try {
        const savedUser = localStorage.getItem("kb_mock_user");
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed && (parsed.id === userId || !userId)) {
            const isMahbub = parsed.username?.toLowerCase().includes("mahbub");
            return {
              id: parsed.id,
              username: parsed.username,
              avatar_url: parsed.avatar_url || null,
              bio: parsed.bio || null,
              role: isMahbub ? "admin" : "user",
            };
          }
        }
      } catch {
        // Continue to next fallback
      }
    }

    // 3. Look in Supabase profiles table if available
    if (!isMockMode && supabase) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, bio, role")
          .eq("id", userId)
          .single();
        if (!error && data) {
          const isMahbub = data.username?.toLowerCase().includes("mahbub");
          return {
            id: data.id,
            username: data.username,
            avatar_url: data.avatar_url || null,
            bio: data.bio || null,
            role: data.role === "admin" || isMahbub ? "admin" : "user",
          };
        }
      } catch {
        // Supabase error gracefully caught
      }
    }

    // 4. Default fallback
    const isMahbub = userId.toLowerCase().includes("mahbub");
    return {
      id: userId,
      username: isMahbub ? "Mahbub" : "ব্যবহারকারী",
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
        userId
      )}`,
      bio: isMahbub ? "কথাবার্তা ক্রিয়েটর" : null,
      role: isMahbub ? "admin" : "user",
    };
  }

  /**
   * Fetch posts with optional filter ('all' | 'my' | 'media') and contextual user reaction.
   */
  async getPosts(
    filter: "all" | "my" | "media" = "all",
    currentUserId?: string
  ): Promise<{ data: FeedPost[]; error: any }> {
    let posts = this.readFromCache();

    // Try fetching from live Supabase feed_posts if available
    if (!isMockMode && supabase) {
      try {
        const { data, error } = await supabase
          .from("feed_posts")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          posts = this.mapSupabasePosts(data);
          this.saveToCache(posts);
        }
      } catch (err) {
        console.warn("feedService: Supabase query failed, falling back to local cache", err);
      }
    }

    // Attach current user's reaction to each post
    const postsWithUserReaction = posts.map((post) => {
      let userReaction: FeedReaction["reactionType"] | null = null;
      if (currentUserId && post.reactions) {
        for (const [reactionType, list] of Object.entries(post.reactions)) {
          if (Array.isArray(list) && list.some((r) => r.userId === currentUserId)) {
            userReaction = reactionType as FeedReaction["reactionType"];
            break;
          }
        }
      }
      return {
        ...post,
        userReaction,
      };
    });

    // Apply filters
    let filteredPosts = postsWithUserReaction;
    if (filter === "my" && currentUserId) {
      filteredPosts = filteredPosts.filter(
        (p) => p.userId === currentUserId || (p.repostedFrom && p.userId === currentUserId)
      );
    } else if (filter === "media") {
      filteredPosts = filteredPosts.filter(
        (p) => p.mediaType !== "none" && p.mediaUrls && p.mediaUrls.length > 0
      );
    }

    // Ensure newest first
    filteredPosts.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return { data: filteredPosts, error: null };
  }

  /**
   * Create a new post. Saves to localStorage cache and syncs to Supabase.
   */
  async createPost(params: {
    userId: string;
    content: string;
    mediaUrls?: string[];
    mediaType?: "none" | "image" | "video";
  }): Promise<{ data: FeedPost | null; error: any }> {
    try {
      const author = await this.getAuthorProfile(params.userId);
      const mediaUrls = params.mediaUrls || [];
      const mediaType =
        params.mediaType || (mediaUrls.length > 0 ? "image" : "none");

      const newPost: FeedPost = {
        id: "post-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8),
        userId: params.userId,
        author,
        content: params.content,
        mediaUrls,
        mediaType,
        createdAt: new Date().toISOString(),
        reactions: {},
        userReaction: null,
        sharesCount: 0,
        repostedFrom: null,
        commentsCount: 0,
        comments: [],
      };

      const posts = this.readFromCache();
      posts.unshift(newPost);
      this.saveToCache(posts);

      // Graceful Supabase sync
      if (!isMockMode && supabase) {
        try {
          await supabase.from("feed_posts").insert({
            id: newPost.id,
            user_id: newPost.userId,
            author: newPost.author,
            content: newPost.content,
            media_urls: newPost.mediaUrls,
            media_type: newPost.mediaType,
            created_at: newPost.createdAt,
            reactions: newPost.reactions,
            shares_count: 0,
            comments_count: 0,
            comments: [],
          });
        } catch (supabaseErr) {
          console.warn("feedService: Supabase insert failed, persisted locally", supabaseErr);
        }
      }

      return { data: newPost, error: null };
    } catch (err) {
      console.error("feedService: createPost error", err);
      return { data: null, error: err };
    }
  }

  /**
   * Toggle or switch reaction for a post.
   */
  async toggleReaction(
    postId: string,
    userId: string,
    reactionType: "love" | "haha" | "wow" | "sad" | "angry" | "like"
  ): Promise<{ data: FeedPost | null; error: any }> {
    try {
      const posts = this.readFromCache();
      const post = posts.find((p) => p.id === postId);

      if (!post) {
        return { data: null, error: new Error("Post not found") };
      }

      if (!post.reactions) {
        post.reactions = {};
      }

      // Check current reaction from this user
      let previousType: string | null = null;
      for (const [type, list] of Object.entries(post.reactions)) {
        if (Array.isArray(list) && list.some((r) => r.userId === userId)) {
          previousType = type;
          break;
        }
      }

      const author = await this.getAuthorProfile(userId);
      const username = author.username;

      if (previousType === reactionType) {
        // Toggle off (remove reaction)
        post.reactions[reactionType] = post.reactions[reactionType].filter(
          (r) => r.userId !== userId
        );
        post.userReaction = null;
      } else {
        // Remove from old reaction list if any
        if (previousType && post.reactions[previousType]) {
          post.reactions[previousType] = post.reactions[previousType].filter(
            (r) => r.userId !== userId
          );
        }
        // Add to target reaction list
        if (!post.reactions[reactionType]) {
          post.reactions[reactionType] = [];
        }
        post.reactions[reactionType].push({
          userId,
          username,
          reactionType,
          createdAt: new Date().toISOString(),
        });
        post.userReaction = reactionType;
      }

      this.saveToCache(posts);

      // Graceful Supabase sync
      if (!isMockMode && supabase) {
        try {
          await supabase
            .from("feed_posts")
            .update({ reactions: post.reactions })
            .eq("id", postId);
        } catch (supabaseErr) {
          console.warn("feedService: Supabase reaction sync failed, persisted locally", supabaseErr);
        }
      }

      return { data: post, error: null };
    } catch (err) {
      console.error("feedService: toggleReaction error", err);
      return { data: null, error: err };
    }
  }

  /**
   * Repost a post to the feed. Increments shares count and creates a repost entry.
   */
  async repost(
    postId: string,
    userId: string
  ): Promise<{ data: FeedPost | null; error: any }> {
    try {
      const posts = this.readFromCache();
      const originalPost = posts.find((p) => p.id === postId);

      if (!originalPost) {
        return { data: null, error: new Error("Post not found") };
      }

      // Increment shares on original
      originalPost.sharesCount = (originalPost.sharesCount || 0) + 1;

      // Determine root source if original is already a repost
      const rootPost = originalPost.repostedFrom || originalPost;
      const reposterAuthor = await this.getAuthorProfile(userId);

      const newPost: FeedPost = {
        id: "post-repost-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8),
        userId,
        author: reposterAuthor,
        content: "",
        mediaUrls: [],
        mediaType: "none",
        createdAt: new Date().toISOString(),
        reactions: {},
        userReaction: null,
        sharesCount: 0,
        repostedFrom: { ...rootPost },
        commentsCount: 0,
        comments: [],
      };

      posts.unshift(newPost);
      this.saveToCache(posts);

      // Graceful Supabase sync
      if (!isMockMode && supabase) {
        try {
          await Promise.all([
            supabase
              .from("feed_posts")
              .update({ shares_count: originalPost.sharesCount })
              .eq("id", postId),
            supabase.from("feed_posts").insert({
              id: newPost.id,
              user_id: newPost.userId,
              author: newPost.author,
              content: newPost.content,
              media_urls: newPost.mediaUrls,
              media_type: newPost.mediaType,
              created_at: newPost.createdAt,
              reactions: newPost.reactions,
              shares_count: 0,
              reposted_from: newPost.repostedFrom,
              comments_count: 0,
              comments: [],
            }),
          ]);
        } catch (supabaseErr) {
          console.warn("feedService: Supabase repost sync failed, persisted locally", supabaseErr);
        }
      }

      return { data: newPost, error: null };
    } catch (err) {
      console.error("feedService: repost error", err);
      return { data: null, error: err };
    }
  }

  /**
   * Add a comment to a post.
   */
  async addComment(
    postId: string,
    userId: string,
    content: string
  ): Promise<{ data: FeedComment | null; error: any }> {
    try {
      const trimmed = content.trim();
      if (!trimmed) {
        return { data: null, error: new Error("Comment content cannot be empty") };
      }

      const posts = this.readFromCache();
      const post = posts.find((p) => p.id === postId);

      if (!post) {
        return { data: null, error: new Error("Post not found") };
      }

      const author = await this.getAuthorProfile(userId);
      const comment: FeedComment = {
        id: "comment-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8),
        postId,
        userId,
        author: {
          id: author.id,
          username: author.username,
          avatar_url: author.avatar_url || null,
        },
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      if (!post.comments) {
        post.comments = [];
      }
      post.comments.push(comment);
      post.commentsCount = post.comments.length;

      this.saveToCache(posts);

      // Graceful Supabase sync
      if (!isMockMode && supabase) {
        try {
          await supabase
            .from("feed_posts")
            .update({
              comments: post.comments,
              comments_count: post.commentsCount,
            })
            .eq("id", postId);
        } catch (supabaseErr) {
          console.warn("feedService: Supabase comment sync failed, persisted locally", supabaseErr);
        }
      }

      return { data: comment, error: null };
    } catch (err) {
      console.error("feedService: addComment error", err);
      return { data: null, error: err };
    }
  }

  /**
   * Get all comments for a post.
   */
  async getComments(postId: string): Promise<{ data: FeedComment[]; error: any }> {
    try {
      const posts = this.readFromCache();
      const post = posts.find((p) => p.id === postId);
      return { data: post?.comments || [], error: null };
    } catch (err) {
      console.error("feedService: getComments error", err);
      return { data: [], error: err };
    }
  }

  /**
   * Delete a post. Permitted for post owner or admin.
   */
  async deletePost(postId: string, userId: string): Promise<{ error: any }> {
    try {
      const posts = this.readFromCache();
      const postIndex = posts.findIndex((p) => p.id === postId);

      if (postIndex === -1) {
        return { error: new Error("Post not found") };
      }

      const post = posts[postIndex];
      const author = await this.getAuthorProfile(userId);
      const isOwner = post.userId === userId;
      const isAdmin =
        author.role === "admin" ||
        author.username?.toLowerCase() === "mahbub" ||
        author.username?.toLowerCase() === "mahbub0001";

      if (!isOwner && !isAdmin) {
        return { error: new Error("Unauthorized to delete this post") };
      }

      posts.splice(postIndex, 1);
      this.saveToCache(posts);

      // Graceful Supabase sync
      if (!isMockMode && supabase) {
        try {
          await supabase.from("feed_posts").delete().eq("id", postId);
        } catch (supabaseErr) {
          console.warn("feedService: Supabase delete failed, persisted locally", supabaseErr);
        }
      }

      return { error: null };
    } catch (err) {
      console.error("feedService: deletePost error", err);
      return { error: err };
    }
  }
}

export const feedService = new FeedService();

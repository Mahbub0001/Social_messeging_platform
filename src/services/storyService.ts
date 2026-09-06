import { supabase, isMockMode } from "../lib/supabase";
import type { Profile } from "./mockDb";
import { mockDb } from "./mockDb";
import { friendService } from "./friendService";

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  caption?: string;
  created_at: string;
  expires_at: string;
}

export interface StoryWithDetails extends Story {
  user?: Profile;
  viewCount?: number;
  hasViewed?: boolean;
  viewers?: Profile[];
}

export interface StoryView {
  id: string;
  story_id: string;
  viewer_id: string;
  viewed_at: string;
}

const STORY_EXPIRATION_HOURS = 24;

class StoryService {
  private async getFriendIds(userId: string): Promise<string[]> {
    const { data: friends } = await friendService.getFriends(userId);
    return (friends || []).map((f) => f.id);
  }

  private async getBlockedIds(userId: string): Promise<string[]> {
    const { blockService } = await import("./blockService");
    const { data } = await blockService.getBlockedUsers(userId);
    return data || [];
  }

  async getActiveStories(userId: string) {
    try {
      if (isMockMode) {
        return { data: mockDb.getActiveStories(userId), error: null };
      }

      const [friendIds, blockedIds] = await Promise.all([
        this.getFriendIds(userId),
        this.getBlockedIds(userId),
      ]);

      const now = new Date().toISOString();

      const { data: stories, error } = await supabase
        .from("stories")
        .select(`
          *,
          user:user_id(id, username, avatar_url, bio)
        `)
        .gt("expires_at", now)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching active stories:", error);
        return { data: null, error };
      }

      if (!stories || stories.length === 0) {
        return { data: [], error: null };
      }

      const filtered = stories.filter(
        (s: any) =>
          friendIds.includes(s.user_id) &&
          !blockedIds.includes(s.user_id)
      );

      if (filtered.length === 0) {
        return { data: [], error: null };
      }

      const storyIds = filtered.map((s: any) => s.id);

      const { data: views } = await supabase
        .from("story_views")
        .select("story_id, viewer_id")
        .in("story_id", storyIds);

      const viewsByStory: Record<string, string[]> = {};
      (views || []).forEach((v: any) => {
        if (!viewsByStory[v.story_id]) viewsByStory[v.story_id] = [];
        viewsByStory[v.story_id].push(v.viewer_id);
      });

      const result = filtered.map((story: any) => {
        const viewers = viewsByStory[story.id] || [];
        return {
          ...story,
          viewCount: viewers.length,
          hasViewed: viewers.includes(userId),
        };
      });

      return { data: result, error: null };
    } catch (err) {
      console.error("Error in getActiveStories:", err);
      return { data: null, error: err };
    }
  }

  async getUserStories(userId: string) {
    try {
      if (isMockMode) {
        return { data: mockDb.getUserStories(userId), error: null };
      }

      const { data, error } = await supabase
        .from("stories")
        .select(`
          *,
          user:user_id(id, username, avatar_url, bio),
          story_views(viewer_id, viewed_at)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching user stories:", error);
        return { data: null, error };
      }

      return { data: data || [], error: null };
    } catch (err) {
      console.error("Error in getUserStories:", err);
      return { data: null, error: err };
    }
  }


  // Get all previous stories (archive) - both expired and active
  async getAllPreviousStories(_userId: string) {
    try {
      if (isMockMode) {
        return { data: mockDb.getAllPreviousStories(), error: null };
      }

      const { data, error } = await supabase
        .from("stories")
        .select(`
          *,
          user:user_id(id, username, avatar_url, bio),
          story_views(viewer_id, viewed_at)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching all previous stories:", error);
        return { data: null, error };
      }

      return { data: data || [], error: null };
    } catch (err) {
      console.error("Error in getAllPreviousStories:", err);
      return { data: null, error: err };
    }
  }

  async uploadStory(
    userId: string,
    mediaUrl: string,
    mediaType: "image" | "video",
    caption?: string
  ) {
    try {
      if (isMockMode) {
        const story = mockDb.createStory(userId, mediaUrl, mediaType, caption);
        const profiles = mockDb.getProfiles();
        const userProfile = profiles.find((p) => p.id === userId);
        return {
          data: { ...story, user: userProfile, viewCount: 0, hasViewed: false } as StoryWithDetails,
          error: null,
        };
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + STORY_EXPIRATION_HOURS * 60 * 60 * 1000);

      const { data, error } = await supabase.from("stories").insert([
        {
          user_id: userId,
          media_url: mediaUrl,
          media_type: mediaType,
          caption,
          created_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        },
      ]).select(`
        *,
        user:user_id(id, username, avatar_url, bio)
      `);

      if (error) {
        console.error("Error uploading story:", error);
        return { data: null, error };
      }

      const raw = data?.[0];
      return {
        data: raw ? { ...raw, viewCount: 0, hasViewed: false } : null,
        error: null,
      };
    } catch (err) {
      console.error("Error in uploadStory:", err);
      return { data: null, error: err };
    }
  }

  async recordStoryView(storyId: string, viewerId: string) {
    try {
      if (isMockMode) {
        mockDb.recordStoryView(storyId, viewerId);
        return { data: null, error: null };
      }

      const { error } = await supabase.from("story_views").insert([
        {
          story_id: storyId,
          viewer_id: viewerId,
        },
      ]);

      if (error && error.code !== "23505") {
        console.error("Error recording story view:", error);
        return { error };
      }

      return { error: null };
    } catch (err) {
      console.error("Error in recordStoryView:", err);
      return { error: err };
    }
  }

  async getStoryViewers(storyId: string, userId: string) {
    try {
      if (isMockMode) {
        return { data: mockDb.getStoryViewers(storyId), error: null };
      }

      const { data: story, error: storyError } = await supabase
        .from("stories")
        .select("user_id")
        .eq("id", storyId)
        .single();

      if (storyError || story?.user_id !== userId) {
        return { data: null, error: new Error("Unauthorized") };
      }

      const { data, error } = await supabase
        .from("story_views")
        .select(`
          viewer_id,
          viewed_at,
          user:viewer_id(id, username, avatar_url, bio)
        `)
        .eq("story_id", storyId)
        .order("viewed_at", { ascending: false });

      if (error) {
        console.error("Error fetching story viewers:", error);
        return { data: null, error };
      }

      return { data: data || [], error: null };
    } catch (err) {
      console.error("Error in getStoryViewers:", err);
      return { data: null, error: err };
    }
  }

  async deleteStory(storyId: string, userId: string) {
    try {
      if (isMockMode) {
        mockDb.deleteStory(storyId);
        return { error: null };
      }

      const { data: story, error: verifyError } = await supabase
        .from("stories")
        .select("user_id")
        .eq("id", storyId)
        .single();

      if (verifyError || story?.user_id !== userId) {
        return { error: new Error("Unauthorized") };
      }

      const { error } = await supabase
        .from("stories")
        .delete()
        .eq("id", storyId);

      if (error) {
        console.error("Error deleting story:", error);
        return { error };
      }

      return { error: null };
    } catch (err) {
      console.error("Error in deleteStory:", err);
      return { error: err };
    }
  }

  subscribeToStories(callback: (story: Story) => void) {
    if (isMockMode) {
      const handler = (e: StorageEvent) => {
        if (e.key === "kb_stories" && e.newValue) {
          try {
            const stories = JSON.parse(e.newValue);
            if (Array.isArray(stories) && stories.length > 0) {
              const latest = stories[0];
              if (new Date(latest.expires_at) > new Date()) {
                callback(latest);
              }
            }
          } catch {}
        }
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    }

    const subscription = supabase
      .channel("stories-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stories",
        },
        (payload: any) => {
          callback(payload.new);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  subscribeToStoryViews(storyId: string, callback: (view: StoryView) => void) {
    if (isMockMode) {
      return () => {};
    }

    const subscription = supabase
      .channel(`story-views-${storyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "story_views",
          filter: `story_id=eq.${storyId}`,
        },
        (payload: any) => {
          callback(payload.new);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }
}

export const storyService = new StoryService();

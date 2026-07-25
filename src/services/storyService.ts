import { supabase, isMockMode } from "../lib/supabase";
import type { Profile } from "./mockDb";
import { mockDb } from "./mockDb";

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
  // Get all active stories from friends/users (non-expired)
  async getActiveStories(userId: string) {
    try {
      if (isMockMode) {
        return { data: mockDb.getActiveStories(userId), error: null };
      }

      const now = new Date();
      const { data, error } = await supabase
        .from("stories")
        .select(
          `
          *,
          user:user_id(id, username, avatar_url, bio),
          view_count:story_views(count),
          story_views!inner(viewer_id)
        `
        )
        .gt("expires_at", now.toISOString())
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching active stories:", error);
        return { data: null, error };
      }

      // Check which stories the current user has viewed
      const storiesWithViewStatus = data?.map((story: any) => ({
        ...story,
        hasViewed: story.story_views?.some(
          (v: StoryView) => v.viewer_id === userId
        ),
      }));

      return { data: storiesWithViewStatus || [], error: null };
    } catch (err) {
      console.error("Error in getActiveStories:", err);
      return { data: null, error: err };
    }
  }

  // Get all stories from a specific user (including expired for archive)
  async getUserStories(userId: string) {
    try {
      if (isMockMode) {
        return { data: mockDb.getUserStories(userId), error: null };
      }

      const { data, error } = await supabase
        .from("stories")
        .select(
          `
          *,
          user:user_id(id, username, avatar_url, bio),
          story_views(viewer_id, viewed_at)
        `
        )
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
        .select(
          `
          *,
          user:user_id(id, username, avatar_url, bio),
          story_views(viewer_id, viewed_at)
        `
        )
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

  // Upload a new story
  async uploadStory(
    userId: string,
    mediaUrl: string,
    mediaType: "image" | "video",
    caption?: string
  ) {
    try {
      if (isMockMode) {
        return { data: mockDb.createStory(userId, mediaUrl, mediaType, caption), error: null };
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
      ]).select();

      if (error) {
        console.error("Error uploading story:", error);
        return { data: null, error };
      }

      return { data: data?.[0] || null, error: null };
    } catch (err) {
      console.error("Error in uploadStory:", err);
      return { data: null, error: err };
    }
  }

  // Record that user viewed a story
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
        // 23505 is unique constraint violation (already viewed)
        console.error("Error recording story view:", error);
        return { error };
      }

      return { error: null };
    } catch (err) {
      console.error("Error in recordStoryView:", err);
      return { error: err };
    }
  }

  // Get viewers of a story (only for story owner)
  async getStoryViewers(storyId: string, userId: string) {
    try {
      if (isMockMode) {
        return { data: mockDb.getStoryViewers(storyId), error: null };
      }

      // Verify ownership
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
        .select(
          `
          viewer_id,
          viewed_at,
          user:viewer_id(id, username, avatar_url, bio)
        `
        )
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

  // Delete a story (only for owner)
  async deleteStory(storyId: string, userId: string) {
    try {
      if (isMockMode) {
        mockDb.deleteStory(storyId);
        return { error: null };
      }

      // Verify ownership first
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

  // Subscribe to new stories in real-time
  subscribeToStories(callback: (story: Story) => void) {
    if (isMockMode) {
      return () => {};
    }

    const now = new Date();
    const subscription = supabase
      .channel("stories-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stories",
          filter: `expires_at=gt.${now.toISOString()}`,
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

  // Subscribe to story views
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

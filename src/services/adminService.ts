import { supabase, isMockMode } from "../lib/supabase";
import { pushNotificationService } from "./pushNotificationService";

export interface AdminStats {
  totalUsers: number;
  activeUsersToday: number;
  totalMessages: number;
  activeStories: number;
}

export interface AdminUser {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  role: "admin" | "moderator" | "user";
  is_banned: boolean;
  banned_reason: string | null;
  banned_at: string | null;
  last_seen: string | null;
  updated_at?: string;
}

export interface LiveStoryItem {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  created_at: string;
  expires_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
}

export interface AnnouncementItem {
  id: string;
  admin_id?: string | null;
  title: string;
  content: string;
  type: "info" | "warning" | "critical" | "update";
  send_push: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ContentReportItem {
  id: string;
  reporter_id: string;
  target_type: "story" | "message" | "user";
  target_id: string;
  reason: string;
  status: "pending" | "resolved" | "dismissed";
  created_at: string;
  reporter?: {
    username: string;
    avatar_url: string | null;
  };
}

class AdminService {
  /**
   * Fetch platform statistics
   */
  public async getStats(): Promise<AdminStats> {
    if (isMockMode) {
      return {
        totalUsers: 14,
        activeUsersToday: 8,
        totalMessages: 342,
        activeStories: 5,
      };
    }

    try {
      // 1. Total users
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // 2. Active users today (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: activeUsersToday } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_seen", oneDayAgo);

      // 3. Total messages
      const { count: totalMessages } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true });

      // 4. Active live stories
      const { count: activeStories } = await supabase
        .from("stories")
        .select("*", { count: "exact", head: true })
        .gt("expires_at", new Date().toISOString());

      return {
        totalUsers: totalUsers || 0,
        activeUsersToday: activeUsersToday || 0,
        totalMessages: totalMessages || 0,
        activeStories: activeStories || 0,
      };
    } catch (err) {
      console.error("Failed to fetch admin stats:", err);
      return {
        totalUsers: 0,
        activeUsersToday: 0,
        totalMessages: 0,
        activeStories: 0,
      };
    }
  }

  /**
   * Fetch registered users with optional search and filters
   */
  public async getUsers(
    search?: string,
    roleFilter?: string,
    statusFilter?: string
  ): Promise<AdminUser[]> {
    if (isMockMode) {
      return [];
    }

    try {
      let query = supabase
        .from("profiles")
        .select("*")
        .order("last_seen", { ascending: false, nullsFirst: false });

      if (search && search.trim() !== "") {
        query = query.ilike("username", `%${search.trim()}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching admin users:", error);
        return [];
      }

      let users = (data || []).map((u: any) => {
        const isMahbub = u.username?.toLowerCase() === "mahbub" || u.username?.toLowerCase() === "mahbub0001";
        return {
          id: u.id,
          username: u.username || "User",
          avatar_url: u.avatar_url || null,
          bio: u.bio || null,
          role: u.role || (isMahbub ? "admin" : "user"),
          is_banned: Boolean(u.is_banned),
          banned_reason: u.banned_reason || null,
          banned_at: u.banned_at || null,
          last_seen: u.last_seen || null,
          updated_at: u.updated_at,
        } as AdminUser;
      });

      if (roleFilter && roleFilter !== "all") {
        users = users.filter((u: AdminUser) => u.role === roleFilter);
      }

      if (statusFilter === "banned") {
        users = users.filter((u: AdminUser) => u.is_banned);
      } else if (statusFilter === "active") {
        users = users.filter((u: AdminUser) => !u.is_banned);
      }

      return users;
    } catch (err) {
      console.error("AdminService.getUsers failed:", err);
      return [];
    }
  }

  /**
   * Fetch user profile role and ban status
   */
  public async getUserProfile(userId: string): Promise<AdminUser | null> {
    if (isMockMode) {
      return {
        id: userId,
        username: "Admin",
        avatar_url: null,
        bio: null,
        role: "admin",
        is_banned: false,
        banned_reason: null,
        banned_at: null,
        last_seen: new Date().toISOString(),
      };
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error || !data) return null;

      const isMahbub = data.username?.toLowerCase() === "mahbub" || data.username?.toLowerCase() === "mahbub0001";

      return {
        id: data.id,
        username: data.username || "User",
        avatar_url: data.avatar_url || null,
        bio: data.bio || null,
        role: data.role || (isMahbub ? "admin" : "user"),
        is_banned: Boolean(data.is_banned),
        banned_reason: data.banned_reason || null,
        banned_at: data.banned_at || null,
        last_seen: data.last_seen || null,
        updated_at: data.updated_at,
      };
    } catch (err) {
      console.error("AdminService.getUserProfile error:", err);
      return null;
    }
  }

  /**
   * Ban or unban a user
   */
  public async updateUserBan(
    userId: string,
    isBanned: boolean,
    reason?: string
  ): Promise<boolean> {
    if (isMockMode) return true;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_banned: isBanned,
          banned_reason: isBanned ? (reason || "Account suspended by Administrator") : null,
          banned_at: isBanned ? new Date().toISOString() : null,
        })
        .eq("id", userId);

      if (error) {
        console.error("Failed to update user ban:", error);
        return false;
      }
      return true;
    } catch (err) {
      console.error("AdminService.updateUserBan error:", err);
      return false;
    }
  }

  /**
   * Elevate or change a user's role
   */
  public async updateUserRole(
    userId: string,
    role: "admin" | "moderator" | "user"
  ): Promise<boolean> {
    if (isMockMode) return true;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", userId);

      if (error) {
        console.error("Failed to update user role:", error);
        return false;
      }
      return true;
    } catch (err) {
      console.error("AdminService.updateUserRole error:", err);
      return false;
    }
  }

  /**
   * Fetch all active live stories across the platform
   */
  public async getLiveStories(): Promise<LiveStoryItem[]> {
    if (isMockMode) return [];

    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("stories")
        .select("id, user_id, media_url, media_type, caption, created_at, expires_at, profiles:user_id(username, avatar_url)")
        .gt("expires_at", now)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch live stories:", error);
        return [];
      }

      return (data || []) as LiveStoryItem[];
    } catch (err) {
      console.error("AdminService.getLiveStories error:", err);
      return [];
    }
  }

  /**
   * Delete a story (database row + storage file)
   */
  public async deleteStory(storyId: string, mediaUrl?: string): Promise<boolean> {
    if (isMockMode) return true;

    try {
      // 1. Delete DB record
      const { error } = await supabase.from("stories").delete().eq("id", storyId);
      if (error) {
        console.error("Failed to delete story DB record:", error);
        return false;
      }

      // 2. Delete storage file if possible
      if (mediaUrl) {
        try {
          // Extract path after /stories/ if exists
          const bucketIndex = mediaUrl.indexOf("/stories/");
          if (bucketIndex !== -1) {
            const filePath = mediaUrl.substring(bucketIndex + "/stories/".length).split("?")[0];
            await supabase.storage.from("stories").remove([filePath]);
          }
        } catch (storageErr) {
          console.warn("Storage cleanup failed for story:", storageErr);
        }
      }

      return true;
    } catch (err) {
      console.error("AdminService.deleteStory error:", err);
      return false;
    }
  }

  /**
   * Fetch content reports
   */
  public async getReports(): Promise<ContentReportItem[]> {
    if (isMockMode) return [];

    try {
      const { data, error } = await supabase
        .from("content_reports")
        .select("id, reporter_id, target_type, target_id, reason, status, created_at, reporter:reporter_id(username, avatar_url)")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch content reports:", error);
        return [];
      }

      return (data || []) as ContentReportItem[];
    } catch (err) {
      console.error("AdminService.getReports error:", err);
      return [];
    }
  }

  /**
   * Update report status (resolved / dismissed)
   */
  public async updateReportStatus(
    reportId: string,
    status: "resolved" | "dismissed"
  ): Promise<boolean> {
    if (isMockMode) return true;

    try {
      const { error } = await supabase
        .from("content_reports")
        .update({ status })
        .eq("id", reportId);

      return !error;
    } catch (err) {
      console.error("AdminService.updateReportStatus error:", err);
      return false;
    }
  }

  /**
   * Create and broadcast an announcement
   */
  public async createAnnouncement(data: {
    adminId?: string;
    title: string;
    content: string;
    type: "info" | "warning" | "critical" | "update";
    send_push: boolean;
  }): Promise<boolean> {
    if (isMockMode) return true;

    try {
      const { error } = await supabase.from("system_announcements").insert({
        admin_id: data.adminId || null,
        title: data.title,
        content: data.content,
        type: data.type,
        send_push: data.send_push,
        is_active: true,
      });

      if (error) {
        console.error("Failed to insert announcement:", error);
        return false;
      }

      // If push enabled, dispatch via pushNotificationService
      if (data.send_push) {
        pushNotificationService.sendBroadcastPush(data.title, data.content).catch((e) => {
          console.warn("Broadcast push dispatch error:", e);
        });
      }

      return true;
    } catch (err) {
      console.error("AdminService.createAnnouncement error:", err);
      return false;
    }
  }

  /**
   * Fetch past announcements
   */
  public async getAnnouncements(): Promise<AnnouncementItem[]> {
    if (isMockMode) return [];

    try {
      const { data, error } = await supabase
        .from("system_announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch announcements:", error);
        return [];
      }

      return (data || []) as AnnouncementItem[];
    } catch (err) {
      console.error("AdminService.getAnnouncements error:", err);
      return [];
    }
  }

  /**
   * Delete announcement
   */
  public async deleteAnnouncement(id: string): Promise<boolean> {
    if (isMockMode) return true;

    try {
      const { error } = await supabase
        .from("system_announcements")
        .delete()
        .eq("id", id);

      return !error;
    } catch (err) {
      console.error("AdminService.deleteAnnouncement error:", err);
      return false;
    }
  }
}

export const adminService = new AdminService();

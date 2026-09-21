import { supabase, isMockMode } from "../lib/supabase";
import { mockDb } from "./mockDb";
import type { FriendRequest, Profile } from "./mockDb";
import { chatService } from "./chatService";

export interface FriendRequestWithProfiles extends FriendRequest {
  sender?: Profile;
  receiver?: Profile;
}

class FriendServiceClass {
  public async getFriends(userId: string): Promise<{ data: Profile[]; error: any }> {
    if (isMockMode) {
      const requests = mockDb.getFriendRequests();
      const profiles = mockDb.getProfiles();

      // Find accepted request where userId is either sender or receiver
      const friendIds = requests
        .filter((r) => r.status === "accepted" && (r.sender_id === userId || r.receiver_id === userId))
        .map((r) => (r.sender_id === userId ? r.receiver_id : r.sender_id));

      const friends = profiles.filter((p) => friendIds.includes(p.id));
      return { data: friends, error: null };
    } else {
      // Direct Query using OR in Supabase
      const { data, error } = await supabase
        .from("friend_requests")
        .select(`
          *,
          sender:profiles!friend_requests_sender_id_fkey (*),
          receiver:profiles!friend_requests_receiver_id_fkey (*)
        `)
        .eq("status", "accepted")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

      if (error) return { data: [], error };

      const friends = (data || []).map((row: any) =>
        row.sender_id === userId ? row.receiver : row.sender
      );

      return { data: friends, error: null };
    }
  }

  public async getPendingRequests(userId: string): Promise<{ data: FriendRequestWithProfiles[]; error: any }> {
    if (isMockMode) {
      const requests = mockDb.getFriendRequests();
      const profiles = mockDb.getProfiles();

      const pending = requests
        .filter((r) => r.status === "pending" && r.receiver_id === userId)
        .map((r) => ({
          ...r,
          sender: profiles.find((p) => p.id === r.sender_id),
          receiver: profiles.find((p) => p.id === r.receiver_id),
        }));

      return { data: pending, error: null };
    } else {
      const { data, error } = await supabase
        .from("friend_requests")
        .select(`
          *,
          sender:profiles!friend_requests_sender_id_fkey (*),
          receiver:profiles!friend_requests_receiver_id_fkey (*)
        `)
        .eq("receiver_id", userId)
        .eq("status", "pending");

      return { data: data || [], error };
    }
  }

  public async getSentRequests(userId: string): Promise<{ data: FriendRequestWithProfiles[]; error: any }> {
    if (isMockMode) {
      const requests = mockDb.getFriendRequests();
      const profiles = mockDb.getProfiles();

      const sent = requests
        .filter((r) => r.status === "pending" && r.sender_id === userId)
        .map((r) => ({
          ...r,
          sender: profiles.find((p) => p.id === r.sender_id),
          receiver: profiles.find((p) => p.id === r.receiver_id),
        }));

      return { data: sent, error: null };
    } else {
      const { data, error } = await supabase
        .from("friend_requests")
        .select(`
          *,
          sender:profiles!friend_requests_sender_id_fkey (*),
          receiver:profiles!friend_requests_receiver_id_fkey (*)
        `)
        .eq("sender_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      return { data: data || [], error };
    }
  }

  public async sendFriendRequest(senderId: string, receiverUsername: string): Promise<{ data: any; error: any }> {
    if (isMockMode) {
      const profiles = mockDb.getProfiles();
      const receiver = profiles.find(
        (p) => p.username.toLowerCase() === receiverUsername.trim().toLowerCase()
      );

      if (!receiver) {
        return { data: null, error: { message: "User not found." } };
      }

      if (receiver.id === senderId) {
        return { data: null, error: { message: "You cannot add yourself as a friend." } };
      }

      const requests = mockDb.getFriendRequests();
      
      // Check if request already exists
      const exists = requests.find(
        (r) =>
          (r.sender_id === senderId && r.receiver_id === receiver.id) ||
          (r.sender_id === receiver.id && r.receiver_id === senderId)
      );

      if (exists) {
        return {
          data: null,
          error: { message: `Friend request or friendship already exists (Status: ${exists.status}).` },
        };
      }

      const newReq: FriendRequest = {
        id: "fr-" + Math.random().toString(36).substr(2, 9),
        sender_id: senderId,
        receiver_id: receiver.id,
        status: "pending",
        created_at: new Date().toISOString(),
      };

      mockDb.saveFriendRequests([...requests, newReq]);
      return { data: newReq, error: null };
    } else {
      // Find user first
      const { data: profile, error: profError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", receiverUsername.trim())
        .single();

      if (profError || !profile) {
        return { data: null, error: { message: "User not found." } };
      }

      if (profile.id === senderId) {
        return { data: null, error: { message: "You cannot add yourself as a friend." } };
      }

      const { data, error } = await supabase
        .from("friend_requests")
        .insert({ sender_id: senderId, receiver_id: profile.id })
        .select()
        .single();

      return { data, error };
    }
  }

  public async respondToFriendRequest(
    requestId: string,
    status: "accepted" | "declined"
  ): Promise<{ error: any }> {
    if (isMockMode) {
      const requests = mockDb.getFriendRequests();
      const idx = requests.findIndex((r) => r.id === requestId);
      
      if (idx === -1) {
        return { error: { message: "Friend request not found." } };
      }

      const request = requests[idx];
      request.status = status;
      mockDb.saveFriendRequests(requests);

      // If accepted, automatically initiate a 1-to-1 conversation
      if (status === "accepted") {
        await chatService.createConversation(
          [request.sender_id, request.receiver_id],
          null, // Direct messages don't have titles
          false // isGroup = false
        );
      }

      return { error: null };
    } else {
      // Start transaction or sequential steps
      const { data: request, error: fetchError } = await supabase
        .from("friend_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (fetchError || !request) {
        return { error: { message: "Request not found." } };
      }

      const { error } = await supabase
        .from("friend_requests")
        .update({ status })
        .eq("id", requestId);

      if (error) return { error };

      if (status === "accepted") {
        // Create conversation
        await chatService.createConversation([request.sender_id, request.receiver_id], null, false);
      }

      return { error: null };
    }
  }

  public async getDiscoverableUsers(userId: string): Promise<{ data: Profile[]; error: any }> {
    if (isMockMode) {
      const requests = mockDb.getFriendRequests();
      const profiles = mockDb.getProfiles();

      // Find user IDs linked by requests
      const relatedUserIds = requests
        .filter((r) => r.sender_id === userId || r.receiver_id === userId)
        .map((r) => (r.sender_id === userId ? r.receiver_id : r.sender_id));

      const discoverable = profiles.filter(
        (p) => p.id !== userId && !relatedUserIds.includes(p.id)
      );

      return { data: discoverable, error: null };
    } else {
      // 1. Fetch all profiles except the current user
      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", userId);

      if (profError) return { data: [], error: profError };

      // 2. Fetch all friend requests involving this user
      const { data: requests, error: reqError } = await supabase
        .from("friend_requests")
        .select("sender_id, receiver_id")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

      if (reqError) return { data: [], error: reqError };

      const relatedUserIds = (requests || []).map((r: any) =>
        r.sender_id === userId ? r.receiver_id : r.sender_id
      );

      const discoverable = (profiles || []).filter(
        (p: any) => !relatedUserIds.includes(p.id)
      );

      return { data: discoverable, error: null };
    }
  }

  public async sendFriendRequestById(senderId: string, receiverId: string): Promise<{ data: any; error: any }> {
    if (isMockMode) {
      const requests = mockDb.getFriendRequests();
      const exists = requests.find(
        (r) =>
          (r.sender_id === senderId && r.receiver_id === receiverId) ||
          (r.sender_id === receiverId && r.receiver_id === senderId)
      );

      if (exists) {
        return {
          data: null,
          error: { message: "Friend request or friendship already exists." },
        };
      }

      const newReq: FriendRequest = {
        id: "fr-" + Math.random().toString(36).substr(2, 9),
        sender_id: senderId,
        receiver_id: receiverId,
        status: "pending",
        created_at: new Date().toISOString(),
      };

      mockDb.saveFriendRequests([...requests, newReq]);
      return { data: newReq, error: null };
    } else {
      const { data, error } = await supabase
        .from("friend_requests")
        .insert({ sender_id: senderId, receiver_id: receiverId })
        .select()
        .single();

      return { data, error };
    }
  }

  public async checkFriendshipStatus(
    currentUserId: string,
    targetUserId: string
  ): Promise<{
    status: "none" | "friends" | "pending_sent" | "pending_received" | "self";
    requestId?: string;
  }> {
    if (currentUserId === targetUserId) {
      return { status: "self" };
    }

    if (isMockMode) {
      const requests = mockDb.getFriendRequests();
      const req = requests.find(
        (r) =>
          (r.sender_id === currentUserId && r.receiver_id === targetUserId) ||
          (r.sender_id === targetUserId && r.receiver_id === currentUserId)
      );

      if (!req) return { status: "none" };
      if (req.status === "accepted") return { status: "friends", requestId: req.id };
      if (req.status === "pending") {
        if (req.sender_id === currentUserId) {
          return { status: "pending_sent", requestId: req.id };
        } else {
          return { status: "pending_received", requestId: req.id };
        }
      }
      return { status: "none" };
    } else {
      const { data, error } = await supabase
        .from("friend_requests")
        .select("id, sender_id, receiver_id, status")
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`
        )
        .order("created_at", { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return { status: "none" };
      }

      const req = data[0];
      if (req.status === "accepted") return { status: "friends", requestId: req.id };
      if (req.status === "pending") {
        if (req.sender_id === currentUserId) {
          return { status: "pending_sent", requestId: req.id };
        } else {
          return { status: "pending_received", requestId: req.id };
        }
      }
      return { status: "none" };
    }
  }

  public async cancelFriendRequest(requestId: string): Promise<{ error: any }> {
    if (isMockMode) {
      const requests = mockDb.getFriendRequests();
      mockDb.saveFriendRequests(requests.filter((r) => r.id !== requestId));
      return { error: null };
    } else {
      const { error } = await supabase
        .from("friend_requests")
        .delete()
        .eq("id", requestId);
      return { error };
    }
  }

  public async removeFriend(userId1: string, userId2: string): Promise<{ error: any }> {
    if (isMockMode) {
      const requests = mockDb.getFriendRequests();
      mockDb.saveFriendRequests(
        requests.filter(
          (r) =>
            !(
              (r.sender_id === userId1 && r.receiver_id === userId2) ||
              (r.sender_id === userId2 && r.receiver_id === userId1)
            )
        )
      );
      return { error: null };
    } else {
      const { error } = await supabase
        .from("friend_requests")
        .delete()
        .or(
          `and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`
        );
      return { error };
    }
  }

  public async getFriendsCount(userId: string): Promise<number> {
    const { data } = await this.getFriends(userId);
    return (data || []).length;
  }
}

export const friendService = new FriendServiceClass();
export default friendService;

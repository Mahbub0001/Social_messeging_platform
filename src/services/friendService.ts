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
}

export const friendService = new FriendServiceClass();
export default friendService;

import React, { useState, useEffect } from "react";
import { useStore } from "../hooks/useStore";
import { friendService } from "../services/friendService";
import type { FriendRequestWithProfiles } from "../services/friendService";
import type { Profile } from "../services/mockDb";
import { chatService } from "../services/chatService";
import { motion, AnimatePresence } from "framer-motion";
import { sanitizeUrl } from "../utils/security";
import { X, UserPlus, Users, Loader2, Check, Ban, AlertCircle } from "lucide-react";

interface FriendsPanelProps {
  onClose: () => void;
}

export const FriendsPanel: React.FC<FriendsPanelProps> = ({ onClose }) => {
  const { user, onlineUsers, conversations, setActiveConversationId, fetchConversations } = useStore();
  const [friends, setFriends] = useState<Profile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequestWithProfiles[]>([]);
  
  const [targetUsername, setTargetUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [reqSuccess, setReqSuccess] = useState<string | null>(null);
  const [reqError, setReqError] = useState<string | null>(null);

  const fetchFriendsData = async () => {
    if (!user?.id) return;
    const [friendsRes, requestsRes] = await Promise.all([
      friendService.getFriends(user.id),
      friendService.getPendingRequests(user.id),
    ]);

    if (!friendsRes.error) setFriends(friendsRes.data);
    if (!requestsRes.error) setPendingRequests(requestsRes.data);
  };

  useEffect(() => {
    fetchFriendsData();
  }, [user?.id]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername.trim() || !user?.id) return;
    setLoading(true);
    setReqSuccess(null);
    setReqError(null);

    try {
      const { error } = await friendService.sendFriendRequest(user.id, targetUsername);
      if (error) {
        setReqError(error.message);
      } else {
        setReqSuccess("Friend request sent successfully!");
        setTargetUsername("");
        fetchFriendsData();
      }
    } catch (err) {
      setReqError("Failed to send friend request.");
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (requestId: string, status: "accepted" | "declined") => {
    setActionLoadingId(requestId);
    try {
      const { error } = await friendService.respondToFriendRequest(requestId, status);
      if (!error) {
        fetchFriendsData();
        // Sync conversations in store
        useStore.getState().fetchConversations();
      } else {
        alert(error.message);
      }
    } catch (err) {
      alert("Failed to respond to request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStartChat = async (friend: Profile) => {
    if (!user?.id) return;
    
    // Check if 1-to-1 conversation already exists
    const existing = conversations.find(
      (c) =>
        !c.is_group &&
        c.members &&
        c.members.some((m) => m.id === friend.id) &&
        c.members.some((m) => m.id === user.id)
    );

    if (existing) {
      setActiveConversationId(existing.id);
      onClose();
    } else {
      setLoading(true);
      try {
        const { data, error } = await chatService.createConversation(
          [user.id, friend.id],
          null,
          false
        );
        if (!error && data) {
          await fetchConversations();
          setActiveConversationId(data.id);
          onClose();
        } else {
          alert(error?.message || "Failed to start conversation.");
        }
      } catch (err) {
        alert("An error occurred starting conversation.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute top-0 right-0 z-30 w-full sm:w-[360px] h-full bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Users className="w-4.5 h-4.5 text-violet-400" />
          <span>Friends & Requests</span>
        </h3>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Add Friend Form */}
        <form onSubmit={handleSendRequest} className="space-y-3 font-sans text-xs">
          <label className="block font-semibold text-slate-300">Add Friend by Username</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter exact username..."
              value={targetUsername}
              onChange={(e) => setTargetUsername(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !targetUsername.trim()}
              className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center gap-1 active:scale-95 transition-all shadow"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            </button>
          </div>
          {reqError && (
            <p className="text-[10px] text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{reqError}</span>
            </p>
          )}
          {reqSuccess && (
            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>{reqSuccess}</span>
            </p>
          )}
        </form>

        <hr className="border-slate-800" />

        {/* Pending Requests Section */}
        <div>
          <h4 className="text-2xs uppercase text-slate-500 font-semibold tracking-wider mb-3">
            Pending Requests ({pendingRequests.length})
          </h4>
          {pendingRequests.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No pending invitations.</p>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {pendingRequests.map((req) => (
                  <motion.div
                    key={req.id}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center justify-between p-2.5 bg-slate-950/50 border border-slate-850 rounded-xl"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={sanitizeUrl(req.sender?.avatar_url)}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                      <span className="text-xs text-slate-200 truncate font-sans">
                        {req.sender?.username}
                      </span>
                    </div>
                    {actionLoadingId === req.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                    ) : (
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => handleResponse(req.id, "accepted")}
                          className="p-1 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white rounded-lg transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleResponse(req.id, "declined")}
                          className="p-1 bg-red-650/10 text-red-400 border border-red-500/20 hover:bg-red-650 hover:text-white rounded-lg transition-all"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <hr className="border-slate-800" />

        {/* Friends Section */}
        <div>
          <h4 className="text-2xs uppercase text-slate-500 font-semibold tracking-wider mb-3">
            Friends List ({friends.length})
          </h4>
          {friends.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No friends added yet.</p>
          ) : (
            <div className="space-y-2">
              {friends.map((friend) => {
                const isOnline = onlineUsers.includes(friend.id);
                return (
                  <button
                    key={friend.id}
                    onClick={() => handleStartChat(friend)}
                    className="w-full flex items-center justify-between p-2.5 hover:bg-slate-800/40 rounded-xl transition-all text-left group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={sanitizeUrl(friend.avatar_url)}
                        alt="Avatar"
                        className="w-8.5 h-8.5 rounded-full object-cover shrink-0 group-hover:scale-105 transition-transform"
                      />
                      <div className="min-w-0 flex-1">
                        <h5 className="text-xs font-bold text-slate-200 truncate group-hover:text-violet-400 transition-colors">
                          {friend.username}
                        </h5>
                        <p className="text-[10px] text-slate-500 truncate max-w-[180px]">
                          {friend.bio || "Hey there! I am using কথাবার্তা."}
                        </p>
                      </div>
                    </div>
                    {isOnline ? (
                      <span className="text-[10px] text-emerald-400 font-semibold shrink-0">Online</span>
                    ) : (
                      <span className="text-[10px] text-slate-500 shrink-0">Offline</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default FriendsPanel;

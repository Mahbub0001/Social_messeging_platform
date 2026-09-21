import React, { useState, useEffect } from "react";
import { useStore } from "../hooks/useStore";
import { friendService } from "../services/friendService";
import type { FriendRequestWithProfiles } from "../services/friendService";
import type { Profile } from "../services/mockDb";
import { chatService } from "../services/chatService";
import { motion, AnimatePresence } from "framer-motion";
import { sanitizeUrl } from "../utils/security";
import {
  X,
  UserPlus,
  Users,
  Loader2,
  Check,
  Ban,
  AlertCircle,
  Send,
} from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { getTranslation } from "../utils/translations";

interface FriendsPanelProps {
  onClose: () => void;
  onOpenUserProfile?: (userId: string) => void;
}

export const FriendsPanel: React.FC<FriendsPanelProps> = ({ onClose, onOpenUserProfile }) => {
  const { user, onlineUsers, conversations, setActiveConversationId, fetchConversations, language } = useStore();
  const [friends, setFriends] = useState<Profile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequestWithProfiles[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequestWithProfiles[]>([]);
  const [discoverUsers, setDiscoverUsers] = useState<Profile[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "friends" | "received" | "sent" | "discover">("all");
  
  const [targetUsername, setTargetUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [reqSuccess, setReqSuccess] = useState<string | null>(null);
  const [reqError, setReqError] = useState<string | null>(null);

  const fetchFriendsData = async () => {
    if (!user?.id) return;
    const [friendsRes, requestsRes, sentRes, discoverRes] = await Promise.all([
      friendService.getFriends(user.id),
      friendService.getPendingRequests(user.id),
      friendService.getSentRequests(user.id),
      friendService.getDiscoverableUsers(user.id),
    ]);

    if (!friendsRes.error) setFriends(friendsRes.data);
    if (!requestsRes.error) setPendingRequests(requestsRes.data);
    if (!sentRes.error) setSentRequests(sentRes.data);
    if (!discoverRes.error) setDiscoverUsers(discoverRes.data);
  };

  useEffect(() => {
    fetchFriendsData();

    if (!user?.id) return;

    // Realtime postgres changes subscription on friend_requests table
    const channel = supabase
      .channel(`friends-panel-realtime-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
        },
        () => {
          fetchFriendsData();
          useStore.getState().fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const handleAddFriend = async (receiverId: string) => {
    if (!user?.id) return;
    setActionLoadingId(receiverId);
    setReqSuccess(null);
    setReqError(null);

    try {
      const { error } = await friendService.sendFriendRequestById(user.id, receiverId);
      if (error) {
        setReqError(error.message);
      } else {
        setReqSuccess("Friend request sent!");
        fetchFriendsData();
      }
    } catch (err) {
      setReqError("Failed to send friend request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelSentRequest = async (requestId: string) => {
    setActionLoadingId(requestId);
    try {
      // Optimistic update
      setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
      const { error } = await friendService.cancelFriendRequest(requestId);
      if (error) {
        alert(error.message || "Failed to cancel request.");
        fetchFriendsData();
      }
    } catch (err) {
      alert("Failed to cancel request.");
      fetchFriendsData();
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
      <div className="flex items-center justify-between px-4 pt-[max(0.75rem,calc(0.75rem+env(safe-area-inset-top,0px)))] pb-3 bg-slate-900 border-b border-slate-800">
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

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-800/80 bg-slate-950/30 overflow-x-auto no-scrollbar shrink-0">
        {[
          { id: "all", label: "All" },
          { id: "friends", label: `Friends (${friends.length})` },
          { id: "received", label: `Received (${pendingRequests.length})`, count: pendingRequests.length },
          { id: "sent", label: `Sent (${sentRequests.length})`, count: sentRequests.length },
          { id: "discover", label: `Discover (${discoverUsers.length})` },
        ].map((tabItem) => {
          const isActive = activeFilter === tabItem.id;
          return (
            <button
              key={tabItem.id}
              onClick={() => setActiveFilter(tabItem.id as any)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 select-none",
                isActive
                  ? "bg-violet-600 text-white shadow-sm shadow-violet-500/20"
                  : "bg-slate-850/70 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/80"
              )}
            >
              <span>{tabItem.label}</span>
              {tabItem.count !== undefined && tabItem.count > 0 && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Add Friend Form */}
        {(activeFilter === "all" || activeFilter === "discover") && (
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
        )}

        {(activeFilter === "all" || activeFilter === "received") && (
          <>
            {activeFilter === "all" && <hr className="border-slate-800" />}
            {/* Pending Received Requests Section */}
            <div>
              <h4 className="text-2xs uppercase text-slate-500 font-semibold tracking-wider mb-3">
                {getTranslation(language, "receivedRequestsTitle")} ({pendingRequests.length})
              </h4>
              {pendingRequests.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  {getTranslation(language, "noReceivedRequests")}
                </p>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {pendingRequests.map((req) => (
                      <motion.div
                        key={req.id}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center justify-between p-2.5 bg-slate-950/50 border border-slate-850 rounded-xl"
                      >
                        <div 
                          className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
                          onClick={() => req.sender?.id && onOpenUserProfile?.(req.sender.id)}
                        >
                          <img
                            src={sanitizeUrl(req.sender?.avatar_url)}
                            alt="Avatar"
                            className="w-8 h-8 rounded-full object-cover shrink-0 group-hover:ring-2 group-hover:ring-violet-500 transition-all"
                          />
                          <span className="text-xs text-slate-200 truncate font-sans group-hover:text-violet-400 transition-colors">
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
          </>
        )}

        {/* Sent Requests Section (jader friend req pathaisi) */}
        {(activeFilter === "all" || activeFilter === "sent") && (
          <>
            {activeFilter === "all" && <hr className="border-slate-800" />}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-2xs uppercase text-slate-500 font-semibold tracking-wider flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-sky-400" />
                  <span>{getTranslation(language, "sentRequestsTitle")} ({sentRequests.length})</span>
                </h4>
              </div>

              {sentRequests.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  {getTranslation(language, "noSentRequests")}
                </p>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {sentRequests.map((req) => (
                      <motion.div
                        key={req.id}
                        layout
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center justify-between p-2.5 bg-slate-950/50 border border-slate-850 hover:border-slate-800 rounded-xl transition-all"
                      >
                        <div
                          className="flex items-center gap-2.5 min-w-0 cursor-pointer group flex-1"
                          onClick={() => req.receiver?.id && onOpenUserProfile?.(req.receiver.id)}
                        >
                          <img
                            src={sanitizeUrl(req.receiver?.avatar_url)}
                            alt="Avatar"
                            className="w-8.5 h-8.5 rounded-full object-cover shrink-0 group-hover:ring-2 group-hover:ring-sky-400/60 transition-all"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <h5 className="text-xs font-semibold text-slate-200 truncate group-hover:text-sky-400 transition-colors">
                                {req.receiver?.username || "User"}
                              </h5>
                              <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-sky-400/10 text-sky-300 border border-sky-400/20 font-medium shrink-0">
                                Pending
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate max-w-[160px]">
                              {req.receiver?.bio || "Friend request sent"}
                            </p>
                          </div>
                        </div>

                        {actionLoadingId === req.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-500 shrink-0" />
                        ) : (
                          <button
                            onClick={() => handleCancelSentRequest(req.id)}
                            title={getTranslation(language, "cancelRequest")}
                            className="px-2.5 py-1 text-2xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-lg transition-all active:scale-95 shrink-0"
                          >
                            {getTranslation(language, "cancelRequest")}
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </>
        )}

        {/* Discover People Section */}
        {(activeFilter === "all" || activeFilter === "discover") && (
          <>
            {activeFilter === "all" && <hr className="border-slate-800" />}
            <div>
              <h4 className="text-2xs uppercase text-slate-500 font-semibold tracking-wider mb-3 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-violet-400" />
                <span>Discover People ({discoverUsers.length})</span>
              </h4>
              {discoverUsers.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No new people to discover right now.</p>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {discoverUsers.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center justify-between p-2.5 bg-slate-950/40 border border-slate-850 hover:border-slate-800 rounded-xl transition-all font-sans"
                      >
                        <div 
                          className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
                          onClick={() => onOpenUserProfile?.(item.id)}
                        >
                          <img
                            src={sanitizeUrl(item.avatar_url)}
                            alt="Avatar"
                            className="w-8 h-8 rounded-full object-cover shrink-0 group-hover:ring-2 group-hover:ring-violet-500 transition-all"
                          />
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-semibold text-slate-200 truncate group-hover:text-violet-400 transition-colors">
                              {item.username}
                            </h5>
                            <p className="text-[9px] text-slate-500 truncate max-w-[180px]">
                              {item.bio || "Hey there! I am using কথাবার্তা."}
                            </p>
                          </div>
                        </div>
                        {actionLoadingId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-500 shrink-0" />
                        ) : (
                          <button
                            onClick={() => handleAddFriend(item.id)}
                            title="Add Friend"
                            className="p-1.5 bg-violet-600/10 text-violet-400 border border-violet-500/20 hover:bg-violet-600 hover:text-white rounded-lg transition-all shrink-0 active:scale-95"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </>
        )}

        {/* Friends Section */}
        {(activeFilter === "all" || activeFilter === "friends") && (
          <>
            {activeFilter === "all" && <hr className="border-slate-800" />}
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
                      <div
                        key={friend.id}
                        className="w-full flex items-center justify-between p-2.5 hover:bg-slate-800/40 rounded-xl transition-all group"
                      >
                        <div 
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                          onClick={() => handleStartChat(friend)}
                        >
                          <img
                            src={sanitizeUrl(friend.avatar_url)}
                            alt="Avatar"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenUserProfile?.(friend.id);
                            }}
                            className="w-8.5 h-8.5 rounded-full object-cover shrink-0 hover:ring-2 hover:ring-violet-500 transition-all"
                            title="View Profile"
                          />
                          <div className="min-w-0 flex-1 text-left">
                            <h5 className="text-xs font-bold text-slate-200 truncate group-hover:text-violet-400 transition-colors">
                              {friend.username}
                            </h5>
                            <p className="text-[10px] text-slate-500 truncate max-w-[180px]">
                              {friend.bio || "Hey there! I am using কথাবার্তা."}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isOnline ? (
                            <span className="text-[10px] text-emerald-400 font-semibold">Online</span>
                          ) : (
                            <span className="text-[10px] text-slate-500">Offline</span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenUserProfile?.(friend.id);
                            }}
                            className="px-2 py-1 bg-slate-800/80 hover:bg-violet-600/30 hover:text-violet-300 text-slate-400 rounded-lg text-2xs font-semibold transition-colors"
                            title="View Profile"
                          >
                            Profile
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default FriendsPanel;

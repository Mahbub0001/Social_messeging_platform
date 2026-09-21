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
  Inbox,
  Search,
  MessageSquare,
  User,
  Compass,
  Sparkles,
} from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { getTranslation } from "../utils/translations";

interface FriendsPanelProps {
  onClose: () => void;
  onOpenUserProfile?: (userId: string) => void;
}

type TabType = "friends" | "received" | "sent" | "discover";

export const FriendsPanel: React.FC<FriendsPanelProps> = ({ onClose, onOpenUserProfile }) => {
  const { user, onlineUsers, conversations, setActiveConversationId, fetchConversations, language } = useStore();
  const [friends, setFriends] = useState<Profile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequestWithProfiles[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequestWithProfiles[]>([]);
  const [discoverUsers, setDiscoverUsers] = useState<Profile[]>([]);
  
  const [activeTab, setActiveTab] = useState<TabType>("friends");
  const [friendSearch, setFriendSearch] = useState("");
  
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

    // Real-time postgres changes subscription on friend_requests table
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

  // If there are pending received requests on initial load, auto-switch to received tab
  useEffect(() => {
    if (pendingRequests.length > 0 && activeTab === "friends" && friends.length === 0) {
      setActiveTab("received");
    }
  }, [pendingRequests.length, friends.length]);

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
        setReqSuccess(
          language === "bn"
            ? "ফ্রেন্ড রিকোয়েস্ট সফলভাবে পাঠানো হয়েছে!"
            : "Friend request sent successfully!"
        );
        setTargetUsername("");
        fetchFriendsData();
        // Switch to Sent tab to let user see their newly sent request
        setActiveTab("sent");
      }
    } catch (err) {
      setReqError(
        language === "bn" ? "ফ্রেন্ড রিকোয়েস্ট পাঠাতে ব্যর্থ হয়েছে।" : "Failed to send friend request."
      );
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
        fetchFriendsData();
        setActiveTab("sent");
      }
    } catch (err) {
      setReqError(language === "bn" ? "রিকোয়েস্ট পাঠাতে ব্যর্থ হয়েছে।" : "Failed to send friend request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelSentRequest = async (requestId: string) => {
    setActionLoadingId(requestId);
    try {
      // Optimistic instant update
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

  // Filtered friends list based on search
  const filteredFriends = friends.filter((f) =>
    (f.username || "").toLowerCase().includes(friendSearch.toLowerCase())
  );

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute top-0 right-0 z-30 w-full sm:w-[380px] h-full bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl transition-colors font-sans"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-[max(0.75rem,calc(0.75rem+env(safe-area-inset-top,0px)))] pb-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Users className="w-4 h-4" />
          </div>
          <span>{getTranslation(language, "friendsAndRequests")}</span>
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Segmented Navigation Tabs ── */}
      <div className="p-3 pb-2 shrink-0">
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/60 dark:bg-slate-950/70 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
          {/* Tab 1: Friends */}
          <button
            onClick={() => setActiveTab("friends")}
            className={cn(
              "relative flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all select-none",
              activeTab === "friends"
                ? "bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span>{getTranslation(language, "friendsTab")}</span>
            </div>
            <span className="text-[10px] opacity-75 font-normal">({friends.length})</span>
          </button>

          {/* Tab 2: Received */}
          <button
            onClick={() => setActiveTab("received")}
            className={cn(
              "relative flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all select-none",
              activeTab === "received"
                ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <div className="flex items-center gap-1">
              <Inbox className="w-3.5 h-3.5" />
              <span>{getTranslation(language, "receivedTab")}</span>
            </div>
            <span className="text-[10px] opacity-75 font-normal">({pendingRequests.length})</span>
            {pendingRequests.length > 0 && activeTab !== "received" && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            )}
          </button>

          {/* Tab 3: Sent (Newly added feature) */}
          <button
            onClick={() => setActiveTab("sent")}
            className={cn(
              "relative flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all select-none",
              activeTab === "sent"
                ? "bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <div className="flex items-center gap-1">
              <Send className="w-3.5 h-3.5" />
              <span>{getTranslation(language, "sentTab")}</span>
            </div>
            <span className="text-[10px] opacity-75 font-normal">({sentRequests.length})</span>
            {sentRequests.length > 0 && activeTab !== "sent" && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-sky-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          {/* Tab 4: Discover */}
          <button
            onClick={() => setActiveTab("discover")}
            className={cn(
              "relative flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all select-none",
              activeTab === "discover"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <div className="flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" />
              <span>{getTranslation(language, "discoverTab")}</span>
            </div>
            <span className="text-[10px] opacity-75 font-normal">({discoverUsers.length})</span>
          </button>
        </div>
      </div>

      {/* ── Scrollable Tab Content ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
        {/* ========================================================================= */}
        {/* TAB 1: FRIENDS LIST                                                      */}
        {/* ========================================================================= */}
        {activeTab === "friends" && (
          <div className="space-y-3">
            {/* Search Box */}
            {friends.length > 0 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={getTranslation(language, "searchFriendsPlaceholder")}
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-1.5 bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all"
                />
              </div>
            )}

            {/* Friends Cards */}
            {friends.length === 0 ? (
              <div className="text-center py-10 px-4 bg-white/50 dark:bg-slate-950/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  {getTranslation(language, "noFriendsYet")}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[220px] mx-auto mb-4 leading-relaxed">
                  {language === "bn"
                    ? "অন্যদের সাথে চ্যাট ও পোস্ট শেয়ার করতে বন্ধুদের অ্যাড করুন।"
                    : "Connect with people to chat securely and share posts on the feed."}
                </p>
                <button
                  onClick={() => setActiveTab("discover")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold shadow-md active:scale-95 transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{getTranslation(language, "findFriendsBtn")}</span>
                </button>
              </div>
            ) : filteredFriends.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400 italic">
                {getTranslation(language, "noFriendsFound")}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredFriends.map((friend) => {
                  const isOnline = onlineUsers.includes(friend.id);
                  return (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-violet-300 dark:hover:border-slate-700 rounded-2xl shadow-2xs transition-all group"
                    >
                      {/* Avatar & Info */}
                      <div
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                        onClick={() => handleStartChat(friend)}
                      >
                        <div className="relative shrink-0">
                          <img
                            src={sanitizeUrl(friend.avatar_url)}
                            alt={friend.username}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenUserProfile?.(friend.id);
                            }}
                            className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 group-hover:ring-2 group-hover:ring-violet-500 transition-all"
                            title="View Profile"
                          />
                          {isOnline && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                              {friend.username}
                            </h5>
                            {isOnline && (
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">
                                • Online
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                            {friend.bio || (language === "bn" ? "কথাবার্তা ব্যবহারকারী" : "Chatting on কথাবাত্তা")}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartChat(friend)}
                          className="p-1.5 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600 dark:hover:text-white rounded-xl transition-all shadow-2xs"
                          title={getTranslation(language, "chatBtn")}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onOpenUserProfile?.(friend.id)}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
                          title={getTranslation(language, "profileBtn")}
                        >
                          <User className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: RECEIVED REQUESTS (INCOMING)                                      */}
        {/* ========================================================================= */}
        {activeTab === "received" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {getTranslation(language, "receivedRequestsTitle")} ({pendingRequests.length})
              </h4>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="text-center py-10 px-4 bg-white/50 dark:bg-slate-950/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <Inbox className="w-5 h-5" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  {getTranslation(language, "noReceivedRequests")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {pendingRequests.map((req) => (
                    <motion.div
                      key={req.id}
                      layout
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center justify-between p-3 bg-white dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-2xs transition-all"
                    >
                      <div
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
                        onClick={() => req.sender?.id && onOpenUserProfile?.(req.sender.id)}
                      >
                        <img
                          src={sanitizeUrl(req.sender?.avatar_url)}
                          alt={req.sender?.username || "Avatar"}
                          className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 group-hover:ring-2 group-hover:ring-emerald-500 transition-all"
                        />
                        <div className="min-w-0 flex-1">
                          <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {req.sender?.username || "User"}
                          </h5>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                            {req.sender?.bio || (language === "bn" ? "আপনাকে ফ্রেন্ড রিকোয়েস্ট পাঠিয়েছেন" : "Sent you a friend request")}
                          </p>
                        </div>
                      </div>

                      {actionLoadingId === req.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleResponse(req.id, "accepted")}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs active:scale-95 transition-all"
                            title={getTranslation(language, "acceptBtn")}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{getTranslation(language, "acceptBtn")}</span>
                          </button>
                          <button
                            onClick={() => handleResponse(req.id, "declined")}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all"
                            title={getTranslation(language, "declineBtn")}
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
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SENT REQUESTS (OUTGOING - USER'S FEATURE REQUEST)                 */}
        {/* ========================================================================= */}
        {activeTab === "sent" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-sky-500" />
                <span>{getTranslation(language, "sentRequestsTitle")} ({sentRequests.length})</span>
              </h4>
            </div>

            {sentRequests.length === 0 ? (
              <div className="text-center py-10 px-4 bg-white/50 dark:bg-slate-950/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <Send className="w-5 h-5 text-sky-400/80" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  {getTranslation(language, "noSentRequests")}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto">
                  {language === "bn"
                    ? "কাউকে রিকোয়েস্ট পাঠালে সে অ্যাকসেপ্ট করা পর্যন্ত এখানে দেখতে পাবেন।"
                    : "Requests you send stay here until accepted or cancelled."}
                </p>
              </div>
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
                      className="flex items-center justify-between p-3 bg-white dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-2xs hover:border-sky-300 dark:hover:border-sky-900 transition-all"
                    >
                      {/* Avatar & Receiver Info */}
                      <div
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
                        onClick={() => req.receiver?.id && onOpenUserProfile?.(req.receiver.id)}
                      >
                        <img
                          src={sanitizeUrl(req.receiver?.avatar_url)}
                          alt={req.receiver?.username || "Avatar"}
                          className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 group-hover:ring-2 group-hover:ring-sky-400 transition-all"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                              {req.receiver?.username || "User"}
                            </h5>
                            <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800/60 font-semibold shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                              <span>{getTranslation(language, "pendingStatus")}</span>
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                            {req.receiver?.bio || (language === "bn" ? "রিকোয়েস্ট পাঠানো হয়েছে" : "Waiting for approval")}
                          </p>
                        </div>
                      </div>

                      {/* Cancel Request Button */}
                      {actionLoadingId === req.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
                      ) : (
                        <button
                          onClick={() => handleCancelSentRequest(req.id)}
                          title={getTranslation(language, "cancelRequest")}
                          className="px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-600 hover:text-white dark:bg-rose-950/30 dark:hover:bg-rose-600 dark:hover:text-white border border-rose-200/80 dark:border-rose-900/60 rounded-xl transition-all active:scale-95 shrink-0"
                        >
                          {getTranslation(language, "cancelSentReqBtn")}
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: DISCOVER & ADD FRIEND                                             */}
        {/* ========================================================================= */}
        {activeTab === "discover" && (
          <div className="space-y-4">
            {/* Add Friend by Username Card */}
            <div className="p-3.5 bg-white dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-2xs">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-violet-500" />
                <span>{getTranslation(language, "addByUsername")}</span>
              </h4>
              <form onSubmit={handleSendRequest} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={getTranslation(language, "enterExactUsername")}
                    value={targetUsername}
                    onChange={(e) => setTargetUsername(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={loading || !targetUsername.trim()}
                    className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center gap-1 active:scale-95 transition-all shadow-xs"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    <span>{getTranslation(language, "sendRequestBtn")}</span>
                  </button>
                </div>

                {reqError && (
                  <p className="text-[11px] text-rose-500 flex items-center gap-1 pt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{reqError}</span>
                  </p>
                )}
                {reqSuccess && (
                  <p className="text-[11px] text-emerald-500 flex items-center gap-1 pt-1">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>{reqSuccess}</span>
                  </p>
                )}
              </form>
            </div>

            {/* Suggested People to Discover */}
            <div>
              <h4 className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>{getTranslation(language, "discoverPeopleTitle")} ({discoverUsers.length})</span>
              </h4>

              {discoverUsers.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic py-4 text-center">
                  {getTranslation(language, "noDiscoverPeople")}
                </p>
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
                        className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                      >
                        <div
                          className="flex items-center gap-2.5 min-w-0 cursor-pointer group flex-1"
                          onClick={() => onOpenUserProfile?.(item.id)}
                        >
                          <img
                            src={sanitizeUrl(item.avatar_url)}
                            alt={item.username}
                            className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 group-hover:ring-2 group-hover:ring-violet-500 transition-all shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                              {item.username}
                            </h5>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                              {item.bio || (language === "bn" ? "কথাবার্তা ব্যবহারকারী" : "Chatting on কথাবাত্তা")}
                            </p>
                          </div>
                        </div>

                        {actionLoadingId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
                        ) : (
                          <button
                            onClick={() => handleAddFriend(item.id)}
                            title={getTranslation(language, "addFriend")}
                            className="px-2.5 py-1.5 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600 dark:hover:text-white border border-violet-200 dark:border-violet-800/60 rounded-xl text-xs font-semibold transition-all active:scale-95 shrink-0 flex items-center gap-1 shadow-2xs"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>{getTranslation(language, "addFriend")}</span>
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default FriendsPanel;

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Shield,
  ShieldCheck,
  Lock,
  UserPlus,
  UserCheck,
  MessageCircle,
  Clock,
  Calendar,
  Sparkles,
  Edit3,
  Loader2,
  Users,
} from "lucide-react";
import { useStore } from "../../hooks/useStore";
import { authService } from "../../services/authService";
import { friendService } from "../../services/friendService";
import { feedService } from "../../services/feedService";
import type { FeedPost } from "../../services/feedService";
import type { Profile } from "../../services/mockDb";
import { getTranslation } from "../../utils/translations";
import { PostCard } from "../feed/PostCard";
import { PostCommentsModal } from "../feed/PostCommentsModal";
import { ShareModal } from "../feed/ShareModal";
import type { ReactionType } from "../feed/ReactionPicker";

export interface UserProfileModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenChat?: (targetUserId: string) => void;
  onOpenEditProfile?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  userId,
  isOpen,
  onClose,
  onOpenChat,
  onOpenEditProfile,
}) => {
  const { user, currentProfile, language } = useStore();
  const currentUserId = user?.id || currentProfile?.id || "";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [friendsCount, setFriendsCount] = useState<number>(0);
  const [friendshipStatus, setFriendshipStatus] = useState<
    "none" | "friends" | "pending_sent" | "pending_received" | "self"
  >("none");
  const [pendingRequestId, setPendingRequestId] = useState<string | undefined>(undefined);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals for post interactions inside profile timeline
  const [selectedPostForComments, setSelectedPostForComments] = useState<FeedPost | null>(null);
  const [selectedPostForShare, setSelectedPostForShare] = useState<FeedPost | null>(null);

  const loadUserData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      // 1. Fetch Profile
      const { data: prof } = await authService.getProfile(userId);
      setProfile(prof || null);

      // 2. Fetch Friendship Status
      if (currentUserId && userId) {
        const { status, requestId } = await friendService.checkFriendshipStatus(
          currentUserId,
          userId
        );
        setFriendshipStatus(status);
        setPendingRequestId(requestId);
      }

      // 3. Fetch Friends Count
      const count = await friendService.getFriendsCount(userId);
      setFriendsCount(count);

      // 4. Fetch User Posts (Feed Service handles locked profile gating)
      const { data: userPosts, isLocked: locked } = await feedService.getUserPosts(
        userId,
        currentUserId
      );
      setPosts(userPosts || []);
      setIsLocked(locked);
    } catch (err) {
      console.error("UserProfileModal loadUserData error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, currentUserId]);

  useEffect(() => {
    if (isOpen && userId) {
      loadUserData();
    } else {
      setProfile(null);
      setPosts([]);
      setIsLocked(false);
    }
  }, [isOpen, userId, loadUserData]);

  // Handle Add Friend
  const handleAddFriend = async () => {
    if (!userId || !currentUserId || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await friendService.sendFriendRequestById(currentUserId, userId);
      if (!res.error) {
        setFriendshipStatus("pending_sent");
        if (res.data?.id) {
          setPendingRequestId(res.data.id);
        }
      }
    } catch (e) {
      console.error("Error adding friend:", e);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel Request
  const handleCancelRequest = async () => {
    if (!pendingRequestId || actionLoading) return;
    setActionLoading(true);
    try {
      const { error } = await friendService.cancelFriendRequest(pendingRequestId);
      if (!error) {
        setFriendshipStatus("none");
        setPendingRequestId(undefined);
      }
    } catch (e) {
      console.error("Error cancelling friend request:", e);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Confirm Request
  const handleConfirmRequest = async () => {
    if (!pendingRequestId || actionLoading) return;
    setActionLoading(true);
    try {
      const { error } = await friendService.respondToFriendRequest(pendingRequestId, "accepted");
      if (!error) {
        setFriendshipStatus("friends");
        // Reload posts and status since they are now friends
        loadUserData();
      }
    } catch (e) {
      console.error("Error accepting friend request:", e);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Unfriend
  const handleUnfriend = async () => {
    if (!userId || !currentUserId || actionLoading) return;
    const confirmMsg =
      language === "bn"
        ? `আপনি কি নিশ্চিত যে আপনি ${profile?.username || "এই ইউজার"}-কে আনফ্রেন্ড করতে চান?`
        : `Are you sure you want to unfriend ${profile?.username || "this user"}?`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      const { error } = await friendService.removeFriend(currentUserId, userId);
      if (!error) {
        setFriendshipStatus("none");
        loadUserData();
      }
    } catch (e) {
      console.error("Error unfriending:", e);
    } finally {
      setActionLoading(false);
    }
  };

  // Reactions on user posts
  const handleReaction = async (postId: string, reactionType: ReactionType) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const reactions = { ...p.reactions };
        const prevReaction = p.userReaction;

        if (prevReaction && reactions[prevReaction]) {
          reactions[prevReaction] = reactions[prevReaction].filter(
            (r) => r.userId !== currentUserId
          );
        }

        if (prevReaction === reactionType) {
          return { ...p, reactions, userReaction: null };
        }

        if (!reactions[reactionType]) reactions[reactionType] = [];
        reactions[reactionType] = [
          ...reactions[reactionType],
          {
            userId: currentUserId,
            username: currentProfile?.username || "You",
            reactionType,
            createdAt: new Date().toISOString(),
          },
        ];
        return { ...p, reactions, userReaction: reactionType };
      })
    );
    await feedService.toggleReaction(postId, currentUserId, reactionType);
  };

  if (!isOpen || !userId) return null;

  const isSelf = currentUserId === userId;
  const targetLocked = Boolean(profile?.is_locked);
  const showLockedContentGating = isLocked && !isSelf && friendshipStatus !== "friends";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-sm">
        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto"
        >
          {/* Top Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-30 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {/* Header Banner / Cover */}
            <div className="relative h-36 sm:h-48 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
              {targetLocked && (
                <div className="absolute top-3 left-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white text-xs font-medium">
                  <Lock className="w-3.5 h-3.5 text-amber-300" />
                  <span>{getTranslation(language, "profileLocked")}</span>
                </div>
              )}
            </div>

            {/* Profile Overview Card */}
            <div className="relative px-4 sm:px-6 pb-6 pt-0">
              {/* Avatar + Floating Actions */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-4">
                {/* Big Avatar with Protection Shield */}
                <div className="relative inline-block self-start">
                  <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full p-1 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.username}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white text-3xl font-bold">
                        {profile?.username?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                  </div>

                  {/* Online indicator */}
                  {profile?.is_online && (
                    <span
                      className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-emerald-500 border-3 border-white dark:border-slate-900 shadow-sm"
                      title="Online"
                    />
                  )}

                  {/* Profile Locked Badge Icon */}
                  {targetLocked && (
                    <div
                      className="absolute bottom-1 -left-1 p-1.5 rounded-full bg-amber-500 text-white shadow-md border-2 border-white dark:border-slate-900"
                      title={getTranslation(language, "profileLocked")}
                    >
                      <Shield className="w-4 h-4 fill-white" />
                    </div>
                  )}
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {isSelf ? (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenEditProfile?.();
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm transition-colors shadow-xs"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>{language === "bn" ? "প্রোফাইল এডিট করুন" : "Edit Profile"}</span>
                    </button>
                  ) : (
                    <>
                      {/* Add Friend / Status Button */}
                      {friendshipStatus === "none" && (
                        <button
                          onClick={handleAddFriend}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-md disabled:opacity-50"
                        >
                          {actionLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserPlus className="w-4 h-4" />
                          )}
                          <span>{getTranslation(language, "addFriend")}</span>
                        </button>
                      )}

                      {friendshipStatus === "pending_sent" && (
                        <button
                          onClick={handleCancelRequest}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-colors disabled:opacity-50"
                        >
                          <Clock className="w-4 h-4 text-amber-500" />
                          <span>{getTranslation(language, "cancelRequest")}</span>
                        </button>
                      )}

                      {friendshipStatus === "pending_received" && (
                        <button
                          onClick={handleConfirmRequest}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors shadow-md disabled:opacity-50"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>{language === "bn" ? "রিকোয়েস্ট গ্রহণ" : "Confirm"}</span>
                        </button>
                      )}

                      {friendshipStatus === "friends" && (
                        <button
                          onClick={handleUnfriend}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-950/30 dark:hover:text-red-400 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-colors border border-slate-200 dark:border-slate-700"
                        >
                          <UserCheck className="w-4 h-4 text-emerald-500" />
                          <span>{getTranslation(language, "friendsCheck")}</span>
                        </button>
                      )}

                      {/* Message Button */}
                      <button
                        onClick={() => {
                          onClose();
                          if (userId) onOpenChat?.(userId);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold text-sm transition-colors border border-indigo-200/60 dark:border-indigo-800/40"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{getTranslation(language, "message")}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Names & Bio */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {profile?.username || "User"}
                  </h2>
                  {profile?.role === "admin" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/40">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Admin
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-500" />
                    <span>
                      <strong className="text-slate-800 dark:text-slate-200">{friendsCount}</strong>{" "}
                      {language === "bn" ? "জন বন্ধু" : "friends"}
                    </span>
                  </div>
                  {profile?.last_seen && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>
                        {profile.is_online
                          ? language === "bn"
                            ? "এখন সক্রিয়"
                            : "Active now"
                          : language === "bn"
                          ? "অফলাইন"
                          : "Offline"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bio (hidden if profile is locked and viewer is stranger) */}
                {showLockedContentGating ? (
                  <p className="text-sm italic text-slate-400 dark:text-slate-500 pt-1">
                    🔒 {language === "bn" ? "প্রোফাইল লক থাকায় তথ্য সুরক্ষিত রাখা হয়েছে।" : "Profile details are protected."}
                  </p>
                ) : (
                  profile?.bio && (
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pt-1 whitespace-pre-line">
                      {profile.bio}
                    </p>
                  )
                )}
              </div>

              {/* ── Facebook-Style Locked Profile Banner ── */}
              {showLockedContentGating ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50 dark:from-slate-800/80 dark:via-slate-850 dark:to-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-center shadow-xs"
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-400 to-indigo-600 p-0.5 mx-auto mb-3 shadow-md">
                    <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                      <Lock className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                    </div>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                    {getTranslation(language, "lockedProfileTitle", {
                      name: profile?.username || "User",
                    })}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    {getTranslation(language, "lockedProfileDesc")}
                  </p>

                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100/60 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <span>
                      {language === "bn"
                        ? "পোস্ট দেখতে ফ্রেন্ড রিকোয়েস্ট পাঠান"
                        : "Send a friend request to see their posts"}
                    </span>
                  </div>
                </motion.div>
              ) : (
                /* ── User Posts Timeline ── */
                <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      <span>{language === "bn" ? "টাইমলাইন পোস্ট" : "Timeline Posts"}</span>
                      <span className="text-xs font-normal text-slate-500">
                        ({posts.length})
                      </span>
                    </h3>
                  </div>

                  {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                      <span className="text-xs">
                        {language === "bn" ? "পোস্ট লোড হচ্ছে..." : "Loading posts..."}
                      </span>
                    </div>
                  ) : posts.length === 0 ? (
                    <div className="py-12 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400 text-sm">
                      <p>{language === "bn" ? "এখনো কোনো পোস্ট নেই।" : "No posts shared yet."}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {posts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          currentUserId={currentUserId}
                          onReaction={handleReaction}
                          onShare={(p) => setSelectedPostForShare(p)}
                          onOpenComments={(p) => setSelectedPostForComments(p)}
                          onDeletePost={async (postId) => {
                            setPosts((prev) => prev.filter((p) => p.id !== postId));
                            await feedService.deletePost(postId, currentUserId);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Comments Modal if user opens comments from profile timeline */}
        <PostCommentsModal
          post={selectedPostForComments}
          isOpen={Boolean(selectedPostForComments)}
          onClose={() => setSelectedPostForComments(null)}
          currentUserId={currentUserId}
          currentUsername={currentProfile?.username || "User"}
          currentUserAvatar={currentProfile?.avatar_url}
        />

        {/* Share Modal if user shares from profile timeline */}
        <ShareModal
          post={selectedPostForShare}
          isOpen={Boolean(selectedPostForShare)}
          onClose={() => setSelectedPostForShare(null)}
          currentUserId={currentUserId}
        />
      </div>
    </AnimatePresence>
  );
};
export default UserProfileModal;

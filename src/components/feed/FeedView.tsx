import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Rss, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";
import { feedService } from "../../services/feedService";
import type { FeedPost } from "../../services/feedService";
import type { ReactionType } from "./ReactionPicker";
import { PostCard } from "./PostCard";
import { CreatePostCard } from "./CreatePostCard";
import { ShareModal } from "./ShareModal";
import { PostCommentsModal } from "./PostCommentsModal";
import { useStore } from "../../hooks/useStore";
import { getTranslation } from "../../utils/translations";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface FeedViewProps {
  currentUserId: string;
  currentUsername: string;
  currentUserAvatar?: string | null;
  isAdmin?: boolean;
}

// ---------------------------------------------------------------------------
// Filter type
// ---------------------------------------------------------------------------
type FeedFilter = "all" | "my";

// ---------------------------------------------------------------------------
// Skeleton loader card
// ---------------------------------------------------------------------------
function SkeletonCard() {
  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-full w-2/5" />
          <div className="h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-full w-1/4" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full w-full" />
        <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full w-5/6" />
        <div className="h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-full w-3/4" />
      </div>
      <div className="mt-4 h-36 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
      <div className="mt-4 flex gap-3">
        <div className="h-7 w-20 bg-slate-100 dark:bg-slate-800/60 rounded-full" />
        <div className="h-7 w-20 bg-slate-100 dark:bg-slate-800/60 rounded-full" />
        <div className="h-7 w-20 bg-slate-100 dark:bg-slate-800/60 rounded-full" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FeedView
// ---------------------------------------------------------------------------
export const FeedView: React.FC<FeedViewProps> = ({
  currentUserId,
  currentUsername,
  currentUserAvatar,
}) => {
  const { language } = useStore();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPostForShare, setSelectedPostForShare] = useState<FeedPost | null>(null);
  const [selectedPostForComments, setSelectedPostForComments] = useState<FeedPost | null>(null);

  const filterTabs: { key: FeedFilter; label: string }[] = [
    { key: "all", label: `🌐 ${getTranslation(language, "allPosts")}` },
    { key: "my", label: `👤 ${getTranslation(language, "myPosts")}` },
  ];

  // ── Data loading ────────────────────────────────────────────────────────
  const loadPosts = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setIsLoading(true);
      const { data } = await feedService.getPosts(filter, currentUserId);
      setPosts(data ?? []);
      setIsLoading(false);
      setIsRefreshing(false);
    },
    [filter, currentUserId]
  );

  useEffect(() => {
    setIsLoading(true);
    loadPosts(false);
  }, [loadPosts]);

  useEffect(() => {
    const onFeedUpdated = () => {
      loadPosts(false);
    };
    window.addEventListener("kb_feed_updated", onFeedUpdated);
    return () => window.removeEventListener("kb_feed_updated", onFeedUpdated);
  }, [loadPosts]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadPosts(false);
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleReaction = useCallback(
    async (postId: string, reactionType: ReactionType) => {
      // Optimistic update
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const reactions = { ...p.reactions };
          const previousType = p.userReaction;

          // Remove old reaction
          if (previousType && reactions[previousType]) {
            reactions[previousType] = reactions[previousType].filter(
              (r) => r.userId !== currentUserId
            );
          }

          if (previousType === reactionType) {
            // Toggle off
            return { ...p, reactions, userReaction: null };
          }

          // Add new reaction
          if (!reactions[reactionType]) reactions[reactionType] = [];
          reactions[reactionType] = [
            ...reactions[reactionType],
            {
              userId: currentUserId,
              username: currentUsername,
              reactionType,
              createdAt: new Date().toISOString(),
            },
          ];
          return { ...p, reactions, userReaction: reactionType };
        })
      );

      // Background sync
      await feedService.toggleReaction(postId, currentUserId, reactionType);
    },
    [currentUserId, currentUsername]
  );

  const handleDeletePost = useCallback(
    async (postId: string) => {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      await feedService.deletePost(postId, currentUserId);
    },
    [currentUserId]
  );

  const handlePostCreated = useCallback((newPost: FeedPost) => {
    setPosts((prev) => [newPost, ...prev]);
  }, []);

  const handleReposted = useCallback(() => {
    loadPosts(false);
  }, [loadPosts]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* ── Sticky glassmorphic header ── */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800/80 transition-colors">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
            <Rss className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>{getTranslation(language, "communityFeed")}</span>
          </h1>
          <button
            type="button"
            onClick={handleRefresh}
            className={`p-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors ${
              isRefreshing ? "animate-spin" : ""
            }`}
            aria-label="Refresh"
          >
            <RefreshCw className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex items-center gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none">
          {filterTabs.map((tab) => {
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "relative flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors duration-150 whitespace-nowrap z-10 select-none",
                  active
                    ? "text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200/80 dark:hover:bg-slate-800"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="feedFilterPill"
                    className="absolute inset-0 bg-indigo-600 rounded-full shadow-xs -z-10"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable feed body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-4">
          {/* CreatePostCard always at top */}
          <CreatePostCard
            currentUserId={currentUserId}
            currentUsername={currentUsername}
            currentUserAvatar={currentUserAvatar}
            onPostCreated={handlePostCreated}
          />

          {/* Loading skeleton */}
          {isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : posts.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-6xl mb-4 select-none">📭</span>
              <p className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
                {getTranslation(language, "noPosts")}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {filter === "my"
                  ? (language === "bn" ? "আপনি এখনো কোনো পোস্ট করেননি।" : "You haven't posted anything yet.")
                  : (language === "bn" ? "প্রথম পোস্টটি করুন!" : "Be the first to create a post!")}
              </p>
            </div>
          ) : (
            /* Post list */
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                onReaction={handleReaction}
                onShare={setSelectedPostForShare}
                onOpenComments={setSelectedPostForComments}
                onDeletePost={handleDeletePost}
              />
            ))
          )}

          {/* Bottom padding for mobile nav */}
          <div className="h-4" />
        </div>
      </div>

      {/* ── Modals ── */}
      <ShareModal
        post={selectedPostForShare}
        isOpen={selectedPostForShare !== null}
        onClose={() => setSelectedPostForShare(null)}
        currentUserId={currentUserId}
        onReposted={handleReposted}
      />
      <PostCommentsModal
        post={selectedPostForComments}
        isOpen={selectedPostForComments !== null}
        onClose={() => setSelectedPostForComments(null)}
        currentUserId={currentUserId}
        currentUsername={currentUsername}
        currentUserAvatar={currentUserAvatar}
      />
    </div>
  );
};

export default FeedView;

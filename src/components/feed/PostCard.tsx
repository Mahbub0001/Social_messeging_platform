import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Repeat2,
  MoreHorizontal,
  Trash2,
  Link2,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { FeedPost } from "../../services/feedService";
import {
  ReactionPicker,
  REACTIONS_CONFIG,
  ORDERED_REACTIONS,
} from "./ReactionPicker";
import type { ReactionType } from "./ReactionPicker";

import { useStore } from "../../hooks/useStore";
import { getTranslation, type Language } from "../../utils/translations";

// ---------------------------------------------------------------------------
// PostCard Props
// ---------------------------------------------------------------------------
export interface PostCardProps {
  post: FeedPost;
  currentUserId?: string;
  onReaction: (
    postId: string,
    reaction: ReactionType
  ) => void;
  onShare: (post: FeedPost) => void;
  onOpenComments: (post: FeedPost) => void;
  onDeletePost?: (postId: string) => void;
}

// ---------------------------------------------------------------------------
// Relative timestamp
// ---------------------------------------------------------------------------
function getRelativeTime(isoString: string, lang: Language): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 30) return getTranslation(lang, "justNow");
  if (diffMin < 60) return getTranslation(lang, "minsAgo", { n: diffMin || 1 });
  if (diffHour < 24) return getTranslation(lang, "hoursAgo", { n: diffHour });
  if (diffDay === 1) return getTranslation(lang, "yesterday");
  return new Date(isoString).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------
function UserAvatar({
  avatar,
  username,
  size = 40,
}: {
  avatar?: string | null;
  username: string;
  size?: number;
}) {
  const initials = username
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={username}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600 text-white font-semibold flex-shrink-0 select-none"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials || "?"}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rich text renderer: #hashtag and @mention
// ---------------------------------------------------------------------------
function RichText({ text }: { text: string }) {
  const parts = text.split(/(#[\p{L}\d_]+|@[\p{L}\d_.]+)/u);
  return (
    <span>
      {parts.map((part, i) => {
        if (/^#[\p{L}\d_]+$/u.test(part)) {
          return (
            <span key={i} className="text-blue-500 dark:text-blue-400 font-medium cursor-pointer hover:underline">
              {part}
            </span>
          );
        }
        if (/^@[\p{L}\d_.]+$/u.test(part)) {
          return (
            <span key={i} className="text-purple-600 dark:text-purple-400 font-medium cursor-pointer hover:underline">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------
function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(startIndex);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setCurrent((c) => (c + 1) % images.length);
      if (e.key === "ArrowLeft")
        setCurrent((c) => (c - 1 + images.length) % images.length);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [images.length, onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <button
          className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          onClick={onClose}
          aria-label="বন্ধ করুন"
        >
          <X className="w-8 h-8" />
        </button>
        <img
          src={images[current]}
          alt={`image-${current}`}
          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        {images.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrent(i);
                }}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i === current ? "bg-white" : "bg-white/40 hover:bg-white/70"
                )}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Media Grid
// ---------------------------------------------------------------------------
function MediaGrid({
  mediaUrls,
  onClickImage,
}: {
  mediaUrls: string[];
  onClickImage: (idx: number) => void;
}) {
  const count = mediaUrls.length;

  if (count === 1) {
    return (
      <div
        className="mt-3 rounded-xl overflow-hidden cursor-pointer"
        onClick={() => onClickImage(0)}
      >
        <img
          src={mediaUrls[0]}
          alt="post-media"
          className="w-full max-h-[400px] object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
        {mediaUrls.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`post-media-${i}`}
            className="w-full h-48 object-cover cursor-pointer hover:opacity-95 transition-opacity"
            loading="lazy"
            onClick={() => onClickImage(i)}
          />
        ))}
      </div>
    );
  }

  // 3+: first full width, rest in 2-col grid
  const [first, ...rest] = mediaUrls;
  return (
    <div className="mt-3 rounded-xl overflow-hidden">
      <img
        src={first}
        alt="post-media-0"
        className="w-full h-56 object-cover cursor-pointer hover:opacity-95 transition-opacity"
        loading="lazy"
        onClick={() => onClickImage(0)}
      />
      <div className={cn("grid gap-1 mt-1", rest.length >= 2 ? "grid-cols-2" : "grid-cols-1")}>
        {rest.slice(0, 3).map((url, i) => (
          <div key={i + 1} className="relative">
            <img
              src={url}
              alt={`post-media-${i + 1}`}
              className="w-full h-36 object-cover cursor-pointer hover:opacity-95 transition-opacity"
              loading="lazy"
              onClick={() => onClickImage(i + 1)}
            />
            {i === 2 && count > 4 && (
              <div
                className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer"
                onClick={() => onClickImage(i + 1)}
              >
                <span className="text-white text-xl font-bold">+{count - 4}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reaction Summary Pill
// ---------------------------------------------------------------------------
function ReactionSummaryPill({ reactions }: { reactions: Record<string, { userId: string }[]> }) {
  const totals: { type: ReactionType; count: number }[] = ORDERED_REACTIONS
    .map((type) => ({
      type,
      count: Array.isArray(reactions[type]) ? reactions[type].length : 0,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const totalCount = totals.reduce((sum, r) => sum + r.count, 0);
  if (totalCount === 0) return null;

  const top3 = totals.slice(0, 3);

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      <div className="flex -space-x-1">
        {top3.map(({ type }) => (
          <span
            key={type}
            className="w-5 h-5 rounded-full bg-white dark:bg-slate-800 shadow-2xs border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[11px] leading-none"
          >
            {REACTIONS_CONFIG[type].emoji}
          </span>
        ))}
      </div>
      <span>{totalCount}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Three-dots menu
// ---------------------------------------------------------------------------
function PostMenu({
  post,
  currentUserId,
  onDelete,
}: {
  post: FeedPost;
  currentUserId?: string;
  onDelete?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const language = useStore((s) => s.language);
  const isAuthor = post.userId === currentUserId;
  const isAdmin = post.author?.role === "admin";
  const canDelete = onDelete && (isAuthor || isAdmin);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const copyLink = () => {
    navigator.clipboard?.writeText(
      `${window.location.origin}/feed/post/${post.id}`
    ).catch(() => {});
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label={getTranslation(language, "moreOptions")}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 z-50 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 overflow-hidden"
          >
            <button
              type="button"
              onClick={copyLink}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors text-left"
            >
              <Link2 className="w-4 h-4 flex-shrink-0" />
              {getTranslation(language, "copyLink")}
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete?.(post.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
              >
                <Trash2 className="w-4 h-4 flex-shrink-0" />
                {getTranslation(language, "deletePost")}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PostCard component
// ---------------------------------------------------------------------------
export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  onReaction,
  onShare,
  onOpenComments,
  onDeletePost,
}) => {
  const { language, currentProfile } = useStore();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Compute total reactions count & userReaction
  const totalReactions = Object.values(post.reactions ?? {}).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
    0
  );

  const handleSelectReaction = useCallback(
    (type: ReactionType) => {
      onReaction(post.id, type);
    },
    [post.id, onReaction]
  );

  const handleToggleDefault = useCallback(() => {
    // Toggle "like" as default quick reaction
    onReaction(post.id, "like");
  }, [post.id, onReaction]);

  // If this is a repost wrapping a real post, render inner post content
  const displayPost = post.repostedFrom ?? post;
  const isRepost = Boolean(post.repostedFrom);

  const isCurrentAuthor = displayPost.userId === currentUserId;
  const authorAvatar = (isCurrentAuthor && currentProfile?.avatar_url)
    ? currentProfile.avatar_url
    : displayPost.author.avatar_url;
  const authorUsername = (isCurrentAuthor && currentProfile?.username)
    ? currentProfile.username
    : displayPost.author.username;

  const isCurrentReposter = post.userId === currentUserId;
  const reposterUsername = (isCurrentReposter && currentProfile?.username)
    ? currentProfile.username
    : post.author.username;

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 24, stiffness: 260 }}
        className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm overflow-hidden transition-colors"
      >
        {/* Repost header */}
        {isRepost && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-0 text-xs text-slate-500 dark:text-slate-400">
            <Repeat2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {reposterUsername}
              </span>{" "}
              {getTranslation(language, "reposted")}
            </span>
          </div>
        )}

        <div className="p-4">
          {/* Author row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <UserAvatar
                avatar={authorAvatar}
                username={authorUsername}
                size={40}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                    {authorUsername}
                  </span>
                  {displayPost.author.role === "admin" && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
                      title="Admin"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {getRelativeTime(displayPost.createdAt, language)}
                </p>
              </div>
            </div>

            {/* Three-dots menu */}
            <PostMenu
              post={post}
              currentUserId={currentUserId}
              onDelete={onDeletePost}
            />
          </div>

          {/* Post content */}
          {displayPost.content && (
            <p className="mt-3 text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
              <RichText text={displayPost.content} />
            </p>
          )}

          {/* Media */}
          {displayPost.mediaType === "image" &&
            displayPost.mediaUrls.length > 0 && (
              <MediaGrid
                mediaUrls={displayPost.mediaUrls}
                onClickImage={(idx) => setLightboxIndex(idx)}
              />
            )}

          {displayPost.mediaType === "video" &&
            displayPost.mediaUrls.length > 0 && (
              <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                <video
                  src={displayPost.mediaUrls[0]}
                  controls
                  className="w-full max-h-[360px] object-contain bg-black"
                  poster={undefined}
                />
              </div>
            )}

          {/* Reaction summary + comment count */}
          {(totalReactions > 0 || post.commentsCount > 0) && (
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <ReactionSummaryPill reactions={post.reactions ?? {}} />
              {post.commentsCount > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenComments(post)}
                  className="hover:underline transition-colors"
                >
                  {post.commentsCount} {getTranslation(language, "comments")}
                </button>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="mt-3 border-t border-slate-100 dark:border-slate-800" />

          {/* Action bar */}
          <div className="mt-2 flex items-center justify-between gap-1 flex-wrap">
            {/* Reaction picker */}
            <ReactionPicker
              currentReaction={post.userReaction ?? null}
              onSelectReaction={handleSelectReaction}
              onToggleDefault={handleToggleDefault}
              activeCount={totalReactions > 0 ? totalReactions : undefined}
            />

            {/* Comment */}
            <button
              type="button"
              onClick={() => onOpenComments(post)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all duration-150 active:scale-95"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{getTranslation(language, "comments")}</span>
              {post.commentsCount > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {post.commentsCount}
                </span>
              )}
            </button>

            {/* Share / Repost */}
            <button
              type="button"
              onClick={() => onShare(post)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all duration-150 active:scale-95"
            >
              <Repeat2 className="w-4 h-4" />
              <span className="hidden sm:inline">{getTranslation(language, "share")}</span>
              {post.sharesCount > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {post.sharesCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </motion.article>

      {/* Lightbox */}
      {lightboxIndex !== null && displayPost.mediaType === "image" && (
        <Lightbox
          images={displayPost.mediaUrls}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
};

export default PostCard;

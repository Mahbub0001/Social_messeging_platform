import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { feedService } from "../../services/feedService";
import type { FeedPost, FeedComment } from "../../services/feedService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface PostCommentsModalProps {
  post: FeedPost | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUsername: string;
  currentUserAvatar?: string | null;
}

import { useStore } from "../../hooks/useStore";
import { getTranslation, type Language } from "../../utils/translations";

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
// Avatar helper
// ---------------------------------------------------------------------------
function UserAvatar({
  avatar,
  username,
  size = 36,
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
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || "?"}
    </div>
  );
}

// ---------------------------------------------------------------------------
function CommentItem({ comment }: { comment: FeedComment }) {
  const { language } = useStore();
  return (
    <div className="flex items-start gap-3 py-3">
      <UserAvatar
        avatar={comment.author.avatar_url}
        username={comment.author.username}
        size={34}
      />
      <div className="flex-1 min-w-0">
        <div className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl rounded-tl-sm px-3 py-2">
          <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 mb-0.5">
            {comment.author.username}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-1">
          {getRelativeTime(comment.createdAt, language)}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PostCommentsModal
// ---------------------------------------------------------------------------
export const PostCommentsModal: React.FC<PostCommentsModalProps> = ({
  post,
  isOpen,
  onClose,
  currentUserId,
  currentUsername,
  currentUserAvatar,
}) => {
  const { language } = useStore();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const commentsBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load comments when modal opens
  useEffect(() => {
    if (!isOpen || !post) return;
    setComments([]);
    setIsLoadingComments(true);
    feedService.getComments(post.id).then(({ data }) => {
      setComments(data ?? []);
      setIsLoadingComments(false);
    });
  }, [isOpen, post]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setCommentText("");
        setComments([]);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Auto-scroll to bottom when comments change
  useEffect(() => {
    if (comments.length > 0) {
      commentsBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments]);

  // Auto-resize textarea (max 3 rows)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const maxHeight = lineHeight * 3 + 8;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [commentText]);

  const handleSubmit = useCallback(async () => {
    if (!post || !commentText.trim() || isSubmitting) return;
    const content = commentText.trim();
    setIsSubmitting(true);

    // Optimistic UI
    const optimistic: FeedComment = {
      id: "optimistic-" + Date.now(),
      postId: post.id,
      userId: currentUserId,
      author: {
        id: currentUserId,
        username: currentUsername,
        avatar_url: currentUserAvatar ?? null,
      },
      content,
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, optimistic]);
    setCommentText("");

    const { data: saved, error } = await feedService.addComment(
      post.id,
      currentUserId,
      content
    );
    setIsSubmitting(false);

    if (!error && saved) {
      setComments((prev) =>
        prev.map((c) => (c.id === optimistic.id ? saved : c))
      );
    } else {
      // Rollback on failure
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
    }
  }, [post, commentText, isSubmitting, currentUserId, currentUsername, currentUserAvatar]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = commentText.trim().length > 0 && !isSubmitting;

  if (!post) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="comments-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="comments-panel"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className={cn(
              "fixed z-[101] bg-white dark:bg-gray-900 flex flex-col shadow-2xl",
              "bottom-0 left-0 right-0 rounded-t-2xl max-h-[85vh]",
              "md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
              "md:rounded-2xl md:w-full md:max-w-lg md:max-h-[85vh]"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                {getTranslation(language, "comments")}
                {comments.length > 0 && (
                  <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-full">
                    {comments.length}
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Comment list (scrollable) */}
            <div className="flex-1 overflow-y-auto px-4 py-1">
              {isLoadingComments ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="text-4xl mb-3">💬</span>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {getTranslation(language, "noComments")}
                  </p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {comments.map((comment) => (
                      <CommentItem key={comment.id} comment={comment} />
                    ))}
                  </div>
                  <div ref={commentsBottomRef} className="h-2" />
                </>
              )}
            </div>

            {/* Sticky comment input */}
            <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800 px-3 py-3 bg-white dark:bg-slate-900">
              <div className="flex items-end gap-2">
                <UserAvatar
                  avatar={currentUserAvatar}
                  username={currentUsername}
                  size={32}
                />
                <div className="flex-1 flex items-end gap-2 bg-slate-100 dark:bg-slate-800/60 rounded-2xl px-3 py-2 border border-slate-200 dark:border-slate-700/60">
                  <textarea
                    ref={textareaRef}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={getTranslation(language, "writeComment")}
                    rows={1}
                    disabled={isSubmitting}
                    className="flex-1 resize-none bg-transparent outline-none text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 leading-relaxed overflow-hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-150",
                    canSubmit
                      ? "bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-sm"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                  )}
                  aria-label={getTranslation(language, "sendComment")}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PostCommentsModal;

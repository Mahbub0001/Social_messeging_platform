import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Repeat2, MessageCircle, Link2, Loader2, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { feedService } from "../../services/feedService";
import type { FeedPost } from "../../services/feedService";
import { chatService } from "../../services/chatService";
import type { ConversationWithDetails } from "../../services/chatService";
import { useStore } from "../../hooks/useStore";
import { getTranslation } from "../../utils/translations";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ShareModalProps {
  post: FeedPost | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onReposted?: () => void;
}

// ---------------------------------------------------------------------------
// Avatar helper
// ---------------------------------------------------------------------------
function UserAvatar({
  avatar,
  username,
  size = 32,
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
// Conversation display name helpers
// ---------------------------------------------------------------------------
function conversationDisplayName(
  conv: ConversationWithDetails,
  currentUserId: string,
  lang: "bn" | "en" = "bn"
): string {
  if (conv.is_group) return conv.name ?? (lang === "bn" ? "গ্রুপ" : "Group");
  const other = (conv.members ?? []).find((m) => m.id !== currentUserId);
  return other?.username ?? conv.name ?? (lang === "bn" ? "কথোপকথন" : "Conversation");
}

function conversationAvatar(
  conv: ConversationWithDetails,
  currentUserId: string
): string | null {
  if (conv.is_group) return conv.avatar_url ?? null;
  const other = (conv.members ?? []).find((m) => m.id !== currentUserId);
  return other?.avatar_url ?? null;
}

// ---------------------------------------------------------------------------
// ShareModal
// ---------------------------------------------------------------------------
export const ShareModal: React.FC<ShareModalProps> = ({
  post,
  isOpen,
  onClose,
  currentUserId,
  onReposted,
}) => {
  const language = useStore((s) => s.language);
  const [repostLoading, setRepostLoading] = useState(false);
  const [repostSuccess, setRepostSuccess] = useState(false);
  const [repostError, setRepostError] = useState<string | null>(null);

  const [chatExpanded, setChatExpanded] = useState(false);
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [convsLoading, setConvsLoading] = useState(false);
  const [sentToConvId, setSentToConvId] = useState<string | null>(null);

  const [linkCopied, setLinkCopied] = useState(false);

  const storeConversations = useStore((s) => s.conversations);

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setRepostLoading(false);
        setRepostSuccess(false);
        setRepostError(null);
        setChatExpanded(false);
        setSentToConvId(null);
        setLinkCopied(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!chatExpanded) return;
    if (storeConversations.length > 0) {
      setConversations(storeConversations);
      return;
    }
    setConvsLoading(true);
    chatService.getConversations(currentUserId).then(({ data }) => {
      setConversations(data ?? []);
      setConvsLoading(false);
    });
  }, [chatExpanded, currentUserId, storeConversations]);

  if (!post) return null;

  const handleRepost = async () => {
    if (repostLoading || repostSuccess) return;
    setRepostLoading(true);
    setRepostError(null);
    const { error } = await feedService.repost(post.id, currentUserId);
    setRepostLoading(false);
    if (error) {
      setRepostError(getTranslation(language, "repostFailed"));
    } else {
      setRepostSuccess(true);
      onReposted?.();
      setTimeout(onClose, 1000);
    }
  };

  const handleSendToChat = async (conv: ConversationWithDetails) => {
    if (sentToConvId) return;
    const link = `${window.location.origin}/feed/${post.id}`;
    const displayPost = post.repostedFrom ?? post;
    const preview = `🔗 ${getTranslation(language, "postSharedLink")}: "${displayPost.content?.slice(0, 80) ?? ""}"\n${link}`;
    await chatService.sendMessage(conv.id, currentUserId, preview);
    setSentToConvId(conv.id);
  };

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/feed/${post.id}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const displayPost = post.repostedFrom ?? post;
  const previewContent = displayPost.content?.slice(0, 60) ?? "";
  const hasMoreContent = (displayPost.content?.length ?? 0) > 60;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="share-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="share-panel"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className={cn(
              "fixed z-[101] bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl",
              "bottom-0 left-0 right-0 max-h-[90vh] overflow-y-auto",
              "md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
              "md:rounded-2xl md:w-full md:max-w-md md:max-h-[85vh]"
            )}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                {getTranslation(language, "sharePostTitle")}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label={getTranslation(language, "close")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 py-3 space-y-2">
              {/* Post preview */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/60">
                <UserAvatar
                  avatar={displayPost.author.avatar_url}
                  username={displayPost.author.username}
                  size={36}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-xs text-gray-800 dark:text-gray-200 truncate">
                    {displayPost.author.username}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    {previewContent}
                    {hasMoreContent && "…"}
                  </p>
                </div>
              </div>

              {/* Option 1: Repost */}
              <div className="rounded-xl border border-gray-100 dark:border-gray-700/60 overflow-hidden">
                <button
                  type="button"
                  onClick={handleRepost}
                  disabled={repostLoading || repostSuccess}
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-4 text-left transition-colors",
                    repostSuccess
                      ? "bg-green-50 dark:bg-green-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-800"
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      repostSuccess
                        ? "bg-green-100 dark:bg-green-900/40"
                        : "bg-indigo-100 dark:bg-indigo-900/40"
                    )}
                  >
                    {repostLoading ? (
                      <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                    ) : repostSuccess ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Repeat2 className="w-5 h-5 text-indigo-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "font-semibold text-sm",
                        repostSuccess
                          ? "text-green-600 dark:text-green-400"
                          : "text-gray-800 dark:text-gray-200"
                      )}
                    >
                      {repostSuccess ? getTranslation(language, "reposted") : `🔄 ${getTranslation(language, "repostToFeed")}`}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {repostSuccess ? "" : getTranslation(language, "repostFeedDesc")}
                    </p>
                  </div>
                </button>
                <AnimatePresence>
                  {repostError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-4 pb-3"
                    >
                      <p className="text-xs text-red-600 dark:text-red-400">{repostError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Option 2: Send to Chat */}
              <div className="rounded-xl border border-gray-100 dark:border-gray-700/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setChatExpanded((v) => !v)}
                  className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-800 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-5 h-5 text-violet-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                      💬 {getTranslation(language, "sendToChat")}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {getTranslation(language, "sendToChatDesc")}
                    </p>
                  </div>
                  <motion.span
                    animate={{ rotate: chatExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-gray-400 flex-shrink-0 text-lg leading-none"
                  >
                    ▾
                  </motion.span>
                </button>

                <AnimatePresence>
                  {chatExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-gray-100 dark:border-gray-700/60"
                    >
                      {convsLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                      ) : conversations.length === 0 ? (
                        <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-4">
                          {getTranslation(language, "noConversationsFound")}
                        </p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                          {conversations.map((conv) => {
                            const name = conversationDisplayName(conv, currentUserId, language);
                            const avatar = conversationAvatar(conv, currentUserId);
                            const sent = sentToConvId === conv.id;
                            return (
                              <button
                                key={conv.id}
                                type="button"
                                onClick={() => handleSendToChat(conv)}
                                disabled={!!sentToConvId}
                                className={cn(
                                  "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                                  sent
                                    ? "bg-green-50 dark:bg-green-900/20"
                                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                )}
                              >
                                <UserAvatar avatar={avatar} username={name} size={32} />
                                <span
                                  className={cn(
                                    "text-sm font-medium flex-1 truncate",
                                    sent
                                      ? "text-green-600 dark:text-green-400"
                                      : "text-gray-800 dark:text-gray-200"
                                  )}
                                >
                                  {sent ? getTranslation(language, "sentCheck") : name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Option 3: Copy Link */}
              <div className="rounded-xl border border-gray-100 dark:border-gray-700/60 overflow-hidden">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-4 text-left transition-colors",
                    linkCopied
                      ? "bg-green-50 dark:bg-green-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-800"
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      linkCopied
                        ? "bg-green-100 dark:bg-green-900/40"
                        : "bg-teal-100 dark:bg-teal-900/40"
                    )}
                  >
                    {linkCopied ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Link2 className="w-5 h-5 text-teal-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "font-semibold text-sm",
                        linkCopied
                          ? "text-green-600 dark:text-green-400"
                          : "text-gray-800 dark:text-gray-200"
                      )}
                    >
                      {linkCopied ? getTranslation(language, "linkCopied") : `🔗 ${getTranslation(language, "copyLink")}`}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {linkCopied ? "" : getTranslation(language, "copyLinkDesc")}
                    </p>
                  </div>
                </button>
              </div>

              <div className="h-3 md:hidden" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ShareModal;

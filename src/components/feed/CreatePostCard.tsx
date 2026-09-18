import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import type { ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Image, Video, Smile, X, Loader2, Send } from "lucide-react";
import { cn } from "../../lib/utils";
import { feedService } from "../../services/feedService";
import type { FeedPost } from "../../services/feedService";
import { storageService } from "../../services/storageService";

import { useStore } from "../../hooks/useStore";
import { getTranslation } from "../../utils/translations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CreatePostCardProps {
  currentUserId: string;
  currentUserAvatar?: string | null;
  currentUsername: string;
  onPostCreated: (newPost: FeedPost) => void;
}

// ---------------------------------------------------------------------------
// Common emoji set
// ---------------------------------------------------------------------------
const COMMON_EMOJIS = [
  "😀","😂","😍","🥰","😎","😢","😡","😮","🤔","🙏",
  "👍","👏","🔥","❤️","💯","🎉","🌟","✨","💪","🤣",
  "😊","😭","😤","🥺","🤩","😴","🤯","😈","👻","🎊",
  "🍕","☕","🎵","🚀","💻","📱","🌙","☀️","🌈","💎",
];

// ---------------------------------------------------------------------------
// Avatar helper
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
// Component
// ---------------------------------------------------------------------------
export const CreatePostCard: React.FC<CreatePostCardProps> = ({
  currentUserId,
  currentUserAvatar,
  currentUsername,
  onPostCreated,
}) => {
  const { language } = useStore();
  const [content, setContent] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);

  const MAX_CHARS = 500;
  const charCount = content.length;
  const isOverLimit = charCount > MAX_CHARS;
  const hasContent =
    content.trim().length > 0 || imageFiles.length > 0 || videoFile !== null;
  const isDisabled = !hasContent || isUploading || isOverLimit;

  // Close emoji picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker)
      document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
      if (videoPreview && videoPreview.startsWith("blob:"))
        URL.revokeObjectURL(videoPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Image handler
  // ---------------------------------------------------------------------------
  const handleImageChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;

      if (videoFile) {
        if (videoPreview && videoPreview.startsWith("blob:"))
          URL.revokeObjectURL(videoPreview);
        setVideoFile(null);
        setVideoPreview(null);
      }

      setImageFiles((prev) => [...prev, ...files].slice(0, 4));
      setImagePreviews((prev) => {
        const newPreviews = files.map((f) => URL.createObjectURL(f));
        return [...prev, ...newPreviews].slice(0, 4);
      });
      e.target.value = "";
    },
    [videoFile, videoPreview]
  );

  const removeImage = useCallback((idx: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => {
      const url = prev[idx];
      if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Video handler
  // ---------------------------------------------------------------------------
  const handleVideoChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      imagePreviews.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
      setImageFiles([]);
      setImagePreviews([]);

      if (videoPreview && videoPreview.startsWith("blob:"))
        URL.revokeObjectURL(videoPreview);
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      e.target.value = "";
    },
    [imagePreviews, videoPreview]
  );

  const removeVideo = useCallback(() => {
    if (videoPreview && videoPreview.startsWith("blob:"))
      URL.revokeObjectURL(videoPreview);
    setVideoFile(null);
    setVideoPreview(null);
  }, [videoPreview]);

  // ---------------------------------------------------------------------------
  // Emoji insertion
  // ---------------------------------------------------------------------------
  const insertEmoji = useCallback(
    (emoji: string) => {
      const ta = textareaRef.current;
      if (!ta) {
        setContent((c) => c + emoji);
        return;
      }
      const start = ta.selectionStart ?? content.length;
      const end = ta.selectionEnd ?? content.length;
      const next = content.slice(0, start) + emoji + content.slice(end);
      setContent(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + emoji.length;
        ta.focus();
      });
    },
    [content]
  );

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  const handleSubmit = useCallback(async () => {
    if (isDisabled) return;
    setErrorMsg(null);
    setIsUploading(true);

    try {
      let mediaUrls: string[] = [];
      let mediaType: "none" | "image" | "video" = "none";

      if (imageFiles.length > 0) {
        const uploads = await Promise.all(
          imageFiles.map((f) => storageService.uploadMedia(f, "chat-media"))
        );
        mediaUrls = uploads;
        mediaType = "image";
      } else if (videoFile) {
        const url = await storageService.uploadMedia(videoFile, "chat-media");
        mediaUrls = [url];
        mediaType = "video";
      }

      const { data: newPost, error } = await feedService.createPost({
        userId: currentUserId,
        content: content.trim(),
        mediaUrls,
        mediaType,
      });

      if (error || !newPost) {
        throw new Error(
          (error as Error)?.message ?? "পোস্ট তৈরি করতে ব্যর্থ হয়েছে।"
        );
      }

      // Reset
      setContent("");
      setImageFiles([]);
      imagePreviews.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
      setImagePreviews([]);
      if (videoPreview && videoPreview.startsWith("blob:"))
        URL.revokeObjectURL(videoPreview);
      setVideoFile(null);
      setVideoPreview(null);
      setShowEmojiPicker(false);

      onPostCreated(newPost);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "একটি ত্রুটি ঘটেছে।";
      setErrorMsg(msg);
    } finally {
      setIsUploading(false);
    }
  }, [
    isDisabled,
    imageFiles,
    videoFile,
    content,
    currentUserId,
    imagePreviews,
    videoPreview,
    onPostCreated,
  ]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 24, stiffness: 300 }}
      className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-visible"
    >
      <div className="p-4">
        {/* Top row: avatar + textarea */}
        <div className="flex gap-3 items-start">
          <UserAvatar
            avatar={currentUserAvatar}
            username={currentUsername}
            size={40}
          />
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={getTranslation(language, "createPostPlaceholder", { name: currentUsername })}
              rows={2}
              className={cn(
                "w-full resize-none bg-transparent outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm leading-relaxed overflow-hidden",
                isOverLimit && "text-red-500 dark:text-red-400"
              )}
              style={{ minHeight: 56 }}
              disabled={isUploading}
            />
          </div>
        </div>

        {/* Image preview grid */}
        <AnimatePresence>
          {imagePreviews.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex flex-wrap gap-2"
            >
              {imagePreviews.map((src, idx) => (
                <div
                  key={idx}
                  className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0"
                  style={{ width: 80, height: 80 }}
                >
                  <img
                    src={src}
                    alt={`preview-${idx}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                    aria-label="ছবি সরান"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video preview */}
        <AnimatePresence>
          {videoPreview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
            >
              <video
                src={videoPreview}
                controls
                className="w-full max-h-60 object-contain bg-black"
              />
              <button
                type="button"
                onClick={removeVideo}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                aria-label="ভিডিও সরান"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error toast */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs"
            >
              <X className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span className="flex-1">{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Divider */}
        <div className="mt-3 border-t border-slate-100 dark:border-slate-800" />

        {/* Bottom toolbar */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {/* Image */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageChange}
            disabled={isUploading}
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isUploading || videoFile !== null}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              videoFile !== null
                ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
            )}
            title="ছবি যোগ করুন"
          >
            <Image className="w-4 h-4" />
            <span className="hidden sm:inline">ছবি</span>
          </button>

          {/* Video */}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleVideoChange}
            disabled={isUploading}
          />
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            disabled={isUploading || imageFiles.length > 0}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              imageFiles.length > 0
                ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                : "text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30"
            )}
            title="ভিডিও যোগ করুন"
          >
            <Video className="w-4 h-4" />
            <span className="hidden sm:inline">ভিডিও</span>
          </button>

          {/* Emoji */}
          <div className="relative" ref={emojiPickerRef}>
            <button
              type="button"
              onClick={() => setShowEmojiPicker((v) => !v)}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
              title="ইমোজি"
            >
              <Smile className="w-4 h-4" />
              <span className="hidden sm:inline">ইমোজি</span>
            </button>

            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 4 }}
                  transition={{ type: "spring", damping: 22, stiffness: 380 }}
                  className="absolute left-0 bottom-full mb-2 z-50 w-64 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700"
                >
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 px-1 mb-1.5 font-medium">
                    ইমোজি বেছে নিন
                  </p>
                  <div className="grid grid-cols-8 gap-1">
                    {COMMON_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          insertEmoji(emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="text-xl leading-none p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center"
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Char count */}
          <span
            className={cn(
              "text-xs tabular-nums transition-colors",
              charCount === 0
                ? "text-transparent select-none"
                : charCount > 450
                ? "text-red-500 dark:text-red-400 font-semibold"
                : "text-slate-400 dark:text-slate-500"
            )}
          >
            {charCount}/{MAX_CHARS}
          </span>

          {/* Post button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isDisabled}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-violet-500/50",
              isDisabled
                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                : "bg-violet-600 hover:bg-violet-700 active:scale-95 text-white shadow-sm"
            )}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{getTranslation(language, "posting")}</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>{getTranslation(language, "post")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default CreatePostCard;


import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { X, Eye, Trash2, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../hooks/useStore";
import { storyService } from "../services/storyService";
import type { StoryWithDetails, StoryView } from "../services/storyService";
import { sanitizeUrl } from "../utils/security";

interface StoryViewerProps {
  stories: StoryWithDetails[];
  initialIndex: number;
  onClose: () => void;
}

const STORY_DURATION = 7000;
const TICK = 50;
const REACTION_EMOJIS = ["❤️", "🔥", "😂", "😮", "😢", "👏"];

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return "";
  const diff = Math.max(0, Date.now() - new Date(dateString).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface FloatingParticle {
  id: number;
  emoji: string;
  x: number;
  delay: number;
  scale: number;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({
  stories: initialStories,
  initialIndex,
  onClose,
}) => {
  const user = useStore((state) => state.user);
  const [storyList, setStoryList] = useState<StoryWithDetails[]>(initialStories);
  const [currentIdx, setCurrentIdx] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isHolding, setIsHolding] = useState(false);

  // Viewers modal state
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [viewers, setViewers] = useState<StoryView[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [selectedReactionFilter, setSelectedReactionFilter] = useState<string>("all");

  // Reaction state for viewing others' stories
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [floatingParticles, setFloatingParticles] = useState<FloatingParticle[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const holdTimeoutRef = useRef<number | null>(null);

  // Update story list if props change
  useEffect(() => {
    setStoryList(initialStories);
  }, [initialStories]);

  const currentStory = storyList[currentIdx];
  const currentUser = currentStory?.user;
  const isOwnStory = !!user && currentStory?.user_id === user.id;

  // Record view only if viewing another user's story
  useEffect(() => {
    if (currentStory && user && currentStory.user_id !== user.id) {
      storyService.recordStoryView(currentStory.id, user.id);
    }
  }, [currentStory?.id, user?.id]);

  // Load viewers if own story
  const loadViewers = useCallback(
    async (storyId: string) => {
      if (!user) return;
      setLoadingViewers(true);
      try {
        const { data } = await storyService.getStoryViewers(storyId, user.id);
        setViewers(data || []);
      } catch (err) {
        console.error("Error loading viewers:", err);
      } finally {
        setLoadingViewers(false);
      }
    },
    [user?.id]
  );

  // Fetch viewers or reaction when active story changes
  useEffect(() => {
    if (!currentStory || !user) return;

    if (isOwnStory) {
      loadViewers(currentStory.id);
      setUserReaction(null);
    } else {
      setViewers([]);
      storyService.getMyReaction(currentStory.id, user.id).then(({ data }) => {
        setUserReaction(data || null);
      });
    }
  }, [currentStory?.id, isOwnStory, user?.id, loadViewers]);

  const goNext = useCallback(() => {
    if (currentIdx < storyList.length - 1) {
      setCurrentIdx((p) => p + 1);
    } else {
      onClose();
    }
  }, [currentIdx, storyList.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIdx > 0) {
      setCurrentIdx((p) => p - 1);
    }
  }, [currentIdx]);

  useEffect(() => {
    setProgress(0);
    setPaused(false);
    setIsHolding(false);
    setShowViewersModal(false);
    setSelectedReactionFilter("all");
  }, [currentIdx]);

  // Main progress timer
  const isActuallyPaused = paused || isHolding || showViewersModal;

  useEffect(() => {
    if (currentStory?.media_type === "video") return;
    if (isActuallyPaused) return;

    timerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev + (TICK / STORY_DURATION) * 100;
        if (next >= 100) {
          if (timerRef.current) clearInterval(timerRef.current);
          goNext();
          return 100;
        }
        return next;
      });
    }, TICK);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIdx, isActuallyPaused, currentStory?.media_type, goNext]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showViewersModal) {
        if (e.key === "Escape") setShowViewersModal(false);
        return;
      }
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose, showViewersModal]);

  if (!currentStory) return null;

  // Reaction action
  const handleReact = async (emoji: string) => {
    if (!user || !currentStory || isOwnStory) return;

    // Spawn floating particle burst
    const newParticles: FloatingParticle[] = Array.from({ length: 6 }).map((_, i) => ({
      id: Date.now() + i + Math.random(),
      emoji,
      x: (Math.random() - 0.5) * 140,
      delay: i * 60,
      scale: 0.8 + Math.random() * 0.5,
    }));
    setFloatingParticles((prev) => [...prev, ...newParticles]);

    setUserReaction(emoji);
    await storyService.reactToStory(currentStory.id, user.id, emoji);

    setTimeout(() => {
      setFloatingParticles((prev) =>
        prev.filter((p) => !newParticles.some((np) => np.id === p.id))
      );
    }, 1600);
  };

  // Delete own story
  const handleDeleteCurrentStory = async () => {
    if (!user || !currentStory || !isOwnStory) return;
    setPaused(true);
    const confirmed = window.confirm("Are you sure you want to delete this story?");
    if (!confirmed) {
      setPaused(false);
      return;
    }

    try {
      const { error } = await storyService.deleteStory(currentStory.id, user.id);
      if (error) {
        alert("Failed to delete story.");
        setPaused(false);
        return;
      }

      useStore.getState().fetchActiveStories();

      const remaining = storyList.filter((s) => s.id !== currentStory.id);
      if (remaining.length === 0) {
        onClose();
      } else {
        setStoryList(remaining);
        if (currentIdx >= remaining.length) {
          setCurrentIdx(remaining.length - 1);
        }
        setProgress(0);
        setPaused(false);
      }
    } catch (err) {
      console.error("Error deleting story:", err);
      setPaused(false);
    }
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;

    // Hold to pause gesture
    holdTimeoutRef.current = window.setTimeout(() => {
      setIsHolding(true);
    }, 200);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
    }
    setIsHolding(false);

    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;

    // Swipe down to close
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) {
      onClose();
      return;
    }

    // Swipe up to view viewers (own story)
    if (dy < -70 && Math.abs(dy) > Math.abs(dx)) {
      if (isOwnStory) {
        setShowViewersModal(true);
        loadViewers(currentStory.id);
      }
      return;
    }

    // Horizontal swipe
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) goPrev();
      else goNext();
    }
  };

  const handleVideoEnded = () => goNext();

  const togglePause = () => {
    if (showViewersModal) return;
    if (currentStory.media_type === "video") {
      const v = videoRef.current;
      if (!v) return;
      v.paused ? v.play() : v.pause();
      setPaused(!v.paused);
    } else {
      setPaused((p) => !p);
    }
  };

  const onTap = (side: "left" | "right") => {
    if (isHolding || showViewersModal) return;
    if (side === "left") goPrev();
    else goNext();
  };

  // Reaction statistics for viewers
  const reactionSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    viewers.forEach((v) => {
      if (v.reaction) {
        counts[v.reaction] = (counts[v.reaction] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([emoji, count]) => ({ emoji, count }));
  }, [viewers]);

  const topReactions = useMemo(() => {
    return reactionSummary.slice(0, 3).map((r) => r.emoji);
  }, [reactionSummary]);

  const filteredViewers = useMemo(() => {
    if (selectedReactionFilter === "all") return viewers;
    return viewers.filter((v) => v.reaction === selectedReactionFilter);
  }, [viewers, selectedReactionFilter]);

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col select-none overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 1. Top progress bar row */}
      <div className="absolute top-0 left-0 right-0 z-40 flex gap-1.5 px-3 pt-3">
        {storyList.map((_, i) => (
          <div key={i} className="flex-1 h-[3px] bg-white/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-75 ease-linear"
              style={{
                width: i < currentIdx ? "100%" : i === currentIdx ? `${progress}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* 2. Top bar: Avatar + Username + Time + Close */}
      <div className="absolute top-4 left-0 right-0 z-30 flex items-center justify-between px-4 pt-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-white/30 flex-shrink-0 bg-slate-800">
            <img
              src={
                sanitizeUrl(currentUser?.avatar_url || "") ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                  currentUser?.username || "user"
                )}`
              }
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white text-sm font-semibold truncate leading-tight">
                {currentUser?.username || (isOwnStory ? "Your Story" : "User")}
              </p>
              {isOwnStory && (
                <span className="text-[10px] bg-violet-500/30 text-violet-300 border border-violet-400/40 rounded-full px-1.5 py-0.2 font-medium">
                  You
                </span>
              )}
            </div>
            <p className="text-white/60 text-[11px] leading-tight">
              {new Date(currentStory.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-white/20 text-white/90 hover:text-white transition-colors"
          title="Close story"
        >
          <X size={20} />
        </button>
      </div>

      {/* 3. Tap navigation zones (left 35%, right 65%) */}
      <div className="flex-1 flex z-20 mt-16 mb-24">
        <button
          type="button"
          onClick={() => onTap("left")}
          className="w-[35%] h-full cursor-default focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onTap("right")}
          className="w-[65%] h-full cursor-default focus:outline-none"
        />
      </div>

      {/* 4. Media Content */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        onClick={togglePause}
      >
        <div className="pointer-events-auto max-w-lg w-full px-2">
          {currentStory.media_type === "image" ? (
            <div className="relative">
              <img
                src={sanitizeUrl(currentStory.media_url)}
                alt=""
                className="w-full max-h-[75vh] object-contain rounded-xl select-none shadow-2xl"
              />
              {isActuallyPaused && !showViewersModal && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                  <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg">
                    <div className="w-0 h-0 border-l-[18px] border-t-[11px] border-b-[11px] border-l-white border-t-transparent border-b-transparent ml-1" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <video
              ref={videoRef}
              src={sanitizeUrl(currentStory.media_url)}
              className="w-full max-h-[75vh] object-contain rounded-xl select-none shadow-2xl"
              autoPlay
              playsInline
              onEnded={handleVideoEnded}
            />
          )}

          {currentStory.caption && (
            <div className="mt-3 px-4">
              <p className="text-white text-sm text-center drop-shadow-md bg-black/50 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/10">
                {currentStory.caption}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 5. Floating Reaction Particles Burst */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
        <AnimatePresence>
          {floatingParticles.map((p) => (
            <motion.div
              key={p.id}
              initial={{
                opacity: 1,
                scale: p.scale * 0.7,
                x: `calc(50% + ${p.x}px)`,
                bottom: 70,
              }}
              animate={{
                opacity: [1, 1, 0],
                scale: [p.scale * 0.7, p.scale * 1.3, p.scale * 1.6],
                y: -360,
                x: `calc(50% + ${p.x + (Math.random() * 30 - 15)}px)`,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 1.3,
                ease: "easeOut",
                delay: p.delay / 1000,
              }}
              className="absolute text-4xl select-none"
            >
              {p.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 6. Bottom Controls */}
      {isOwnStory ? (
        /* OWNER CONTROLS: Seen by count pill + Swipe up hint + Delete button */
        <div className="absolute bottom-5 left-0 right-0 z-40 px-4 flex items-center justify-between max-w-md mx-auto pointer-events-auto">
          {/* Seen By Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowViewersModal(true);
              loadViewers(currentStory.id);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-black/60 hover:bg-black/80 backdrop-blur-xl rounded-full border border-white/20 text-white text-xs font-semibold shadow-xl transition-all duration-200 active:scale-95 group"
          >
            <Eye size={15} className="text-violet-400 group-hover:text-violet-300" />
            <span>{viewers.length > 0 ? `Seen by ${viewers.length}` : "Seen by 0"}</span>
            {topReactions.length > 0 && (
              <div className="flex items-center -space-x-1 ml-1 pl-1.5 border-l border-white/20">
                {topReactions.map((r, i) => (
                  <span key={i} className="text-sm drop-shadow">
                    {r}
                  </span>
                ))}
              </div>
            )}
          </button>

          {/* Swipe up hint */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowViewersModal(true);
              loadViewers(currentStory.id);
            }}
            className="flex flex-col items-center text-white/70 hover:text-white text-[10px] transition-colors"
          >
            <ChevronUp size={16} className="animate-bounce" />
            <span className="font-medium">Viewers</span>
          </button>

          {/* Delete Story Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteCurrentStory();
            }}
            className="w-9 h-9 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-300 hover:text-white flex items-center justify-center backdrop-blur-xl border border-red-500/30 transition-all duration-200 active:scale-95 shadow-lg"
            title="Delete this story"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        /* VIEWER CONTROLS: Floating emoji reaction picker */
        <div className="absolute bottom-5 left-0 right-0 z-40 px-4 flex flex-col items-center pointer-events-auto">
          <div className="flex items-center justify-center gap-2 sm:gap-3 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/15 shadow-2xl">
            {REACTION_EMOJIS.map((emoji) => {
              const isSelected = userReaction === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReact(emoji);
                  }}
                  className={`text-2xl sm:text-3xl p-1.5 rounded-full transition-all duration-200 transform hover:scale-130 active:scale-95 ${
                    isSelected
                      ? "bg-white/25 ring-2 ring-violet-400 scale-115 shadow-lg"
                      : "hover:bg-white/10"
                  }`}
                  title={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. Story count indicator */}
      <div className="absolute bottom-1.5 left-0 right-0 z-30 pointer-events-none text-center">
        <p className="text-white/40 text-[10px]">
          {currentIdx + 1} / {storyList.length}
        </p>
      </div>

      {/* 8. Seen by Viewers Bottom Sheet Modal (Own Story) */}
      <AnimatePresence>
        {showViewersModal && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowViewersModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-lg bg-slate-900 border-t border-slate-700/60 rounded-t-3xl shadow-2xl flex flex-col max-h-[75vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-3 mb-1" />

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Eye size={18} className="text-violet-400" />
                  <h3 className="text-white font-semibold text-base">
                    Viewers ({viewers.length})
                  </h3>
                </div>
                <button
                  onClick={() => setShowViewersModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Reaction filter chips */}
              {reactionSummary.length > 0 && (
                <div className="flex items-center gap-2 px-5 py-2.5 overflow-x-auto no-scrollbar border-b border-slate-800/60 bg-slate-900/50">
                  <button
                    onClick={() => setSelectedReactionFilter("all")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedReactionFilter === "all"
                        ? "bg-violet-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    All ({viewers.length})
                  </button>
                  {reactionSummary.map(({ emoji, count }) => (
                    <button
                      key={emoji}
                      onClick={() => setSelectedReactionFilter(emoji)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        selectedReactionFilter === emoji
                          ? "bg-violet-600 text-white"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <span>{emoji}</span>
                      <span>{count}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Viewers List */}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5">
                {loadingViewers ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-xs">Loading viewers...</p>
                  </div>
                ) : filteredViewers.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-center px-4">
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3 text-slate-500">
                      <Eye size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-300 mb-1">
                      {selectedReactionFilter === "all"
                        ? "No views yet"
                        : `No ${selectedReactionFilter} reactions`}
                    </p>
                    <p className="text-xs text-slate-500 max-w-xs">
                      {selectedReactionFilter === "all"
                        ? "When your friends view this story, they will appear here."
                        : `Nobody has reacted with ${selectedReactionFilter} to this story yet.`}
                    </p>
                  </div>
                ) : (
                  filteredViewers.map((viewer) => {
                    const viewerAvatar =
                      sanitizeUrl(viewer.user?.avatar_url || "") ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                        viewer.user?.username || viewer.viewer_id
                      )}`;
                    return (
                      <div
                        key={viewer.viewer_id}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative flex-shrink-0">
                            <img
                              src={viewerAvatar}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-700"
                            />
                            {viewer.reaction && (
                              <span className="absolute -bottom-1 -right-1 text-sm bg-slate-900 rounded-full p-0.5 ring-1 ring-slate-700 shadow-sm leading-none">
                                {viewer.reaction}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">
                              {viewer.user?.username || "Friend"}
                            </p>
                            <p className="text-slate-400 text-[11px]">
                              {formatTimeAgo(viewer.viewed_at)}
                            </p>
                          </div>
                        </div>

                        {viewer.reaction && (
                          <div className="flex items-center gap-1 px-2.5 py-1 bg-white/10 rounded-full border border-white/10 shadow-sm">
                            <span className="text-lg leading-none">{viewer.reaction}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StoryViewer;

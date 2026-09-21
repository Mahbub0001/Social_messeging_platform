import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { cn } from "../../lib/utils";

export type ReactionType = "love" | "haha" | "wow" | "sad" | "angry" | "like";

export interface ReactionPickerProps {
  currentReaction?: ReactionType | null;
  onSelectReaction: (type: ReactionType) => void;
  onToggleDefault: () => void;
  activeCount?: number;
  reactionsSummary?: { type: ReactionType; count: number }[];
}

export interface ReactionConfig {
  type: ReactionType;
  emoji: string;
  label: string;
  color: string;
  bg: string;
}

export const REACTIONS_CONFIG: Record<ReactionType, ReactionConfig> = {
  love: {
    type: "love",
    emoji: "❤️",
    label: "ভালোবাসা",
    color: "text-rose-500",
    bg: "bg-rose-500/15",
  },
  haha: {
    type: "haha",
    emoji: "😆",
    label: "হা হা",
    color: "text-amber-500",
    bg: "bg-amber-500/15",
  },
  wow: {
    type: "wow",
    emoji: "😮",
    label: "অবাক",
    color: "text-amber-500",
    bg: "bg-amber-500/15",
  },
  sad: {
    type: "sad",
    emoji: "😢",
    label: "কষ্ট",
    color: "text-blue-500",
    bg: "bg-blue-500/15",
  },
  angry: {
    type: "angry",
    emoji: "😡",
    label: "রাগ",
    color: "text-orange-600",
    bg: "bg-orange-500/15",
  },
  like: {
    type: "like",
    emoji: "👍",
    label: "পছন্দ",
    color: "text-indigo-500",
    bg: "bg-indigo-500/15",
  },
};

export const ORDERED_REACTIONS: ReactionType[] = [
  "love",
  "haha",
  "wow",
  "sad",
  "angry",
  "like",
];

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  currentReaction,
  onSelectReaction,
  onToggleDefault,
  activeCount,
  reactionsSummary,
}) => {
  const [isDockOpen, setIsDockOpen] = useState(false);
  const [hoveredEmoji, setHoveredEmoji] = useState<ReactionType | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressActiveRef = useRef(false);
  const touchStartTimeRef = useRef(0);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isTouchScrolledRef = useRef(false);
  const didHandleTouchRef = useRef(false);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  // Close floating dock on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsDockOpen(false);
        setHoveredEmoji(null);
      }
    };

    if (isDockOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isDockOpen]);

  // Desktop Hover handlers
  const handleMouseEnter = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
    }
    openTimerRef.current = setTimeout(() => {
      setIsDockOpen(true);
    }, 120);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setIsDockOpen(false);
      setHoveredEmoji(null);
    }, 450);
  }, []);

  // Mobile Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartTimeRef.current = Date.now();
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isTouchScrolledRef.current = false;
    isLongPressActiveRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // 320ms Long-Press Timer
    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate?.(30);
        } catch {
          // ignore if denied by user or platform
        }
      }
      setIsDockOpen(true);
    }, 320);
  };

  // Proximity helper for smooth drag-to-select mobile reaction
  const findReactionFromPoint = (x: number, y: number): ReactionType | null => {
    const elem = document.elementFromPoint(x, y);
    const reactionBtn = elem?.closest<HTMLElement>("[data-reaction-type]");
    if (reactionBtn) {
      const type = reactionBtn.getAttribute("data-reaction-type") as ReactionType;
      if (type && REACTIONS_CONFIG[type]) return type;
    }

    // Fallback: check buttons within container for horizontal proximity
    if (containerRef.current) {
      const buttons = containerRef.current.querySelectorAll<HTMLElement>("[data-reaction-type]");
      let closestType: ReactionType | null = null;
      let minDistance = 70; // 70px proximity radius

      buttons.forEach((btn) => {
        const rect = btn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dist = Math.hypot(x - centerX, y - centerY);
        if (dist < minDistance) {
          minDistance = dist;
          closestType = btn.getAttribute("data-reaction-type") as ReactionType;
        }
      });
      return closestType;
    }

    return null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);

    if (!isLongPressActiveRef.current) {
      // Cancel long press if user scrolls (> 10px movement before long press)
      if (dx > 10 || dy > 10) {
        isTouchScrolledRef.current = true;
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
      return;
    }

    // Lock touch scroll when dragging over reaction emojis
    if (e.cancelable) {
      e.preventDefault();
    }

    const detected = findReactionFromPoint(touch.clientX, touch.clientY);
    if (detected !== hoveredEmoji) {
      setHoveredEmoji(detected);
      if (detected && typeof window !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate?.(15);
        } catch {}
      }
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isLongPressActiveRef.current) {
      didHandleTouchRef.current = true;
      if (hoveredEmoji) {
        onSelectReaction(hoveredEmoji);
      }
      setIsDockOpen(false);
      setHoveredEmoji(null);
      isLongPressActiveRef.current = false;
    } else {
      // Quick tap (< 320ms without scrolling)
      const elapsed = Date.now() - touchStartTimeRef.current;
      if (elapsed < 320 && !isTouchScrolledRef.current) {
        didHandleTouchRef.current = true;
        onToggleDefault();
        setIsDockOpen(false);
      }
    }

    // Reset touch flag after small delay to avoid synthesized click
    setTimeout(() => {
      didHandleTouchRef.current = false;
    }, 400);
  };

  const handleTouchCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    isLongPressActiveRef.current = false;
    setIsDockOpen(false);
    setHoveredEmoji(null);
  };

  // Main button click (desktop or fallback)
  const handleMainButtonClick = (e: React.MouseEvent) => {
    if (didHandleTouchRef.current) {
      e.preventDefault();
      return;
    }
    onToggleDefault();
  };

  const activeConfig = currentReaction ? REACTIONS_CONFIG[currentReaction] : null;

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Floating Reaction Dock */}
      <AnimatePresence>
        {isDockOpen && (
          <div
            className="absolute bottom-full left-0 pb-3 -mb-1.5 z-50 pointer-events-auto"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Invisible hover bridge to eliminate any gap between button and dock */}
            <div className="absolute -bottom-2 left-0 right-0 h-4 pointer-events-auto" />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
              transition={{ type: "spring", damping: 20, stiffness: 350 }}
              className="flex items-center gap-1 sm:gap-1.5 p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full shadow-xl border border-slate-200/90 dark:border-slate-800/80 select-none"
            >
              {ORDERED_REACTIONS.map((type) => {
                const item = REACTIONS_CONFIG[type];
                const isHovered = hoveredEmoji === type;
                const isSelected = currentReaction === type;

                return (
                  <motion.button
                    key={item.type}
                    type="button"
                    data-reaction-type={item.type}
                    whileHover={{ scale: 1.45, y: -8 }}
                    whileTap={{ scale: 1.25 }}
                    animate={
                      isHovered
                        ? { scale: 1.45, y: -8 }
                        : { scale: 1, y: 0 }
                    }
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectReaction(item.type);
                      setIsDockOpen(false);
                      setHoveredEmoji(null);
                    }}
                    onMouseEnter={() => {
                      if (closeTimerRef.current) {
                        clearTimeout(closeTimerRef.current);
                        closeTimerRef.current = null;
                      }
                      setHoveredEmoji(item.type);
                    }}
                    onMouseLeave={() =>
                      setHoveredEmoji((prev) => (prev === item.type ? null : prev))
                    }
                    className={cn(
                      "relative p-1.5 sm:p-2 rounded-full transition-colors flex items-center justify-center focus:outline-none",
                      isSelected
                        ? item.bg
                        : "hover:bg-slate-100 dark:hover:bg-slate-800/70"
                    )}
                    aria-label={item.label}
                  >
                    <span className="text-2xl leading-none select-none block filter drop-shadow-sm">
                      {item.emoji}
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Trigger Button */}
      <button
        type="button"
        onClick={handleMainButtonClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        className={cn(
          "group inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-150 select-none touch-manipulation focus:outline-none active:scale-95",
          activeConfig
            ? cn(activeConfig.bg, "font-semibold")
            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80"
        )}
        aria-label={activeConfig ? activeConfig.label : "Reaction"}
      >
        {activeConfig ? (
          <span className="text-base leading-none select-none">
            {activeConfig.emoji}
          </span>
        ) : (
          <Heart className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-rose-500 transition-colors" />
        )}

        {/* Reaction Summary Icons (if provided) */}
        {reactionsSummary && reactionsSummary.length > 0 && !activeConfig && (
          <div className="flex -space-x-1 items-center ml-0.5">
            {reactionsSummary.slice(0, 3).map((item) => (
              <span
                key={item.type}
                className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-white dark:bg-slate-800 shadow-2xs border border-slate-100 dark:border-slate-700"
              >
                {REACTIONS_CONFIG[item.type]?.emoji || "❤️"}
              </span>
            ))}
          </div>
        )}

        {/* Reaction Count (if provided and > 0) */}
        {typeof activeCount === "number" && activeCount > 0 && (
          <span
            className={cn(
              "text-xs font-semibold ml-0.5",
              activeConfig
                ? activeConfig.color
                : "text-slate-500 dark:text-slate-400"
            )}
          >
            {activeCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default ReactionPicker;

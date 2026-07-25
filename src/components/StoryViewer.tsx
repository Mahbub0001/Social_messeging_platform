import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useStore } from "../hooks/useStore";
import { storyService } from "../services/storyService";
import type { StoryWithDetails } from "../services/storyService";
import { sanitizeUrl } from "../utils/security";

interface StoryViewerProps {
  stories: StoryWithDetails[];
  initialIndex: number;
  onClose: () => void;
}

const STORY_DURATION = 7000;
const PROGRESS_INTERVAL = 50;

export const StoryViewer: React.FC<StoryViewerProps> = ({ stories, initialIndex, onClose }) => {
  const user = useStore((state) => state.user);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const currentStory = stories[currentIndex];

  useEffect(() => {
    if (currentStory && user) {
      storyService.recordStoryView(currentStory.id, user.id);
    }
  }, [currentStory?.id, user]);

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  useEffect(() => {
    setProgress(0);
    setPaused(false);
  }, [currentIndex]);

  useEffect(() => {
    const story = stories[currentIndex];
    if (!story || story.media_type !== "image") return;

    if (paused) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          goNext();
          return 100;
        }
        return prev + (PROGRESS_INTERVAL / STORY_DURATION) * 100;
      });
    }, PROGRESS_INTERVAL);

    return () => clearInterval(interval);
  }, [currentIndex, paused, stories, goNext]);

  const handleVideoEnded = () => {
    goNext();
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onClose();
    },
    [goNext, goPrev, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!currentStory) return null;

  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff > 80) goPrev();
    else if (diff < -80) goNext();
    touchStartX.current = null;
  };

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
      >
        <X size={24} />
      </button>

      {/* Progress bars */}
      <div className="absolute top-4 left-4 right-16 flex gap-1 z-20">
        {stories.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-white rounded-full transition-all duration-100"
              style={{
                width: i < currentIndex ? "100%" : i === currentIndex ? `${progress}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Story header */}
      <div className="absolute top-10 left-4 flex items-center gap-3 z-20">
        <img
          src={
            sanitizeUrl(currentStory.user?.avatar_url || "") ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentStory.user?.username || "user")}`
          }
          alt={currentStory.user?.username}
          className="w-10 h-10 rounded-full border-2 border-white"
        />
        <div>
          <p className="text-white text-sm font-semibold">
            {currentStory.user?.username}
          </p>
          <p className="text-white/60 text-xs">
            {new Date(currentStory.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      {/* Navigation buttons */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
        >
          <ChevronLeft size={28} />
        </button>
      )}
      {currentIndex < stories.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Left / Right tap zones */}
      <div className="absolute inset-0 flex z-10">
        <div
          className="w-1/2 h-full"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
        />
        <div
          className="w-1/2 h-full"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
        />
      </div>

      {/* Media content */}
      <div
        className="relative max-w-lg w-full mx-4"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {currentStory.media_type === "image" ? (
          <img
            src={sanitizeUrl(currentStory.media_url)}
            alt="Story"
            className="w-full max-h-[80vh] object-contain rounded-lg select-none"
          />
        ) : (
          <video
            ref={videoRef}
            src={sanitizeUrl(currentStory.media_url)}
            className="w-full max-h-[80vh] object-contain rounded-lg select-none"
            autoPlay
            muted
            playsInline
            onEnded={handleVideoEnded}
          />
        )}

        {/* Caption */}
        {currentStory.caption && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-3">
            <p className="text-white text-sm">{currentStory.caption}</p>
          </div>
        )}

        {/* View count badge */}
        <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 text-white text-xs">
          <Eye size={12} />
          <span>{currentStory.viewCount || 0}</span>
        </div>
      </div>
    </div>
  );
};

export default StoryViewer;

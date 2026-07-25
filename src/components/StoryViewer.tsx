import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Eye } from "lucide-react";
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
const PROGRESS_INTERVAL = 40;

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

  const handleMediaClick = () => {
    if (currentStory.media_type === "image") {
      setPaused((prev) => !prev);
    } else {
      const video = videoRef.current;
      if (video) {
        if (video.paused) {
          video.play();
          setPaused(false);
        } else {
          video.pause();
          setPaused(true);
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 select-none">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-30 flex gap-1 px-2 pt-2">
        {stories.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-[3px] bg-white/25 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-white rounded-full transition-all duration-75 ease-linear"
              style={{
                width: i < currentIndex ? "100%" : i === currentIndex ? `${progress}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-30 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white transition"
      >
        <X size={20} />
      </button>

      {/* Header */}
      <div className="absolute top-10 left-4 right-4 z-20 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20 flex-shrink-0">
          <img
            src={
              sanitizeUrl(currentStory.user?.avatar_url || "") ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentStory.user?.username || "u")}`
            }
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold truncate">
            {currentStory.user?.username}
          </p>
          <p className="text-white/50 text-[11px]">
            {new Date(currentStory.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {" · "}
            <Eye size={10} className="inline" /> {currentStory.viewCount || 0}
          </p>
        </div>
      </div>

      {/* Navigation: left 30% = prev, right 70% = next */}
      <div className="absolute inset-0 z-10 flex">
        <button
          className="w-[30%] h-full cursor-default"
          onClick={goPrev}
        />
        <button
          className="w-[70%] h-full cursor-default"
          onClick={goNext}
        />
      </div>

      {/* Media */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative max-w-lg w-full pointer-events-auto"
          onClick={handleMediaClick}
        >
          {currentStory.media_type === "image" ? (
            <>
              <img
                src={sanitizeUrl(currentStory.media_url)}
                alt="Story"
                className="w-full max-h-[85vh] object-contain rounded-sm"
              />
              {paused && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center">
                    <div className="w-0 h-0 border-l-[16px] border-t-[10px] border-b-[10px] border-l-white border-t-transparent border-b-transparent ml-1" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <video
              ref={videoRef}
              src={sanitizeUrl(currentStory.media_url)}
              className="w-full max-h-[85vh] object-contain rounded-sm"
              autoPlay
              playsInline
              onEnded={handleVideoEnded}
            />
          )}

          {currentStory.caption && (
            <div className="absolute bottom-16 left-0 right-0 px-4">
              <p className="text-white/90 text-sm text-center drop-shadow-lg">
                {currentStory.caption}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom dismiss zone */}
      <div className="absolute bottom-0 left-0 right-0 h-[15%] z-30 flex items-end justify-center pb-6">
        <p className="text-white/30 text-xs">swipe down to close</p>
      </div>

      {/* Swipe down to close */}
      <div
        className="absolute inset-0 z-5"
        onTouchEnd={(e) => {
          const endY = e.changedTouches[0].clientY;
          const startY = (e.target as HTMLElement).dataset?.startY;
          if (startY && endY - Number(startY) > 120) {
            onClose();
          }
        }}
        onTouchStart={(e) => {
          (e.currentTarget as HTMLElement).dataset.startY = String(e.touches[0].clientY);
        }}
      />
    </div>
  );
};

export default StoryViewer;

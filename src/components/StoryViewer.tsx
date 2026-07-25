import React, { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
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
const TICK = 50;

export const StoryViewer: React.FC<StoryViewerProps> = ({ stories, initialIndex, onClose }) => {
  const user = useStore((state) => state.user);
  const [currentIdx, setCurrentIdx] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  const currentStory = stories[currentIdx];
  const currentUser = currentStory?.user;

  useEffect(() => {
    if (currentStory && user) {
      storyService.recordStoryView(currentStory.id, user.id);
    }
  }, [currentStory?.id]);

  const goNext = useCallback(() => {
    if (currentIdx < stories.length - 1) {
      setCurrentIdx((p) => p + 1);
    } else {
      onClose();
    }
  }, [currentIdx, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIdx > 0) setCurrentIdx((p) => p - 1);
  }, [currentIdx]);

  useEffect(() => {
    setProgress(0);
    setPaused(false);
  }, [currentIdx]);

  useEffect(() => {
    if (currentStory?.media_type === "video") return;
    if (paused) return;

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
  }, [currentIdx, paused, currentStory?.media_type, goNext]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  if (!currentStory) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dy) > Math.abs(dx) && dy > 100) {
      onClose();
    } else if (Math.abs(dx) > 60) {
      if (dx > 0) goPrev();
      else goNext();
    }
  };

  const handleVideoEnded = () => goNext();

  const togglePause = () => {
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
    if (side === "left") goPrev();
    else goNext();
  };

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress bar row */}
      <div className="absolute top-0 left-0 right-0 z-40 flex gap-1.5 px-2 pt-3">
        {stories.map((_, i) => (
          <div key={i} className="flex-1 h-[3px] bg-white/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-75 ease-linear"
              style={{ width: i < currentIdx ? "100%" : i === currentIdx ? `${progress}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* Top bar: avatar + name + time + close */}
      <div className="absolute top-4 left-0 right-0 z-30 flex items-center gap-3 px-4 pt-2">
        <div className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-white/20 flex-shrink-0">
          <img
            src={
              sanitizeUrl(currentUser?.avatar_url || "") ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser?.username || "u")}`
            }
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate leading-tight">
            {currentUser?.username}
          </p>
          <p className="text-white/50 text-[11px] leading-tight">
            {new Date(currentStory.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Tap zones: left 40% prev, right 60% next, top/bottom areas close */}
      <div className="flex-1 flex z-20 mt-16 mb-16">
        <button onClick={() => onTap("left")} className="w-[40%] h-full cursor-default" />
        <button onClick={() => onTap("right")} className="w-[60%] h-full cursor-default" />
      </div>

      {/* Media */}
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
                className="w-full max-h-[75vh] object-contain rounded-md select-none"
              />
              {paused && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md">
                  <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                    <div className="w-0 h-0 border-l-[18px] border-t-[11px] border-b-[11px] border-l-white border-t-transparent border-b-transparent ml-1" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <video
              ref={videoRef}
              src={sanitizeUrl(currentStory.media_url)}
              className="w-full max-h-[75vh] object-contain rounded-md select-none"
              autoPlay
              playsInline
              onEnded={handleVideoEnded}
            />
          )}

          {currentStory.caption && (
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-white text-sm text-center drop-shadow-lg bg-black/40 backdrop-blur-sm rounded-xl px-4 py-2 mx-4">
                {currentStory.caption}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom gradient + counter */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pb-6 pt-16 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
        <p className="text-center text-white/40 text-xs">
          {currentIdx + 1} / {stories.length}
        </p>
      </div>

      {/* Pulse indicator for current story */}
      {currentStory.media_type === "video" && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-white/60 animate-pulse" />
            <span className="text-white/50 text-[10px]">Video</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryViewer;

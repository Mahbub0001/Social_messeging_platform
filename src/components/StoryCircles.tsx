import React, { useState, useEffect } from "react";
import { useStore } from "../hooks/useStore";
import { storyService } from "../services/storyService";
import type { StoryWithDetails } from "../services/storyService";

interface StoryCirclesProps {
  onStoryClick: (storyId: string) => void;
  onUploadClick: () => void;
}

export const StoryCircles: React.FC<StoryCirclesProps> = ({
  onStoryClick,
  onUploadClick,
}) => {
  const user = useStore((state) => state.user);
  const [stories, setStories] = useState<StoryWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveStories();

    // Subscribe to new stories
    const unsubscribe = storyService.subscribeToStories((newStory) => {
      setStories((prev) => [newStory as StoryWithDetails, ...prev]);
    });

    return unsubscribe;
  }, [user]);

  const loadActiveStories = async () => {
    if (!user) return;

    setLoading(true);
    const { data } = await storyService.getActiveStories(user.id);
    setStories(data || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="w-16 h-16 rounded-full bg-gray-300 dark:bg-slate-700 animate-pulse flex-shrink-0"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 px-4">
      {/* Add story circle */}
      <button
        onClick={onUploadClick}
        className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-2xl hover:shadow-lg transition relative group"
      >
        +
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
          Add Story
        </div>
      </button>

      {/* Story circles */}
      {stories.map((story) => (
        <button
          key={story.id}
          onClick={() => onStoryClick(story.id)}
          className="w-16 h-16 rounded-full flex-shrink-0 overflow-hidden relative group hover:shadow-lg transition"
        >
          {story.media_type === "image" ? (
            <img
              src={story.media_url}
              alt={story.user?.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              src={story.media_url}
              className="w-full h-full object-cover"
            />
          )}

          {/* Border for unviewed */}
          <div
            className={`absolute inset-0 rounded-full border-2 ${
              story.hasViewed
                ? "border-gray-400"
                : "border-gradient-to-r from-blue-400 to-pink-400"
            }`}
          />

          {/* Username on hover */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap max-w-xs truncate">
            {story.user?.username}
          </div>
        </button>
      ))}
    </div>
  );
};

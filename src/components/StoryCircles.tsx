import React from "react";
import { useStore } from "../hooks/useStore";
import { sanitizeUrl } from "../utils/security";

interface StoryCirclesProps {
  onStoryClick: (index: number) => void;
  onUploadClick: () => void;
}

export const StoryCircles: React.FC<StoryCirclesProps> = ({
  onStoryClick,
  onUploadClick,
}) => {
  const stories = useStore((state) => state.stories);
  const storiesLoading = useStore((state) => state.storiesLoading);

  if (storiesLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 px-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="w-14 h-14 rounded-full bg-gray-300 dark:bg-slate-700 animate-pulse flex-shrink-0"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 px-4">
      <button
        onClick={onUploadClick}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-xl hover:shadow-lg hover:shadow-violet-500/20 transition relative"
        title="Add Story"
      >
        +
      </button>

      {stories.map((story, idx) => (
        <button
          key={story.id}
          onClick={() => onStoryClick(idx)}
          className="relative w-14 h-14 rounded-full flex-shrink-0 overflow-hidden hover:shadow-lg transition"
        >
          <div
            className={`absolute inset-0 rounded-full p-[2px] ${
              story.hasViewed
                ? "bg-gray-500"
                : "bg-gradient-to-tr from-violet-500 via-pink-500 to-orange-400"
            }`}
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-slate-800">
              {story.media_type === "image" ? (
                <img
                  src={sanitizeUrl(story.media_url)}
                  alt={story.user?.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={sanitizeUrl(story.media_url)}
                  className="w-full h-full object-cover"
                  muted
                />
              )}
            </div>
          </div>

          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-white text-[10px] whitespace-nowrap max-w-[80px] truncate opacity-70">
            {story.user?.username}
          </div>
        </button>
      ))}
    </div>
  );
};

export default StoryCircles;

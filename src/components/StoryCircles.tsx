import React from "react";
import { useStore } from "../hooks/useStore";
import { sanitizeUrl } from "../utils/security";
import { Plus } from "lucide-react";

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

  return (
    <div className="flex items-center gap-3 overflow-x-auto px-4 py-3 scrollbar-none">
      <button
        onClick={onUploadClick}
        className="flex flex-col items-center gap-1 flex-shrink-0 group"
      >
        <div className="relative w-[62px] h-[62px] rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border-2 border-dashed border-slate-600 group-hover:border-violet-500 transition-colors">
          <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center group-hover:bg-violet-500 group-hover:scale-110 transition-all">
            <Plus size={16} className="text-violet-400 group-hover:text-white transition-colors" />
          </div>
        </div>
        <span className="text-[10px] text-slate-400 group-hover:text-violet-400 transition-colors max-w-[62px] truncate">
          Your story
        </span>
      </button>

      {storiesLoading ? (
        [...Array(3)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="w-[62px] h-[62px] rounded-full bg-slate-800 animate-pulse" />
            <div className="w-[50px] h-[10px] rounded bg-slate-800 animate-pulse" />
          </div>
        ))
      ) : stories.length === 0 ? null : (
        stories.map((story, idx) => (
          <button
            key={story.id}
            onClick={() => onStoryClick(idx)}
            className="flex flex-col items-center gap-1 flex-shrink-0 group"
          >
            <div
              className={`w-[62px] h-[62px] rounded-full p-[2.5px] ${
                story.hasViewed
                  ? "bg-slate-600"
                  : "bg-gradient-to-tr from-violet-600 via-pink-500 to-orange-400"
              }`}
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 ring-2 ring-slate-950">
                {story.media_type === "image" ? (
                  <img
                    src={sanitizeUrl(story.media_url)}
                    alt={story.user?.username}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <video
                    src={sanitizeUrl(story.media_url)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    muted
                  />
                )}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 group-hover:text-slate-300 transition-colors max-w-[62px] truncate">
              {story.user?.username}
            </span>
          </button>
        ))
      )}
    </div>
  );
};

export default StoryCircles;

import React from "react";
import { useStore } from "../hooks/useStore";
import { sanitizeUrl } from "../utils/security";
import { Plus } from "lucide-react";

interface StoryGroup {
  userId: string;
  username: string;
  avatar: string;
  thumbnail: string;
  thumbnailType: "image" | "video";
  storyCount: number;
  hasUnviewed: boolean;
}

interface StoryCirclesProps {
  onStoryClick: (userId: string) => void;
  onUploadClick: () => void;
}

export const StoryCircles: React.FC<StoryCirclesProps> = ({
  onStoryClick,
  onUploadClick,
}) => {
  const stories = useStore((state) => state.stories);
  const storiesLoading = useStore((state) => state.storiesLoading);

  const groups: StoryGroup[] = (() => {
    const map = new Map<string, StoryGroup>();
    stories.forEach((s) => {
      const uid = s.user_id;
      if (!map.has(uid)) {
        map.set(uid, {
          userId: uid,
          username: s.user?.username || "Unknown",
          avatar: s.user?.avatar_url || "",
          thumbnail: s.media_url,
          thumbnailType: s.media_type,
          storyCount: 1,
          hasUnviewed: !s.hasViewed,
        });
      } else {
        const g = map.get(uid)!;
        g.storyCount++;
        if (!s.hasViewed) g.hasUnviewed = true;
        map.set(uid, g);
      }
    });
    return Array.from(map.values());
  })();

  return (
    <div className="flex items-center gap-4 overflow-x-auto px-4 py-3 scrollbar-none">
      <button
        onClick={onUploadClick}
        className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
      >
        <div className="relative w-[64px] h-[64px] rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center border-2 border-slate-700/50 group-hover:border-violet-500/50 transition-all group-hover:scale-105">
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center group-hover:bg-violet-600 transition-all">
            <Plus size={18} className="text-slate-300 group-hover:text-white transition-colors" />
          </div>
        </div>
        <span className="text-[11px] text-slate-400 font-medium group-hover:text-violet-400 transition-colors max-w-[64px] truncate">
          My Story
        </span>
      </button>

      {storiesLoading ? (
        [...Array(3)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="w-[64px] h-[64px] rounded-full bg-slate-800 animate-pulse" />
            <div className="w-[48px] h-[10px] rounded-full bg-slate-800 animate-pulse" />
          </div>
        ))
      ) : (
        groups.map((group) => (
          <button
            key={group.userId}
            onClick={() => onStoryClick(group.userId)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
          >
            <div className="relative">
              <div
                className={`w-[64px] h-[64px] rounded-full p-[2.5px] ${
                  group.hasUnviewed
                    ? "bg-gradient-to-br from-violet-500 via-pink-500 to-orange-400"
                    : "bg-slate-600"
                }`}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 ring-[3px] ring-slate-950">
                  <img
                    src={sanitizeUrl(group.avatar) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(group.username)}`}
                    alt={group.username}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
              </div>
              {group.storyCount > 1 && (
                <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-slate-950">
                  {group.storyCount}
                </div>
              )}
            </div>
            <span className="text-[11px] text-slate-400 font-medium group-hover:text-slate-300 transition-colors max-w-[64px] truncate">
              {group.username}
            </span>
          </button>
        ))
      )}
    </div>
  );
};

export default StoryCircles;

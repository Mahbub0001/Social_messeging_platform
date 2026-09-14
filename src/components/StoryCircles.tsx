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
  const user = useStore((state) => state.user);
  const stories = useStore((state) => state.stories);
  const storiesLoading = useStore((state) => state.storiesLoading);

  // Separate user's own stories and friends' stories
  const myStories = user ? stories.filter((s) => s.user_id === user.id) : [];
  const hasMyStory = myStories.length > 0;
  const myHasUnviewed = myStories.some((s) => !s.hasViewed);

  const userMetadata = (user as any)?.user_metadata;
  const myAvatar =
    sanitizeUrl(userMetadata?.avatar_url || (user as any)?.avatar_url) ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
      userMetadata?.username || user?.email?.split("@")[0] || "me"
    )}`;

  const otherGroups: StoryGroup[] = (() => {
    const map = new Map<string, StoryGroup>();
    stories.forEach((s) => {
      const uid = s.user_id;
      // Skip current user because they are displayed in the "My Story" slot
      if (user && uid === user.id) return;

      if (!map.has(uid)) {
        map.set(uid, {
          userId: uid,
          username: s.user?.username || "Friend",
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
    <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar scroll-smooth px-3.5 py-1">
      {/* 1. My Story / Add Story Button */}
      <div className="flex flex-col items-center gap-1.5 flex-shrink-0 group">
        <div className="relative">
          <button
            onClick={hasMyStory ? () => onStoryClick(user!.id) : onUploadClick}
            className="focus:outline-none"
            title={hasMyStory ? "View your story" : "Add to your story"}
          >
            <div
              className={`w-[52px] h-[52px] rounded-full p-[2px] transition-all group-hover:scale-105 ${
                hasMyStory
                  ? myHasUnviewed
                    ? "bg-gradient-to-tr from-violet-500 via-fuchsia-500 to-amber-400 shadow-sm shadow-violet-500/25"
                    : "bg-slate-700"
                  : "border border-dashed border-slate-600 group-hover:border-violet-400 p-[1.5px]"
              }`}
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 ring-2 ring-slate-900">
                <img
                  src={myAvatar}
                  alt="My Story"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
              </div>
            </div>
          </button>

          {/* Plus icon badge to create new story */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUploadClick();
            }}
            title="Add new story"
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-violet-600 hover:bg-violet-500 active:scale-95 text-white flex items-center justify-center ring-2 ring-slate-900 shadow-md transition-all z-10"
          >
            <Plus size={12} strokeWidth={3} />
          </button>
        </div>
        <span className="text-[11px] font-medium text-slate-300 group-hover:text-violet-400 transition-colors max-w-[58px] truncate text-center">
          My Story
        </span>
      </div>

      {/* 2. Loading Skeletons */}
      {storiesLoading &&
        [...Array(3)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="w-[52px] h-[52px] rounded-full bg-slate-800/80 animate-pulse ring-1 ring-slate-700/50" />
            <div className="w-10 h-2.5 rounded-full bg-slate-800/80 animate-pulse" />
          </div>
        ))}

      {/* 3. Friends' Stories */}
      {!storiesLoading &&
        otherGroups.map((group) => (
          <button
            key={group.userId}
            onClick={() => onStoryClick(group.userId)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 group focus:outline-none"
            title={`View ${group.username}'s story`}
          >
            <div className="relative">
              <div
                className={`w-[52px] h-[52px] rounded-full p-[2px] transition-all group-hover:scale-105 ${
                  group.hasUnviewed
                    ? "bg-gradient-to-tr from-violet-500 via-pink-500 to-amber-400 shadow-sm shadow-violet-500/20"
                    : "bg-slate-700/70"
                }`}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 ring-2 ring-slate-900">
                  <img
                    src={
                      sanitizeUrl(group.avatar) ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                        group.username
                      )}`
                    }
                    alt={group.username}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
              </div>

              {/* Multiple stories indicator badge */}
              {group.storyCount > 1 && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-gradient-to-tr from-violet-600 to-indigo-600 text-white text-[9px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center ring-2 ring-slate-900 shadow">
                  {group.storyCount}
                </div>
              )}
            </div>
            <span className="text-[11px] font-medium text-slate-300 group-hover:text-white transition-colors max-w-[58px] truncate text-center">
              {group.username}
            </span>
          </button>
        ))}
    </div>
  );
};

export default StoryCircles;

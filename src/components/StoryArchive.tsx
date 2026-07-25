import React, { useState, useEffect } from "react";
import { Clock, Eye, Trash2, X, ImageIcon, VideoIcon } from "lucide-react";
import { useStore } from "../hooks/useStore";
import { storyService } from "../services/storyService";
import type { StoryWithDetails } from "../services/storyService";

interface StoryArchiveProps {
  onClose: () => void;
}

export const StoryArchive: React.FC<StoryArchiveProps> = ({ onClose }) => {
  const user = useStore((state) => state.user);
  const [userStories, setUserStories] = useState<StoryWithDetails[]>([]);
  const [allStories, setAllStories] = useState<StoryWithDetails[]>([]);
  const [selectedStory, setSelectedStory] = useState<StoryWithDetails | null>(null);
  const [viewers, setViewers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"my-stories" | "all-stories">("my-stories");

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    if (!user) return;
    setLoading(true);
    const { data: myData } = await storyService.getUserStories(user.id);
    setUserStories(myData || []);
    const { data: allData } = await storyService.getAllPreviousStories(user.id);
    setAllStories(allData || []);
    setLoading(false);
  };

  const handleViewStory = async (story: StoryWithDetails) => {
    setSelectedStory(story);
    if (story.user_id === user?.id) {
      const { data } = await storyService.getStoryViewers(story.id, user.id);
      setViewers(data || []);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!user) return;
    if (!window.confirm("Delete this story permanently?")) return;
    const { error } = await storyService.deleteStory(storyId, user.id);
    if (!error) {
      setUserStories(userStories.filter((s) => s.id !== storyId));
      setAllStories(allStories.filter((s) => s.id !== storyId));
      setSelectedStory(null);
    }
  };

  const formatTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const isStoryActive = (expiresAt: string) => new Date(expiresAt) > new Date();

  const stories = activeTab === "my-stories" ? userStories : allStories;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col border border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            Story Archive
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab("my-stories")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === "my-stories"
                ? "text-violet-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            My Stories
            {activeTab === "my-stories" && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-violet-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("all-stories")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === "all-stories"
                ? "text-violet-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            All Stories
            {activeTab === "all-stories" && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-violet-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-xl bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : stories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Clock size={32} className="mb-3 opacity-40" />
              <p className="text-sm">No stories yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stories.map((story) => (
                <div key={story.id} className="flex flex-col gap-1.5">
                  <button
                    onClick={() => handleViewStory(story)}
                    className="relative group aspect-[3/4] rounded-xl overflow-hidden bg-slate-800"
                  >
                    {story.media_type === "image" ? (
                      <img src={story.media_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={story.media_url} className="w-full h-full object-cover" muted />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="text-center">
                        <Eye size={20} className="mx-auto text-white mb-1" />
                        <span className="text-white text-xs font-medium">{story.viewCount || 0} views</span>
                      </div>
                    </div>
                    {!isStoryActive(story.expires_at) && (
                      <div className="absolute top-2 left-2 bg-red-500/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        Expired
                      </div>
                    )}
                    {isStoryActive(story.expires_at) && (
                      <div className="absolute top-2 left-2 bg-emerald-500/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        Active
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] text-white/80 bg-black/50 rounded-full px-2 py-0.5">
                      {story.media_type === "image" ? <ImageIcon size={10} /> : <VideoIcon size={10} />}
                      {formatTimeAgo(story.created_at)}
                    </div>
                  </button>
                  {story.caption && (
                    <p className="text-[11px] text-slate-400 truncate px-1">{story.caption}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail modal */}
        {selectedStory && (
          <div className="absolute inset-0 bg-black/80 rounded-2xl flex items-center justify-center z-10">
            <div className="bg-slate-900 rounded-xl p-5 max-w-sm w-full mx-4 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">Story Details</h3>
                <button
                  onClick={() => setSelectedStory(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-800 text-slate-400"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="rounded-lg overflow-hidden mb-4 bg-slate-950">
                {selectedStory.media_type === "image" ? (
                  <img src={selectedStory.media_url} alt="" className="w-full h-44 object-contain" />
                ) : (
                  <video src={selectedStory.media_url} className="w-full h-44 object-contain" controls />
                )}
              </div>

              <div className="space-y-2 mb-4 text-slate-400 text-xs">
                <div className="flex items-center gap-2">
                  <Clock size={14} />
                  <span>Posted {formatTimeAgo(selectedStory.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} />
                  <span>
                    {isStoryActive(selectedStory.expires_at) ? "Expires " : "Expired "}
                    {formatTimeAgo(selectedStory.expires_at)}
                  </span>
                </div>
                {selectedStory.caption && (
                  <div className="p-2.5 bg-slate-800 rounded-lg">
                    <p className="text-slate-300">{selectedStory.caption}</p>
                  </div>
                )}
              </div>

              {selectedStory.user_id === user?.id && viewers.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Eye size={13} /> Viewed by ({viewers.length})
                  </h4>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto">
                    {viewers.map((view: any) => (
                      <div key={view.viewer_id} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
                        <img
                          src={view.user?.avatar_url}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{view.user?.username}</p>
                          <p className="text-[10px] text-slate-500">{formatTimeAgo(view.viewed_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedStory.user_id === user?.id && (
                <button
                  onClick={() => handleDeleteStory(selectedStory.id)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium transition-colors"
                >
                  <Trash2 size={14} />
                  Delete Story
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryArchive;

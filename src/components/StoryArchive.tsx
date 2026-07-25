import React, { useState, useEffect } from "react";
import { Clock, Eye, Trash2, X } from "lucide-react";
import { useStore } from "../hooks/useStore";
import { storyService } from "../services/storyService";
import type { StoryWithDetails, StoryView } from "../services/storyService";

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
  const [activeTab, setActiveTab] = useState<"my-stories" | "all-stories">(
    "my-stories"
  );

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    if (!user) return;

    setLoading(true);

    // Load user's own stories
    const { data: myData } = await storyService.getUserStories(user.id);
    setUserStories(myData || []);

    // Load all previous stories
    const { data: allData } = await storyService.getAllPreviousStories(user.id);
    setAllStories(allData || []);

    setLoading(false);
  };

  const handleViewStory = async (story: StoryWithDetails) => {
    setSelectedStory(story);

    // Load viewers if it's user's own story
    if (story.user_id === user?.id) {
      const { data } = await storyService.getStoryViewers(story.id, user.id);
      setViewers(data || []);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!user) return;

    const confirmed = window.confirm("Delete this story?");
    if (!confirmed) return;

    const { error } = await storyService.deleteStory(storyId, user.id);

    if (!error) {
      setUserStories(userStories.filter((s) => s.id !== storyId));
      setSelectedStory(null);
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const storyDate = new Date(date);
    const diff = now.getTime() - storyDate.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const isStoryExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const stories = activeTab === "my-stories" ? userStories : allStories;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b dark:border-slate-700">
          <h2 className="text-xl font-bold dark:text-white">Story Archive</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full"
          >
            <X size={20} className="dark:text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b dark:border-slate-700">
          <button
            onClick={() => setActiveTab("my-stories")}
            className={`flex-1 px-4 py-3 font-medium transition ${
              activeTab === "my-stories"
                ? "border-b-2 border-blue-500 text-blue-500"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            My Stories
          </button>
          <button
            onClick={() => setActiveTab("all-stories")}
            className={`flex-1 px-4 py-3 font-medium transition ${
              activeTab === "all-stories"
                ? "border-b-2 border-blue-500 text-blue-500"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            All Stories
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 dark:text-gray-400">
              Loading stories...
            </div>
          ) : stories.length === 0 ? (
            <div className="text-center py-8 dark:text-gray-400">
              No stories yet
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {stories.map((story) => (
                <div
                  key={story.id}
                  onClick={() => handleViewStory(story)}
                  className="relative group cursor-pointer rounded-lg overflow-hidden"
                >
                  {story.media_type === "image" ? (
                    <img
                      src={story.media_url}
                      alt="Story"
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <video
                      src={story.media_url}
                      className="w-full h-40 object-cover"
                    />
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <div className="text-white text-center">
                      <p className="text-sm font-semibold">
                        {story.viewCount || 0} views
                      </p>
                      {isStoryExpired(story.expires_at) && (
                        <p className="text-xs text-gray-300">Expired</p>
                      )}
                    </div>
                  </div>

                  {/* Expired badge */}
                  {isStoryExpired(story.expires_at) && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs">
                      Expired
                    </div>
                  )}

                  {/* Time ago */}
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    {formatTimeAgo(story.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Story detail modal */}
        {selectedStory && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg z-50">
            <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-sm w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold dark:text-white">
                  Story Details
                </h3>
                <button
                  onClick={() => setSelectedStory(null)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full"
                >
                  <X size={20} className="dark:text-gray-400" />
                </button>
              </div>

              {/* Story preview */}
              {selectedStory.media_type === "image" ? (
                <img
                  src={selectedStory.media_url}
                  alt="Story"
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              ) : (
                <video
                  src={selectedStory.media_url}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                  controls
                />
              )}

              {/* Details */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Clock size={16} />
                  <span className="text-sm">
                    Posted {formatTimeAgo(selectedStory.created_at)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Clock size={16} />
                  <span className="text-sm">
                    Expires {formatTimeAgo(selectedStory.expires_at)}
                  </span>
                </div>

                {selectedStory.caption && (
                  <div className="p-3 bg-gray-100 dark:bg-slate-800 rounded-lg">
                    <p className="text-sm dark:text-white">{selectedStory.caption}</p>
                  </div>
                )}
              </div>

              {/* Viewers */}
              {selectedStory.user_id === user?.id && viewers.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2 flex items-center gap-2 dark:text-white">
                    <Eye size={16} />
                    Viewed by ({viewers.length})
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {viewers.map((view: any) => (
                      <div
                        key={view.viewer_id}
                        className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-800 rounded"
                      >
                        <img
                          src={view.user?.avatar_url}
                          alt={view.user?.username}
                          className="w-8 h-8 rounded-full"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium dark:text-white">
                            {view.user?.username}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatTimeAgo(view.viewed_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delete button (only for own stories) */}
              {selectedStory.user_id === user?.id && (
                <button
                  onClick={() => {
                    handleDeleteStory(selectedStory.id);
                    setSelectedStory(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  <Trash2 size={16} />
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

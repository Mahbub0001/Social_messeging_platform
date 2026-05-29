import React, { useState, useEffect } from "react";
import { useStore } from "../hooks/useStore";
import { friendService } from "../services/friendService";
import { chatService } from "../services/chatService";
import type { Profile } from "../services/mockDb";
import { X, Users, Loader2 } from "lucide-react";

interface GroupModalProps {
  onClose: () => void;
}

export const GroupModal: React.FC<GroupModalProps> = ({ onClose }) => {
  const { user, fetchConversations, setActiveConversationId } = useStore();
  const [friends, setFriends] = useState<Profile[]>([]);
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      friendService.getFriends(user.id).then(({ data, error }) => {
        if (!error && data) {
          setFriends(data);
        }
      });
    }
  }, [user?.id]);

  const toggleSelectFriend = (friendId: string) => {
    setSelectedIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !user?.id) return;
    if (selectedIds.length === 0) {
      setError("Please select at least one group member.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userIds = [user.id, ...selectedIds];
      const { data: conv, error: createError } = await chatService.createConversation(
        userIds,
        groupName.trim(),
        true // isGroup = true
      );

      if (createError) {
        setError(createError.message);
      } else {
        await fetchConversations();
        if (conv) {
          setActiveConversationId(conv.id);
        }
        onClose();
      }
    } catch (err) {
      setError("Failed to create group.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-violet-600/20 text-violet-400 rounded-lg flex items-center justify-center">
            <Users className="w-4.5 h-4.5" />
          </div>
          <h3 className="text-sm font-bold text-slate-100">Create Group Chat</h3>
        </div>

        <form onSubmit={handleCreate} className="space-y-4 font-sans text-xs">
          {error && (
            <div className="bg-red-950/30 border border-red-800/40 text-red-300 rounded-xl p-2.5">
              {error}
            </div>
          )}

          {/* Group Name input */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">Group Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Design Sync"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500 rounded-xl text-slate-200 placeholder-slate-650 transition-all"
            />
          </div>

          {/* Friends Checklist */}
          <div>
            <label className="block font-semibold text-slate-300 mb-2">
              Select Members ({selectedIds.length})
            </label>
            {friends.length === 0 ? (
              <p className="text-2xs text-slate-500 italic py-2">
                No friends available. You must add friends to create a group.
              </p>
            ) : (
              <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
                {friends.map((friend) => {
                  const isChecked = selectedIds.includes(friend.id);
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => toggleSelectFriend(friend.id)}
                      className="w-full flex items-center justify-between p-2 rounded-xl border hover:bg-slate-800/40 text-left transition-all border-slate-850"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={friend.avatar_url}
                          alt="Avatar"
                          className="w-7 h-7 rounded-full object-cover shrink-0"
                        />
                        <span className="text-xs text-slate-200 truncate">{friend.username}</span>
                      </div>
                      <div className="flex items-center shrink-0 pr-1">
                        <div
                          className={`w-4.5 h-4.5 rounded border flex items-center justify-center transition-all ${
                            isChecked
                              ? "bg-violet-600 border-violet-500 text-white"
                              : "border-slate-800 bg-slate-950"
                          }`}
                        >
                          {isChecked && <span className="text-[10px] font-bold">✓</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Create Action Button */}
          <button
            type="submit"
            disabled={loading || !groupName.trim() || selectedIds.length === 0}
            className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Room...</span>
              </span>
            ) : (
              "Create Group Chat"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default GroupModal;

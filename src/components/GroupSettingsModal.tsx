import React, { useState, useEffect } from "react";
import { useStore } from "../hooks/useStore";
import { chatService } from "../services/chatService";
import { friendService } from "../services/friendService";
import { storageService } from "../services/storageService";
import { X, Users, Loader2, Upload, Trash2, Shield, UserMinus, Plus } from "lucide-react";
import { sanitizeUrl } from "../utils/security";

interface GroupSettingsModalProps {
  conversationId: string;
  onClose: () => void;
}

export const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({ conversationId, onClose }) => {
  const { user, conversations, fetchConversations, setActiveConversationId } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [friends, setFriends] = useState<any[]>([]);

  const conversation = conversations.find(c => c.id === conversationId);
  const amIAdmin = conversation?.members?.find(m => m.id === user?.id)?.role === "admin";

  useEffect(() => {
    if (user?.id) {
      friendService.getFriends(user.id).then(({ data }) => setFriends(data || []));
    }
  }, [user?.id]);

  if (!conversation) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const publicUrl = await storageService.uploadMedia(file, "chat-media");
      await chatService.updateConversation(conversation.id, { avatar_url: publicUrl });
      await fetchConversations();
    } catch (err) {
      setError("Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!user?.id) return;
    if (window.confirm("Are you sure you want to leave this group?")) {
      setLoading(true);
      const { error } = await chatService.removeMember(conversation.id, user.id);
      if (!error) {
        setActiveConversationId(null);
        await fetchConversations();
        onClose();
      } else {
        setError("Failed to leave group.");
        setLoading(false);
      }
    }
  };

  const handleKickMember = async (memberId: string) => {
    if (window.confirm("Remove this member?")) {
      setLoading(true);
      const { error } = await chatService.removeMember(conversation.id, memberId);
      if (!error) {
        await fetchConversations();
      } else {
        setError("Failed to remove member.");
      }
      setLoading(false);
    }
  };

  const handleMakeAdmin = async (memberId: string) => {
    if (window.confirm("Make this member an admin?")) {
      setLoading(true);
      const { error } = await chatService.updateMemberRole(conversation.id, memberId, "admin");
      if (!error) {
        await fetchConversations();
      } else {
        setError("Failed to make admin.");
      }
      setLoading(false);
    }
  };

  const handleAddMember = async (friendId: string) => {
    setLoading(true);
    const { error } = await chatService.addMembers(conversation.id, [friendId]);
    if (!error) {
      await fetchConversations();
    } else {
      setError("Failed to add member.");
    }
    setLoading(false);
  };

  const membersIds = conversation.members?.map(m => m.id) || [];
  const nonMemberFriends = friends.filter(f => !membersIds.includes(f.id));

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 relative max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-violet-600/20 text-violet-400 rounded-lg flex items-center justify-center">
            <Users className="w-4.5 h-4.5" />
          </div>
          <h3 className="text-sm font-bold text-slate-100">Group Settings</h3>
        </div>

        {error && (
          <div className="bg-red-950/30 border border-red-800/40 text-red-300 rounded-xl p-2.5 mb-4 text-xs">
            {error}
          </div>
        )}

        {/* Group Icon (Admins can upload) */}
        <div className="flex flex-col items-center gap-2.5 py-2 mb-6">
          <div className={`relative w-20 h-20 rounded-full overflow-hidden bg-slate-850 border border-slate-800 shadow ${amIAdmin ? 'cursor-pointer group' : ''}`}>
            <img
              src={
                sanitizeUrl(conversation.avatar_url) ||
                `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(conversation.name || "")}`
              }
              alt="Group Avatar"
              className="w-full h-full object-cover"
            />
            {amIAdmin && (
              <>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingImage ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 text-white" />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage || loading}
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  title="Upload group picture"
                />
              </>
            )}
          </div>
          <span className="text-[10px] text-slate-500 font-semibold">{amIAdmin ? 'Click to change group icon' : 'Group Icon'}</span>
          <p className="font-bold text-slate-200 text-sm mt-1">{conversation.name}</p>
        </div>

        {/* Members List */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Members</h4>
          <div className="space-y-2">
            {conversation.members?.map(member => (
              <div key={member.id} className="flex items-center justify-between bg-slate-950/40 p-2 rounded-xl border border-slate-800/50">
                <div className="flex items-center gap-2">
                  <img src={sanitizeUrl(member.avatar_url)} className="w-8 h-8 rounded-full" />
                  <div>
                    <p className="text-xs text-slate-200 font-medium">
                      {member.username} {member.id === user?.id && "(You)"}
                    </p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      {member.role === "admin" && <Shield className="w-3 h-3 text-violet-400" />}
                      {member.role === "admin" ? "Admin" : "Member"}
                    </p>
                  </div>
                </div>

                {amIAdmin && member.id !== user?.id && (
                  <div className="flex gap-1">
                    {member.role !== "admin" && (
                      <button onClick={() => handleMakeAdmin(member.id)} disabled={loading} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors" title="Make Admin">
                        <Shield className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleKickMember(member.id)} disabled={loading} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors" title="Remove Member">
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add Members (Admins only) */}
        {amIAdmin && nonMemberFriends.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Add Friends</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
              {nonMemberFriends.map(friend => (
                <div key={friend.id} className="flex items-center justify-between bg-slate-950/40 p-2 rounded-xl border border-slate-800/50">
                  <div className="flex items-center gap-2">
                    <img src={sanitizeUrl(friend.avatar_url)} className="w-6 h-6 rounded-full" />
                    <p className="text-xs text-slate-200">{friend.username}</p>
                  </div>
                  <button onClick={() => handleAddMember(friend.id)} disabled={loading} className="p-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leave Group Action */}
        <button
          onClick={handleLeaveGroup}
          disabled={loading}
          className="w-full py-2.5 mt-2 bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          <span>Leave Group</span>
        </button>

      </div>
    </div>
  );
};

export default GroupSettingsModal;

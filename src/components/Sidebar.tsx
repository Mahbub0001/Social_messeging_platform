import React, { useState } from "react";
import { useStore } from "../hooks/useStore";
import { authService } from "../services/authService";
import {
  Search,
  MessageSquare,
  Settings,
  LogOut,
  UserPlus,
  Plus,
  Compass,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "../lib/utils";

interface SidebarProps {
  onToggleSettings: () => void;
  onToggleFriends: () => void;
  onCreateGroup: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onToggleSettings,
  onToggleFriends,
  onCreateGroup,
}) => {
  const {
    user,
    conversations,
    activeConversationId,
    setActiveConversationId,
    onlineUsers,
    typingUsers,
    conversationsLoading,
    theme,
    toggleTheme,
  } = useStore();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "direct" | "groups">("all");

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to sign out?")) {
      await authService.signOut();
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    // Type filter
    if (filter === "direct" && conv.is_group) return false;
    if (filter === "groups" && !conv.is_group) return false;

    // Search filter
    if (!search.trim()) return true;
    const query = search.toLowerCase();

    if (conv.is_group) {
      return conv.name?.toLowerCase().includes(query);
    } else {
      // Find other member name
      const otherMember = conv.members?.find((m) => m.id !== user?.id);
      return otherMember?.username.toLowerCase().includes(query);
    }
  });

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 border-r border-slate-800">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-tr from-violet-600 to-indigo-500 rounded-lg">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <span className="text-md font-bold tracking-wider text-slate-100">কথাবার্তা</span>
        </div>
        
        {/* Header Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-all"
          >
            {theme === "dark" ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
          <button
            onClick={onToggleFriends}
            title="Friends & Requests"
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-all"
          >
            <UserPlus className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={onToggleSettings}
            title="Profile Settings"
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-all"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-xl transition-all"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/50 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500 rounded-xl text-xs text-slate-200 placeholder-slate-500 transition-all"
          />
        </div>
      </div>

      {/* Category Tabs & Create Button */}
      <div className="flex items-center justify-between px-3 mb-2">
        <div className="flex gap-1 bg-slate-950/60 p-0.5 border border-slate-800/50 rounded-xl">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "px-3 py-1 text-2xs font-semibold rounded-lg transition-all",
              filter === "all" ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter("direct")}
            className={cn(
              "px-3 py-1 text-2xs font-semibold rounded-lg transition-all",
              filter === "direct" ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"
            )}
          >
            DMs
          </button>
          <button
            onClick={() => setFilter("groups")}
            className={cn(
              "px-3 py-1 text-2xs font-semibold rounded-lg transition-all",
              filter === "groups" ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"
            )}
          >
            Groups
          </button>
        </div>

        <button
          onClick={onCreateGroup}
          title="Create Group"
          className="flex items-center gap-1 px-2.5 py-1 bg-violet-600/10 hover:bg-violet-600 border border-violet-500/20 text-violet-400 hover:text-white text-2xs font-semibold rounded-lg transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Group</span>
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {conversationsLoading ? (
          // Skeleton loader
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-2xl animate-pulse">
              <div className="w-11 h-11 bg-slate-800 rounded-full shrink-0"></div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-3 w-1/3 bg-slate-800 rounded"></div>
                <div className="h-3.5 w-3/4 bg-slate-800 rounded"></div>
              </div>
            </div>
          ))
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 px-4">
            <Compass className="w-10 h-10 text-slate-700 mb-2" />
            <p className="text-xs">No conversations found.</p>
            <button
              onClick={onToggleFriends}
              className="mt-3 text-2xs font-bold text-violet-400 hover:underline hover:text-violet-300"
            >
              Find Friends to Chat
            </button>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = conv.id === activeConversationId;
            let otherMember = conv.members?.find((m) => m.id !== user?.id);

            // Chat Info
            const title = conv.is_group ? conv.name : (otherMember?.username || "Direct Chat");
            const avatar = conv.is_group
              ? (conv.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(title || "")}`)
              : (otherMember?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(title || "")}`);

            // Presence Status
            const isOnline = !conv.is_group && otherMember && onlineUsers.includes(otherMember.id);

            // Typing Status
            const typingList = typingUsers[conv.id] || [];
            // filter out user themselves
            const otherTypingList = typingList.filter((uid) => uid !== user?.id);
            const isTyping = otherTypingList.length > 0;

            // Last message detail
            let previewText = "No messages yet";
            let timeStr = "";

            if (conv.last_message) {
              const msg = conv.last_message;
              const isSelf = msg.sender_id === user?.id;
              
              if (msg.media_type === "image") {
                previewText = isSelf ? "You sent a photo" : "Sent a photo";
              } else if (msg.media_type === "audio") {
                previewText = isSelf ? "You sent a voice message" : "Sent a voice message";
              } else if (msg.media_type === "file") {
                previewText = isSelf ? "You sent a document" : "Sent a document";
              } else if (msg.media_type === "call") {
                try {
                  const callInfo = JSON.parse(msg.content);
                  previewText = callInfo.callType === "video" ? "🎥 Video Call" : "📞 Voice Call";
                } catch (e) {
                  previewText = "Call Log";
                }
              } else {
                previewText = msg.content;
              }

              // Format date/time
              const date = new Date(msg.created_at);
              const today = new Date();
              if (date.toDateString() === today.toDateString()) {
                timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              } else {
                timeStr = date.toLocaleDateString([], { month: "short", day: "numeric" });
              }
            }

            return (
              <button
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left",
                  isSelected
                    ? "bg-violet-600/15 border border-violet-500/20 shadow-md shadow-violet-500/5"
                    : "hover:bg-slate-800/50 border border-transparent"
                )}
              >
                {/* Avatar and status indicator */}
                <div className="relative shrink-0 select-none">
                  <img
                    src={avatar}
                    alt={title || "Chat avatar"}
                    className="w-11 h-11 rounded-full object-cover bg-slate-800 border border-slate-700/60"
                  />
                  {isOnline && (
                    <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-500 border-[2.5px] border-slate-900 rounded-full"></div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-bold text-slate-100 truncate pr-2">
                      {title}
                    </h4>
                    <span className="text-2xs text-slate-500 shrink-0 font-sans">
                      {timeStr}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    {isTyping ? (
                      <span className="text-2xs font-semibold text-violet-400 animate-pulse">
                        typing...
                      </span>
                    ) : (
                      <p className="text-xs text-slate-400 truncate pr-4">
                        {previewText}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Sidebar;

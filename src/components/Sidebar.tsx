import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../hooks/useStore";
import { authService } from "../services/authService";
import { adminService } from "../services/adminService";
import {
  Search,
  MessageSquare,
  LogOut,
  UserPlus,
  Plus,
  Compass,
  Sun,
  Moon,
  Clock,
  Shield,
  Settings,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../lib/utils";
import { sanitizeUrl } from "../utils/security";
import StoryCircles from "./StoryCircles";

interface SidebarProps {
  onToggleSettings: () => void;
  onToggleFriends: () => void;
  onCreateGroup: () => void;
  onStoryArchiveClick: () => void;
  onStoryClick: (userId: string) => void;
  onStoryUploadClick: () => void;
  activeView: "chat" | "feed";
  onViewChange: (view: "chat" | "feed") => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onToggleSettings,
  onToggleFriends,
  onCreateGroup,
  onStoryArchiveClick,
  onStoryClick,
  onStoryUploadClick,
  activeView,
  onViewChange,
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id) {
      setIsAdmin(false);
      return;
    }
    const isMahbub =
      user.user_metadata?.username?.toLowerCase() === "mahbub" ||
      user.email?.toLowerCase().includes("admin");
    if (isMahbub) {
      setIsAdmin(true);
    }
    adminService.getUserProfile(user.id).then((profile) => {
      if (profile?.role === "admin") {
        setIsAdmin(true);
      }
    });
  }, [user?.id, user?.user_metadata?.username, user?.email]);

  // Close menu on outside click
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isMenuOpen]);

  const handleLogout = async () => {
    setIsMenuOpen(false);
    if (window.confirm("Are you sure you want to sign out?")) {
      await authService.signOut();
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    if (filter === "direct" && conv.is_group) return false;
    if (filter === "groups" && !conv.is_group) return false;

    if (!search.trim()) return true;
    const query = search.toLowerCase();

    if (conv.is_group) {
      return conv.name?.toLowerCase().includes(query);
    } else {
      const otherMember = conv.members?.find((m) => m.id !== user?.id);
      return otherMember?.username.toLowerCase().includes(query);
    }
  });

  // Avatar display
  const avatarUrl = (user?.user_metadata as any)?.avatar_url as string | undefined;
  const username = user?.user_metadata?.username ?? user?.email ?? "U";
  const avatarFallbackLetter = username.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 border-r border-slate-800">
      {/* ── Row 1: Brand + Actions ── */}
      <div className="flex items-center justify-between px-4 pt-[max(0.75rem,calc(0.75rem+env(safe-area-inset-top,0px)))] pb-3 bg-slate-900 border-b border-slate-800">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-tr from-violet-600 to-indigo-500 rounded-lg shrink-0">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <span className="text-md font-bold tracking-wider text-slate-100">কথাবার্তা</span>
        </div>

        {/* Right actions: theme toggle + friends + avatar menu */}
        <div className="flex items-center gap-1.5">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-all"
          >
            {theme === "dark" ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>

          {/* Friends Button */}
          <button
            onClick={onToggleFriends}
            title="Friends & Requests"
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-all"
          >
            <UserPlus className="w-4.5 h-4.5" />
          </button>

          {/* Avatar Menu Trigger */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              title="মেনু"
              className="w-8 h-8 rounded-full overflow-hidden border-2 border-slate-700 hover:border-violet-500 transition-all focus:outline-none"
            >
              {avatarUrl ? (
                <img
                  src={sanitizeUrl(avatarUrl)}
                  alt={username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-violet-600 to-indigo-500 text-white text-xs font-bold">
                  {avatarFallbackLetter}
                </div>
              )}
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-52 bg-slate-800/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden"
                >
                  {/* Profile Settings */}
                  <button
                    onClick={() => { onToggleSettings(); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700/60 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>প্রোফাইল সেটিংস</span>
                  </button>

                  {/* Story Archive */}
                  <button
                    onClick={() => { onStoryArchiveClick(); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700/60 transition-colors"
                  >
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>স্টোরি আর্কাইভ</span>
                  </button>

                  {/* Admin Panel (conditional) */}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-violet-300 hover:bg-violet-600/20 transition-colors"
                    >
                      <Shield className="w-4 h-4 text-violet-400 shrink-0" />
                      <span>অ্যাডমিন প্যানেল</span>
                    </Link>
                  )}

                  <div className="border-t border-slate-700/60 mx-2" />

                  {/* Sign Out */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-950/30 transition-colors"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>সাইন আউট</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Row 2: Mode Switcher ── */}
      <div className="px-3 pb-2 pt-2">
        <div className="flex bg-slate-800/60 p-0.5 rounded-xl border border-slate-700/50">
          <button
            onClick={() => onViewChange("chat")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activeView === "chat"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" /> বার্তা
          </button>
          <button
            onClick={() => onViewChange("feed")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activeView === "feed"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" /> ফিড
          </button>
        </div>
      </div>

      {/* ── Chat content (hidden when feed is active) ── */}
      {activeView === "chat" && (
        <>
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

          {/* Stories Carousel */}
          <div className="border-b border-slate-800/60 pb-2 mb-2">
            <StoryCircles
              onStoryClick={onStoryClick}
              onUploadClick={onStoryUploadClick}
            />
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
                const otherMember = conv.members?.find((m) => m.id !== user?.id);

                const title = conv.is_group ? conv.name : (otherMember?.username || "Direct Chat");
                const avatar = conv.is_group
                  ? (conv.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(title || "")}`)
                  : (otherMember?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(title || "")}`);

                const isOnline = !conv.is_group && otherMember && onlineUsers.includes(otherMember.id);

                const typingList = typingUsers[conv.id] || [];
                const otherTypingList = typingList.filter((uid) => uid !== user?.id);
                const isTyping = otherTypingList.length > 0;

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
                  } else if (msg.media_type === "call" || (msg.content && msg.content.startsWith('{"callType":'))) {
                    try {
                      const callInfo = JSON.parse(msg.content);
                      previewText = callInfo.callType === "video" ? "🎥 Video Call" : "📞 Voice Call";
                    } catch (e) {
                      previewText = "Call Log";
                    }
                  } else {
                    previewText = msg.content;
                  }

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
                    <div className="relative shrink-0 select-none">
                      <img
                        src={sanitizeUrl(avatar)}
                        alt={title || "Chat avatar"}
                        className="w-11 h-11 rounded-full object-cover bg-slate-800 border border-slate-700/60"
                      />
                      {isOnline && (
                        <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-500 border-[2.5px] border-slate-900 rounded-full"></div>
                      )}
                    </div>

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
        </>
      )}
    </div>
  );
};

export default Sidebar;

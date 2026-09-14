import React, { useState, useEffect } from "react";
import { useStore } from "../hooks/useStore";
import { chatService } from "../services/chatService";
import { adminService, type AnnouncementItem } from "../services/adminService";
import { supabase } from "../lib/supabase";
import {
  Megaphone,
  X,
  AlertOctagon,
  Bell,
  MessageSquare,
  Sparkles,
  Users,
  UserCircle,
} from "lucide-react";
import { cn } from "../lib/utils";
import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import ProfilePanel from "../components/ProfilePanel";
import FriendsPanel from "../components/FriendsPanel";
import GroupModal from "../components/GroupModal";
import CallScreen from "../components/CallScreen";
import StoryUploadModal from "../components/StoryUploadModal";
import StoryViewer from "../components/StoryViewer";
import { StoryArchive } from "../components/StoryArchive";
import FeedView from "../components/feed/FeedView";
import type { StoryWithDetails } from "../services/storyService";
import { AnimatePresence, motion } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

export const Dashboard: React.FC = () => {
  const { user, activeConversationId, setActiveConversationId, setOnlineUsers, fetchConversations, stories } = useStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showStoryUpload, setShowStoryUpload] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [showStoryArchive, setShowStoryArchive] = useState(false);
  const [viewerStories, setViewerStories] = useState<StoryWithDetails[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [announcement, setAnnouncement] = useState<AnnouncementItem | null>(null);
  const [bannedInfo, setBannedInfo] = useState<{ is_banned: boolean; reason: string | null } | null>(null);
  const [userNotification, setUserNotification] = useState<{ id: string; title: string; content: string; type: string } | null>(null);
  const [activeView, setActiveView] = useState<"chat" | "feed">("chat");

  // Derive isAdmin (same logic as Sidebar)
  const isAdmin =
    user?.user_metadata?.username?.toLowerCase() === "mahbub" ||
    Boolean(user?.email?.toLowerCase().includes("admin"));

  useEffect(() => {
    adminService.getAnnouncements().then((list) => {
      if (list && list.length > 0) {
        const latest = list[0];
        const dismissed = sessionStorage.getItem(`kb_dismissed_${latest.id}`);
        if (!dismissed) {
          setAnnouncement(latest);
        }
      }
    });
  }, []);

  // Check ban status and in-app user notifications
  useEffect(() => {
    if (!user?.id) return;

    // Check ban status
    adminService.getUserProfile(user.id).then((profile) => {
      const isBanned = Boolean(profile?.is_banned);
      const reason = profile?.banned_reason || null;
      if (isBanned) {
        setBannedInfo({ is_banned: true, reason });
      } else {
        setBannedInfo(null);
      }
      useStore.getState().setBannedStatus(isBanned, reason);
    });

    // Check unread user notifications
    if (supabase) {
      supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .then(({ data }: any) => {
          if (data && data[0]) {
            setUserNotification(data[0]);
          }
        });

      // Realtime subscription for instant notification popup on ban/unban and profile status change
      const channel = supabase
        .channel(`user-status-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            if (payload?.new) {
              setUserNotification(payload.new);
              if (payload.new.type === "ban") {
                setBannedInfo({ is_banned: true, reason: payload.new.content });
                useStore.getState().setBannedStatus(true, payload.new.content);
              } else if (payload.new.type === "unban") {
                setBannedInfo(null);
                useStore.getState().setBannedStatus(false, null);
              }
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload: any) => {
            if (payload?.new) {
              const isBanned = Boolean(payload.new.is_banned);
              const reason = payload.new.banned_reason || null;
              setBannedInfo(isBanned ? { is_banned: true, reason } : null);
              useStore.getState().setBannedStatus(isBanned, reason);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribePresence = chatService.trackPresence(user.id, (onlineIds) => setOnlineUsers(onlineIds));
    return () => unsubscribePresence();
  }, [user?.id, setOnlineUsers]);

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribeConv = chatService.subscribeToNewConversations(user.id, () => fetchConversations());
    return () => unsubscribeConv();
  }, [user?.id, fetchConversations]);

  useEffect(() => {
    useStore.getState().fetchActiveStories();
  }, []);

  // Android hardware & gesture back button handling
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let lastBackPress = 0;

    const backListenerPromise = CapApp.addListener("backButton", () => {
      // 1. Close story viewer if open
      if (showStoryViewer) {
        setShowStoryViewer(false);
        return;
      }
      // 2. Close story upload modal if open
      if (showStoryUpload) {
        setShowStoryUpload(false);
        return;
      }
      // 3. Close story archive if open
      if (showStoryArchive) {
        setShowStoryArchive(false);
        return;
      }
      // 4. Close group creation modal if open
      if (showGroupModal) {
        setShowGroupModal(false);
        return;
      }
      // 5. Close settings or friends panel if open
      if (showSettings || showFriends) {
        setShowSettings(false);
        setShowFriends(false);
        return;
      }
      // 6. If inside a conversation on mobile, go back to the chat list
      if (activeConversationId) {
        setActiveConversationId(null);
        return;
      }

      // 7. On root conversation list: exit app if pressed twice within 2 seconds
      const now = Date.now();
      if (now - lastBackPress < 2000) {
        CapApp.exitApp();
      } else {
        lastBackPress = now;
      }
    });

    return () => {
      backListenerPromise.then((handle) => handle.remove());
    };
  }, [
    showStoryViewer,
    showStoryUpload,
    showStoryArchive,
    showGroupModal,
    showSettings,
    showFriends,
    activeConversationId,
    setActiveConversationId,
  ]);

  const handleToggleSettings = () => {
    setShowSettings((prev) => !prev);
    setShowFriends(false);
  };

  const handleToggleFriends = () => {
    setShowFriends((prev) => !prev);
    setShowSettings(false);
  };

  const handleStoryClick = (userId: string) => {
    const userStories = stories.filter((s) => s.user_id === userId);
    setViewerStories(userStories);
    setViewerIndex(0);
    setShowStoryViewer(true);
  };

  const handleUploadComplete = () => {
    useStore.getState().fetchActiveStories();
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden relative">
      {/* Persistent Account Ban Alert Banner */}
      {bannedInfo?.is_banned && (
        <div className="bg-red-950/95 border-b border-red-600/50 px-4 py-2.5 flex items-center justify-between text-xs z-30 shadow-xl text-red-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1 rounded-md bg-red-500/20 text-red-400 shrink-0">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-red-300">অ্যাকাউন্ট স্থগিত (Account Suspended):</span>{" "}
              <span className="text-red-100">{bannedInfo.reason || "কমিউনিটি নীতিমালা লঙ্ঘনের কারণে আপনার অ্যাকাউন্ট সাময়িকভাবে স্থগিত করা হয়েছে।"}</span>{" "}
              <span className="text-3xs text-red-400 hidden sm:inline">(আপনি নতুন কোনো বার্তা পাঠাতে বা স্টোরি আপলোড করতে পারবেন না)</span>
            </div>
          </div>
        </div>
      )}

      {/* User In-App Notification Banner (e.g. Unban) */}
      {userNotification && (
        <div className="bg-emerald-950/95 border-b border-emerald-500/40 px-4 py-2 flex items-center justify-between text-xs z-30 text-emerald-200 shadow-lg animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 shrink-0">
              <Bell className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-emerald-300 shrink-0">{userNotification.title}:</span>
              <span className="text-emerald-100 truncate">{userNotification.content}</span>
            </div>
          </div>
          <button
            onClick={async () => {
              if (supabase) {
                await supabase.from("user_notifications").update({ is_read: true }).eq("id", userNotification.id);
              }
              setUserNotification(null);
            }}
            className="p-1 text-emerald-400 hover:text-white hover:bg-emerald-900/60 rounded-lg shrink-0 ml-2 transition-colors"
            title="নোটিফিকেশন বন্ধ করুন"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Platform Announcement Banner */}
      {announcement && (
        <div className="bg-gradient-to-r from-violet-950 via-slate-900 to-indigo-950 border-b border-violet-500/30 px-4 py-2 flex items-center justify-between text-xs z-30 shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1 rounded-md bg-amber-500/20 text-amber-400 shrink-0">
              <Megaphone className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-violet-300 shrink-0">{announcement.title}:</span>
              <span className="text-slate-300 truncate">{announcement.content}</span>
            </div>
          </div>
          <button
            onClick={() => {
              sessionStorage.setItem(`kb_dismissed_${announcement.id}`, "true");
              setAnnouncement(null);
            }}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg shrink-0 ml-2 transition-colors"
            title="নোটিশ বন্ধ করুন"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-1 h-full w-full relative overflow-hidden">
        {/* Sidebar — hidden on mobile when in feed view or inside a conversation */}
        <div
          className={`h-full w-full md:w-[360px] lg:w-[380px] shrink-0 transition-transform duration-300 md:translate-x-0 absolute md:relative z-10 bg-slate-900 ${
            activeConversationId || activeView === "feed" ? "-translate-x-full md:translate-x-0" : "translate-x-0"
          }`}
        >
          <Sidebar
            onToggleSettings={handleToggleSettings}
            onToggleFriends={handleToggleFriends}
            onCreateGroup={() => setShowGroupModal(true)}
            onStoryArchiveClick={() => setShowStoryArchive(true)}
            onStoryClick={handleStoryClick}
            onStoryUploadClick={() => setShowStoryUpload(true)}
            activeView={activeView}
            onViewChange={setActiveView}
          />
        </div>

        {/* Main content area — FeedView or ChatArea */}
        <div
          className={`h-full w-full md:w-auto flex-1 transition-transform duration-300 md:translate-x-0 absolute md:relative z-0 bg-slate-950 ${
            !activeConversationId || activeView === "feed" ? "translate-x-0" : "translate-x-full md:translate-x-0"
          }`}
        >
          {activeView === "feed" ? (
            <FeedView
              currentUserId={user?.id ?? ""}
              currentUsername={user?.user_metadata?.username ?? "User"}
              currentUserAvatar={(user?.user_metadata as any)?.avatar_url ?? null}
              isAdmin={isAdmin}
            />
          ) : (
            <ChatArea onBack={() => setActiveConversationId(null)} />
          )}
        </div>
      </div>

      {/* Mobile bottom navigation bar */}
      <div className="md:hidden flex items-center justify-around bg-slate-900 border-t border-slate-800 py-2 px-4 pb-[max(0.5rem,calc(0.5rem+env(safe-area-inset-bottom,0px)))] shrink-0">
        <button
          onClick={() => { setActiveView("chat"); setActiveConversationId(null); }}
          className={cn(
            "flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-all",
            activeView === "chat" ? "text-violet-400" : "text-slate-500"
          )}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-medium">চ্যাট</span>
        </button>
        <button
          onClick={() => setActiveView("feed")}
          className={cn(
            "flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-all",
            activeView === "feed" ? "text-indigo-400" : "text-slate-500"
          )}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] font-medium">ফিড</span>
        </button>
        <button
          onClick={handleToggleFriends}
          className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl text-slate-500 hover:text-slate-300 transition-all"
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-medium">ফ্রেন্ডস</span>
        </button>
        <button
          onClick={handleToggleSettings}
          className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl text-slate-500 hover:text-slate-300 transition-all"
        >
          <UserCircle className="w-5 h-5" />
          <span className="text-[10px] font-medium">প্রোফাইল</span>
        </button>
      </div>

      <AnimatePresence>
        {(showSettings || showFriends) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowSettings(false); setShowFriends(false); }}
            className="absolute inset-0 bg-black/60 z-20 backdrop-blur-xs cursor-pointer"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <ProfilePanel
            onClose={() => setShowSettings(false)}
            onOpenStoryArchive={() => { setShowSettings(false); setShowStoryArchive(true); }}
          />
        )}
        {showFriends && <FriendsPanel onClose={() => setShowFriends(false)} />}
      </AnimatePresence>

      {showGroupModal && <GroupModal onClose={() => setShowGroupModal(false)} />}
      <CallScreen />

      {showStoryUpload && (
        <StoryUploadModal
          onClose={() => setShowStoryUpload(false)}
          onUploadComplete={handleUploadComplete}
        />
      )}

      {showStoryViewer && viewerStories.length > 0 && (
        <StoryViewer
          stories={viewerStories}
          initialIndex={viewerIndex}
          onClose={() => setShowStoryViewer(false)}
        />
      )}

      {showStoryArchive && <StoryArchive onClose={() => setShowStoryArchive(false)} />}
    </div>
  );
};

export default Dashboard;

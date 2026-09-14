import React, { useState, useEffect } from "react";
import { useStore } from "../hooks/useStore";
import { chatService } from "../services/chatService";
import { adminService, type AnnouncementItem } from "../services/adminService";
import { Megaphone, X } from "lucide-react";
import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import ProfilePanel from "../components/ProfilePanel";
import FriendsPanel from "../components/FriendsPanel";
import GroupModal from "../components/GroupModal";
import CallScreen from "../components/CallScreen";
import StoryUploadModal from "../components/StoryUploadModal";
import StoryViewer from "../components/StoryViewer";
import { StoryArchive } from "../components/StoryArchive";
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
        <div
          className={`h-full w-full md:w-[320px] shrink-0 transition-transform duration-300 md:translate-x-0 absolute md:relative z-10 bg-slate-900 ${
            activeConversationId ? "-translate-x-full md:translate-x-0" : "translate-x-0"
          }`}
        >
          <Sidebar
            onToggleSettings={handleToggleSettings}
            onToggleFriends={handleToggleFriends}
            onCreateGroup={() => setShowGroupModal(true)}
            onStoryArchiveClick={() => setShowStoryArchive(true)}
            onStoryClick={handleStoryClick}
            onStoryUploadClick={() => setShowStoryUpload(true)}
          />
        </div>

        <div
          className={`h-full w-full md:w-auto flex-1 transition-transform duration-300 md:translate-x-0 absolute md:relative z-0 bg-slate-950 ${
            !activeConversationId ? "translate-x-full md:translate-x-0" : "translate-x-0"
          }`}
        >
          <ChatArea
            onBack={() => setActiveConversationId(null)}
          />
        </div>
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

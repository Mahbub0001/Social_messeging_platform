import React, { useState, useEffect } from "react";
import { useStore } from "../hooks/useStore";
import { chatService } from "../services/chatService";
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
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden relative">
      <div className="flex h-full w-full relative overflow-hidden">
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
          />
        </div>

        <div
          className={`h-full w-full md:w-auto flex-1 transition-transform duration-300 md:translate-x-0 absolute md:relative z-0 bg-slate-950 ${
            !activeConversationId ? "translate-x-full md:translate-x-0" : "translate-x-0"
          }`}
        >
          <ChatArea
            onBack={() => setActiveConversationId(null)}
            onStoryClick={handleStoryClick}
            onStoryUploadClick={() => setShowStoryUpload(true)}
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

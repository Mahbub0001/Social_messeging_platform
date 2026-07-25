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
import { AnimatePresence, motion } from "framer-motion";

export const Dashboard: React.FC = () => {
  const { user, activeConversationId, setActiveConversationId, setOnlineUsers, fetchConversations, stories } = useStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showStoryUpload, setShowStoryUpload] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [showStoryArchive, setShowStoryArchive] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribePresence = chatService.trackPresence(user.id, (onlineIds) => {
      setOnlineUsers(onlineIds);
    });

    return () => {
      unsubscribePresence();
    };
  }, [user?.id, setOnlineUsers]);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribeConv = chatService.subscribeToNewConversations(user.id, () => {
      fetchConversations();
    });

    return () => {
      unsubscribeConv();
    };
  }, [user?.id, fetchConversations]);

  const handleToggleSettings = () => {
    setShowSettings((prev) => !prev);
    setShowFriends(false);
  };

  const handleToggleFriends = () => {
    setShowFriends((prev) => !prev);
    setShowSettings(false);
  };

  const handleStoryClick = (index: number) => {
    setStoryViewerIndex(index);
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
            onClick={() => {
              setShowSettings(false);
              setShowFriends(false);
            }}
            className="absolute inset-0 bg-black/60 z-20 backdrop-blur-xs cursor-pointer"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <ProfilePanel
            onClose={() => setShowSettings(false)}
            onOpenStoryArchive={() => {
              setShowSettings(false);
              setShowStoryArchive(true);
            }}
          />
        )}
        {showFriends && (
          <FriendsPanel onClose={() => setShowFriends(false)} />
        )}
      </AnimatePresence>

      {showGroupModal && (
        <GroupModal onClose={() => setShowGroupModal(false)} />
      )}

      <CallScreen />

      {/* Story modals */}
      {showStoryUpload && (
        <StoryUploadModal
          onClose={() => setShowStoryUpload(false)}
          onUploadComplete={handleUploadComplete}
        />
      )}

      {showStoryViewer && stories.length > 0 && (
        <StoryViewer
          stories={stories}
          initialIndex={storyViewerIndex}
          onClose={() => setShowStoryViewer(false)}
        />
      )}

      {showStoryArchive && (
        <StoryArchive onClose={() => setShowStoryArchive(false)} />
      )}
    </div>
  );
};

export default Dashboard;

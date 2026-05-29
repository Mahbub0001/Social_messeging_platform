import React, { useState, useEffect } from "react";
import { useStore } from "../hooks/useStore";
import { chatService } from "../services/chatService";
import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import ProfilePanel from "../components/ProfilePanel";
import FriendsPanel from "../components/FriendsPanel";
import GroupModal from "../components/GroupModal";
import CallScreen from "../components/CallScreen";
import { AnimatePresence } from "framer-motion";

export const Dashboard: React.FC = () => {
  const { user, activeConversationId, setActiveConversationId, setOnlineUsers, fetchConversations } = useStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);

  // 1. Sync presence online/offline status
  useEffect(() => {
    if (!user?.id) return;

    // Track our online presence state and get update logs of active users
    const unsubscribePresence = chatService.trackPresence(user.id, (onlineIds) => {
      setOnlineUsers(onlineIds);
    });

    return () => {
      unsubscribePresence();
    };
  }, [user?.id, setOnlineUsers]);

  // 2. Listen to new conversations/memberships in real-time
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribeConv = chatService.subscribeToNewConversations(user.id, () => {
      fetchConversations();
    });

    return () => {
      unsubscribeConv();
    };
  }, [user?.id, fetchConversations]);

  // Disable alternate panels on select
  const handleToggleSettings = () => {
    setShowSettings((prev) => !prev);
    setShowFriends(false);
  };

  const handleToggleFriends = () => {
    setShowFriends((prev) => !prev);
    setShowSettings(false);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden relative">
      {/* 2-Column Responsive Layout */}
      <div className="flex h-full w-full relative">
        {/* Sidebar Container */}
        <div
          className={`h-full w-full md:w-[320px] shrink-0 transition-transform duration-300 md:translate-x-0 ${
            activeConversationId ? "hidden md:block" : "block"
          }`}
        >
          <Sidebar
            onToggleSettings={handleToggleSettings}
            onToggleFriends={handleToggleFriends}
            onCreateGroup={() => setShowGroupModal(true)}
          />
        </div>

        {/* Chat Area Container */}
        <div
          className={`h-full flex-1 transition-transform duration-300 ${
            !activeConversationId ? "hidden md:flex" : "flex"
          }`}
        >
          <ChatArea onBack={() => setActiveConversationId(null)} />
        </div>
      </div>

      {/* Slide-out Panels (Settings & Friends) */}
      <AnimatePresence>
        {showSettings && (
          <ProfilePanel onClose={() => setShowSettings(false)} />
        )}
        {showFriends && (
          <FriendsPanel onClose={() => setShowFriends(false)} />
        )}
      </AnimatePresence>

      {/* Centered Modal (Create Group) */}
      {showGroupModal && (
        <GroupModal onClose={() => setShowGroupModal(false)} />
      )}

      {/* Voice & Video Calling Screen */}
      <CallScreen />
    </div>
  );
};

export default Dashboard;

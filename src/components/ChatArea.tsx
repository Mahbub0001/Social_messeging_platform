import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../hooks/useStore";
import { chatService } from "../services/chatService";
import type { MessageWithSender } from "../services/chatService";
import { storageService } from "../services/storageService";
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  Trash2,
  Edit2,
  CornerUpLeft,
  X,
  Download,
  Check,
  CheckCheck,
  Loader2,
  FileText,
  MessageSquare,
  Phone,
  Video,
  Search,
  ArrowLeft,
  Settings,
  Ban,
  AlertOctagon,
} from "lucide-react";
import { cn } from "../lib/utils";
import { sanitizeUrl } from "../utils/security";
import { GroupSettingsModal } from "./GroupSettingsModal";
import { motion, AnimatePresence } from "framer-motion";

interface ChatAreaProps {
  onBack: () => void;
  onOpenUserProfile?: (userId: string) => void;
}

const isSameDay = (d1: Date, d2: Date) => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const formatMessageDateDivider = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) {
    return `Today, ${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
  } else if (isSameDay(date, yesterday)) {
    return `Yesterday, ${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
  } else if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } else {
    return date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
};

const formatMessageTimestamp = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (isSameDay(date, now)) {
    return time;
  }
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) {
    return `Yesterday, ${time}`;
  }
  const datePart = date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${datePart}, ${time}`;
};

export const ChatArea: React.FC<ChatAreaProps> = ({ onBack, onOpenUserProfile }) => {
  const {
    user,
    activeConversationId,
    conversations,
    messages,
    addMessage,
    updateMessageInStore,
    fetchMessages,
    messagesLoading,
    onlineUsers,
    typingUsers,
    startCall,
    blockedUsers,
    blockUser,
    unblockUser,
    isBanned,
    bannedReason,
  } = useStore();

  const [showSearchInput, setShowSearchInput] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [showGroupSettings, setShowGroupSettings] = useState(false);

  const activeChat = conversations.find((c) => c.id === activeConversationId);

  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState<MessageWithSender | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageWithSender | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // Seen and Read Tracking states
  const [partnerLastSeenAt, setPartnerLastSeenAt] = useState<string | null>(null);
  const [initialLastReadAt, setInitialLastReadAt] = useState<string | null>(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Subscribe to messages & seen receipts inside the active conversation
  useEffect(() => {
    if (!activeConversationId) return;

    // Capture previous read timestamp to show the "New Messages / নতুন বার্তা" divider line
    if (user?.id) {
      const myMem = activeChat?.members?.find((m) => m.id === user.id);
      const prevReadAt = chatService.getLastReadTimestamp(activeConversationId, user.id) || myMem?.last_read_at;
      setInitialLastReadAt(prevReadAt || null);
      useStore.getState().markConversationAsRead(activeConversationId);
    }

    // Fetch initial history
    fetchMessages(activeConversationId);

    // Fetch partner's initial last seen timestamp
    const otherMember = activeChat?.members?.find((m) => m.id !== user?.id);
    const initialSeen = chatService.getPartnerLastSeen(activeConversationId, otherMember?.id) || otherMember?.last_read_at;
    setPartnerLastSeenAt(initialSeen || null);

    // Listen to real-time message events
    const unsubscribe = chatService.subscribeToMessages(
      activeConversationId,
      (payload) => {
        if (payload.type === "INSERT") {
          addMessage(activeConversationId, payload.new as MessageWithSender);
        } else if (payload.type === "UPDATE") {
          updateMessageInStore(activeConversationId, payload.new as MessageWithSender);
        }
      }
    );

    // Listen to partner seen receipts
    const unsubscribeSeen = chatService.subscribeToConversationSeen(
      activeConversationId,
      (payload) => {
        if (payload.readerId !== user?.id) {
          setPartnerLastSeenAt(payload.seenAt);
        }
      }
    );

    // Track active typing indicator listener
    const unsubscribeTyping = chatService.subscribeToTyping(
      activeConversationId,
      ({ userId, isTyping }) => {
        useStore.getState().setTypingUser(activeConversationId, userId, isTyping);
      }
    );

    return () => {
      unsubscribe();
      unsubscribeSeen();
      unsubscribeTyping();
    };
  }, [activeConversationId]);

  // Keep partnerLastSeen in sync when activeChat or its members load
  useEffect(() => {
    if (!activeConversationId) return;
    const partner = activeChat?.members?.find((m) => m.id !== user?.id);
    if (partner) {
      const seen = chatService.getPartnerLastSeen(activeConversationId, partner.id) || partner.last_read_at;
      if (seen) {
        setPartnerLastSeenAt(seen);
      }
    }
  }, [activeChat?.id, activeChat?.members]);

  // 2. Auto-scroll on new messages & mark incoming active chat messages as read
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (activeConversationId && user?.id) {
      chatService.markConversationAsRead(activeConversationId, user.id);
    }
  }, [messages[activeConversationId || ""]?.length]);

  // 3. Typing broadcast tracking
  const typingTimeoutRef = useRef<number | null>(null);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!activeConversationId || !user) return;

    // Broadcast "typing: true"
    chatService.sendTypingIndicator(activeConversationId, user.id, true);

    // Clear previous timeout and set a new one to stop typing indicator after idle
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      chatService.sendTypingIndicator(activeConversationId, user.id, false);
    }, 2000);
  };

  // 4. Send Message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBanned) {
      alert("আপনার অ্যাকাউন্ট সাময়িক স্থগিত (Suspended) থাকায় বার্তা পাঠানো সম্ভব নয়।");
      return;
    }
    if ((!inputText.trim() && !replyingTo) || !activeConversationId || !user) return;

    // Clear typing timeout immediately
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      chatService.sendTypingIndicator(activeConversationId, user.id, false);
    }

    const textToSend = inputText;
    const replyId = replyingTo?.id || null;

    // Clean inputs
    setInputText("");
    setReplyingTo(null);

    if (editingMessage) {
      // Perform Edit
      const { data: updatedMsg } = await chatService.editMessage(editingMessage.id, textToSend);
      if (updatedMsg) {
        updateMessageInStore(activeConversationId, updatedMsg as MessageWithSender);
      }
      setEditingMessage(null);
    } else {
      // Perform Send
      const { data: newMsg } = await chatService.sendMessage(
        activeConversationId,
        user.id,
        textToSend,
        null,
        null,
        replyId
      );
      if (newMsg) {
        addMessage(activeConversationId, newMsg);
      }
    }
  };

  // 5. Upload File (D&D / Attachment Icon)
  const handleFileUpload = async (file: File) => {
    if (isBanned) {
      alert("আপনার অ্যাকাউন্ট সাময়িক স্থগিত (Suspended) থাকায় ফাইল পাঠানো সম্ভব নয়।");
      return;
    }
    if (!activeConversationId || !user) return;
    setUploading(true);

    try {
      let mediaType: "image" | "file" | "audio" = "file";
      if (file.type.startsWith("image/")) {
        mediaType = "image";
      } else if (file.type.startsWith("audio/")) {
        mediaType = "audio";
      }

      // Upload file
      const publicUrl = await storageService.uploadMedia(file);

      // Send message referencing media URL
      await chatService.sendMessage(
        activeConversationId,
        user.id,
        file.name,
        publicUrl,
        mediaType
      );
    } catch (err: any) {
      alert("Failed to upload file: " + err.message);
    } finally {
      setUploading(false);
      setDragOver(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => {
    setDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // 6. Voice Recording System
  const startRecording = async () => {
    if (isBanned) {
      alert("আপনার অ্যাকাউন্ট সাময়িক স্থগিত (Suspended) থাকায় ভয়েস রেকর্ড পাঠানো সম্ভব নয়।");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, {
          type: "audio/webm",
        });
        
        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());

        // Upload and send voice clip
        handleFileUpload(audioFile);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordSeconds(0);

      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert("Could not access microphone.");
    }
  };

  const stopRecording = (send: boolean) => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
    }

    if (mediaRecorderRef.current && isRecording) {
      if (send) {
        mediaRecorderRef.current.stop();
      } else {
        // Cancel recording: clear refs, stop tracks
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
        // Stop audio tracks
        const stream = mediaRecorderRef.current.stream;
        stream.getTracks().forEach((track) => track.stop());
      }
      setIsRecording(false);
    }
  };

  // Format Duration helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Reaction Click Handler (WhatsApp-style: single active reaction per user per message)
  const handleReactionClick = async (messageId: string, emoji: string, hasReacted: boolean) => {
    if (!user?.id || !activeConversationId) return;

    const chatMessages = messages[activeConversationId] || [];
    const msg = chatMessages.find((m) => m.id === messageId);
    if (!msg) return;

    // 1. Optimistic Update in UI State
    const currentReactions = { ...msg.reactions };
    
    // Clear any reaction by this user across ALL emojis (WhatsApp-style single reaction)
    Object.keys(currentReactions).forEach((key) => {
      currentReactions[key] = (currentReactions[key] || []).filter((uid) => uid !== user.id);
      if (currentReactions[key].length === 0) {
        delete currentReactions[key];
      }
    });

    // If they clicked a reaction they didn't have, add it
    if (!hasReacted) {
      if (!currentReactions[emoji]) {
        currentReactions[emoji] = [];
      }
      if (!currentReactions[emoji].includes(user.id)) {
        currentReactions[emoji].push(user.id);
      }
    }

    const updatedMsg = {
      ...msg,
      reactions: currentReactions,
    };
    
    updateMessageInStore(activeConversationId, updatedMsg);

    // 2. Call backend service to persist
    try {
      if (hasReacted) {
        await chatService.removeReaction(messageId, user.id, emoji);
      } else {
        await chatService.addReaction(messageId, user.id, emoji);
      }
    } catch (err) {
      console.error("Failed to persist reaction:", err);
    }
  };

  // Derived Chat Metadata & Partner details
  const otherMember = activeChat?.members?.find((m) => m.id !== user?.id);
  const title = activeChat
    ? (activeChat.is_group ? activeChat.name : (otherMember?.username || "Chat"))
    : "Chat";
  const avatar = activeChat
    ? (activeChat.is_group
      ? (activeChat.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(title || "")}`)
      : (otherMember?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(title || "")}`))
    : "";

  const isOnline = Boolean(activeChat && !activeChat.is_group && otherMember?.id && onlineUsers.includes(otherMember.id));
  const activeMessages = (activeChat ? messages[activeChat.id] : null) || [];

  const amIBlockingPartner = Boolean(activeChat && !activeChat.is_group && otherMember?.id && blockedUsers.includes(otherMember.id));

  const filteredMessages = React.useMemo(() => {
    if (!activeChat) return [];
    return activeMessages.filter((msg) => {
      if (!msg) return false;
      if (amIBlockingPartner && msg.sender_id !== user?.id) return false;
      if (!messageSearchQuery.trim()) return true;
      return (msg.content || "").toLowerCase().includes(messageSearchQuery.toLowerCase());
    });
  }, [activeChat, activeMessages, amIBlockingPartner, messageSearchQuery, user?.id]);

  // Identify first unread message from partner for "New Messages" banner (MUST BE BEFORE EARLY RETURN)
  const firstUnreadMessageId = React.useMemo(() => {
    if (!activeChat || !initialLastReadAt) return null;
    const prevTime = new Date(initialLastReadAt).getTime();
    if (isNaN(prevTime)) return null;
    const first = filteredMessages.find(
      (m) =>
        m &&
        m.sender_id !== user?.id &&
        new Date(m.created_at).getTime() > prevTime
    );
    return first?.id || null;
  }, [activeChat, filteredMessages, initialLastReadAt, user?.id]);

  // Identify last sent message seen by partner for Messenger-style seen avatar (MUST BE BEFORE EARLY RETURN)
  const lastSeenSentMessageId = React.useMemo(() => {
    if (!activeChat || !partnerLastSeenAt) return null;
    const partnerSeenTime = new Date(partnerLastSeenAt).getTime();
    if (isNaN(partnerSeenTime)) return null;
    for (let i = filteredMessages.length - 1; i >= 0; i--) {
      const m = filteredMessages[i];
      if (m && m.sender_id === user?.id) {
        const msgTime = new Date(m.created_at).getTime();
        if (!isNaN(msgTime) && msgTime <= partnerSeenTime + 1000) {
          return m.id;
        }
      }
    }
    return null;
  }, [activeChat, filteredMessages, partnerLastSeenAt, user?.id]);

  // Typing status details
  const typingList = activeChat ? (typingUsers[activeChat.id] || []) : [];
  const otherTypingList = typingList.filter((uid) => uid !== user?.id);
  const isTyping = otherTypingList.length > 0;

  const handleToggleBlock = async () => {
    if (!user || !otherMember?.id) return;
    if (amIBlockingPartner) {
      await unblockUser(user.id, otherMember.id);
    } else {
      if (window.confirm(`Are you sure you want to block ${otherMember.username || "this user"}?`)) {
        await blockUser(user.id, otherMember.id);
      }
    }
  };

  // Render WhatsApp-style tick receipts: Sent (single check), Delivered (double grey), Seen (double sky blue)
  const renderMessageTicks = (createdAt: string) => {
    if (!activeChat) return null;
    const msgTime = new Date(createdAt).getTime();
    const isPartnerOnline = !activeChat.is_group && otherMember?.id && onlineUsers.includes(otherMember.id);
    const isSeen = partnerLastSeenAt
      ? msgTime <= new Date(partnerLastSeenAt).getTime() + 1000
      : false;

    if (isSeen) {
      return (
        <span title="Seen" className="inline-flex items-center text-sky-400">
          <CheckCheck className="w-3.5 h-3.5 drop-shadow-[0_0_2px_rgba(56,189,248,0.6)]" />
        </span>
      );
    }

    if (isPartnerOnline || activeChat.is_group) {
      return (
        <span title="Delivered" className="inline-flex items-center text-white/70">
          <CheckCheck className="w-3.5 h-3.5" />
        </span>
      );
    }

    return (
      <span title="Sent" className="inline-flex items-center text-white/50">
        <Check className="w-3 h-3" />
      </span>
    );
  };

  // Fallback placeholder when no chat is selected (rendered AFTER all hooks have executed)
  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950/60 select-none transition-colors">
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-20 h-20 bg-gradient-to-tr from-violet-600 to-indigo-500 rounded-3xl flex items-center justify-center shadow-xl shadow-violet-500/20 mb-6"
          >
            <MessageSquare className="w-10 h-10 text-white" />
          </motion.div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 font-sans">কথাবার্তা চ্যাট রুম</h3>
          <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
            Select a conversation from the sidebar or find friends to start messaging securely.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 relative transition-colors",
        dragOver && "bg-slate-200/60 dark:bg-slate-900/60 backdrop-blur-sm border-2 border-dashed border-violet-500/40"
      )}
    >
      {/* Drag & Drop Overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none text-violet-500 dark:text-violet-400">
          <Download className="w-12 h-12 mb-2 animate-bounce" />
          <p className="text-sm font-bold font-sans">Drop files here to upload instantly</p>
        </div>
      )}

      {/* Chat Area Header */}
      <div className="flex items-center justify-between px-4 pt-[max(0.75rem,calc(0.75rem+env(safe-area-inset-top,0px)))] pb-3 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors shadow-2xs">
        {showSearchInput ? (
          <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-300/80 dark:border-slate-800 animate-slideDown shadow-2xs">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Search messages in this thread..."
              value={messageSearchQuery}
              onChange={(e) => setMessageSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none font-sans"
              autoFocus
            />
            <button
              onClick={() => {
                setShowSearchInput(false);
                setMessageSearchQuery("");
              }}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* Mobile Back Button */}
            <button
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Avatar */}
            <div 
              onClick={() => !activeChat.is_group && otherMember?.id && onOpenUserProfile?.(otherMember.id)}
              className={cn("relative select-none", !activeChat.is_group && "cursor-pointer hover:opacity-90 transition-opacity")}
              title={!activeChat.is_group ? "View Profile" : undefined}
            >
              <img src={sanitizeUrl(avatar)} alt={title || "Chat avatar"} className="w-10 h-10 rounded-full object-cover bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 hover:ring-2 hover:ring-violet-500/50 transition-all" />
              {isOnline && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-100 dark:border-slate-900 rounded-full ring-1 ring-emerald-500/30"></div>
              )}
            </div>

            <div
              onClick={() => !activeChat.is_group && otherMember?.id && onOpenUserProfile?.(otherMember.id)}
              className={cn(!activeChat.is_group && "cursor-pointer group")}
              title={!activeChat.is_group ? "View Profile" : undefined}
            >
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-violet-500 transition-colors">{title}</h3>
              {activeChat.is_group ? (
                <p className="text-2xs text-slate-500 dark:text-slate-400 font-sans">
                  {activeChat.members?.length || 0} members
                </p>
              ) : isTyping ? (
                <p className="text-2xs text-violet-600 dark:text-violet-400 font-semibold animate-pulse font-sans">
                  typing...
                </p>
              ) : isOnline ? (
                <p className="text-2xs text-emerald-600 dark:text-emerald-400 font-semibold font-sans">Online</p>
              ) : (
                <p className="text-2xs text-slate-400 dark:text-slate-500 font-sans">
                  {otherMember?.last_seen
                    ? `last seen ${new Date(otherMember.last_seen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : "Offline"}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Call and Search Actions */}
        <div className="flex items-center gap-1.5 select-none shrink-0 ml-4">
          {!showSearchInput && (
            <button
              onClick={() => setShowSearchInput(true)}
              title="Search messages"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-800/80 rounded-xl transition-all"
            >
              <Search className="w-4.5 h-4.5" />
            </button>
          )}

          {!activeChat.is_group && otherMember && (
            <>
              <button
                onClick={() => startCall(otherMember, "voice", activeChat.id)}
                title="Voice Call"
                disabled={amIBlockingPartner || isBanned}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-800/80 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Phone className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={() => startCall(otherMember, "video", activeChat.id)}
                title="Video Call"
                disabled={amIBlockingPartner || isBanned}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-800/80 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Video className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={handleToggleBlock}
                title={amIBlockingPartner ? "Unblock User" : "Block User"}
                className={`p-2 rounded-xl transition-all ${amIBlockingPartner ? "text-red-500 bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-900/50" : "text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-slate-200/80 dark:hover:bg-slate-800/80"}`}
              >
                <Ban className="w-4.5 h-4.5" />
              </button>
            </>
          )}

          {activeChat.is_group && (
            <button
              onClick={() => setShowGroupSettings(true)}
              title="Group Settings"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-800/80 rounded-xl transition-all"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>

      {showGroupSettings && activeChat.is_group && (
        <GroupSettingsModal
          conversationId={activeChat.id}
          onClose={() => setShowGroupSettings(false)}
        />
      )}

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3 bg-slate-50 dark:bg-slate-950 transition-colors">
        {messagesLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 gap-2 font-sans">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            <p className="text-xs">Decrypting messages...</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 text-xs font-sans">
            <Smile className="w-8 h-8 mb-2 opacity-40" />
            <p>{messageSearchQuery ? "No matching messages found." : "Say hello to start the conversation!"}</p>
          </div>
        ) : (
          filteredMessages.map((msg, idx) => {
            const isSelf = msg.sender_id === user?.id;
            const isDeleted = msg.content === "This message was deleted";
            const reactions = msg.reactions || {};

            const prevMsg = idx > 0 ? filteredMessages[idx - 1] : null;
            const showDateDivider =
              !prevMsg || !isSameDay(new Date(msg.created_at), new Date(prevMsg.created_at));

            return (
              <React.Fragment key={msg.id}>
                {showDateDivider && (
                  <div className="flex items-center justify-center my-3 select-none">
                    <span className="px-3.5 py-1 bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-[11px] font-medium shadow-2xs backdrop-blur-sm font-sans">
                      {formatMessageDateDivider(msg.created_at)}
                    </span>
                  </div>
                )}

                {/* "New Messages / নতুন বার্তা" divider line */}
                {msg.id === firstUnreadMessageId && (
                  <div className="flex items-center justify-center my-3.5 select-none">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                    <span className="mx-3 px-3 py-0.5 bg-violet-500/10 dark:bg-violet-500/20 border border-violet-500/30 text-violet-600 dark:text-violet-400 rounded-full text-[10px] font-bold tracking-wide shadow-2xs font-sans">
                      নতুন বার্তা / New Messages
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  onMouseEnter={() => setHoveredMessageId(msg.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                  className={cn("flex flex-col max-w-[78%] md:max-w-[70%] relative group/msg", isSelf ? "ml-auto items-end" : "mr-auto items-start")}
                >
                  {/* Quoted Reply context */}
                  {msg.reply_to && !isDeleted && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-200/80 dark:bg-slate-900 border-l-2 border-violet-500 rounded-t-xl text-2xs text-slate-600 dark:text-slate-400 mb-0.5 select-none shrink-0">
                      <span className="font-semibold text-violet-600 dark:text-violet-300">
                        {msg.reply_to.sender_id === user?.id ? "You" : msg.reply_to.sender?.username}:
                      </span>
                      <span className="truncate max-w-[120px]">{msg.reply_to.content}</span>
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div className="flex items-center gap-2 group">
                    {/* Reaction and Action panel on hover */}
                    {hoveredMessageId === msg.id && !isDeleted && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "absolute top-[-30px] z-10 flex items-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-full px-2 py-1 shadow-lg gap-1.5 scale-95 transition-transform",
                          isSelf ? "right-2" : "left-2"
                        )}
                      >
                        {/* Reaction options */}
                        {["👍", "❤️", "😂", "🔥"].map((emoji) => {
                          const hasReacted = reactions[emoji]?.includes(user?.id || "");
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleReactionClick(msg.id, emoji, hasReacted)}
                              className={cn(
                                "text-xs hover:scale-125 transition-transform p-0.5 rounded",
                                hasReacted && "bg-slate-100 dark:bg-slate-800"
                              )}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                        <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-800"></div>
                        
                        {/* Action options */}
                        <button
                          onClick={() => setReplyingTo(msg)}
                          title="Reply"
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5"
                        >
                          <CornerUpLeft className="w-3.5 h-3.5" />
                        </button>

                        {isSelf && (
                          <>
                            {!(msg.media_type === "call" || (msg.content && msg.content.startsWith('{"callType":'))) && (
                              <button
                                onClick={() => {
                                  setEditingMessage(msg);
                                  setInputText(msg.content);
                                }}
                                title="Edit"
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (window.confirm("Delete this message for everyone?")) {
                                  chatService.deleteMessage(msg.id);
                                }
                              }}
                              title="Delete"
                              className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Actual text / media bubble */}
                    {msg.media_type === "call" || (msg.content && msg.content.startsWith('{"callType":')) ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setHoveredMessageId(hoveredMessageId === msg.id ? null : msg.id);
                        }}
                        className={cn(
                          "p-3.5 rounded-2xl relative shadow-xs text-xs leading-relaxed break-words border flex flex-col gap-2 min-w-[210px] cursor-pointer select-none",
                          isSelf
                            ? "bg-violet-600 text-white rounded-tr-xs border-violet-500"
                            : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-tl-xs border-slate-200 dark:border-slate-800 shadow-2xs"
                        )}
                      >
                        {/* Call Log Card */}
                        {(() => {
                          let callInfo: any = null;
                          try {
                            callInfo = JSON.parse(msg.content);
                          } catch (e) {
                            return <p>Call log data corrupted</p>;
                          }

                          const isCallTypeVideo = callInfo.callType === "video";
                          const isIncoming = callInfo.receiverId === user?.id;
                          const status = callInfo.status;
                          const duration = callInfo.duration;

                          let durationText = "";
                          if (status === "completed") {
                            if (duration < 60) {
                              durationText = `${duration}s`;
                            } else {
                              durationText = `${Math.floor(duration / 60)}m ${duration % 60}s`;
                            }
                          }

                          let statusText = "";
                          let statusColor = isSelf ? "text-violet-200" : "text-slate-400";

                          if (isIncoming) {
                            if (status === "completed") {
                              statusText = `Incoming (${durationText})`;
                              statusColor = "text-emerald-500 dark:text-emerald-400";
                            } else if (status === "missed") {
                              statusText = "Missed Call";
                              statusColor = "text-red-500 dark:text-red-400";
                            } else if (status === "declined") {
                              statusText = "Declined";
                              statusColor = "text-red-500/80 dark:text-red-400/80";
                            }
                          } else {
                            if (status === "completed") {
                              statusText = `Outgoing (${durationText})`;
                              statusColor = isSelf ? "text-violet-100" : "text-violet-500 dark:text-violet-400";
                            } else if (status === "missed") {
                              statusText = "Cancelled";
                              statusColor = isSelf ? "text-violet-200/80" : "text-slate-400";
                            } else if (status === "declined") {
                              statusText = "No Answer";
                              statusColor = isSelf ? "text-violet-200/80" : "text-slate-400";
                            }
                          }

                          return (
                            <>
                              <div className="flex items-center gap-3">
                                {/* Call Type Icon with Badge */}
                                <div className={cn(
                                  "relative p-2.5 rounded-xl flex items-center justify-center shrink-0 border",
                                  isSelf
                                    ? "bg-violet-700/60 border-violet-400/40 text-white"
                                    : "bg-slate-100 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                                )}>
                                  {isCallTypeVideo ? (
                                    <Video className="w-5 h-5" />
                                  ) : (
                                    <Phone className="w-5 h-5" />
                                  )}
                                  
                                  {/* Arrow Overlay */}
                                  <div className={cn(
                                    "absolute -bottom-1 -right-1 p-0.5 rounded-full border flex items-center justify-center",
                                    isSelf ? "bg-violet-800 border-violet-600" : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                                  )}>
                                    {isIncoming ? (
                                      status === "completed" ? (
                                        <svg className="w-2.5 h-2.5 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 5L5 19M5 19h10M5 19V9" />
                                        </svg>
                                      ) : (
                                        <svg className="w-2.5 h-2.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 5L5 19M5 19h10M5 19V9" />
                                        </svg>
                                      )
                                    ) : (
                                      <svg className={cn("w-2.5 h-2.5", isSelf ? "text-white" : "text-violet-500 dark:text-violet-400")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 19L19 5M19 5H9M19 5v10" />
                                      </svg>
                                    )}
                                  </div>
                                </div>

                                {/* Title and Subtitle details */}
                                <div className="flex-1 min-w-0">
                                  <h4 className={cn("text-xs font-semibold truncate", isSelf ? "text-white" : "text-slate-800 dark:text-slate-100")}>
                                    {isCallTypeVideo ? "Video Call" : "Voice Call"}
                                  </h4>
                                  <p className={cn("text-[10px] font-medium tracking-wide mt-0.5", statusColor)}>
                                    {statusText}
                                  </p>
                                </div>
                              </div>

                              {/* Call Back Button */}
                              {otherMember && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startCall(otherMember, callInfo.callType, activeChat?.id);
                                  }}
                                  className={cn(
                                    "w-full mt-1.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all flex items-center justify-center gap-1 active:scale-[0.98]",
                                    isSelf
                                      ? "bg-violet-700/80 hover:bg-violet-700 text-white border border-violet-400/30"
                                      : "bg-slate-100 dark:bg-slate-950/60 hover:bg-slate-200 dark:hover:bg-slate-950 border border-slate-200 dark:border-slate-800 text-violet-600 dark:text-violet-400"
                                  )}
                                >
                                  {isCallTypeVideo ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                                  <span>Call Back</span>
                                </button>
                              )}
                            </>
                          );
                        })()}

                        {/* Footer time stamp */}
                        <div
                          title={new Date(msg.created_at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
                          className={cn(
                            "flex items-center justify-end gap-1.5 text-[9px] mt-0.5 select-none font-mono",
                            isSelf ? "text-violet-200/80" : "text-slate-400 dark:text-slate-500"
                          )}
                        >
                          <span>{formatMessageTimestamp(msg.created_at)}</span>
                          {isSelf && renderMessageTicks(msg.created_at)}
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setHoveredMessageId(hoveredMessageId === msg.id ? null : msg.id);
                        }}
                        className={cn(
                          "px-4 py-2.5 relative shadow-xs text-xs leading-relaxed break-words cursor-pointer select-none transition-shadow",
                          isDeleted
                            ? "bg-slate-200/60 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 border border-slate-300/40 dark:border-slate-800/40 italic font-sans rounded-2xl"
                            : isSelf
                            ? "bg-violet-600 text-white font-sans rounded-2xl rounded-tr-xs shadow-violet-500/10"
                            : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans border border-slate-200/90 dark:border-slate-800/90 rounded-2xl rounded-tl-xs shadow-2xs"
                        )}
                      >
                        {/* Media Render */}
                        {!isDeleted && msg.media_url && (
                          <div className="mb-2 max-w-[220px] overflow-hidden rounded-xl">
                            {msg.media_type === "image" ? (
                              <img
                                src={sanitizeUrl(msg.media_url)}
                                alt="Attachment"
                                className="object-cover cursor-pointer hover:opacity-90 transition-opacity w-full max-h-[180px] rounded-lg"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(sanitizeUrl(msg.media_url), "_blank");
                                }}
                              />
                            ) : msg.media_type === "audio" ? (
                              <audio 
                                src={sanitizeUrl(msg.media_url)} 
                                controls 
                                onClick={(e) => e.stopPropagation()}
                                className="w-[190px] h-8 bg-transparent" 
                              />
                            ) : (
                              <a
                                href={sanitizeUrl(msg.media_url)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                   "flex items-center gap-2 p-2 rounded-lg border text-2xs hover:underline",
                                  isSelf
                                    ? "bg-violet-700/60 border-violet-500/40 text-white"
                                    : "bg-slate-100 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                                )}
                              >
                                <FileText className={cn("w-4 h-4 shrink-0", isSelf ? "text-violet-200" : "text-violet-500 dark:text-violet-400")} />
                                <span className="truncate max-w-[130px]">{msg.content}</span>
                              </a>
                            )}
                          </div>
                        )}

                        {/* Text Body */}
                        {!(msg.media_url && msg.media_type !== "image") && (
                          <p className={cn(isDeleted && "italic")}>{msg.content}</p>
                        )}

                        {/* Footer stats: Edit tag + time + check receipts */}
                        <div
                          title={new Date(msg.created_at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
                          className={cn(
                            "flex items-center justify-end gap-1.5 mt-1 select-none text-[9px] font-mono",
                            isSelf ? "text-violet-200/80" : "text-slate-400 dark:text-slate-500"
                          )}
                        >
                          {msg.is_edited && !isDeleted && <span className="italic text-[8px]">edited</span>}
                          <span>{formatMessageTimestamp(msg.created_at)}</span>
                          {isSelf && renderMessageTicks(msg.created_at)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reactions list */}
                  {Object.keys(reactions).length > 0 && !isDeleted && (
                    <div className="flex flex-wrap gap-1 mt-1 z-0">
                      {Object.keys(reactions).map((emoji) => {
                        const rawUsers = reactions[emoji];
                        const users = Array.isArray(rawUsers) ? rawUsers : [];
                        const userHasReacted = users.includes(user?.id || "");
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleReactionClick(msg.id, emoji, userHasReacted)}
                            className={cn(
                              "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors shadow-2xs",
                              userHasReacted && "border-violet-500/50 bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-300"
                            )}
                          >
                            <span>{emoji}</span>
                            <span>{users.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Messenger-style Seen Avatar Receipt */}
                  {msg.id === lastSeenSentMessageId && otherMember && !activeChat.is_group && (
                    <div className="flex items-center justify-end gap-1.5 mt-1 pr-1 select-none animate-in fade-in duration-300">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans font-medium">Seen</span>
                      <img
                        src={sanitizeUrl(
                          otherMember.avatar_url ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(otherMember.username || "User")}`
                        )}
                        alt={otherMember.username || "User"}
                        title={`Seen by ${otherMember.username || "User"}`}
                        className="w-3.5 h-3.5 rounded-full object-cover border border-white dark:border-slate-800 shadow-2xs ring-1 ring-violet-500/30"
                      />
                    </div>
                  )}
                </motion.div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Subscribing / loading spinner footer */}
      {uploading && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-200/70 dark:bg-slate-900/40 text-2xs text-slate-600 dark:text-slate-400 font-sans border-t border-slate-200 dark:border-slate-800">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
          <span>Uploading media attachment...</span>
        </div>
      )}

      {/* Quoted Message Reply Bar */}
      {replyingTo && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-100/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 font-sans backdrop-blur-md">
          <div className="flex items-start gap-2 border-l-2 border-violet-500 pl-3">
            <div>
              <p className="text-2xs text-slate-500 dark:text-slate-400 font-semibold">
                Replying to {replyingTo.sender_id === user?.id ? "yourself" : replyingTo.sender?.username}
              </p>
              <p className="text-xs text-slate-800 dark:text-slate-200 truncate max-w-[400px]">
                {replyingTo.content}
              </p>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200/80 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edit Mode Preview Bar */}
      {editingMessage && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-100/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 font-sans backdrop-blur-md">
          <div className="flex items-start gap-2 border-l-2 border-amber-500 pl-3">
            <div>
              <p className="text-2xs text-amber-600 dark:text-amber-400 font-semibold">Editing message</p>
              <p className="text-xs text-slate-800 dark:text-slate-200 truncate max-w-[400px]">
                {editingMessage.content}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setInputText("");
            }}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200/80 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {amIBlockingPartner ? (
        <div className="px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center">
          <p className="text-slate-500 text-sm font-sans flex items-center gap-2">
            <Ban className="w-4 h-4" /> You blocked this user. You can't send messages or call them.
          </p>
        </div>
      ) : isBanned ? (
        <div className="px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-red-950/40 border-t border-red-900/60 flex items-center justify-center shadow-inner">
          <p className="text-red-300 text-xs font-medium flex items-center gap-2 text-center">
            <AlertOctagon className="w-4 h-4 text-red-500 shrink-0" />
            <span>
              আপনার অ্যাকাউন্ট সাময়িক স্থগিত (Suspended) থাকায় বার্তা পাঠানো বন্ধ রয়েছে।{bannedReason ? ` কারণ: ${bannedReason}।` : ""} অ্যাডমিন আনব্যান করলে পুনরায় বার্তা পাঠানো যাবে।
            </span>
          </p>
        </div>
      ) : (
      /* Input Action Controls */
      <form onSubmit={handleSend} className="px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-slate-100/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 backdrop-blur-md flex items-center gap-2.5 transition-colors">
        {/* Hidden File input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileUpload(e.target.files[0]);
            }
          }}
          className="hidden"
        />

        {/* Attachment Options */}
        <button
          type="button"
          disabled={isRecording}
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-white dark:bg-slate-950/60 border border-slate-300/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50 shrink-0 shadow-2xs"
        >
          <Paperclip className="w-4.5 h-4.5" />
        </button>

        {/* Recording / Voice message active area */}
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl px-4 py-1.5 text-xs text-red-600 dark:text-red-300 font-sans shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
              <span className="font-semibold">Recording: {formatTime(recordSeconds)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => stopRecording(false)}
                className="px-2.5 py-1 text-2xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => stopRecording(true)}
                className="px-2.5 py-1 text-2xs bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-md shadow-red-600/10 transition-colors"
              >
                Send Voice
              </button>
            </div>
          </div>
        ) : (
          /* Text input field */
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder={editingMessage ? "Edit message..." : "Type a message..."}
              className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-slate-950/70 border border-slate-300/80 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all font-sans shadow-2xs"
            />
            {/* Smile icon placeholder */}
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <Smile className="w-4.5 h-4.5" />
            </button>
          </div>
        )}

        {/* Send or Voice Record Action Button */}
        <AnimatePresence mode="wait">
          {inputText.trim() || editingMessage ? (
            <motion.button
              key="send-btn"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.15 }}
              type="submit"
              title="Send message"
              className="p-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-md shadow-violet-500/25 transition-colors shrink-0"
            >
              <Send className="w-4.5 h-4.5" />
            </motion.button>
          ) : (
            !isRecording && (
              <motion.button
                key="mic-btn"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                whileTap={{ scale: 0.92 }}
                transition={{ duration: 0.15 }}
                type="button"
                onClick={startRecording}
                title="Record voice message"
                className="p-2.5 bg-white dark:bg-slate-950/60 border border-slate-300/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl transition-colors shrink-0 shadow-2xs"
              >
                <Mic className="w-4.5 h-4.5" />
              </motion.button>
            )
          )}
        </AnimatePresence>
      </form>
      )}
    </div>
  );
};

export default ChatArea;

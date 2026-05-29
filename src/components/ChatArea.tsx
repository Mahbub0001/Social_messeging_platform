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
  CheckCheck,
  Loader2,
  FileText,
  MessageSquare,
  Phone,
  Video,
  Search,
} from "lucide-react";
import { cn } from "../lib/utils";

interface ChatAreaProps {
  onBack: () => void; // Mobile back button
}

export const ChatArea: React.FC<ChatAreaProps> = ({ onBack }) => {
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
  } = useStore();

  const [showSearchInput, setShowSearchInput] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");

  const activeChat = conversations.find((c) => c.id === activeConversationId);

  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState<MessageWithSender | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageWithSender | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Subscribe to messages inside the active conversation
  useEffect(() => {
    if (!activeConversationId) return;

    // Fetch initial history
    fetchMessages(activeConversationId);

    // Listen to real-time events
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

    // Track active typing indicator listener
    const unsubscribeTyping = chatService.subscribeToTyping(
      activeConversationId,
      ({ userId, isTyping }) => {
        useStore.getState().setTypingUser(activeConversationId, userId, isTyping);
      }
    );

    return () => {
      unsubscribe();
      unsubscribeTyping();
    };
  }, [activeConversationId]);

  // 2. Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      await chatService.editMessage(editingMessage.id, textToSend);
      setEditingMessage(null);
    } else {
      // Perform Send
      await chatService.sendMessage(
        activeConversationId,
        user.id,
        textToSend,
        null,
        null,
        replyId
      );
    }
  };

  // 5. Upload File (D&D / Attachment Icon)
  const handleFileUpload = async (file: File) => {
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

  // Chat Metadata
  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950/60 p-6 text-center select-none">
        <div className="w-20 h-20 bg-gradient-to-tr from-violet-600 to-indigo-500 rounded-3xl flex items-center justify-center shadow-lg shadow-violet-500/10 mb-6 animate-pulse">
          <MessageSquare className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-xl font-bold text-slate-200 mb-2 font-sans">কোথাবার্তা চ্যাট রুম</h3>
        <p className="max-w-xs text-xs text-slate-500 leading-relaxed font-sans">
          Select a chat room from the sidebar or add friends to open a secure direct channel.
        </p>
      </div>
    );
  }

  const otherMember = activeChat.members?.find((m) => m.id !== user?.id);
  const title = activeChat.is_group ? activeChat.name : (otherMember?.username || "Chat");
  const avatar = activeChat.is_group
    ? (activeChat.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(title || "")}`)
    : (otherMember?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(title || "")}`);

  const isOnline = !activeChat.is_group && otherMember && onlineUsers.includes(otherMember.id);
  const activeMessages = messages[activeChat.id] || [];

  const filteredMessages = activeMessages.filter((msg) => {
    if (!messageSearchQuery.trim()) return true;
    return msg.content.toLowerCase().includes(messageSearchQuery.toLowerCase());
  });

  // Typing status details
  const typingList = typingUsers[activeChat.id] || [];
  const otherTypingList = typingList.filter((uid) => uid !== user?.id);
  const isTyping = otherTypingList.length > 0;
  
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex-1 flex flex-col h-full bg-slate-950/95 relative",
        dragOver && "bg-slate-900/60 backdrop-blur-sm border-2 border-dashed border-violet-500/40"
      )}
    >
      {/* Drag & Drop Overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none text-violet-400">
          <Download className="w-12 h-12 mb-2 animate-bounce" />
          <p className="text-sm font-bold font-sans">Drop files here to upload instantly</p>
        </div>
      )}

      {/* Chat Area Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        {showSearchInput ? (
          <div className="flex-1 flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800 animate-slideDown">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Search messages in this thread..."
              value={messageSearchQuery}
              onChange={(e) => setMessageSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none text-xs text-slate-200 placeholder-slate-600 focus:outline-none font-sans"
              autoFocus
            />
            <button
              onClick={() => {
                setShowSearchInput(false);
                setMessageSearchQuery("");
              }}
              className="p-1 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* Mobile Back Button */}
            <button
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Avatar */}
            <div className="relative select-none">
              <img src={avatar} alt={title || "Chat avatar"} className="w-10 h-10 rounded-full object-cover" />
              {isOnline && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-100">{title}</h3>
              {activeChat.is_group ? (
                <p className="text-2xs text-slate-400">
                  {activeChat.members?.length || 0} members
                </p>
              ) : isTyping ? (
                <p className="text-2xs text-violet-400 font-semibold animate-pulse">
                  typing...
                </p>
              ) : isOnline ? (
                <p className="text-2xs text-emerald-400 font-semibold">Online</p>
              ) : (
                <p className="text-2xs text-slate-500">
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
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-all"
            >
              <Search className="w-4.5 h-4.5" />
            </button>
          )}

          {!activeChat.is_group && otherMember && (
            <>
              <button
                onClick={() => startCall(otherMember, "voice")}
                title="Voice Call"
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-all"
              >
                <Phone className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={() => startCall(otherMember, "video")}
                title="Video Call"
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-all"
              >
                <Video className="w-4.5 h-4.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messagesLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            <p className="text-xs font-sans">Decrypting messages...</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-655 text-xs font-sans">
            <Smile className="w-8 h-8 mb-2 opacity-50" />
            <p>{messageSearchQuery ? "No matching messages found." : "Say hello to start the conversation!"}</p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isSelf = msg.sender_id === user?.id;
            const isDeleted = msg.content === "This message was deleted";
            const reactions = msg.reactions || {};

            return (
              <div
                key={msg.id}
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
                className={cn("flex flex-col max-w-[75%] relative group/msg", isSelf ? "ml-auto items-end" : "mr-auto items-start")}
              >
                {/* Quoted Reply context */}
                {msg.reply_to && !isDeleted && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 border-l-2 border-violet-500 rounded-t-xl text-2xs text-slate-400 mb-0.5 select-none shrink-0">
                    <span className="font-semibold text-violet-300">
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
                      className={cn(
                        "absolute top-[-30px] z-10 flex items-center bg-slate-900 border border-slate-800 rounded-full px-2 py-1 shadow-lg gap-1.5 scale-95 transition-transform",
                        isSelf ? "right-2" : "left-2"
                      )}
                    >
                      {/* Reaction options */}
                      {["👍", "❤️", "😂", "🔥"].map((emoji) => {
                        const hasReacted = reactions[emoji]?.includes(user?.id || "");
                        return (
                          <button
                            key={emoji}
                            onClick={() =>
                              hasReacted
                                ? chatService.removeReaction(msg.id, user!.id, emoji)
                                : chatService.addReaction(msg.id, user!.id, emoji)
                            }
                            className={cn(
                              "text-xs hover:scale-125 transition-transform p-0.5 rounded",
                              hasReacted && "bg-slate-800"
                            )}
                          >
                            {emoji}
                          </button>
                        );
                      })}
                      <div className="w-px h-3.5 bg-slate-800"></div>
                      
                      {/* Action options */}
                      <button
                        onClick={() => setReplyingTo(msg)}
                        title="Reply"
                        className="text-slate-400 hover:text-slate-200 transition-colors p-0.5"
                      >
                        <CornerUpLeft className="w-3.5 h-3.5" />
                      </button>

                      {isSelf && (
                        <>
                          <button
                            onClick={() => {
                              setEditingMessage(msg);
                              setInputText(msg.content);
                            }}
                            title="Edit"
                            className="text-slate-400 hover:text-slate-200 transition-colors p-0.5"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm("Delete this message for everyone?")) {
                                chatService.deleteMessage(msg.id);
                              }
                            }}
                            title="Delete"
                            className="text-slate-400 hover:text-red-400 transition-colors p-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Actual text / media bubble */}
                  <div
                    className={cn(
                      "px-4 py-2.5 rounded-2xl relative shadow-md text-xs leading-relaxed break-words",
                      isDeleted
                        ? "bg-slate-900/30 text-slate-500 border border-slate-900/50 italic font-sans"
                        : isSelf
                        ? "bg-gradient-to-tr from-violet-600 to-indigo-600 text-white rounded-tr-none font-sans"
                        : "bg-slate-900 text-slate-200 rounded-tl-none font-sans border border-slate-800/80"
                    )}
                  >
                    {/* Media Render */}
                    {!isDeleted && msg.media_url && (
                      <div className="mb-2 max-w-[200px] overflow-hidden rounded-lg">
                        {msg.media_type === "image" ? (
                          <img
                            src={msg.media_url}
                            alt="Attachment"
                            className="object-cover cursor-pointer hover:opacity-90 transition-opacity w-full max-h-[160px]"
                            onClick={() => window.open(msg.media_url, "_blank")}
                          />
                        ) : msg.media_type === "audio" ? (
                          <audio src={msg.media_url} controls className="w-[180px] h-8 bg-transparent" />
                        ) : (
                          <a
                            href={msg.media_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 p-2 bg-slate-950/60 rounded border border-slate-800 text-slate-200 hover:underline"
                          >
                            <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                            <span className="truncate max-w-[120px] text-2xs">{msg.content}</span>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Text Body */}
                    {!(msg.media_url && msg.media_type !== "image") && (
                      <p className={cn(isDeleted && "italic")}>{msg.content}</p>
                    )}

                    {/* Footer stats: Edit tag + time + check receipts */}
                    <div className="flex items-center justify-end gap-1.5 mt-1 select-none text-[9px] text-slate-400/80">
                      {msg.is_edited && !isDeleted && <span>edited</span>}
                      <span>
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {isSelf && (
                        <CheckCheck className="w-3.5 h-3.5 text-violet-300" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Reactions list */}
                {Object.keys(reactions).length > 0 && !isDeleted && (
                  <div className="flex flex-wrap gap-1 mt-1 z-0">
                    {Object.keys(reactions).map((emoji) => {
                      const users = reactions[emoji];
                      const userHasReacted = users.includes(user?.id || "");
                      return (
                        <button
                          key={emoji}
                          onClick={() =>
                            userHasReacted
                              ? chatService.removeReaction(msg.id, user!.id, emoji)
                              : chatService.addReaction(msg.id, user!.id, emoji)
                          }
                          className={cn(
                            "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors shadow",
                            userHasReacted && "border-violet-500/40 bg-violet-950/10 text-violet-300"
                          )}
                        >
                          <span>{emoji}</span>
                          <span>{users.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Subscribing / loading spinner footer */}
      {uploading && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-900/30 text-2xs text-slate-400 font-sans border-t border-slate-900">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
          <span>Uploading media attachment...</span>
        </div>
      )}

      {/* Quoted Message Reply Bar */}
      {replyingTo && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-t border-slate-800/80 font-sans">
          <div className="flex items-start gap-2 border-l-2 border-violet-500 pl-3">
            <div>
              <p className="text-2xs text-slate-400 font-semibold">
                Replying to {replyingTo.sender_id === user?.id ? "yourself" : replyingTo.sender?.username}
              </p>
              <p className="text-xs text-slate-300 truncate max-w-[400px]">
                {replyingTo.content}
              </p>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edit Mode Preview Bar */}
      {editingMessage && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-t border-slate-800/80 font-sans">
          <div className="flex items-start gap-2 border-l-2 border-yellow-500 pl-3">
            <div>
              <p className="text-2xs text-yellow-400 font-semibold">Editing message</p>
              <p className="text-xs text-slate-300 truncate max-w-[400px]">
                {editingMessage.content}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setInputText("");
            }}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Action Controls */}
      <form onSubmit={handleSend} className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex items-center gap-3">
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
          className="p-2 text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-800/60 hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50 shrink-0"
        >
          <Paperclip className="w-4.5 h-4.5" />
        </button>

        {/* Recording / Voice message active area */}
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between bg-red-950/20 border border-red-900/40 rounded-xl px-4 py-1.5 text-xs text-red-300 font-sans">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
              <span className="font-semibold">Recording: {formatTime(recordSeconds)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => stopRecording(false)}
                className="px-2.5 py-1 text-2xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => stopRecording(true)}
                className="px-2.5 py-1 text-2xs bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-md shadow-red-600/10"
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
              className="w-full pl-4 pr-10 py-2.5 bg-slate-950/60 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500 rounded-xl text-xs text-slate-200 placeholder-slate-500 transition-all font-sans"
            />
            {/* Smile icon placeholder */}
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <Smile className="w-4.5 h-4.5" />
            </button>
          </div>
        )}

        {/* Send or Voice Record Action Button */}
        {inputText.trim() || editingMessage ? (
          <button
            type="submit"
            className="p-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-lg shadow-violet-500/10 active:scale-95 transition-all shrink-0"
          >
            <Send className="w-4.5 h-4.5" />
          </button>
        ) : (
          !isRecording && (
            <button
              type="button"
              onClick={startRecording}
              className="p-2.5 bg-slate-950/60 border border-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-all shrink-0"
            >
              <Mic className="w-4.5 h-4.5" />
            </button>
          )
        )}
      </form>
    </div>
  );
};

export default ChatArea;

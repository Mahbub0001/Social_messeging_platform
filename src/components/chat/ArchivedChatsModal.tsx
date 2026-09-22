import React, { useState } from "react";
import { Archive, ArchiveRestore, Search, X, ArrowLeft } from "lucide-react";
import { useStore } from "../../hooks/useStore";
import { chatService } from "../../services/chatService";
import { getTranslation, type Language } from "../../utils/translations";

interface ArchivedChatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: Language;
  onSelectConversation?: (conversationId: string) => void;
}

export const ArchivedChatsModal: React.FC<ArchivedChatsModalProps> = ({
  isOpen,
  onClose,
  language = "bn",
  onSelectConversation,
}) => {
  const { conversations, user, fetchConversations } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter archived chats
  const archivedList = conversations.filter((c) => Boolean(c.is_archived));
  const filteredList = archivedList.filter((c) =>
    (c.name || "Chat").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUnarchive = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (!user) return;
    setUnarchivingId(conversationId);
    try {
      await chatService.archiveConversation(user.id, conversationId, false);
      await fetchConversations();
    } catch (err) {
      console.error("Failed to unarchive chat:", err);
    } finally {
      setUnarchivingId(null);
    }
  };

  const handleChatClick = (conversationId: string) => {
    if (onSelectConversation) {
      onSelectConversation(conversationId);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-lg bg-white dark:bg-slate-900 sm:rounded-2xl border-0 sm:border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-1.5 -ml-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 sm:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base">
                {getTranslation(language, "archivedChats")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {getTranslation(language, "archivedCount", { n: archivedList.length })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hidden sm:block p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={getTranslation(language, "search")}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
            />
          </div>
        </div>

        {/* List of Archived Chats */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 px-4">
              <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 text-slate-400">
                <Archive className="w-6 h-6 stroke-[1.5]" />
              </div>
              <p className="font-medium text-slate-600 dark:text-slate-400 text-sm">
                {getTranslation(language, "noArchivedChats")}
              </p>
            </div>
          ) : (
            filteredList.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleChatClick(conv.id)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
              >
                <div className="flex items-center space-x-3 overflow-hidden flex-1 mr-3">
                  {conv.avatar_url ? (
                    <img
                      src={conv.avatar_url}
                      alt={conv.name || "Chat"}
                      className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {(conv.name || "C").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="truncate flex-1">
                    <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {conv.name || "Chat"}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {conv.last_message?.content || "No messages yet"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => handleUnarchive(e, conv.id)}
                  disabled={unarchivingId === conv.id}
                  title={getTranslation(language, "unarchiveChat")}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold transition-all shrink-0 active:scale-95"
                >
                  <ArchiveRestore className="w-3.5 h-3.5" />
                  <span>{getTranslation(language, "unarchive")}</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

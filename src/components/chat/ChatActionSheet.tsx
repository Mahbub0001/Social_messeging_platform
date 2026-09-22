import React from "react";
import { Bell, BellOff, Archive, ArchiveRestore, Trash2, X } from "lucide-react";
import type { ConversationWithDetails } from "../../services/chatService";
import { getTranslation, type Language } from "../../utils/translations";

interface ChatActionSheetProps {
  isOpen: boolean;
  conversation: ConversationWithDetails | null;
  onClose: () => void;
  onMuteClick: () => void;
  onUnmuteClick: () => void;
  onArchiveToggle: () => void;
  onDeleteClick: () => void;
  language?: Language;
}

export const ChatActionSheet: React.FC<ChatActionSheetProps> = ({
  isOpen,
  conversation,
  onClose,
  onMuteClick,
  onUnmuteClick,
  onArchiveToggle,
  onDeleteClick,
  language = "bn",
}) => {
  if (!isOpen || !conversation) return null;

  const isMuted = Boolean(conversation.is_muted);
  const isArchived = Boolean(conversation.is_archived);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full sm:max-w-sm bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden z-10 animate-in slide-in-from-bottom duration-250 sm:zoom-in-95">
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header with chat preview */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center space-x-3 overflow-hidden">
            {conversation.avatar_url ? (
              <img
                src={conversation.avatar_url}
                alt={conversation.name || "Chat"}
                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {(conversation.name || "C").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="truncate">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base truncate">
                {conversation.name || "Chat"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {conversation.is_group ? "Group Chat" : "Direct Message"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action List */}
        <div className="p-2 space-y-1">
          {/* Mute / Unmute */}
          {isMuted ? (
            <button
              onClick={() => {
                onClose();
                onUnmuteClick();
              }}
              className="w-full flex items-center space-x-3.5 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-slate-700 dark:text-slate-200 text-left font-medium active:scale-[0.99]"
            >
              <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {getTranslation(language, "unmuteNotifications")}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {getTranslation(language, "unmute")}
                </div>
              </div>
            </button>
          ) : (
            <button
              onClick={() => {
                onClose();
                onMuteClick();
              }}
              className="w-full flex items-center space-x-3.5 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-slate-700 dark:text-slate-200 text-left font-medium active:scale-[0.99]"
            >
              <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <BellOff className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {getTranslation(language, "muteNotifications")}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {getTranslation(language, "muteChatTitle")}
                </div>
              </div>
            </button>
          )}

          {/* Archive / Unarchive */}
          <button
            onClick={() => {
              onClose();
              onArchiveToggle();
            }}
            className="w-full flex items-center space-x-3.5 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-slate-700 dark:text-slate-200 text-left font-medium active:scale-[0.99]"
          >
            <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              {isArchived ? (
                <ArchiveRestore className="w-5 h-5" />
              ) : (
                <Archive className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {isArchived
                  ? getTranslation(language, "unarchiveChat")
                  : getTranslation(language, "archiveChat")}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isArchived
                  ? getTranslation(language, "unarchive")
                  : getTranslation(language, "archive")}
              </div>
            </div>
          </button>

          {/* Delete */}
          <button
            onClick={() => {
              onClose();
              onDeleteClick();
            }}
            className="w-full flex items-center space-x-3.5 px-4 py-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-rose-600 dark:text-rose-400 text-left font-medium active:scale-[0.99]"
          >
            <div className="w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                {getTranslation(language, "deleteChat")}
              </div>
              <div className="text-xs text-rose-400 dark:text-rose-500">
                {getTranslation(language, "deleteChatConfirmTitle")}
              </div>
            </div>
          </button>
        </div>

        {/* Footer cancel button for mobile */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 sm:hidden">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm text-center"
          >
            {getTranslation(language, "cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};

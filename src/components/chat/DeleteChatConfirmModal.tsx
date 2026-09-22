import React from "react";
import { Trash2, X } from "lucide-react";
import { getTranslation, type Language } from "../../utils/translations";

interface DeleteChatConfirmModalProps {
  isOpen: boolean;
  conversationName?: string;
  onClose: () => void;
  onConfirm: () => void;
  language?: Language;
}

export const DeleteChatConfirmModal: React.FC<DeleteChatConfirmModalProps> = ({
  isOpen,
  conversationName,
  onClose,
  onConfirm,
  language = "bn",
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base">
              {getTranslation(language, "deleteChatConfirmTitle")}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3 text-center sm:text-left">
          {conversationName && (
            <div className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-full">
              {conversationName}
            </div>
          )}
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {getTranslation(language, "deleteChatConfirmDesc")}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2.5 px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            {getTranslation(language, "cancel")}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20 transition-all active:scale-95"
          >
            {getTranslation(language, "deleteChat")}
          </button>
        </div>
      </div>
    </div>
  );
};

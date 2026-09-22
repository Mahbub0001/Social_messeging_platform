import React, { useState } from "react";
import { BellOff, MessageSquare, PhoneCall, Check, X } from "lucide-react";
import { getTranslation, type Language } from "../../utils/translations";

interface MuteOptionsModalProps {
  isOpen: boolean;
  conversationName?: string;
  onClose: () => void;
  onConfirm: (duration: "1h" | "5h" | "12h" | "indefinite", muteType: "all" | "messages_only") => void;
  language?: Language;
}

export const MuteOptionsModal: React.FC<MuteOptionsModalProps> = ({
  isOpen,
  conversationName,
  onClose,
  onConfirm,
  language = "bn",
}) => {
  const [selectedScope, setSelectedScope] = useState<"all" | "messages_only">("all");
  const [selectedDuration, setSelectedDuration] = useState<"1h" | "5h" | "12h" | "indefinite">("1h");

  if (!isOpen) return null;

  const durationOptions: Array<{ id: "1h" | "5h" | "12h" | "indefinite"; labelKey: "oneHour" | "fiveHours" | "twelveHours" | "untilIChange" }> = [
    { id: "1h", labelKey: "oneHour" },
    { id: "5h", labelKey: "fiveHours" },
    { id: "12h", labelKey: "twelveHours" },
    { id: "indefinite", labelKey: "untilIChange" },
  ];

  const handleApply = () => {
    onConfirm(selectedDuration, selectedScope);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <BellOff className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base">
                {getTranslation(language, "muteChatTitle")}
              </h3>
              {conversationName && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                  {conversationName}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Section 1: Scope */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">
              {getTranslation(language, "muteScopeTitle")}
            </h4>
            <div className="space-y-2">
              {/* Messages & Calls */}
              <label
                onClick={() => setSelectedScope("all")}
                className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedScope === "all"
                    ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/20 ring-1 ring-violet-500/30"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <div className="mt-0.5 mr-3 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                  selectedScope === 'all'
                    ? 'border-violet-500 bg-violet-500 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }">
                  {selectedScope === "all" && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-1.5 font-medium text-sm text-slate-800 dark:text-slate-200">
                    <PhoneCall className="w-3.5 h-3.5 text-slate-400" />
                    <span>{getTranslation(language, "muteMessagesAndCalls")}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {getTranslation(language, "muteMessagesAndCallsDesc")}
                  </p>
                </div>
              </label>

              {/* Messages Only */}
              <label
                onClick={() => setSelectedScope("messages_only")}
                className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedScope === "messages_only"
                    ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/20 ring-1 ring-violet-500/30"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <div className="mt-0.5 mr-3 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                  selectedScope === 'messages_only'
                    ? 'border-violet-500 bg-violet-500 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }">
                  {selectedScope === "messages_only" && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-1.5 font-medium text-sm text-slate-800 dark:text-slate-200">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    <span>{getTranslation(language, "muteMessagesOnly")}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {getTranslation(language, "muteMessagesOnlyDesc")}
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Section 2: Duration */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">
              {getTranslation(language, "muteDurationTitle")}
            </h4>
            <div className="space-y-1.5">
              {durationOptions.map((opt) => {
                const isChecked = selectedDuration === opt.id;
                return (
                  <label
                    key={opt.id}
                    onClick={() => setSelectedDuration(opt.id)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all ${
                      isChecked
                        ? "border-violet-500 bg-violet-50/40 dark:bg-violet-950/20 ring-1 ring-violet-500/30"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {getTranslation(language, opt.labelKey)}
                    </span>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                        isChecked
                          ? "border-violet-500 bg-violet-500 text-white"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {isChecked && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            {getTranslation(language, "cancel")}
          </button>
          <button
            onClick={handleApply}
            className="px-5 py-2 text-sm font-semibold rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/20 transition-all active:scale-95"
          >
            {getTranslation(language, "confirm")}
          </button>
        </div>
      </div>
    </div>
  );
};

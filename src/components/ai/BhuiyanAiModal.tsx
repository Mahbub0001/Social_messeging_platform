import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  Send,
  Mic,
  MicOff,
  Clock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Bot,
  User,
  ArrowRight,
} from "lucide-react";
import { aiAgentService, type AiChatMessage } from "../../services/aiAgentService";
import {
  scheduledMessageService,
  type ScheduledMessage,
} from "../../services/scheduledMessageService";
import { useStore } from "../../hooks/useStore";
import { cn } from "../../lib/utils";

interface BhuiyanAiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BhuiyanAiModal: React.FC<BhuiyanAiModalProps> = ({ isOpen, onClose }) => {
  const user = useStore((state) => state.user);
  const setActiveConversationId = useStore((state) => state.setActiveConversationId);

  const [activeTab, setActiveTab] = useState<"chat" | "scheduled">("chat");
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: "welcome",
      sender: "bhuiyan_ai",
      text: "আসসালামু আলাইকুম! আমি Bhuiyan AI। আপনার নির্দেশ অনুযায়ী আমি যেকোনো বন্ধুকে সরাসরি মেসেজ পাঠানো, কল দেওয়া বা নির্দিষ্ট সময়ে (যেমন রাত ৯:০০ টায়) মেসেজ শিডিউল করতে পারি।\n\nআপনি কী করতে চান?",
      timestamp: new Date().toISOString(),
    },
  ]);

  const [scheduledItems, setScheduledItems] = useState<ScheduledMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "chat") {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  // Load scheduled messages
  const refreshScheduled = () => {
    if (user?.id) {
      setScheduledItems(scheduledMessageService.getAllMessages(user.id));
    }
  };

  useEffect(() => {
    refreshScheduled();
    const unsub = scheduledMessageService.subscribe(refreshScheduled);
    return () => unsub();
  }, [user?.id]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "bn-BD"; // Primary Bengali, also understands Banglish & English terms

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInputText(transcript);
          handleSend(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("[SpeechRecognition] Error:", event.error);
        setIsListening(false);
        if (event.error !== "no-speech") {
          setSpeechError("ভয়েস ইনপুট নেওয়া সম্ভব হয়নি। টাইপ করে চেষ্টা করুন।");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("আপনার ব্রাউজারে ভয়েস রিকগনিশন সাপোর্ট করে না। টাইপ করে বার্তা দিন।");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        setSpeechError(null);
        recognitionRef.current.start();
      } catch (err) {
        console.error("Speech recognition start failed:", err);
      }
    }
  };

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || isLoading) return;

    setInputText("");
    const userMsg: AiChatMessage = {
      id: "msg-" + Date.now(),
      sender: "user",
      text: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Prepare recent history for context
    const historyPayload = messages.slice(-5).map((m) => ({
      role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));

    try {
      const res = await aiAgentService.executeCommand(textToSend, historyPayload);

      const aiMsg: AiChatMessage = {
        id: "ai-" + Date.now(),
        sender: "bhuiyan_ai",
        text: res.replyText,
        actionResult: res.actionResult,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMsg]);
      refreshScheduled();
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          sender: "bhuiyan_ai",
          text: "একটি সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (promptText: string) => {
    setInputText(promptText);
    handleSend(promptText);
  };

  const handleCancelScheduled = (id: string) => {
    scheduledMessageService.cancelMessage(id);
    refreshScheduled();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40"
      />

      {/* Main Glassmorphic Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="fixed z-50 bottom-20 md:bottom-24 right-3 sm:right-6 md:right-8 w-[calc(100vw-24px)] sm:w-[420px] md:w-[440px] h-[540px] max-h-[calc(100dvh-120px)] bg-slate-900/95 dark:bg-slate-950/95 border border-violet-500/30 rounded-3xl shadow-2xl shadow-violet-950/60 flex flex-col overflow-hidden backdrop-blur-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Sparkles className="w-5 h-5 text-cyan-300 animate-pulse" />
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-bold text-base tracking-wide">Bhuiyan AI</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Active" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex bg-slate-800/80 rounded-xl p-0.5 border border-slate-700/50 text-xs">
              <button
                onClick={() => setActiveTab("chat")}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-medium transition-all",
                  activeTab === "chat"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-700/30"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Assistant
              </button>
              <button
                onClick={() => setActiveTab("scheduled")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all relative",
                  activeTab === "scheduled"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-700/30"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>শিডিউল</span>
                {scheduledItems.filter((i) => i.status === "pending").length > 0 && (
                  <span className="w-4 h-4 text-[10px] rounded-full bg-amber-500 text-white font-bold flex items-center justify-center ml-0.5">
                    {scheduledItems.filter((i) => i.status === "pending").length}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab 1: Assistant / Chat View */}
        {activeTab === "chat" && (
          <>
            {/* Quick Action Suggestion Chips */}
            <div className="px-4 py-2 bg-slate-950/30 border-b border-slate-800/40 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs shrink-0">
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-violet-400" /> সাজেশন:
              </span>
              <button
                onClick={() => handleQuickPrompt("Nibir k 'hi' msg pathao")}
                className="shrink-0 px-2.5 py-1 rounded-full bg-slate-800/70 hover:bg-violet-900/40 text-slate-300 hover:text-violet-200 border border-slate-700/60 hover:border-violet-500/40 transition-all"
              >
                💬 Nibir কে "hi" পাঠাও
              </button>
              <button
                onClick={() => handleQuickPrompt("Nuha k raat 9 tay 'kmn aso' msg pathao")}
                className="shrink-0 px-2.5 py-1 rounded-full bg-slate-800/70 hover:bg-violet-900/40 text-slate-300 hover:text-violet-200 border border-slate-700/60 hover:border-violet-500/40 transition-all"
              >
                ⏰ Nuha কে রাত ৯টায় মেসেজ দাও
              </button>
              <button
                onClick={() => handleQuickPrompt("Nibir k voice call dao")}
                className="shrink-0 px-2.5 py-1 rounded-full bg-slate-800/70 hover:bg-violet-900/40 text-slate-300 hover:text-violet-200 border border-slate-700/60 hover:border-violet-500/40 transition-all"
              >
                📞 Nibir কে কল দাও
              </button>
              <button
                onClick={() => handleQuickPrompt("amr scheduled msg gula dekhaw")}
                className="shrink-0 px-2.5 py-1 rounded-full bg-slate-800/70 hover:bg-violet-900/40 text-slate-300 hover:text-violet-200 border border-slate-700/60 hover:border-violet-500/40 transition-all"
              >
                📋 শিডিউল মেসেজ লিস্ট
              </button>
            </div>

            {/* Conversation Messages Stream */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
              {messages.map((m) => {
                const isUser = m.sender === "user";
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex gap-3 max-w-[88%]",
                      isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    {/* Avatar Icon */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md",
                        isUser
                          ? "bg-indigo-600 text-white"
                          : "bg-gradient-to-tr from-violet-600 to-cyan-500 text-white"
                      )}
                    >
                      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    {/* Message Bubble */}
                    <div className="space-y-2">
                      <div
                        className={cn(
                          "px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line shadow-sm",
                          isUser
                            ? "bg-violet-600 text-white rounded-tr-none"
                            : "bg-slate-800/90 text-slate-200 border border-slate-700/50 rounded-tl-none"
                        )}
                      >
                        {m.text}
                      </div>

                      {/* Action Result Visual Cards */}
                      {m.actionResult && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "p-3 rounded-xl border text-xs flex flex-col gap-2",
                            m.actionResult.success
                              ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-200"
                              : "bg-red-950/30 border-red-500/30 text-red-200"
                          )}
                        >
                          <div className="flex items-center gap-2 font-semibold">
                            {m.actionResult.success ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                            )}
                            <span>{m.actionResult.message}</span>
                          </div>

                          {/* Detail Buttons */}
                          {m.actionResult.data?.conversationId && (
                            <button
                              onClick={() => {
                                setActiveConversationId(m.actionResult?.data.conversationId);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-white font-medium underline mt-1"
                            >
                              চ্যাট ওপেন করুন <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex gap-3 mr-auto">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-cyan-500 text-white flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-slate-800/90 border border-slate-700/50 rounded-tl-none flex items-center gap-2 text-xs text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
                    <span>Bhuiyan AI নির্দেশ বিশ্লেষণ করছে...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Voice Listening Wave Indicator Overlay */}
            {isListening && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-2 bg-gradient-to-r from-violet-900/60 via-indigo-900/60 to-cyan-900/60 border-t border-violet-500/40 flex items-center justify-between text-xs text-violet-200 shrink-0"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="font-semibold">ভয়েস শুনছি... মুখে বলুন (যেমন: নিবিড়কে hi মেসেজ পাঠাও)</span>
                </div>
                <button
                  onClick={toggleListening}
                  className="px-2 py-0.5 rounded-lg bg-red-500/30 text-red-300 hover:bg-red-500/50 font-bold"
                >
                  স্টপ
                </button>
              </motion.div>
            )}

            {speechError && (
              <div className="px-4 py-1.5 bg-amber-500/20 text-amber-300 text-xs border-t border-amber-500/30 shrink-0">
                {speechError}
              </div>
            )}

            {/* Bottom Input Area */}
            <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2 shrink-0">
              {/* Mic / Voice Button */}
              <button
                type="button"
                onClick={toggleListening}
                className={cn(
                  "p-2.5 rounded-xl border transition-all shrink-0 cursor-pointer",
                  isListening
                    ? "bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/40 animate-pulse"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-violet-900/30 hover:text-violet-300 hover:border-violet-500/50"
                )}
                title={isListening ? "ভয়েস বন্ধ করুন" : "ভয়েস কমান্ড দিন"}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="যেকোনো নির্দেশ দিন (যেমন: Nuha কে রাত ৯টায় kmn aso পাঠাও)..."
                className="flex-1 bg-slate-900 border border-slate-700/80 focus:border-violet-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />

              {/* Send Button */}
              <button
                type="button"
                disabled={!inputText.trim() || isLoading}
                onClick={() => handleSend()}
                className={cn(
                  "p-2.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer",
                  inputText.trim() && !isLoading
                    ? "bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-700/40"
                    : "bg-slate-800 text-slate-600 cursor-not-allowed"
                )}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </>
        )}

        {/* Tab 2: Scheduled Messages Queue View */}
        {activeTab === "scheduled" && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-white text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-400" />
                শিডিউল করা বার্তা তালিকা
              </h4>
              <button
                onClick={refreshScheduled}
                className="text-xs text-violet-400 hover:text-violet-300 font-medium"
              >
                রিফ্রেশ
              </button>
            </div>

            {scheduledItems.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs">
                <Clock className="w-10 h-10 mx-auto mb-2 text-slate-600 opacity-50" />
                <p>কোনো শিডিউল করা বার্তা পাওয়া যায়নি।</p>
                <p className="mt-1 text-slate-400">
                  AI-কে বলুন: "Nuha k raat 9 tay 'kmn aso' msg pathao"
                </p>
              </div>
            ) : (
              scheduledItems.map((item) => {
                const isPending = item.status === "pending";
                const isSent = item.status === "sent";

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all flex flex-col gap-2",
                      isPending
                        ? "bg-slate-950/70 border-violet-500/30 shadow-md shadow-violet-950/20"
                        : isSent
                        ? "bg-emerald-950/20 border-emerald-500/20 opacity-80"
                        : "bg-slate-900/40 border-slate-800 opacity-60"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-xs font-bold text-violet-300">
                          {item.receiverName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-white text-xs font-bold">{item.receiverName}</span>
                          <span className="text-[10px] text-slate-400 block">
                            সময়: {item.displayTime || new Date(item.scheduledAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                          isPending
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : isSent
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-slate-700/30 text-slate-400 border-slate-600/30"
                        )}
                      >
                        {isPending ? "Pending (অপেক্ষারত)" : isSent ? "Sent (পাঠানো হয়েছে)" : "Cancelled"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs text-slate-300">
                      "{item.message}"
                    </div>

                    {isPending && (
                      <div className="flex items-center justify-end pt-1">
                        <button
                          onClick={() => handleCancelScheduled(item.id)}
                          className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 font-semibold px-2.5 py-1 rounded-lg hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          বাতিল করুন
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default BhuiyanAiModal;

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Bot, Clock } from "lucide-react";
import { scheduledMessageService } from "../../services/scheduledMessageService";
import { useStore } from "../../hooks/useStore";

interface BhuiyanAiButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export const BhuiyanAiButton: React.FC<BhuiyanAiButtonProps> = ({ onClick, isOpen }) => {
  const user = useStore((state) => state.user);
  const [pendingCount, setPendingCount] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const updateCount = () => {
      if (user?.id) {
        const pending = scheduledMessageService.getPendingMessages(user.id);
        setPendingCount(pending.length);
      }
    };

    updateCount();
    const unsub = scheduledMessageService.subscribe(updateCount);
    return () => unsub();
  }, [user?.id]);

  return (
    <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-30 flex items-center gap-3 select-none">
      {/* Interactive Tooltip Pill on Hover */}
      <AnimatePresence>
        {isHovered && !isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.9 }}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 dark:bg-slate-800/90 backdrop-blur-md border border-violet-500/30 text-white text-xs font-semibold shadow-xl shadow-violet-950/40 pointer-events-none"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Bhuiyan AI Copilot</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Floating Glowing Orb Button */}
      <motion.button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        aria-label="Open Bhuiyan AI"
        className="relative group p-0 w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center focus:outline-none cursor-pointer"
      >
        {/* Animated Radiant Pulse Halo Rings */}
        <motion.div
          animate={{
            scale: [1, 1.35, 1],
            opacity: [0.35, 0.75, 0.35],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-600 via-indigo-500 to-cyan-400 blur-md"
        />

        {/* Outer Rotating Glowing Gradient Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute -inset-1 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 opacity-75 blur-[2px] group-hover:opacity-100 transition-opacity"
        />

        {/* Orb Core Container */}
        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 border border-violet-400/40 flex items-center justify-center shadow-2xl overflow-hidden">
          {/* Inner Light Glow */}
          <div className="absolute inset-0 bg-radial from-violet-500/30 via-transparent to-transparent opacity-80" />

          {/* Center Dynamic Icon */}
          <motion.div
            animate={{
              rotate: isOpen ? 180 : [0, 5, -5, 0],
            }}
            transition={{
              rotate: isOpen ? { duration: 0.3 } : { repeat: Infinity, duration: 4, ease: "easeInOut" },
            }}
            className="relative z-10 text-white flex items-center justify-center"
          >
            {isOpen ? (
              <Sparkles className="w-7 h-7 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            ) : (
              <div className="relative">
                <Bot className="w-7 h-7 text-violet-200 group-hover:text-white drop-shadow-[0_0_10px_rgba(167,139,250,0.8)] transition-colors" />
                <Sparkles className="w-3.5 h-3.5 text-amber-300 absolute -top-1 -right-1 animate-pulse" />
              </div>
            )}
          </motion.div>
        </div>

        {/* Pending Scheduled Messages Badge */}
        {pendingCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 z-20 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950 shadow-md"
            title={`${pendingCount} scheduled message(s)`}
          >
            <Clock className="w-2.5 h-2.5 inline mr-0.5" />
            {pendingCount}
          </motion.div>
        )}
      </motion.button>
    </div>
  );
};

export default BhuiyanAiButton;

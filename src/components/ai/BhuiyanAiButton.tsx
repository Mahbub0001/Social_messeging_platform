import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import { Sparkles, Bot, Clock } from "lucide-react";
import { scheduledMessageService } from "../../services/scheduledMessageService";
import { useStore } from "../../hooks/useStore";

interface BhuiyanAiButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

const STORAGE_KEY = "kb_ai_btn_pos";

function getInitialPosition() {
  const width = typeof window !== "undefined" ? window.innerWidth : 400;
  const height = typeof window !== "undefined" ? window.innerHeight : 800;
  const isMobile = width < 768;
  const defaultX = width - (isMobile ? 74 : 90);
  const defaultY = height - (isMobile ? 130 : 96);

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        const maxX = Math.max(10, width - 75);
        const maxY = Math.max(10, height - 75);
        return {
          x: Math.min(Math.max(10, parsed.x), maxX),
          y: Math.min(Math.max(10, parsed.y), maxY),
        };
      }
    }
  } catch (e) {}

  return { x: defaultX, y: defaultY };
}

export const BhuiyanAiButton: React.FC<BhuiyanAiButtonProps> = ({ onClick, isOpen }) => {
  const user = useStore((state) => state.user);
  const [pendingCount, setPendingCount] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  const initialPos = useRef(getInitialPosition());
  const x = useMotionValue(initialPos.current.x);
  const y = useMotionValue(initialPos.current.y);

  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 400,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  const [isNearLeft, setIsNearLeft] = useState(
    () => initialPos.current.x < (typeof window !== "undefined" ? window.innerWidth : 400) / 2
  );

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

  // Keep button within screen on resize or rotation
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setWindowSize({ width: w, height: h });

      const curX = x.get();
      const curY = y.get();
      const maxX = Math.max(10, w - 75);
      const maxY = Math.max(10, h - 75);

      if (curX > maxX) x.set(maxX);
      if (curX < 10) x.set(10);
      if (curY > maxY) y.set(maxY);
      if (curY < 10) y.set(10);

      setIsNearLeft(curX < w / 2);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [x, y]);

  const handleDragStart = () => {
    isDraggingRef.current = true;
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    const finalX = x.get();
    const finalY = y.get();
    setIsNearLeft(finalX < window.innerWidth / 2);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: finalX, y: finalY }));
    } catch (e) {}

    setIsDragging(false);
    // Brief timeout so mouseup/touchend does not trigger onClick
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 150);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      e.stopPropagation();
      return;
    }
    onClick();
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.06}
      dragConstraints={{
        left: 10,
        right: Math.max(10, windowSize.width - 75),
        top: 10,
        bottom: Math.max(10, windowSize.height - 75),
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{ x, y }}
      className="fixed top-0 left-0 z-30 select-none touch-none"
    >
      {/* Interactive Tooltip Pill on Hover (hidden during dragging or when modal is open) */}
      <AnimatePresence>
        {isHovered && !isOpen && !isDragging && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`absolute top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 dark:bg-slate-800/90 backdrop-blur-md border border-violet-500/30 text-white text-xs font-semibold shadow-xl shadow-violet-950/40 pointer-events-none whitespace-nowrap z-40 ${
              isNearLeft ? "left-full ml-3" : "right-full mr-3"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Bhuiyan AI</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Floating Button */}
      <motion.button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        whileDrag={{ scale: 1.1 }}
        aria-label="Open Bhuiyan AI"
        className="relative group p-0 w-13 h-13 md:w-14 md:h-14 rounded-2xl flex items-center justify-center focus:outline-none cursor-grab active:cursor-grabbing"
      >
        {/* Subtle teal halo */}
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-teal-500/60 to-emerald-400/50 blur-[4px] opacity-60 group-hover:opacity-95 transition-opacity pointer-events-none" />

        {/* Orb Core Container */}
        <div className="relative w-full h-full rounded-2xl bg-[#11141C] border border-teal-400/40 flex items-center justify-center shadow-xl shadow-black/40 overflow-hidden pointer-events-none">
          <div className="relative z-10 text-white flex items-center justify-center">
            {isOpen ? (
              <Sparkles className="w-6 h-6 text-teal-300" />
            ) : (
              <div className="relative">
                <Bot className="w-6 h-6 text-teal-200 group-hover:text-white transition-colors" />
                <span className="w-2 h-2 rounded-full bg-teal-400 absolute -top-0.5 -right-0.5 ring-2 ring-[#11141C]" />
              </div>
            )}
          </div>
        </div>

        {/* Pending Scheduled Messages Badge */}
        {pendingCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1.5 -right-1.5 z-20 bg-amber-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0B0D12] shadow-md pointer-events-none"
            title={`${pendingCount} scheduled message(s)`}
          >
            <Clock className="w-2.5 h-2.5 inline mr-0.5" />
            {pendingCount}
          </motion.div>
        )}
      </motion.button>
    </motion.div>
  );
};

export default BhuiyanAiButton;

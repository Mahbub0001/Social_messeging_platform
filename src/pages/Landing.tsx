import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageSquare, ShieldCheck, Zap, Mic, UserCheck, Code } from "lucide-react";
import { useStore } from "../hooks/useStore";

export const Landing: React.FC = () => {
  const { user } = useStore();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } },
  } as const;

  const features = [
    {
      icon: <Zap className="w-6 h-6 text-amber-400" />,
      title: "Real-Time messaging",
      desc: "Delivered instantly using Supabase Realtime socket channels.",
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-emerald-400" />,
      title: "Row Level Security (RLS)",
      desc: "Comprehensive PostgreSQL security securing conversations and files.",
    },
    {
      icon: <Mic className="w-6 h-6 text-cyan-400" />,
      title: "Audio & Media Sharing",
      desc: "Upload files or record voice clips stored directly on Supabase Storage.",
    },
    {
      icon: <UserCheck className="w-6 h-6 text-pink-400" />,
      title: "Presence & Typing Status",
      desc: "Green online indicator, last active timestamp, and live typing alerts.",
    },
  ];

  return (
    <div className="relative min-h-screen bg-slate-950 text-white overflow-hidden font-sans select-none">
      {/* Dynamic background shapes */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-violet-900/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-900/10 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Nav bar */}
      <header className="relative max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-tr from-violet-600 to-indigo-500 rounded-xl shadow-md shadow-violet-500/10">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-wider text-slate-100">কোথাবার্তা</span>
        </div>
        <div>
          {user ? (
            <Link
              to="/dashboard"
              className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-violet-500/15"
            >
              Open App
            </Link>
          ) : (
            <div className="flex items-center gap-4">
              <Link to="/login" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero section */}
      <main className="relative max-w-6xl mx-auto px-6 pt-16 pb-24 flex flex-col items-center justify-center text-center z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Portfolio highlights badge */}
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full text-xs font-semibold text-violet-300"
          >
            <Code className="w-3.5 h-3.5" />
            <span>Recruiter Portfolio Demonstration</span>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-5xl md:text-7xl font-extrabold tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400"
          >
            Real-Time Chat <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-300">
              Reimagined
            </span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="max-w-2xl mx-auto text-sm md:text-base text-slate-400 leading-relaxed"
          >
            কোথাবার্তা (Kotha Barta) is a premium, full-stack messaging platform engineered with React and Supabase. Features real-time state sync, full security models, and a sleek modern interface.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              to={user ? "/dashboard" : "/login"}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl text-base font-bold shadow-xl shadow-violet-500/20 hover:shadow-violet-500/35 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Chatting
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-900/60 border border-slate-800 hover:bg-slate-900 hover:text-white text-slate-300 rounded-2xl text-base font-semibold transition-all active:scale-[0.98]"
            >
              Explore Features
            </a>
          </motion.div>
        </motion.div>

        {/* Feature section */}
        <section id="features" className="pt-32 w-full">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-100">
              Full-Stack Architecture Highlights
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              Engineered with clean architectural principles to achieve performance and security.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto text-left">
            {features.map((feat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl hover:border-slate-700/80 transition-colors backdrop-blur-md"
              >
                <div className="mb-4 flex items-center justify-center w-12 h-12 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                  {feat.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-200 mb-2">{feat.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-36 border-t border-slate-900 pt-8 w-full text-slate-500 text-xs">
          <p>© {new Date().getFullYear()} Kotha Barta. Portfolio project by Sajeeb Rahman.</p>
        </footer>
      </main>
    </div>
  );
};

export default Landing;

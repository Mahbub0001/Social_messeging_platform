import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, Zap, Mic, Video, CheckCheck, Sparkles } from "lucide-react";
import { useStore } from "../hooks/useStore";

export const Landing: React.FC = () => {
  const { user } = useStore();

  const capabilities = [
    {
      icon: <Zap className="w-5 h-5 text-teal-400" />,
      title: "Instant delivery",
      desc: "Messages, quoted replies, and typing indicators sync across web and Android in real time.",
    },
    {
      icon: <Video className="w-5 h-5 text-amber-400" />,
      title: "Crystal-clear calls",
      desc: "Peer-to-peer WebRTC voice and video calling with adaptive TURN relay fallback.",
    },
    {
      icon: <Mic className="w-5 h-5 text-rose-400" />,
      title: "Stories & voice clips",
      desc: "Share 24-hour photo and video stories with live emoji reactions, viewer lists, and voice notes.",
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
      title: "Row-level privacy",
      desc: "Strict PostgreSQL Row Level Security keeps conversations, media, and muted threads private.",
    },
  ];

  return (
    <div className="relative min-h-screen bg-[#0B0D12] text-[#F5F3EE] overflow-x-hidden select-none">
      {/* Subtle hairline grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />
      {/* Single restrained atmospheric glow behind the phone preview */}
      <div className="absolute top-16 right-[-8%] w-[520px] h-[520px] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Navigation */}
      <header className="relative max-w-6xl mx-auto px-5 sm:px-8 py-6 flex items-center justify-between z-10 border-b border-white/[0.06]">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src="/logo.png"
            alt="Kotha Barta Logo"
            className="w-9 h-9 rounded-xl object-cover border border-white/10 shadow-sm bg-white"
          />
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-white">কথাবার্তা</span>
            <span className="hidden sm:inline text-xs font-medium text-slate-400">Kotha Barta</span>
          </div>
        </Link>

        <nav className="flex items-center gap-3">
          {user ? (
            <Link
              to="/dashboard"
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              Open app
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3.5 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Split Editorial Hero */}
      <main className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-12 pb-20 lg:pt-20 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          {/* Left: Typography & Action */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="lg:col-span-6 text-left space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-teal-300">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              <span>Web & Android messenger</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.08] text-white">
              কথায় কথায় সংযোগ।
              <span className="block mt-2 text-slate-300 font-bold text-3xl sm:text-4xl lg:text-[2.6rem]">
                Conversations that feel close.
              </span>
            </h1>

            <p className="max-w-lg text-sm sm:text-base text-slate-400 leading-relaxed">
              Kotha Barta brings real-time messaging, 24-hour stories with reactions, community posts, and crisp voice & video calls into one calm, fast space built for both desktop and mobile.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Link
                to={user ? "/dashboard" : "/login"}
                className="inline-flex items-center justify-center px-6 py-3.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98] shadow-lg shadow-teal-950/50"
              >
                {user ? "Go to messages" : "Start chatting"}
              </Link>
              <a
                href="#capabilities"
                className="inline-flex items-center justify-center px-6 py-3.5 bg-[#13161F] hover:bg-[#1A1F2B] border border-[#242A3A] text-slate-200 rounded-xl text-sm font-medium transition-colors"
              >
                Explore capabilities
              </a>
            </div>
          </motion.div>

          {/* Right: Live Product Preview Frame */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
            className="lg:col-span-6"
          >
            <div className="relative mx-auto max-w-[420px] rounded-[28px] bg-[#13161F] border border-[#232938] shadow-2xl shadow-black/70 overflow-hidden">
              {/* Mockup App Header */}
              <div className="flex items-center justify-between px-4 py-3.5 bg-[#161A25] border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-xs font-bold text-white">
                      AN
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#161A25]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Ananya Rahman</p>
                    <p className="text-[11px] text-emerald-400 font-medium">Online</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-[11px] font-medium text-teal-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Bhuiyan AI
                  </span>
                </div>
              </div>

              {/* Mockup Stories Strip */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] bg-[#10131B]">
                {[
                  { name: "My Story", ring: "from-teal-400 to-amber-400", init: "NB" },
                  { name: "Rafi", ring: "from-rose-400 to-orange-400", init: "RF" },
                  { name: "Tania", ring: "from-teal-400 to-cyan-400", init: "TN" },
                  { name: "Siam", ring: "from-slate-600 to-slate-700", init: "SM" },
                ].map((s, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={`w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr ${s.ring}`}>
                      <div className="w-full h-full rounded-full bg-[#191E2A] flex items-center justify-center text-[11px] font-semibold text-slate-200 border-2 border-[#10131B]">
                        {s.init}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">{s.name}</span>
                  </div>
                ))}
              </div>

              {/* Mockup Chat Thread */}
              <div className="p-4 space-y-3 kb-chat-canvas bg-[#0D1017]">
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-[#181D29] border border-white/[0.07] px-3.5 py-2.5">
                    <p className="text-xs text-slate-100 leading-relaxed">
                      নতুন আপডেটটা দেখেছো? স্টোরিতে রিঅ্যাকশন আর রিপ্লাই কার্ড এখন অনেক সুন্দর লাগছে!
                    </p>
                    <span className="block mt-1 text-[10px] text-slate-500">10:41 PM</span>
                  </div>
                </div>

                {/* Quoted Reply Bubble */}
                <div className="flex justify-end">
                  <div className="max-w-[82%] rounded-2xl rounded-br-md bg-teal-600 px-3.5 py-2.5 shadow-md">
                    <div className="mb-1.5 px-2.5 py-1.5 rounded-lg bg-black/20 border-l-2 border-amber-300 text-left">
                      <p className="text-[10px] font-semibold text-amber-200">Ananya Rahman</p>
                      <p className="text-[11px] text-white/80 truncate">নতুন আপডেটটা দেখেছো?...</p>
                    </div>
                    <p className="text-xs text-white leading-relaxed">
                      হ্যাঁ! ডার্ক আর লাইট মোড দুটোই এখন একদম ক্লিন এবং ফাস্ট।
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-teal-100/80">
                      <span>10:42 PM</span>
                      <CheckCheck className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                </div>

                {/* Voice Clip Preview */}
                <div className="flex justify-start">
                  <div className="flex items-center gap-2.5 rounded-2xl rounded-bl-md bg-[#181D29] border border-white/[0.07] px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center">
                      <Mic className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex items-center gap-0.5 h-4">
                      {[40, 75, 55, 90, 65, 85, 45, 70, 50, 80, 35].map((h, idx) => (
                        <span
                          key={idx}
                          className="w-1 rounded-full bg-teal-400/75"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400 tabular-nums ml-1">0:14</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Hairline Capabilities Grid */}
        <section id="capabilities" className="mt-24 pt-12 border-t border-white/[0.08]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Built for everyday conversations
              </h2>
              <p className="mt-2 text-sm text-slate-400 max-w-xl">
                Every screen is engineered to stay responsive on desktop browsers and native Android devices alike.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-white/[0.08] rounded-2xl overflow-hidden bg-[#11141C]">
            {capabilities.map((feat, idx) => (
              <div
                key={idx}
                className="p-6 border-b sm:border-b-0 sm:border-r border-white/[0.07] last:border-r-0 last:border-b-0 hover:bg-white/[0.02] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                  {feat.icon}
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">{feat.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-20 border-t border-white/[0.07] pt-8 pb-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-xs">
          <p>
            © {new Date().getFullYear()} কথাবার্তা (Kotha Barta).
          </p>
          <p>
            Developed by{" "}
            <span className="text-slate-200 font-medium">Mahbub Ul Alam Bhuiyan (Nibir)</span>
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Landing;

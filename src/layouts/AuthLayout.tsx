import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#0B0D12] text-[#F5F3EE] overflow-hidden px-4 py-8 select-none">
      {/* Subtle architectural grid + single controlled jade atmospheric glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="absolute top-[-18%] left-1/2 -translate-x-1/2 w-[540px] h-[340px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[420px] z-10">
        {/* Back to home */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Kotha Barta</span>
          </Link>
        </div>

        {/* Brand Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <img
            src="/logo.png"
            alt="Kotha Barta Logo"
            className="w-12 h-12 rounded-2xl object-cover shadow-lg border border-white/10"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white leading-tight">
              কথাবার্তা
            </h1>
            <p className="text-xs text-slate-400">
              Private messaging, stories & live calls
            </p>
          </div>
        </div>

        {/* Card wrapper */}
        <div className="bg-[#13161F]/95 backdrop-blur-xl border border-[#222736] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;

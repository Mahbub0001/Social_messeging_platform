import React from "react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-slate-950 overflow-hidden px-4 select-none">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-900/20 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: "2s" }}></div>

      <div className="w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-3 animate-bounce" style={{ animationDuration: "3s" }}>
            <img
              src="/logo.png"
              alt="Kotha Barta Logo"
              className="w-16 h-16 rounded-2xl object-cover shadow-xl shadow-violet-500/20 border border-slate-700/50"
            />
          </div>
          <h1 className="text-3xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-300 font-sans">
            কথাবার্তা
          </h1>
          <p className="mt-1 text-sm text-slate-400 font-sans">
            Connect in Real-Time, Anywhere
          </p>
        </div>

        {/* Card wrapper */}
        <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-slate-950/50">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;

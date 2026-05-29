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
          <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-violet-600 to-indigo-500 rounded-2xl shadow-lg shadow-violet-500/20 mb-3 animate-bounce" style={{ animationDuration: "3s" }}>
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
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

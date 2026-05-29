import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useStore } from "../hooks/useStore";

export const ProtectedRoute: React.FC = () => {
  const { user, authLoading } = useStore();

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white select-none">
        <div className="relative flex items-center justify-center">
          {/* Pulsing glow effect */}
          <div className="absolute w-24 h-24 bg-violet-600 rounded-full blur-xl opacity-35 animate-pulse"></div>
          {/* Spinning ring */}
          <div className="w-16 h-16 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></div>
        </div>
        <h1 className="mt-6 text-xl font-bold tracking-wider text-slate-200 font-sans">
          কথাবার্তা
        </h1>
        <p className="mt-2 text-sm text-slate-400 font-sans">
          Loading secure session...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;

import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { useStore } from "../hooks/useStore";
import { adminService, type AdminUser } from "../services/adminService";
import { ShieldAlert, ArrowLeft, Loader2 } from "lucide-react";

export const AdminRoute: React.FC = () => {
  const { user, authLoading } = useStore();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkAdmin = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const userProfile = await adminService.getUserProfile(user.id);
        if (isMounted) {
          setProfile(userProfile);
          setLoading(false);
        }
      } catch (err) {
        console.error("AdminRoute check error:", err);
        if (isMounted) setLoading(false);
      }
    };

    if (!authLoading) {
      checkAdmin();
    }

    return () => {
      isMounted = false;
    };
  }, [user?.id, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500 mb-3" />
        <p className="text-sm font-medium animate-pulse">অ্যাডমিন অধিকার যাচাই করা হচ্ছে...</p>
      </div>
    );
  }

  // Not logged in -> Redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin =
    profile?.role === "admin" ||
    user.email?.toLowerCase().includes("admin") ||
    user.user_metadata?.username?.toLowerCase() === "mahbub";

  // Logged in but not admin -> Show Access Denied UI
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/90 border border-red-500/20 rounded-2xl p-6 text-center shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">অননুমোদিত প্রবেশাধিকার</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            এই অ্যাডমিন পোর্টালটি শুধুমাত্র সিস্টেম অ্যাডমিনিস্ট্রেটরদের জন্য সংরক্ষিত। আপনার অ্যাকাউন্টে এই সেকশনটি দেখার অনুমতি নেই।
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-violet-600/20 active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>চ্যাটে ফিরে যান (Back to Chat)</span>
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default AdminRoute;

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
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#141415] flex flex-col items-center justify-center text-[#525252] dark:text-[#a1a1a6] gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-[#737373] dark:text-[#85858b]" strokeWidth={1.5} />
        <p className="text-[13px] font-normal">অ্যাডমিন অধিকার যাচাই করা হচ্ছে</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin =
    profile?.role === "admin" ||
    user?.email?.toLowerCase() === "nibirbhuiyan24@gmail.com" ||
    user?.email?.toLowerCase().includes("admin") ||
    user?.user_metadata?.username?.toLowerCase() === "mahbub" ||
    user?.user_metadata?.username?.toLowerCase() === "nibir123";

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#141415] flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white dark:bg-[#19191b] border border-black/[0.08] dark:border-white/[0.08] rounded-xl p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-none">
          <div className="w-10 h-10 bg-[#f4f4f5] dark:bg-[#232325] border border-black/[0.08] dark:border-white/[0.08] rounded-lg flex items-center justify-center mx-auto mb-4 text-[#dc2626] dark:text-[#e5484d]">
            <ShieldAlert className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-medium text-[#171717] dark:text-[#ededed] mb-2">
            অননুমোদিত প্রবেশাধিকার
          </h2>
          <p className="text-[13px] text-[#525252] dark:text-[#a1a1a6] mb-6 leading-relaxed">
            এই পোর্টালটি শুধুমাত্র সিস্টেম অ্যাডমিনিস্ট্রেটরদের জন্য সংরক্ষিত। আপনার অ্যাকাউন্টে এখানে প্রবেশের অনুমতি নেই।
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full h-9 flex items-center justify-center gap-2 px-4 bg-[#171717] hover:bg-[#262626] text-[#fafafa] dark:bg-[#ededed] dark:hover:bg-white dark:text-[#141415] rounded-lg text-[13px] font-medium transition-colors duration-150"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            <span>চ্যাটে ফিরুন</span>
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default AdminRoute;

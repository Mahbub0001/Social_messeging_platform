import React, { Suspense, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Megaphone,
  ArrowLeft,
  Sun,
  Moon,
  Menu,
  X,
  Shield,
  Loader2,
  LogOut,
} from "lucide-react";
import { useStore } from "../hooks/useStore";
import { authService } from "../services/authService";

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, theme, setTheme } = useStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleLogout = async () => {
    await authService.signOut();
    navigate("/login");
  };

  const navItems = [
    {
      name: "ড্যাশবোর্ড (Overview)",
      path: "/admin",
      end: true,
      icon: LayoutDashboard,
    },
    {
      name: "ইউজার ম্যানেজমেন্ট",
      path: "/admin/users",
      end: false,
      icon: Users,
    },
    {
      name: "স্টোরি ও কন্টেন্ট মডারেশন",
      path: "/admin/moderation",
      end: false,
      icon: ShieldCheck,
    },
    {
      name: "সিস্টেম ব্রডকাস্ট ও নোটিফিকেশন",
      path: "/admin/broadcast",
      end: false,
      icon: Megaphone,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-violet-600 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link to="/admin" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-md shadow-violet-600/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">কথাবার্তা</span>
                <span className="px-1.5 py-0.5 rounded-md text-3xs font-bold uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  Admin
                </span>
              </div>
              <p className="text-3xs text-slate-400 hidden sm:block">সিস্টেম কন্ট্রোল সেন্টার</p>
            </div>
          </Link>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Back to Chat button */}
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700/80 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700/60 transition-all shadow-sm active:scale-95"
            title="চ্যাট মেসেজিং-এ ফিরে যান"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-violet-400" />
            <span className="hidden sm:inline">চ্যাটে ফিরে যান</span>
          </Link>

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Admin User Chip */}
          <div className="hidden md:flex items-center gap-2.5 pl-2 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-xs font-bold text-violet-300">
              {user?.user_metadata?.username?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="text-left text-xs">
              <p className="font-semibold text-slate-200 leading-tight">
                {user?.user_metadata?.username || "Admin"}
              </p>
              <p className="text-3xs text-emerald-400 font-medium">সিস্টেম এডমিন</p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
            title="লগআউট"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-16 left-0 z-30 w-64 bg-slate-900/95 md:bg-slate-900/50 backdrop-blur-xl border-r border-slate-800/80 p-4 transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="space-y-1">
            <p className="px-3 py-2 text-3xs font-bold text-slate-500 uppercase tracking-wider">
              ন্যাভিগেশন মেনু
            </p>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? "bg-violet-600 text-white font-semibold shadow-md shadow-violet-600/20"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800/60 text-center px-2">
            <p className="text-3xs text-slate-500 leading-relaxed">
              Kotha Barta Management Console v2.0
            </p>
          </div>
        </aside>

        {/* Content Outlet Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950/60">
          <Suspense
            fallback={
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-7 h-7 animate-spin text-violet-500 mb-2" />
                <p className="text-xs">লোড হচ্ছে...</p>
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;

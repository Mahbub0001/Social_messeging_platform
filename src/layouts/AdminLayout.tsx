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
  Globe,
} from "lucide-react";
import { useStore } from "../hooks/useStore";
import { authService } from "../services/authService";
import { AdminLanguageProvider, useAdminLanguage } from "../context/AdminLanguageContext";

import { motion } from "framer-motion";
import { cn } from "../lib/utils";

const AdminLayoutContent: React.FC = () => {
  const navigate = useNavigate();
  const { user, theme, toggleTheme } = useStore();
  const { language, toggleLanguage, t } = useAdminLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await authService.signOut();
    navigate("/login");
  };

  const navItems = [
    {
      name: t("nav.overview"),
      path: "/admin",
      end: true,
      icon: LayoutDashboard,
    },
    {
      name: t("nav.users"),
      path: "/admin/users",
      end: false,
      icon: Users,
    },
    {
      name: t("nav.moderation"),
      path: "/admin/moderation",
      end: false,
      icon: ShieldCheck,
    },
    {
      name: t("nav.broadcast"),
      path: "/admin/broadcast",
      end: false,
      icon: Megaphone,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-violet-600 selection:text-white transition-colors">
      {/* Top Header */}
      <header className="sticky top-0 z-40 h-16 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/80 px-4 md:px-6 flex items-center justify-between transition-colors shadow-2xs">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link to="/admin" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-md shadow-violet-600/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">কথাবার্তা</span>
                <span className="px-1.5 py-0.5 rounded-md text-3xs font-bold uppercase tracking-wider bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30">
                  Admin
                </span>
              </div>
              <p className="text-3xs text-slate-500 dark:text-slate-400 hidden sm:block">{t("nav.adminControl")}</p>
            </div>
          </Link>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Switcher Toggle */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/90 text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-white rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700/70 transition-all shadow-2xs active:scale-95"
            title={language === "bn" ? "Switch to English" : "বাংলায় পরিবর্তন করুন"}
          >
            <Globe className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
            <span className="font-semibold tracking-wide">
              {language === "bn" ? "English" : "বাংলা"}
            </span>
          </button>

          {/* Back to Chat button */}
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700/60 transition-all shadow-2xs active:scale-95"
            title={t("nav.backToChat")}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
            <span className="hidden sm:inline">{t("nav.backToChat")}</span>
          </Link>

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-colors"
            title={t("nav.themeToggle")}
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Admin User Chip */}
          <div className="hidden md:flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-xs font-bold text-violet-700 dark:text-violet-300">
              {user?.user_metadata?.username?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="text-left text-xs">
              <p className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                {user?.user_metadata?.username || "Admin"}
              </p>
              <p className="text-3xs text-emerald-600 dark:text-emerald-400 font-medium">{t("nav.adminRole")}</p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
            title={t("nav.logout")}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-16 left-0 z-30 w-64 bg-white/95 md:bg-white/60 dark:bg-slate-900/95 md:dark:bg-slate-900/50 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800/80 p-4 transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="space-y-1">
            <p className="px-3 py-2 text-3xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {language === "bn" ? "ন্যাভিগেশন মেনু" : "Navigation Menu"}
            </p>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors z-10 select-none",
                    isActive
                      ? "text-white font-semibold"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="adminNavIndicator"
                        className="absolute inset-0 bg-violet-600 rounded-xl shadow-md shadow-violet-600/25 -z-10"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>

          <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800/60 text-center px-2">
            <p className="text-3xs text-slate-400 dark:text-slate-500 leading-relaxed">
              Kotha Barta Management Console v2.0
            </p>
          </div>
        </aside>

        {/* Content Outlet Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-100/50 dark:bg-slate-950/60 transition-colors">
          <Suspense
            fallback={
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-7 h-7 animate-spin text-violet-500 mb-2" />
                <p className="text-xs">{language === "bn" ? "লোড হচ্ছে..." : "Loading..."}</p>
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

export const AdminLayout: React.FC = () => {
  return (
    <AdminLanguageProvider>
      <AdminLayoutContent />
    </AdminLanguageProvider>
  );
};

export default AdminLayout;

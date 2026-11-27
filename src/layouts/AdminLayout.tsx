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
  Loader2,
  LogOut,
  Globe,
} from "lucide-react";
import { useStore } from "../hooks/useStore";
import { authService } from "../services/authService";
import { AdminLanguageProvider, useAdminLanguage } from "../context/AdminLanguageContext";
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
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#141415] text-[#171717] dark:text-[#ededed] flex flex-col font-sans selection:bg-teal-600/20 selection:text-teal-900 dark:selection:text-teal-200">
      {/* Top Header (56px) */}
      <header className="sticky top-0 z-40 h-14 bg-white dark:bg-[#0f0f10] border-b border-black/[0.08] dark:border-white/[0.08] px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation"
            className="md:hidden w-8 h-8 flex items-center justify-center text-[#525252] dark:text-[#a1a1a6] hover:bg-[#f4f4f5] dark:hover:bg-[#232325] rounded-lg transition-colors duration-150"
          >
            {sidebarOpen ? (
              <X className="w-4 h-4" strokeWidth={1.5} />
            ) : (
              <Menu className="w-4 h-4" strokeWidth={1.5} />
            )}
          </button>

          <Link to="/admin" className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-md">
            <img
              src="/logo.png"
              alt="Kotha Barta"
              className="w-7 h-7 rounded-md object-cover border border-black/[0.08] dark:border-white/[0.08] bg-white"
            />
            <span className="text-[16px] font-medium tracking-[-0.01em] text-[#171717] dark:text-[#ededed]">
              কথাবার্তা
            </span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[11px] font-mono text-[#737373] dark:text-[#85858b] bg-[#f4f4f5] dark:bg-[#232325] border border-black/[0.06] dark:border-white/[0.06]">
              admin
            </span>
          </Link>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLanguage}
            className="h-8 px-2.5 flex items-center gap-1.5 bg-[#f4f4f5] hover:bg-[#e4e4e7] dark:bg-[#19191b] dark:hover:bg-[#232325] text-[#525252] dark:text-[#a1a1a6] hover:text-[#171717] dark:hover:text-[#ededed] rounded-lg text-xs font-medium border border-black/[0.08] dark:border-white/[0.08] transition-colors duration-150"
            title={language === "bn" ? "Switch to English" : "বাংলায় পরিবর্তন করুন"}
          >
            <Globe className="w-4 h-4 text-[#737373] dark:text-[#85858b]" strokeWidth={1.5} />
            <span>{language === "bn" ? "English" : "বাংলা"}</span>
          </button>

          <Link
            to="/dashboard"
            className="h-8 px-2.5 flex items-center gap-1.5 bg-[#f4f4f5] hover:bg-[#e4e4e7] dark:bg-[#19191b] dark:hover:bg-[#232325] text-[#525252] dark:text-[#a1a1a6] hover:text-[#171717] dark:hover:text-[#ededed] rounded-lg text-xs font-medium border border-black/[0.08] dark:border-white/[0.08] transition-colors duration-150"
            title={t("nav.backToChat")}
          >
            <ArrowLeft className="w-4 h-4 text-[#737373] dark:text-[#85858b]" strokeWidth={1.5} />
            <span className="hidden sm:inline">{t("nav.backToChat")}</span>
          </Link>

          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center text-[#525252] dark:text-[#a1a1a6] hover:text-[#171717] dark:hover:text-[#ededed] hover:bg-[#f4f4f5] dark:hover:bg-[#232325] rounded-lg transition-colors duration-150"
            title={t("nav.themeToggle")}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" strokeWidth={1.5} />
            ) : (
              <Moon className="w-4 h-4" strokeWidth={1.5} />
            )}
          </button>

          <div className="hidden md:flex items-center gap-2 pl-2 ml-1 border-l border-black/[0.08] dark:border-white/[0.08]">
            <div className="w-7 h-7 rounded-full bg-[#f4f4f5] dark:bg-[#232325] border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center text-xs font-medium text-[#171717] dark:text-[#ededed]">
              {user?.user_metadata?.username?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-[#171717] dark:text-[#ededed] leading-tight">
                {user?.user_metadata?.username || "Admin"}
              </p>
              <p className="text-[11px] text-[#737373] dark:text-[#85858b] leading-tight">
                {t("nav.adminRole")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-8 h-8 flex items-center justify-center text-[#737373] dark:text-[#85858b] hover:text-[#dc2626] dark:hover:text-[#e5484d] hover:bg-[#f4f4f5] dark:hover:bg-[#232325] rounded-lg transition-colors duration-150"
            title={t("nav.logout")}
          >
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Main Shell */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 top-14 z-20 bg-black/40 md:hidden"
          />
        )}

        {/* Sidebar (256px) */}
        <aside
          className={cn(
            "fixed inset-y-14 left-0 z-30 w-64 bg-white dark:bg-[#0f0f10] border-r border-black/[0.08] dark:border-white/[0.08] p-4 flex flex-col justify-between transition-transform duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] md:static md:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div>
            <p className="px-2.5 mt-2 mb-2 text-xs font-normal text-[#737373] dark:text-[#85858b]">
              {t("nav.adminControl")}
            </p>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "relative flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-[13px] transition-colors duration-150 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
                      isActive
                        ? "bg-[#f4f4f5] dark:bg-[#232325] text-[#171717] dark:text-[#ededed] font-medium dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        : "text-[#525252] dark:text-[#a1a1a6] font-normal hover:bg-[#f4f4f5]/70 dark:hover:bg-[#19191b] hover:text-[#171717] dark:hover:text-[#ededed]"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="w-4 flex items-center justify-center shrink-0">
                        <item.icon
                          className={cn(
                            "w-4 h-4",
                            isActive
                              ? "text-[#0f766e] dark:text-[#14b8a6]"
                              : "text-[#737373] dark:text-[#85858b]"
                          )}
                          strokeWidth={1.5}
                        />
                      </span>
                      <span className="truncate">{item.name}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="mt-6 pt-4 border-t border-black/[0.08] dark:border-white/[0.08] px-2.5 flex items-center justify-between">
            <span className="text-xs font-mono text-[#737373] dark:text-[#85858b]">v2.0</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#525252] dark:text-[#a1a1a6]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] dark:bg-[#4cc38a]" />
              <span>{t("nav.systemOnline")}</span>
            </span>
          </div>
        </aside>

        {/* Fluid Main Area */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 bg-[#fafafa] dark:bg-[#141415]">
          <div className="max-w-[1440px] mx-auto">
            <Suspense
              fallback={
                <div className="h-64 flex flex-col items-center justify-center text-[#737373] dark:text-[#85858b] gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />
                  <p className="text-xs">{language === "bn" ? "লোড হচ্ছে" : "Loading"}</p>
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
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

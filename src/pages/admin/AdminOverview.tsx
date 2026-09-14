import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  UserCheck,
  MessageSquare,
  ShieldAlert,
  Megaphone,
  ArrowRight,
  RefreshCw,
  Clock,
} from "lucide-react";
import { adminService, type AdminStats, type AdminUser } from "../../services/adminService";
import { useAdminLanguage } from "../../context/AdminLanguageContext";
import { AdminAnalyticsCharts } from "../../components/admin/AdminAnalyticsCharts";

export const AdminOverview: React.FC = () => {
  const { t, language } = useAdminLanguage();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeUsersToday: 0,
    totalMessages: 0,
    activeStories: 0,
  });
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [statsData, usersData] = await Promise.all([
        adminService.getStats(),
        adminService.getUsers("", "all", "all"),
      ]);
      setStats(statsData);
      setAllUsers(usersData);
      setRecentUsers(usersData.slice(0, 5));
    } catch (err) {
      console.error("Failed to load overview data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const statCards = [
    {
      title: t("overview.totalUsers"),
      value: stats.totalUsers,
      subtext: t("overview.totalUsersSub"),
      icon: Users,
      color: "from-blue-600 to-indigo-600",
      iconColor: "text-blue-400",
    },
    {
      title: t("overview.dau"),
      value: stats.activeUsersToday,
      subtext: t("overview.dauSub"),
      icon: UserCheck,
      color: "from-emerald-600 to-teal-600",
      iconColor: "text-emerald-400",
    },
    {
      title: t("overview.messages"),
      value: stats.totalMessages,
      subtext: t("overview.messagesSub"),
      icon: MessageSquare,
      color: "from-violet-600 to-purple-600",
      iconColor: "text-violet-400",
    },
    {
      title: t("overview.stories"),
      value: stats.activeStories,
      subtext: t("overview.storiesSub"),
      icon: Clock,
      color: "from-amber-600 to-orange-600",
      iconColor: "text-amber-400",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-violet-950/40 via-slate-900/60 to-indigo-950/40 border border-violet-500/20 shadow-xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-3xs font-bold uppercase tracking-wider text-emerald-400">
              {t("nav.systemOnline")}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {t("overview.welcome")}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t("overview.subtitle")}
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-xs font-semibold text-slate-200 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-violet-400" : ""}`} />
          <span>{t("overview.refresh")}</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400">{card.title}</span>
              <div className={`p-2 rounded-xl bg-slate-800/80 ${card.iconColor}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>

            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1">
              {loading ? (
                <span className="inline-block w-12 h-7 bg-slate-800 animate-pulse rounded" />
              ) : (
                card.value.toLocaleString()
              )}
            </div>
            <p className="text-3xs text-slate-500">{card.subtext}</p>
          </div>
        ))}
      </div>

      {/* Interactive Analytics Graphs */}
      <AdminAnalyticsCharts stats={stats} users={allUsers} />

      {/* Quick Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/admin/users"
          className="group p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-800/50 border border-slate-800/80 hover:border-violet-500/40 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 group-hover:text-violet-300 transition-colors">
              {t("nav.users")}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {t("users.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-violet-400 mt-4">
            <span>{t("overview.manage")}</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          to="/admin/moderation"
          className="group p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-800/50 border border-slate-800/80 hover:border-violet-500/40 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
              {t("nav.moderation")}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {t("mod.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-amber-400 mt-4">
            <span>{t("overview.moderate")}</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          to="/admin/broadcast"
          className="group p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-800/50 border border-slate-800/80 hover:border-violet-500/40 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
              <Megaphone className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">
              {t("nav.broadcast")}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {t("broadcast.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 mt-4">
            <span>{t("overview.broadcast")}</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Recent Users Section */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100">{t("overview.recentUsers")}</h3>
            <p className="text-3xs text-slate-400">
              {language === "bn" ? "সর্বশেষ সংযুক্ত হওয়া ইউজার প্রোফাইল" : "Recently registered user profiles"}
            </p>
          </div>
          <Link
            to="/admin/users"
            className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1"
          >
            <span>{t("overview.viewAll")}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-800/60 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : recentUsers.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">{t("overview.noRecentUsers")}</p>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {recentUsers.map((u) => (
              <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center font-bold text-xs text-violet-300 overflow-hidden shrink-0">
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt={u.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      u.username[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">{u.username}</p>
                    <p className="text-3xs text-slate-500">ID: {u.id.slice(0, 8)}...</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-3xs font-semibold uppercase ${
                      u.role === "admin"
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                        : u.role === "moderator"
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {u.role}
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded-full text-3xs font-semibold ${
                      u.is_banned
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {u.is_banned ? t("chart.banned") : t("chart.active")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOverview;

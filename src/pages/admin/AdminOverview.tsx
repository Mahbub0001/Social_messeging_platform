import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ArrowRight } from "lucide-react";
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
  const [messageTimestamps, setMessageTimestamps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [statsData, usersData, msgTs] = await Promise.all([
        adminService.getStats(),
        adminService.getUsers("", "all", "all"),
        adminService.getMessageTimestamps(30),
      ]);
      setStats(statsData);
      setAllUsers(usersData);
      setRecentUsers(usersData.slice(0, 6));
      setMessageTimestamps(msgTs);
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
    },
    {
      title: t("overview.dau"),
      value: stats.activeUsersToday,
      subtext: t("overview.dauSub"),
      accent: true,
    },
    {
      title: t("overview.messages"),
      value: stats.totalMessages,
      subtext: t("overview.messagesSub"),
    },
    {
      title: t("overview.stories"),
      value: stats.activeStories,
      subtext: t("overview.storiesSub"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-[28px] leading-[1.15] font-medium tracking-[-0.015em] text-[#171717] dark:text-[#ededed]">
              {t("overview.welcome")}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white dark:bg-[#19191b] border border-black/[0.08] dark:border-white/[0.08] text-xs text-[#525252] dark:text-[#a1a1a6]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] dark:bg-[#4cc38a]" />
              <span>{t("nav.systemOnline")}</span>
            </span>
          </div>
          <p className="text-[13px] text-[#525252] dark:text-[#a1a1a6] mt-1.5">
            {t("overview.subtitle")}
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="self-start sm:self-auto h-8 px-3 rounded-lg bg-white hover:bg-[#f4f4f5] dark:bg-[#19191b] dark:hover:bg-[#232325] border border-black/[0.08] dark:border-white/[0.08] text-xs font-medium text-[#171717] dark:text-[#ededed] flex items-center gap-2 transition-colors duration-150 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-[#737373] dark:text-[#85858b] ${
              refreshing ? "animate-spin" : ""
            }`}
            strokeWidth={1.5}
          />
          <span>{t("overview.refresh")}</span>
        </button>
      </div>

      {/* Stat Cards (Numbers only, equal height) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="p-5 rounded-xl bg-white dark:bg-[#19191b] border border-black/[0.08] dark:border-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col justify-between"
          >
            <span className="text-xs font-normal text-[#737373] dark:text-[#85858b]">
              {card.title}
            </span>
            <div
              className={`mt-3 text-[28px] leading-none font-medium tabular-nums ${
                card.accent
                  ? "text-[#0f766e] dark:text-[#14b8a6]"
                  : "text-[#171717] dark:text-[#ededed]"
              }`}
            >
              {loading ? "—" : card.value.toLocaleString()}
            </div>
            <p className="mt-2.5 text-xs text-[#737373] dark:text-[#85858b]">
              {card.subtext}
            </p>
          </div>
        ))}
      </div>

      {/* Main Analytics Moment (2/3 Area+Line + 1/3 Breakdown) */}
      <AdminAnalyticsCharts
        stats={stats}
        users={allUsers}
        messageTimestamps={messageTimestamps}
      />

      {/* Recent Accounts Table */}
      <section className="rounded-xl bg-white dark:bg-[#19191b] border border-black/[0.08] dark:border-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-[#171717] dark:text-[#ededed]">
              {t("overview.recentUsers")}
            </h2>
            <p className="text-xs text-[#737373] dark:text-[#85858b] mt-0.5">
              {language === "bn" ? "সর্বশেষ সক্রিয় অ্যাকাউন্ট তালিকা" : "Most recently active accounts"}
            </p>
          </div>
          <Link
            to="/admin/users"
            className="text-xs font-medium text-[#0f766e] dark:text-[#14b8a6] hover:underline flex items-center gap-1.5"
          >
            <span>{t("overview.viewAll")}</span>
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Link>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 rounded-lg bg-[#f4f4f5] dark:bg-[#232325]"
              />
            ))}
          </div>
        ) : recentUsers.length === 0 ? (
          <p className="text-[13px] text-[#737373] dark:text-[#85858b] text-center py-8">
            {t("overview.noRecentUsers")}
          </p>
        ) : (
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {recentUsers.map((u) => (
              <div
                key={u.id}
                className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-[#fafafa] dark:hover:bg-[#232325]/50 transition-colors duration-150"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#f4f4f5] dark:bg-[#232325] border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center text-xs font-medium text-[#171717] dark:text-[#ededed] overflow-hidden shrink-0">
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
                    <p className="text-[13px] font-medium text-[#171717] dark:text-[#ededed] truncate">
                      {u.username}
                    </p>
                    <p className="text-xs font-mono tabular-nums text-[#737373] dark:text-[#85858b]">
                      {u.id.slice(0, 8)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 text-xs">
                  <span className="font-mono text-[#525252] dark:text-[#a1a1a6] capitalize">
                    {u.role}
                  </span>
                  <span className="inline-flex items-center gap-1.5 min-w-[68px] justify-end">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        u.is_banned
                          ? "bg-[#dc2626] dark:bg-[#e5484d]"
                          : "bg-[#16a34a] dark:bg-[#4cc38a]"
                      }`}
                    />
                    <span
                      className={
                        u.is_banned
                          ? "text-[#dc2626] dark:text-[#e5484d]"
                          : "text-[#525252] dark:text-[#a1a1a6]"
                      }
                    >
                      {u.is_banned ? t("chart.banned") : t("chart.active")}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminOverview;

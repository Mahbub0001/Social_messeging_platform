import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  Trash2,
  AlertCircle,
  Eye,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Film,
  RefreshCw,
} from "lucide-react";
import {
  adminService,
  type LiveStoryItem,
  type ContentReportItem,
} from "../../services/adminService";
import { useAdminLanguage } from "../../context/AdminLanguageContext";

export const ContentModeration: React.FC = () => {
  const { t, language } = useAdminLanguage();
  const [activeTab, setActiveTab] = useState<"stories" | "reports">("stories");
  const [stories, setStories] = useState<LiveStoryItem[]>([]);
  const [reports, setReports] = useState<ContentReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: "image" | "video" } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [storiesData, reportsData] = await Promise.all([
        adminService.getLiveStories(),
        adminService.getReports(),
      ]);
      setStories(storiesData);
      setReports(reportsData);
    } catch (err) {
      console.error("Failed to load moderation data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteStory = async (story: LiveStoryItem) => {
    const author = story.profiles?.username || (language === "bn" ? "ইউজার" : "User");
    const confirmPrompt = language === "bn"
      ? `আপনি কি নিশ্চিতভাবে ${author}-এর এই স্টোরিটি স্থায়ীভাবে ডিলিট করতে চান?`
      : `Are you sure you want to permanently delete this story by ${author}?`;
    if (!window.confirm(confirmPrompt)) {
      return;
    }

    setDeletingId(story.id);
    try {
      const success = await adminService.deleteStory(story.id, story.media_url);
      if (success) {
        setStories((prev) => prev.filter((s) => s.id !== story.id));
      } else {
        alert(language === "bn" ? "স্টোরি ডিলিট করতে সমস্যা হয়েছে।" : "Failed to delete story.");
      }
    } catch (err) {
      console.error("Delete story error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateReportStatus = async (
    reportId: string,
    status: "resolved" | "dismissed"
  ) => {
    try {
      const success = await adminService.updateReportStatus(reportId, status);
      if (success) {
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status } : r))
        );
      }
    } catch (err) {
      console.error("Update report status error:", err);
    }
  };

  const formatRemainingTime = (expiresAt: string) => {
    const remainingMs = new Date(expiresAt).getTime() - Date.now();
    if (remainingMs <= 0) return language === "bn" ? "মেয়াদ শেষ" : "Expired";
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    return language === "bn" ? `${hours} ঘণ্টা ${mins} মি. বাকি` : `${hours}h ${mins}m left`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            <span>{t("mod.title")}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t("mod.subtitle")}
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all active:scale-95 disabled:opacity-50 shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-500 dark:text-amber-400" : ""}`} />
          <span>{t("overview.refresh")}</span>
        </button>
      </div>

      {/* Tabs Switcher with Sliding Indicator */}
      <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80">
        <button
          onClick={() => setActiveTab("stories")}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors z-10 select-none ${
            activeTab === "stories"
              ? "text-amber-700 dark:text-amber-300 font-bold"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          {activeTab === "stories" && (
            <motion.div
              layoutId="modActiveTabIndicator"
              className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-700/60 -z-10"
              transition={{ type: "spring", stiffness: 450, damping: 35 }}
            />
          )}
          <Film className="w-4 h-4" />
          <span>{t("mod.liveStories")}</span>
          <span className="px-1.5 py-0.5 rounded-full text-3xs font-bold bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300">
            {stories.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("reports")}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors z-10 select-none ${
            activeTab === "reports"
              ? "text-red-700 dark:text-red-300 font-bold"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          {activeTab === "reports" && (
            <motion.div
              layoutId="modActiveTabIndicator"
              className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-700/60 -z-10"
              transition={{ type: "spring", stiffness: 450, damping: 35 }}
            />
          )}
          <AlertCircle className="w-4 h-4" />
          <span>{t("mod.reports")}</span>
          <span className="px-1.5 py-0.5 rounded-full text-3xs font-bold bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300">
            {reports.filter((r) => r.status === "pending").length}
          </span>
        </button>
      </div>

      {/* Tab 1: Live Stories */}
      {activeTab === "stories" && (
        <div>
          {loading ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500">
              <Loader2 className="w-7 h-7 animate-spin mx-auto mb-3 text-amber-500 dark:text-amber-400" />
              <p className="text-xs">{language === "bn" ? "লাইভ স্টোরি লোড হচ্ছে..." : "Loading live stories..."}</p>
            </div>
          ) : stories.length === 0 ? (
            <div className="py-16 text-center rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 p-8 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Film className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{t("mod.noStories")}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === "bn"
                  ? "এই মুহূর্তে প্ল্যাটফর্মে কোনো লাইভ ২৪ ঘণ্টার স্টোরি পাওয়া যায়নি।"
                  : "No live ephemeral 24-hour stories found on the platform right now."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {stories.map((story) => (
                <div
                  key={story.id}
                  className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-xs hover:shadow-md flex flex-col justify-between group hover:border-amber-500/40 transition-all"
                >
                  {/* Card Header: User info */}
                  <div className="p-3 bg-slate-50/90 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-violet-500/10 dark:bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-xs font-bold text-violet-700 dark:text-violet-300 overflow-hidden shrink-0">
                        {story.profiles?.avatar_url ? (
                          <img
                            src={story.profiles.avatar_url}
                            alt={story.profiles.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          story.profiles?.username?.[0]?.toUpperCase() || "U"
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {story.profiles?.username || (language === "bn" ? "ইউজার" : "User")}
                      </span>
                    </div>

                    <span className="text-3xs text-amber-600 dark:text-amber-400 font-medium shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatRemainingTime(story.expires_at)}</span>
                    </span>
                  </div>

                  {/* Media Preview Thumbnail */}
                  <div
                    onClick={() => setPreviewMedia({ url: story.media_url, type: story.media_type })}
                    className="relative aspect-[4/5] bg-slate-950 flex items-center justify-center overflow-hidden cursor-pointer group/media"
                  >
                    {story.media_type === "video" ? (
                      <video
                        src={story.media_url}
                        className="w-full h-full object-cover"
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={story.media_url}
                        alt="Story media"
                        className="w-full h-full object-cover group-hover/media:scale-105 transition-transform duration-300"
                      />
                    )}

                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <div className="p-2 rounded-xl bg-slate-900/80 backdrop-blur-sm flex items-center gap-1.5 text-xs font-semibold">
                        <Eye className="w-4 h-4" />
                        <span>{language === "bn" ? "বড় করে দেখুন" : "View media"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Caption & Delete Action */}
                  <div className="p-3 space-y-2">
                    {story.caption ? (
                      <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed italic">
                        "{story.caption}"
                      </p>
                    ) : (
                      <p className="text-3xs text-slate-400 dark:text-slate-500 italic">
                        {language === "bn" ? "কোনো ক্যাপশন নেই" : "No caption"}
                      </p>
                    )}

                    <button
                      onClick={() => handleDeleteStory(story)}
                      disabled={deletingId === story.id}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 shadow-2xs"
                    >
                      {deletingId === story.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>{t("mod.deleteStory")}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: User Reports Queue */}
      {activeTab === "reports" && (
        <div className="rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50/80 dark:bg-slate-950/60 text-3xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800/80">
                <tr>
                  <th className="px-5 py-3.5">{language === "bn" ? "রিপোর্টার" : "Reporter"}</th>
                  <th className="px-5 py-3.5">{language === "bn" ? "কন্টেন্ট টাইপ" : "Content Type"}</th>
                  <th className="px-5 py-3.5">{language === "bn" ? "অভিযোগের কারণ" : "Report Reason"}</th>
                  <th className="px-5 py-3.5">{language === "bn" ? "তারিখ" : "Date"}</th>
                  <th className="px-5 py-3.5">{language === "bn" ? "অবস্থা" : "Status"}</th>
                  <th className="px-5 py-3.5 text-right">{language === "bn" ? "পদক্ষেপ" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-red-500" />
                      <span>{language === "bn" ? "রিপোর্ট তথ্য লোড হচ্ছে..." : "Loading reports..."}</span>
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      {t("mod.noReports")}
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {report.reporter?.username || (language === "bn" ? "ইউজার" : "User")}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded-full text-3xs font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                          {report.target_type}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <p className="max-w-xs text-slate-700 dark:text-slate-300 font-medium">{report.reason}</p>
                      </td>

                      <td className="px-5 py-3.5 text-3xs text-slate-500 dark:text-slate-400">
                        {new Date(report.created_at).toLocaleDateString(language === "bn" ? "bn-BD" : "en-US")}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-3xs font-semibold ${
                            report.status === "pending"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                              : report.status === "resolved"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {report.status}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        {report.status === "pending" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleUpdateReportStatus(report.id, "resolved")}
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-3xs font-semibold border border-emerald-200 dark:border-emerald-500/30 active:scale-95 shadow-2xs transition-all"
                              title={language === "bn" ? "সমাধান হিসেবে চিহ্নিত করুন" : "Mark as resolved"}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleUpdateReportStatus(report.id, "dismissed")}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-3xs font-semibold border border-slate-200 dark:border-slate-700/60 active:scale-95 shadow-2xs transition-all"
                              title={language === "bn" ? "খারিজ করুন" : "Dismiss"}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-3xs text-slate-400 dark:text-slate-500">
                            {language === "bn" ? "সম্পন্ন" : "Resolved"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Media Fullscreen Modal */}
      {previewMedia && (
        <div
          onClick={() => setPreviewMedia(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 dark:bg-slate-950/90 backdrop-blur-md animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 relative"
          >
            {previewMedia.type === "video" ? (
              <video
                src={previewMedia.url}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] object-contain"
              />
            ) : (
              <img
                src={previewMedia.url}
                alt="Fullscreen story"
                className="max-w-full max-h-[80vh] object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentModeration;

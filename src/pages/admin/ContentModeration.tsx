import React, { useEffect, useState } from "react";
import {
  Trash2,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  Film,
  RefreshCw,
  X,
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
  const [previewMedia, setPreviewMedia] = useState<{
    url: string;
    type: "image" | "video";
  } | null>(null);

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
    const confirmPrompt =
      language === "bn"
        ? `আপনি কি ${author}-এর এই স্টোরিটি স্থায়ীভাবে ডিলিট করতে চান?`
        : `Permanently delete this story by ${author}?`;
    if (!window.confirm(confirmPrompt)) {
      return;
    }

    setDeletingId(story.id);
    try {
      const success = await adminService.deleteStory(story.id, story.media_url);
      if (success) {
        setStories((prev) => prev.filter((s) => s.id !== story.id));
      } else {
        alert(
          language === "bn" ? "স্টোরি ডিলিট করতে সমস্যা হয়েছে" : "Failed to delete story"
        );
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
    return language === "bn" ? `${hours}ঘ ${mins}মি` : `${hours}h ${mins}m`;
  };

  const pendingReportsCount = reports.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] leading-[1.15] font-medium tracking-[-0.015em] text-[#171717] dark:text-[#ededed]">
            {t("mod.title")}
          </h1>
          <p className="text-[13px] text-[#525252] dark:text-[#a1a1a6] mt-1.5">
            {t("mod.subtitle")}
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="self-start sm:self-auto h-8 px-3 rounded-lg bg-white hover:bg-[#f4f4f5] dark:bg-[#19191b] dark:hover:bg-[#232325] border border-black/[0.08] dark:border-white/[0.08] text-xs font-medium text-[#171717] dark:text-[#ededed] flex items-center gap-2 transition-colors duration-150 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-[#737373] dark:text-[#85858b] ${
              loading ? "animate-spin" : ""
            }`}
            strokeWidth={1.5}
          />
          <span>{t("overview.refresh")}</span>
        </button>
      </div>

      {/* Segmented Tabs */}
      <div className="inline-flex items-center p-1 rounded-lg bg-[#f4f4f5] dark:bg-[#232325] border border-black/[0.06] dark:border-white/[0.06]">
        <button
          type="button"
          onClick={() => setActiveTab("stories")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] transition-colors duration-150 ${
            activeTab === "stories"
              ? "bg-white dark:bg-[#141415] text-[#171717] dark:text-[#ededed] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-none"
              : "text-[#525252] dark:text-[#a1a1a6] hover:text-[#171717] dark:hover:text-[#ededed]"
          }`}
        >
          <span>{t("mod.liveStories")}</span>
          <span className="font-mono text-xs tabular-nums text-[#737373] dark:text-[#85858b]">
            {stories.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] transition-colors duration-150 ${
            activeTab === "reports"
              ? "bg-white dark:bg-[#141415] text-[#171717] dark:text-[#ededed] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-none"
              : "text-[#525252] dark:text-[#a1a1a6] hover:text-[#171717] dark:hover:text-[#ededed]"
          }`}
        >
          <span>{t("mod.reports")}</span>
          <span className="font-mono text-xs tabular-nums text-[#737373] dark:text-[#85858b]">
            {pendingReportsCount}
          </span>
        </button>
      </div>

      {/* Tab 1: Live Stories */}
      {activeTab === "stories" && (
        <div>
          {loading ? (
            <div className="py-16 text-center text-[#737373] dark:text-[#85858b]">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-xs">
                {language === "bn" ? "লাইভ স্টোরি লোড হচ্ছে" : "Loading live stories"}
              </p>
            </div>
          ) : stories.length === 0 ? (
            <div className="py-16 text-center rounded-xl bg-white dark:bg-[#19191b] border border-black/[0.08] dark:border-white/[0.08] p-8">
              <div className="w-10 h-10 rounded-lg bg-[#f4f4f5] dark:bg-[#232325] border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-center mx-auto mb-3 text-[#737373] dark:text-[#85858b]">
                <Film className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-medium text-[#171717] dark:text-[#ededed] mb-1">
                {t("mod.noStories")}
              </h3>
              <p className="text-xs text-[#737373] dark:text-[#85858b]">
                {language === "bn"
                  ? "গত ২৪ ঘণ্টায় কোনো স্টোরি প্রকাশিত হয়নি"
                  : "No active 24-hour stories on the platform"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {stories.map((story) => (
                <div
                  key={story.id}
                  className="rounded-xl bg-white dark:bg-[#19191b] border border-black/[0.08] dark:border-white/[0.08] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col justify-between"
                >
                  {/* Card Header */}
                  <div className="px-3.5 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-[#f4f4f5] dark:bg-[#232325] border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center text-[11px] font-medium text-[#171717] dark:text-[#ededed] overflow-hidden shrink-0">
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
                      <span className="text-xs font-medium text-[#171717] dark:text-[#ededed] truncate">
                        {story.profiles?.username || (language === "bn" ? "ইউজার" : "User")}
                      </span>
                    </div>

                    <span className="text-xs font-mono tabular-nums text-[#737373] dark:text-[#85858b] shrink-0">
                      {formatRemainingTime(story.expires_at)}
                    </span>
                  </div>

                  {/* Media Preview */}
                  <div
                    onClick={() =>
                      setPreviewMedia({ url: story.media_url, type: story.media_type })
                    }
                    className="relative aspect-[4/5] bg-[#141415] flex items-center justify-center overflow-hidden cursor-pointer group"
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
                        className="w-full h-full object-cover"
                      />
                    )}

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
                      <span className="h-8 px-3 rounded-lg bg-[#141415]/90 text-[#ededed] border border-white/10 flex items-center gap-1.5 text-xs font-medium">
                        <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                        <span>{language === "bn" ? "দেখুন" : "Inspect"}</span>
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-3.5 space-y-3">
                    <p className="text-xs text-[#525252] dark:text-[#a1a1a6] line-clamp-2 min-h-[2rem] leading-relaxed">
                      {story.caption || (language === "bn" ? "ক্যাপশন নেই" : "No caption")}
                    </p>

                    <button
                      type="button"
                      onClick={() => handleDeleteStory(story)}
                      disabled={deletingId === story.id}
                      className="w-full h-8 flex items-center justify-center gap-1.5 px-3 bg-[#f4f4f5] hover:bg-[#fee2e2] dark:bg-[#232325] dark:hover:bg-[#e5484d]/15 text-[#dc2626] dark:text-[#e5484d] border border-black/[0.08] dark:border-white/[0.08] rounded-lg text-xs font-medium transition-colors duration-150 disabled:opacity-50"
                    >
                      {deletingId === story.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
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

      {/* Tab 2: Reports */}
      {activeTab === "reports" && (
        <div className="rounded-xl bg-white dark:bg-[#19191b] border border-black/[0.08] dark:border-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#fafafa] dark:bg-[#141415] text-xs font-normal text-[#737373] dark:text-[#85858b] border-b border-black/[0.08] dark:border-white/[0.08]">
                <tr>
                  <th className="px-5 py-3 font-normal">
                    {language === "bn" ? "রিপোর্টার" : "Reporter"}
                  </th>
                  <th className="px-5 py-3 font-normal">
                    {language === "bn" ? "ধরন" : "Target"}
                  </th>
                  <th className="px-5 py-3 font-normal">
                    {language === "bn" ? "কারণ" : "Reason"}
                  </th>
                  <th className="px-5 py-3 font-normal">
                    {language === "bn" ? "তারিখ" : "Date"}
                  </th>
                  <th className="px-5 py-3 font-normal">
                    {language === "bn" ? "স্ট্যাটাস" : "Status"}
                  </th>
                  <th className="px-5 py-3 font-normal text-right">
                    {language === "bn" ? "অ্যাকশন" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#737373] dark:text-[#85858b]">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" strokeWidth={1.5} />
                      <span className="text-xs">
                        {language === "bn" ? "রিপোর্ট লোড হচ্ছে" : "Loading reports"}
                      </span>
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#737373] dark:text-[#85858b]">
                      {t("mod.noReports")}
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr
                      key={report.id}
                      className="hover:bg-[#fafafa] dark:hover:bg-[#232325]/50 transition-colors duration-150"
                    >
                      <td className="px-5 py-3.5 font-medium text-[#171717] dark:text-[#ededed]">
                        {report.reporter?.username || (language === "bn" ? "ইউজার" : "User")}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-[#f4f4f5] dark:bg-[#232325] text-[#525252] dark:text-[#a1a1a6] border border-black/[0.06] dark:border-white/[0.06]">
                          {report.target_type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 max-w-xs text-[#525252] dark:text-[#a1a1a6]">
                        {report.reason}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-mono tabular-nums text-[#737373] dark:text-[#85858b]">
                        {new Date(report.created_at).toLocaleDateString(
                          language === "bn" ? "bn-BD" : "en-US"
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              report.status === "pending"
                                ? "bg-amber-500"
                                : report.status === "resolved"
                                ? "bg-[#16a34a] dark:bg-[#4cc38a]"
                                : "bg-[#737373] dark:bg-[#85858b]"
                            }`}
                          />
                          <span className="capitalize text-[#525252] dark:text-[#a1a1a6]">
                            {report.status}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {report.status === "pending" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateReportStatus(report.id, "resolved")}
                              className="w-7 h-7 flex items-center justify-center rounded-md bg-[#f4f4f5] hover:bg-[#dcfce7] dark:bg-[#232325] dark:hover:bg-[#4cc38a]/15 text-[#16a34a] dark:text-[#4cc38a] border border-black/[0.08] dark:border-white/[0.08] transition-colors duration-150"
                              title={language === "bn" ? "সমাধান হয়েছে" : "Resolve"}
                            >
                              <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateReportStatus(report.id, "dismissed")}
                              className="w-7 h-7 flex items-center justify-center rounded-md bg-[#f4f4f5] hover:bg-[#e4e4e7] dark:bg-[#232325] dark:hover:bg-[#2e2e32] text-[#737373] dark:text-[#85858b] border border-black/[0.08] dark:border-white/[0.08] transition-colors duration-150"
                              title={language === "bn" ? "খারিজ করুন" : "Dismiss"}
                            >
                              <XCircle className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[#737373] dark:text-[#85858b]">—</span>
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
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl max-h-[85vh] rounded-xl overflow-hidden border border-white/[0.12] bg-[#141415] relative"
          >
            <button
              type="button"
              onClick={() => setPreviewMedia(null)}
              aria-label="Close preview"
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg bg-[#141415]/85 text-[#ededed] border border-white/[0.12] flex items-center justify-center hover:bg-[#232325]"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
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
                alt="Story preview"
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

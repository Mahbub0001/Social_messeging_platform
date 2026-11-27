import React, { useEffect, useState } from "react";
import {
  Bell,
  Send,
  Trash2,
  AlertTriangle,
  Info,
  CheckCircle2,
  AlertOctagon,
  Loader2,
  X,
} from "lucide-react";
import { adminService, type AnnouncementItem } from "../../services/adminService";
import { useStore } from "../../hooks/useStore";
import { useAdminLanguage } from "../../context/AdminLanguageContext";

export const SystemBroadcast: React.FC = () => {
  const { user } = useStore();
  const { t, language } = useAdminLanguage();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<"info" | "warning" | "critical" | "update">("info");
  const [sendPush, setSendPush] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await adminService.getAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      console.error("Failed to load announcements:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await adminService.createAnnouncement({
        adminId: user?.id,
        title: title.trim(),
        content: content.trim(),
        type,
        send_push: sendPush,
      });

      if (res.success) {
        setSuccessMsg(
          language === "bn"
            ? "ঘোষণাটি সকল ব্যবহারকারীর কাছে পাঠানো হয়েছে"
            : "Announcement sent to platform users"
        );
        setTitle("");
        setContent("");
        loadAnnouncements();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(
          res.error ||
            (language === "bn"
              ? "ঘোষণা প্রকাশ করতে সমস্যা হয়েছে"
              : "Failed to publish announcement")
        );
      }
    } catch (err: any) {
      console.error("Broadcast submit error:", err);
      setErrorMsg(
        err?.message ||
          (language === "bn"
            ? "ঘোষণা প্রকাশ করতে সমস্যা হয়েছে"
            : "Failed to publish announcement")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmPrompt =
      language === "bn"
        ? "আপনি কি এই ঘোষণাটি মুছে ফেলতে চান?"
        : "Delete this announcement?";
    if (!window.confirm(confirmPrompt)) return;
    try {
      const success = await adminService.deleteAnnouncement(id);
      if (success) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (err) {
      console.error("Delete announcement error:", err);
    }
  };

  const typeConfig = {
    info: { label: t("broadcast.info"), icon: Info, dotClass: "bg-[#0d9488] dark:bg-[#14b8a6]" },
    warning: { label: t("broadcast.warning"), icon: AlertTriangle, dotClass: "bg-amber-500" },
    critical: { label: t("broadcast.critical"), icon: AlertOctagon, dotClass: "bg-[#dc2626] dark:bg-[#e5484d]" },
    update: { label: t("broadcast.update"), icon: CheckCircle2, dotClass: "bg-[#16a34a] dark:bg-[#4cc38a]" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-[28px] leading-[1.15] font-medium tracking-[-0.015em] text-[#171717] dark:text-[#ededed]">
          {t("broadcast.title")}
        </h1>
        <p className="text-[13px] text-[#525252] dark:text-[#a1a1a6] mt-1.5">
          {t("broadcast.subtitle")}
        </p>
      </div>

      {errorMsg && (
        <div className="px-4 py-3 rounded-xl bg-white dark:bg-[#19191b] border border-[#dc2626]/30 dark:border-[#e5484d]/30 flex items-center justify-between gap-3 text-[13px] text-[#dc2626] dark:text-[#e5484d]">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            aria-label="Dismiss error"
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#f4f4f5] dark:hover:bg-[#232325]"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="px-4 py-3 rounded-xl bg-white dark:bg-[#19191b] border border-[#16a34a]/30 dark:border-[#4cc38a]/30 flex items-center gap-2.5 text-[13px] text-[#16a34a] dark:text-[#4cc38a]">
          <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Two-Column Split: Composer + History */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Composer (3 cols) */}
        <section className="lg:col-span-3 p-6 rounded-xl bg-white dark:bg-[#19191b] border border-black/[0.08] dark:border-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none space-y-5">
          <h2 className="text-sm font-medium text-[#171717] dark:text-[#ededed]">
            {t("broadcast.create")}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#525252] dark:text-[#a1a1a6] mb-1.5">
                {t("broadcast.formTitle")}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("broadcast.titlePlaceholder")}
                required
                className="w-full h-9 px-3 bg-[#fafafa] dark:bg-[#141415] border border-black/[0.08] dark:border-white/[0.08] rounded-lg text-[13px] text-[#171717] dark:text-[#ededed] placeholder-[#737373] dark:placeholder-[#85858b] focus:outline-none focus:border-[#0d9488] dark:focus:border-[#14b8a6] transition-colors duration-150"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#525252] dark:text-[#a1a1a6] mb-1.5">
                {t("broadcast.category")}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(typeConfig) as Array<keyof typeof typeConfig>).map((k) => {
                  const cfg = typeConfig[k];
                  const IconComponent = cfg.icon;
                  const isSelected = type === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setType(k)}
                      className={`h-9 flex items-center gap-2 px-3 rounded-lg border text-xs font-medium transition-colors duration-150 ${
                        isSelected
                          ? "bg-[#f4f4f5] dark:bg-[#232325] border-[#0d9488] dark:border-[#14b8a6] text-[#171717] dark:text-[#ededed]"
                          : "bg-[#fafafa] dark:bg-[#141415] border-black/[0.08] dark:border-white/[0.08] text-[#525252] dark:text-[#a1a1a6] hover:text-[#171717] dark:hover:text-[#ededed]"
                      }`}
                    >
                      <IconComponent
                        className={`w-4 h-4 shrink-0 ${
                          isSelected
                            ? "text-[#0f766e] dark:text-[#14b8a6]"
                            : "text-[#737373] dark:text-[#85858b]"
                        }`}
                        strokeWidth={1.5}
                      />
                      <span className="truncate">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#525252] dark:text-[#a1a1a6] mb-1.5">
                {t("broadcast.content")}
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder={t("broadcast.contentPlaceholder")}
                required
                className="w-full p-3 bg-[#fafafa] dark:bg-[#141415] border border-black/[0.08] dark:border-white/[0.08] rounded-lg text-[13px] text-[#171717] dark:text-[#ededed] placeholder-[#737373] dark:placeholder-[#85858b] focus:outline-none focus:border-[#0d9488] dark:focus:border-[#14b8a6] transition-colors duration-150"
              />
            </div>

            {/* Push Toggle */}
            <div className="p-4 rounded-lg bg-[#fafafa] dark:bg-[#141415] border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-[#737373] dark:text-[#85858b] shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-[13px] font-medium text-[#171717] dark:text-[#ededed]">
                    {t("broadcast.pushToggle")}
                  </p>
                  <p className="text-xs text-[#737373] dark:text-[#85858b]">
                    {t("broadcast.pushSub")}
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={sendPush}
                onClick={() => setSendPush((v) => !v)}
                className={`relative w-10 h-6 rounded-full transition-colors duration-150 shrink-0 ${
                  sendPush
                    ? "bg-teal-600"
                    : "bg-[#d4d4d8] dark:bg-[#27272a]"
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-150 ${
                    sendPush ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-10 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[13px] font-medium transition-colors duration-150 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <Send className="w-4 h-4" strokeWidth={1.5} />
              )}
              <span>{submitting ? t("broadcast.publishing") : t("broadcast.submit")}</span>
            </button>
          </form>
        </section>

        {/* History (2 cols) */}
        <section className="lg:col-span-2 rounded-xl bg-white dark:bg-[#19191b] border border-black/[0.08] dark:border-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between">
            <h2 className="text-sm font-medium text-[#171717] dark:text-[#ededed]">
              {t("broadcast.history")}
            </h2>
            <span className="text-xs font-mono tabular-nums text-[#737373] dark:text-[#85858b]">
              {announcements.length}
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-[#737373] dark:text-[#85858b]">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" strokeWidth={1.5} />
              <span className="text-xs">
                {language === "bn" ? "লোড হচ্ছে" : "Loading"}
              </span>
            </div>
          ) : announcements.length === 0 ? (
            <p className="text-[13px] text-[#737373] dark:text-[#85858b] text-center py-10">
              {t("broadcast.noHistory")}
            </p>
          ) : (
            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
              {announcements.map((a) => {
                const cfg = typeConfig[a.type] || typeConfig.info;
                return (
                  <div key={a.id} className="p-5 flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono bg-[#f4f4f5] dark:bg-[#232325] text-[#525252] dark:text-[#a1a1a6] border border-black/[0.06] dark:border-white/[0.06]">
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
                          <span>{a.type}</span>
                        </span>

                        {a.send_push && (
                          <span className="inline-flex items-center gap-1 text-[#737373] dark:text-[#85858b]">
                            <Bell className="w-3.5 h-3.5" strokeWidth={1.5} />
                            <span>{language === "bn" ? "পুশ" : "Push"}</span>
                          </span>
                        )}

                        <span className="font-mono tabular-nums text-[#737373] dark:text-[#85858b]">
                          {new Date(a.created_at).toLocaleDateString(
                            language === "bn" ? "bn-BD" : "en-US"
                          )}
                        </span>
                      </div>

                      <h3 className="text-[13px] font-medium text-[#171717] dark:text-[#ededed]">
                        {a.title}
                      </h3>
                      <p className="text-xs text-[#525252] dark:text-[#a1a1a6] whitespace-pre-line leading-relaxed">
                        {a.content}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(a.id)}
                      className="w-7 h-7 flex items-center justify-center text-[#737373] hover:text-[#dc2626] dark:text-[#85858b] dark:hover:text-[#e5484d] hover:bg-[#f4f4f5] dark:hover:bg-[#232325] rounded-md transition-colors duration-150 shrink-0"
                      title={language === "bn" ? "মুছে ফেলুন" : "Delete"}
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SystemBroadcast;

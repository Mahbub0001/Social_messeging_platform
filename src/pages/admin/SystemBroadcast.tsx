import React, { useEffect, useState } from "react";
import {
  Megaphone,
  Bell,
  Send,
  Trash2,
  AlertTriangle,
  Info,
  CheckCircle2,
  AlertOctagon,
  Loader2,
  Radio,
  Clock,
} from "lucide-react";
import { adminService, AnnouncementItem } from "../../services/adminService";
import { useStore } from "../../hooks/useStore";

export const SystemBroadcast: React.FC = () => {
  const { user } = useStore();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<"info" | "warning" | "critical" | "update">("info");
  const [sendPush, setSendPush] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

    try {
      const success = await adminService.createAnnouncement({
        adminId: user?.id,
        title: title.trim(),
        content: content.trim(),
        type,
        send_push: sendPush,
      });

      if (success) {
        setSuccessMsg("ঘোষণা সফলভাবে প্ল্যাটফর্মে ব্রডকাস্ট করা হয়েছে!");
        setTitle("");
        setContent("");
        loadAnnouncements();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        alert("ঘোষণা প্রকাশ করতে সমস্যা হয়েছে।");
      }
    } catch (err) {
      console.error("Broadcast submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই ঘোষণাটি মুছে ফেলতে চান?")) return;
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
    info: { label: "তথ্যমূলক (Info)", icon: Info, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    warning: { label: "সতর্কবার্তা (Warning)", icon: AlertTriangle, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    critical: { label: "জরুরি নোটিশ (Critical)", icon: AlertOctagon, color: "text-red-400 bg-red-500/10 border-red-500/20" },
    update: { label: "আপডেট (Update)", icon: CheckCircle2, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Megaphone className="w-6 h-6 text-emerald-400" />
          <span>সিস্টেম ব্রডকাস্ট ও পুশ নোটিফিকেশন</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          প্ল্যাটফর্মের সকল ব্যবহারকারীর কাছে একযোগে নোটিশ ব্যানার এবং মোবাইল পুশ নোটিফিকেশন পাঠান।
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-3 text-xs text-emerald-300 animate-fade-in shadow-lg">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Broadcast Composer */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>নতুন গ্লোবাল ঘোষণা তৈরি করুন</span>
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              ঘোষণার শিরোনাম (Title)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="যেমন: সার্ভার মেইনটেন্যান্স বা নতুন ফিচার আপডেট..."
              required
              className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Type Picker */}
          <div>
            <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              ক্যাটাগরি / গুরুত্ব স্তর
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
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      isSelected
                        ? "bg-emerald-600/20 border-emerald-500 text-white shadow-md shadow-emerald-600/10"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{cfg.label.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              ঘোষণার মূল বার্তা (Announcement Details)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="ব্যবহারকারীদের জন্য বিস্তারিত মেসেজ লিখুন..."
              required
              className="w-full p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Send Push Notification Toggle */}
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">
                  সবার ফোনে সরাসরি পুশ নোটিফিকেশন পাঠান
                </p>
                <p className="text-3xs text-slate-400">
                  FCM সার্ভিসের মাধ্যমে মোবাইল ব্যবহারকারীদের কাছে রিয়েল-টাইমে পৌঁছাবে।
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={sendPush}
                onChange={(e) => setSendPush(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>ঘোষণা প্রকাশ ও ব্রডকাস্ট করুন</span>
          </button>
        </form>
      </div>

      {/* Broadcast History */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-slate-200">পূর্ববর্তী ঘোষণা ইতিহাস</h3>

        {loading ? (
          <div className="py-8 text-center text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
            <span className="text-xs">ইতিহাস লোড হচ্ছে...</span>
          </div>
        ) : announcements.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">কোনো পূর্ববর্তী ঘোষণা পাওয়া যায়নি।</p>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {announcements.map((a) => {
              const cfg = typeConfig[a.type] || typeConfig.info;
              const IconComponent = cfg.icon;
              return (
                <div key={a.id} className="py-3.5 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-semibold border ${cfg.color}`}>
                        <IconComponent className="w-3 h-3" />
                        <span>{a.type.toUpperCase()}</span>
                      </span>
                      {a.send_push && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
                          <Bell className="w-2.5 h-2.5" />
                          <span>পুশ পাঠানো হয়েছে</span>
                        </span>
                      )}
                      <span className="text-3xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(a.created_at).toLocaleString("bn-BD")}</span>
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-100">{a.title}</h4>
                    <p className="text-xs text-slate-400 whitespace-pre-line leading-relaxed">{a.content}</p>
                  </div>

                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                    title="মুছে ফেলুন"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemBroadcast;

import React, { useEffect, useState } from "react";
import {
  Users,
  Search,
  Shield,
  ShieldCheck,
  Ban,
  CheckCircle2,
  Loader2,
  X,
  UserX,
} from "lucide-react";
import { adminService, type AdminUser } from "../../services/adminService";

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Ban modal state
  const [banModalUser, setBanModalUser] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banSubmitting, setBanSubmitting] = useState(false);

  // Role change modal state
  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<"admin" | "moderator" | "user">("user");
  const [roleSubmitting, setRoleSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await adminService.getUsers(search, roleFilter, statusFilter);
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, roleFilter, statusFilter]);

  const handleOpenBanModal = (user: AdminUser) => {
    setBanModalUser(user);
    setBanReason(user.banned_reason || "কমিউনিটি নীতিমালা লঙ্ঘনের কারণে অ্যাকাউন্ট স্থগিত করা হয়েছে।");
  };

  const handleConfirmBan = async () => {
    if (!banModalUser) return;
    setBanSubmitting(true);
    try {
      const success = await adminService.updateUserBan(banModalUser.id, true, banReason);
      if (success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === banModalUser.id
              ? { ...u, is_banned: true, banned_reason: banReason, banned_at: new Date().toISOString() }
              : u
          )
        );
        setBanModalUser(null);
      } else {
        alert("ব্যান আপডেট করতে সমস্যা হয়েছে।");
      }
    } catch (err) {
      console.error("Ban error:", err);
    } finally {
      setBanSubmitting(false);
    }
  };

  const handleUnban = async (user: AdminUser) => {
    if (!window.confirm(`আপনি কি নিশ্চিতভাবে ${user.username}-কে আনব্যান করতে চান?`)) return;
    try {
      const success = await adminService.updateUserBan(user.id, false);
      if (success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id
              ? { ...u, is_banned: false, banned_reason: null, banned_at: null }
              : u
          )
        );
      }
    } catch (err) {
      console.error("Unban error:", err);
    }
  };

  const handleOpenRoleModal = (user: AdminUser) => {
    setRoleModalUser(user);
    setSelectedRole(user.role);
  };

  const handleConfirmRole = async () => {
    if (!roleModalUser) return;
    setRoleSubmitting(true);
    try {
      const success = await adminService.updateUserRole(roleModalUser.id, selectedRole);
      if (success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === roleModalUser.id ? { ...u, role: selectedRole } : u))
        );
        setRoleModalUser(null);
      } else {
        alert("রোল আপডেট করতে সমস্যা হয়েছে।");
      }
    } catch (err) {
      console.error("Role update error:", err);
    } finally {
      setRoleSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-violet-400" />
            <span>ইউজার ম্যানেজমেন্ট ও নিয়ন্ত্রণ</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            প্ল্যাটফর্মের সকল ব্যবহারকারীর তালিকা, অ্যাকাউন্ট স্থিতি এবং অধিকার পরিচালনা করুন।
          </p>
        </div>
        <div className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-semibold self-start sm:self-auto">
          মোট প্রাপ্ত ইউজার: <span className="text-violet-400 font-bold">{users.length}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ইউজারনেম দিয়ে খুঁজুন..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="all">সকল রোল (All Roles)</option>
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
            <option value="user">User</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="all">সকল স্থিতি (All Status)</option>
            <option value="active">সক্রিয় (Active)</option>
            <option value="banned">স্থগিত (Banned)</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-3xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/80">
              <tr>
                <th className="px-5 py-3.5">ইউজার</th>
                <th className="px-5 py-3.5">রোল (Role)</th>
                <th className="px-5 py-3.5">অ্যাকাউন্ট স্থিতি</th>
                <th className="px-5 py-3.5">সর্বশেষ সক্রিয়</th>
                <th className="px-5 py-3.5 text-right">পদক্ষেপ (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-500" />
                    <span>ইউজার তালিকা লোড হচ্ছে...</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    কোনো ইউজার পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* User info */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center font-bold text-xs text-violet-300 overflow-hidden shrink-0">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                          ) : (
                            u.username[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-100 truncate">{u.username}</p>
                          <p className="text-3xs text-slate-500 truncate">{u.bio || "No bio"}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-3xs font-semibold uppercase ${
                          u.role === "admin"
                            ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                            : u.role === "moderator"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            : "bg-slate-800 text-slate-400 border border-slate-700/60"
                        }`}
                      >
                        {u.role === "admin" && <Shield className="w-3 h-3" />}
                        <span>{u.role}</span>
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      {u.is_banned ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-3xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
                            <Ban className="w-3 h-3" />
                            <span>স্থগিত (Banned)</span>
                          </span>
                          {u.banned_reason && (
                            <p className="text-3xs text-red-400/80 mt-1 max-w-xs truncate" title={u.banned_reason}>
                              কারণ: {u.banned_reason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-3xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>সক্রিয় (Active)</span>
                        </span>
                      )}
                    </td>

                    {/* Last Seen */}
                    <td className="px-5 py-3.5 text-3xs text-slate-400">
                      {u.last_seen ? new Date(u.last_seen).toLocaleDateString("bn-BD") : "তথ্য নেই"}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Change Role Button */}
                        <button
                          onClick={() => handleOpenRoleModal(u)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-3xs font-semibold border border-slate-700/60 transition-colors"
                        >
                          রোল পরিবর্তন
                        </button>

                        {/* Ban / Unban Button */}
                        {u.is_banned ? (
                          <button
                            onClick={() => handleUnban(u)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-3xs font-semibold border border-emerald-500/30 transition-colors"
                          >
                            আনব্যান করুন
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenBanModal(u)}
                            className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-3xs font-semibold border border-red-500/30 transition-colors"
                          >
                            ব্যান করুন
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ban Modal */}
      {banModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <UserX className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">অ্যাকাউন্ট স্থগিত / ব্যান নিশ্চিতকরণ</h3>
                <p className="text-3xs text-slate-400">ইউজার: @{banModalUser.username}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              এই ইউজারকে ব্যান করলে সে প্ল্যাটফর্মে নতুন কোনো চ্যাট বার্তা পাঠাতে বা স্টোরি আপলোড করতে পারবে না।
            </p>

            <div>
              <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                ব্যান করার সুনির্দিষ্ট কারণ লিখুন
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows={3}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="যেমন: স্প্যামিং, আপত্তিকর ভাষা বা কন্টেন্ট প্রকাশ..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setBanModalUser(null)}
                disabled={banSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                বাতিল
              </button>
              <button
                onClick={handleConfirmBan}
                disabled={banSubmitting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center gap-2"
              >
                {banSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>ব্যান কার্যকর করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-violet-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-violet-400">
              <div className="p-2.5 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">ইউজার রোল পরিবর্তন</h3>
                <p className="text-3xs text-slate-400">ইউজার: @{roleModalUser.username}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                নতুন রোল নির্বাচন করুন
              </label>
              {(["admin", "moderator", "user"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRole(r)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all ${
                    selectedRole === r
                      ? "bg-violet-600/20 border-violet-500 text-white shadow-md shadow-violet-600/10"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className="capitalize">{r}</span>
                  {selectedRole === r && <CheckCircle2 className="w-4 h-4 text-violet-400" />}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRoleModalUser(null)}
                disabled={roleSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                বাতিল
              </button>
              <button
                onClick={handleConfirmRole}
                disabled={roleSubmitting}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-all shadow-lg shadow-violet-600/20 disabled:opacity-50 flex items-center gap-2"
              >
                {roleSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>সংরক্ষণ করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

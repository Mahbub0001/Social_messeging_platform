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
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { adminService, type AdminUser } from "../../services/adminService";
import { useAdminLanguage } from "../../context/AdminLanguageContext";

export const UserManagement: React.FC = () => {
  const { t, language } = useAdminLanguage();
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

  // Delete user modal state
  const [deleteModalUser, setDeleteModalUser] = useState<AdminUser | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

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

  const handleOpenDeleteModal = (user: AdminUser) => {
    setDeleteModalUser(user);
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalUser) return;
    setDeleteSubmitting(true);
    try {
      const success = await adminService.deleteUser(deleteModalUser.id);
      if (success) {
        setUsers((prev) => prev.filter((u) => u.id !== deleteModalUser.id));
        setDeleteModalUser(null);
      } else {
        alert("ইউজার ডিলিট করতে সমস্যা হয়েছে।");
      }
    } catch (err) {
      console.error("Delete user error:", err);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            <span>{t("users.title")}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t("users.subtitle")}
          </p>
        </div>
        <div className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 font-semibold self-start sm:self-auto shadow-2xs">
          {language === "bn" ? "মোট প্রাপ্ত ইউজার:" : "Total Users:"}{" "}
          <span className="text-violet-600 dark:text-violet-400 font-bold">{users.length}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("users.searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
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
            className="px-3 py-2 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="all">{t("users.allRoles")}</option>
            <option value="admin">{t("users.admins")}</option>
            <option value="moderator">Moderator</option>
            <option value="user">{t("users.regularUsers")}</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="all">{t("users.allStatus")}</option>
            <option value="active">{t("users.activeOnly")}</option>
            <option value="banned">{t("users.bannedOnly")}</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50/80 dark:bg-slate-950/60 text-3xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800/80">
              <tr>
                <th className="px-5 py-3.5">{t("users.tableUser")}</th>
                <th className="px-5 py-3.5">{t("users.tableRole")}</th>
                <th className="px-5 py-3.5">{t("users.tableStatus")}</th>
                <th className="px-5 py-3.5">{t("users.tableLastSeen")}</th>
                <th className="px-5 py-3.5 text-right">{t("users.tableActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-500" />
                    <span>{language === "bn" ? "ইউজার তালিকা লোড হচ্ছে..." : "Loading users..."}</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    {t("users.noUsers")}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                    {/* User info */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-violet-500/10 dark:bg-violet-600/20 border border-violet-500/30 flex items-center justify-center font-bold text-xs text-violet-700 dark:text-violet-300 overflow-hidden shrink-0">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                          ) : (
                            u.username[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{u.username}</p>
                          <p className="text-3xs text-slate-400 dark:text-slate-500 truncate">{u.bio || "No bio"}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-3xs font-semibold uppercase ${
                          u.role === "admin"
                            ? "bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30"
                            : u.role === "moderator"
                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60"
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
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-3xs font-semibold bg-red-500/15 text-red-600 dark:text-red-300 border border-red-500/30">
                            <Ban className="w-3 h-3" />
                            <span>{t("chart.banned")}</span>
                          </span>
                          {u.banned_reason && (
                            <p className="text-3xs text-red-500 dark:text-red-400/80 mt-1 max-w-xs truncate" title={u.banned_reason}>
                              {language === "bn" ? "কারণ:" : "Reason:"} {u.banned_reason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-3xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{t("chart.active")}</span>
                        </span>
                      )}
                    </td>

                    {/* Last Seen */}
                    <td className="px-5 py-3.5 text-3xs text-slate-500 dark:text-slate-400">
                      {u.last_seen ? new Date(u.last_seen).toLocaleDateString(language === "bn" ? "bn-BD" : "en-US") : (language === "bn" ? "তথ্য নেই" : "N/A")}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Change Role Button */}
                        <button
                          onClick={() => handleOpenRoleModal(u)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-3xs font-semibold border border-slate-200 dark:border-slate-700/60 transition-all active:scale-95 shadow-2xs"
                        >
                          {language === "bn" ? "রোল পরিবর্তন" : "Change Role"}
                        </button>

                        {/* Ban / Unban Button */}
                        {u.is_banned ? (
                          <button
                            onClick={() => handleUnban(u)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-3xs font-semibold border border-emerald-200 dark:border-emerald-500/30 transition-all active:scale-95 shadow-2xs"
                          >
                            {t("users.unban")}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenBanModal(u)}
                            className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-3xs font-semibold border border-red-200 dark:border-red-500/30 transition-all active:scale-95 shadow-2xs"
                          >
                            {t("users.ban")}
                          </button>
                        )}

                        {/* Delete User Button */}
                        <button
                          onClick={() => handleOpenDeleteModal(u)}
                          className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-3xs font-semibold border border-red-200 dark:border-red-800/40 transition-all active:scale-95 flex items-center gap-1 shadow-2xs"
                          title={t("modal.deleteTitle")}
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{t("users.delete")}</span>
                        </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <UserX className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t("modal.banTitle")}</h3>
                <p className="text-3xs text-slate-500 dark:text-slate-400">{language === "bn" ? "ইউজার:" : "User:"} @{banModalUser.username}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {language === "bn"
                ? "এই ইউজারকে ব্যান করলে সে প্ল্যাটফর্মে নতুন কোনো চ্যাট বার্তা পাঠাতে বা স্টোরি আপলোড করতে পারবে না।"
                : "Suspending this user will prevent them from sending messages and posting live stories across the platform."}
            </p>

            <div>
              <label className="block text-3xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                {t("modal.banReasonPrompt")}
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows={3}
                className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder={t("modal.banPlaceholder")}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setBanModalUser(null)}
                disabled={banSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all active:scale-95"
              >
                {t("modal.cancel")}
              </button>
              <button
                onClick={handleConfirmBan}
                disabled={banSubmitting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-all shadow-md shadow-red-600/25 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {banSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{t("modal.confirmBan")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-violet-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-violet-600 dark:text-violet-400">
              <div className="p-2.5 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {language === "bn" ? "ইউজার রোল পরিবর্তন" : "Change User Role"}
                </h3>
                <p className="text-3xs text-slate-500 dark:text-slate-400">{language === "bn" ? "ইউজার:" : "User:"} @{roleModalUser.username}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-3xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                {language === "bn" ? "নতুন রোল নির্বাচন করুন" : "Select New Role"}
              </label>
              {(["admin", "moderator", "user"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRole(r)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all active:scale-[0.98] ${
                    selectedRole === r
                      ? "bg-violet-50 dark:bg-violet-600/20 border-violet-500 text-violet-700 dark:text-white shadow-xs"
                      : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <span className="capitalize">{r}</span>
                  {selectedRole === r && <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRoleModalUser(null)}
                disabled={roleSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all active:scale-95"
              >
                {t("modal.cancel")}
              </button>
              <button
                onClick={handleConfirmRole}
                disabled={roleSubmitting}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-all shadow-md shadow-violet-600/25 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {roleSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{language === "bn" ? "সংরক্ষণ করুন" : "Save Changes"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deleteModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-red-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t("modal.deleteTitle")}</h3>
                <p className="text-3xs text-slate-500 dark:text-slate-400">{language === "bn" ? "ইউজার:" : "User:"} @{deleteModalUser.username}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-slate-700 dark:text-red-300 space-y-2">
              <p className="font-bold flex items-center gap-1.5 text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{language === "bn" ? "সতর্কতা: এই পদক্ষেপটি অপরিবর্তনীয়!" : "Warning: This action is irreversible!"}</span>
              </p>
              <p className="text-3xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t("modal.deleteWarning")}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteModalUser(null)}
                disabled={deleteSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all active:scale-95"
              >
                {t("modal.cancel")}
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteSubmitting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-all shadow-md shadow-red-600/25 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {deleteSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{t("modal.confirmDelete")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

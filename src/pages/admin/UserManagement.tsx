import React, { useEffect, useState } from "react";
import {
  Search,
  Shield,
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

  const [banModalUser, setBanModalUser] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banSubmitting, setBanSubmitting] = useState(false);

  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<"admin" | "moderator" | "user">("user");
  const [roleSubmitting, setRoleSubmitting] = useState(false);

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
    setBanReason(
      user.banned_reason || "কমিউনিটি নীতিমালা লঙ্ঘনের কারণে অ্যাকাউন্ট স্থগিত করা হয়েছে"
    );
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
              ? {
                  ...u,
                  is_banned: true,
                  banned_reason: banReason,
                  banned_at: new Date().toISOString(),
                }
              : u
          )
        );
        setBanModalUser(null);
      } else {
        alert(language === "bn" ? "ব্যান আপডেট করতে সমস্যা হয়েছে" : "Failed to update ban status");
      }
    } catch (err) {
      console.error("Ban error:", err);
    } finally {
      setBanSubmitting(false);
    }
  };

  const handleUnban = async (user: AdminUser) => {
    const msg =
      language === "bn"
        ? `আপনি কি ${user.username}-কে আনব্যান করতে চান?`
        : `Reinstate account for ${user.username}?`;
    if (!window.confirm(msg)) return;
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
        alert(language === "bn" ? "রোল আপডেট করতে সমস্যা হয়েছে" : "Failed to update role");
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
        alert(language === "bn" ? "ইউজার ডিলিট করতে সমস্যা হয়েছে" : "Failed to delete user");
      }
    } catch (err) {
      console.error("Delete user error:", err);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] leading-[1.15] font-medium tracking-[-0.015em] text-[#171717] dark:text-[#ededed]">
            {t("users.title")}
          </h1>
          <p className="text-[13px] text-[#525252] dark:text-[#a1a1a6] mt-1.5">
            {t("users.subtitle")}
          </p>
        </div>

        <span className="self-start sm:self-auto text-xs font-mono tabular-nums text-[#737373] dark:text-[#85858b]">
          {language === "bn" ? `${users.length} জন ইউজার` : `${users.length} accounts`}
        </span>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#19191b] border border-black/[0.08] dark:border-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373] dark:text-[#85858b]"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("users.searchPlaceholder")}
            className="w-full h-9 pl-9 pr-8 bg-[#fafafa] dark:bg-[#141415] border border-black/[0.08] dark:border-white/[0.08] rounded-lg text-[13px] text-[#171717] dark:text-[#ededed] placeholder-[#737373] dark:placeholder-[#85858b] focus:outline-none focus:border-[#0d9488] dark:focus:border-[#14b8a6] transition-colors duration-150"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#171717] dark:text-[#85858b] dark:hover:text-[#ededed]"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 px-3 bg-[#fafafa] dark:bg-[#141415] border border-black/[0.08] dark:border-white/[0.08] rounded-lg text-[13px] text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#0d9488] dark:focus:border-[#14b8a6]"
          >
            <option value="all">{t("users.allRoles")}</option>
            <option value="admin">{t("users.admins")}</option>
            <option value="moderator">Moderator</option>
            <option value="user">{t("users.regularUsers")}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 bg-[#fafafa] dark:bg-[#141415] border border-black/[0.08] dark:border-white/[0.08] rounded-lg text-[13px] text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#0d9488] dark:focus:border-[#14b8a6]"
          >
            <option value="all">{t("users.allStatus")}</option>
            <option value="active">{t("users.activeOnly")}</option>
            <option value="banned">{t("users.bannedOnly")}</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl bg-white dark:bg-[#19191b] border border-black/[0.08] dark:border-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#fafafa] dark:bg-[#141415] text-xs font-normal text-[#737373] dark:text-[#85858b] border-b border-black/[0.08] dark:border-white/[0.08]">
              <tr>
                <th className="px-5 py-3 font-normal">{t("users.tableUser")}</th>
                <th className="px-5 py-3 font-normal">{t("users.tableRole")}</th>
                <th className="px-5 py-3 font-normal">{t("users.tableStatus")}</th>
                <th className="px-5 py-3 font-normal">{t("users.tableLastSeen")}</th>
                <th className="px-5 py-3 font-normal text-right">{t("users.tableActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#737373] dark:text-[#85858b]">
                    <Loader2
                      className="w-5 h-5 animate-spin mx-auto mb-2"
                      strokeWidth={1.5}
                    />
                    <span className="text-xs">
                      {language === "bn" ? "ইউজার তালিকা লোড হচ্ছে" : "Loading accounts"}
                    </span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#737373] dark:text-[#85858b]">
                    {t("users.noUsers")}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-[#fafafa] dark:hover:bg-[#232325]/50 transition-colors duration-150"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
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
                          <p className="font-medium text-[#171717] dark:text-[#ededed] truncate">
                            {u.username}
                          </p>
                          <p className="text-xs text-[#737373] dark:text-[#85858b] truncate max-w-[220px]">
                            {u.bio || "—"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono border ${
                          u.role === "admin"
                            ? "bg-[#0d9488]/10 text-[#0f766e] dark:text-[#14b8a6] border-[#0d9488]/25"
                            : "bg-[#f4f4f5] dark:bg-[#232325] text-[#525252] dark:text-[#a1a1a6] border-black/[0.06] dark:border-white/[0.06]"
                        }`}
                      >
                        {u.role === "admin" && (
                          <Shield className="w-3.5 h-3.5" strokeWidth={1.5} />
                        )}
                        <span className="capitalize">{u.role}</span>
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      {u.is_banned ? (
                        <div>
                          <span className="inline-flex items-center gap-1.5 text-xs text-[#dc2626] dark:text-[#e5484d]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626] dark:bg-[#e5484d]" />
                            <span>{t("chart.banned")}</span>
                          </span>
                          {u.banned_reason && (
                            <p
                              className="text-xs text-[#737373] dark:text-[#85858b] mt-0.5 max-w-[200px] truncate"
                              title={u.banned_reason}
                            >
                              {u.banned_reason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#525252] dark:text-[#a1a1a6]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] dark:bg-[#4cc38a]" />
                          <span>{t("chart.active")}</span>
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-xs font-mono tabular-nums text-[#737373] dark:text-[#85858b]">
                      {u.last_seen
                        ? new Date(u.last_seen).toLocaleDateString(
                            language === "bn" ? "bn-BD" : "en-US"
                          )
                        : "—"}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenRoleModal(u)}
                          className="h-7 px-2.5 rounded-md bg-[#f4f4f5] hover:bg-[#e4e4e7] dark:bg-[#232325] dark:hover:bg-[#2e2e32] text-[#171717] dark:text-[#ededed] text-xs font-medium border border-black/[0.08] dark:border-white/[0.08] transition-colors duration-150"
                        >
                          {language === "bn" ? "রোল" : "Role"}
                        </button>

                        {u.is_banned ? (
                          <button
                            type="button"
                            onClick={() => handleUnban(u)}
                            className="h-7 px-2.5 rounded-md bg-[#f4f4f5] hover:bg-[#e4e4e7] dark:bg-[#232325] dark:hover:bg-[#2e2e32] text-[#16a34a] dark:text-[#4cc38a] text-xs font-medium border border-black/[0.08] dark:border-white/[0.08] transition-colors duration-150"
                          >
                            {t("users.unban")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenBanModal(u)}
                            className="h-7 px-2.5 rounded-md bg-[#f4f4f5] hover:bg-[#fee2e2] dark:bg-[#232325] dark:hover:bg-[#e5484d]/15 text-[#dc2626] dark:text-[#e5484d] text-xs font-medium border border-black/[0.08] dark:border-white/[0.08] transition-colors duration-150"
                          >
                            {t("users.ban")}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(u)}
                          className="h-7 w-7 flex items-center justify-center rounded-md bg-[#f4f4f5] hover:bg-[#fee2e2] dark:bg-[#232325] dark:hover:bg-[#e5484d]/15 text-[#737373] hover:text-[#dc2626] dark:text-[#85858b] dark:hover:text-[#e5484d] border border-black/[0.08] dark:border-white/[0.08] transition-colors duration-150"
                          title={t("users.delete")}
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-[#19191b] border border-black/[0.1] dark:border-white/[0.1] rounded-2xl p-6 max-w-md w-full shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-none space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#f4f4f5] dark:bg-[#232325] border border-black/[0.08] dark:border-white/[0.08] rounded-lg flex items-center justify-center text-[#dc2626] dark:text-[#e5484d]">
                <UserX className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
                  {t("modal.banTitle")}
                </h3>
                <p className="text-xs font-mono text-[#737373] dark:text-[#85858b]">
                  @{banModalUser.username}
                </p>
              </div>
            </div>

            <p className="text-[13px] text-[#525252] dark:text-[#a1a1a6] leading-relaxed">
              {language === "bn"
                ? "এই ইউজারকে ব্যান করলে সে প্ল্যাটফর্মে নতুন কোনো চ্যাট বার্তা পাঠাতে বা স্টোরি আপলোড করতে পারবে না।"
                : "Suspending this account prevents sending messages and posting stories."}
            </p>

            <div>
              <label className="block text-xs font-medium text-[#525252] dark:text-[#a1a1a6] mb-1.5">
                {t("modal.banReasonPrompt")}
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows={3}
                className="w-full p-3 bg-[#fafafa] dark:bg-[#141415] border border-black/[0.08] dark:border-white/[0.08] rounded-lg text-[13px] text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#dc2626] dark:focus:border-[#e5484d]"
                placeholder={t("modal.banPlaceholder")}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBanModalUser(null)}
                disabled={banSubmitting}
                className="h-9 px-4 rounded-lg bg-[#f4f4f5] hover:bg-[#e4e4e7] dark:bg-[#232325] dark:hover:bg-[#2e2e32] text-[13px] font-medium text-[#171717] dark:text-[#ededed] border border-black/[0.08] dark:border-white/[0.08] transition-colors duration-150"
              >
                {t("modal.cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmBan}
                disabled={banSubmitting}
                className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-[13px] font-medium text-white transition-colors duration-150 disabled:opacity-50 flex items-center gap-2"
              >
                {banSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Ban className="w-4 h-4" strokeWidth={1.5} />
                )}
                <span>{t("modal.confirmBan")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-[#19191b] border border-black/[0.1] dark:border-white/[0.1] rounded-2xl p-6 max-w-sm w-full shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-none space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#f4f4f5] dark:bg-[#232325] border border-black/[0.08] dark:border-white/[0.08] rounded-lg flex items-center justify-center text-[#0f766e] dark:text-[#14b8a6]">
                <Shield className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
                  {language === "bn" ? "ইউজার রোল পরিবর্তন" : "Change account role"}
                </h3>
                <p className="text-xs font-mono text-[#737373] dark:text-[#85858b]">
                  @{roleModalUser.username}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#525252] dark:text-[#a1a1a6] mb-1">
                {language === "bn" ? "রোল নির্বাচন করুন" : "Select role"}
              </label>
              {(["admin", "moderator", "user"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRole(r)}
                  className={`w-full h-10 flex items-center justify-between px-3 rounded-lg border text-[13px] font-medium transition-colors duration-150 ${
                    selectedRole === r
                      ? "bg-[#f4f4f5] dark:bg-[#232325] border-[#0d9488] dark:border-[#14b8a6] text-[#171717] dark:text-[#ededed]"
                      : "bg-[#fafafa] dark:bg-[#141415] border-black/[0.08] dark:border-white/[0.08] text-[#525252] dark:text-[#a1a1a6] hover:text-[#171717] dark:hover:text-[#ededed]"
                  }`}
                >
                  <span className="capitalize">{r}</span>
                  {selectedRole === r && (
                    <CheckCircle2
                      className="w-4 h-4 text-[#0f766e] dark:text-[#14b8a6]"
                      strokeWidth={1.5}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRoleModalUser(null)}
                disabled={roleSubmitting}
                className="h-9 px-4 rounded-lg bg-[#f4f4f5] hover:bg-[#e4e4e7] dark:bg-[#232325] dark:hover:bg-[#2e2e32] text-[13px] font-medium text-[#171717] dark:text-[#ededed] border border-black/[0.08] dark:border-white/[0.08] transition-colors duration-150"
              >
                {t("modal.cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmRole}
                disabled={roleSubmitting}
                className="h-9 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-[13px] font-medium text-white transition-colors duration-150 disabled:opacity-50 flex items-center gap-2"
              >
                {roleSubmitting && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />}
                <span>{language === "bn" ? "সংরক্ষণ" : "Save role"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-[#19191b] border border-black/[0.1] dark:border-white/[0.1] rounded-2xl p-6 max-w-md w-full shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-none space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#f4f4f5] dark:bg-[#232325] border border-black/[0.08] dark:border-white/[0.08] rounded-lg flex items-center justify-center text-[#dc2626] dark:text-[#e5484d]">
                <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
                  {t("modal.deleteTitle")}
                </h3>
                <p className="text-xs font-mono text-[#737373] dark:text-[#85858b]">
                  @{deleteModalUser.username}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#fafafa] dark:bg-[#141415] border border-black/[0.08] dark:border-white/[0.08] text-[13px] text-[#525252] dark:text-[#a1a1a6] leading-relaxed">
              {t("modal.deleteWarning")}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalUser(null)}
                disabled={deleteSubmitting}
                className="h-9 px-4 rounded-lg bg-[#f4f4f5] hover:bg-[#e4e4e7] dark:bg-[#232325] dark:hover:bg-[#2e2e32] text-[13px] font-medium text-[#171717] dark:text-[#ededed] border border-black/[0.08] dark:border-white/[0.08] transition-colors duration-150"
              >
                {t("modal.cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteSubmitting}
                className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-[13px] font-medium text-white transition-colors duration-150 disabled:opacity-50 flex items-center gap-2"
              >
                {deleteSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                )}
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

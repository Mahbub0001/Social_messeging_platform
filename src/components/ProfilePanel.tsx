import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { useStore } from "../hooks/useStore";
import { authService } from "../services/authService";
import { motion } from "framer-motion";
import { X, User, FileText, ImageIcon, Loader2, Check } from "lucide-react";

interface ProfilePanelProps {
  onClose: () => void;
}

const profileSchema = zod.object({
  username: zod
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be under 20 characters"),
  bio: zod.string().max(160, "Bio must be under 160 characters"),
  avatar_url: zod.string().url("Please enter a valid image URL").or(zod.string().length(0)),
});

type ProfileFormInputs = zod.infer<typeof profileSchema>;

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ onClose }) => {
  const { user } = useStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profileData, setProfileData] = useState<{
    username: string;
    bio: string;
    avatar_url: string;
  } | null>(null);

  // Fetch initial profile values
  React.useEffect(() => {
    if (user?.id) {
      authService.getProfile(user.id).then(({ data }) => {
        if (data) {
          setProfileData({
            username: data.username,
            bio: data.bio || "",
            avatar_url: data.avatar_url || "",
          });
        }
      });
    }
  }, [user?.id]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormInputs>({
    resolver: zodResolver(profileSchema),
    values: profileData || { username: "", bio: "", avatar_url: "" },
  });

  const onSubmit = async (data: ProfileFormInputs) => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: updateError } = await authService.updateProfile(user.id, {
        username: data.username.trim(),
        bio: data.bio.trim(),
        avatar_url: data.avatar_url.trim() || undefined,
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        // Reload conversations to sync user avatar change
        useStore.getState().fetchConversations();
      }
    } catch (err: any) {
      setError("Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute top-0 right-0 z-30 w-full sm:w-[360px] h-full bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <User className="w-4.5 h-4.5 text-violet-400" />
          <span>Profile Settings</span>
        </h3>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Profile Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {profileData ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 font-sans text-xs">
            {/* Avatar Preview */}
            <div className="flex flex-col items-center gap-2.5 py-4">
              <img
                src={
                  profileData.avatar_url ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                    profileData.username
                  )}`
                }
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover bg-slate-850 border border-slate-800 shadow"
              />
              <span className="text-[10px] text-slate-500 font-semibold">Avatar Preview</span>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/60 rounded-xl p-3 text-red-300">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3 text-emerald-300">
                <Check className="w-4 h-4 shrink-0" />
                <span>Profile updated successfully!</span>
              </div>
            )}

            {/* Username Input */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-550" />
                <input
                  type="text"
                  {...register("username")}
                  onChange={(e) =>
                    setProfileData((prev) => prev && { ...prev, username: e.target.value })
                  }
                  className={`w-full pl-9 pr-4 py-2 bg-slate-950/60 border rounded-xl text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500 transition-all ${
                    errors.username ? "border-red-500/80" : "border-slate-800"
                  }`}
                />
              </div>
              {errors.username && (
                <p className="mt-1 text-[10px] text-red-400">{errors.username.message}</p>
              )}
            </div>

            {/* Bio Input */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">Bio</label>
              <div className="relative">
                <FileText className="absolute left-3 top-2.5 w-4 h-4 text-slate-550" />
                <textarea
                  rows={3}
                  {...register("bio")}
                  onChange={(e) => setProfileData((prev) => prev && { ...prev, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                  className={`w-full pl-9 pr-4 py-2 bg-slate-950/60 border rounded-xl text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500 transition-all resize-none ${
                    errors.bio ? "border-red-500/80" : "border-slate-800"
                  }`}
                />
              </div>
              {errors.bio && (
                <p className="mt-1 text-[10px] text-red-400">{errors.bio.message}</p>
              )}
            </div>

            {/* Avatar URL Input */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">Avatar Image URL</label>
              <div className="relative">
                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-550" />
                <input
                  type="text"
                  placeholder="https://example.com/avatar.png"
                  {...register("avatar_url")}
                  onChange={(e) =>
                    setProfileData((prev) => prev && { ...prev, avatar_url: e.target.value })
                  }
                  className={`w-full pl-9 pr-4 py-2 bg-slate-950/60 border rounded-xl text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500 transition-all ${
                    errors.avatar_url ? "border-red-500/80" : "border-slate-800"
                  }`}
                />
              </div>
              {errors.avatar_url && (
                <p className="mt-1 text-[10px] text-red-400">{errors.avatar_url.message}</p>
              )}
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold shadow active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </form>
        ) : (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-650" />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProfilePanel;

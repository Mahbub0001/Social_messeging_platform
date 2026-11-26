import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, AlertCircle, Loader2 } from "lucide-react";
import { authService } from "../services/authService";
import { adminService } from "../services/adminService";
import { useStore } from "../hooks/useStore";

const loginSchema = zod.object({
  identifier: zod.string().min(3, "Please enter your email or username"),
  password: zod.string().min(5, "Password must be at least 5 characters long"),
});

type LoginFormInputs = zod.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, setSession } = useStore();

  React.useEffect(() => {
    if (user) {
      adminService.getUserProfile(user.id).then((profile) => {
        const isAdmin =
          profile?.role === "admin" ||
          user.email?.toLowerCase().includes("admin") ||
          user.user_metadata?.username?.toLowerCase() === "mahbub";
        if (isAdmin) {
          navigate("/admin");
        } else {
          navigate("/dashboard");
        }
      });
    }
  }, [user, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormInputs) => {
    setLoading(true);
    setError(null);
    try {
      const { data: session, error: loginError } = await authService.signIn(
        data.identifier,
        data.password
      );
      if (loginError) {
        setError(loginError.message);
      } else if (session?.user) {
        setSession(session);
        const profile = await adminService.getUserProfile(session.user.id);
        const isAdmin =
          profile?.role === "admin" ||
          session.user.email?.toLowerCase().includes("admin") ||
          session.user.user_metadata?.username?.toLowerCase() === "mahbub" ||
          data.identifier.toLowerCase() === "mahbub";
        if (isAdmin) {
          navigate("/admin");
        } else {
          navigate("/dashboard");
        }
      }
    } catch (err: any) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const [socialLoading, setSocialLoading] = useState<"google" | "github" | null>(null);

  const handleSocialLogin = async (provider: "google" | "github") => {
    setSocialLoading(provider);
    setError(null);
    try {
      const { data: session, error: loginError } = await authService.signInWithOAuth(provider);
      if (loginError) {
        setError(loginError.message);
      } else if (session) {
        setSession(session);
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(`Failed to sign in with ${provider}.`);
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-xl font-bold text-slate-100 mb-1">
        স্বাগতম · Welcome back
      </h2>
      <p className="text-xs text-slate-400 mb-6">
        Sign in to continue to your conversations
      </p>

      {error && (
        <div className="flex items-center gap-2 bg-red-950/50 border border-red-800/60 rounded-xl p-3 mb-4 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Email or username
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="you@example.com or username"
              {...register("identifier")}
              className={`w-full pl-10 pr-4 py-2.5 bg-[#0B0D12] border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all ${
                errors.identifier ? "border-red-500/80" : "border-[#232938]"
              }`}
            />
          </div>
          {errors.identifier && (
            <p className="mt-1 text-2xs text-red-400">{errors.identifier.message}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-300">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-2xs text-teal-400 hover:text-teal-300 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="password"
              placeholder="••••••••"
              {...register("password")}
              className={`w-full pl-10 pr-4 py-2.5 bg-[#0B0D12] border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all ${
                errors.password ? "border-red-500/80" : "border-[#232938]"
              }`}
            />
          </div>
          {errors.password && (
            <p className="mt-1 text-2xs text-red-400">
              {errors.password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-teal-950/50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <div className="flex items-center my-5">
        <div className="flex-1 border-t border-[#232938]" />
        <span className="px-3 text-[11px] text-slate-500 font-medium">
          or
        </span>
        <div className="flex-1 border-t border-[#232938]" />
      </div>

      <div className="mb-6">
        <button
          type="button"
          onClick={() => handleSocialLogin("google")}
          disabled={loading || socialLoading !== null}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-[#0B0D12] border border-[#232938] hover:bg-[#181C28] text-slate-200 rounded-xl text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {socialLoading === "google" ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115z"
              />
              <path
                fill="#34A853"
                d="M16.04 15.345c-1.07.728-2.512 1.155-4.04 1.155a7.077 7.077 0 0 1-6.734-4.856L1.24 14.76A11.97 11.97 0 0 0 12 24c3.245 0 6.18-1.09 8.41-2.945l-4.37-3.71z"
              />
              <path
                fill="#4285F4"
                d="M24 12c0-.82-.07-1.61-.2-2.38H12v4.51h6.73c-.29 1.53-1.15 2.82-2.45 3.69l4.37 3.71C23.195 19.345 24 16.02 24 12z"
              />
              <path
                fill="#FBBC05"
                d="M5.266 14.235A7.077 7.077 0 0 1 4.91 12c0-.79.13-1.55.356-2.265L1.24 6.62A11.97 11.97 0 0 0 0 12c0 1.92.45 3.74 1.24 5.38l4.026-3.145z"
              />
            </svg>
          )}
          <span>Continue with Google</span>
        </button>
      </div>

      <p className="text-center text-xs text-slate-400">
        Don't have an account?{" "}
        <Link
          to="/register"
          className="text-teal-400 hover:text-teal-300 font-semibold hover:underline"
        >
          Sign up
        </Link>
      </p>
    </motion.div>
  );
};

export default Login;

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { authService } from "../services/authService";
import { useStore } from "../hooks/useStore";

const loginSchema = zod.object({
  email: zod.string().email("Please enter a valid email address"),
  password: zod.string().min(6, "Password must be at least 6 characters long"),
});

type LoginFormInputs = zod.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const setSession = useStore((state) => state.setSession);

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
        data.email,
        data.password
      );
      if (loginError) {
        setError(loginError.message);
      } else {
        setSession(session);
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setError(null);
    try {
      // In mock mode, signing in with "recruiter@kothabarta.com" triggers guest setup
      const { data: session, error: loginError } = await authService.signIn(
        "recruiter@kothabarta.com",
        "demo123"
      );
      if (loginError) {
        setError(loginError.message);
      } else {
        setSession(session);
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError("Failed to initialize guest demo.");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="text-2xl font-bold text-center text-slate-100 font-sans mb-1">
        স্বাগতম (Welcome Back)
      </h2>
      <p className="text-xs text-center text-slate-400 font-sans mb-6">
        Sign in to your Kotha Barta secure channel
      </p>

      {error && (
        <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/60 rounded-xl p-3 mb-4 text-xs text-red-300 font-sans animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 font-sans">
        {/* Email Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="email"
              placeholder="you@example.com"
              {...register("email")}
              className={`w-full pl-11 pr-4 py-2.5 bg-slate-950/60 border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all ${
                errors.email ? "border-red-500/80" : "border-slate-800"
              }`}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-2xs text-red-400">{errors.email.message}</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-2xs text-violet-400 hover:text-violet-300 transition-colors"
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
              className={`w-full pl-11 pr-4 py-2.5 bg-slate-950/60 border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all ${
                errors.password ? "border-red-500/80" : "border-slate-800"
              }`}
            />
          </div>
          {errors.password && (
            <p className="mt-1 text-2xs text-red-400">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={loading || demoLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Authenticating...</span>
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center my-5">
        <div className="flex-1 border-t border-slate-800"></div>
        <span className="px-3 text-2xs uppercase text-slate-500 font-sans font-semibold tracking-wider">
          Or
        </span>
        <div className="flex-1 border-t border-slate-800"></div>
      </div>

      {/* Demo Button */}
      <button
        type="button"
        onClick={handleDemoLogin}
        disabled={loading || demoLoading}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-200 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none mb-6"
      >
        {demoLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
        )}
        <span>Quick Demo (Mock Mode)</span>
      </button>

      <p className="text-center text-xs text-slate-400 font-sans">
        Don't have an account?{" "}
        <Link
          to="/register"
          className="text-violet-400 hover:text-violet-300 font-semibold hover:underline"
        >
          Sign up
        </Link>
      </p>
    </motion.div>
  );
};

export default Login;

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Mail, Lock, AlertCircle, Loader2 } from "lucide-react";
import { authService } from "../services/authService";
import { useStore } from "../hooks/useStore";

const registerSchema = zod
  .object({
    username: zod
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username must be under 20 characters")
      .regex(/^[a-zA-Z0-9_\s]+$/, "Username can only contain letters, numbers, underscores, and spaces"),
    email: zod.string().email("Please enter a valid email address"),
    password: zod.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: zod.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormInputs = zod.infer<typeof registerSchema>;

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useStore((state) => state.setSession);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormInputs>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormInputs) => {
    setLoading(true);
    setError(null);
    try {
      const { data: session, error: signUpError } = await authService.signUp(
        data.email,
        data.password,
        data.username
      );
      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSession(session);
        // Supabase sign-up might require email validation, but mock session bypasses this immediately
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="text-2xl font-bold text-center text-slate-100 font-sans mb-1">
        নতুন অ্যাকাউন্ট (Sign Up)
      </h2>
      <p className="text-xs text-center text-slate-400 font-sans mb-6">
        Create a profile to begin chatting in real-time
      </p>

      {error && (
        <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/60 rounded-xl p-3 mb-4 text-xs text-red-300 font-sans">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 font-sans">
        {/* Username Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Username
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="johndoe"
              {...register("username")}
              className={`w-full pl-11 pr-4 py-2.5 bg-slate-950/60 border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all ${
                errors.username ? "border-red-500/80" : "border-slate-800"
              }`}
            />
          </div>
          {errors.username && (
            <p className="mt-1 text-2xs text-red-400">{errors.username.message}</p>
          )}
        </div>

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
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Password
          </label>
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
            <p className="mt-1 text-2xs text-red-400">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm Password Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="password"
              placeholder="••••••••"
              {...register("confirmPassword")}
              className={`w-full pl-11 pr-4 py-2.5 bg-slate-950/60 border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all ${
                errors.confirmPassword ? "border-red-500/80" : "border-slate-800"
              }`}
            />
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-2xs text-red-400">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Registering Account...</span>
            </>
          ) : (
            "Create Account"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400 font-sans">
        Already have an account?{" "}
        <Link
          to="/login"
          className="text-violet-400 hover:text-violet-300 font-semibold hover:underline"
        >
          Sign in
        </Link>
      </p>
    </motion.div>
  );
};

export default Register;

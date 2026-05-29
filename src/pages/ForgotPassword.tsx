import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { isMockMode, supabase } from "../lib/supabase";

const forgotSchema = zod.object({
  email: zod.string().email("Please enter a valid email address"),
});

type ForgotFormInputs = zod.infer<typeof forgotSchema>;

export const ForgotPassword: React.FC = () => {
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormInputs>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotFormInputs) => {
    setLoading(true);
    setError(null);
    try {
      if (isMockMode) {
        // Simulate password recovery trigger
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setSuccess(true);
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          data.email,
          {
            redirectTo: `${window.location.origin}/reset-password`,
          }
        );
        if (resetError) {
          setError(resetError.message);
        } else {
          setSuccess(true);
        }
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
        পাসওয়ার্ড ভুলে গেছেন?
      </h2>
      <p className="text-xs text-center text-slate-400 font-sans mb-6">
        Recover your Kotha Barta password channel
      </p>

      {success ? (
        <div className="text-center font-sans space-y-4">
          <div className="flex items-center justify-center w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full mx-auto animate-bounce">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-200">Email Sent!</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            We have sent password recovery instructions. Please check your inbox
            (or spam folder) to reset your credentials.
          </p>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/60 rounded-xl p-3 mb-4 text-xs text-red-300 font-sans">
              <span className="shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 font-sans">
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
                <p className="mt-1 text-2xs text-red-400">
                  {errors.email.message}
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
                  <span>Sending Link...</span>
                </>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400 font-sans">
            Remember your credentials?{" "}
            <Link
              to="/login"
              className="text-violet-400 hover:text-violet-300 font-semibold hover:underline"
            >
              Sign in
            </Link>
          </p>
        </>
      )}
    </motion.div>
  );
};

export default ForgotPassword;

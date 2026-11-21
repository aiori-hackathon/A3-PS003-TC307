import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../services/api";
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { TrafficFLMark } from "../../components/common/TrafficFLMark";

export const ResetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const { language, setLanguage, isHindi } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [token, setToken] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, [searchParams]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (newPassword !== confirmPassword) {
      setErrorMsg(isHindi ? "पासवर्ड मेल नहीं खाते।" : "Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg(isHindi ? "पासवर्ड कम से कम 8 वर्णों का होना चाहिए।" : "Password must be at least 8 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword(token, newPassword, confirmPassword);
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reset password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-6 bg-[#090A0D] text-[#F5F7FA] font-sans relative overflow-x-hidden selection:bg-[#9AC2FA]/30 selection:text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(96,165,250,0.06),_transparent_45%),radial-gradient(ellipse_at_bottom_right,_rgba(30,41,59,0.22),_transparent_55%)]"
      />

      {/* Top Header */}
      <div className="w-full max-w-[465px] flex items-center justify-between mb-6 z-10">
        <Link
          to="/login"
          className="inline-flex items-center gap-2.5 text-white hover:opacity-90 transition-opacity"
        >
          <TrafficFLMark />
          <span className="font-serif text-[21px] font-medium tracking-[-0.01em] text-white">
            TrafficFL
          </span>
        </Link>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={`px-2 py-1 rounded transition-colors cursor-pointer ${
              language === "en" ? "text-zinc-200 underline underline-offset-4" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            EN
          </button>
          <span className="text-zinc-700">/</span>
          <button
            type="button"
            onClick={() => setLanguage("hi")}
            className={`px-2 py-1 rounded transition-colors cursor-pointer ${
              language === "hi" ? "text-zinc-200 underline underline-offset-4" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            हिंदी
          </button>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-[465px] rounded-2xl bg-[#111318]/95 border border-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.75)] backdrop-blur-md p-6 sm:p-8 space-y-5 z-10">
        <div>
          <h1 className="font-serif text-2xl sm:text-[28px] font-medium text-white tracking-[-0.015em]">
            {t("auth.reset_title")}
          </h1>
          <p className="text-xs sm:text-sm text-[#C5C8D0] mt-1.5 leading-relaxed">
            {t("auth.reset_subtitle")}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {success ? (
          <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs space-y-2 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="font-semibold text-sm text-white">
              {isHindi ? "पासवर्ड सफलतापूर्वक अपडेट हो गया!" : "Password successfully updated!"}
            </p>
            <p className="text-[#9CA3AF]">
              {isHindi ? "लॉगिन पृष्ठ पर रीडायरेक्ट किया जा रहा है..." : "Redirecting to sign in..."}
            </p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            {/* Token Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#EAECEF] block">
                {t("auth.reset_token_label")}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-3 text-[#7E8594]" />
                <input
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={t("auth.reset_token_placeholder")}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-[#1B1D22] border border-white/[0.08] text-[#F5F7FA] placeholder-[#7A8191] font-mono text-xs focus:outline-none focus:border-[#9AC2FA]/50 focus:ring-1 focus:ring-[#9AC2FA]/40 transition-colors"
                />
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#EAECEF] block">
                {t("auth.new_password_label")}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-[#7E8594]" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("auth.new_password_placeholder")}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-[#1B1D22] border border-white/[0.08] text-[#F5F7FA] placeholder-[#7A8191] text-sm focus:outline-none focus:border-[#9AC2FA]/50 focus:ring-1 focus:ring-[#9AC2FA]/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-[#8C93A4] hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#EAECEF] block">
                {t("auth.confirm_password_label")}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-[#7E8594]" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("auth.confirm_password_placeholder")}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-[#1B1D22] border border-white/[0.08] text-[#F5F7FA] placeholder-[#7A8191] text-sm focus:outline-none focus:border-[#9AC2FA]/50 focus:ring-1 focus:ring-[#9AC2FA]/40 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-[#9AC2FA] hover:bg-[#B0D0FC] text-[#0A0D14] font-semibold text-sm transition-colors disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t("auth.updating_password")}</span>
                </>
              ) : (
                <>
                  <span>{t("auth.update_password_btn")}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2 border-t border-white/[0.07]">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t("auth.back_to_login")}</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

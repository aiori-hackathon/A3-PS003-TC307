import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";
import {
  Radio,
  Mail,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Loader2,
  KeyRound,
} from "lucide-react";

export const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const { language, setLanguage, isHindi } = useLanguage();
  const { isDark, setTheme } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email) return;

    setSubmitting(true);
    try {
      const res = await api.forgotPassword(email);
      setSuccessMessage(res.message);
      if (res.reset_token) {
        setDevToken(res.reset_token);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process password reset request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-6 bg-slate-100 dark:bg-navy-900 text-slate-800 dark:text-slate-100 font-sans relative overflow-x-hidden transition-colors duration-200">
      {/* Top Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 z-10">
        <Link to="/login" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <span className="font-extrabold text-lg tracking-wide text-slate-900 dark:text-white">
            Traffic<span className="text-blue-600 dark:text-blue-400">FL</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs shadow-sm">
            <button
              onClick={() => setLanguage("en")}
              className={`px-2 py-1 rounded font-bold transition-all ${
                language === "en" ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("hi")}
              className={`px-2 py-1 rounded font-bold font-sans transition-all ${
                language === "hi" ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              हिंदी
            </button>
          </div>

          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shadow-sm cursor-pointer"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-3xl bg-white/95 dark:bg-slate-900/85 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl backdrop-blur-xl p-6 sm:p-8 space-y-5 z-10 transition-colors duration-200">
        <div className="space-y-1">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
            <KeyRound className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t("auth.forgot_title")}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("auth.forgot_subtitle")}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMessage ? (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{isHindi ? "अनुरोध प्राप्त हुआ" : "Recovery Request Dispatched"}</span>
              </div>
              <p className="leading-relaxed">{successMessage}</p>
            </div>

            {/* Development helper token banner */}
            {devToken && (
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 space-y-2 text-xs">
                <span className="font-semibold text-blue-800 dark:text-blue-300 block">
                  {t("auth.dev_token_notice")}
                </span>
                <p className="font-mono bg-slate-100 dark:bg-slate-950 p-2 rounded border border-slate-300 dark:border-slate-800 text-[11px] text-slate-800 dark:text-slate-300 break-all">
                  {devToken}
                </p>
                <button
                  onClick={() => navigate(`/reset-password?token=${devToken}`)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all text-xs cursor-pointer"
                >
                  <span>{isHindi ? "इस टोकन से पासवर्ड रीसेट करें" : "Proceed with Token to Reset"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t("auth.back_to_login")}</span>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                {t("auth.email_label")}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.email_placeholder")}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-blue-600/30 transition-all disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t("auth.sending_reset")}</span>
                </>
              ) : (
                <>
                  <span>{t("auth.send_reset_btn")}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors"
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

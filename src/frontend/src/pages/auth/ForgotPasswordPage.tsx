import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../services/api";
import {
  Mail,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
} from "lucide-react";
import { TrafficFLMark } from "../../components/common/TrafficFLMark";

export const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const { language, setLanguage, isHindi } = useLanguage();
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
        <div className="space-y-1.5">
          <div className="w-10 h-10 rounded-xl bg-[#161920] border border-white/[0.08] text-[#9AC2FA] flex items-center justify-center mb-3">
            <KeyRound className="w-5 h-5" />
          </div>
          <h1 className="font-serif text-2xl sm:text-[28px] font-medium text-white tracking-[-0.015em]">
            {t("auth.forgot_title")}
          </h1>
          <p className="text-xs sm:text-sm text-[#C5C8D0] leading-relaxed">
            {t("auth.forgot_subtitle")}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMessage ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-white">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{isHindi ? "अनुरोध प्राप्त हुआ" : "Recovery Request Dispatched"}</span>
              </div>
              <p className="leading-relaxed text-emerald-100/90">{successMessage}</p>
            </div>

            {/* Development helper token banner */}
            {devToken && (
              <div className="p-3.5 rounded-xl bg-[#161920] border border-white/[0.08] space-y-2.5 text-xs">
                <span className="font-semibold text-[#9AC2FA] block">
                  {t("auth.dev_token_notice")}
                </span>
                <p className="font-mono bg-[#0B0D11] p-2.5 rounded-lg border border-white/[0.07] text-[11px] text-[#E5E7EB] break-all">
                  {devToken}
                </p>
                <button
                  onClick={() => navigate(`/reset-password?token=${devToken}`)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#9AC2FA] hover:bg-[#B0D0FC] text-[#0A0D14] font-semibold transition-colors text-xs cursor-pointer"
                >
                  <span>{isHindi ? "इस टोकन से पासवर्ड रीसेट करें" : "Proceed with Token to Reset"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="pt-2 text-center border-t border-white/[0.07]">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t("auth.back_to_login")}</span>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#EAECEF] block">
                {t("auth.email_label")}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-[#7E8594]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.email_placeholder")}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-[#1B1D22] border border-white/[0.08] text-[#F5F7FA] placeholder-[#7A8191] text-sm focus:outline-none focus:border-[#9AC2FA]/50 focus:ring-1 focus:ring-[#9AC2FA]/40 transition-colors"
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
                  <span>{t("auth.sending_reset")}</span>
                </>
              ) : (
                <>
                  <span>{t("auth.send_reset_btn")}</span>
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

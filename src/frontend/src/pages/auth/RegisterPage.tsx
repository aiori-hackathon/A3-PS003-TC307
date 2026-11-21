import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import {
  User as UserIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { TrafficFLMark } from "../../components/common/TrafficFLMark";

export const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const { language, setLanguage, isHindi } = useLanguage();
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [agreeTerms, setAgreeTerms] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Password strength calculation
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: "", color: "bg-slate-300 dark:bg-slate-700" };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { score: 25, label: t("auth.strength_weak"), color: "bg-red-500" };
    if (score === 3) return { score: 50, label: t("auth.strength_fair"), color: "bg-amber-500" };
    if (score === 4) return { score: 75, label: t("auth.strength_good"), color: "bg-blue-500" };
    return { score: 100, label: t("auth.strength_strong"), color: "bg-emerald-500" };
  };

  const strength = getPasswordStrength(password);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg(isHindi ? "पासवर्ड मेल नहीं खाते।" : "Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg(isHindi ? "पासवर्ड कम से कम 8 वर्णों का होना चाहिए।" : "Password must be at least 8 characters long.");
      return;
    }

    if (!agreeTerms) {
      setErrorMsg(isHindi ? "कृपया नियमों व सुरक्षा प्रोटोकॉल को स्वीकार करें।" : "Please acknowledge municipal terms and protocols.");
      return;
    }

    setSubmitting(true);
    try {
      await register(fullName, email, password, confirmPassword);
      navigate("/citizen", { replace: true });
    } catch (err: any) {
      setErrorMsg(err.message || (isHindi ? "पंजीकरण विफल रहा।" : "Registration failed."));
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

      {/* Top Bar with Language Switch */}
      <div className="w-full max-w-[495px] flex items-center justify-between mb-6 z-10">
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

      {/* Register Card */}
      <div className="w-full max-w-[495px] rounded-2xl bg-[#111318]/95 border border-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.75)] backdrop-blur-md p-6 sm:p-8 space-y-5 z-10">
        <div>
          <h1 className="font-serif text-2xl sm:text-[28px] font-medium text-white tracking-[-0.015em]">
            {t("auth.register_title")}
          </h1>
          <p className="text-xs sm:text-sm text-[#C5C8D0] mt-1.5 leading-relaxed">
            {t("auth.register_subtitle")}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#EAECEF] block">
              {t("auth.fullname_label")}
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3.5 top-3 text-[#7E8594]" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("auth.fullname_placeholder")}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-[#1B1D22] border border-white/[0.08] text-[#F5F7FA] placeholder-[#7A8191] text-sm focus:outline-none focus:border-[#9AC2FA]/50 focus:ring-1 focus:ring-[#9AC2FA]/40 transition-colors"
              />
            </div>
          </div>

          {/* Email Address */}
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

          {/* Password & Strength */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#EAECEF] block">
              {t("auth.password_label")}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3 text-[#7E8594]" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.password_placeholder")}
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

            {/* Dynamic Strength Bar */}
            {password && (
              <div className="pt-1.5 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#8C93A4]">{t("auth.password_strength")}:</span>
                  <span className="font-semibold text-[#EAECEF]">{strength.label}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#1B1D22] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strength.color}`}
                    style={{ width: `${strength.score}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#EAECEF] block">
              {t("auth.confirm_password_label")}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3 text-[#7E8594]" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("auth.confirm_password_placeholder")}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-[#1B1D22] border border-white/[0.08] text-[#F5F7FA] placeholder-[#7A8191] text-sm focus:outline-none focus:border-[#9AC2FA]/50 focus:ring-1 focus:ring-[#9AC2FA]/40 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-3 text-[#8C93A4] hover:text-white cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-start gap-2.5 pt-1">
            <input
              type="checkbox"
              id="agree"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="w-4 h-4 rounded bg-[#1B1D22] border-white/20 text-[#9AC2FA] focus:ring-[#9AC2FA]/40 mt-0.5 cursor-pointer"
            />
            <label htmlFor="agree" className="text-xs text-[#C5C8D0] cursor-pointer leading-snug">
              {t("auth.agree_terms")}
            </label>
          </div>

          {/* Public Citizen Notice */}
          <div className="p-3 rounded-lg bg-[#161920] border border-white/[0.08] text-[11px] text-[#C5C8D0] flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#9AC2FA] shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              {isHindi
                ? "सार्वजनिक पंजीकरण द्वारा 'नागरिक खाता (Citizen)' प्रदान किया जाता है। ट्रैफिक अथॉरिटी एक्सेस हेतु विभागीय आमंत्रण आवश्यक है।"
                : "Public registration provisions a standard Citizen Commuter account. Traffic Authority accounts require departmental administrative verification."}
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-[#9AC2FA] hover:bg-[#B0D0FC] text-[#0A0D14] font-semibold text-sm transition-colors disabled:opacity-60 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t("auth.creating_account")}</span>
              </>
            ) : (
              <>
                <span>{t("auth.register_btn")}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-3 text-xs text-[#9CA3AF] border-t border-white/[0.08]">
          <span>{t("auth.already_have_account")}{" "}</span>
          <Link
            to="/login"
            className="font-medium text-[#70A3F3] hover:text-[#9AC2FA] hover:underline underline-offset-4 transition-colors"
          >
            {t("auth.sign_in_link")}
          </Link>
        </div>
      </div>
    </div>
  );
};

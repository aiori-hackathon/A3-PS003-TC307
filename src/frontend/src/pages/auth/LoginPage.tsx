import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import {
  Radio,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  TrendingUp,
  Cpu,
  Zap,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Sparkles,
  ShieldCheck,
  Loader2,
  KeyRound,
} from "lucide-react";

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { language, setLanguage, isHindi } = useLanguage();
  const { isDark, setTheme } = useTheme();
  const { login, demoLogin, isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [demoLoadingRole, setDemoLoadingRole] = useState<"authority" | "citizen" | null>(null);

  // Preserve intended destination after login, respecting role boundaries
  const from = (location.state as any)?.from?.pathname || "/";

  const getAuthorizedRedirect = (userRole?: string) => {
    const role = (userRole || "citizen").toLowerCase();
    const isCitizen = role === "citizen";
    if (from === "/" || from === "/login") {
      return isCitizen ? "/citizen" : "/dashboard";
    }
    const adminPaths = [
      "/dashboard",
      "/prediction",
      "/federated",
      "/optimizer",
      "/digital-twin",
      "/incidents",
      "/analytics",
    ];
    if (isCitizen && adminPaths.some((p) => from.startsWith(p))) {
      return "/citizen";
    }
    return from;
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(getAuthorizedRedirect(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate, from]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email || !password) {
      setErrorMsg(isHindi ? "कृपया ईमेल और पासवर्ड दोनों दर्ज करें।" : "Please enter both email and password.");
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password, rememberMe);
      const stored = localStorage.getItem("trafficfl_user");
      const loggedUser = stored ? JSON.parse(stored) : null;
      navigate(getAuthorizedRedirect(loggedUser?.role), { replace: true });
    } catch (err: any) {
      setErrorMsg(err.message || (isHindi ? "साइन इन विफल हुआ। कृपया क्रेडेंशियल जांचें।" : "Sign in failed. Please verify your credentials."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSignIn = async (role: "authority" | "citizen" = "authority") => {
    if (submitting) return;
    setErrorMsg(null);
    setSubmitting(true);
    setDemoLoadingRole(role);
    try {
      await demoLogin(role);
      const targetPath = role === "authority" ? "/dashboard" : "/citizen";
      navigate(targetPath, { replace: true });
    } catch (err: any) {
      setErrorMsg(err.message || (isHindi ? "डेमो लॉगिन विफल हुआ। कृपया पुनः प्रयास करें।" : "Demo login failed. Please try again."));
    } finally {
      setSubmitting(false);
      setDemoLoadingRole(null);
    }
  };

  const fillCredentials = (role: "authority" | "citizen") => {
    if (role === "authority") {
      setEmail("admin@trafficfl.gov.in");
      setPassword("TrafficFL@2026");
    } else {
      setEmail("citizen@trafficflow.ai");
      setPassword("Citizen@2026");
    }
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-100 dark:bg-navy-900 text-slate-800 dark:text-slate-100 font-sans relative overflow-x-hidden transition-colors duration-200">
      {/* Background Subtle Glowing Road Grid Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-25 overflow-hidden">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="traffic-grid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#3B82F6" strokeWidth="1" strokeDasharray="6 6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#traffic-grid)" />
          {/* Glowing Arterial Lines */}
          <line x1="0" y1="25%" x2="100%" y2="25%" stroke="#60A5FA" strokeWidth="2" strokeDasharray="12 8" />
          <line x1="30%" y1="0" x2="30%" y2="100%" stroke="#3B82F6" strokeWidth="2" strokeDasharray="12 8" />
          <line x1="70%" y1="0" x2="70%" y2="100%" stroke="#10B981" strokeWidth="2" strokeDasharray="12 8" />
        </svg>
      </div>

      {/* LEFT PANEL: Smart City Brand, Mission, & Architectural Highlights */}
      <div className="relative z-10 flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-16 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800/80 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-100 dark:from-navy-900 dark:via-navy-800/90 dark:to-slate-900/95 transition-colors duration-200">
        {/* Top Header: Logo & Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-xl sm:text-2xl tracking-wide text-slate-900 dark:text-white">
                Traffic<span className="text-blue-600 dark:text-blue-400">FL</span>
              </span>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-300">
                Smart City Intelligence
              </span>
            </div>
          </div>

          {/* Quick status pill */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">LIVE TRAFFIC PULSE</span>
          </div>
        </div>

        {/* Center: Hero Headline & 3 Features */}
        <div className="my-8 sm:my-12 lg:my-0 space-y-6 max-w-xl">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart City Mobility Intelligence</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              {t("auth.left_headline")}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              {t("auth.left_subheadline")}
            </p>
          </div>

          {/* 3 Key Feature Highlights */}
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3.5 p-3 rounded-xl bg-white/90 dark:bg-white/5 border border-slate-200/90 dark:border-white/10 shadow-sm dark:shadow-none backdrop-blur-sm">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {t("auth.feature_1_title")}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("auth.feature_1_desc")}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3 rounded-xl bg-white/90 dark:bg-white/5 border border-slate-200/90 dark:border-white/10 shadow-sm dark:shadow-none backdrop-blur-sm">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {t("auth.feature_2_title")}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("auth.feature_2_desc")}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3 rounded-xl bg-white/90 dark:bg-white/5 border border-slate-200/90 dark:border-white/10 shadow-sm dark:shadow-none backdrop-blur-sm">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {t("auth.feature_3_title")}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("auth.feature_3_desc")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-800/60">
          <span>{t("brand.team")}</span>
          <span className="font-mono text-[11px] text-slate-400">v1.0.0 Stable</span>
        </div>
      </div>

      {/* RIGHT PANEL: Authentication Form Card */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-16">
        {/* Top Controls: Language Switcher & Theme Toggle */}
        <div className="w-full max-w-md flex items-center justify-end gap-2 mb-6">
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

        {/* Frosted Glassmorphism Card */}
        <div className="w-full max-w-md rounded-3xl bg-white/95 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl backdrop-blur-xl p-6 sm:p-8 space-y-6 transition-colors duration-200">
          {/* Card Title */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t("auth.login_title")}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t("auth.login_subtitle")}
            </p>
          </div>

          {/* Quick Demo Credentials Hint Card */}
          <div className="p-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 text-xs space-y-2">
            <div className="flex items-center justify-between text-blue-900 dark:text-blue-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>{isHindi ? "त्वरित मोड एक्सेस (डेमो लॉगिन):" : "Automatic Demo Login (Mode Select):"}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => handleDemoSignIn("authority")}
                disabled={submitting}
                className="p-2 rounded-lg bg-white dark:bg-slate-800/90 border border-blue-200 dark:border-slate-700 hover:border-blue-500 text-left transition-all cursor-pointer disabled:opacity-60 flex items-center justify-between gap-1"
              >
                <div>
                  <div className="font-bold text-blue-600 dark:text-blue-400">{isHindi ? "अथॉरिटी मोड" : "Authority Mode"}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">admin@trafficfl.gov.in</div>
                </div>
                {submitting && demoLoadingRole === "authority" && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleDemoSignIn("citizen")}
                disabled={submitting}
                className="p-2 rounded-lg bg-white dark:bg-slate-800/90 border border-emerald-200 dark:border-slate-700 hover:border-emerald-500 text-left transition-all cursor-pointer disabled:opacity-60 flex items-center justify-between gap-1"
              >
                <div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">{isHindi ? "पब्लिक मोड" : "General Public Mode"}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">citizen@trafficflow.ai</div>
                </div>
                {submitting && demoLoadingRole === "citizen" && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSignIn} className="space-y-4">
            {/* Email Address */}
            <div className="space-y-1.5">
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
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {t("auth.password_label")}
                </label>
                <Link
                  to="/forgot-password"
                  className="text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                >
                  {t("auth.forgot_password")}
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.password_placeholder")}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="remember" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                {t("auth.remember_me")}
              </label>
            </div>

            {/* Primary Sign In Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-blue-600/30 transition-all disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t("auth.signing_in")}</span>
                </>
              ) : (
                <>
                  <span>{t("auth.sign_in")}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo 1-Click Instant Login Section */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>{isHindi ? "त्वरित 1-क्लिक डेमो लॉगिन:" : "1-Click Direct Demo Login:"}</span>
              <span className="font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                {isHindi ? "डेमो मोड" : "Dev Demo"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoSignIn("authority")}
                disabled={submitting}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-blue-200 dark:border-slate-700 text-blue-900 dark:text-slate-200 text-xs font-semibold transition-all hover:border-blue-400 cursor-pointer shadow-sm disabled:opacity-60"
              >
                {submitting && demoLoadingRole === "authority" ? (
                  <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                )}
                <span className="truncate">{isHindi ? "अथॉरिटी मोड" : "Authority Mode"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoSignIn("citizen")}
                disabled={submitting}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-emerald-200 dark:border-slate-700 text-emerald-900 dark:text-slate-200 text-xs font-semibold transition-all hover:border-emerald-400 cursor-pointer shadow-sm disabled:opacity-60"
              >
                {submitting && demoLoadingRole === "citizen" ? (
                  <Loader2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin shrink-0" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                <span className="truncate">{isHindi ? "पब्लिक मोड" : "General Public Mode"}</span>
              </button>
            </div>
          </div>

          {/* Link to Register */}
          <div className="text-center pt-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{t("auth.dont_have_account")}{" "}</span>
            <Link
              to="/register"
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline underline-offset-4"
            >
              {t("auth.create_account")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

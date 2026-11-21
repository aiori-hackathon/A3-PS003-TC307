import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { getStoredAuthUser } from "../../services/api";
import { User } from "../../types";
import controlRoomImg from "../../assets/traffic-control-room.jpg";
import { TrafficFLMark } from "../../components/common/TrafficFLMark";

const LOGIN_INPUT_BASE_CLASS =
  "login-dark-input w-full h-11 pl-10 rounded-xl bg-[#252932] hover:bg-[#2B303B] focus:bg-[#252932] border border-[#363B45] hover:border-[#464D5B] focus:border-[#80B9F5] focus:ring-2 focus:ring-[#80B9F5]/25 focus:outline-none text-sm text-[#F4F5F7] placeholder-[#949AA6] placeholder:opacity-100 disabled:opacity-60 disabled:hover:bg-[#252932] disabled:hover:border-[#363B45] transition-all duration-150";

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { language, setLanguage, isHindi } = useLanguage();
  const { login, demoLogin, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Strictly empty controlled state — no hardcoded credentials or tokens
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [demoLoadingRole, setDemoLoadingRole] = useState<"authority" | "citizen" | null>(null);

  const submitLockRef = useRef<boolean>(false);
  const redirectTimerRef = useRef<number | null>(null);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";

  const getAuthorizedRedirect = useCallback(
    (userRole?: string) => {
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
    },
    [from]
  );

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && user && !submitLockRef.current) {
      navigate(getAuthorizedRedirect(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate, getAuthorizedRedirect]);

  const formatAuthError = (err: unknown, fallback: string): string => {
    const msg = err instanceof Error ? err.message : String(err || "");
    const lower = msg.toLowerCase();
    if (
      lower.includes("failed to fetch") ||
      lower.includes("networkerror") ||
      lower.includes("network request failed") ||
      lower.includes("econnrefused")
    ) {
      return isHindi
        ? "प्रमाणीकरण सर्वर से संपर्क नहीं हो पा रहा है। कृपया जांचें कि बैकएंड सेवा चल रही है और पुनः प्रयास करें।"
        : "Unable to reach the authentication service. Please confirm the backend API is running and try again.";
    }
    return msg || fallback;
  };

  const completeRedirect = (targetPath: string, message: string) => {
    setSuccessMsg(message);
    redirectTimerRef.current = window.setTimeout(() => {
      submitLockRef.current = false;
      navigate(targetPath, { replace: true });
    }, 180);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || submitting) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMsg(
        isHindi
          ? "कृपया अपना आधिकारिक ईमेल पता और पासवर्ड दोनों दर्ज करें।"
          : "Please enter both your official email address and password."
      );
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMsg(
        isHindi
          ? "कृपया एक मान्य ईमेल पता प्रारूप दर्ज करें।"
          : "Please enter a valid email address format."
      );
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    try {
      await login(trimmedEmail, password, rememberMe);
      const loggedUser = getStoredAuthUser<User>();
      const targetPath = getAuthorizedRedirect(loggedUser?.role);
      completeRedirect(
        targetPath,
        isHindi
          ? "सफलतापूर्वक प्रमाणित। आपके डैशबोर्ड पर ले जाया जा रहा है..."
          : "Credentials verified. Redirecting to your dashboard..."
      );
    } catch (err: unknown) {
      submitLockRef.current = false;
      setSubmitting(false);
      setErrorMsg(
        formatAuthError(
          err,
          isHindi
            ? "अमान्य ईमेल या पासवर्ड। कृपया अपने क्रेडेंशियल जांचें।"
            : "Invalid email address or password."
        )
      );
    }
  };

  const handleDemoSignIn = async (role: "authority" | "citizen") => {
    if (submitLockRef.current || submitting) return;

    submitLockRef.current = true;
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    setDemoLoadingRole(role);

    try {
      await demoLogin(role);
      const targetPath = role === "authority" ? "/dashboard" : "/citizen";
      const label =
        role === "authority"
          ? isHindi
            ? "अथॉरिटी डेमो सत्र सक्रिय। डैशबोर्ड खोल रहा है..."
            : "Authority demo authorized. Opening command dashboard..."
          : isHindi
            ? "सिटिजन डेमो सत्र सक्रिय। सिटिजन पोर्टल खोल रहा है..."
            : "Citizen demo authorized. Opening commuter portal...";
      completeRedirect(targetPath, label);
    } catch (err: unknown) {
      submitLockRef.current = false;
      setSubmitting(false);
      setDemoLoadingRole(null);
      setErrorMsg(
        formatAuthError(
          err,
          isHindi
            ? "डेमो सत्र प्रारंभ नहीं हो सका। कृपया पुनः प्रयास करें।"
            : "Failed to initialize demo session. Please try again."
        )
      );
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#15171B] text-[#F4F5F7] [color-scheme:dark] font-sans flex flex-col relative overflow-x-hidden selection:bg-[#8DBCF3]/30 selection:text-white"
      data-testid="login-page-root"
    >
      {/* Subtle cool blue-grey radial depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(100,132,175,0.09),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(56,74,102,0.12),_transparent_55%)]"
      />

      {/* Top Minimal Navigation Bar */}
      <header className="relative z-10 w-full max-w-[1340px] mx-auto px-5 sm:px-8 lg:px-12 pt-5 sm:pt-7 pb-3 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/login"
          className="inline-flex items-center gap-2.5 text-white hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9AC2FA]/60 rounded-lg py-1"
          aria-label="TrafficFL Home"
        >
          <TrafficFLMark />
          <span className="font-serif text-[21px] sm:text-[22px] font-medium tracking-[-0.01em] text-white">
            TrafficFL
          </span>
        </Link>

        <nav className="flex items-center gap-2.5 sm:gap-3" aria-label="Demo access navigation">
          <button
            type="button"
            onClick={() => handleDemoSignIn("authority")}
            disabled={submitting}
            data-testid="enter-authority-demo-btn"
            className="min-h-[38px] px-3.5 sm:px-5 py-2 rounded-lg border border-white/[0.16] bg-white/[0.02] hover:bg-white/[0.07] hover:border-white/30 text-xs sm:text-[13px] font-medium text-[#E5E7EB] transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9AC2FA]/60"
          >
            {submitting && demoLoadingRole === "authority" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9AC2FA]" />
                <span>{isHindi ? "प्रवेश..." : "Connecting..."}</span>
              </>
            ) : (
              <span>{isHindi ? "अथॉरिटी डेमो" : "Authority Demo"}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleDemoSignIn("citizen")}
            disabled={submitting}
            data-testid="enter-citizen-demo-btn"
            className="min-h-[38px] px-3.5 sm:px-5 py-2 rounded-lg border border-white/[0.16] bg-white/[0.02] hover:bg-white/[0.07] hover:border-white/30 text-xs sm:text-[13px] font-medium text-[#E5E7EB] transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9AC2FA]/60"
          >
            {submitting && demoLoadingRole === "citizen" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9AC2FA]" />
                <span>{isHindi ? "प्रवेश..." : "Connecting..."}</span>
              </>
            ) : (
              <span>{isHindi ? "सिटिजन डेमो" : "Citizen Demo"}</span>
            )}
          </button>
        </nav>
      </header>

      {/* Main Split-Screen Stage */}
      <main className="relative z-10 flex-1 w-full max-w-[1340px] mx-auto px-5 sm:px-8 lg:px-12 py-6 sm:py-8 lg:py-10 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-[4%]">
        {/* Left Section (~48% desktop width): Serif Hero + Subtitle + Translucent Login Card */}
        <section className="w-full lg:w-[48%] flex flex-col items-start lg:pl-6">
          <div className="w-full max-w-[465px] mx-auto lg:mx-0">
            {/* Hero Heading */}
            <h1 className="font-serif text-[34px] sm:text-[44px] lg:text-[48px] xl:text-[52px] font-medium tracking-[-0.015em] leading-[1.12] text-white">
              {isHindi ? (
                t("auth.left_headline")
              ) : (
                <>
                  Intelligent Traffic.
                  <br />
                  Smarter Cities.
                </>
              )}
            </h1>

            {/* Subtitle */}
            <p className="mt-4 font-serif text-[14.5px] sm:text-[15.5px] leading-[1.6] text-[#CFD4DE] max-w-[445px]">
              {t("auth.left_subheadline")}
            </p>

            {/* Soft Charcoal Login Card */}
            <div className="mt-7 w-full rounded-2xl bg-[#1C1F25]/95 border border-[#303640] shadow-[0_18px_44px_rgba(0,0,0,0.42)] backdrop-blur-md p-5 sm:p-7">
              {errorMsg && (
                <div
                  role="alert"
                  data-testid="auth-error-banner"
                  className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div
                  role="status"
                  data-testid="auth-success-banner"
                  className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleSignIn} className="space-y-4" data-testid="login-form" noValidate>
                {/* Official Email Address */}
                <div>
                  <label
                    htmlFor="official-email-input"
                    className="block text-xs font-medium text-[#E4E6EB] mb-2"
                  >
                    {t("auth.email_label")}
                  </label>
                  <div className="relative">
                    <Mail
                      aria-hidden="true"
                      className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A2A8B4] pointer-events-none z-10"
                    />
                    <input
                      id="official-email-input"
                      type="email"
                      required
                      disabled={submitting}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("auth.email_placeholder")}
                      autoComplete="email"
                      data-testid="login-email-input"
                      className={`${LOGIN_INPUT_BASE_CLASS} pr-3.5`}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="login-password-input"
                      className="text-xs font-medium text-[#E5E7EB]"
                    >
                      {t("auth.password_label")}
                    </label>
                    <Link
                      to="/forgot-password"
                      data-testid="forgot-password-link"
                      className="text-xs font-medium text-[#80B9F5] hover:text-[#A3CEFA] transition-colors focus:outline-none focus-visible:underline"
                    >
                      {t("auth.forgot_password")}
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock
                      aria-hidden="true"
                      className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A2A8B4] pointer-events-none z-10"
                    />
                    <input
                      id="login-password-input"
                      type={showPassword ? "text" : "password"}
                      required
                      disabled={submitting}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("auth.password_placeholder")}
                      autoComplete="current-password"
                      data-testid="login-password-input"
                      className={`${LOGIN_INPUT_BASE_CLASS} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      disabled={submitting}
                      data-testid="toggle-password-visibility-btn"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#A2A8B4] hover:text-[#F4F5F7] transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#80B9F5]/60 cursor-pointer z-10"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember This Device */}
                <div className="flex items-center gap-2.5 pt-0.5">
                  <input
                    id="remember-device-checkbox"
                    type="checkbox"
                    disabled={submitting}
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    data-testid="remember-me-checkbox"
                    className="w-4 h-4 rounded border-[#363B45] bg-[#252932] text-[#4F92F6] accent-[#4F92F6] [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-[#80B9F5]/30 focus:ring-offset-0 cursor-pointer shrink-0"
                  />
                  <label
                    htmlFor="remember-device-checkbox"
                    className="text-xs font-medium text-[#F4F5F7] cursor-pointer select-none leading-none"
                  >
                    {t("auth.remember_me")}
                  </label>
                </div>

                {/* Sign In to Dashboard CTA */}
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="login-submit-btn"
                  className="mt-1 w-full h-11 px-4 rounded-xl bg-[#8DBCF3] hover:brightness-105 active:brightness-95 text-[#101827] font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(141,188,243,0.16)] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#80B9F5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C1F25]"
                >
                  {submitting && !demoLoadingRole ? (
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
            </div>

            {/* Subtle Account Creation & Language Links Below Card */}
            <div className="mt-3.5 px-1 flex items-center justify-between text-[11.5px] text-[#969EAE]">
              <div>
                <span>{t("auth.dont_have_account")} </span>
                <Link
                  to="/register"
                  data-testid="create-account-link"
                  className="text-[#8DBCF3] hover:text-[#B4D3F8] hover:underline underline-offset-4 transition-colors"
                >
                  {t("auth.create_account")}
                </Link>
              </div>
              <div className="flex items-center gap-1.5 font-medium" aria-label="Language switcher">
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    language === "en" ? "text-[#E5E7EB] underline underline-offset-4" : "text-[#8B93A3] hover:text-[#CBD5E1]"
                  }`}
                >
                  EN
                </button>
                <span className="text-[#4B5363]">/</span>
                <button
                  type="button"
                  onClick={() => setLanguage("hi")}
                  className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    language === "hi" ? "text-[#E5E7EB] underline underline-offset-4" : "text-[#8B93A3] hover:text-[#CBD5E1]"
                  }`}
                >
                  हिंदी
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Right Section (~48% desktop width): Uncluttered Traffic Control Room Visual */}
        <section
          aria-label="Smart City Traffic Operations Control Room"
          className="w-full lg:w-[48%] flex justify-center lg:justify-end"
        >
          <div className="w-full max-w-[560px] lg:max-w-none aspect-[4/3] sm:aspect-[16/11] lg:aspect-[10/9] lg:max-h-[620px] rounded-2xl overflow-hidden border border-[#303640]/80 bg-[#1C1F25] shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
            <img
              src={controlRoomImg}
              alt="Municipal smart city traffic control center displaying multi-screen highway feeds and live urban road congestion map"
              className="w-full h-full object-cover object-center select-none"
              loading="eager"
              decoding="async"
            />
          </div>
        </section>
      </main>
    </div>
  );
};

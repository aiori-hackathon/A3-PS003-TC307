import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import {
  Settings as SettingsIcon,
  Languages,
  Sun,
  Moon,
  Laptop,
  CheckCircle2,
  Sliders,
  Eye,
} from "lucide-react";
import { PageHeroHeader } from "../components/common/DesignSystem";

export const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { language, setLanguage, isHindi } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [defaultHorizon, setDefaultHorizon] = useState<number>(30);
  const [largeText, setLargeText] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeroHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-[#9AC2FA]">
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>{isHindi ? "प्लेटफ़ॉर्म प्राथमिकताएँ" : "Platform Preferences"}</span>
          </span>
        }
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
      />

      {/* Success Notification */}
      {savedSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold">
            {isHindi ? "सेटिंग्स सफलतापूर्वक सहेजी गईं!" : "Settings saved successfully!"}
          </span>
        </div>
      )}

      {/* 1. Language Settings */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] space-y-4">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm sm:text-base">
          <Languages className="w-4 h-4 text-blue-500 dark:text-[#9AC2FA]" />
          <h3 className="font-serif font-medium text-base sm:text-lg">{t("settings.language_title")}</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setLanguage("en")}
            className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
              language === "en"
                ? "bg-blue-50 dark:bg-[#9AC2FA]/12 border-blue-600 dark:border-[#9AC2FA]/50 ring-2 ring-blue-500/20 dark:ring-[#9AC2FA]/20"
                : "bg-slate-50 dark:bg-[#161920] border-slate-200 dark:border-white/[0.08] hover:dark:bg-[#1B1D22]"
            }`}
          >
            <div>
              <span className="font-bold text-sm text-slate-900 dark:text-white block">English</span>
              <span className="text-xs text-slate-500 dark:text-[#8E939E]">United States / International</span>
            </div>
            {language === "en" && <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-[#9AC2FA]" />}
          </button>

          <button
            onClick={() => setLanguage("hi")}
            className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between font-sans cursor-pointer ${
              language === "hi"
                ? "bg-blue-50 dark:bg-[#9AC2FA]/12 border-blue-600 dark:border-[#9AC2FA]/50 ring-2 ring-blue-500/20 dark:ring-[#9AC2FA]/20"
                : "bg-slate-50 dark:bg-[#161920] border-slate-200 dark:border-white/[0.08] hover:dark:bg-[#1B1D22]"
            }`}
          >
            <div>
              <span className="font-bold text-sm text-slate-900 dark:text-white block">हिंदी (Hindi)</span>
              <span className="text-xs text-slate-500 dark:text-[#8E939E]">संपूर्ण इंटरफ़ेस और AI चैट</span>
            </div>
            {language === "hi" && <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-[#9AC2FA]" />}
          </button>
        </div>
      </div>

      {/* 2. Theme Appearance */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] space-y-4">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm sm:text-base">
          <Sun className="w-4 h-4 text-amber-500" />
          <h3 className="font-serif font-medium text-base sm:text-lg">{t("settings.theme_title")}</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => setTheme("light")}
            className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              theme === "light"
                ? "bg-blue-50 dark:bg-[#9AC2FA]/12 border-blue-600 dark:border-[#9AC2FA]/50 ring-2 ring-blue-500/20 dark:ring-[#9AC2FA]/20"
                : "bg-slate-50 dark:bg-[#161920] border-slate-200 dark:border-white/[0.08] hover:dark:bg-[#1B1D22]"
            }`}
          >
            <Sun className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-xs text-slate-900 dark:text-white">
              {t("settings.theme_light")}
            </span>
          </button>

          <button
            onClick={() => setTheme("dark")}
            className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              theme === "dark"
                ? "bg-blue-50 dark:bg-[#9AC2FA]/12 border-blue-600 dark:border-[#9AC2FA]/50 ring-2 ring-blue-500/20 dark:ring-[#9AC2FA]/20"
                : "bg-slate-50 dark:bg-[#161920] border-slate-200 dark:border-white/[0.08] hover:dark:bg-[#1B1D22]"
            }`}
          >
            <Moon className="w-4 h-4 text-blue-400 dark:text-[#9AC2FA]" />
            <span className="font-semibold text-xs text-slate-900 dark:text-white">
              {t("settings.theme_dark")}
            </span>
          </button>

          <button
            onClick={() => setTheme("system")}
            className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              theme === "system"
                ? "bg-blue-50 dark:bg-[#9AC2FA]/12 border-blue-600 dark:border-[#9AC2FA]/50 ring-2 ring-blue-500/20 dark:ring-[#9AC2FA]/20"
                : "bg-slate-50 dark:bg-[#161920] border-slate-200 dark:border-white/[0.08] hover:dark:bg-[#1B1D22]"
            }`}
          >
            <Laptop className="w-4 h-4 text-slate-500 dark:text-[#C5C8D0]" />
            <span className="font-semibold text-xs text-slate-900 dark:text-white">
              {t("settings.theme_system")}
            </span>
          </button>
        </div>
      </div>

      {/* 3. Dashboard Preferences */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] space-y-4">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm sm:text-base">
          <Sliders className="w-4 h-4 text-blue-500 dark:text-[#9AC2FA]" />
          <h3 className="font-serif font-medium text-base sm:text-lg">{t("settings.preferences_title")}</h3>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-800 dark:text-[#C5C8D0] block mb-1">
              {t("settings.default_city")}
            </label>
            <input
              type="text"
              readOnly
              value={isHindi ? "दिल्ली एनसीआर (स्मार्ट जोन)" : "Delhi NCR (Smart Urban Zone)"}
              className="w-full sm:w-80 px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] text-slate-600 dark:text-[#C5C8D0] font-medium cursor-not-allowed"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-800 dark:text-[#C5C8D0] block mb-1">
              {t("settings.default_horizon")}
            </label>
            <select
              value={defaultHorizon}
              onChange={(e) => setDefaultHorizon(Number(e.target.value))}
              className="w-full sm:w-80 px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#9AC2FA]"
            >
              <option value="15">15 {t("common.minutes")}</option>
              <option value="30">30 {t("common.minutes")}</option>
              <option value="60">60 {t("common.minutes")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Accessibility */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] space-y-4">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm sm:text-base">
          <Eye className="w-4 h-4 text-purple-500 dark:text-[#9AC2FA]" />
          <h3 className="font-serif font-medium text-base sm:text-lg">{t("settings.accessibility_title")}</h3>
        </div>

        <div className="space-y-3 text-xs">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={largeText}
              onChange={(e) => setLargeText(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 dark:accent-[#9AC2FA] focus:ring-blue-500 dark:focus:ring-[#9AC2FA]"
            />
            <span className="text-slate-700 dark:text-[#E8EAEE] font-medium">
              {t("settings.large_text")}
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 dark:accent-[#9AC2FA] focus:ring-blue-500 dark:focus:ring-[#9AC2FA]"
            />
            <span className="text-slate-700 dark:text-[#E8EAEE] font-medium">
              {t("settings.reduced_motion")}
            </span>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-2 flex justify-end">
        <button
          onClick={handleSave}
          className="px-6 py-2.5 rounded-xl bg-blue-600 dark:bg-[#9AC2FA] hover:bg-blue-700 dark:hover:bg-[#B2D1FC] text-white dark:text-[#0A0D14] font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
        >
          {t("common.save")}
        </button>
      </div>
    </div>
  );
};

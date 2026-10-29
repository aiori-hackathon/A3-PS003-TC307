import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import {
  Menu,
  Languages,
  Sun,
  Moon,
  Bell,
  Search,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Shield,
  Settings as SettingsIcon,
} from "lucide-react";

interface NavbarProps {
  onMenuClick: () => void;
  isCollapsed: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onMenuClick, isCollapsed }) => {
  const { t } = useTranslation();
  const { language, setLanguage, isHindi } = useLanguage();
  const { isDark, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [timeStr, setTimeStr] = useState<string>("");
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case "admin":
      case "system_admin":
        return isHindi ? "सिस्टम प्रशासक (Admin)" : "System Administrator";
      case "authority":
      case "traffic_controller":
        return isHindi ? "ट्रैफिक अथॉरिटी" : "Traffic Authority";
      case "citizen":
        return isHindi ? "नागरिक (Citizen)" : "Citizen Commuter";
      case "traffic_analyst":
        return isHindi ? "डेटा विश्लेषक" : "Traffic Analyst";
      case "field_officer":
        return isHindi ? "फील्ड अधिकारी" : "Field Officer";
      default:
        return isHindi ? "नागरिक (Citizen)" : "Citizen Commuter";
    }
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
    navigate("/login");
  };

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const cleanFullName = user?.full_name
    ? user.full_name.replace(/\s*\((?:Demo|डेमो)\)/gi, "").replace(/\bDemo\b/gi, "").trim()
    : "";

  const initials = cleanFullName
    ? cleanFullName
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "NX";

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString(isHindi ? "hi-IN" : "en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [isHindi]);

  return (
    <header
      className={`sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-all duration-300
        ${isCollapsed ? "lg:ml-20" : "lg:ml-64"}
      `}
    >
      {/* Left: Mobile hamburger + Region Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Municipal Region Dropdown */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
          <MapPin className="w-3.5 h-3.5 text-blue-500" />
          <span>{isHindi ? "दिल्ली एनसीआर (स्मार्ट जोन)" : "Delhi NCR (Smart Urban Zone)"}</span>
        </div>
      </div>

      {/* Center: Search (optional desktop) */}
      <div className="hidden xl:flex items-center relative w-64">
        <Search className="w-4 h-4 absolute left-3 text-slate-400" />
        <input
          type="text"
          placeholder={isHindi ? "चौराहा या सेंसर खोजें..." : "Search intersections, sensors..."}
          className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Right: Timestamp, Language, Theme, Notifications */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Live Clock */}
        <div className="hidden xs:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{timeStr}</span>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setLanguage("en")}
            className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
              language === "en"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-blue-500"
            }`}
            title="Switch to English"
          >
            EN
          </button>
          <button
            onClick={() => setLanguage("hi")}
            className={`px-2 py-1 rounded text-xs font-semibold transition-all font-sans ${
              language === "hi"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-blue-500"
            }`}
            title="हिंदी में बदलें"
          >
            हिंदी
          </button>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 relative transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-3 z-50 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 font-semibold text-slate-800 dark:text-slate-200">
                <span>{isHindi ? "सिस्टम सूचनाएं" : "System Notifications"}</span>
                <span className="text-[10px] text-blue-500">2 New</span>
              </div>
              <div className="py-2 space-y-2">
                <div className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {isHindi ? "धौला कुआँ पर अचानक ट्रैफिक वृद्धि" : "Sudden Surge at Dhaula Kuan"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {isHindi ? "वॉल्यूम 42% बढ़ा — FL सिंक ट्रिगर" : "+42% volume — Event FL triggered"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {isHindi ? "फेडरेटेड राउंड 6 सफलतापूर्वक पूरा" : "FedAvg Round 6 Aggregated"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {isHindi ? "परीक्षण MAE: 18.4, 91% बैंडविड्थ बचत" : "Test MAE: 18.4, 91% bandwidth saved"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown Menu */}
        <div className="relative pl-2 border-l border-slate-200 dark:border-slate-700" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
            aria-label="User menu"
            aria-expanded={showUserMenu}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-blue-500/20 ring-2 ring-blue-500/30">
              {initials}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate max-w-[110px]">
                {cleanFullName || "TrafficFL Officer"}
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium leading-none">
                {user?.role === "admin" || user?.role === "system_admin" ? (isHindi ? "एडमिन" : "Admin") : user?.role === "citizen" ? (isHindi ? "नागरिक" : "Citizen") : (isHindi ? "अथॉरिटी" : "Authority")}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* User Menu Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* User details header */}
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow">
                    {initials}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {cleanFullName || "TrafficFL Officer"}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {user?.email || "officer@trafficfl.gov.in"}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <Shield className="w-3 h-3" />
                    {getRoleLabel(user?.role)}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {user?.municipality || "Delhi NCR"}
                  </span>
                </div>
              </div>

              {/* Navigation items */}
              <div className="py-1">
                <Link
                  to="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
                >
                  <SettingsIcon className="w-4 h-4 text-slate-400" />
                  <span>{isHindi ? "खाता और सेटिंग्स" : "Account & Settings"}</span>
                </Link>
                <Link
                  to="/privacy"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
                >
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span>{isHindi ? "गोपनीयता अनुपालन" : "Privacy Compliance"}</span>
                </Link>
              </div>

              {/* Sign out */}
              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{isHindi ? "साइन आउट करें" : "Sign Out"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

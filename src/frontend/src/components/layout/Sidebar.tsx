import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  MapPin,
  TrendingUp,
  Bot,
  Cpu,
  Zap,
  Network,
  AlertTriangle,
  GitFork,
  BarChart3,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  Radio,
  X,
  Home,
  Compass,
} from "lucide-react";

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  setIsCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const { t } = useTranslation();
  const { isHindi } = useLanguage();
  const { user } = useAuth();

  const isCitizen = (user?.role || "citizen").toLowerCase() === "citizen";

  const citizenNavItems: NavItem[] = [
    { to: "/citizen", icon: Home, label: isHindi ? "नागरिक कम्यूट हब" : "Citizen Commute Hub" },
    { to: "/map", icon: MapPin, label: isHindi ? "लाइव ट्रैफिक मैप" : "Live Traffic Map" },
    { to: "/routes", icon: GitFork, label: isHindi ? "गलियारा यात्रा समय" : "Corridor Travel Times" },
    { to: "/assistant", icon: Bot, label: isHindi ? "एआई ट्रैफिक सहायक" : "AI Commute Helper" },
    { to: "/privacy", icon: ShieldCheck, label: isHindi ? "नागरिक डेटा अधिकार" : "Privacy & Data Rights" },
    { to: "/settings", icon: Settings, label: isHindi ? "प्राथमिकताएं" : "Preferences" },
  ];

  const adminNavItems: NavItem[] = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { to: "/citizen", icon: Compass, label: isHindi ? "नागरिक पोर्टल पूर्वावलोकन" : "Citizen Portal View", badge: "Live" },
    { to: "/map", icon: MapPin, label: t("nav.map") },
    { to: "/prediction", icon: TrendingUp, label: t("nav.prediction") },
    { to: "/assistant", icon: Bot, label: t("nav.assistant") },
    { to: "/federated", icon: Cpu, label: t("nav.federated") },
    { to: "/optimizer", icon: Zap, label: t("nav.optimizer"), badge: "Core" },
    { to: "/digital-twin", icon: Network, label: t("nav.digital_twin") },
    { to: "/incidents", icon: AlertTriangle, label: t("nav.incidents") },
    { to: "/routes", icon: GitFork, label: t("nav.routes") },
    { to: "/analytics", icon: BarChart3, label: t("nav.analytics") },
    { to: "/privacy", icon: ShieldCheck, label: t("nav.privacy") },
    { to: "/settings", icon: Settings, label: t("nav.settings") },
  ];

  const navItems = isCitizen ? citizenNavItems : adminNavItems;

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 transition-all duration-300 ease-in-out border-r border-slate-200 dark:border-slate-800 shadow-xl
          ${mobileOpen ? "translate-x-0 w-72" : "-translate-x-full"}
          lg:translate-x-0
          ${isCollapsed ? "lg:w-20" : "lg:w-64"}
        `}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-navy-900/90">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-md text-white font-bold shrink-0">
              <Radio className="w-5 h-5 animate-pulse text-white" />
            </div>
            {(!isCollapsed || mobileOpen) && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-lg text-slate-900 dark:text-white tracking-wide">
                  {t("brand.name")}
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">
                  {isCitizen ? "Citizen Commute Portal" : "Traffic Authority Portal"}
                </span>
              </div>
            )}
          </div>

          {/* Close on mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group relative
                  ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white"
                  }
                  ${isCollapsed && !mobileOpen ? "justify-center" : ""}
                `}
                title={isCollapsed && !mobileOpen ? item.label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
                {(!isCollapsed || mobileOpen) && (
                  <span className="truncate flex-1">{item.label}</span>
                )}
                {item.badge && (!isCollapsed || mobileOpen) && (
                  <span className="text-[10px] uppercase font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 dark:border-amber-500/40">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Footer & Collapse Toggle */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-navy-900/60">
          {/* Desktop collapse button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex w-full items-center justify-center p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse Navigation</span>
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

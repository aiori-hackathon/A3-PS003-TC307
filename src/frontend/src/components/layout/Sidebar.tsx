import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  MapPin,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Home,
  Compass,
  FileText,
  BarChart3,
  ShieldCheck,
  GitFork,
  Siren,
  Cpu,
} from "lucide-react";
import { TrafficFLMark } from "../common/TrafficFLMark";

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
  sectionId?: string;
  testId: string;
  group?: "operations" | "intelligence";
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
  const location = useLocation();

  const isCitizen = (user?.role || "citizen").toLowerCase() === "citizen";

  const citizenNavItems: NavItem[] = [
    { to: "/citizen", sectionId: "overview", testId: "citizen-hub", icon: Home, label: isHindi ? "अवलोकन" : "Overview" },
    { to: "/citizen?section=live_traffic", sectionId: "live_traffic", testId: "citizen-live-traffic", icon: MapPin, label: isHindi ? "लाइव ट्रैफिक" : "Live Traffic" },
    { to: "/citizen?section=routes", sectionId: "routes", testId: "citizen-routes", icon: GitFork, label: isHindi ? "स्मार्ट रूट्स" : "Smart Routes" },
    { to: "/citizen?section=alerts", sectionId: "alerts", testId: "citizen-alerts", icon: ShieldCheck, label: isHindi ? "ट्रैफिक अलर्ट" : "Alerts" },
    { to: "/citizen?section=complaints", sectionId: "complaints", testId: "citizen-complaints", icon: FileText, label: isHindi ? "शिकायतें" : "Complaints" },
    { to: "/citizen?section=sos", sectionId: "sos", testId: "citizen-sos", icon: Siren, label: isHindi ? "आपातकालीन SOS" : "Emergency SOS" },
    { to: "/citizen?section=awareness", sectionId: "awareness", testId: "citizen-awareness", icon: FileText, label: isHindi ? "ट्रैफिक जागरूकता" : "Traffic Awareness" },
    { to: "/map", testId: "map", icon: MapPin, label: isHindi ? "पूर्ण लाइव मैप" : "Full-Screen Map" },
    { to: "/assistant", testId: "assistant", icon: Bot, label: isHindi ? "एआई ट्रैफिक सहायक" : "AI Commute Helper" },
    { to: "/privacy", testId: "privacy", icon: ShieldCheck, label: isHindi ? "नागरिक डेटा अधिकार" : "Privacy & Data Rights" },
    { to: "/settings", testId: "settings", icon: Settings, label: isHindi ? "प्राथमिकताएं" : "Preferences" },
  ];

  // Organized 6-section Authority workspace navigation (Operations + Intelligence & Lab)
  const authorityNavItems: NavItem[] = [
    {
      to: "/dashboard",
      sectionId: "overview",
      testId: "overview",
      icon: LayoutDashboard,
      label: isHindi ? "कमांड अवलोकन" : "Overview",
      group: "operations",
    },
    {
      to: "/dashboard?section=live_map",
      sectionId: "live_map",
      testId: "live-map",
      icon: MapPin,
      label: isHindi ? "यातायात निगरानी" : "Traffic Monitoring",
      group: "operations",
    },
    {
      to: "/dashboard?section=complaints",
      sectionId: "complaints",
      testId: "complaints",
      icon: FileText,
      label: isHindi ? "नागरिक शिकायतें" : "Citizen Complaints",
      group: "operations",
    },
    {
      to: "/dashboard?section=emergency",
      sectionId: "emergency",
      testId: "emergency",
      icon: Siren,
      label: isHindi ? "आपातकालीन संचालन" : "Emergency Operations",
      group: "operations",
    },
    {
      to: "/dashboard?section=analytics",
      sectionId: "analytics",
      testId: "analytics",
      icon: BarChart3,
      label: isHindi ? "ट्रैफिक एनालिटिक्स" : "Analytics",
      group: "intelligence",
    },
    {
      to: "/federated",
      sectionId: "federated",
      testId: "federated",
      icon: Cpu,
      label: isHindi ? "फेडरेटेड लर्निंग लैब" : "Federated Learning Lab",
      group: "intelligence",
    },
  ];

  // Citizen Portal View as a separate distinct access option
  const citizenPortalItem: NavItem = {
    to: "/citizen",
    sectionId: "citizen-portal",
    testId: "citizen-portal",
    icon: Compass,
    label: isHindi ? "नागरिक पोर्टल देखें" : "Citizen Portal View",
    badge: "Live",
  };

  /**
   * Deterministic, single-item active matching.
   * Compares both URL path and exact section query parameter.
   * Prevents accidental partial or multiple-item blue highlighting.
   */
  const isItemActive = (item: NavItem): boolean => {
    const currentPath = location.pathname.replace(/\/+$/, "") || "/";
    const searchParams = new URLSearchParams(location.search);
    const rawSection = searchParams.get("section");
    // Normalize aliases: 'monitoring' and 'map' are live_map
    const currentSection =
      rawSection === "monitoring" || rawSection === "map" ? "live_map" : rawSection || "overview";

    // Citizen Portal sections (all under /citizen)
    if (
      item.sectionId &&
      item.sectionId !== "citizen-portal" &&
      (item.to === "/citizen" || item.to.startsWith("/citizen?"))
    ) {
      if (currentPath === "/citizen") {
        const citizenSection =
          rawSection === "complaints" || rawSection === "report"
            ? "complaints"
            : rawSection === "sos" || rawSection === "emergency"
            ? "sos"
            : rawSection === "live_traffic" || rawSection === "live-traffic"
            ? "live_traffic"
            : rawSection === "routes" || rawSection === "smart-routes"
            ? "routes"
            : rawSection === "alerts"
            ? "alerts"
            : rawSection === "awareness"
            ? "awareness"
            : "overview";
        return citizenSection === item.sectionId;
      }
      return false;
    }

    // Dedicated Federated Learning Lab workspace route
    if (item.sectionId === "federated") {
      return currentPath === "/federated";
    }

    // Authority dashboard sections (all under /dashboard)
    if (item.sectionId && (item.to.startsWith("/dashboard") || item.to === "/dashboard")) {
      if (currentPath === "/dashboard") {
        const normalizedSection =
          currentSection === "monitoring" || currentSection === "map" ? "live_map" : currentSection;
        return normalizedSection === item.sectionId;
      }
      // Route aliases if someone hits /live-map or /analytics directly
      if (item.sectionId === "live_map" && (currentPath === "/live-map" || currentPath === "/dashboard/map")) {
        return true;
      }
      if (item.sectionId === "analytics" && currentPath === "/analytics") {
        return true;
      }
      return false;
    }

    // Citizen Portal View link
    if (item.to === "/citizen") {
      return currentPath === "/citizen";
    }

    // Citizen standalone paths (exact path matching)
    return currentPath === item.to;
  };

  const primaryItems = isCitizen ? citizenNavItems : authorityNavItems;

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
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white dark:bg-[#0D0F14] text-slate-700 dark:text-[#C5C8D0] transition-all duration-300 ease-in-out border-r border-slate-200 dark:border-white/[0.07] shadow-xl dark:shadow-[4px_0_28px_rgba(0,0,0,0.55)]
          ${mobileOpen ? "translate-x-0 w-72" : "-translate-x-full"}
          lg:translate-x-0
          ${isCollapsed ? "lg:w-20" : "lg:w-64"}
        `}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-white/[0.07] bg-white/95 dark:bg-[#0D0F14]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50 dark:bg-[#161920] border border-blue-200/80 dark:border-white/[0.08] shrink-0">
              <TrafficFLMark size="sm" />
            </div>
            {(!isCollapsed || mobileOpen) && (
              <div className="flex flex-col truncate">
                <span className="font-serif font-medium text-[19px] leading-tight text-slate-900 dark:text-white tracking-[-0.01em]">
                  {t("brand.name")}
                </span>
                <span className="text-[10px] text-blue-600 dark:text-[#9AC2FA] font-medium uppercase tracking-wider mt-0.5">
                  {isCitizen ? "Citizen Commute Portal" : "Traffic Authority Portal"}
                </span>
              </div>
            )}
          </div>

          {/* Close on mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] lg:hidden cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 flex flex-col justify-between">
          {(() => {
            const renderNavItem = (item: NavItem) => {
              const Icon = item.icon;
              const active = isItemActive(item);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  data-testid={`sidebar-nav-${item.testId}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm group relative transition-colors
                    ${
                      active
                        ? "bg-blue-600 text-white dark:bg-[#9AC2FA]/[0.12] dark:text-[#9AC2FA] dark:border dark:border-[#9AC2FA]/25 font-semibold"
                        : "text-slate-600 dark:text-[#A3AAB8] hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white font-medium border border-transparent"
                    }
                    ${isCollapsed && !mobileOpen ? "justify-center" : ""}
                  `}
                  title={isCollapsed && !mobileOpen ? item.label : undefined}
                >
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                      active
                        ? "text-white dark:text-[#9AC2FA]"
                        : "text-slate-500 dark:text-[#7E8594] group-hover:text-slate-800 dark:group-hover:text-slate-200"
                    }`}
                  />
                  {(!isCollapsed || mobileOpen) && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {item.badge && (!isCollapsed || mobileOpen) && (
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                        active
                          ? "bg-white/20 dark:bg-[#9AC2FA]/15 text-white dark:text-[#9AC2FA] border-white/30 dark:border-[#9AC2FA]/30"
                          : "bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 dark:border-amber-500/30"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            };

            if (isCitizen) {
              return <div className="space-y-1">{primaryItems.map(renderNavItem)}</div>;
            }

            const opsItems = primaryItems.filter((item) => item.group === "operations");
            const intelItems = primaryItems.filter((item) => item.group === "intelligence");

            return (
              <div className="space-y-4">
                <div className="space-y-1">
                  {(!isCollapsed || mobileOpen) && (
                    <span className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#7A8191] block">
                      {isHindi ? "संचालन केंद्र" : "Operations"}
                    </span>
                  )}
                  {opsItems.map(renderNavItem)}
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-white/[0.06]">
                  {(!isCollapsed || mobileOpen) && (
                    <span className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#7A8191] block">
                      {isHindi ? "एनालिटिक्स एवं लैब" : "Intelligence & Lab"}
                    </span>
                  )}
                  {intelItems.map(renderNavItem)}
                </div>
              </div>
            );
          })()}

          {/* Citizen Portal View (Distinct Separate Access for Authority Users) */}
          {!isCitizen && (
            <div className="pt-3 border-t border-slate-200 dark:border-white/[0.07] mt-auto">
              {(!isCollapsed || mobileOpen) && (
                <span className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#7A8191] block">
                  {isHindi ? "पोर्टल स्विच" : "Public View"}
                </span>
              )}
              {(() => {
                const Icon = citizenPortalItem.icon;
                const active = isItemActive(citizenPortalItem);
                return (
                  <Link
                    to={citizenPortalItem.to}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    data-testid={`sidebar-nav-${citizenPortalItem.testId}`}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm group relative transition-colors
                      ${
                        active
                          ? "bg-blue-600 text-white dark:bg-[#9AC2FA]/[0.12] dark:text-[#9AC2FA] dark:border dark:border-[#9AC2FA]/25 font-semibold"
                          : "text-slate-600 dark:text-[#A3AAB8] hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white font-medium border border-transparent"
                      }
                      ${isCollapsed && !mobileOpen ? "justify-center" : ""}
                    `}
                    title={isCollapsed && !mobileOpen ? citizenPortalItem.label : undefined}
                  >
                    <Icon
                      className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                        active
                          ? "text-white dark:text-[#9AC2FA]"
                          : "text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-500"
                      }`}
                    />
                    {(!isCollapsed || mobileOpen) && (
                      <span className="truncate flex-1">{citizenPortalItem.label}</span>
                    )}
                    {citizenPortalItem.badge && (!isCollapsed || mobileOpen) && (
                      <span
                        className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${
                          active
                            ? "bg-white/20 dark:bg-[#9AC2FA]/15 text-white dark:text-[#9AC2FA] border-white/30 dark:border-[#9AC2FA]/30"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
                        }`}
                      >
                        {citizenPortalItem.badge}
                      </span>
                    )}
                  </Link>
                );
              })()}
            </div>
          )}
        </div>

        {/* Footer & Collapse Toggle */}
        <div className="p-3 border-t border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-[#0B0D11]">
          {/* Desktop collapse button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex w-full items-center justify-center p-2 rounded-lg text-slate-500 dark:text-[#8C93A4] hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
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

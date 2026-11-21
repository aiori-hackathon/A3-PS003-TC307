import React from "react";

export interface SectionTabItem {
  id: string;
  label: string;
  badge?: string | number;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SectionTabsProps {
  tabs: SectionTabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  testIdPrefix?: string;
  className?: string;
}

/**
 * Shared dark-TrafficFL pill/segmented tab bar for organizing complex workspaces
 * without stacking multiple large charts or parameter panels simultaneously.
 */
export const SectionTabs: React.FC<SectionTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  testIdPrefix = "section-tab",
  className = "",
}) => {
  return (
    <div
      role="tablist"
      className={`flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-slate-100 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] ${className}`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            data-testid={`${testIdPrefix}-${tab.id}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              isActive
                ? "bg-blue-600 text-white dark:bg-[#9AC2FA] dark:text-[#0A0D14] font-semibold shadow-xs"
                : "text-slate-600 dark:text-[#A3AAB8] hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-white/[0.04]"
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? "bg-white/20 dark:bg-[#0A0D14]/15 text-white dark:text-[#0A0D14]"
                    : "bg-slate-200 dark:bg-[#1B1D22] text-slate-600 dark:text-[#C5C8D0]"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

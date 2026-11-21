import React from "react";

/** Canonical dark/obsidian Recharts visual palette matching the TrafficFL smart-city design system. */
export const TFL_CHART_THEME = {
  gridStroke: "rgba(255, 255, 255, 0.08)",
  axisStroke: "#8C93A4",
  tooltipStyle: {
    backgroundColor: "#111318",
    border: "1px solid rgba(255, 255, 255, 0.14)",
    borderRadius: "0.75rem",
    color: "#F5F7FA",
    fontSize: "12px",
    boxShadow: "0 16px 36px rgba(0, 0, 0, 0.6)",
  } as React.CSSProperties,
  colors: {
    primary: "#9AC2FA",
    secondary: "#60A5FA",
    emerald: "#34D399",
    amber: "#FBBF24",
    rose: "#FB7185",
    violet: "#A78BFA",
  },
};

interface PageHeroHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/** Shared editorial header with serif title, concise subtitle, hairline separator, and right toolbar slot. */
export const PageHeroHeader: React.FC<PageHeroHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  actions,
  footer,
  className = "",
}) => (
  <div
    className={`rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] p-5 sm:p-6 ${className}`}
  >
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="space-y-1.5 min-w-0">
        {eyebrow && <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>}
        <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-[-0.015em] text-slate-900 dark:text-white leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#C5C8D0] leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
    {footer && (
      <div className="mt-4 pt-3.5 border-t border-slate-200 dark:border-white/[0.07]">
        {footer}
      </div>
    )}
  </div>
);

interface SurfaceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  elevated?: boolean;
}

/** Unified TrafficFL charcoal surface container with restrained border and elevation. */
export const SurfaceCard: React.FC<SurfaceCardProps> = ({
  children,
  elevated = false,
  className = "",
  ...rest
}) => (
  <div
    {...rest}
    className={`rounded-2xl border transition-colors duration-150 ${
      elevated
        ? "bg-slate-50 dark:bg-[#161920] border-slate-200 dark:border-white/[0.08]"
        : "bg-white dark:bg-[#111318] border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.42)]"
    } ${className}`}
  >
    {children}
  </div>
);

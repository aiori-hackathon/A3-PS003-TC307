import React from "react";

interface LoadingFallbackProps {
  variant?: "fullscreen" | "page" | "section";
  label?: string;
}

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
  variant = "page",
  label = "Loading view...",
}) => {
  const containerClass =
    variant === "fullscreen"
      ? "min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#090A0D] gap-3"
      : variant === "section"
        ? "min-h-[240px] w-full flex flex-col items-center justify-center rounded-2xl bg-white/90 dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] gap-2.5 p-6"
        : "min-h-[380px] w-full flex flex-col items-center justify-center gap-3 p-8";

  return (
    <div
      className={containerClass}
      role="status"
      aria-live="polite"
      data-testid={`lazy-loading-${variant}`}
    >
      <div className="w-8 h-8 border-2 border-blue-600 dark:border-[#9AC2FA] border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-medium text-slate-500 dark:text-[#8C93A4]">{label}</p>
    </div>
  );
};

import React from "react";

interface TrafficFLMarkProps {
  size?: "sm" | "md";
  className?: string;
}

/** Shared geometric multi-bar signal pulse emblem matching TrafficFL branding across auth and shell navigation. */
export const TrafficFLMark: React.FC<TrafficFLMarkProps> = ({ size = "md", className = "" }) => {
  const width = size === "sm" ? 22 : 26;
  const height = size === "sm" ? 18 : 22;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 26 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <rect x="0.5" y="13" width="2.6" height="6" rx="1.3" fill="#60A5FA" />
      <rect x="4.8" y="8" width="2.6" height="11" rx="1.3" fill="#7FB3FA" />
      <rect x="9.1" y="3" width="2.6" height="16" rx="1.3" fill="#9AC2FA" />
      <rect x="13.4" y="6.5" width="2.6" height="12.5" rx="1.3" fill="#7FB3FA" />
      <rect x="17.7" y="10.5" width="2.6" height="8.5" rx="1.3" fill="#60A5FA" />
      <rect x="22" y="14" width="2.6" height="5" rx="1.3" fill="#4B8DF8" />
    </svg>
  );
};

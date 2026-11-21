import React, { useState, useEffect } from "react";
import {
  X,
  Share2,
  Copy,
  Check,
  MessageCircle,
  ExternalLink,
  AlertCircle,
  Car,
  AlertTriangle,
  Smartphone,
} from "lucide-react";

export interface RouteShareData {
  type: "route";
  originName: string;
  destinationName: string;
  originId: string;
  destinationId: string;
  routeName?: string;
  estimatedTimeMinutes?: number | null;
  normalTimeMinutes?: number | null;
  delayMinutes?: number | null;
  distanceKm?: number;
  congestionLevel?: string;
}

export interface IncidentShareData {
  type: "incident";
  id?: string;
  incidentType: string;
  locationName: string;
  description: string;
  status?: string;
  severity?: string;
  actionRequired?: string;
}

export type ShareData = RouteShareData | IncidentShareData;

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ShareData | null;
}

export function buildRouteShareSummary(data: RouteShareData, shareUrl: string): { title: string; text: string } {
  const timeText =
    data.estimatedTimeMinutes != null && data.estimatedTimeMinutes > 0
      ? `${Math.round(data.estimatedTimeMinutes)} min${
          data.delayMinutes && data.delayMinutes > 0
            ? ` (Normal: ${Math.round(data.normalTimeMinutes || data.estimatedTimeMinutes - data.delayMinutes)} min, Delay: +${Math.round(data.delayMinutes)} min)`
            : ""
        }`
      : "Data unavailable";

  let statusText = "Live status on map";
  if (data.congestionLevel) {
    const cong = data.congestionLevel.toLowerCase();
    if (cong === "severe" || cong === "heavy") statusText = "Heavy Congestion";
    else if (cong === "moderate") statusText = "Moderate Traffic";
    else if (cong === "low" || cong === "free") statusText = "Free Flow";
    else statusText = data.congestionLevel;
  }

  const title = `TrafficFlow AI Route: ${data.originName} to ${data.destinationName}`;
  const text = [
    `🚗 My TrafficFlow AI Route`,
    ``,
    `From: ${data.originName}`,
    `To: ${data.destinationName}`,
    `Estimated Travel Time: ${timeText}`,
    `Traffic Status: ${statusText}`,
    data.distanceKm ? `Distance: ${data.distanceKm} km` : null,
    ``,
    `Check this route on TrafficFlow AI: ${shareUrl}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { title, text };
}

export function buildIncidentShareSummary(data: IncidentShareData, shareUrl: string): { title: string; text: string } {
  const formattedType = data.incidentType
    ? data.incidentType
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Road Incident";

  const title = `⚠️ Traffic Incident Alert: ${formattedType} at ${data.locationName}`;

  let statusLabel = "";
  if (data.status) {
    const s = data.status.toLowerCase();
    if (s === "unverified") statusLabel = "Pending Municipal Review";
    else if (s === "verified") statusLabel = "Verified by Authorities";
    else statusLabel = data.status;
  }

  const lines = [
    `⚠️ Traffic Incident Alert`,
    ``,
    `Type: ${formattedType}`,
    `Location: ${data.locationName}`,
    `Description: ${data.description}`,
    statusLabel ? `Status: ${statusLabel}${data.id ? ` (Ref: ${data.id})` : ""}` : data.id ? `Ref: ${data.id}` : null,
    data.actionRequired ? `Advised Action: ${data.actionRequired}` : null,
    ``,
    `Please check this location before travelling.`,
    ``,
    `Reported through TrafficFlow AI: ${shareUrl}`,
  ].filter((line) => line !== null) as string[];

  return { title, text: lines.join("\n") };
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, data }) => {
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setFeedback(null);
      setCopiedLink(false);
      setCopiedText(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  // Generate shareable URL
  const originUrl = typeof window !== "undefined" ? window.location.origin : "https://trafficfl-ai.vercel.app";
  let shareUrl = originUrl;
  let summary = { title: "", text: "" };

  if (data.type === "route") {
    const params = new URLSearchParams({
      origin: data.originId,
      destination: data.destinationId,
    });
    shareUrl = `${originUrl}/routes?${params.toString()}`;
    summary = buildRouteShareSummary(data, shareUrl);
  } else {
    const params = new URLSearchParams();
    if (data.id) params.set("incident", data.id);
    else params.set("incident", "report");
    shareUrl = `${originUrl}/citizen?${params.toString()}`;
    summary = buildIncidentShareSummary(data, shareUrl);
  }

  const supportsNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // Native share handler
  const handleNativeShare = async () => {
    setFeedback(null);
    if (!supportsNativeShare) {
      setFeedback({
        type: "error",
        message: "Native sharing is not supported by this browser. Use WhatsApp or Copy Link.",
      });
      return;
    }

    try {
      await navigator.share({
        title: summary.title,
        text: summary.text,
        url: shareUrl,
      });
      setFeedback({ type: "success", message: "Shared successfully!" });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setFeedback({ type: "error", message: "Sharing was not completed. You can copy the link below." });
      }
    }
  };

  // WhatsApp share handler
  const handleWhatsAppShare = () => {
    setFeedback(null);
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(summary.text)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setFeedback({ type: "success", message: "Opening WhatsApp share..." });
  };

  // Safe clipboard helper
  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.warn("navigator.clipboard failed, attempting fallback:", err);
    }

    // Fallback using textarea
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      return successful;
    } catch (fallbackErr) {
      console.error("Clipboard copy failed:", fallbackErr);
      return false;
    }
  };

  // Copy link handler
  const handleCopyLink = async () => {
    setFeedback(null);
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopiedLink(true);
      setFeedback({ type: "success", message: "Shareable link copied to clipboard!" });
      setTimeout(() => setCopiedLink(false), 2500);
    } else {
      setFeedback({ type: "error", message: "Unable to copy link to clipboard." });
    }
  };

  // Copy full message handler
  const handleCopySummary = async () => {
    setFeedback(null);
    const success = await copyToClipboard(summary.text);
    if (success) {
      setCopiedText(true);
      setFeedback({ type: "success", message: "Full summary text copied to clipboard!" });
      setTimeout(() => setCopiedText(false), 2500);
    } else {
      setFeedback({ type: "error", message: "Unable to copy summary to clipboard." });
    }
  };

  return (
    <div
      data-testid="share-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Share modal dialog"
      className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="share-modal-container"
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.08] flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-[#161920]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-[#9AC2FA]/10 border border-blue-200 dark:border-[#9AC2FA]/25 text-blue-600 dark:text-[#9AC2FA] flex items-center justify-center">
              {data.type === "route" ? <Car className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-serif text-base font-medium text-slate-900 dark:text-white">
                {data.type === "route" ? "Share Route" : "Share Incident Alert"}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#8E939E]">
                1-Click TrafficFlow AI Commuter Sharing
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="share-modal-close-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1B1D22] transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Status Feedback Notification */}
          {feedback && (
            <div
              data-testid="share-feedback-msg"
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                feedback.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                  : "bg-red-50 dark:bg-red-950/35 border border-red-300 dark:border-red-500/30 text-red-800 dark:text-red-300"
              }`}
            >
              {feedback.type === "success" ? (
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Share Preview Card */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#8E939E] block font-mono">
              Message Preview
            </span>
            <div
              data-testid="share-preview-card"
              className="p-4 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-800 dark:text-[#E8EAEE] font-sans whitespace-pre-line leading-relaxed"
            >
              {summary.text}
            </div>
          </div>

          {/* Shareable Link Box */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#8E939E] block font-mono">
              Shareable Web Link
            </span>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] text-xs">
              <input
                data-testid="share-link-input"
                type="text"
                readOnly
                value={shareUrl}
                className="bg-transparent text-slate-700 dark:text-[#C5C8D0] w-full outline-none font-mono text-[11px] truncate"
              />
              <button
                type="button"
                data-testid="share-copy-link-btn"
                onClick={handleCopyLink}
                className="p-2 rounded-lg bg-white dark:bg-[#111318] hover:bg-slate-50 dark:hover:bg-[#22252C] text-slate-700 dark:text-[#E8EAEE] border border-slate-200 dark:border-white/[0.10] shrink-0 transition-all cursor-pointer"
                title="Copy Link to Clipboard"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            {/* WhatsApp 1-Click Share */}
            <button
              type="button"
              data-testid="share-whatsapp-btn"
              onClick={handleWhatsAppShare}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-white text-transparent" />
              <span>Share on WhatsApp</span>
            </button>

            {/* Native Browser Share */}
            <button
              type="button"
              data-testid="share-native-btn"
              onClick={handleNativeShare}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 dark:bg-[#9AC2FA] hover:bg-blue-700 dark:hover:bg-[#B2D1FC] text-white dark:text-[#0A0D14] font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>{supportsNativeShare ? "Share via Apps" : "Share via Browser"}</span>
            </button>

            {/* Copy Full Text */}
            <button
              type="button"
              data-testid="share-copy-text-btn"
              onClick={handleCopySummary}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1B1D22] dark:hover:bg-[#22252C] text-slate-800 dark:text-[#E8EAEE] font-bold text-xs border border-slate-200 dark:border-white/[0.10] transition-all cursor-pointer"
            >
              {copiedText ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span>{copiedText ? "Summary Copied!" : "Copy Summary Text"}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1B1D22] dark:hover:bg-[#22252C] text-slate-600 dark:text-[#C5C8D0] font-bold text-xs border border-slate-200 dark:border-white/[0.10] transition-all cursor-pointer"
            >
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

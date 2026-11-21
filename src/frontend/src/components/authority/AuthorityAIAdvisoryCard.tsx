import React, { useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  Siren,
  CloudRain,
  Compass,
  ArrowRight,
  Eye,
  Volume2,
  VolumeX,
  Radio,
  Clock,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  GitFork,
  Send,
  History,
  ShieldAlert,
} from "lucide-react";
import { MunicipalAdvisory } from "../../services/advisoryEngine";

interface AuthorityAIAdvisoryCardProps {
  advisories: MunicipalAdvisory[];
  onViewOnLiveMap: (advisory: MunicipalAdvisory) => void;
  onOpenDetails: (advisory: MunicipalAdvisory) => void;
  onCompareRoutes: (advisory: MunicipalAdvisory) => void;
  onBroadcastAdvisory: (advisory: MunicipalAdvisory) => void;
  onDismissAdvisory: (advisoryId: string) => void;
  onOpenHistory: () => void;
  onSpeakAdvisory?: (text: string) => void;
  isVoiceActive?: boolean;
}

export const AuthorityAIAdvisoryCard: React.FC<AuthorityAIAdvisoryCardProps> = ({
  advisories,
  onViewOnLiveMap,
  onOpenDetails,
  onCompareRoutes,
  onBroadcastAdvisory,
  onDismissAdvisory,
  onOpenHistory,
  onSpeakAdvisory,
  isVoiceActive = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  if (!advisories || advisories.length === 0) {
    return null;
  }

  // Ensure index is within range
  const safeIndex = Math.min(currentIndex, advisories.length - 1);
  const currentAdvisory = advisories[safeIndex];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % advisories.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + advisories.length) % advisories.length);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return {
          bg: "bg-rose-500/10 text-rose-300 border-rose-500/30",
          dot: "bg-rose-400",
          label: "CRITICAL PRIORITY",
        };
      case "high":
        return {
          bg: "bg-orange-500/10 text-orange-300 border-orange-500/30",
          dot: "bg-orange-400",
          label: "HIGH PRIORITY",
        };
      case "medium":
        return {
          bg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
          dot: "bg-amber-400",
          label: "MEDIUM PRIORITY",
        };
      case "low":
      default:
        return {
          bg: "bg-[#9AC2FA]/10 text-[#9AC2FA] border-[#9AC2FA]/25",
          dot: "bg-[#9AC2FA]",
          label: "NORMAL MONITORING",
        };
    }
  };

  const getSituationIcon = (type: string) => {
    switch (type) {
      case "emergency_obstruction":
        return <Siren className="w-5 h-5 text-rose-400" />;
      case "waterlogging":
        return <CloudRain className="w-5 h-5 text-[#9AC2FA]" />;
      case "heavy_congestion":
      case "speed_drop":
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case "spillover_risk":
        return <GitFork className="w-5 h-5 text-[#60A5FA]" />;
      default:
        return <Sparkles className="w-5 h-5 text-[#9AC2FA]" />;
    }
  };

  const badge = getPriorityBadge(currentAdvisory.priority);

  const handleSpeech = () => {
    if (onSpeakAdvisory) {
      const speechText = `Municipal AI Advisory: ${currentAdvisory.title}. Observed: ${currentAdvisory.observation} Recommended Action: ${currentAdvisory.recommendation}`;
      onSpeakAdvisory(speechText);
    }
  };

  return (
    <div
      className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] space-y-3 relative overflow-hidden"
      data-testid="municipal-ai-advisory-card"
    >
      {/* Subtle Top Severity Hairline */}
      <div
        className={`absolute top-0 left-0 right-0 h-0.5 ${
          currentAdvisory.priority === "critical"
            ? "bg-rose-500/80"
            : currentAdvisory.priority === "high"
            ? "bg-amber-400/80"
            : "bg-[#9AC2FA]/60"
        }`}
      />

      {/* Header Row: Title, Priority Pill, Pagination & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200 dark:border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-[#161920] border border-blue-200 dark:border-white/[0.08] text-blue-600 dark:text-[#9AC2FA] flex items-center justify-center shrink-0">
            {getSituationIcon(currentAdvisory.situationType)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-serif text-base font-medium text-slate-900 dark:text-white tracking-[-0.01em]">
                Municipal AI Advisory
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${badge.bg}`}
                data-testid="advisory-priority-pill"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                <span>{badge.label}</span>
              </span>
              {currentAdvisory.confidenceScore !== undefined && (
                <span className="text-[10px] font-mono text-blue-700 dark:text-[#9AC2FA] px-2 py-0.5 rounded bg-blue-50 dark:bg-[#161920] border border-blue-200 dark:border-white/[0.08]">
                  {Math.round(currentAdvisory.confidenceScore * 100)}% Conf.
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#8C93A4] mt-0.5">
              {currentAdvisory.location.name} • {currentAdvisory.dataSource} •{" "}
              <span className="font-mono">
                {new Date(currentAdvisory.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </p>
          </div>
        </div>

        {/* Carousel pagination & History button */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {advisories.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#161920] px-2 py-1 rounded-lg border border-slate-200 dark:border-white/[0.08] text-xs">
              <button
                onClick={handlePrev}
                className="p-1 text-slate-500 dark:text-[#8C93A4] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Previous advisory"
                data-testid="advisory-prev-btn"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono font-semibold text-slate-700 dark:text-[#C5C8D0] px-1">
                {safeIndex + 1} / {advisories.length}
              </span>
              <button
                onClick={handleNext}
                className="p-1 text-slate-500 dark:text-[#8C93A4] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Next advisory"
                data-testid="advisory-next-btn"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Voice Speech Button */}
          {onSpeakAdvisory && (
            <button
              onClick={handleSpeech}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isVoiceActive
                  ? "bg-blue-600 dark:bg-[#9AC2FA] text-white dark:text-[#0A0D14] border-blue-500 dark:border-[#9AC2FA]"
                  : "bg-slate-100 dark:bg-[#161920] text-slate-600 dark:text-[#C5C8D0] border-slate-200 dark:border-white/[0.08] hover:text-blue-600 dark:hover:text-white"
              }`}
              title="Listen to recommendation readout"
              data-testid="advisory-speak-btn"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* History Button */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#161920] hover:bg-slate-200 dark:hover:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-[11px] font-medium text-slate-700 dark:text-[#C5C8D0] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="View Advisory History"
            data-testid="advisory-history-btn"
          >
            <History className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
            <span className="hidden md:inline">History</span>
          </button>
        </div>
      </div>

      {/* Main Advisory Content Body */}
      <div className="space-y-2.5">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white" data-testid="advisory-title">
          {currentAdvisory.title}
        </h4>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {/* Observation Box */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.07] space-y-1">
            <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-[#8C93A4] tracking-wider flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-blue-600 dark:text-[#60A5FA]" />
              <span>Observation</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-[#D1D5DB] leading-relaxed font-sans" data-testid="advisory-observation">
              {currentAdvisory.observation}
            </p>
          </div>

          {/* Recommendation Box */}
          <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-[#9AC2FA]/[0.06] border border-blue-200 dark:border-[#9AC2FA]/20 space-y-1">
            <div className="text-[10px] uppercase font-semibold text-blue-700 dark:text-[#9AC2FA] tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-blue-600 dark:text-[#9AC2FA]" />
              <span>Recommended Action</span>
            </div>
            <p className="text-xs text-slate-800 dark:text-[#F5F7FA] font-medium leading-relaxed" data-testid="advisory-recommendation">
              {currentAdvisory.recommendation}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="pt-2.5 border-t border-slate-200 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onViewOnLiveMap(currentAdvisory)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 dark:bg-[#9AC2FA] dark:hover:bg-[#B0D0FC] text-white dark:text-[#0A0D14] font-semibold text-xs transition-colors cursor-pointer"
            data-testid="advisory-view-map-btn"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>View on Live Map</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenDetails(currentAdvisory)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.03] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-700 dark:text-[#EAECEF] border border-slate-200 dark:border-white/[0.12] text-xs font-medium transition-colors cursor-pointer"
            data-testid="advisory-details-btn"
          >
            <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
            <span>Details</span>
          </button>

          {currentAdvisory.supportingData.alternateRoutePath && (
            <button
              type="button"
              onClick={() => onCompareRoutes(currentAdvisory)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.03] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-700 dark:text-[#EAECEF] border border-slate-200 dark:border-white/[0.12] text-xs font-medium transition-colors cursor-pointer"
              data-testid="advisory-compare-routes-btn"
            >
              <GitFork className="w-3.5 h-3.5 text-[#60A5FA]" />
              <span>Alternate Route</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onBroadcastAdvisory(currentAdvisory)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors cursor-pointer"
            data-testid="advisory-broadcast-btn"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Broadcast</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onDismissAdvisory(currentAdvisory.id)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-500 dark:text-[#8C93A4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] text-[11px] font-medium transition-colors cursor-pointer ml-auto"
          title="Dismiss advisory for this session"
          data-testid="advisory-dismiss-btn"
        >
          <X className="w-3 h-3" />
          <span>Dismiss</span>
        </button>
      </div>
    </div>
  );
};

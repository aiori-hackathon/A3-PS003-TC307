import React from "react";
import {
  Sparkles,
  AlertTriangle,
  Siren,
  CloudRain,
  Compass,
  ArrowRight,
  X,
  Radio,
  Clock,
  CheckCircle2,
  GitFork,
  Send,
  MapPin,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Gauge,
} from "lucide-react";
import { MunicipalAdvisory } from "../../services/advisoryEngine";

interface AuthorityAIAdvisoryDetailModalProps {
  advisory: MunicipalAdvisory | null;
  onClose: () => void;
  onViewOnLiveMap: (advisory: MunicipalAdvisory) => void;
  onCompareRoutes: (advisory: MunicipalAdvisory) => void;
  onBroadcastAdvisory: (advisory: MunicipalAdvisory) => void;
  onDismissAdvisory: (advisoryId: string) => void;
}

export const AuthorityAIAdvisoryDetailModal: React.FC<AuthorityAIAdvisoryDetailModalProps> = ({
  advisory,
  onClose,
  onViewOnLiveMap,
  onCompareRoutes,
  onBroadcastAdvisory,
  onDismissAdvisory,
}) => {
  if (!advisory) return null;

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return {
          bg: "bg-rose-500/15 text-rose-300 border-rose-500/40 ring-1 ring-rose-500/20",
          label: "CRITICAL PRIORITY",
        };
      case "high":
        return {
          bg: "bg-orange-500/15 text-orange-300 border-orange-500/40",
          label: "HIGH PRIORITY",
        };
      case "medium":
        return {
          bg: "bg-amber-500/15 text-amber-300 border-amber-500/40",
          label: "MEDIUM PRIORITY",
        };
      case "low":
      default:
        return {
          bg: "bg-blue-500/15 text-cyan-300 border-blue-500/40",
          label: "NORMAL MONITORING",
        };
    }
  };

  const badge = getPriorityBadge(advisory.priority);
  const data = advisory.supportingData;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      data-testid="authority-advisory-detail-modal"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#111318] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/70 dark:bg-[#161920]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#9AC2FA]/10 border border-blue-200 dark:border-[#9AC2FA]/25 text-blue-600 dark:text-[#9AC2FA] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                  {badge.label}
                </span>
                <span className="text-[10px] font-mono text-slate-400 dark:text-[#8E939E]">
                  ID: {advisory.id}
                </span>
              </div>
              <h3 className="text-base font-serif font-medium text-slate-900 dark:text-white mt-0.5" data-testid="detail-advisory-title">
                {advisory.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1B1D22] transition-colors cursor-pointer"
            data-testid="close-advisory-detail-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* SECTION 1: OBSERVED TELEMETRY FACTS (Separated from AI recommendations) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] space-y-2.5">
            <div className="flex items-center justify-between text-slate-500 dark:text-[#8E939E] pb-1 border-b border-slate-200 dark:border-white/[0.07]">
              <span className="font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 text-slate-700 dark:text-[#C5C8D0]">
                <Radio className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
                <span>Observed Telemetry & Field Facts</span>
              </span>
              <span className="text-[10px] text-slate-400 dark:text-[#8E939E]">Source: {advisory.dataSource}</span>
            </div>

            <p className="text-xs text-slate-800 dark:text-[#E8EAEE] leading-relaxed font-sans" data-testid="detail-advisory-observation">
              {advisory.observation}
            </p>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              {data.currentSpeed !== undefined && (
                <div className="p-2 rounded-xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08]">
                  <span className="text-[10px] text-slate-400 dark:text-[#8E939E] block">Monitored Speed</span>
                  <span className="font-bold text-blue-600 dark:text-[#9AC2FA] text-sm">
                    {data.currentSpeed} km/h
                  </span>
                </div>
              )}
              {data.freeFlowSpeed !== undefined && (
                <div className="p-2 rounded-xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08]">
                  <span className="text-[10px] text-slate-400 dark:text-[#8E939E] block">Free-Flow Speed</span>
                  <span className="font-bold text-slate-700 dark:text-[#C5C8D0] text-sm">
                    {data.freeFlowSpeed} km/h
                  </span>
                </div>
              )}
              {data.delaySeconds !== undefined && (
                <div className="p-2 rounded-xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08]">
                  <span className="text-[10px] text-slate-400 dark:text-[#8E939E] block">Corridor Delay</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                    +{data.delaySeconds}s
                  </span>
                </div>
              )}
              {data.congestionLevel && (
                <div className="p-2 rounded-xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08]">
                  <span className="text-[10px] text-slate-400 dark:text-[#8E939E] block">Congestion Tier</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 text-sm uppercase">
                    {data.congestionLevel}
                  </span>
                </div>
              )}
            </div>

            {/* Location & Timestamp details */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
              <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-cyan-500" />
                {advisory.location.name} [{advisory.location.intersectionId}] ({advisory.location.latitude.toFixed(4)}, {advisory.location.longitude.toFixed(4)})
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Generated: {new Date(advisory.timestamp).toLocaleString()}
              </span>
            </div>
          </div>

          {/* SECTION 2: AI DECISION SUPPORT RECOMMENDATION */}
          <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-2.5">
            <div className="flex items-center justify-between pb-1 border-b border-cyan-500/20 text-cyan-400 font-bold text-[10px] uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Municipal AI Decision Support Recommendation</span>
              </span>
              {advisory.confidenceScore !== undefined && (
                <span className="font-mono text-cyan-300">
                  {Math.round(advisory.confidenceScore * 100)}% Confidence
                </span>
              )}
            </div>

            <p className="text-xs text-cyan-900 dark:text-cyan-100 font-medium leading-relaxed" data-testid="detail-advisory-recommendation">
              {advisory.recommendation}
            </p>

            {/* Suggested Next Steps */}
            {advisory.suggestedNextSteps.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Suggested Operational Next Steps:
                </span>
                <ul className="space-y-1 pl-1 text-[11px] text-slate-700 dark:text-slate-300">
                  {advisory.suggestedNextSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="font-bold text-cyan-500 shrink-0">{idx + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* SECTION 3: RECOMMENDED ALTERNATE BYPASS ROUTE (if available) */}
          {data.alternateRoutePath && (
            <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between text-purple-400 font-bold text-[10px] uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <GitFork className="w-3.5 h-3.5 text-purple-400" />
                  <span>A* Smart Route Alternate Bypass</span>
                </span>
                {data.alternateTimeSavedMinutes && (
                  <span className="text-emerald-400 font-mono">
                    ~{data.alternateTimeSavedMinutes}m Delay Reduction
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-[#C5C8D0] font-sans">
                {data.alternateRouteName || "Candidate alternate arterial corridor"}:
              </p>
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-[#161920] font-mono text-xs text-blue-700 dark:text-[#9AC2FA] border border-slate-200 dark:border-white/[0.08]">
                {data.alternateRoutePath.join(" → ")}
              </div>
            </div>
          )}

          {/* Safety Notice Banner */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed opacity-90">
              <strong>OPERATIONAL PROTOCOL NOTICE:</strong> All recommendations are generated as advisory decision support. No automatic traffic signal control or physical route modifications occur without official authority review.
            </p>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#161920] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onViewOnLiveMap(advisory);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 dark:bg-[#9AC2FA] hover:bg-blue-700 dark:hover:bg-[#B2D1FC] text-white dark:text-[#0A0D14] font-bold text-xs shadow-xs transition-colors cursor-pointer"
              data-testid="detail-view-map-btn"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>View on Live Map</span>
            </button>

            {data.alternateRoutePath && (
              <button
                onClick={() => {
                  onClose();
                  onCompareRoutes(advisory);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-[#1B1D22] hover:bg-slate-300 dark:hover:bg-[#22252C] text-slate-800 dark:text-[#E8EAEE] text-xs font-semibold border border-slate-300 dark:border-white/[0.10] transition-colors cursor-pointer"
              >
                <GitFork className="w-3.5 h-3.5 text-purple-500 dark:text-[#9AC2FA]" />
                <span>Compare Alternate Route</span>
              </button>
            )}

            <button
              onClick={() => {
                onClose();
                onBroadcastAdvisory(advisory);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-xs font-semibold transition-colors cursor-pointer"
              data-testid="detail-broadcast-btn"
            >
              <Send className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>Broadcast Public Advisory</span>
            </button>
          </div>

          <button
            onClick={() => {
              onDismissAdvisory(advisory.id);
              onClose();
            }}
            className="px-3 py-1.5 rounded-xl text-slate-500 dark:text-[#8E939E] hover:text-slate-700 dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Dismiss Advisory
          </button>
        </div>
      </div>
    </div>
  );
};

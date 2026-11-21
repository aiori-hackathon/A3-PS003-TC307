import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { IncidentItem } from "../../types";

interface CitizenAlertsPanelProps {
  isHindi: boolean;
  incidents: IncidentItem[];
  loading: boolean;
  error: string | null;
  selectedIntersectionId?: string;
  selectedIntersectionName?: string;
  onRetry: () => void;
}

const ALERT_CATEGORIES = [
  { id: "all", label: "All", labelHi: "सभी" },
  { id: "congestion", label: "Congestion", labelHi: "भीड़/जाम" },
  { id: "road_closure", label: "Closures", labelHi: "मार्ग बंद" },
  { id: "accident", label: "Accidents", labelHi: "दुर्घटना" },
  { id: "other", label: "Disruptions", labelHi: "अन्य" },
];

const formatRelativeAge = (isoDate: string): string => {
  const ts = Date.parse(isoDate);
  if (Number.isNaN(ts)) return "";
  const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const hrs = Math.floor(diffMin / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const matchesCategory = (incidentType: string, filter: string): boolean => {
  if (filter === "all") return true;
  const normalized = (incidentType || "").toLowerCase();
  if (filter === "congestion") return normalized.includes("congestion") || normalized.includes("jam") || normalized.includes("surge");
  if (filter === "road_closure") return normalized.includes("closure") || normalized.includes("block");
  if (filter === "accident") return normalized.includes("accident") || normalized.includes("crash");
  return (
    !normalized.includes("congestion") &&
    !normalized.includes("jam") &&
    !normalized.includes("surge") &&
    !normalized.includes("closure") &&
    !normalized.includes("block") &&
    !normalized.includes("accident") &&
    !normalized.includes("crash")
  );
};

export const CitizenAlertsPanel: React.FC<CitizenAlertsPanelProps> = ({
  isHindi,
  incidents,
  loading,
  error,
  selectedIntersectionId,
  selectedIntersectionName,
  onRetry,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [nearAreaOnly, setNearAreaOnly] = useState<boolean>(false);
  const [liveOnly, setLiveOnly] = useState<boolean>(false);

  const visibleAlerts = useMemo(() => {
    return incidents.filter((inc) => {
      if (liveOnly && inc.is_simulated) return false;
      if (nearAreaOnly && selectedIntersectionId && inc.intersection_id !== selectedIntersectionId) {
        return false;
      }
      if (!matchesCategory(inc.incident_type, categoryFilter)) return false;
      return true;
    });
  }, [incidents, liveOnly, nearAreaOnly, selectedIntersectionId, categoryFilter]);

  return (
    <div
      className="p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-3"
      data-testid="citizen-alerts-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h2 className="font-serif font-medium text-base sm:text-lg text-slate-900 dark:text-white">
            {isHindi ? "व्यक्तिगत ट्रैफिक अलर्ट एवं सड़क सूचनाएं" : "Personalized Traffic Alerts & Warnings"}
          </h2>
        </div>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4]">
          {visibleAlerts.length} {isHindi ? "सक्रिय सूचना" : `Notice${visibleAlerts.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Category & Personalization Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-white/[0.07]">
        <div className="flex flex-wrap items-center gap-1.5">
          {ALERT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                categoryFilter === cat.id
                  ? "bg-blue-600 text-white dark:bg-[#9AC2FA] dark:text-[#0A0D14]"
                  : "bg-slate-100 dark:bg-[#1B1D22] text-slate-600 dark:text-[#C5C8D0] hover:bg-slate-200 dark:hover:bg-white/[0.08]"
              }`}
            >
              {isHindi ? cat.labelHi : cat.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {selectedIntersectionId && (
            <button
              type="button"
              onClick={() => setNearAreaOnly((v) => !v)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-semibold border transition-colors cursor-pointer ${
                nearAreaOnly
                  ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-[#9AC2FA]/15 dark:text-[#9AC2FA] dark:border-[#9AC2FA]/35"
                  : "bg-white dark:bg-[#1B1D22] text-slate-500 dark:text-[#8C93A4] border-slate-200 dark:border-white/[0.08]"
              }`}
              title={`Filter alerts near ${selectedIntersectionName || selectedIntersectionId}`}
            >
              <Filter className="w-3 h-3" />
              <span>{isHindi ? "मेरा क्षेत्र" : "Near Selected Area"}</span>
            </button>
          )}
          <label className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={liveOnly}
              onChange={(e) => setLiveOnly(e.target.checked)}
              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300"
            />
            <span>{isHindi ? "ड्रिल छिपाएं" : "Live/Verified Only"}</span>
          </label>
        </div>
      </div>

      {/* Honest Error / Loading / Populated / Genuine Empty States */}
      {error ? (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200 flex items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {isHindi ? "ट्रैफिक अलर्ट डेटा उपलब्ध नहीं है" : "Real-time Alerts Feed Unavailable"}
              </p>
              <p className="mt-0.5 text-[11px] opacity-90">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] inline-flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      ) : loading && incidents.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
          <span>{isHindi ? "सक्रिय ट्रैफिक अलर्ट लोड हो रहे हैं..." : "Checking active traffic incidents..."}</span>
        </div>
      ) : visibleAlerts.length > 0 ? (
        <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
          {visibleAlerts.map((inc) => {
            const isCritical = inc.severity === "critical";
            const isInfo = inc.severity === "info";
            const ageLabel = formatRelativeAge(inc.created_at);
            return (
              <details
                key={inc.id}
                className={`group rounded-xl border transition-colors bg-slate-50/70 dark:bg-[#161920] border-slate-200 dark:border-white/[0.08] overflow-hidden border-l-[3px] ${
                  isCritical
                    ? "border-l-rose-500"
                    : isInfo
                    ? "border-l-blue-500 dark:border-l-[#9AC2FA]"
                    : "border-l-amber-500"
                }`}
                data-testid={`citizen-alert-item-${inc.id}`}
              >
                <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer p-3.5 flex items-start justify-between gap-3 hover:bg-slate-100/70 dark:hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <AlertCircle
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        isCritical
                          ? "text-rose-500"
                          : isInfo
                          ? "text-blue-500 dark:text-[#9AC2FA]"
                          : "text-amber-500"
                      }`}
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            isCritical
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                              : isInfo
                              ? "bg-blue-500/15 text-blue-700 dark:text-[#9AC2FA] border border-blue-500/30 dark:border-[#9AC2FA]/30"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {inc.severity}
                        </span>
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 dark:text-[#8C93A4]">
                          {inc.incident_type.replace(/_/g, " ")}
                        </span>
                        {inc.is_simulated && (
                          <span className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            Drill
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-[#8C93A4] shrink-0" />
                        <span className="truncate">
                          {isHindi ? inc.intersection_name_hi : inc.intersection_name}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {ageLabel && (
                      <span className="text-[10px] font-mono text-slate-500 dark:text-[#8C93A4] inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {ageLabel}
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-[#9AC2FA] group-open:hidden">
                      {isHindi ? "विवरण देखें" : "View Details"}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4] hidden group-open:inline">
                      {isHindi ? "छिपाएं" : "Hide"}
                    </span>
                  </div>
                </summary>

                <div className="px-4 pb-3.5 pt-2.5 border-t border-slate-200/70 dark:border-white/[0.07] space-y-2.5 text-xs bg-white/70 dark:bg-[#111318]">
                  <p className="text-slate-700 dark:text-[#C5C8D0] leading-relaxed">
                    {isHindi ? inc.description_hi : inc.description_en}
                  </p>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#161920] border border-slate-200/70 dark:border-white/[0.07] text-[11px] text-slate-700 dark:text-[#C5C8D0]">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {isHindi ? "सुझाव: " : "Recommended Action: "}
                    </span>
                    {isHindi ? inc.recommended_action_hi : inc.recommended_action_en}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-[#8C93A4]">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#1B1D22] font-semibold text-slate-700 dark:text-[#C5C8D0]">
                        {inc.is_simulated
                          ? "Simulated Drill"
                          : inc.source === "live_provider"
                          ? "Live Incident"
                          : "Authority Advisory"}
                      </span>
                      <span className="font-mono">
                        {new Date(inc.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <Link
                      to="/citizen?section=routes"
                      className="text-[11px] font-semibold text-blue-600 dark:text-[#9AC2FA] hover:underline"
                    >
                      {isHindi ? "वैकल्पिक मार्ग देखें →" : "Check Alternate Routes →"}
                    </Link>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-center space-y-1.5">
          <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
          <h3 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
            {isHindi ? "कोई सक्रिय सड़क बाधा अलर्ट नहीं" : "No Matching Active Incidents"}
          </h3>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 max-w-sm mx-auto">
            {nearAreaOnly || categoryFilter !== "all" || liveOnly
              ? isHindi
                ? "वर्तमान फ़िल्टर के लिए कोई सक्रिय अलर्ट नहीं मिला।"
                : "No incidents match your selected filter criteria."
              : isHindi
              ? "वर्तमान में मॉनिटर किए गए गलियारों में कोई सड़क बंदी या बड़ी दुर्घटना दर्ज नहीं है।"
              : "No active road closures, accidents, or severe disruptions are currently reported."}
          </p>
        </div>
      )}

      {/* Quick Helpful Links */}
      <div className="pt-3 border-t border-slate-100 dark:border-white/[0.07] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <Link
          to="/assistant"
          className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200/70 dark:border-white/[0.08] flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-[#1B1D22] transition-colors"
        >
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-[#9AC2FA] shrink-0" />
          <div>
            <span className="font-semibold text-slate-800 dark:text-white block">AI Commute Helper</span>
            <span className="text-[10px] text-slate-400 dark:text-[#8C93A4]">Ask traffic questions</span>
          </div>
        </Link>

        <Link
          to="/privacy"
          className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200/70 dark:border-white/[0.08] flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-[#1B1D22] transition-colors"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <div>
            <span className="font-semibold text-slate-800 dark:text-white block">Citizen Privacy</span>
            <span className="text-[10px] text-slate-400 dark:text-[#8C93A4]">Data protection rights</span>
          </div>
        </Link>
      </div>
    </div>
  );
};

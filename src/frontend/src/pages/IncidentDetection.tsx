import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../services/api";
import {
  AlertTriangle,
  Flame,
  TrendingDown,
  Clock,
  CheckCircle,
  Filter,
  Check,
  CheckCheck,
  MapPin,
  ShieldAlert,
  Sliders,
  Zap,
  Network,
  RefreshCw,
} from "lucide-react";
import { PageHeroHeader } from "../components/common/DesignSystem";
import { IncidentItem, IncidentEvaluationResponse } from "../types";

export const IncidentDetection: React.FC = () => {
  const { t } = useTranslation();
  const { isHindi } = useLanguage();

  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Early warning configurable thresholds
  const [tauV, setTauV] = useState<number>(0.75);
  const [tauS, setTauS] = useState<number>(20.0);
  const [evaluation, setEvaluation] = useState<IncidentEvaluationResponse | null>(null);
  const [evalLoading, setEvalLoading] = useState<boolean>(false);

  const fetchIncidents = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await api.getIncidents(
        severityFilter !== "all" ? severityFilter : undefined,
        statusFilter !== "all" ? statusFilter : undefined
      );
      setIncidents(res);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      if (showRefresh) setRefreshing(false);
    }
  };

  const handleEvaluate = async () => {
    setEvalLoading(true);
    try {
      const res = await api.evaluateIncidents({
        volume_capacity_threshold: tauV,
        speed_threshold_kmh: tauS,
      });
      setEvaluation(res);
    } catch (err) {
      console.error(err);
    } finally {
      setEvalLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    handleEvaluate();
    const interval = setInterval(() => {
      fetchIncidents();
    }, 30000);
    return () => clearInterval(interval);
  }, [severityFilter, statusFilter]);

  const handleUpdateStatus = async (id: string, newStatus: "acknowledged" | "resolved") => {
    try {
      await api.updateIncidentStatus(id, newStatus);
      await fetchIncidents();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <PageHeroHeader
        eyebrow="Proactive Early Warnings"
        title={t("incidents.title")}
        subtitle={t("incidents.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Severity */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-[#8C93A4]" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-white focus:outline-none font-medium"
              >
                <option value="all" className="dark:bg-[#161920]">{isHindi ? "सभी गंभीरता (All Severities)" : "All Severities"}</option>
                <option value="critical" className="dark:bg-[#161920]">{t("common.critical")}</option>
                <option value="warning" className="dark:bg-[#161920]">{t("common.warning")}</option>
                <option value="info" className="dark:bg-[#161920]">{t("common.info")}</option>
              </select>
            </div>

            {/* Status */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] text-xs">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-white focus:outline-none font-medium"
              >
                <option value="all" className="dark:bg-[#161920]">{isHindi ? "सभी स्थितियां (All Statuses)" : "All Statuses"}</option>
                <option value="open" className="dark:bg-[#161920]">{t("common.open")}</option>
                <option value="acknowledged" className="dark:bg-[#161920]">{t("common.acknowledged")}</option>
                <option value="resolved" className="dark:bg-[#161920]">{t("common.resolved")}</option>
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchIncidents(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] text-slate-700 dark:text-[#E8EAEE] hover:bg-slate-50 dark:hover:bg-[#232730] text-xs font-medium transition-all cursor-pointer"
              title="Refresh incidents now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#9AC2FA]" : ""}`} />
              <span className="hidden sm:inline">{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
        }
      />

      {/* Real-Time Telemetry & Provenance Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] text-xs shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-700 dark:text-[#C5C8D0]">
              {isHindi ? "सत्यापित लाइव घटनाएं:" : "Verified Live Incidents:"}
            </span>
            <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60">
              {incidents.filter((i) => !i.is_simulated).length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500">
            <span>•</span>
            <span className="font-semibold text-slate-700 dark:text-[#C5C8D0]">
              {isHindi ? "सिम्युलेटेड / प्रारंभिक चेतावनियां:" : "Simulated / Early Warnings:"}
            </span>
            <span className="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700 dark:bg-[#1B1D22] dark:text-[#C5C8D0] border border-slate-200 dark:border-white/[0.08]">
              {incidents.filter((i) => i.is_simulated).length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-slate-500 dark:text-[#8C93A4] text-[11px]">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-[#8C93A4]" />
            <span>
              {isHindi ? "अंतिम रिफ्रेश:" : "Last Refreshed:"}{" "}
              <b className="text-slate-700 dark:text-white">
                {lastRefreshedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </b>
            </span>
          </div>
          <span className="text-[10px] text-blue-600 dark:text-[#9AC2FA] font-medium">
            (Auto-refreshes every 30s)
          </span>
        </div>
      </div>

      {/* Configurable Early Warning Thresholds Panel */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600 dark:text-[#9AC2FA]" />
            <h3 className="font-serif font-semibold text-base text-slate-900 dark:text-white">
              {isHindi ? "कॉन्फ़िगर करने योग्य चेतावनी सीमाएं (Thresholds)" : "Configurable Early Congestion Thresholds"}
            </h3>
          </div>
          <button
            onClick={handleEvaluate}
            disabled={evalLoading}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#7FB0F7] text-white dark:text-[#0A0D14] font-semibold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {evalLoading ? "Evaluating..." : isHindi ? "सीमाएं लागू करें" : "Re-evaluate Thresholds"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Volume Threshold */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-[#C5C8D0]">
                {isHindi ? "क्षमता अनुपात सीमा (Volume/Capacity τ_v):" : "Volume/Capacity Threshold (τ_v):"}
              </span>
              <span className="font-mono font-bold text-blue-600 dark:text-[#9AC2FA]">
                {(tauV * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.50"
              max="1.00"
              step="0.05"
              value={tauV}
              onChange={(e) => setTauV(parseFloat(e.target.value))}
              className="w-full accent-[#9AC2FA] cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 dark:text-[#6B7280] block">
              Triggers warning when 15-minute volume exceeds {(tauV * 100).toFixed(0)}% of road capacity.
            </span>
          </div>

          {/* Speed Threshold */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-[#C5C8D0]">
                {isHindi ? "न्यूनतम गति सीमा (Speed Threshold τ_s):" : "Speed Threshold (τ_s):"}
              </span>
              <span className="font-mono font-bold text-blue-600 dark:text-[#9AC2FA]">
                {tauS.toFixed(0)} km/h
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="45"
              step="1"
              value={tauS}
              onChange={(e) => setTauS(parseFloat(e.target.value))}
              className="w-full accent-[#9AC2FA] cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 dark:text-[#6B7280] block">
              Triggers warning when corridor speed slows down to or below {tauS.toFixed(0)} km/h.
            </span>
          </div>
        </div>
      </div>

      {/* Early Congestion Warnings & Topological Spillover */}
      {evaluation && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Active Warnings */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <h4 className="font-serif font-semibold text-sm text-slate-900 dark:text-white">
                  {isHindi ? "सीमा पार चेतावनी नोड्स" : "Threshold Breach Early Warnings"}
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-500/20">
                {evaluation.early_warnings.length} Corridors
              </span>
            </div>

            {evaluation.early_warnings.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-[#6B7280] italic py-2">
                All corridors flowing within configured volume and speed thresholds.
              </p>
            ) : (
              <div className="space-y-2">
                {evaluation.early_warnings.map((w, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{w.intersection_name} <span className="font-mono text-[10px] text-slate-400">({w.intersection_id})</span></p>
                      <p className="text-[11px] text-slate-500 dark:text-[#8C93A4]">Onset: <span className="font-semibold text-amber-700 dark:text-amber-300">{w.expected_onset}</span> • {w.threshold_exceeded}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600 dark:text-red-400">{w.speed_kmh} km/h</p>
                      <span className="text-[10px] text-slate-400">{(w.volume_ratio * 100).toFixed(0)}% capacity</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Topological Spillover Risks */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-blue-600 dark:text-[#9AC2FA]" />
                <h4 className="font-serif font-semibold text-sm text-slate-900 dark:text-white">
                  {isHindi ? "संभावित स्पिलओवर जोखिम नोड्स" : "Topological Spillover Risk Corridors"}
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-[#9AC2FA]/15 dark:text-[#9AC2FA] border border-blue-200 dark:border-[#9AC2FA]/25">
                {evaluation.spillover_risks.length} Neighbors
              </span>
            </div>

            {evaluation.spillover_risks.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-[#6B7280] italic py-2">
                No immediate spillover propagation detected in adjacent network graph nodes.
              </p>
            ) : (
              <div className="space-y-2">
                {evaluation.spillover_risks.map((sp, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-900 dark:text-white">{sp.intersection_name} <span className="font-mono text-[10px] text-slate-400">({sp.intersection_id})</span></p>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${sp.risk_level === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'}`}>
                        {sp.risk_level} spillover
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-[#8C93A4]">
                      Adjacency link from: <b className="text-slate-700 dark:text-white">{sp.adjacent_to}</b>
                    </p>
                    <p className="text-[10px] text-blue-600 dark:text-[#9AC2FA] italic">
                      💡 {sp.recommended_action}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Incidents Cards List */}
      <div className="space-y-4">
        {incidents.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08]">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-[#C5C8D0]">
              {t("incidents.no_incidents")}
            </p>
          </div>
        ) : (
          incidents.map((inc) => {
            const isCritical = inc.severity === "critical";
            const isWarning = inc.severity === "warning";
            return (
              <div
                key={inc.id}
                className={`p-5 rounded-2xl bg-white dark:bg-[#111318] border shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isCritical
                    ? "border-l-4 border-l-red-500 border-slate-200 dark:border-white/[0.08]"
                    : isWarning
                    ? "border-l-4 border-l-amber-500 border-slate-200 dark:border-white/[0.08]"
                    : "border-l-4 border-l-[#9AC2FA] border-slate-200 dark:border-white/[0.08]"
                }`}
              >
                <div className="space-y-2 flex-1">
                  {/* Badge & Meta */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                        isCritical
                          ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                          : isWarning
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : "bg-blue-500/10 text-blue-600 dark:text-[#9AC2FA] border border-blue-500/20 dark:border-[#9AC2FA]/25"
                      }`}
                    >
                      {t(`common.${inc.severity}`)}
                    </span>
                    {!inc.is_simulated ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Verified TomTom Live
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 text-slate-700 dark:bg-[#1B1D22] dark:text-[#C5C8D0] border border-slate-200 dark:border-white/[0.08]">
                        Simulated Alert
                      </span>
                    )}
                    <span className="text-slate-400 font-mono">{inc.id}</span>
                    <span className="text-slate-300 dark:text-white/20">•</span>
                    <div className="flex items-center gap-1 text-slate-500 dark:text-[#8C93A4]">
                      <MapPin className="w-3.5 h-3.5 text-blue-500 dark:text-[#9AC2FA]" />
                      <span className="font-semibold text-slate-700 dark:text-white">
                        {isHindi ? inc.intersection_name_hi : inc.intersection_name}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                    {isHindi ? inc.description_hi : inc.description_en}
                  </p>

                  {/* Recommendation Box */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-100 dark:border-white/[0.08] text-xs">
                    <span className="font-semibold text-slate-700 dark:text-[#C5C8D0]">
                      {isHindi ? "सिफारिश की गई कार्रवाई: " : "Recommended Action: "}
                    </span>
                    <span className="text-slate-600 dark:text-[#8C93A4]">
                      {isHindi ? inc.recommended_action_hi : inc.recommended_action_en}
                    </span>
                  </div>
                </div>

                {/* Status Badge & Action Buttons */}
                <div className="flex md:flex-col items-center md:items-end justify-between gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-white/[0.08]">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                      inc.status === "open"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20"
                        : inc.status === "acknowledged"
                        ? "bg-blue-500/10 text-blue-600 dark:text-[#9AC2FA] border border-blue-500/20 dark:border-[#9AC2FA]/25"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20"
                    }`}
                  >
                    {t(`common.${inc.status}`)}
                  </span>

                  <div className="flex items-center gap-2">
                    {inc.status === "open" && (
                      <button
                        onClick={() => handleUpdateStatus(inc.id, "acknowledged")}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#7FB0F7] text-white dark:text-[#0A0D14] text-xs font-semibold shadow-sm transition-all cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{t("incidents.btn_ack")}</span>
                      </button>
                    )}
                    {inc.status !== "resolved" && (
                      <button
                        onClick={() => handleUpdateStatus(inc.id, "resolved")}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1B1D22] hover:bg-emerald-600 hover:text-white text-slate-700 dark:text-[#E8EAEE] text-xs font-semibold border border-slate-200 dark:border-white/[0.10] transition-all cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>{t("incidents.btn_resolve")}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

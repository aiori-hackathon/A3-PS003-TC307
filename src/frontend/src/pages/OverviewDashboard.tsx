import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import {
  DashboardSummary,
  CitizenReport,
  CitizenReportStats,
  EmergencyCorridorRequest,
  EmergencyCorridorStats,
  IncidentItem,
  IntersectionDetail,
} from "../types";
import {
  Activity,
  Shield,
  RefreshCw,
  Compass,
  FileText,
  BarChart3,
  LayoutDashboard,
  CheckCircle2,
  AlertTriangle,
  Siren,
  Clock,
  ArrowRight,
  Eye,
  MapPin,
  Tag,
  Radio,
  Gauge,
  AlertOctagon,
  Volume2,
  VolumeX,
  Share2,
  CheckCheck,
  ShieldAlert,
  Sparkles,
  Cpu,
} from "lucide-react";

import { AuthorityOverviewKPIs } from "../components/authority/AuthorityOverviewKPIs";
import { AuthorityAIAdvisoryCard } from "../components/authority/AuthorityAIAdvisoryCard";
import { MunicipalAdvisory, MunicipalAdvisoryEngine } from "../services/advisoryEngine";
import type { IncidentShareData, RouteShareData } from "../components/share/ShareModal";
import { useVoiceAdvisory } from "../hooks/useVoiceAdvisory";
import { SimulationProvider, useSimulation } from "../context/SimulationContext";
import { LoadingFallback } from "../components/common/LoadingFallback";
import { lazyNamed } from "../utils/lazyImport";

// Section-level lazy chunks (loaded only when user opens each tab)
const AuthorityDedicatedLiveMap = lazyNamed(
  () => import("../components/authority/AuthorityDedicatedLiveMap"),
  "AuthorityDedicatedLiveMap"
);
const AuthorityComplaintTable = lazyNamed(
  () => import("../components/authority/AuthorityComplaintTable"),
  "AuthorityComplaintTable"
);
const AuthorityEmergencyOperations = lazyNamed(
  () => import("../components/authority/AuthorityEmergencyOperations"),
  "AuthorityEmergencyOperations"
);
const AuthorityAnalyticsCharts = lazyNamed(
  () => import("../components/authority/AuthorityAnalyticsCharts"),
  "AuthorityAnalyticsCharts"
);
const AuthorityLiveMap = lazyNamed(
  () => import("../components/authority/AuthorityLiveMap"),
  "AuthorityLiveMap"
);

// Modal-level lazy chunks (loaded only when triggered by user interaction)
const AuthorityReportDetailModal = lazyNamed(
  () => import("../components/authority/AuthorityReportDetailModal"),
  "AuthorityReportDetailModal"
);
const AuthorityResolutionModal = lazyNamed(
  () => import("../components/authority/AuthorityResolutionModal"),
  "AuthorityResolutionModal"
);
const ShareModal = lazyNamed(() => import("../components/share/ShareModal"), "ShareModal");
const AuthorityScenarioSimulatorModal = lazyNamed(
  () => import("../components/authority/AuthorityScenarioSimulatorModal"),
  "AuthorityScenarioSimulatorModal"
);
const AuthorityAIAdvisoryDetailModal = lazyNamed(
  () => import("../components/authority/AuthorityAIAdvisoryDetailModal"),
  "AuthorityAIAdvisoryDetailModal"
);
const AuthorityBroadcastConfirmModal = lazyNamed(
  () => import("../components/authority/AuthorityBroadcastConfirmModal"),
  "AuthorityBroadcastConfirmModal"
);
const AuthorityAdvisoryHistoryModal = lazyNamed(
  () => import("../components/authority/AuthorityAdvisoryHistoryModal"),
  "AuthorityAdvisoryHistoryModal"
);

export const OverviewDashboardContent: React.FC = () => {
  const { t } = useTranslation();
  const { isHindi } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 6 Main Navigation Sections: 'overview' | 'live_map' | 'complaints' | 'emergency' | 'analytics' | 'citizen-portal'
  const rawSection = searchParams.get("section") || "overview";
  const activeSection = rawSection === "monitoring" || rawSection === "map" ? "live_map" : rawSection;
  const setSection = (sec: string) => {
    setSearchParams({ section: sec });
  };

  // Live Data State (decoupled by domain so SQLite complaints never wait on TomTom APIs)
  const [telemetryData, setTelemetryData] = useState<DashboardSummary | null>(null);
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [stats, setStats] = useState<CitizenReportStats | null>(null);
  const [emergencyCorridors, setEmergencyCorridors] = useState<EmergencyCorridorRequest[]>([]);
  const [emergencyStats, setEmergencyStats] = useState<EmergencyCorridorStats | null>(null);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [intersections, setIntersections] = useState<IntersectionDetail[]>([]);

  const [complaintsLoading, setComplaintsLoading] = useState<boolean>(true);
  const [complaintsError, setComplaintsError] = useState<string | null>(null);
  const [trafficLoading, setTrafficLoading] = useState<boolean>(true);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [emergencyLoading, setEmergencyLoading] = useState<boolean>(true);

  const isMountedRef = useRef<boolean>(true);
  const latestComplaintsReqRef = useRef<number>(0);
  const latestTrafficReqRef = useRef<number>(0);
  const latestEmergencyReqRef = useRef<number>(0);
  const complaintsAbortRef = useRef<AbortController | null>(null);
  const emergencyAbortRef = useRef<AbortController | null>(null);
  const trafficAbortRef = useRef<AbortController | null>(null);

  // Municipal AI Advisory state
  const [selectedAdvisoryDetail, setSelectedAdvisoryDetail] = useState<MunicipalAdvisory | null>(null);
  const [broadcastAdvisory, setBroadcastAdvisory] = useState<MunicipalAdvisory | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [dismissCount, setDismissCount] = useState<number>(0);

  // Modals & Action Toast
  const [selectedReportDetail, setSelectedReportDetail] = useState<CitizenReport | null>(null);
  const [resolutionModalState, setResolutionModalState] = useState<{
    report: CitizenReport;
    targetStatus: string;
  } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Sharing Modal State (for 1-click sharing of incidents or routes)
  const [shareData, setShareData] = useState<IncidentShareData | RouteShareData | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const isTrafficDegraded =
    Boolean(trafficError) ||
    Boolean(telemetryData?.is_simulated) ||
    Boolean(telemetryData?.provider_status?.error_fallback_active) ||
    (telemetryData?.provider_status != null && !telemetryData.provider_status.is_online);

  // Voice Advisory setup for the Command Center
  const voiceContext = useMemo(() => {
    return {
      roadName: "Delhi NCR Arterial Network",
      city: "Delhi NCR",
      currentSpeed: telemetryData?.average_speed ?? 42.5,
      freeFlowSpeed: (telemetryData?.average_speed ?? 42.5) + 12,
      congestionLevel: ((telemetryData?.congested_roads_count ?? 0) > 2 ? "severe" : "moderate") as "severe" | "moderate",
      trafficAvailable: !trafficError && !(telemetryData?.is_simulated ?? false),
    };
  }, [telemetryData, trafficError]);

  const voiceAdvisory = useVoiceAdvisory(voiceContext);

  // 1. Independent Citizen Complaints Loader (fast local DB, never waits on TomTom)
  const loadComplaintsData = useCallback(async () => {
    const reqId = ++latestComplaintsReqRef.current;
    complaintsAbortRef.current?.abort();
    const controller = new AbortController();
    complaintsAbortRef.current = controller;

    setComplaintsLoading(true);
    setComplaintsError(null);
    try {
      const [repsResult, statsResult] = await Promise.allSettled([
        api.getCitizenReports(controller.signal),
        api.getCitizenReportStats(controller.signal),
      ]);
      if (!isMountedRef.current || controller.signal.aborted || reqId !== latestComplaintsReqRef.current) return;

      if (repsResult.status === "fulfilled") {
        setReports(repsResult.value);
      }
      if (statsResult.status === "fulfilled") {
        setStats(statsResult.value);
      }

      if (repsResult.status === "rejected" || statsResult.status === "rejected") {
        const reason =
          repsResult.status === "rejected" ? repsResult.reason : (statsResult as PromiseRejectedResult).reason;
        if (reason?.name === "AbortError") return;
        setComplaintsError(reason?.message || "Failed to load citizen complaints.");
      }
    } catch (err: any) {
      if (!isMountedRef.current || controller.signal.aborted || reqId !== latestComplaintsReqRef.current) return;
      if (err?.name === "AbortError") return;
      setComplaintsError(err?.message || "Failed to load citizen complaints.");
    } finally {
      if (isMountedRef.current && !controller.signal.aborted && reqId === latestComplaintsReqRef.current) {
        setComplaintsLoading(false);
      }
    }
  }, []);

  // 2. Independent Emergency Corridors Loader (local DB)
  const loadEmergencyData = useCallback(async () => {
    const reqId = ++latestEmergencyReqRef.current;
    emergencyAbortRef.current?.abort();
    const controller = new AbortController();
    emergencyAbortRef.current = controller;

    setEmergencyLoading(true);
    try {
      const [emgResult, emgStatsResult] = await Promise.allSettled([
        api.getEmergencyCorridors(undefined, controller.signal),
        api.getEmergencyCorridorStats(controller.signal),
      ]);
      if (!isMountedRef.current || controller.signal.aborted || reqId !== latestEmergencyReqRef.current) return;

      if (emgResult.status === "fulfilled") {
        setEmergencyCorridors(emgResult.value);
      }
      if (emgStatsResult.status === "fulfilled") {
        setEmergencyStats(emgStatsResult.value);
      }
    } catch (err: any) {
      if (isMountedRef.current && !controller.signal.aborted && err?.name !== "AbortError") {
        console.error("Emergency data load error:", err);
      }
    } finally {
      if (isMountedRef.current && !controller.signal.aborted && reqId === latestEmergencyReqRef.current) {
        setEmergencyLoading(false);
      }
    }
  }, []);

  // 3. Independent External Traffic Telemetry Loader (TomTom-dependent)
  const loadTrafficData = useCallback(async () => {
    const reqId = ++latestTrafficReqRef.current;
    trafficAbortRef.current?.abort();
    const controller = new AbortController();
    trafficAbortRef.current = controller;

    setTrafficLoading(true);
    setTrafficError(null);
    try {
      const [telemetryResult, incResult, interResult] = await Promise.allSettled([
        api.getDashboardSummary(controller.signal),
        api.getIncidents(undefined, "open", false, controller.signal),
        api.getIntersections(controller.signal),
      ]);
      if (!isMountedRef.current || controller.signal.aborted || reqId !== latestTrafficReqRef.current) return;

      if (telemetryResult.status === "fulfilled") {
        setTelemetryData(telemetryResult.value);
      }
      if (incResult.status === "fulfilled") {
        setIncidents(incResult.value);
      }
      if (interResult.status === "fulfilled") {
        setIntersections(interResult.value);
      }

      if (telemetryResult.status === "rejected" || interResult.status === "rejected") {
        const reason =
          telemetryResult.status === "rejected"
            ? telemetryResult.reason
            : (interResult as PromiseRejectedResult).reason;
        if (reason?.name === "AbortError") return;
        setTrafficError(reason?.message || "Live traffic service unavailable — showing simulated/fallback data.");
      }
    } catch (err: any) {
      if (!isMountedRef.current || controller.signal.aborted || reqId !== latestTrafficReqRef.current) return;
      if (err?.name === "AbortError") return;
      setTrafficError(err?.message || "Live traffic service unavailable — showing simulated/fallback data.");
    } finally {
      if (isMountedRef.current && !controller.signal.aborted && reqId === latestTrafficReqRef.current) {
        setTrafficLoading(false);
      }
    }
  }, []);

  // Trigger all domain loaders independently without cross-blocking
  const loadDashboardData = useCallback(() => {
    void Promise.all([loadComplaintsData(), loadEmergencyData(), loadTrafficData()]);
  }, [loadComplaintsData, loadEmergencyData, loadTrafficData]);

  useEffect(() => {
    isMountedRef.current = true;
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 45000);
    return () => {
      isMountedRef.current = false;
      complaintsAbortRef.current?.abort();
      emergencyAbortRef.current?.abort();
      trafficAbortRef.current?.abort();
      clearInterval(interval);
    };
  }, [loadDashboardData]);

  // Citizen Complaint Status Update
  const handleConfirmReportStatus = async (reportId: string, targetStatus: string, note: string) => {
    setIsUpdatingStatus(true);
    try {
      latestComplaintsReqRef.current += 1;
      await api.updateCitizenReportStatus(reportId, targetStatus, note);
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? {
                ...r,
                status: targetStatus,
                resolution_note: note || r.resolution_note,
                updated_at: new Date().toISOString(),
              }
            : r
        )
      );
      if (selectedReportDetail && selectedReportDetail.id === reportId) {
        setSelectedReportDetail((prev) =>
          prev
            ? { ...prev, status: targetStatus, resolution_note: note || prev.resolution_note }
            : null
        );
      }
      setResolutionModalState(null);
      api
        .getCitizenReportStats()
        .then((st) => {
          if (isMountedRef.current) setStats(st);
        })
        .catch(() => {});
      setActionToast(
        `Action recorded: Report ${reportId} status set to ${targetStatus.toUpperCase().replace("_", " ")}. Citizen notified.`
      );
      setTimeout(() => {
        if (isMountedRef.current) setActionToast(null);
      }, 5000);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to update report status");
    } finally {
      if (isMountedRef.current) setIsUpdatingStatus(false);
    }
  };

  // Emergency Corridor Status Update
  const handleUpdateEmergencyStatus = async (corridorId: string, targetStatus: string, notes?: string) => {
    try {
      latestEmergencyReqRef.current += 1;
      await api.updateEmergencyCorridorStatus(corridorId, targetStatus, notes);
      setEmergencyCorridors((prev) =>
        prev.map((c) =>
          c.id === corridorId
            ? { ...c, status: targetStatus, authority_notes: notes || c.authority_notes }
            : c
        )
      );
      api
        .getEmergencyCorridorStats()
        .then((st) => {
          if (isMountedRef.current) setEmergencyStats(st);
        })
        .catch(() => {});
      setActionToast(
        `Emergency corridor ${corridorId} status updated to ${targetStatus}. Notified requester.`
      );
      setTimeout(() => {
        if (isMountedRef.current) setActionToast(null);
      }, 5000);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to update corridor status");
    }
  };

  // Share incident helper
  const handleShareIncident = (report: CitizenReport) => {
    const payload: IncidentShareData = {
      type: "incident",
      id: report.id,
      incidentType: report.category,
      locationName: report.location_name,
      description: report.description,
      status: report.status,
      severity: report.priority,
    };
    setShareData(payload);
    setIsShareModalOpen(true);
  };

  // Share alert helper
  const handleShareAlert = (inc: IncidentItem) => {
    const payload: IncidentShareData = {
      type: "incident",
      id: inc.id,
      incidentType: inc.incident_type,
      locationName: inc.intersection_name,
      description: inc.description_en,
      status: inc.status,
      severity: inc.severity,
      actionRequired: inc.recommended_action_en,
    };
    setShareData(payload);
    setIsShareModalOpen(true);
  };

  const {
    activeScenario,
    scenarioStatus,
    isSimulatorModalOpen,
    openSimulatorModal,
    resetScenario,
    simulatedCorridor,
    simulatedIncident,
    simulatedAlert,
  } = useSimulation();

  // Generate prioritized Municipal AI Advisories
  const advisories = useMemo(() => {
    return MunicipalAdvisoryEngine.analyzeTrafficConditions({
      intersections,
      telemetryData,
      reports,
      emergencyCorridors,
      incidents,
    });
  }, [intersections, telemetryData, reports, emergencyCorridors, incidents, dismissCount]);

  const handleViewAdvisoryOnLiveMap = (adv: MunicipalAdvisory) => {
    setSearchParams({
      section: "live_map",
      advisoryJunction: adv.location.intersectionId,
      advisoryId: adv.id,
    });
  };

  const handleCompareAdvisoryRoutes = (adv: MunicipalAdvisory) => {
    const origin = adv.supportingData.alternateRoutePath?.[0] || adv.location.intersectionId;
    const dest = adv.supportingData.alternateRoutePath?.[adv.supportingData.alternateRoutePath.length - 1] || "INT-04";
    setSearchParams({
      section: "live_map",
      routeOrigin: origin,
      routeDestination: dest,
      avoidClosed: "true",
    });
  };

  const handleDismissAdvisory = (advisoryId: string) => {
    MunicipalAdvisoryEngine.dismissAdvisory(advisoryId);
    setDismissCount((prev) => prev + 1);
    setActionToast("Advisory dismissed from active dashboard.");
    setTimeout(() => setActionToast(null), 3000);
  };

  const handleBroadcastSuccess = (incidentId: string) => {
    setActionToast(`Official Municipal Advisory broadcast successfully [${incidentId}]`);
    setTimeout(() => setActionToast(null), 4000);
    loadDashboardData();
  };

  const handleSpeakAdvisory = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const pendingComplaintsCount = stats?.pending_verification ?? reports.filter((r) => r.status === "unverified").length;
  const activeEmergenciesCount = emergencyStats?.active_requests ?? emergencyCorridors.filter((c) => c.status === "ACTIVE").length;
  const effectiveActiveEmergenciesCount =
    activeScenario === "ambulance" && simulatedCorridor
      ? activeEmergenciesCount + 1
      : activeEmergenciesCount;
  const criticalAlertsCount = incidents.filter((i) => i.severity === "critical").length;
  const activeSOSCount = emergencyCorridors.filter((c) => (c.vehicle_type || "").toLowerCase() === "sos" && c.status !== "COMPLETED" && c.status !== "REJECTED").length;
  const resolvedCount = stats?.resolved_issues ?? reports.filter((r) => r.status === "resolved").length;

  return (
    <div className="space-y-5" data-testid="authority-dashboard-root">
      {/* Authority Command Center Header */}
      <div className="rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-[#161920] border border-blue-200 dark:border-white/[0.08] text-blue-600 dark:text-[#9AC2FA] shrink-0 mt-0.5">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-slate-500 dark:text-[#9AC2FA]">
                  {isHindi
                    ? `स्वागत है, ${user?.full_name || "कमांड अधिकारी"}`
                    : `Welcome, ${user?.full_name || "Traffic Commander"}`}
                </span>
                <span className="text-slate-300 dark:text-white/20">•</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                    trafficLoading && !telemetryData
                      ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-[#9AC2FA]/10 dark:text-[#9AC2FA] dark:border-[#9AC2FA]/25"
                      : isTrafficDegraded
                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30"
                  }`}
                  data-testid="authority-connectivity-badge"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      trafficLoading && !telemetryData
                        ? "bg-[#9AC2FA] animate-pulse"
                        : isTrafficDegraded
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                    }`}
                  />
                  <span>
                    {trafficLoading && !telemetryData
                      ? "Syncing Telemetry..."
                      : isTrafficDegraded
                      ? "Simulated Baseline Active"
                      : `Live TomTom Stream (${telemetryData?.active_edge_nodes ?? 8}/${telemetryData?.total_intersections ?? 8} Nodes)`}
                  </span>
                </span>
              </div>

              <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-[-0.015em] text-slate-900 dark:text-white leading-tight mt-1">
                {isHindi ? "अथॉरिटी कमांड सेंटर" : "Authority Command Center"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9CA3AF] mt-1">
                {isHindi
                  ? "स्मार्ट सिटी यातायात निगरानी, शिकायत निवारण और आपातकालीन संचालन केंद्र"
                  : "Smart city traffic intelligence, incident triage, and emergency signal operations."}
              </p>
            </div>
          </div>

          {/* Discreet Utility Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openSimulatorModal}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                activeScenario !== "none"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35"
                  : "bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.12] text-slate-700 dark:text-[#C5C8D0] hover:bg-slate-100 dark:hover:bg-white/[0.07]"
              }`}
              title="Open Demo Scenario Simulator"
              data-testid="launch-demo-simulator-btn"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>{activeScenario !== "none" ? "Scenario Active" : "Simulator"}</span>
            </button>

            <button
              type="button"
              onClick={voiceAdvisory.toggleEnabled}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                voiceAdvisory.isEnabled
                  ? "bg-blue-600 dark:bg-[#9AC2FA] text-white dark:text-[#0A0D14] border-blue-600 dark:border-[#9AC2FA]"
                  : "bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.12] text-slate-700 dark:text-[#C5C8D0] hover:bg-slate-100 dark:hover:bg-white/[0.07]"
              }`}
              title="Toggle Real-Time Speech Traffic Announcements"
            >
              {voiceAdvisory.isEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Voice: {voiceAdvisory.isEnabled ? "ON" : "OFF"}</span>
            </button>

            <button
              type="button"
              onClick={loadDashboardData}
              disabled={complaintsLoading && trafficLoading && emergencyLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.12] text-slate-700 dark:text-[#EAECEF] hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh All Dashboard Data"
              data-testid="authority-refresh-btn"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  complaintsLoading || trafficLoading || emergencyLoading ? "animate-spin text-blue-600 dark:text-[#9AC2FA]" : ""
                }`}
              />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/citizen")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-50 dark:bg-white/[0.03] text-slate-700 dark:text-[#EAECEF] hover:bg-slate-100 dark:hover:bg-white/[0.07] border border-slate-200 dark:border-white/[0.12] transition-colors cursor-pointer"
              title="Switch to Citizen View"
            >
              <Compass className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
              <span className="hidden sm:inline">Citizen View</span>
            </button>
          </div>
        </div>

        {/* Mobile-only Section Switcher (desktop uses the Sidebar without duplicate chrome) */}
        <div className="mt-4 pt-3.5 border-t border-slate-200 dark:border-white/[0.07] flex lg:hidden flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: "overview", label: "Overview", icon: LayoutDashboard, badge: null },
            { id: "live_map", label: "Traffic Monitoring", icon: MapPin, badge: criticalAlertsCount > 0 ? criticalAlertsCount : null },
            { id: "complaints", label: "Complaints", icon: FileText, badge: pendingComplaintsCount > 0 ? pendingComplaintsCount : null },
            { id: "emergency", label: "Emergency", icon: Siren, badge: effectiveActiveEmergenciesCount > 0 ? effectiveActiveEmergenciesCount : null },
            { id: "analytics", label: "Analytics", icon: BarChart3, badge: null },
            { id: "federated", label: "FL Lab", icon: Cpu, badge: null, route: "/federated" },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => (tab.route ? navigate(tab.route) : setSection(tab.id))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-blue-600 text-white dark:bg-[#9AC2FA] dark:text-[#0A0D14] font-semibold"
                    : "bg-slate-50 dark:bg-[#161920] text-slate-600 dark:text-[#C5C8D0] border border-slate-200 dark:border-white/[0.08]"
                }`}
                data-testid={`authority-tab-${tab.id}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge !== null && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/15">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Demo Scenario Bar (rendered ONLY while a jury/demo simulation is active) */}
      {activeScenario !== "none" && (
        <div
          className="px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs"
          data-testid="authority-demo-simulator-card"
        >
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="font-semibold">
              Simulated Scenario Active: {activeScenario === "ambulance" ? "Ambulance Green Corridor" : "Monsoon Waterlogging Bypass"} ({scenarioStatus})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSection("live_map")}
              className="px-2.5 py-1 rounded-lg bg-[#9AC2FA] text-[#0A0D14] font-semibold cursor-pointer"
            >
              Inspect on Map
            </button>
            <button
              type="button"
              onClick={resetScenario}
              className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-[#161920] text-slate-700 dark:text-[#EAECEF] border border-slate-200 dark:border-white/[0.12] font-medium cursor-pointer"
              data-testid="reset-demo-simulator-btn"
            >
              Reset Demo
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Toast Alert */}
      {actionToast && (
        <div
          className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200 flex items-center justify-between text-xs shadow-sm"
          data-testid="authority-action-toast"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-semibold">{actionToast}</span>
          </div>
          <button onClick={() => setActionToast(null)} className="text-emerald-500 font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 1: CLEAN COMMAND CENTER OVERVIEW                     */}
      {/* ============================================================ */}
      {activeSection === "overview" && (
        <div className="space-y-5">
          {/* Honest Connectivity Warning Banner (never blocks local workflows) */}
          {!trafficLoading && isTrafficDegraded && (
            <div
              className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs"
              data-testid="authority-traffic-warning-banner"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">
                    Live TomTom feed unavailable — simulated fallback active.
                  </span>{" "}
                  <span className="text-amber-700 dark:text-amber-300/90">
                    {trafficError ||
                      telemetryData?.provider_status?.message ||
                      "Citizen complaints and emergency dispatch remain fully operational."}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={loadTrafficData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shrink-0 cursor-pointer transition-colors"
                data-testid="retry-traffic-btn"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Traffic</span>
              </button>
            </div>
          )}

          {/* Priority Municipal AI Advisory (Critical Alerts always prominent) */}
          <AuthorityAIAdvisoryCard
            advisories={advisories}
            onViewOnLiveMap={handleViewAdvisoryOnLiveMap}
            onOpenDetails={(adv) => setSelectedAdvisoryDetail(adv)}
            onCompareRoutes={handleCompareAdvisoryRoutes}
            onBroadcastAdvisory={(adv) => setBroadcastAdvisory(adv)}
            onDismissAdvisory={handleDismissAdvisory}
            onOpenHistory={() => setIsHistoryModalOpen(true)}
            onSpeakAdvisory={handleSpeakAdvisory}
            isVoiceActive={voiceAdvisory.isEnabled}
          />

          {/* 5 Core Operational Summary KPIs */}
          <AuthorityOverviewKPIs
            stats={stats}
            emergencyStats={emergencyStats}
            loading={complaintsLoading}
            complaintsLoading={complaintsLoading}
            emergencyLoading={emergencyLoading}
            onSelectFilter={(sec) => setSection(sec)}
          />

          {/* Primary Two-Column Command Split: Compact Map Preview + Operational Queues */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Compact City Traffic Map Preview */}
            <div
              className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] space-y-3.5"
              data-testid="overview-panel-traffic"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.07]">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#9AC2FA]" />
                  <div>
                    <h2 className="font-serif text-base font-medium text-slate-900 dark:text-white">
                      {isHindi ? "शहर यातायात मानचित्र पूर्वावलोकन" : "City Traffic Map Preview"}
                    </h2>
                    <p
                      className="text-[11px] text-slate-500 dark:text-[#8C93A4]"
                      data-testid="traffic-telemetry-status"
                    >
                      {trafficLoading && !telemetryData
                        ? "Syncing arterial nodes..."
                        : isTrafficDegraded
                        ? "Simulated baseline telemetry"
                        : `${telemetryData?.active_edge_nodes ?? 8}/${telemetryData?.total_intersections ?? 8} junctions reporting live`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSection("live_map")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-[#9AC2FA]/12 text-blue-700 dark:text-[#9AC2FA] border border-blue-200 dark:border-[#9AC2FA]/25 hover:bg-blue-100 dark:hover:bg-[#9AC2FA]/20 text-xs font-semibold transition-colors cursor-pointer"
                  data-testid="open-live-map-btn"
                >
                  <span>View Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Compact Interactive Map */}
              {trafficLoading && intersections.length === 0 ? (
                <div
                  className="h-[320px] rounded-xl bg-slate-100 dark:bg-[#161920] animate-pulse"
                  data-testid="traffic-telemetry-loading"
                />
              ) : (
                <Suspense
                  fallback={<div className="h-[320px] rounded-xl bg-slate-100 dark:bg-[#161920] animate-pulse" />}
                >
                  <AuthorityLiveMap
                    compact={true}
                    intersections={intersections}
                    reports={
                      activeScenario === "waterlogging" && simulatedIncident
                        ? [simulatedIncident, ...reports]
                        : reports
                    }
                    incidents={
                      activeScenario === "waterlogging" && simulatedAlert
                        ? [simulatedAlert, ...incidents]
                        : incidents
                    }
                    emergencyCorridors={
                      activeScenario === "ambulance" && simulatedCorridor
                        ? [simulatedCorridor, ...emergencyCorridors]
                        : emergencyCorridors
                    }
                    onSelectJunction={() => setSection("live_map")}
                    onSelectReport={(rep) => setSelectedReportDetail(rep)}
                  />
                </Suspense>
              )}

              {/* Compact Monitoring Summary Metrics */}
              <div className="grid grid-cols-3 gap-2.5 pt-1 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-100 dark:border-white/[0.07]">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-[#8C93A4] block">
                    Avg Speed
                  </span>
                  <span className="font-mono text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {telemetryData ? `${telemetryData.average_speed} km/h` : "--"}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-100 dark:border-white/[0.07]">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-[#8C93A4] block">
                    Congested
                  </span>
                  <span className="font-mono text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">
                    {telemetryData ? `${telemetryData.congested_roads_count} Roads` : "--"}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-100 dark:border-white/[0.07]">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-[#8C93A4] block">
                    Critical Alerts
                  </span>
                  <span className="font-mono text-sm sm:text-base font-bold text-rose-600 dark:text-rose-400">
                    {criticalAlertsCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Actionable Operational Summaries */}
            <div className="lg:col-span-5 space-y-4">
              {/* 1. Active Traffic Alerts Summary */}
              <div
                className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)] space-y-3"
                data-testid="overview-panel-alerts"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    <span>Active Traffic Alerts</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                    {incidents.length} Open
                  </span>
                </div>

                {trafficLoading && incidents.length === 0 ? (
                  <div className="space-y-1.5" data-testid="overview-incidents-loading">
                    <div className="h-10 rounded-lg bg-slate-100 dark:bg-[#1B1D22] animate-pulse" />
                  </div>
                ) : incidents.length > 0 ? (
                  <div className="space-y-1.5">
                    {incidents.slice(0, 2).map((inc) => (
                      <div
                        key={inc.id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-100 dark:border-white/[0.07] text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {inc.intersection_name}
                          </span>
                          <span
                            className={`text-[9px] font-mono uppercase font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                              inc.severity === "critical"
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {inc.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-[#8C93A4] mt-0.5 truncate">
                          {inc.description_en}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-3 text-center text-xs text-slate-400 dark:text-[#7A8191]">
                    {trafficError ? "Road alert feed unavailable" : "All corridors clear"}
                  </p>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSection("live_map")}
                    className="text-xs font-medium text-blue-600 dark:text-[#9AC2FA] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 2. Pending Citizen Complaints Summary */}
              <div
                className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)] space-y-3"
                data-testid="overview-panel-complaints"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#9AC2FA]" />
                    <span>Pending Citizen Complaints</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                    {pendingComplaintsCount} Awaiting Review
                  </span>
                </div>

                {complaintsLoading && reports.length === 0 ? (
                  <div className="space-y-1.5" data-testid="overview-complaints-loading">
                    <div className="h-10 rounded-lg bg-slate-100 dark:bg-[#1B1D22] animate-pulse" />
                  </div>
                ) : complaintsError && reports.length === 0 ? (
                  <div
                    className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-xs flex items-center justify-between gap-2"
                    data-testid="overview-complaints-error"
                  >
                    <span className="text-rose-700 dark:text-rose-300 font-medium truncate">
                      {complaintsError}
                    </span>
                    <button
                      type="button"
                      onClick={loadComplaintsData}
                      className="px-2.5 py-1 rounded bg-rose-600 text-white text-[11px] font-semibold shrink-0 cursor-pointer"
                      data-testid="overview-retry-complaints-btn"
                    >
                      Retry
                    </button>
                  </div>
                ) : reports.length > 0 ? (
                  <div className="space-y-1.5">
                    {reports.slice(0, 2).map((r) => (
                      <div
                        key={r.id}
                        onClick={() => setSelectedReportDetail(r)}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-100 dark:border-white/[0.07] text-xs cursor-pointer hover:border-slate-300 dark:hover:border-white/[0.16] transition-colors"
                        data-testid={`overview-complaint-item-${r.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-slate-900 dark:text-white">{r.id}</span>
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#1B1D22] text-slate-700 dark:text-[#C5C8D0]">
                            {r.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-[#8C93A4] mt-0.5 truncate">
                          {r.location_name}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-3 text-center text-xs text-slate-400 dark:text-[#7A8191]">No complaints logged</p>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSection("complaints")}
                    className="text-xs font-medium text-blue-600 dark:text-[#9AC2FA] hover:underline flex items-center gap-1 cursor-pointer"
                    data-testid="overview-triage-complaints-btn"
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 3. Emergency Operations & SOS Summary */}
              <div
                className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)] space-y-3"
                data-testid="overview-panel-emergency"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Siren className="w-4 h-4 text-rose-500" />
                    <span>Emergency Operations</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {activeSOSCount > 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25">
                        {activeSOSCount} SOS
                      </span>
                    )}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#161920] text-slate-600 dark:text-[#C5C8D0] border border-slate-200 dark:border-white/[0.08]">
                      {effectiveActiveEmergenciesCount} Active
                    </span>
                  </div>
                </div>

                {emergencyLoading && emergencyCorridors.length === 0 ? (
                  <div className="h-10 rounded-lg bg-slate-100 dark:bg-[#1B1D22] animate-pulse" />
                ) : emergencyCorridors.length > 0 ? (
                  <div className="space-y-1.5">
                    {emergencyCorridors.slice(0, 2).map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setSection("emergency")}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-100 dark:border-white/[0.07] text-xs cursor-pointer hover:border-slate-300 dark:hover:border-white/[0.16] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-slate-900 dark:text-white">{c.id}</span>
                          <span
                            className={`text-[9px] font-mono uppercase font-semibold px-1.5 py-0.5 rounded ${
                              c.vehicle_type === "sos"
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                : "bg-[#9AC2FA]/15 text-blue-700 dark:text-[#9AC2FA]"
                            }`}
                          >
                            {c.vehicle_type.toUpperCase()} • {c.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-[#8C93A4] mt-0.5 truncate">
                          ➔ {c.destination_name}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-3 text-center text-xs text-slate-400 dark:text-[#7A8191]">
                    No emergency corridors active
                  </p>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSection("emergency")}
                    className="text-xs font-medium text-blue-600 dark:text-[#9AC2FA] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Access Row: Analytics & Federated Learning Lab */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-[#161920] border border-blue-200 dark:border-white/[0.08] text-blue-600 dark:text-[#9AC2FA] shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-medium text-slate-900 dark:text-white">
                    Traffic & Resolution Analytics
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#8C93A4] mt-1 leading-relaxed">
                    Diurnal speed forecasts, corridor incident density, and municipal resolution trends ({resolvedCount} resolved).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSection("analytics")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-[#161920] hover:bg-slate-200 dark:hover:bg-white/[0.06] text-slate-800 dark:text-[#EAECEF] border border-slate-200 dark:border-white/[0.12] text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                data-testid="overview-open-analytics-btn"
              >
                <span>Open Analytics</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#9AC2FA]" />
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-[#161920] border border-blue-200 dark:border-white/[0.08] text-blue-600 dark:text-[#9AC2FA] shrink-0">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-medium text-slate-900 dark:text-white">
                    Federated Learning Lab (PS-003)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#8C93A4] mt-1 leading-relaxed">
                    PeMS08 three-seed benchmarks, IID vs. Non-IID shift analysis, Top-K/INT8 compression & byte accounting.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/federated")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 dark:bg-[#9AC2FA] dark:hover:bg-[#B0D0FC] text-white dark:text-[#0A0D14] text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                data-testid="overview-open-fl-btn"
              >
                <span>Open FL Lab</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 2: DEDICATED LIVE MAP COMMAND CENTER                 */}
      {/* ============================================================ */}
      {(activeSection === "live_map" || activeSection === "monitoring") && (
        <Suspense fallback={<LoadingFallback variant="section" label="Loading Live Map Telemetry..." />}>
          <AuthorityDedicatedLiveMap
            telemetryData={telemetryData}
            loading={trafficLoading}
            trafficError={trafficError}
            initialIntersections={intersections}
            reports={reports}
            incidents={incidents}
            emergencyCorridors={emergencyCorridors}
            onRefresh={loadTrafficData}
            onOpenReportDetail={(rep) => setSelectedReportDetail(rep)}
            onOpenResolutionAction={(rep, target) =>
              setResolutionModalState({ report: rep, targetStatus: target })
            }
          />
        </Suspense>
      )}

      {/* ============================================================ */}
      {/* SECTION 3: CITIZEN COMPLAINTS (Centralized)                  */}
      {/* ============================================================ */}
      {activeSection === "complaints" && (
        <div className="space-y-4">
          <Suspense fallback={<LoadingFallback variant="section" label="Loading Citizen Complaints..." />}>
            <AuthorityComplaintTable
              reports={reports}
              loading={complaintsLoading}
              error={complaintsError}
              onRetry={loadComplaintsData}
              activeStatusFilter="all"
              onOpenDetail={(rep) => setSelectedReportDetail(rep)}
              onOpenResolutionAction={(rep, target) =>
                setResolutionModalState({ report: rep, targetStatus: target })
              }
              onShareIncident={(rep) => handleShareIncident(rep)}
            />
          </Suspense>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 4: EMERGENCY OPERATIONS CENTER                       */}
      {/* ============================================================ */}
      {activeSection === "emergency" && (
        <Suspense fallback={<LoadingFallback variant="section" label="Loading Emergency Operations..." />}>
          <AuthorityEmergencyOperations
            corridors={emergencyCorridors}
            stats={emergencyStats}
            loading={emergencyLoading}
            onUpdateStatus={handleUpdateEmergencyStatus}
            onRefresh={loadEmergencyData}
          />
        </Suspense>
      )}

      {/* ============================================================ */}
      {/* SECTION 5: ANALYTICS                                         */}
      {/* ============================================================ */}
      {activeSection === "analytics" && (
        <div data-testid="authority-analytics-view">
          <Suspense fallback={<LoadingFallback variant="section" label="Loading Analytics Charts..." />}>
            <AuthorityAnalyticsCharts
              stats={stats}
              emergencyStats={emergencyStats}
              telemetryData={telemetryData}
              loading={complaintsLoading && emergencyLoading}
            />
          </Suspense>
        </div>
      )}

      {/* MODAL 1: Complaint Detail & Evidence Review */}
      {selectedReportDetail && (
        <Suspense fallback={null}>
          <AuthorityReportDetailModal
            report={selectedReportDetail}
            onClose={() => setSelectedReportDetail(null)}
            onSelectAction={(rep, target) => {
              setResolutionModalState({ report: rep, targetStatus: target });
            }}
            onShareReport={(rep) => handleShareIncident(rep)}
          />
        </Suspense>
      )}

      {/* MODAL 2: Status Update Confirmation Modal */}
      {resolutionModalState && (
        <Suspense fallback={null}>
          <AuthorityResolutionModal
            report={resolutionModalState.report}
            targetStatus={resolutionModalState.targetStatus}
            isSubmitting={isUpdatingStatus}
            onClose={() => setResolutionModalState(null)}
            onConfirm={handleConfirmReportStatus}
          />
        </Suspense>
      )}

      {/* MODAL 3: Global Share Modal */}
      {isShareModalOpen && shareData && (
        <Suspense fallback={null}>
          <ShareModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            data={shareData}
          />
        </Suspense>
      )}

      {/* MODAL 4: Demo Scenario Simulator Modal (Authority Only - loaded only when opened) */}
      {isSimulatorModalOpen && (
        <Suspense fallback={null}>
          <AuthorityScenarioSimulatorModal
            onNavigateToLiveMap={() => setSection("live_map")}
            onNavigateToEmergency={() => setSection("emergency")}
          />
        </Suspense>
      )}

      {/* MODAL 5: Municipal AI Advisory Detail Modal */}
      {selectedAdvisoryDetail && (
        <Suspense fallback={null}>
          <AuthorityAIAdvisoryDetailModal
            advisory={selectedAdvisoryDetail}
            onClose={() => setSelectedAdvisoryDetail(null)}
            onViewOnLiveMap={(adv) => {
              setSelectedAdvisoryDetail(null);
              handleViewAdvisoryOnLiveMap(adv);
            }}
            onCompareRoutes={(adv) => {
              setSelectedAdvisoryDetail(null);
              handleCompareAdvisoryRoutes(adv);
            }}
            onBroadcastAdvisory={(adv) => {
              setSelectedAdvisoryDetail(null);
              setBroadcastAdvisory(adv);
            }}
            onDismissAdvisory={(id) => {
              setSelectedAdvisoryDetail(null);
              handleDismissAdvisory(id);
            }}
          />
        </Suspense>
      )}

      {/* MODAL 6: Broadcast Alert Confirmation Modal */}
      {broadcastAdvisory && (
        <Suspense fallback={null}>
          <AuthorityBroadcastConfirmModal
            advisory={broadcastAdvisory}
            onClose={() => setBroadcastAdvisory(null)}
            onSuccess={handleBroadcastSuccess}
          />
        </Suspense>
      )}

      {/* MODAL 7: Municipal Advisory History & Audit Log Modal (loaded only when opened) */}
      {isHistoryModalOpen && (
        <Suspense fallback={null}>
          <AuthorityAdvisoryHistoryModal
            isOpen={isHistoryModalOpen}
            onClose={() => setIsHistoryModalOpen(false)}
            onSelectAdvisory={(adv) => {
              setIsHistoryModalOpen(false);
              handleViewAdvisoryOnLiveMap(adv);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export const OverviewDashboard: React.FC = () => {
  return (
    <SimulationProvider>
      <OverviewDashboardContent />
    </SimulationProvider>
  );
};

export default OverviewDashboard;

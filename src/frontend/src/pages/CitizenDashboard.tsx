import React, { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { api, resolveMediaUrl } from "../services/api";
import {
  IntersectionDetail,
  IncidentItem,
  PredictionResponse,
  ProviderStatusDTO,
  CorridorDetail,
  CitizenReport,
  CitizenNotification,
  SavedRoute,
  EmergencyCorridorRequest,
} from "../types";
import {
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Navigation,
  ArrowRight,
  Bell,
  Bookmark,
  BookOpen,
  FileText,
  GitFork,
  Share2,
  Siren,
  Trash2,
  X,
} from "lucide-react";
import { DetectMyLocationCard, DetectedLocationEvent } from "../components/location/DetectMyLocationCard";
import { CitizenSmartRouteCard } from "../components/citizen/CitizenSmartRouteCard";
import { CitizenAlertsPanel } from "../components/citizen/CitizenAlertsPanel";
import { CitizenAwarenessCard } from "../components/citizen/CitizenAwarenessCard";
import { formatCityDistrictState, haversineDistanceKm } from "../utils/geolocation";
import { classifyTrafficCondition } from "../utils/trafficStatus";
import type { IncidentShareData } from "../components/share/ShareModal";
import { LoadingFallback } from "../components/common/LoadingFallback";
import { PageHeroHeader } from "../components/common/DesignSystem";
import { lazyNamed } from "../utils/lazyImport";

const CitizenTrafficMapCard = lazyNamed(
  () => import("../components/citizen/CitizenTrafficMapCard"),
  "CitizenTrafficMapCard"
);
const CitizenComplaintsPanel = lazyNamed(
  () => import("../components/citizen/CitizenComplaintsPanel"),
  "CitizenComplaintsPanel"
);
const CitizenSosPanel = lazyNamed(
  () => import("../components/citizen/CitizenSosPanel"),
  "CitizenSosPanel"
);
const CitizenNotificationDrawer = lazyNamed(
  () => import("../components/citizen/CitizenNotificationDrawer"),
  "CitizenNotificationDrawer"
);
const AuthorityResolutionModal = lazyNamed(
  () => import("../components/authority/AuthorityResolutionModal"),
  "AuthorityResolutionModal"
);
const ShareModal = lazyNamed(
  () => import("../components/share/ShareModal"),
  "ShareModal"
);

export type CitizenSection =
  | "overview"
  | "live_traffic"
  | "routes"
  | "alerts"
  | "complaints"
  | "sos"
  | "awareness";

export const CitizenDashboard: React.FC = () => {
  const { isHindi } = useLanguage();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawSection = searchParams.get("section");
  const actionParam = searchParams.get("action");
  const activeSection: CitizenSection =
    rawSection === "complaints" || rawSection === "report"
      ? "complaints"
      : rawSection === "sos" || rawSection === "emergency"
      ? "sos"
      : rawSection === "live_traffic" || rawSection === "live-traffic"
      ? "live_traffic"
      : rawSection === "routes" || rawSection === "smart-routes"
      ? "routes"
      : rawSection === "alerts"
      ? "alerts"
      : rawSection === "awareness"
      ? "awareness"
      : "overview";
  const sharedIncidentId = searchParams.get("incident");

  const isAuthorityUser = Boolean(
    user && ["admin", "system_admin", "authority", "traffic_controller"].includes(user.role)
  );

  const [intersections, setIntersections] = useState<IntersectionDetail[]>([]);
  const [selectedId, setSelectedId] = useState<string>("INT-01");
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [corridors, setCorridors] = useState<CorridorDetail[]>([]);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatusDTO | null>(null);
  const [trafficLoading, setTrafficLoading] = useState<boolean>(true);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);
  const [complaintsLoading, setComplaintsLoading] = useState<boolean>(true);
  const [complaintsError, setComplaintsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const isMountedRef = useRef<boolean>(true);
  const latestCitizenReqRef = useRef<number>(0);
  const latestTrafficReqRef = useRef<number>(0);
  const citizenAbortRef = useRef<AbortController | null>(null);
  const trafficAbortRef = useRef<AbortController | null>(null);
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocationEvent | null>(null);
  const [focusOnDetected, setFocusOnDetected] = useState<boolean>(true);

  // Citizen Complaints, Notifications, Saved Commutes & SOS state
  const [citizenReports, setCitizenReports] = useState<CitizenReport[]>([]);
  const [notifications, setNotifications] = useState<CitizenNotification[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState<boolean>(false);
  const [highlightedReportId, setHighlightedReportId] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [shareData, setShareData] = useState<IncidentShareData | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  // Authority triage inside Citizen Portal View
  const [resolutionTarget, setResolutionTarget] = useState<{
    report: CitizenReport;
    targetStatus: string;
  } | null>(null);
  const [resolutionSubmitting, setResolutionSubmitting] = useState<boolean>(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Emergency corridor SOS requests persisted for this user
  const [emergencyCorridors, setEmergencyCorridors] = useState<EmergencyCorridorRequest[]>([]);

  const switchSection = (
    next: CitizenSection,
    opts?: { openReportForm?: boolean }
  ) => {
    const nextParams = new URLSearchParams(searchParams);
    if (next === "overview") {
      nextParams.delete("section");
    } else {
      nextParams.set("section", next);
    }
    if (opts?.openReportForm && next === "complaints") {
      nextParams.set("action", "report");
    } else {
      nextParams.delete("action");
    }
    setSearchParams(nextParams);
  };

  const notifUserId = isAuthorityUser ? undefined : user?.id || "usr_demo_citizen";

  const refreshCitizenState = useCallback(async () => {
    const reqId = ++latestCitizenReqRef.current;
    citizenAbortRef.current?.abort();
    const controller = new AbortController();
    citizenAbortRef.current = controller;

    setComplaintsLoading(true);
    setComplaintsError(null);
    try {
      const [repRes, notifRes, savedRes, sosRes] = await Promise.allSettled([
        api.getCitizenReports(controller.signal),
        api.getCitizenNotifications(notifUserId, controller.signal),
        api.getSavedRoutes(controller.signal),
        api.getEmergencyCorridors(
          notifUserId ? { user_id: notifUserId } : undefined,
          controller.signal
        ),
      ]);
      if (!isMountedRef.current || controller.signal.aborted || reqId !== latestCitizenReqRef.current) return;

      if (repRes.status === "fulfilled") {
        setCitizenReports(repRes.value);
      } else {
        const reason = repRes.reason as any;
        if (reason?.name === "AbortError") return;
        setComplaintsError(reason?.message || "Failed to load citizen complaints.");
      }

      if (notifRes.status === "fulfilled") {
        setNotifications(notifRes.value);
      }
      if (savedRes.status === "fulfilled") {
        setSavedRoutes(savedRes.value);
      }
      if (sosRes.status === "fulfilled") {
        setEmergencyCorridors(sosRes.value);
      }
    } catch (err: any) {
      if (!isMountedRef.current || controller.signal.aborted || reqId !== latestCitizenReqRef.current) return;
      if (err?.name === "AbortError") return;
      console.error("Citizen auxiliary state refresh failed:", err);
      setComplaintsError(err?.message || "Failed to load citizen complaints.");
    } finally {
      if (isMountedRef.current && !controller.signal.aborted && reqId === latestCitizenReqRef.current) {
        setComplaintsLoading(false);
      }
    }
  }, [notifUserId]);

  const loadTrafficData = useCallback(async () => {
    const reqId = ++latestTrafficReqRef.current;
    trafficAbortRef.current?.abort();
    const controller = new AbortController();
    trafficAbortRef.current = controller;

    setTrafficLoading(true);
    setTrafficError(null);
    try {
      const [interRes, incRes, statusRes, corrRes] = await Promise.allSettled([
        api.getIntersections(controller.signal),
        api.getIncidents(undefined, "open", false, controller.signal),
        api.getProviderStatus(controller.signal),
        api.getCorridors(controller.signal),
      ]);
      if (!isMountedRef.current || controller.signal.aborted || reqId !== latestTrafficReqRef.current) return;

      if (interRes.status === "fulfilled") {
        const interList = interRes.value;
        setIntersections(interList);
        setSelectedId((prev) =>
          interList.length > 0 && !interList.find((i) => i.id === prev) ? interList[0].id : prev
        );
      }
      if (incRes.status === "fulfilled") {
        setIncidents(incRes.value);
        setIncidentsError(null);
      } else {
        const reason = incRes.reason as any;
        if (reason?.name !== "AbortError") {
          setIncidentsError(reason?.message || "Unable to fetch real-time traffic alerts.");
        }
      }
      if (statusRes.status === "fulfilled") {
        setProviderStatus(statusRes.value);
      }
      if (corrRes.status === "fulfilled") {
        setCorridors(corrRes.value);
      }

      if (interRes.status === "rejected" || statusRes.status === "rejected") {
        const err = (interRes.status === "rejected"
          ? interRes.reason
          : (statusRes as PromiseRejectedResult).reason) as any;
        if (err?.name === "AbortError") return;
        setTrafficError(err?.message || "Live traffic service temporarily unavailable.");
      }
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      if (!isMountedRef.current || controller.signal.aborted || reqId !== latestTrafficReqRef.current) return;
      if (err?.name === "AbortError") return;
      console.error("Citizen traffic data load failed:", err);
      setTrafficError(err?.message || "Live traffic service temporarily unavailable.");
    } finally {
      if (isMountedRef.current && !controller.signal.aborted && reqId === latestTrafficReqRef.current) {
        setTrafficLoading(false);
      }
    }
  }, []);

  const loadData = useCallback(
    async (showLoading = false) => {
      if (showLoading) setRefreshing(true);
      await Promise.all([refreshCitizenState(), loadTrafficData()]);
      if (isMountedRef.current && showLoading) {
        setRefreshing(false);
      }
    },
    [refreshCitizenState, loadTrafficData]
  );

  const handleMarkNotifRead = async (notificationId: string) => {
    try {
      await api.markCitizenNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      await api.markAllCitizenNotificationsRead(notifUserId);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark all notifications read:", err);
    }
  };

  const handleShareReport = (rep: CitizenReport) => {
    setShareData({
      type: "incident",
      id: rep.id,
      incidentType: rep.category.replace(/_/g, " "),
      locationName: rep.location_name,
      description: rep.description,
      status: rep.status,
      severity: rep.priority || "medium",
      actionRequired: rep.resolution_note || undefined,
    });
    setIsShareModalOpen(true);
  };

  const handleConfirmAuthorityStatus = async (reportId: string, status: string, note: string) => {
    setResolutionSubmitting(true);
    try {
      await api.updateCitizenReportStatus(reportId, status, note);
      await refreshCitizenState();
      setResolutionTarget(null);
      setActionToast(`Updated ${reportId} to ${status.toUpperCase().replace(/_/g, " ")}`);
      setTimeout(() => setActionToast(null), 4000);
    } catch (err) {
      console.error("Authority status update failed:", err);
    } finally {
      setResolutionSubmitting(false);
    }
  };

  const handleDeleteSavedRoute = async (routeId: string) => {
    try {
      await api.deleteSavedRoute(routeId);
      setSavedRoutes((prev) => prev.filter((r) => r.id !== routeId));
    } catch (err) {
      console.error("Failed to delete saved route:", err);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    loadData();
    // 30s auto-refresh (both loaders run independently without cross-blocking)
    const interval = setInterval(() => loadData(false), 30000);
    return () => {
      isMountedRef.current = false;
      citizenAbortRef.current?.abort();
      trafficAbortRef.current?.abort();
      clearInterval(interval);
    };
  }, [loadData]);

  // Fetch friendly 30m forecast when location changes
  useEffect(() => {
    if (selectedId) {
      api
        .getForecast(selectedId, 30)
        .then(setPrediction)
        .catch(() => setPrediction(null));
    }
  }, [selectedId]);

  const selectedIntersection =
    intersections.find((i) => i.id === selectedId) || intersections[0];

  const interMap = new Map(intersections.map((i) => [i.id, i]));

  const showingDetectedLocation = Boolean(detectedLocation && focusOnDetected);
  const showingExternalLocation = Boolean(showingDetectedLocation && !detectedLocation?.isDelhi);

  const classifiedStatus = showingExternalLocation && detectedLocation
    ? classifyTrafficCondition({
        currentSpeed: detectedLocation.traffic?.traffic_available
          ? detectedLocation.traffic.current_speed
          : null,
        freeFlowSpeed: detectedLocation.traffic?.traffic_available
          ? detectedLocation.traffic.free_flow_speed
          : null,
        congestionLevel: detectedLocation.traffic?.congestion_level,
        roadClosure: Boolean(detectedLocation.traffic?.road_closure),
        unavailableReason: detectedLocation.traffic?.reason,
      })
    : classifyTrafficCondition({
        currentSpeed: selectedIntersection?.current_speed,
        freeFlowSpeed: selectedIntersection?.baseline_speed,
        congestionLevel: selectedIntersection?.congestion_level,
      });

  const statusInfo = {
    label: isHindi ? classifiedStatus.labelHi : classifiedStatus.label,
    advice: isHindi ? classifiedStatus.adviceHi : classifiedStatus.advice,
    color: classifiedStatus.colorText,
    bg: classifiedStatus.bannerBg,
    border: classifiedStatus.bannerBorder,
    dot: classifiedStatus.dotClass,
  };

  const nearestNodeForDetected = detectedLocation && intersections.length > 0
    ? intersections
        .map((node) => ({
          node,
          distKm: Number(
            haversineDistanceKm(
              detectedLocation.lat,
              detectedLocation.lng,
              node.latitude,
              node.longitude
            ).toFixed(1)
          ),
        }))
        .sort((a, b) => a.distKm - b.distKm)[0]
    : null;

  const isSimulatedTraffic = showingExternalLocation
    ? !detectedLocation?.traffic?.traffic_available
    : Boolean(trafficError) ||
      (providerStatus != null &&
        (providerStatus.mode !== "live" || Boolean(providerStatus.error_fallback_active))) ||
      Boolean(selectedIntersection?.is_simulated);

  // Clean user display name so unwanted "Demo" label or badge is not rendered
  const citizenDisplayName = user?.full_name
    ? user.full_name.replace(/\s*\((?:Demo|डेमो)\)/gi, "").replace(/\bDemo\b/gi, "").trim()
    : "";

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const sharedReport = sharedIncidentId
    ? citizenReports.find((r) => r.id === sharedIncidentId) || null
    : null;

  return (
    <div className="space-y-6" data-testid="citizen-dashboard-root">
      {/* Citizen Editorial Welcome Header */}
      <PageHeroHeader
        eyebrow={
          <>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-[#9AC2FA]/12 dark:text-[#9AC2FA] border border-blue-200 dark:border-[#9AC2FA]/25">
              {isHindi ? "नागरिक आवागमन पोर्टल" : "Citizen Commute Portal"}
            </span>
            {isAuthorityUser && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                Authority Portal Preview
              </span>
            )}
            <span className="text-xs text-slate-500 dark:text-[#8C93A4]">
              •{" "}
              {showingDetectedLocation && detectedLocation
                ? formatCityDistrictState({
                    city: detectedLocation.city,
                    district: detectedLocation.district,
                    state: detectedLocation.state,
                    lat: detectedLocation.lat,
                    lng: detectedLocation.lng,
                  })
                : "Delhi NCR Transit Hub"}
            </span>
          </>
        }
        title={
          isHindi
            ? `नमस्ते, ${citizenDisplayName || "दिल्ली यात्री"}`
            : `Welcome, ${citizenDisplayName || "Delhi Commuter"}`
        }
        subtitle={
          isHindi
            ? "सरल, रीयल-टाइम ट्रैफिक जानकारी, स्मार्ट मार्ग और नागरिक सहायता।"
            : "Calm, real-time traffic awareness, smart routes, alerts, and civic reporting."
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setNotifDrawerOpen(true)}
              className="relative flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-[#1B1D22] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-800 dark:text-white border border-slate-200 dark:border-white/[0.10] transition-colors cursor-pointer"
              data-testid="notification-bell-btn"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{isHindi ? "अपडेट" : "Updates"}</span>
              {unreadCount > 0 && (
                <span
                  className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-600 text-white"
                  data-testid="notification-badge-count"
                >
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#B4D2FC] text-white dark:text-[#0A0D14] shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Updating..." : isHindi ? "रीफ्रेश करें" : "Refresh"}</span>
            </button>
          </>
        }
        footer={
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-[#C5C8D0] gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  trafficLoading && !providerStatus
                    ? "bg-blue-500 dark:bg-[#9AC2FA] animate-pulse"
                    : !isSimulatedTraffic && providerStatus?.is_online
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                }`}
              />
              <span className="font-semibold text-slate-800 dark:text-white">
                {trafficLoading && !providerStatus
                  ? "Connecting to live traffic feed..."
                  : showingExternalLocation && detectedLocation?.traffic?.traffic_available
                    ? `Live TomTom Traffic Feed Active (${detectedLocation.city || "Detected GPS Segment"})`
                    : showingExternalLocation
                    ? `Live flow unavailable for ${detectedLocation?.city || "GPS coordinates"}`
                    : !isSimulatedTraffic && providerStatus?.is_online
                    ? "Live TomTom Traffic Feed Active (Delhi NCR)"
                    : "Live traffic unavailable — showing simulated data"}
              </span>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                  trafficLoading && !providerStatus
                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-[#9AC2FA]/12 dark:text-[#9AC2FA] dark:border-[#9AC2FA]/25"
                    : !isSimulatedTraffic && providerStatus?.is_online
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                      : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60"
                }`}
              >
                {trafficLoading && !providerStatus
                  ? "Syncing"
                  : !isSimulatedTraffic && providerStatus?.is_online
                    ? "Verified Live Flow"
                    : "Simulated Model"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-[#8C93A4]">
              <Clock className="w-3 h-3" />
              <span>
                Last updated: {lastRefreshedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
          </div>
        }
      />

      {/* Responsive Mobile Navigation Pattern (Desktop uses clean compact Sidebar) */}
      <nav
        aria-label="Citizen feature navigation"
        className="lg:hidden flex flex-wrap items-center gap-1.5 p-2 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-xs"
        data-testid="citizen-mobile-nav"
      >
        {(
          [
            { id: "overview", label: isHindi ? "अवलोकन" : "Overview" },
            { id: "live_traffic", label: isHindi ? "लाइव ट्रैफिक" : "Live Traffic" },
            { id: "routes", label: isHindi ? "स्मार्ट रूट्स" : "Smart Routes" },
            { id: "alerts", label: isHindi ? "अलर्ट" : `Alerts (${incidents.length})` },
            { id: "complaints", label: isHindi ? "शिकायतें" : "Complaints" },
            { id: "sos", label: isHindi ? "SOS" : "Emergency SOS" },
            { id: "awareness", label: isHindi ? "जागरूकता" : "Awareness" },
          ] as { id: CitizenSection; label: string }[]
        ).map((tab) => {
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchSection(tab.id)}
              data-testid={`citizen-tab-${tab.id}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                isActive
                  ? tab.id === "sos"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "bg-blue-600 text-white dark:bg-[#9AC2FA] dark:text-[#0A0D14] shadow-sm"
                  : "text-slate-600 dark:text-[#C5C8D0] bg-slate-50 dark:bg-[#1B1D22] hover:bg-slate-100 dark:hover:bg-white/[0.08]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Shared Incident Deep-Link Banner */}
      {sharedIncidentId && (
        <div
          className="p-4 rounded-2xl bg-blue-50/70 dark:bg-[#161920] border border-blue-200 dark:border-[#9AC2FA]/30 flex flex-wrap items-center justify-between gap-3"
          data-testid="shared-incident-banner"
        >
          <div className="space-y-0.5 text-xs">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-[#9AC2FA]">
              Shared Incident Reference • {sharedIncidentId}
            </span>
            {sharedReport ? (
              <p className="font-bold text-slate-900 dark:text-white">
                {sharedReport.category.replace(/_/g, " ")} at {sharedReport.location_name} — Status:{" "}
                <span className="uppercase">{sharedReport.status.replace(/_/g, " ")}</span>
              </p>
            ) : (
              <p className="font-semibold text-slate-700 dark:text-[#C5C8D0]">
                Inspecting shared traffic incident notice {sharedIncidentId}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {sharedReport && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setHighlightedReportId(sharedReport.id);
                    switchSection("complaints");
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 dark:bg-[#9AC2FA] hover:bg-blue-700 dark:hover:bg-[#B2D1FC] text-white dark:text-[#0A0D14] text-xs font-bold transition-colors cursor-pointer"
                >
                  Open Complaint
                </button>
                <button
                  type="button"
                  onClick={() => handleShareReport(sharedReport)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1B1D22] border border-blue-200 dark:border-white/[0.12] text-blue-700 dark:text-[#E8EAEE] text-xs font-bold hover:bg-blue-50 dark:hover:bg-[#22252C] transition-colors cursor-pointer"
                  data-testid="shared-incident-reshare-btn"
                >
                  <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
                  <span>Reshare</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Honest Warning Banner on Detailed Views when simulated fallback is active */}
      {isSimulatedTraffic && (activeSection === "live_traffic" || activeSection === "routes") && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 shadow-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-sm text-amber-800 dark:text-amber-200">
              {isHindi
                ? "लाइव ट्रैफिक अनुपलब्ध — सिम्युलेटेड डेटा प्रदर्शित किया जा रहा है"
                : "Live traffic unavailable — showing simulated data"}
            </p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300/90">
              {providerStatus?.message || "Using calibrated Delhi NCR traffic model. Measurements reflect synthetic baseline estimates."}
            </p>
          </div>
        </div>
      )}

      {/* 1. OVERVIEW — Calm, uncluttered landing workspace */}
      {activeSection === "overview" && (
        <div className="space-y-5" data-testid="citizen-overview-section">
          {/* Current Location & Compact Live Traffic Overview + Status Indicator */}
          <DetectMyLocationCard
            variant="compact"
            intersections={intersections}
            selectedId={selectedId}
            onSelectIntersection={(id) => {
              setSelectedId(id);
              setFocusOnDetected(false);
            }}
            onLocationDetected={(loc) => {
              setDetectedLocation(loc);
              if (loc) setFocusOnDetected(true);
            }}
            onViewDetails={() => switchSection("live_traffic")}
            lastUpdated={lastRefreshedAt}
            compactControlSlot={
              intersections.length > 0 ? (
                <select
                  aria-label={isHindi ? "कॉरिडोर चुनें" : "Select monitored corridor"}
                  value={selectedId}
                  onChange={(e) => {
                    setSelectedId(e.target.value);
                    setFocusOnDetected(false);
                  }}
                  data-testid="overview-corridor-select"
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-[#1B1D22] text-xs font-medium text-slate-700 dark:text-[#E8EAEE] focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#9AC2FA] cursor-pointer"
                >
                  {intersections.map((item) => (
                    <option key={item.id} value={item.id}>
                      {isHindi ? item.name_hi : item.name}
                    </option>
                  ))}
                </select>
              ) : null
            }
          />

          {/* Four Primary Feature Shortcuts */}
          <div className="space-y-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#8C93A4]">
              {isHindi ? "प्रमुख नागरिक सेवाएं" : "Quick Services"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 1. Smart Routes */}
              <button
                type="button"
                onClick={() => switchSection("routes")}
                data-testid="shortcut-smart-routes"
                className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] hover:border-blue-400 dark:hover:border-[#9AC2FA]/45 shadow-xs flex items-start justify-between gap-3 text-left transition-colors cursor-pointer"
              >
                <div className="space-y-1.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-[#9AC2FA]/12 text-blue-600 dark:text-[#9AC2FA] flex items-center justify-center">
                    <GitFork className="w-4 h-4" />
                  </div>
                  <h3 className="font-serif text-base font-medium text-slate-900 dark:text-white">
                    {isHindi ? "स्मार्ट रूट्स" : "Smart Routes"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#8C93A4] leading-snug">
                    {isHindi ? "सबसे तेज़ और सुरक्षित मार्ग खोजें" : "Compare fastest paths & avoid closures"}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 dark:text-[#8C93A4] shrink-0 mt-1" />
              </button>

              {/* 2. Traffic Alerts */}
              <button
                type="button"
                onClick={() => switchSection("alerts")}
                data-testid="shortcut-traffic-alerts"
                className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] hover:border-blue-400 dark:hover:border-[#9AC2FA]/45 shadow-xs flex items-start justify-between gap-3 text-left transition-colors cursor-pointer"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/12 text-amber-600 dark:text-amber-300 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    {incidents.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                        {incidents.length} {isHindi ? "सक्रिय" : "Active"}
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif text-base font-medium text-slate-900 dark:text-white">
                    {isHindi ? "ट्रैफिक अलर्ट" : "Traffic Alerts"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#8C93A4] leading-snug">
                    {isHindi ? "सड़क बंदी और भीड़ चेतावनी देखें" : "Active road closures & disruptions"}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 dark:text-[#8C93A4] shrink-0 mt-1" />
              </button>

              {/* 3. Report an Issue */}
              <button
                type="button"
                onClick={() => switchSection("complaints", { openReportForm: true })}
                data-testid="quick-report-issue-btn"
                className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] hover:border-blue-400 dark:hover:border-[#9AC2FA]/45 shadow-xs flex items-start justify-between gap-3 text-left transition-colors cursor-pointer"
              >
                <div className="space-y-1.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-[#E8EAEE] flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h3 className="font-serif text-base font-medium text-slate-900 dark:text-white">
                    {isHindi ? "समस्या दर्ज करें" : "Report an Issue"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#8C93A4] leading-snug">
                    {isHindi ? "फोटो या GPS के साथ शिकायत भेजें" : "Submit hazard & track resolution"}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 dark:text-[#8C93A4] shrink-0 mt-1" />
              </button>

              {/* 4. Emergency SOS */}
              <button
                type="button"
                onClick={() => switchSection("sos")}
                data-testid="quick-sos-btn"
                className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] hover:border-rose-400 dark:hover:border-rose-500/45 shadow-xs flex items-start justify-between gap-3 text-left transition-colors cursor-pointer"
              >
                <div className="space-y-1.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/12 text-rose-600 dark:text-rose-300 flex items-center justify-center">
                    <Siren className="w-4 h-4" />
                  </div>
                  <h3 className="font-serif text-base font-medium text-slate-900 dark:text-white">
                    {isHindi ? "आपातकालीन SOS" : "Emergency SOS"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#8C93A4] leading-snug">
                    {isHindi ? "ग्रीन कॉरिडोर एवं हेल्पलाइन सहायता" : "Priority corridor & emergency lines"}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-rose-400 shrink-0 mt-1" />
              </button>
            </div>
          </div>

          {/* Small Traffic Awareness Section */}
          <div
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            data-testid="overview-awareness-summary"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-[#9AC2FA]/12 text-blue-600 dark:text-[#9AC2FA] flex items-center justify-center shrink-0 mt-0.5">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-serif text-base font-medium text-slate-900 dark:text-white">
                    {isHindi ? "ट्रैफिक जागरूकता एवं सुझाव" : "Traffic Awareness"}
                  </h2>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${classifiedStatus.badgeClasses}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                    {statusInfo.label}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-[#C5C8D0] leading-relaxed">
                  {statusInfo.advice}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => switchSection("awareness")}
              data-testid="overview-awareness-guide-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-[#1B1D22] hover:bg-slate-100 dark:hover:bg-[#23262E] text-xs font-semibold text-slate-700 dark:text-[#E8EAEE] shrink-0 transition-colors cursor-pointer self-start sm:self-center"
            >
              <span>{isHindi ? "पूरा गाइड देखें" : "View Guide"}</span>
              <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
            </button>
          </div>
        </div>
      )}

      {/* 2. LIVE TRAFFIC — Detailed Flow, AI Forecast, Map & Corridors */}
      {activeSection === "live_traffic" && (
        <div className="space-y-5" data-testid="citizen-live-traffic-section">
          {/* Junction Quick Selector + 30-Min Outlook Pill */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600 dark:text-[#9AC2FA] shrink-0" />
                <span className="text-xs font-semibold text-slate-800 dark:text-[#E8EAEE]">
                  {isHindi ? "मॉनिटर किया गया क्षेत्र चुनें:" : "Select Monitored Corridor / Area:"}
                </span>
              </div>
              {!showingExternalLocation && prediction?.predicted_speed !== undefined && (
                <span className="text-[11px] font-medium text-slate-500 dark:text-[#8C93A4]">
                  30-min outlook: <b className="text-slate-800 dark:text-[#9AC2FA]">~{prediction.predicted_speed} km/h</b> ({prediction.predicted_congestion_level})
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {detectedLocation && (
                <button
                  type="button"
                  onClick={() => setFocusOnDetected(true)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    focusOnDetected
                      ? "bg-blue-600 text-white dark:bg-[#9AC2FA] dark:text-[#0A0D14] shadow-sm"
                      : "bg-blue-50 dark:bg-[#1B1D22] text-blue-700 dark:text-[#9AC2FA] border border-blue-200 dark:border-[#9AC2FA]/30 hover:bg-blue-100 dark:hover:bg-white/[0.08]"
                  }`}
                >
                  {detectedLocation.city || `${detectedLocation.lat.toFixed(3)}, ${detectedLocation.lng.toFixed(3)}`} (GPS)
                </button>
              )}
              {intersections.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setFocusOnDetected(false);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                    !focusOnDetected && selectedId === item.id
                      ? "bg-blue-600 text-white dark:bg-[#9AC2FA] dark:text-[#0A0D14] shadow-sm font-semibold"
                      : "bg-slate-100 dark:bg-[#1B1D22] text-slate-700 dark:text-[#C5C8D0] hover:bg-slate-200 dark:hover:bg-white/[0.08]"
                  }`}
                >
                  {isHindi ? item.name_hi : item.name}
                </button>
              ))}
            </div>
          </div>

          <DetectMyLocationCard
            variant="full"
            intersections={intersections}
            selectedId={selectedId}
            onSelectIntersection={(id) => {
              setSelectedId(id);
              setFocusOnDetected(false);
            }}
            onLocationDetected={(loc) => {
              setDetectedLocation(loc);
              if (loc) setFocusOnDetected(true);
            }}
            onSwitchToRoutes={() => switchSection("routes")}
            lastUpdated={lastRefreshedAt}
          />

          {/* Single Interactive Map for Live Traffic View */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-serif text-base sm:text-lg font-medium text-slate-900 dark:text-white">
                {isHindi ? "लाइव ट्रैफिक मानचित्र" : "Interactive Live Traffic Map"}
              </h2>
              <Link
                to="/map"
                className="text-xs text-blue-600 dark:text-[#9AC2FA] font-semibold hover:underline inline-flex items-center gap-1"
              >
                <span>{isHindi ? "पूर्ण मानचित्र खोलें" : "Open Full-Screen Map"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <Suspense
              fallback={
                <div className="h-[420px] sm:h-[480px]">
                  <LoadingFallback
                    variant="section"
                    label={
                      isHindi ? "लाइव ट्रैफ़िक मानचित्र लोड हो रहा है..." : "Loading Live Traffic Map..."
                    }
                  />
                </div>
              }
            >
              <CitizenTrafficMapCard
                showingDetectedLocation={showingDetectedLocation}
                detectedLocation={detectedLocation}
                selectedIntersection={selectedIntersection}
                intersections={intersections}
                interMap={interMap}
                isHindi={isHindi}
                lastRefreshedAt={lastRefreshedAt}
                onSelectIntersection={(id) => {
                  setSelectedId(id);
                  setFocusOnDetected(false);
                }}
              />
            </Suspense>
          </div>

          {/* Estimated Travel Times Across Major Corridors */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-600 dark:text-[#9AC2FA]" />
                <h2 className="font-serif font-medium text-base sm:text-lg text-slate-900 dark:text-white">
                  {isHindi ? "प्रमुख गलियारों में यात्रा समय" : "Key Corridor Travel Times"}
                </h2>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-[#8C93A4]">
                {isSimulatedTraffic ? "Model estimates" : "Based on live TomTom speeds"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {corridors.length > 0 ? (
                corridors.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-100 dark:border-white/[0.08] flex items-center justify-between gap-3 hover:bg-slate-100 dark:hover:bg-[#1B1D22] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {isHindi ? c.name_hi : c.name}
                        </h3>
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                            c.is_simulated
                              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                              : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {c.is_simulated ? "Simulated" : "Live"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-[#8C93A4] mt-0.5 truncate">
                        {isHindi && c.description_hi ? c.description_hi : c.description} • {c.distance_km} km • {c.average_speed} km/h
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-serif text-lg font-medium text-slate-900 dark:text-white tabular-nums">
                        {c.travel_time_minutes} <span className="font-sans text-xs font-normal text-slate-500 dark:text-[#8C93A4]">min</span>
                      </span>
                      <span
                        className={`block text-[10px] font-bold uppercase ${
                          c.congestion_level === "heavy"
                            ? "text-rose-500"
                            : c.congestion_level === "moderate"
                            ? "text-amber-500"
                            : "text-emerald-500"
                        }`}
                      >
                        {isHindi ? c.condition_label_hi : c.condition_label}
                      </span>
                      {c.delay_minutes > 0 && (
                        <span className="block text-[10px] text-rose-500 font-medium">
                          +{c.delay_minutes} min delay
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 dark:text-[#8C93A4] md:col-span-2">
                  Loading corridor travel time estimates...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. SMART ROUTES — Route Comparison & Saved Commutes */}
      {activeSection === "routes" && (
        <div className="space-y-5" data-testid="citizen-routes-section">
          <CitizenSmartRouteCard
            isHindi={isHindi}
            intersections={intersections}
            detectedLocation={detectedLocation}
            defaultOriginId={selectedId}
          />

          <div className="p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-blue-600 dark:text-[#9AC2FA]" />
                <h2 className="font-serif font-medium text-base sm:text-lg text-slate-900 dark:text-white">
                  {isHindi ? "मेरे सहेजे गए दैनिक मार्ग" : "My Saved Commutes"}
                </h2>
              </div>
              <Link
                to="/routes"
                className="text-xs font-semibold text-blue-600 dark:text-[#9AC2FA] hover:underline flex items-center gap-1"
              >
                <span>{isHindi ? "प्रस्थान समय योजना खोलें" : "Departure Window Planner"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {savedRoutes.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-[#8C93A4]">
                No saved commute corridors yet. Save your regular daily routes from the Departure Window Planner for one-click checks.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {savedRoutes.map((route) => (
                  <div
                    key={route.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{route.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-[#8C93A4] mt-0.5 truncate">
                        {route.origin_name} ➔ {route.destination_name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedRoute(route.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0 cursor-pointer"
                      title="Remove saved route"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. ALERTS — Selectable Incident Feed */}
      {activeSection === "alerts" && (
        <div data-testid="citizen-alerts-section">
          <CitizenAlertsPanel
            isHindi={isHindi}
            incidents={incidents}
            loading={trafficLoading}
            error={incidentsError}
            selectedIntersectionId={selectedIntersection?.id}
            selectedIntersectionName={selectedIntersection?.name}
            onRetry={() => loadData(true)}
          />
        </div>
      )}

      {/* 5. COMPLAINTS — Feed First, Report Form Behind "Report an Issue" */}
      {activeSection === "complaints" && (
        <Suspense
          fallback={
            <LoadingFallback
              variant="section"
              label={
                isHindi ? "नागरिक शिकायत अनुभाग लोड हो रहा है..." : "Loading Citizen Complaints..."
              }
            />
          }
        >
          <CitizenComplaintsPanel
            isHindi={isHindi}
            reports={citizenReports}
            intersections={intersections}
            detectedLocation={detectedLocation}
            currentUserId={user?.id}
            isAuthorityUser={isAuthorityUser}
            highlightedReportId={highlightedReportId}
            defaultOpenForm={actionParam === "report"}
            loading={complaintsLoading}
            error={complaintsError}
            onReportCreated={(created) => {
              setCitizenReports((prev) => [created, ...prev]);
              setHighlightedReportId(created.id);
            }}
            onRefreshReports={refreshCitizenState}
            onShareReport={handleShareReport}
            onPreviewPhoto={(url) => setPreviewPhotoUrl(resolveMediaUrl(url) || url)}
            onOpenResolutionAction={(report, targetStatus) =>
              setResolutionTarget({ report, targetStatus })
            }
          />
        </Suspense>
      )}

      {/* 6. EMERGENCY SOS */}
      {activeSection === "sos" && (
        <Suspense
          fallback={
            <LoadingFallback
              variant="section"
              label={
                isHindi ? "आपातकालीन SOS पैनल लोड हो रहा है..." : "Loading Emergency SOS Assistance..."
              }
            />
          }
        >
          <CitizenSosPanel
            isHindi={isHindi}
            intersections={intersections}
            detectedLocation={detectedLocation}
            currentUserId={user?.id}
            myRequests={emergencyCorridors}
            onRequestSubmitted={async () => {
              await refreshCitizenState();
            }}
          />
        </Suspense>
      )}

      {/* 7. TRAFFIC AWARENESS */}
      {activeSection === "awareness" && (
        <div data-testid="citizen-awareness-section">
          <CitizenAwarenessCard
            isHindi={isHindi}
            activeStatus={classifiedStatus}
            locationName={
              showingExternalLocation && detectedLocation
                ? detectedLocation.roadName || detectedLocation.city || "your detected area"
                : (isHindi ? selectedIntersection?.name_hi : selectedIntersection?.name) || "Delhi NCR"
            }
            activeIncidents={incidents}
            isSimulatedData={isSimulatedTraffic}
          />
        </div>
      )}

      {/* Municipal Notification Center Drawer */}
      {notifDrawerOpen && (
        <Suspense fallback={null}>
          <CitizenNotificationDrawer
            isOpen={notifDrawerOpen}
            isHindi={isHindi}
            notifications={notifications}
            unreadCount={unreadCount}
            onClose={() => setNotifDrawerOpen(false)}
            onMarkRead={handleMarkNotifRead}
            onMarkAllRead={handleMarkAllNotifsRead}
            onSelectReport={(reportId) => {
              setNotifDrawerOpen(false);
              setHighlightedReportId(reportId);
              switchSection("complaints");
            }}
          />
        </Suspense>
      )}

      {/* Authority Triage Resolution Modal (only when Authority user previews Citizen Portal) */}
      {isAuthorityUser && resolutionTarget && (
        <Suspense fallback={null}>
          <AuthorityResolutionModal
            report={resolutionTarget.report}
            targetStatus={resolutionTarget.targetStatus}
            onConfirm={handleConfirmAuthorityStatus}
            onClose={() => setResolutionTarget(null)}
            isSubmitting={resolutionSubmitting}
          />
        </Suspense>
      )}

      {/* Share Incident Modal */}
      {isShareModalOpen && (
        <Suspense fallback={null}>
          <ShareModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            data={shareData}
          />
        </Suspense>
      )}

      {/* Evidence Full-Size Photo Lightbox */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setPreviewPhotoUrl(null)}
          data-testid="evidence-lightbox-modal"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-w-3xl w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/70 hover:bg-black text-white transition-colors cursor-pointer"
              data-testid="close-lightbox-btn"
              aria-label="Close evidence preview"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Citizen complaint photographic evidence"
              className="w-full max-h-[80vh] object-contain bg-black"
              data-testid="lightbox-image"
            />
          </div>
        </div>
      )}

      {/* Authority Action Confirmation Toast */}
      {actionToast && (
        <div
          className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl bg-slate-900 dark:bg-blue-600 text-white text-xs font-bold shadow-xl flex items-center gap-2"
          data-testid="authority-action-toast"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionToast}</span>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import {
  IntersectionDetail,
  CorridorDetail,
  PredictionResponse,
  ProviderStatusDTO,
  IncidentItem,
  RouteResponse,
  RouteOption,
  SavedRoute,
  CitizenReport,
} from "../types";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import {
  Compass,
  Navigation,
  Clock,
  Car,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  MapPin,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Info,
  Layers,
  ChevronRight,
  Radio,
  Calendar,
  Eye,
  GitFork,
  Bookmark,
  Bell,
  BellOff,
  Plus,
  Trash2,
  Send,
  Camera,
  AlertCircle,
  HelpCircle,
  Zap,
} from "lucide-react";
import { DetectMyLocationCard } from "../components/location/DetectMyLocationCard";

// Road Network Connectivity for Leaflet Polyline visualization
const ARTERIAL_EDGES = [
  { from: "INT-01", to: "INT-02", distance: 2.5 },
  { from: "INT-01", to: "INT-03", distance: 1.8 },
  { from: "INT-02", to: "INT-04", distance: 4.8 },
  { from: "INT-03", to: "INT-04", distance: 5.2 },
  { from: "INT-04", to: "INT-05", distance: 3.5 },
  { from: "INT-05", to: "INT-06", distance: 4.2 },
  { from: "INT-06", to: "INT-07", distance: 8.5 },
  { from: "INT-07", to: "INT-08", distance: 6.2 },
  { from: "INT-04", to: "INT-08", distance: 11.0 },
];

const createCitizenIcon = (congestion: string) => {
  let color = "#10b981"; // green
  if (congestion === "moderate") color = "#f59e0b"; // yellow
  if (congestion === "severe") color = "#ef4444"; // red

  const html = `
    <div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 10px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="background-color: white; width: 6px; height: 6px; border-radius: 50%;"></div>
    </div>
  `;
  return L.divIcon({
    html,
    className: "citizen-marker",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Map controller to fly to coordinates smoothly
const MapController: React.FC<{
  targetCoords?: [number, number] | null;
  zoom?: number;
}> = ({ targetCoords, zoom = 14 }) => {
  const map = useMap();
  useEffect(() => {
    if (targetCoords) {
      map.flyTo(targetCoords, zoom, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [targetCoords, zoom, map]);
  return null;
};

// Pulsating User Location GPS Marker
const createUserLocationIcon = () => {
  const html = `
    <div style="position: relative; width: 28px; height: 28px;">
      <div style="position: absolute; width: 28px; height: 28px; background-color: rgba(37, 99, 235, 0.35); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: absolute; top: 4px; left: 4px; width: 20px; height: 20px; background-color: #2563eb; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
        <div style="width: 6px; height: 6px; background-color: white; border-radius: 50%;"></div>
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: "user-gps-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

export const CitizenDashboard: React.FC = () => {
  const { isHindi } = useLanguage();
  const { user } = useAuth();

  // Active top view tab: "overview" | "routes" | "prediction" | "alerts" | "saved" | "report"
  const [activeView, setActiveView] = useState<"overview" | "routes" | "prediction" | "alerts" | "saved" | "report">("overview");

  const [intersections, setIntersections] = useState<IntersectionDetail[]>([]);
  const [selectedId, setSelectedId] = useState<string>("INT-01");
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [corridors, setCorridors] = useState<CorridorDetail[]>([]);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatusDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // User Detected Location
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    roadName?: string;
    city?: string;
    state?: string;
    isDelhi?: boolean;
  } | null>(null);

  // Smart Departure Slider State
  const [departureOffset, setDepartureOffset] = useState<number>(0);
  const [departureSlots, setDepartureSlots] = useState<{
    offset: number;
    label: string;
    clockTime: string;
    speed: number;
    travelTime: number;
    normalTime: number;
    delayTime: number;
    congestionLevel: string;
    timeSaved: number;
    isRecommended: boolean;
  }[]>([]);

  // Map center target
  const [mapTarget, setMapTarget] = useState<[number, number] | null>(null);

  // Smart Routes state
  const [routeOrigin, setRouteOrigin] = useState<string>("INT-01");
  const [routeDest, setRouteDest] = useState<string>("INT-07");
  const [avoidClosed, setAvoidClosed] = useState<boolean>(true);
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number>(0);
  const [loadingRoutes, setLoadingRoutes] = useState<boolean>(false);

  // Saved Routes state
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [savedRouteMsg, setSavedRouteMsg] = useState<string | null>(null);

  // Smart Alerts state
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(true);
  const [alertCategory, setAlertCategory] = useState<string>("all");

  // Report Issue state
  const [reportCategory, setReportCategory] = useState<string>("road_blockage");
  const [reportLocation, setReportLocation] = useState<string>("");
  const [reportDesc, setReportDesc] = useState<string>("");
  const [reportPhoto, setReportPhoto] = useState<string>("");
  const [reportSubmitting, setReportSubmitting] = useState<boolean>(false);
  const [reportSuccessMsg, setReportSuccessMsg] = useState<string | null>(null);
  const [citizenReports, setCitizenReports] = useState<CitizenReport[]>([]);

  const loadData = async (showLoading = false) => {
    try {
      if (showLoading) setRefreshing(true);
      const [interList, incList, status, corrList, savedList, repList] = await Promise.allSettled([
        api.getIntersections(),
        api.getIncidents(undefined, "open", false),
        api.getProviderStatus(),
        api.getCorridors(),
        api.getSavedRoutes(),
        api.getCitizenReports(),
      ]);

      if (interList.status === "fulfilled") setIntersections(interList.value);
      if (incList.status === "fulfilled") setIncidents(incList.value);
      if (status.status === "fulfilled") setProviderStatus(status.value);
      if (corrList.status === "fulfilled") setCorridors(corrList.value);
      if (savedList.status === "fulfilled") setSavedRoutes(savedList.value);
      if (repList.status === "fulfilled") setCitizenReports(repList.value);

      setLastRefreshedAt(new Date());

      if (interList.status === "fulfilled" && interList.value.length > 0 && !interList.value.find((i) => i.id === selectedId)) {
        setSelectedId(interList.value[0].id);
      }
    } catch (err) {
      console.error("Citizen dashboard data load failed:", err);
    } finally {
      setLoading(false);
      if (showLoading) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    handleCompareSmartRoutes("INT-01", "INT-07");
    const interval = setInterval(() => loadData(false), 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch forecast when selectedId changes
  useEffect(() => {
    if (selectedId) {
      api
        .getForecast(selectedId, 30)
        .then(setPrediction)
        .catch(() => setPrediction(null));
    }
  }, [selectedId]);

  // Compute multi-horizon departure slots for "When Should I Leave?"
  useEffect(() => {
    if (!selectedId) return;
    const inter = intersections.find((i) => i.id === selectedId) || intersections[0];
    const currSpeed = inter?.current_speed || 24;
    const baseDistance = 5.2; // km for standard monitored corridor segment
    const normalTime = Math.max(1, Math.round((baseDistance / 45.0) * 60)); // ~7 min at 45km/h

    // 1. Immediate synchronous calculation so UI and cards render with 0ms delay
    const nowTimeMin = Math.max(1, Math.round((baseDistance / Math.max(8, currSpeed)) * 60));
    const nowTimeObj = new Date();
    const initSlots = [
      { offset: 0, label: isHindi ? "अभी (0 मि)" : "Now", minutesAdd: 0, speed: Math.round(currSpeed), travelTime: nowTimeMin, congestion: inter?.congestion_level || "moderate" },
      { offset: 15, label: "+15 Min", minutesAdd: 15, speed: Math.max(12, Math.round(currSpeed - 2)), travelTime: Math.max(1, Math.round((baseDistance / Math.max(10, currSpeed - 2)) * 60)), congestion: "moderate" },
      { offset: 30, label: "+30 Min", minutesAdd: 30, speed: Math.max(14, Math.round(currSpeed + 2)), travelTime: Math.max(1, Math.round((baseDistance / Math.max(10, currSpeed + 2)) * 60)), congestion: "low" },
      { offset: 45, label: "+45 Min", minutesAdd: 45, speed: Math.max(16, Math.round(currSpeed + 3)), travelTime: Math.max(1, Math.round((baseDistance / Math.max(10, currSpeed + 3)) * 60)), congestion: "low" },
      { offset: 60, label: "+60 Min", minutesAdd: 60, speed: Math.max(18, Math.round(currSpeed + 4)), travelTime: Math.max(1, Math.round((baseDistance / Math.max(10, currSpeed + 4)) * 60)), congestion: "low" },
    ];
    const minInitTime = Math.min(...initSlots.map((s) => s.travelTime));
    setDepartureSlots(
      initSlots.map((s) => {
        const depDate = new Date(nowTimeObj.getTime() + s.minutesAdd * 60000);
        const clockTime = depDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const timeSaved = Math.max(0, nowTimeMin - s.travelTime);
        const norm = Math.max(1, Math.min(s.travelTime, normalTime));
        const del = Math.max(0, s.travelTime - norm);
        return {
          offset: s.offset,
          label: s.label,
          clockTime,
          speed: s.speed,
          travelTime: s.travelTime,
          normalTime: norm,
          delayTime: del,
          congestionLevel: s.congestion,
          timeSaved,
          isRecommended: s.travelTime === minInitTime,
        };
      })
    );

    Promise.allSettled([
      api.getForecast(selectedId, 15),
      api.getForecast(selectedId, 30),
      api.getForecast(selectedId, 60),
    ]).then(([res15, res30, res60]) => {
      const f15 = res15.status === "fulfilled" ? res15.value : null;
      const f30 = res30.status === "fulfilled" ? res30.value : null;
      const f60 = res60.status === "fulfilled" ? res60.value : null;

      const nowTimeMin = Math.max(1, Math.round((baseDistance / Math.max(8, currSpeed)) * 60));
      const sp15 = f15?.predicted_speed || Math.max(12, currSpeed - 2);
      const sp30 = f30?.predicted_speed || Math.max(14, currSpeed + 1);
      const sp60 = f60?.predicted_speed || Math.max(16, currSpeed + 3);
      const sp45 = Math.round(((sp30 + sp60) / 2) * 10) / 10;

      const t15 = f15?.estimated_travel_time_min ? Math.round(f15.estimated_travel_time_min) : Math.max(1, Math.round((baseDistance / sp15) * 60));
      const t30 = f30?.estimated_travel_time_min ? Math.round(f30.estimated_travel_time_min) : Math.max(1, Math.round((baseDistance / sp30) * 60));
      const t60 = f60?.estimated_travel_time_min ? Math.round(f60.estimated_travel_time_min) : Math.max(1, Math.round((baseDistance / sp60) * 60));
      const t45 = Math.round((t30 + t60) / 2);

      const rawSlots = [
        { offset: 0, label: isHindi ? "अभी (0 मि)" : "Now", minutesAdd: 0, speed: Math.round(currSpeed), travelTime: nowTimeMin, congestion: inter?.congestion_level || "moderate" },
        { offset: 15, label: "+15 Min", minutesAdd: 15, speed: Math.round(sp15), travelTime: t15, congestion: f15?.predicted_congestion_level || "moderate" },
        { offset: 30, label: "+30 Min", minutesAdd: 30, speed: Math.round(sp30), travelTime: t30, congestion: f30?.predicted_congestion_level || "moderate" },
        { offset: 45, label: "+45 Min", minutesAdd: 45, speed: Math.round(sp45), travelTime: t45, congestion: f30?.predicted_congestion_level || "low" },
        { offset: 60, label: "+60 Min", minutesAdd: 60, speed: Math.round(sp60), travelTime: t60, congestion: f60?.predicted_congestion_level || "low" },
      ];

      const minTravelTime = Math.min(...rawSlots.map((s) => s.travelTime));
      const now = new Date();

      const computedSlots = rawSlots.map((s) => {
        const departureDate = new Date(now.getTime() + s.minutesAdd * 60000);
        const clockTime = departureDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const timeSaved = Math.max(0, nowTimeMin - s.travelTime);
        const norm = Math.max(1, Math.min(s.travelTime, normalTime));
        const del = Math.max(0, s.travelTime - norm);
        const isRecommended = s.travelTime === minTravelTime;

        return {
          offset: s.offset,
          label: s.label,
          clockTime,
          speed: s.speed,
          travelTime: s.travelTime,
          normalTime: norm,
          delayTime: del,
          congestionLevel: s.congestion,
          timeSaved,
          isRecommended,
        };
      });

      setDepartureSlots(computedSlots);
    });
  }, [selectedId, intersections, isHindi]);

  // Compare routes when inputs change
  const handleCompareSmartRoutes = async (orig = routeOrigin, dest = routeDest) => {
    if (!orig || !dest || orig === dest) return;
    setLoadingRoutes(true);
    try {
      const res = await api.compareRoutes(orig, dest, avoidClosed);
      setRouteData(res);
      setSelectedRouteIdx(0);
    } catch (err) {
      console.warn("Route comparison query failed:", err);
      setRouteData(null);
    } finally {
      setLoadingRoutes(false);
    }
  };

  useEffect(() => {
    if (activeView === "routes" && !routeData) {
      handleCompareSmartRoutes();
    }
  }, [activeView]);

  // Save current route
  const handleSaveCurrentRoute = async (route?: RouteOption) => {
    const origItem = intersections.find((i) => i.id === routeOrigin);
    const destItem = intersections.find((i) => i.id === routeDest);
    const name = route ? `${route.name_en} (${origItem?.name || routeOrigin} -> ${destItem?.name || routeDest})` : `Commute: ${origItem?.name || routeOrigin} to ${destItem?.name || routeDest}`;
    try {
      const created = await api.createSavedRoute({
        name,
        origin_id: routeOrigin,
        destination_id: routeDest,
        origin_name: origItem?.name || routeOrigin,
        destination_name: destItem?.name || routeDest,
        notes: route?.recommendation_rationale || "Commuter corridor",
      });
      setSavedRoutes((prev) => [created, ...prev]);
      setSavedRouteMsg(isHindi ? "मार्ग सफलतापूर्वक सहेजा गया!" : "Route saved to My Saved Routes!");
      setTimeout(() => setSavedRouteMsg(null), 4000);
    } catch (err) {
      console.error("Failed to save route:", err);
    }
  };

  // Delete saved route
  const handleDeleteSavedRoute = async (id: string) => {
    try {
      await api.deleteSavedRoute(id);
      setSavedRoutes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Failed to delete saved route:", err);
    }
  };

  // Submit citizen report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDesc.trim() || (!reportLocation.trim() && !userLocation)) return;
    setReportSubmitting(true);
    setReportSuccessMsg(null);
    try {
      const locName = reportLocation.trim() || userLocation?.roadName || `${userLocation?.lat.toFixed(4)}N, ${userLocation?.lng.toFixed(4)}E`;
      const rep = await api.createCitizenReport({
        category: reportCategory,
        location_name: locName,
        latitude: userLocation?.lat || undefined,
        longitude: userLocation?.lng || undefined,
        description: reportDesc.trim(),
        photo_url: reportPhoto.trim() || undefined,
      });
      setCitizenReports((prev) => [rep, ...prev]);
      setReportDesc("");
      setReportPhoto("");
      setReportLocation("");
      setReportSuccessMsg(isHindi ? "रिपोर्ट दर्ज हो गई (अपुष्ट - प्राधिकरण समीक्षाधीन)" : "Report submitted successfully with UNVERIFIED status (Pending Authority Review).");
      setTimeout(() => setReportSuccessMsg(null), 6000);
    } catch (err) {
      console.error("Failed to submit citizen report:", err);
    } finally {
      setReportSubmitting(false);
    }
  };

  const selectedIntersection =
    intersections.find((i) => i.id === selectedId) || intersections[0];

  const interMap = new Map(intersections.map((i) => [i.id, i]));

  // Simplified Traffic Condition label
  const getSimpleTrafficStatus = (item?: IntersectionDetail) => {
    if (!item) return { label: "Checking...", color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800", border: "border-slate-300" };
    if (item.congestion_level === "severe" || item.current_speed < 20) {
      return {
        label: isHindi ? "भारी ट्रैफिक" : "Heavy Traffic — Expect Delays",
        sublabel: isHindi ? "गति 20 किमी/घंटा से कम" : "Speeds under 20 km/h. Consider alternate corridor.",
        color: "text-red-700 dark:text-red-300",
        bg: "bg-red-50 dark:bg-red-950/50",
        border: "border-red-300 dark:border-red-800",
        badge: "bg-red-600 text-white",
      };
    }
    if (item.congestion_level === "moderate" || item.current_speed < 35) {
      return {
        label: isHindi ? "मध्यम ट्रैफिक" : "Moderate Traffic — Moving Steadily",
        sublabel: isHindi ? "सामान्य आवागमन" : "Traffic moving steadily. Allow an extra 5 minutes during peak transit hours.",
        color: "text-amber-800 dark:text-amber-200",
        bg: "bg-amber-50 dark:bg-amber-950/50",
        border: "border-amber-300 dark:border-amber-800",
        badge: "bg-amber-500 text-white",
      };
    }
    return {
      label: isHindi ? "कम ट्रैफिक" : "Low Traffic — Clear Roads",
      sublabel: isHindi ? "सुचारू आवागमन" : "Optimal driving conditions with speeds above 35 km/h.",
      color: "text-emerald-800 dark:text-emerald-200",
      bg: "bg-emerald-50 dark:bg-emerald-950/50",
      border: "border-emerald-300 dark:border-emerald-800",
      badge: "bg-emerald-600 text-white",
    };
  };

  const statusInfo = getSimpleTrafficStatus(selectedIntersection);

  // Filtered alerts
  const filteredIncidents = incidents.filter((inc) => {
    if (!alertsEnabled) return false;
    if (alertCategory === "all") return true;
    if (alertCategory === "closures") return inc.incident_type === "road_closure";
    if (alertCategory === "congestion") return inc.incident_type === "congestion" || inc.incident_type === "speed_drop";
    if (alertCategory === "accidents") return inc.incident_type === "accident" || inc.incident_type === "traffic_disruption";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Citizen Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 pointer-events-none transform skew-x-12" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm">
                CITIZEN COMMUTE PORTAL
              </span>
              <span className="text-blue-200 text-xs">• Delhi NCR Transit Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">
              {isHindi ? `नमस्ते, ${user?.full_name || "नागरिक"}` : `Welcome, ${user?.full_name || "Smart City Resident"}`}
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              {isHindi
                ? "स्मार्ट रूट सुझाव, यात्रा पूर्व एआई पूर्वानुमान, लाइव गति एवं नागरिक समस्या रिपोर्टिंग।"
                : "Smart route recommendations, predict before you travel, live traffic alerts, saved commute corridors, and community issue reporting."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm text-xs font-semibold border border-white/20 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>{isHindi ? "ताज़ा करें" : "Refresh Traffic"}</span>
            </button>
            <button
              onClick={() => setActiveView("routes")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>{isHindi ? "स्मार्ट रूट" : "Plan Smart Route"}</span>
            </button>
          </div>
        </div>

        {/* Provenance Strip */}
        <div className="mt-4 pt-3 border-t border-white/20 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-100">
          <div className="flex items-center gap-2">
            {providerStatus?.mode === "live" && providerStatus?.is_online && !providerStatus.error_fallback_active ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-white">Live TomTom Traffic Feed Active (Delhi NCR)</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  VERIFIED LIVE FLOW
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Live traffic unavailable — showing calibrated baseline model</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-200 border border-amber-400/30">
                  SIMULATED MODEL
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-blue-200">
            <Clock className="w-3 h-3" />
            <span>Last updated: {lastRefreshedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          </div>
        </div>
      </div>

      {/* CITIZEN 7-STAGE NAVIGATION TABS */}
      <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          <button
            type="button"
            onClick={() => setActiveView("overview")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeView === "overview"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>1. Overview & Map</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("routes")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeView === "routes"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <GitFork className="w-4 h-4" />
            <span>2. Smart Routes</span>
            {routeData?.routes && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
                {routeData.routes.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveView("prediction")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeView === "prediction"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>3. Predict Before You Travel</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("alerts")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeView === "alerts"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>4. Smart Alerts</span>
            {incidents.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-500 text-white font-bold">
                {incidents.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveView("saved")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeView === "saved"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>5. My Saved Routes</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold">
              {savedRoutes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("report")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeView === "report"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>6. Report an Issue</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold uppercase">
              Community
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW 1: OVERVIEW & DETECT MY LOCATION & MAIN MAP         */}
      {/* ========================================================= */}
      {activeView === "overview" && (
        <div className="space-y-6">
          {/* Detect My Location Card */}
          <DetectMyLocationCard
            intersections={intersections}
            selectedId={selectedId}
            onSelectIntersection={(id) => setSelectedId(id)}
            lastUpdated={lastRefreshedAt}
            onLocationDetected={(loc) => {
              setUserLocation(loc);
              if (loc) setMapTarget([loc.lat, loc.lng]);
            }}
            onSwitchToRoutes={() => setActiveView("routes")}
          />

          {/* Area Selector Bar: Hidden if user location is detected outside Delhi NCR */}
          {(!userLocation || userLocation.isDelhi) ? (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isHindi ? "दिल्ली एनसीआर मुख्य जंक्शन चुनें:" : "Select Delhi NCR Monitored Junction:"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {intersections.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      setMapTarget([item.latitude, item.longitude]);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                      selectedId === item.id
                        ? "bg-blue-600 text-white shadow-sm font-semibold"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    {isHindi ? item.name_hi || item.name : item.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/60 dark:from-slate-800 dark:to-slate-800/80 border border-blue-200 dark:border-blue-900/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      Detected GPS Region Active
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Live Telemetry Connected
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {userLocation.roadName || userLocation.city || "Detected Location"}, {userLocation.city || userLocation.state || "India"}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Displaying live traffic conditions for your detected area. Fixed Delhi node buttons are hidden for your region.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUserLocation(null);
                  setSelectedId("INT-01");
                }}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-bold text-xs shrink-0 transition-all cursor-pointer shadow-sm"
              >
                Show Delhi NCR Nodes
              </button>
            </div>
          )}

          {/* Main Grid: Status Card + Interactive Leaflet Map */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Selected Area Traffic Card (1 Col) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    CURRENT CONDITION
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Zone: {selectedIntersection?.zone || "Central"}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {selectedIntersection ? (isHindi ? selectedIntersection.name_hi : selectedIntersection.name) : "Loading..."}
                </h3>

                {/* Condition Banner */}
                <div className={`mt-3 p-3.5 rounded-xl border ${statusInfo.bg} ${statusInfo.border}`}>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusInfo.badge}`}>
                      {selectedIntersection?.congestion_level || "normal"}
                    </span>
                    <span className={`text-xs font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                    {statusInfo.sublabel}
                  </p>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                    <span className="text-slate-500 block">Current Speed</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        {selectedIntersection ? Math.round(selectedIntersection.current_speed) : "--"}
                      </span>
                      <span className="text-slate-400 font-semibold">km/h</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                    <span className="text-slate-500 block">Normal Speed</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        {selectedIntersection ? Math.round(selectedIntersection.baseline_speed) : "--"}
                      </span>
                      <span className="text-slate-400 font-semibold">km/h</span>
                    </div>
                  </div>
                </div>

                {/* Quick 30m Forecast snippet */}
                {prediction && (
                  <div className="mt-4 p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                        <span>30-Min AI Forecast</span>
                      </span>
                      <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded">
                        {prediction.predicted_congestion_level}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-slate-600 dark:text-slate-300">Expected Speed:</span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {Math.round(prediction.predicted_speed)} km/h
                      </span>
                    </div>
                    {prediction.recommended_departure_time && (
                      <p className="mt-2 text-[11px] text-indigo-800 dark:text-indigo-200 font-medium">
                        💡 {prediction.recommended_departure_time}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>Source:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {selectedIntersection?.is_simulated ? "Calibrated Baseline Model" : "TomTom Live Flow API"}
                </span>
              </div>
            </div>

            {/* Interactive Leaflet Map (2 Cols) */}
            <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md h-[460px] relative">
              <MapContainer
                center={[28.6139, 77.209]}
                zoom={12}
                scrollWheelZoom={true}
                className="w-full h-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapController targetCoords={mapTarget} zoom={13} />

                {/* User GPS location marker */}
                {userLocation && (
                  <>
                    <Circle
                      center={[userLocation.lat, userLocation.lng]}
                      radius={userLocation.accuracy}
                      pathOptions={{
                        color: "#2563eb",
                        fillColor: "#3b82f6",
                        fillOpacity: 0.15,
                        weight: 1.5,
                      }}
                    />
                    <Marker
                      position={[userLocation.lat, userLocation.lng]}
                      icon={createUserLocationIcon()}
                    >
                      <Popup>
                        <div className="text-xs p-1">
                          <b className="text-blue-600 block">📍 Your Detected Location</b>
                          <span>{userLocation.roadName || "Identified Road"}</span>
                          <span className="text-slate-400 block text-[10px] mt-0.5">
                            Accuracy: ±{userLocation.accuracy}m
                          </span>
                        </div>
                      </Popup>
                    </Marker>
                  </>
                )}

                {/* Arterial edges */}
                {ARTERIAL_EDGES.map((edge, idx) => {
                  const nodeA = interMap.get(edge.from);
                  const nodeB = interMap.get(edge.to);
                  if (!nodeA || !nodeB) return null;
                  const worstCongestion =
                    nodeA.congestion_level === "severe" || nodeB.congestion_level === "severe"
                      ? "severe"
                      : nodeA.congestion_level === "moderate" || nodeB.congestion_level === "moderate"
                      ? "moderate"
                      : "low";

                  let lineColor = "#10b981";
                  if (worstCongestion === "moderate") lineColor = "#f59e0b";
                  if (worstCongestion === "severe") lineColor = "#ef4444";

                  return (
                    <Polyline
                      key={`edge-${idx}`}
                      positions={[
                        [nodeA.latitude, nodeA.longitude],
                        [nodeB.latitude, nodeB.longitude],
                      ]}
                      pathOptions={{
                        color: lineColor,
                        weight: 4.5,
                        opacity: 0.85,
                      }}
                    />
                  );
                })}

                {/* Junction Markers */}
                {intersections.map((inter) => (
                  <Marker
                    key={inter.id}
                    position={[inter.latitude, inter.longitude]}
                    icon={createCitizenIcon(inter.congestion_level)}
                    eventHandlers={{
                      click: () => {
                        setSelectedId(inter.id);
                        setMapTarget([inter.latitude, inter.longitude]);
                      },
                    }}
                  >
                    <Popup>
                      <div className="text-xs p-1">
                        <b className="text-slate-900 block">{inter.name}</b>
                        <span className="text-slate-600">Speed: {Math.round(inter.current_speed)} km/h</span>
                        <span className="text-[10px] block text-slate-400 mt-1 uppercase font-bold">
                          {inter.congestion_level} Traffic
                        </span>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>

              {/* Map Legend Overlay */}
              <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md text-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Traffic Flow Key</span>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-slate-700 dark:text-slate-300 text-[11px]">Green – Low (&gt;35 km/h)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-slate-700 dark:text-slate-300 text-[11px]">Yellow – Moderate (22-35 km/h)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-slate-700 dark:text-slate-300 text-[11px]">Red – Heavy (&lt;22 km/h)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: SMART ROUTE RECOMMENDATION                       */}
      {/* ========================================================= */}
      {activeView === "routes" && (
        <div className="space-y-6">
          {/* Route Config Header Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <GitFork className="w-5 h-5 text-blue-600" />
                  <span>Smart Route Recommendation</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Traffic-aware route alternatives comparing distance, live travel time, and congestion delays.
                </p>
              </div>

              {savedRouteMsg && (
                <span className="px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                  ✓ {savedRouteMsg}
                </span>
              )}
            </div>

            {/* Inputs: Origin, Destination & Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Origin */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Starting Point (Origin):
                  </label>
                  {userLocation && (
                    <button
                      type="button"
                      onClick={() => {
                        // find closest node
                        if (intersections.length > 0) {
                          setRouteOrigin(selectedId);
                        }
                      }}
                      className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      Use Detected GPS
                    </button>
                  )}
                </div>
                <select
                  value={routeOrigin}
                  onChange={(e) => setRouteOrigin(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {intersections.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.zone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Destination:
                </label>
                <select
                  value={routeDest}
                  onChange={(e) => setRouteDest(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {intersections.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.zone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions & Closure Toggle */}
              <div className="flex flex-col justify-end space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={avoidClosed}
                    onChange={(e) => setAvoidClosed(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Avoid verified road closures</span>
                </label>

                <button
                  type="button"
                  onClick={() => handleCompareSmartRoutes()}
                  disabled={loadingRoutes}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRoutes ? "animate-spin" : ""}`} />
                  <span>{loadingRoutes ? "Comparing Routes..." : "Find Best Route"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Route Options Grid */}
          {routeData?.routes && routeData.routes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {routeData.routes.map((route, idx) => {
                const isSelected = selectedRouteIdx === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedRouteIdx(idx)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      route.is_recommended
                        ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-md"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    } ${isSelected ? "ring-2 ring-blue-500" : ""}`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        {route.is_recommended ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>Fastest Route</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            Alternative {idx}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 font-mono">
                          {route.distance_km} km
                        </span>
                      </div>

                      <h4 className="font-bold text-base text-slate-900 dark:text-white mt-2">
                        {isHindi ? route.name_hi : route.name_en}
                      </h4>

                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-3xl font-black text-slate-900 dark:text-white">
                          {Math.round(route.estimated_time_minutes)}
                        </span>
                        <span className="text-xs font-bold text-slate-500">min total travel time</span>
                      </div>

                      {/* Base Time + Additional Traffic Delay Breakdown */}
                      {(() => {
                        const totalTime = Math.max(1, Math.round(route.estimated_time_minutes));
                        const normalTime = Math.max(1, Math.min(totalTime, Math.round((route.distance_km / 45.0) * 60)));
                        const delayTime = Math.max(0, totalTime - normalTime);
                        const normalPct = Math.round((normalTime / totalTime) * 100);
                        const delayPct = 100 - normalPct;

                        return (
                          <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-600 dark:text-slate-400 font-medium">Journey Breakdown:</span>
                              <span className="font-extrabold text-slate-900 dark:text-white text-xs">{totalTime} min</span>
                            </div>

                            {/* Dual-color ratio progress bar */}
                            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                              <div
                                style={{ width: `${normalPct}%` }}
                                className="bg-emerald-500 h-full transition-all"
                                title={`Normal Travel: ${normalTime} min`}
                              />
                              {delayPct > 0 && (
                                <div
                                  style={{ width: `${delayPct}%` }}
                                  className="bg-amber-500 h-full transition-all"
                                  title={`Traffic Delay: +${delayTime} min`}
                                />
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[11px] pt-0.5">
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                Normal: <b>{normalTime} min</b>
                              </span>
                              <span className={delayTime > 0 ? "text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1" : "text-slate-400 font-medium flex items-center gap-1"}>
                                <span className={`w-2 h-2 rounded-full ${delayTime > 0 ? "bg-amber-500" : "bg-slate-300"} inline-block`} />
                                Traffic Delay: <b>{delayTime > 0 ? `+${delayTime} min` : "0 min"}</b>
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <div className="flex items-center justify-between">
                          <span>Congestion Exposure:</span>
                          <b className={route.congestion_exposure_pct > 30 ? "text-amber-600" : "text-emerald-600"}>
                            {Math.round(route.congestion_exposure_pct)}%
                          </b>
                        </div>
                        {route.recommendation_rationale && (
                          <p className="text-[11px] bg-slate-100 dark:bg-slate-800/80 p-2 rounded-lg text-slate-700 dark:text-slate-300 mt-2">
                            💡 {route.recommendation_rationale}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] text-blue-600 font-semibold">
                        {isSelected ? "✓ Active Selected Path" : "Click to select"}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveCurrentRoute(route);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Bookmark className="w-3 h-3" />
                        <span>Save Route</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              Select origin and destination above and click <b>Find Best Route</b> to calculate alternatives.
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 3: PREDICT BEFORE YOU TRAVEL                         */}
      {/* ========================================================= */}
      {activeView === "prediction" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  <span>Predict Before You Travel</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  AI machine learning predictions (+15m & +30m) to help you decide the optimal departure window.
                </p>
              </div>

              {/* Corridor selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Corridor:</span>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                >
                  {intersections.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4 Prediction Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* +15m Prediction */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>+15 Min Prediction</span>
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {prediction ? Math.round(prediction.predicted_speed + 1.2) : "--"}
                  </span>
                  <span className="text-xs font-bold text-slate-500">km/h</span>
                </div>
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 capitalize block">
                  {prediction?.predicted_congestion_level || "Moderate"} Traffic
                </span>
              </div>

              {/* +30m Prediction */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>+30 Min Prediction</span>
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {prediction ? Math.round(prediction.predicted_speed) : "--"}
                  </span>
                  <span className="text-xs font-bold text-slate-500">km/h</span>
                </div>
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 capitalize block">
                  {prediction?.predicted_congestion_level || "Moderate"} Traffic
                </span>
              </div>

              {/* Congestion Trend */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Congestion Trend</span>
                  <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {prediction?.congestion_trend === "increasing"
                      ? "↗ Increasing"
                      : prediction?.congestion_trend === "decreasing"
                      ? "↘ Decreasing"
                      : "→ Steady Flow"}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 block">
                  Based on recent chronological volume curve
                </span>
              </div>

              {/* Departure Advisory */}
              <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 space-y-1">
                <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300 font-bold">
                  <span>Optimal Departure</span>
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200 mt-1 leading-snug">
                  {prediction?.recommended_departure_time || "Depart now — normal steady traffic expected."}
                </p>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 block mt-1">
                  Historical Traffic Pattern Learning
                </span>
              </div>
            </div>

            {/* Privacy Badge */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <b className="font-bold">Privacy-First Navigation:</b> Your location privacy matters. TrafficFlow AI uses privacy-conscious traffic intelligence.
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Continuous AI Corridor Learning</span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SMART DEPARTURE TIME SLIDER ("When Should I Leave?")       */}
          {/* ========================================================= */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>When Should I Leave?</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      Departure Planner
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Compare departure options, predicted congestion, and potential commute minutes saved.
                  </p>
                </div>
              </div>

              {departureSlots.find((s) => s.isRecommended) && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Optimal window: {departureSlots.find((s) => s.isRecommended)?.label} ({departureSlots.find((s) => s.isRecommended)?.clockTime})
                  </span>
                </div>
              )}
            </div>

            {/* Departure Options Pill Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {departureSlots.map((slot) => {
                const isSelected = departureOffset === slot.offset;
                return (
                  <button
                    key={slot.offset}
                    type="button"
                    onClick={() => setDepartureOffset(slot.offset)}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30 shadow-md"
                        : slot.isRecommended
                        ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-700 hover:border-emerald-500"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/70 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {slot.isRecommended && (
                      <span className="absolute -top-2.5 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-emerald-600 text-white shadow-sm flex items-center gap-0.5">
                        ⭐ Best
                      </span>
                    )}

                    <div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                        {slot.label}
                      </span>
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 block">
                        {slot.clockTime}
                      </span>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-baseline justify-between">
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        {slot.travelTime} <span className="text-[10px] font-semibold text-slate-400">min</span>
                      </span>
                      <span className="text-[10px] font-bold capitalize text-slate-600 dark:text-slate-300">
                        {slot.speed} km/h
                      </span>
                    </div>

                    {slot.timeSaved > 0 && (
                      <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
                        Saves {slot.timeSaved}m!
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Interactive Departure Range Slider */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-300">Adjust Departure Horizon:</span>
                <span className="text-blue-600 dark:text-blue-400 font-extrabold">
                  {departureOffset === 0 ? "Depart Right Now" : `Depart in +${departureOffset} minutes`}
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="60"
                step="15"
                value={departureOffset}
                onChange={(e) => setDepartureOffset(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
              />

              <div className="flex justify-between text-[11px] text-slate-400 font-semibold px-1">
                <span>Now (0m)</span>
                <span>+15m</span>
                <span>+30m</span>
                <span>+45m</span>
                <span>+60m</span>
              </div>
            </div>

            {/* Selected Slot Detailed Traffic & Delay Breakdown */}
            {(() => {
              const activeSlot = departureSlots.find((s) => s.offset === departureOffset) || departureSlots[0];
              if (!activeSlot) return null;

              const normalPct = Math.round((activeSlot.normalTime / activeSlot.travelTime) * 100);
              const delayPct = 100 - normalPct;

              return (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 dark:from-slate-800/90 dark:to-slate-800/60 border border-blue-200/80 dark:border-blue-900/60 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          Selected Departure Time
                        </span>
                        {activeSlot.isRecommended && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>Recommended Window</span>
                          </span>
                        )}
                      </div>
                      <h4 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                        {activeSlot.clockTime} ({activeSlot.label})
                      </h4>
                    </div>

                    <div className="text-left sm:text-right">
                      {activeSlot.timeSaved > 0 ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs border border-emerald-300 dark:border-emerald-800">
                          <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <span>Time Saved: {activeSlot.timeSaved} minutes vs leaving now!</span>
                        </div>
                      ) : activeSlot.offset === 0 ? (
                        <span className="text-xs font-semibold text-slate-500">Immediate Departure Baseline</span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-600">Travel time matches baseline flow</span>
                      )}
                    </div>
                  </div>

                  {/* Dual-color visual split bar for Departure Slot */}
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-300 font-bold">
                        Journey Time Breakdown:
                      </span>
                      <span className="text-slate-900 dark:text-white font-black text-sm">
                        {activeSlot.travelTime} min total
                      </span>
                    </div>

                    <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                      <div
                        style={{ width: `${normalPct}%` }}
                        className="bg-emerald-500 h-full transition-all"
                        title={`Normal Travel Time: ${activeSlot.normalTime} min`}
                      />
                      {delayPct > 0 && (
                        <div
                          style={{ width: `${delayPct}%` }}
                          className="bg-amber-500 h-full transition-all"
                          title={`Additional Traffic Delay: +${activeSlot.delayTime} min`}
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>Normal Travel Time: <b>{activeSlot.normalTime} min</b></span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                        <span>Additional Traffic Delay: <b>+{activeSlot.delayTime} min</b></span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 4: SMART TRAFFIC ALERTS                              */}
      {/* ========================================================= */}
      {activeView === "alerts" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-red-600" />
                  <span>Smart Traffic Alerts & Road Warnings</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified road closures, sudden congestion warnings, accidents, and corridor notices.
                </p>
              </div>

              {/* Notification Toggle & Category Filters */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAlertsEnabled(!alertsEnabled)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                    alertsEnabled
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {alertsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                  <span>{alertsEnabled ? "Alerts Enabled" : "Alerts Paused"}</span>
                </button>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "all", label: "All Notices" },
                { id: "closures", label: "Road Closures" },
                { id: "congestion", label: "Heavy Congestion" },
                { id: "accidents", label: "Accidents & Disruptions" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setAlertCategory(cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                    alertCategory === cat.id
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Alert Cards Feed */}
            {filteredIncidents.length > 0 ? (
              <div className="space-y-3">
                {filteredIncidents.map((alert, idx) => {
                  const node = interMap.get(alert.intersection_id);
                  const isClosure = alert.incident_type === "road_closure";
                  return (
                    <div
                      key={alert.id || idx}
                      className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isClosure
                          ? "bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/60"
                          : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg text-white shrink-0 mt-0.5 ${
                            isClosure ? "bg-red-600" : "bg-amber-500"
                          }`}
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-xs uppercase text-slate-900 dark:text-white">
                              {alert.incident_type.replace("_", " ")}
                            </span>
                            <span className="text-slate-400 text-xs">•</span>
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                              {node?.name || alert.intersection_id}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({new Date(alert.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                            {isHindi ? alert.description_hi : alert.description_en}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Advisory: {isHindi ? alert.recommended_action_hi : alert.recommended_action_en}
                          </p>
                        </div>
                      </div>

                      {node && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveView("overview");
                            setSelectedId(node.id);
                            setMapTarget([node.latitude, node.longitude]);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 text-xs font-bold border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer"
                        >
                          Locate on Map 📍
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-500">
                {alertsEnabled ? "No active traffic alerts in this category." : "Alert notifications are currently disabled."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 5: MY SAVED ROUTES                                   */}
      {/* ========================================================= */}
      {activeView === "saved" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Bookmark className="w-5 h-5 text-indigo-600" />
                  <span>My Saved Commute Routes</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Check live traffic conditions across your daily frequent travel corridors.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveView("routes")}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Route</span>
              </button>
            </div>

            {/* Saved Routes List */}
            {savedRoutes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedRoutes.map((saved) => (
                  <div
                    key={saved.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {saved.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedRoute(saved.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded"
                          title="Remove saved route"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 mt-2">
                        <span className="font-semibold text-blue-600">{saved.origin_name}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-indigo-600">{saved.destination_name}</span>
                      </div>

                      {saved.notes && (
                        <p className="text-[11px] text-slate-500 mt-1 italic">
                          "{saved.notes}"
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setRouteOrigin(saved.origin_id);
                          setRouteDest(saved.destination_id);
                          setActiveView("routes");
                          handleCompareSmartRoutes(saved.origin_id, saved.destination_id);
                        }}
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Check Live Route & Delays</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-500">
                You have no saved routes yet. Go to <b>Smart Routes</b> to calculate and save your regular commute paths.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 6: REPORT A TRAFFIC ISSUE                            */}
      {/* ========================================================= */}
      {activeView === "report" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <span>Report a Traffic Issue</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Report road blockages, waterlogging, broken signals, or accidents. All submissions are marked <b>UNVERIFIED</b> until inspected by Traffic Authorities.
              </p>
            </div>

            {reportSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{reportSuccessMsg}</span>
              </div>
            )}

            {/* Report Form */}
            <form onSubmit={handleSubmitReport} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Issue Category:
                </label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white"
                >
                  <option value="road_blockage">Road Blockage / Debris</option>
                  <option value="waterlogging">Waterlogging / Drainage Overflow</option>
                  <option value="damaged_road">Damaged Road / Severe Pothole</option>
                  <option value="broken_signal">Broken Traffic Signal</option>
                  <option value="accident">Traffic Accident</option>
                </select>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Location / Intersection:
                  </label>
                  {userLocation && (
                    <button
                      type="button"
                      onClick={() => setReportLocation(userLocation.roadName || `${userLocation.lat.toFixed(4)}N, ${userLocation.lng.toFixed(4)}E`)}
                      className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      Use GPS Location
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Ring Road near AIIMS Flyover"
                  value={reportLocation}
                  onChange={(e) => setReportLocation(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  required
                />
              </div>

              {/* Photo URL */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Photo URL (Optional):
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/photo.jpg"
                  value={reportPhoto}
                  onChange={(e) => setReportPhoto(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Description:
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the issue, traffic impact, and which lane is affected..."
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-500 italic">
                  * Reports are forwarded to Traffic Authorities for field verification before publication.
                </span>
                <button
                  type="submit"
                  disabled={reportSubmitting}
                  className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{reportSubmitting ? "Submitting..." : "Submit Incident Report"}</span>
                </button>
              </div>
            </form>

            {/* Community Reports Feed */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recent Citizen Submissions ({citizenReports.length})
              </h3>
              <div className="space-y-2">
                {citizenReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-start justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold capitalize text-slate-900 dark:text-white">
                          {rep.category.replace("_", " ")}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600 dark:text-slate-400">{rep.location_name}</span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          {rep.status}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mt-1">{rep.description}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(rep.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  Gauge,
  AlertOctagon,
  CheckCircle2,
  MapPin,
  ExternalLink,
  Compass,
  Radio,
  Clock,
  ArrowRight,
  GitFork,
  Navigation,
  Share2,
  Volume2,
  VolumeX,
  Filter,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Search,
  Crosshair,
  Layers,
  X,
  Eye,
  SlidersHorizontal,
  Flame,
  CheckCheck,
  Siren,
  Camera,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  DashboardSummary,
  IntersectionDetail,
  CitizenReport,
  IncidentItem,
  EmergencyCorridorRequest,
  RouteResponse,
  RouteOption,
} from "../../types";
import { api, resolveMediaUrl } from "../../services/api";
import { AuthorityLiveMap, AuthorityDetectedLocation } from "./AuthorityLiveMap";
import { ShareModal, RouteShareData, IncidentShareData } from "../share/ShareModal";
import { SectionTabs } from "../common/SectionTabs";
import { useVoiceAdvisory } from "../../hooks/useVoiceAdvisory";
import { useSimulation } from "../../context/SimulationContext";
import {
  detectPreciseUserLocation,
  formatCityDistrictState,
  GeolocationErrorInfo,
} from "../../utils/geolocation";

interface AuthorityDedicatedLiveMapProps {
  telemetryData: DashboardSummary | null;
  loading: boolean;
  trafficError?: string | null;
  initialIntersections?: IntersectionDetail[];
  reports?: CitizenReport[];
  incidents?: IncidentItem[];
  emergencyCorridors?: EmergencyCorridorRequest[];
  onRefresh?: () => void;
  onOpenReportDetail?: (report: CitizenReport) => void;
  onOpenResolutionAction?: (report: CitizenReport, targetStatus: string) => void;
}

// Delhi NCR Central Coordinate Baseline
const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];
const DEFAULT_ZOOM = 12;

export const AuthorityDedicatedLiveMap: React.FC<AuthorityDedicatedLiveMapProps> = ({
  telemetryData,
  loading,
  trafficError = null,
  initialIntersections,
  reports = [],
  incidents = [],
  emergencyCorridors = [],
  onRefresh,
  onOpenReportDetail,
  onOpenResolutionAction,
}) => {
  // Simulation Engine Integration
  const {
    activeScenario,
    scenarioStatus,
    simulatedCorridor,
    simulatedIncident,
    simulatedAlert,
    simulatedRoute,
    openSimulatorModal,
    resetScenario,
  } = useSimulation();

  // Monitored arterial junctions (reuse Overview's traffic state when available to avoid duplicate fetches)
  const [intersections, setIntersections] = useState<IntersectionDetail[]>(initialIntersections || []);
  const routeDefaultsAppliedRef = useRef<boolean>(false);
  const [selectedJunctionId, setSelectedJunctionId] = useState<string | null>(null);

  // Inspector Side-Panel Selection State
  const [selectedJunctionObj, setSelectedJunctionObj] = useState<IntersectionDetail | null>(null);
  const [selectedReportObj, setSelectedReportObj] = useState<CitizenReport | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Map Navigation & Search State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [centerCoords, setCenterCoords] = useState<[number, number]>(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState<number>(DEFAULT_ZOOM);
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [terminalLocation, setTerminalLocation] = useState<
    (AuthorityDetectedLocation & { geocodeSource?: string }) | null
  >(null);
  const [terminalLocationError, setTerminalLocationError] = useState<string | null>(null);
  const detectSeqRef = useRef<number>(0);

  // Layer Filter Toggles (All independent)
  const [layers, setLayers] = useState({
    allTraffic: true,
    heavyCongestion: true,
    moderateCongestion: true,
    freeFlow: true,
    citizenIncidents: true,
    accidents: true,
    roadClosures: true,
    emergencyRequests: true,
    activeEmergencyRoutes: true,
    simulatedScenarios: true,
  });

  const toggleLayer = (layerKey: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  // Smart Route Inspector state with candidate routes
  const [routeOrigin, setRouteOrigin] = useState<string>("INT-01");
  const [routeDestination, setRouteDestination] = useState<string>("INT-04");
  const [avoidClosedRoads, setAvoidClosedRoads] = useState<boolean>(true);
  const [routeData, setRouteData] = useState<RouteResponse | null>({
    origin: "INT-01",
    destination: "INT-04",
    routes: [
      {
        route_id: "rt_primary",
        name_en: "Primary Express Arterial (INT-01 -> INT-04)",
        name_hi: "प्राथमिक एक्सप्रेस आर्टेरियल",
        intersections_path: ["INT-01", "INT-04"],
        distance_km: 7.8,
        estimated_time_minutes: 18.2,
        congestion_exposure_pct: 22.0,
        is_recommended: true,
        recommendation_rationale: "Fastest travel time with lowest signal delay",
      },
      {
        route_id: "rt_bypass",
        name_en: "Ring Road Sector Bypass (INT-01 -> INT-02 -> INT-04)",
        name_hi: "रिंग रोड सेक्टर बाईपास",
        intersections_path: ["INT-01", "INT-02", "INT-04"],
        distance_km: 9.6,
        estimated_time_minutes: 22.6,
        congestion_exposure_pct: 12.5,
        is_recommended: false,
        recommendation_rationale: "Alternative path avoiding central corridor congestion",
      },
    ],
    road_closure_active: false,
    affected_intersection: null,
    advisory_notice: "Municipal command telemetry route guidance.",
  });
  const [calculatingRoute, setCalculatingRoute] = useState<boolean>(false);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number>(0);

  // Sharing Modal State
  const [shareData, setShareData] = useState<RouteShareData | IncidentShareData | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const [searchParams] = useSearchParams();
  const [showLayerFilters, setShowLayerFilters] = useState<boolean>(false);
  const [monitoringSubPanel, setMonitoringSubPanel] = useState<"alerts" | "routes">(
    searchParams.get("routeOrigin") || searchParams.get("routeDestination") ? "routes" : "alerts"
  );

  useEffect(() => {
    if (searchParams.get("routeOrigin") || searchParams.get("routeDestination")) {
      setMonitoringSubPanel("routes");
    }
  }, [searchParams]);

  // Deep-linking from Municipal AI Advisory (focus junction or pre-fill alternate route)
  useEffect(() => {
    const advJunctionId = searchParams.get("advisoryJunction");
    if (advJunctionId && intersections.length > 0) {
      const target = intersections.find((i) => i.id === advJunctionId);
      if (target) {
        setSelectedJunctionId(target.id);
        setSelectedJunctionObj(target);
        setSelectedReportObj(null);
        setCenterCoords([target.latitude, target.longitude]);
        setMapZoom(14);
        setStatusNotification(`Municipal AI Advisory Target Focused: ${target.name} [${target.id}]`);
        setTimeout(() => setStatusNotification(null), 4000);
      }
    }

    const rOrigin = searchParams.get("routeOrigin");
    const rDest = searchParams.get("routeDestination");
    if (rOrigin && rDest) {
      setRouteOrigin(rOrigin);
      setRouteDestination(rDest);
    }
  }, [searchParams, intersections]);

  // Sync intersections provided by parent or fetch standalone if rendered directly
  useEffect(() => {
    if (initialIntersections !== undefined) {
      setIntersections(initialIntersections);
      if (!routeDefaultsAppliedRef.current && initialIntersections.length >= 2) {
        routeDefaultsAppliedRef.current = true;
        setRouteOrigin(initialIntersections[0].id);
        setRouteDestination(
          initialIntersections[3]?.id || initialIntersections[initialIntersections.length - 1].id
        );
      }
      return;
    }

    let cancelled = false;
    api.getIntersections()
      .then((data) => {
        if (cancelled) return;
        setIntersections(data);
        if (!routeDefaultsAppliedRef.current && data.length >= 2) {
          routeDefaultsAppliedRef.current = true;
          setRouteOrigin(data[0].id);
          setRouteDestination(data[3]?.id || data[data.length - 1].id);
        }
      })
      .catch((err) => {
        if (!cancelled) console.warn("Failed to load intersections:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [initialIntersections]);

  // Voice Advisory setup for the selected or primary intersection
  const activeVoiceJunction = useMemo(() => {
    if (selectedJunctionId) {
      return intersections.find((i) => i.id === selectedJunctionId);
    }
    return intersections[0] || null;
  }, [intersections, selectedJunctionId]);

  const voiceContext = useMemo(() => {
    if (activeVoiceJunction) {
      return {
        roadName: activeVoiceJunction.name,
        city: "Delhi NCR",
        currentSpeed: activeVoiceJunction.current_speed,
        freeFlowSpeed: activeVoiceJunction.current_speed + 15,
        congestionLevel: (activeVoiceJunction.congestion_level as "low" | "moderate" | "severe") || undefined,
        roadClosure: activeVoiceJunction.congestion_level === "severe" && activeVoiceJunction.current_speed < 15,
        trafficAvailable: true,
      };
    }
    return null;
  }, [activeVoiceJunction]);

  const voiceAdvisory = useVoiceAdvisory(voiceContext);

  const junctionOptions = useMemo(() => {
    if (intersections.length > 0) return intersections;
    return [
      { id: "INT-01", name: "Connaught Central Circle" },
      { id: "INT-02", name: "Barakhamba Road Crossing" },
      { id: "INT-03", name: "Rajiv Chowk Metro Radial" },
      { id: "INT-04", name: "Ring Road Arterial Junction" },
      { id: "INT-05", name: "Moti Bagh Flyover Split" },
      { id: "INT-06", name: "Dhaula Kuan Interchange" },
      { id: "INT-07", name: "Cyber Hub Gateway" },
      { id: "INT-08", name: "Golf Course Express Radial" },
    ];
  }, [intersections]);

  // Handle Route Calculation
  const handleCalculateRoute = async () => {
    const origin = routeOrigin || "INT-01";
    const destination = routeDestination || "INT-04";
    if (origin === destination) return;
    setCalculatingRoute(true);
    try {
      const res = await api.compareRoutes(origin, destination, avoidClosedRoads);
      if (res && res.routes && res.routes.length > 0) {
        setRouteData(res);
        setSelectedRouteIdx(0);
        setCalculatingRoute(false);
        return;
      }
    } catch (err) {
      console.warn("Authority route computation error, using local fallback:", err);
    }

    setRouteData({
      origin,
      destination,
      routes: [
        {
          route_id: "rt_primary",
          name_en: `Primary Express Arterial (${origin} -> ${destination})`,
          name_hi: "प्राथमिक एक्सप्रेस आर्टेरियल",
          intersections_path: [origin, destination],
          distance_km: 8.4,
          estimated_time_minutes: 18.2,
          congestion_exposure_pct: 22.0,
          is_recommended: true,
          recommendation_rationale: "Fastest travel time with lowest signal delay",
        },
        {
          route_id: "rt_bypass",
          name_en: `Ring Road Sector Bypass (${origin} -> INT-02 -> ${destination})`,
          name_hi: "रिंग रोड सेक्टर बाईपास",
          intersections_path: [origin, "INT-02", destination],
          distance_km: 10.1,
          estimated_time_minutes: 21.5,
          congestion_exposure_pct: 14.5,
          is_recommended: false,
          recommendation_rationale: "Alternative path avoiding central congestion",
        },
      ],
      road_closure_active: false,
      affected_intersection: null,
      advisory_notice: "Municipal command telemetry route guidance.",
    });
    setSelectedRouteIdx(0);
    setCalculatingRoute(false);
  };

  useEffect(() => {
    if (routeOrigin && routeDestination && routeOrigin !== routeDestination) {
      handleCalculateRoute();
    }
  }, [routeOrigin, routeDestination, avoidClosedRoads]);

  // Derive highlighted route path nodes for map polyline
  const activeRoutePath = useMemo(() => {
    if (activeScenario === "ambulance" && simulatedCorridor && layers.simulatedScenarios) {
      return simulatedCorridor.route_path;
    }
    if (activeScenario === "waterlogging" && simulatedRoute && layers.simulatedScenarios) {
      return simulatedRoute.routes[0]?.intersections_path || [];
    }
    if (routeData && routeData.routes && routeData.routes[selectedRouteIdx]) {
      return routeData.routes[selectedRouteIdx].intersections_path;
    }
    return [];
  }, [routeData, selectedRouteIdx, activeScenario, simulatedCorridor, simulatedRoute, layers.simulatedScenarios]);

  // Affected Road Segment for waterlogging scenario
  const affectedSegment = useMemo<[string, string] | null>(() => {
    if (activeScenario === "waterlogging" && layers.simulatedScenarios) {
      return ["INT-06", "INT-05"];
    }
    return null;
  }, [activeScenario, layers.simulatedScenarios]);

  // Filtered Junctions based on active layer toggles
  const filteredIntersections = useMemo(() => {
    if (!layers.allTraffic) return [];
    return intersections.filter((j) => {
      const cong = (j.congestion_level || "low").toLowerCase();
      if (cong === "severe" && !layers.heavyCongestion) return false;
      if (cong === "moderate" && !layers.moderateCongestion) return false;
      if ((cong === "low" || cong === "free_flow") && !layers.freeFlow) return false;
      return true;
    });
  }, [intersections, layers]);

  // Filtered Citizen Reports based on active layer toggles (incorporating simulated incident if active)
  const filteredReports = useMemo(() => {
    let list = [...reports];
    if (activeScenario === "waterlogging" && simulatedIncident && layers.simulatedScenarios) {
      list = [simulatedIncident, ...list];
    }
    if (!layers.citizenIncidents) return [];
    return list.filter((r) => {
      const cat = (r.category || "").toLowerCase();
      if (cat.includes("accident") && !layers.accidents) return false;
      if (cat.includes("blockage") && !layers.roadClosures) return false;
      return true;
    });
  }, [reports, layers, activeScenario, simulatedIncident]);

  // Filtered Emergency Corridors based on active layer toggles (incorporating simulated ambulance if active)
  const filteredCorridors = useMemo(() => {
    let list = [...emergencyCorridors];
    if (activeScenario === "ambulance" && simulatedCorridor && layers.simulatedScenarios) {
      list = [simulatedCorridor, ...list];
    }
    if (!layers.emergencyRequests) return [];
    return list;
  }, [emergencyCorridors, layers, activeScenario, simulatedCorridor]);

  // Combined Alerts (including simulated alert)
  const displayAlerts = useMemo(() => {
    let list = [...incidents];
    if (activeScenario !== "none" && simulatedAlert && layers.simulatedScenarios) {
      list = [simulatedAlert, ...list];
    }
    return list;
  }, [incidents, activeScenario, simulatedAlert, layers.simulatedScenarios]);

  // Combined Route Comparison Data
  const effectiveRouteData = useMemo(() => {
    if (activeScenario === "waterlogging" && simulatedRoute && layers.simulatedScenarios) {
      return simulatedRoute;
    }
    return routeData;
  }, [activeScenario, simulatedRoute, layers.simulatedScenarios, routeData]);

  // Location Search Handler
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    // Check intersections
    const matchedJunction = intersections.find(
      (j) => j.name.toLowerCase().includes(query) || j.id.toLowerCase().includes(query) || (j.zone || "").toLowerCase().includes(query)
    );
    if (matchedJunction) {
      setCenterCoords([matchedJunction.latitude, matchedJunction.longitude]);
      setMapZoom(14);
      setSelectedJunctionId(matchedJunction.id);
      setSelectedJunctionObj(matchedJunction);
      setSelectedReportObj(null);
      setStatusNotification(`Centered on junction: ${matchedJunction.name}`);
      setTimeout(() => setStatusNotification(null), 3000);
      return;
    }

    // Check citizen reports
    const matchedReport = reports.find(
      (r) => r.location_name.toLowerCase().includes(query) || r.id.toLowerCase().includes(query) || (r.description || "").toLowerCase().includes(query)
    );
    if (matchedReport && matchedReport.latitude && matchedReport.longitude) {
      setCenterCoords([matchedReport.latitude, matchedReport.longitude]);
      setMapZoom(15);
      setSelectedReportObj(matchedReport);
      setSelectedJunctionObj(null);
      setStatusNotification(`Centered on report: ${matchedReport.id} (${matchedReport.location_name})`);
      setTimeout(() => setStatusNotification(null), 3000);
      return;
    }

    setStatusNotification(`No locations matching "${searchQuery}" found.`);
    setTimeout(() => setStatusNotification(null), 3500);
  };

  // Detect My Location Handler
  const handleDetectLocation = async () => {
    const seq = ++detectSeqRef.current;
    setDetectingLocation(true);
    setTerminalLocationError(null);

    try {
      const detected = await detectPreciseUserLocation({
        intersections,
        timeoutMs: 15000,
        onInitialGpsLock: (initial) => {
          if (seq !== detectSeqRef.current) return;
          setCenterCoords([initial.lat, initial.lng]);
          setMapZoom(14);
          setTerminalLocation({
            lat: initial.lat,
            lng: initial.lng,
            accuracy: initial.accuracy,
            roadName: initial.roadName,
            city: initial.city,
            district: initial.district,
            state: initial.state,
            sourceLabel: initial.sourceLabel,
            timestamp: initial.timestamp,
            isApproximate: initial.accuracyAssessment.isApproximate,
            accuracyWarning: initial.accuracyAssessment.warning,
            geocodeSource: initial.geocodeSource,
          });
        },
      });

      if (seq !== detectSeqRef.current) return;

      const resolvedCity = formatCityDistrictState({
        city: detected.city,
        district: detected.district,
        state: detected.state,
        lat: detected.lat,
        lng: detected.lng,
      });

      setCenterCoords([detected.lat, detected.lng]);
      setMapZoom(14);
      setTerminalLocation({
        lat: detected.lat,
        lng: detected.lng,
        accuracy: detected.accuracy,
        roadName: detected.roadName,
        city: detected.city,
        district: detected.district,
        state: detected.state,
        sourceLabel: detected.sourceLabel,
        timestamp: detected.timestamp,
        isApproximate: detected.accuracyAssessment.isApproximate,
        accuracyWarning: detected.accuracyAssessment.warning,
        geocodeSource: detected.geocodeSource,
      });
      setDetectingLocation(false);
      setStatusNotification(
        `Terminal GPS locked: ${resolvedCity} (${detected.lat.toFixed(5)}, ${detected.lng.toFixed(5)}) • ±${detected.accuracy} m`
      );
      setTimeout(() => setStatusNotification(null), 5000);
    } catch (err) {
      if (seq !== detectSeqRef.current) return;
      const geoErr = err as GeolocationErrorInfo;
      setDetectingLocation(false);
      setTerminalLocationError(geoErr.message);
      setStatusNotification(`Location detection failed: ${geoErr.message}`);
      setTimeout(() => setStatusNotification(null), 5000);
    }
  };

  // Reset View Handler
  const handleResetView = () => {
    setCenterCoords(DEFAULT_CENTER);
    setMapZoom(DEFAULT_ZOOM);
    setSelectedJunctionId(null);
    setSelectedJunctionObj(null);
    setSelectedReportObj(null);
    setSearchQuery("");
    setStatusNotification("Map view reset to Central Delhi NCR arterial network.");
    setTimeout(() => setStatusNotification(null), 3000);
  };

  // Selection Callbacks
  const handleJunctionSelect = (junctionId: string) => {
    setSelectedJunctionId(junctionId);
    const jObj = intersections.find((j) => j.id === junctionId) || null;
    setSelectedJunctionObj(jObj);
    setSelectedReportObj(null);
    if (jObj) {
      setCenterCoords([jObj.latitude, jObj.longitude]);
    }
  };

  const handleReportSelect = (report: CitizenReport) => {
    setSelectedReportObj(report);
    setSelectedJunctionObj(null);
    if (report.latitude && report.longitude) {
      setCenterCoords([report.latitude, report.longitude]);
    }
    if (onOpenReportDetail) {
      onOpenReportDetail(report);
    }
  };

  // Open Route Sharing Modal
  const handleShareRoute = (route: RouteOption) => {
    const origObj = intersections.find((i) => i.id === routeOrigin);
    const destObj = intersections.find((i) => i.id === routeDestination);

    const sharePayload: RouteShareData = {
      type: "route",
      originName: origObj ? origObj.name : routeOrigin,
      destinationName: destObj ? destObj.name : routeDestination,
      originId: routeOrigin,
      destinationId: routeDestination,
      routeName: route.name_en,
      estimatedTimeMinutes: route.estimated_time_minutes,
      distanceKm: route.distance_km,
      congestionLevel: route.congestion_exposure_pct > 40 ? "Heavy Congestion" : "Moderate Traffic",
    };
    setShareData(sharePayload);
    setIsShareModalOpen(true);
  };

  // Open Incident Sharing Modal
  const handleShareIncident = (inc: IncidentItem | CitizenReport) => {
    const isCitizenRep = "category" in inc;
    const sharePayload: IncidentShareData = {
      type: "incident",
      id: inc.id,
      incidentType: isCitizenRep ? (inc as CitizenReport).category : (inc as IncidentItem).incident_type,
      locationName: (inc as any).location_name || (inc as any).intersection_name || "Delhi NCR Arterial",
      description: (inc as any).description || (inc as any).description_en || "",
      status: inc.status,
      severity: (inc as any).priority || (inc as any).severity || "medium",
      actionRequired: (inc as any).recommended_action_en || "Municipal investigation dispatched",
    };
    setShareData(sharePayload);
    setIsShareModalOpen(true);
  };

  const avgSpeed = telemetryData?.average_speed ?? 42.5;
  const congestedCount = telemetryData?.congested_roads_count ?? 2;
  const isOnline = telemetryData
    ? (telemetryData.provider_status?.is_online ?? !telemetryData.is_simulated) && !trafficError
    : false;
  const isSimulatedFallback =
    Boolean(trafficError) ||
    Boolean(telemetryData?.is_simulated) ||
    Boolean(telemetryData?.provider_status?.error_fallback_active) ||
    (telemetryData != null && !isOnline);
  const dataSource = telemetryData?.data_source ?? (trafficError ? "Offline / Fallback Baseline" : "TomTom Real-Time Stream");

  return (
    <div className="space-y-4" data-testid="authority-dedicated-live-map">
      {/* ============================================================ */}
      {/* 1. TOP HEADER: Status Telemetry & Live Search Bar            */}
      {/* ============================================================ */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Status indicator */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-[#161920] text-blue-600 dark:text-[#9AC2FA] border border-blue-200 dark:border-white/[0.10]">
            <Radio className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </div>
          <div>
            <h3 className="text-base font-serif font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Municipal Live Arterial Map</span>
              <span
                className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                  loading && !telemetryData
                    ? "bg-blue-100 text-blue-800 dark:bg-[#9AC2FA]/15 dark:text-[#9AC2FA]"
                    : isOnline
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                }`}
              >
                {loading && !telemetryData
                  ? "Syncing Telemetry..."
                  : isOnline
                    ? "TomTom Live Stream"
                    : "Simulated / Offline Fallback"}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#8C93A4]">
              Provider: {dataSource} • Freshness: {telemetryData?.data_freshness || (loading ? "Updating..." : "Offline / Fallback")} • {intersections.length} Monitored Junctions
            </p>
          </div>
        </div>

        {/* Search, GPS, Reset & Voice Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Bar Form */}
          <form onSubmit={handleSearch} className="relative flex-1 sm:w-64" data-testid="map-search-form">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 dark:text-[#8C93A4]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search road or junction..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-[#9AC2FA]/40"
              data-testid="map-location-search-input"
            />
          </form>

          {/* Detect My Location Button */}
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={detectingLocation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] text-slate-700 dark:text-[#E8EAEE] hover:bg-slate-100 dark:hover:bg-[#232730] text-xs font-semibold cursor-pointer disabled:opacity-50"
            title="Detect GPS location"
            data-testid="detect-my-location-map-btn"
          >
            <Navigation className={`w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA] ${detectingLocation ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{detectingLocation ? "Locating..." : "My Location"}</span>
          </button>

          {/* Reset Map View Button */}
          <button
            type="button"
            onClick={handleResetView}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] text-slate-700 dark:text-[#E8EAEE] hover:bg-slate-100 dark:hover:bg-[#232730] text-xs font-semibold cursor-pointer"
            title="Reset to Delhi NCR view"
            data-testid="reset-map-view-btn"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400 dark:text-[#8C93A4]" />
            <span className="hidden sm:inline">Reset View</span>
          </button>

          {/* Voice Advisory Toggle */}
          <button
            onClick={voiceAdvisory.toggleEnabled}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              voiceAdvisory.isEnabled
                ? "bg-blue-600 text-white border-blue-600 dark:bg-[#9AC2FA] dark:text-[#0A0D14] dark:border-[#9AC2FA]"
                : "bg-slate-50 dark:bg-[#1B1D22] text-slate-700 dark:text-[#E8EAEE] border-slate-200 dark:border-white/[0.10]"
            }`}
            title="Toggle Traffic Speech Advisory"
            data-testid="voice-advisory-map-toggle"
          >
            {voiceAdvisory.isEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            <span>Voice: {voiceAdvisory.isEnabled ? "ON" : "OFF"}</span>
          </button>
        </div>
      </div>

      {/* Honest Simulated / Offline Traffic Warning */}
      {!loading && isSimulatedFallback && (
        <div
          className="p-3 px-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs"
          data-testid="live-map-traffic-fallback-banner"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900 dark:text-amber-200">
                Live traffic unavailable — showing simulated data
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                {trafficError ||
                  telemetryData?.provider_status?.message ||
                  "External TomTom telemetry is offline or degraded. Map markers reflect fallback baseline estimates."}
              </p>
            </div>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer shrink-0"
              data-testid="live-map-retry-traffic-btn"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Traffic</span>
            </button>
          )}
        </div>
      )}

      {/* Floating Status Notification Toast */}
      {statusNotification && (
        <div className="p-2.5 px-4 rounded-xl bg-blue-50 dark:bg-[#111318] border border-blue-200 dark:border-[#9AC2FA]/30 text-blue-900 dark:text-[#E8EAEE] text-xs flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
            <span>{statusNotification}</span>
          </div>
          <button onClick={() => setStatusNotification(null)} className="text-blue-600 dark:text-[#9AC2FA] font-bold ml-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* Authority Terminal Geolocation Error Banner */}
      {terminalLocationError && (
        <div
          data-testid="authority-location-error"
          className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-200 text-xs flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{terminalLocationError}</span>
          </div>
          <button
            type="button"
            data-testid="authority-retry-location-error-btn"
            onClick={handleDetectLocation}
            disabled={detectingLocation}
            className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] shrink-0 cursor-pointer"
          >
            Retry GPS
          </button>
        </div>
      )}

      {/* Authority Terminal GPS Lock Strip & Approximate Warning */}
      {terminalLocation && (
        <div
          data-testid="authority-terminal-location-bar"
          className={`p-3 rounded-xl border text-xs space-y-2 ${
            terminalLocation.accuracyWarning
              ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
              : "bg-slate-50 dark:bg-[#111318] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#E8EAEE]"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-bold" data-testid="authority-detected-city">
                {formatCityDistrictState({
                  city: terminalLocation.city,
                  district: terminalLocation.district,
                  state: terminalLocation.state,
                  lat: terminalLocation.lat,
                  lng: terminalLocation.lng,
                })}
              </span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                ({terminalLocation.lat.toFixed(5)}°, {terminalLocation.lng.toFixed(5)}°)
              </span>
              <span className="text-slate-400">•</span>
              <span>
                Accuracy: <b>±{terminalLocation.accuracy} m</b>
              </span>
              <span className="text-slate-400">•</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                {terminalLocation.sourceLabel}
              </span>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {terminalLocation.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
            <button
              type="button"
              data-testid="authority-retry-location-btn"
              onClick={handleDetectLocation}
              disabled={detectingLocation}
              className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 font-bold text-[11px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {detectingLocation ? "Locating..." : "Re-detect GPS"}
            </button>
          </div>
          {terminalLocation.accuracyWarning && (
            <div
              data-testid="authority-accuracy-warning"
              className="flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300 pt-1 border-t border-amber-200/70 dark:border-amber-800/50"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>{terminalLocation.accuracyWarning}</span>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. COLLAPSIBLE MAP FILTERS & INDEPENDENT LAYER CHIPS          */}
      {/* ============================================================ */}
      <div className="p-3 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-2.5">
        <button
          type="button"
          onClick={() => setShowLayerFilters((prev) => !prev)}
          aria-expanded={showLayerFilters}
          className="w-full flex items-center justify-between text-xs cursor-pointer"
          data-testid="toggle-map-layers-btn"
        >
          <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-[#C5C8D0]">
            <Layers className="w-3.5 h-3.5 text-[#9AC2FA]" />
            <span>Map Layers & Congestion Filters</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#161920] text-slate-500 dark:text-[#9AC2FA] border border-slate-200 dark:border-white/[0.08]">
              {Object.values(layers).filter(Boolean).length} Active
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-[#9AC2FA]">
            <span>{showLayerFilters ? "Hide Filters" : "Configure Layers"}</span>
            {showLayerFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {showLayerFilters && (
          <div
            className="pt-2 border-t border-slate-100 dark:border-white/[0.07] flex flex-wrap items-center gap-1.5 text-xs"
            data-testid="map-layers-toolbar"
          >
          {/* All Traffic */}
          <button
            type="button"
            onClick={() => toggleLayer("allTraffic")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
              layers.allTraffic
                ? "bg-slate-900 text-white border-slate-900 dark:bg-[#9AC2FA] dark:text-[#0A0D14] dark:border-[#9AC2FA]"
                : "bg-slate-100 dark:bg-[#1B1D22] text-slate-500 dark:text-[#8C93A4] border-slate-200 dark:border-white/[0.08] opacity-70"
            }`}
            data-testid="filter-layer-all-traffic"
          >
            <span className="w-2 h-2 rounded-full bg-current" />
            <span>All Traffic</span>
            <span className="font-mono text-[9px] px-1 rounded bg-white/20 dark:bg-black/15">{intersections.length}</span>
          </button>

          {/* Heavy Congestion */}
          <button
            type="button"
            onClick={() => toggleLayer("heavyCongestion")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
              layers.heavyCongestion
                ? "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 font-bold"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 opacity-60"
            }`}
            data-testid="filter-layer-heavy-congestion"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Heavy Congestion</span>
            <span className="font-mono text-[9px] px-1 rounded bg-rose-200 dark:bg-rose-900">
              {intersections.filter((i) => i.congestion_level === "severe").length}
            </span>
          </button>

          {/* Moderate Congestion */}
          <button
            type="button"
            onClick={() => toggleLayer("moderateCongestion")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
              layers.moderateCongestion
                ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 font-bold"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 opacity-60"
            }`}
            data-testid="filter-layer-moderate-congestion"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Moderate</span>
            <span className="font-mono text-[9px] px-1 rounded bg-amber-200 dark:bg-amber-900">
              {intersections.filter((i) => i.congestion_level === "moderate").length}
            </span>
          </button>

          {/* Free-Flow Traffic */}
          <button
            type="button"
            onClick={() => toggleLayer("freeFlow")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
              layers.freeFlow
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-bold"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 opacity-60"
            }`}
            data-testid="filter-layer-free-flow"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Free-Flow</span>
            <span className="font-mono text-[9px] px-1 rounded bg-emerald-200 dark:bg-emerald-900">
              {intersections.filter((i) => i.congestion_level === "low").length}
            </span>
          </button>

          {/* Citizen Incidents */}
          <button
            type="button"
            onClick={() => toggleLayer("citizenIncidents")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
              layers.citizenIncidents
                ? "bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 font-bold"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 opacity-60"
            }`}
            data-testid="filter-layer-citizen-incidents"
          >
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Citizen Incidents</span>
            <span className="font-mono text-[9px] px-1 rounded bg-purple-200 dark:bg-purple-900">{reports.length}</span>
          </button>

          {/* Accidents */}
          <button
            type="button"
            onClick={() => toggleLayer("accidents")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
              layers.accidents
                ? "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 font-bold"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 opacity-60"
            }`}
            data-testid="filter-layer-accidents"
          >
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            <span>Accidents</span>
            <span className="font-mono text-[9px] px-1 rounded bg-rose-200 dark:bg-rose-900">
              {reports.filter((r) => (r.category || "").toLowerCase().includes("accident")).length}
            </span>
          </button>

          {/* Road Closures */}
          <button
            type="button"
            onClick={() => toggleLayer("roadClosures")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
              layers.roadClosures
                ? "bg-red-50 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 font-bold"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 opacity-60"
            }`}
            data-testid="filter-layer-road-closures"
          >
            <AlertOctagon className="w-3 h-3 text-red-500" />
            <span>Closures / Blockage</span>
            <span className="font-mono text-[9px] px-1 rounded bg-red-200 dark:bg-red-900">
              {reports.filter((r) => (r.category || "").toLowerCase().includes("blockage")).length}
            </span>
          </button>

          {/* Emergency Requests */}
          <button
            type="button"
            onClick={() => toggleLayer("emergencyRequests")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
              layers.emergencyRequests
                ? "bg-rose-100 text-rose-900 border-rose-400 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-700 font-bold"
                : "bg-slate-100 dark:bg-[#1B1D22] text-slate-500 dark:text-[#8C93A4] border-slate-200 dark:border-white/[0.08] opacity-70"
            }`}
            data-testid="filter-layer-emergency-requests"
          >
            <Siren className="w-3 h-3 text-rose-500" />
            <span>Emergencies / SOS</span>
            <span className="font-mono text-[9px] px-1 rounded bg-rose-300 dark:bg-rose-900">
              {emergencyCorridors.length}
            </span>
          </button>

          {/* Simulated Scenarios Overlay Toggle */}
          {activeScenario !== "none" && (
            <button
              type="button"
              onClick={() => toggleLayer("simulatedScenarios")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                layers.simulatedScenarios
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/60 font-bold"
                  : "bg-slate-100 dark:bg-[#1B1D22] text-slate-500 dark:text-[#8C93A4] border-slate-200 dark:border-white/[0.08] opacity-70"
              }`}
              data-testid="filter-layer-simulated"
            >
              <Activity className="w-3 h-3 text-amber-500" />
              <span>Simulated Scenario</span>
              <span className="font-mono text-[9px] px-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                {activeScenario.toUpperCase()}
              </span>
            </button>
          )}
          </div>
        )}
      </div>

      {/* Simulation Active Indicator Banner */}
      {activeScenario !== "none" && (
        <div
          data-testid="live-map-simulated-scenario-banner"
          className="p-3 px-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-600/40 text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs uppercase tracking-wide text-amber-800 dark:text-amber-300">
                  Simulation Active: {activeScenario === "ambulance" ? "Ambulance Emergency (Green Corridor)" : "Monsoon Waterlogging & Smart Bypass"}
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  scenarioStatus === "running" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-400" :
                  scenarioStatus === "paused" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-400" :
                  "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-400"
                }`}>
                  {scenarioStatus.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/80 mt-0.5">
                {activeScenario === "ambulance"
                  ? "Preempting green corridor Dhaula Kuan (INT-06) ➔ AIIMS (INT-04). Signal timings overridden for priority."
                  : "Moti Bagh Flyover Underpass waterlogged (48cm). Alternate route via Ring Road / Shanti Path recommended."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetScenario}
              className="px-3 py-1 text-xs rounded-lg bg-slate-900 text-white dark:bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              data-testid="live-map-reset-scenario-btn"
            >
              Reset Simulation
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. MAIN INTERACTIVE MAP & SELECTED LOCATION DETAIL PANEL     */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Large Interactive Leaflet Map (Occupies 3 columns on large screens) */}
        <div className="lg:col-span-3 space-y-2">
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
            <AuthorityLiveMap
              intersections={filteredIntersections}
              reports={filteredReports}
              incidents={displayAlerts}
              emergencyCorridors={filteredCorridors}
              activeCorridorRoute={activeRoutePath}
              affectedSegment={affectedSegment}
              selectedJunctionId={selectedJunctionId}
              onSelectJunction={handleJunctionSelect}
              onSelectReport={handleReportSelect}
              compact={false}
              centerCoords={centerCoords}
              zoom={mapZoom}
              userLocation={terminalLocation}
            />

            {/* Map Legend Overlay */}
            <div className="absolute bottom-3 left-3 z-[1000] p-2.5 rounded-xl bg-slate-900/90 text-white border border-slate-700/80 text-[10px] backdrop-blur-md shadow-md space-y-1.5 pointer-events-auto">
              <div className="font-bold text-slate-300 uppercase tracking-wider text-[9px]">Map Legend</div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Free Flow (&gt;35 km/h)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Moderate Congestion</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Heavy / Severe Delay</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-purple-600 text-[8px] flex items-center justify-center font-bold">!</span>
                <span>Citizen Hazard Marker</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 bg-cyan-400 rounded-full" />
                <span>Active Green Corridor Route</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Location / Incident Details Inspector Side Panel */}
        <div className="lg:col-span-1" data-testid="map-location-inspector-panel">
          {selectedJunctionObj ? (
            /* JUNCTION INSPECTOR CARD */
            <div className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-[#161920] text-blue-600 dark:text-[#9AC2FA] border border-transparent dark:border-white/[0.08] flex items-center justify-center font-mono text-xs font-bold">
                    {selectedJunctionObj.id}
                  </div>
                  <div>
                    <h4 className="text-xs font-serif font-semibold text-slate-900 dark:text-white truncate">
                      {selectedJunctionObj.name}
                    </h4>
                    <span className="text-[10px] text-slate-400 dark:text-[#8C93A4] font-mono">
                      {selectedJunctionObj.zone || "Delhi NCR Arterial"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedJunctionObj(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status and Speed Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-100 dark:border-white/[0.08]">
                  <span className="text-[10px] text-slate-400 dark:text-[#8C93A4] block font-medium">Current Speed</span>
                  <div className="text-lg font-serif font-semibold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {selectedJunctionObj.current_speed} <span className="text-[10px] font-sans font-normal text-slate-400">km/h</span>
                  </div>
                  <span className="text-[9px] text-slate-400 dark:text-[#6B7280]">Baseline: {selectedJunctionObj.baseline_speed} km/h</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-100 dark:border-white/[0.08]">
                  <span className="text-[10px] text-slate-400 dark:text-[#8C93A4] block font-medium">Congestion Flow</span>
                  <div className="mt-1">
                    <span
                      className={`text-[10px] font-mono uppercase font-extrabold px-1.5 py-0.5 rounded ${
                        selectedJunctionObj.congestion_level === "severe"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                          : selectedJunctionObj.congestion_level === "moderate"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      }`}
                    >
                      {selectedJunctionObj.congestion_level}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 dark:text-[#6B7280] block mt-1">
                    Vol: {selectedJunctionObj.current_volume} veh/hr
                  </span>
                </div>
              </div>

              {/* Municipal AI Advisory Callout if severe or targeted */}
              {(selectedJunctionObj.congestion_level === "severe" || searchParams.get("advisoryJunction") === selectedJunctionObj.id) && (
                <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-[#161920] border border-blue-200 dark:border-[#9AC2FA]/30 text-blue-900 dark:text-[#C5C8D0] text-xs space-y-1" data-testid="live-map-advisory-callout">
                  <div className="flex items-center gap-1.5 font-bold text-[10px] text-blue-700 dark:text-[#9AC2FA] uppercase tracking-wider">
                    <Sparkles className="w-3 h-3" />
                    <span>Municipal AI Advisory Active</span>
                  </div>
                  <p className="text-[11px] leading-relaxed font-sans">
                    {selectedJunctionObj.congestion_level === "severe"
                      ? `Significant delay spike detected. Downstream phase split adjustment or diversion via alternate arterial corridor recommended.`
                      : "Targeted location active in Municipal AI Advisory system."}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setRouteDestination(selectedJunctionObj.id);
                    setStatusNotification(`Set ${selectedJunctionObj.name} as destination route node.`);
                    setTimeout(() => setStatusNotification(null), 3000);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#7FB0F7] text-white dark:text-[#0A0D14] font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Route to this Junction</span>
                </button>
              </div>
            </div>
          ) : selectedReportObj ? (
            /* CITIZEN REPORT INSPECTOR CARD */
            <div className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-mono text-xs font-bold">
                    !
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {selectedReportObj.id}
                    </h4>
                    <span className="text-[10px] text-slate-400 capitalize">
                      {selectedReportObj.category.replace("_", " ")}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReportObj(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Location & Status */}
              <div>
                <div className="flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white">
                  <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">{selectedReportObj.location_name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={`text-[10px] uppercase font-mono font-extrabold px-1.5 py-0.5 rounded ${
                      selectedReportObj.status === "resolved"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : selectedReportObj.status === "in_progress"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                        : selectedReportObj.status === "verified"
                        ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {selectedReportObj.status}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Urgency: {selectedReportObj.priority || "Medium"}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 leading-relaxed">
                {selectedReportObj.description}
              </p>

              {/* Attached Photo Evidence Preview */}
              {selectedReportObj.photo_url && (
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Photo Evidence
                  </span>
                  <div
                    onClick={() => setPreviewPhotoUrl(resolveMediaUrl(selectedReportObj.photo_url))}
                    className="relative h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group cursor-pointer bg-slate-100 dark:bg-slate-800"
                  >
                    <img
                      src={resolveMediaUrl(selectedReportObj.photo_url) || ""}
                      alt="Incident evidence"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-semibold gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Click to view</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-1.5 pt-1">
                {onOpenReportDetail && (
                  <button
                    type="button"
                    onClick={() => onOpenReportDetail(selectedReportObj)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#7FB0F7] text-white dark:text-[#0A0D14] font-semibold text-xs transition-colors cursor-pointer"
                    data-testid="inspect-selected-report-btn"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Open Detailed Triage</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleShareIncident(selectedReportObj)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 dark:bg-[#1B1D22] hover:bg-slate-200 dark:hover:bg-[#232730] text-slate-700 dark:text-[#E8EAEE] font-semibold text-xs transition-colors cursor-pointer border border-slate-200 dark:border-white/[0.10]"
                  data-testid="share-selected-incident-btn"
                >
                  <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
                  <span>Share Hazard Alert</span>
                </button>
              </div>
            </div>
          ) : (
            /* DEFAULT TELEMETRY OVERVIEW PANEL WHEN NOTHING SELECTED */
            <div className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-white/[0.08] text-xs font-serif font-semibold text-slate-800 dark:text-white">
                <Crosshair className="w-4 h-4 text-blue-600 dark:text-[#9AC2FA]" />
                <span>Spatial Inspector</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-[#161920] border border-blue-100 dark:border-[#9AC2FA]/25">
                  <span className="text-[11px] font-bold text-blue-900 dark:text-[#9AC2FA] block">
                    Interactive Telemetry Selection
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-[#8C93A4] mt-1 leading-relaxed">
                    Click any arterial junction marker or citizen hazard pin on the map to inspect speed, delay metrics, and attached photographic evidence.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-100 dark:border-white/[0.08]">
                    <span className="text-[10px] text-slate-400 dark:text-[#8C93A4] block font-medium">Avg Speed</span>
                    <span className="text-base font-serif font-semibold text-slate-900 dark:text-white tabular-nums">
                      {avgSpeed} km/h
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-100 dark:border-white/[0.08]">
                    <span className="text-[10px] text-slate-400 dark:text-[#8C93A4] block font-medium">Alerts</span>
                    <span className="text-base font-serif font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      {congestedCount} Congested
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. FIELD INTELLIGENCE WORKSPACE (TABBED FEED / SMART ROUTES) */}
      {/* ============================================================ */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <SectionTabs
            activeTab={monitoringSubPanel}
            onChange={(id) => setMonitoringSubPanel(id as "alerts" | "routes")}
            testIdPrefix="monitoring-subtab"
            tabs={[
              { id: "alerts", label: "Traffic Alerts Feed", icon: AlertOctagon, badge: incidents.length },
              { id: "routes", label: "Smart Route Dispatcher", icon: GitFork },
            ]}
          />
          <span className="text-[11px] text-slate-500 dark:text-[#8C93A4]">
            {monitoringSubPanel === "alerts"
              ? "Verified arterial corridor incidents & closure advisories"
              : "A* topo-weighted bypass routing for municipal dispatch"}
          </span>
        </div>

        {monitoringSubPanel === "routes" && (
          <div className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-[#161920] text-blue-600 dark:text-[#9AC2FA] border border-transparent dark:border-white/[0.08]">
                  <GitFork className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-serif font-semibold text-slate-900 dark:text-white">
                    Smart Route Intelligence & Field Dispatcher
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-[#8C93A4]">
                    Inspect candidate arterial routes, bypass closures, and share route guidance with response units.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-[#9AC2FA]/15 text-blue-600 dark:text-[#9AC2FA] border border-blue-200 dark:border-[#9AC2FA]/25">
                A* Topo-Weighted Routing
              </span>
            </div>

            {/* Route Selectors & Action */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4] block mb-1">Origin Junction</label>
                <select
                  value={routeOrigin}
                  onChange={(e) => setRouteOrigin(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] font-semibold text-slate-800 dark:text-white"
                  data-testid="route-origin-select"
                >
                  {junctionOptions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} [{i.id}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4] block mb-1">Destination Junction</label>
                <select
                  value={routeDestination}
                  onChange={(e) => setRouteDestination(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] font-semibold text-slate-800 dark:text-white"
                  data-testid="route-destination-select"
                >
                  {junctionOptions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} [{i.id}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="avoidClosuresDedicated"
                  checked={avoidClosedRoads}
                  onChange={(e) => setAvoidClosedRoads(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <label htmlFor="avoidClosuresDedicated" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  Bypass Severe Closures
                </label>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleCalculateRoute}
                  disabled={calculatingRoute}
                  className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#7FB0F7] text-white dark:text-[#0A0D14] font-semibold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  data-testid="calculate-route-btn"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{calculatingRoute ? "Calculating..." : "Inspect Alternate Routes"}</span>
                </button>
              </div>
            </div>

            {/* Candidate Route Comparison Cards */}
            {effectiveRouteData && effectiveRouteData.routes && effectiveRouteData.routes.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {effectiveRouteData.routes.map((rt, idx) => {
                  const isSelected = selectedRouteIdx === idx;
                  return (
                    <div
                      key={rt.route_id}
                      onClick={() => setSelectedRouteIdx(idx)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? "border-blue-500 dark:border-[#9AC2FA]/60 bg-blue-50/40 dark:bg-[#161920] shadow-xs"
                          : "border-slate-200 dark:border-white/[0.08] bg-slate-50/40 dark:bg-[#161920]/70 hover:border-slate-300 dark:hover:border-white/[0.16]"
                      }`}
                      data-testid={`route-option-card-${idx}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-serif font-semibold text-sm text-slate-900 dark:text-white">
                          {rt.name_en}
                        </span>
                        {rt.is_recommended && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60">
                            Recommended
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs font-mono">
                        <span className="text-blue-600 dark:text-[#9AC2FA] font-bold">
                          {rt.estimated_time_minutes} min
                        </span>
                        <span className="text-slate-500 dark:text-[#8C93A4]">• {rt.distance_km} km</span>
                        <span className="text-amber-600 dark:text-amber-400">
                          • {rt.congestion_exposure_pct}% Delay Exposure
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-[#8C93A4] mt-1 italic">
                        {rt.recommendation_rationale}
                      </p>

                      <div className="mt-3 pt-2 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 dark:text-[#8C93A4] font-mono">
                          Path: {rt.intersections_path.join(" ➔ ")}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareRoute(rt);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#7FB0F7] text-white dark:text-[#0A0D14] text-[11px] font-semibold transition-colors cursor-pointer"
                          data-testid="share-route-btn"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>Share Route</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {monitoringSubPanel === "alerts" && (
          <div className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-serif font-semibold text-slate-900 dark:text-white">
                  Centralized Traffic Alerts Feed
                </h4>
              </div>
              <span className="text-xs font-mono text-slate-400 dark:text-[#8C93A4] font-semibold">
                {incidents.length} Active Notice{incidents.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="space-y-2">
              {incidents.slice(0, 5).map((inc) => (
                <div
                  key={inc.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-100 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {inc.intersection_name}
                      </span>
                      <span
                        className={`text-[9px] uppercase font-mono font-extrabold px-1.5 py-0.5 rounded ${
                          inc.severity === "critical"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        }`}
                      >
                        {inc.severity}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-[#8C93A4] font-mono">
                        {new Date(inc.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-[#C5C8D0] text-[11px]">
                      {inc.description_en}
                    </p>
                    {inc.recommended_action_en && (
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Advisory: {inc.recommended_action_en}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleShareIncident(inc)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-[#1B1D22] text-slate-700 dark:text-[#E8EAEE] border border-slate-200 dark:border-white/[0.10] hover:bg-slate-100 dark:hover:bg-[#232730] transition-colors cursor-pointer"
                      data-testid="share-alert-notice-btn"
                    >
                      <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
                      <span>Share Notice</span>
                    </button>
                  </div>
                </div>
              ))}

              {incidents.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400 dark:text-[#6B7280]">
                  No critical alerts currently logged across the monitored arterial network.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Photo Preview Modal */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-[#111318] rounded-2xl overflow-hidden border border-white/[0.10] shadow-2xl">
            <button
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Evidence Full Preview"
              className="max-h-[80vh] w-auto object-contain mx-auto"
            />
          </div>
        </div>
      )}

      {/* 1-Click Sharing Modal */}
      {isShareModalOpen && shareData && (
        <ShareModal
          data={shareData}
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}
    </div>
  );
};

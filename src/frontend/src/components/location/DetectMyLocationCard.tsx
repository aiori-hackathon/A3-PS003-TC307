import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../services/api";
import {
  IntersectionDetail,
  PredictionResponse,
} from "../../types";
import {
  AccuracyAssessment,
  CoordinateTrafficTelemetry,
  detectPreciseUserLocation,
  formatCityDistrictState,
  GeolocationErrorInfo,
  haversineDistanceKm,
  ReverseGeocodeInfo,
} from "../../utils/geolocation";
import { classifyTrafficCondition } from "../../utils/trafficStatus";
import {
  Compass,
  MapPin,
  Clock,
  Car,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Navigation,
  ArrowRight,
  Sparkles,
  Info,
  ShieldCheck,
  AlertCircle,
  Cpu,
  Zap,
  Database,
  Layers,
  Radio,
} from "lucide-react";

export interface DetectedLocationEvent {
  lat: number;
  lng: number;
  accuracy: number;
  accuracyAssessment: AccuracyAssessment;
  roadName: string;
  area?: string;
  city: string;
  district?: string;
  state: string;
  fullAddress?: string;
  isDelhi: boolean;
  sourceLabel: string;
  geocodeSource: ReverseGeocodeInfo["geocodeSource"];
  timestamp: Date;
  traffic?: CoordinateTrafficTelemetry | null;
}

interface DetectMyLocationCardProps {
  intersections: IntersectionDetail[];
  selectedId: string;
  onSelectIntersection: (id: string) => void;
  className?: string;
  lastUpdated?: Date;
  onLocationDetected?: (loc: DetectedLocationEvent | null) => void;
  onSwitchToRoutes?: () => void;
  variant?: "full" | "compact";
  onViewDetails?: () => void;
  compactControlSlot?: React.ReactNode;
}

interface LocationDetails {
  road: string;
  area: string;
  city: string;
  district: string;
  state: string;
  fullAddress: string;
  geocodeSource: ReverseGeocodeInfo["geocodeSource"];
  resolved: boolean;
}

interface CoordinateTraffic {
  traffic_available: boolean;
  current_speed?: number;
  free_flow_speed?: number;
  confidence?: number;
  road_closure?: boolean;
  congestion_level?: string;
  travel_time_seconds?: number;
  free_flow_travel_time_seconds?: number;
  provider_name?: string;
  reason?: string;
}

// Predefined Delhi road mapping metadata
const ROAD_METADATA: Record<string, { roadName: string; roadNameHi: string; nearbyIntersection: string; freeFlowSpeed: number }> = {
  "INT-01": {
    roadName: "Connaught Radial Corridor (Inner & Outer Circle)",
    roadNameHi: "कनॉट रेडियल कॉरिडोर (इनर एवं आउटर सर्कल)",
    nearbyIntersection: "Connaught Central Circle (Central Delhi)",
    freeFlowSpeed: 45,
  },
  "INT-02": {
    roadName: "Barakhamba Road & Kasturba Gandhi Marg Arterial",
    roadNameHi: "बाराखम्बा रोड एवं केजी मार्ग धमनी",
    nearbyIntersection: "Barakhamba Road Crossing (Central Arterial)",
    freeFlowSpeed: 50,
  },
  "INT-03": {
    roadName: "Rajiv Chowk Metro Radial & Panchkuian Road Link",
    roadNameHi: "राजीव चौक मेट्रो रेडियल एवं पंचकुइयां रोड लिंक",
    nearbyIntersection: "Rajiv Chowk Metro Radial (Panchkuian Link)",
    freeFlowSpeed: 45,
  },
  "INT-04": {
    roadName: "Mahatma Gandhi Ring Road (AIIMS - Moolchand Corridor)",
    roadNameHi: "महात्मा गांधी रिंग रोड (एम्स - मूलचंद कॉरिडोर)",
    nearbyIntersection: "Ring Road Arterial Junction (South Corridor)",
    freeFlowSpeed: 55,
  },
  "INT-05": {
    roadName: "Shanti Path & Moti Bagh Flyover Split",
    roadNameHi: "शांति पथ एवं मोती बाग फ्लाईओवर स्प्लिट",
    nearbyIntersection: "Moti Bagh Flyover Split (Shanti Path Link)",
    freeFlowSpeed: 60,
  },
  "INT-06": {
    roadName: "Dhaula Kuan Ridge Expressway Interchange (NH-48)",
    roadNameHi: "धौला कुआं रिज एक्सप्रेसवे इंटरचेंज (एनएच-48)",
    nearbyIntersection: "Dhaula Kuan Interchange (NH-48 Corridor)",
    freeFlowSpeed: 60,
  },
  "INT-07": {
    roadName: "Delhi-Gurugram Expressway Corridor (Cyber Hub Gateway)",
    roadNameHi: "दिल्ली-गुरुग्राम एक्सप्रेसवे कॉरिडोर (साइबर हब गेटवे)",
    nearbyIntersection: "Cyber Hub Gateway (Delhi-Gurugram Border)",
    freeFlowSpeed: 65,
  },
  "INT-08": {
    roadName: "Golf Course Extension Road Radial Link",
    roadNameHi: "गोल्फ कोर्स एक्सटेंशन रोड रेडियल लिंक",
    nearbyIntersection: "Golf Course Express Radial (Gurugram South)",
    freeFlowSpeed: 65,
  },
};

// Verified Coverage List vs Unmonitored Roads
const COVERAGE_DATA = [
  { road: "ITO Junction & Vikas Marg Arterial", zone: "Central Delhi", node: "INT-02 Radial", status: "Data available", isCovered: true, source: "TomTom Live Telemetry + ML" },
  { road: "AIIMS - Moolchand Ring Road Corridor", zone: "South Delhi", node: "INT-04", status: "Data available", isCovered: true, source: "TomTom Live Telemetry + ML" },
  { road: "Connaught Central Circle (CP)", zone: "Delhi NCR", node: "INT-01", status: "Data available", isCovered: true, source: "TomTom Live Telemetry + ML" },
  { road: "Barakhamba Road & KG Marg Arterial", zone: "Delhi NCR", node: "INT-02", status: "Data available", isCovered: true, source: "TomTom Live Telemetry + ML" },
  { road: "Rajiv Chowk Metro Radial Corridor", zone: "Delhi NCR", node: "INT-03", status: "Data available", isCovered: true, source: "TomTom Live Telemetry + ML" },
  { road: "Moti Bagh Flyover & Shanti Path", zone: "Delhi NCR", node: "INT-05", status: "Data available", isCovered: true, source: "TomTom Live Telemetry + ML" },
  { road: "Dhaula Kuan Interchange (NH-48)", zone: "Delhi NCR", node: "INT-06", status: "Data available", isCovered: true, source: "TomTom Live Telemetry + ML" },
  { road: "Cyber Hub Gateway (Delhi-Gurugram)", zone: "NCR Expressway", node: "INT-07", status: "Data available", isCovered: true, source: "TomTom Live Telemetry + ML" },
  { road: "Golf Course Express Radial Corridor", zone: "NCR Expressway", node: "INT-08", status: "Data available", isCovered: true, source: "TomTom Live Telemetry + ML" },
  { road: "Agra MG Road & Taj Ganj Corridors", zone: "Agra (UP)", node: "GPS Flow", status: "Data available", isCovered: true, source: "TomTom Live Flow Telemetry" },
  { road: "Dehradun Rajpur Road & Clock Tower", zone: "Dehradun (UK)", node: "GPS Flow", status: "Data available", isCovered: true, source: "TomTom Live Flow Telemetry" },
  { road: "Jaipur MI Road & Tonk Road Corridors", zone: "Jaipur (RJ)", node: "GPS Flow", status: "Data available", isCovered: true, source: "TomTom Live Flow Telemetry" },
  { road: "Mehrauli-Badarpur Road (MB Rd)", zone: "South Delhi", node: "—", status: "Not covered", isCovered: false, source: "No Active Sensor Feed" },
  { road: "Mathura Road (Ashram - Badarpur)", zone: "South-East Delhi", node: "—", status: "Not covered", isCovered: false, source: "No Active Sensor Feed" },
  { road: "Vikas Marg (Laxmi Nagar Link)", zone: "East Delhi", node: "—", status: "Not covered", isCovered: false, source: "No Active Sensor Feed" },
  { road: "Other unmonitored arterial roads", zone: "Peripheral NCR", node: "—", status: "Not covered", isCovered: false, source: "No Active Sensor Feed" },
];

export const DetectMyLocationCard: React.FC<DetectMyLocationCardProps> = ({
  intersections,
  selectedId,
  onSelectIntersection,
  className = "",
  lastUpdated = new Date(),
  onLocationDetected,
  onSwitchToRoutes,
  variant = "full",
  onViewDetails,
  compactControlSlot,
}) => {
  const { isHindi } = useLanguage();

  const [activeTab, setActiveTab] = useState<"detect" | "coverage" | "fl_benchmark">("detect");
  const [detecting, setDetecting] = useState<boolean>(false);
  const [gpsData, setGpsData] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    accuracyAssessment: AccuracyAssessment;
    sourceLabel: string;
    timestamp: Date;
  } | null>(null);

  const [locationDetails, setLocationDetails] = useState<LocationDetails | null>(null);
  const [coordTraffic, setCoordTraffic] = useState<CoordinateTraffic | null>(null);
  const [isInsideMlCoverage, setIsInsideMlCoverage] = useState<boolean>(true);
  const [loadingTraffic, setLoadingTraffic] = useState<boolean>(false);

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [unconfirmedMessage, setUnconfirmedMessage] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<GeolocationErrorInfo | null>(null);
  const detectSeqRef = useRef<number>(0);

  // Predictions for +15 and +30 minutes
  const [forecast15, setForecast15] = useState<PredictionResponse | null>(null);
  const [forecast30, setForecast30] = useState<PredictionResponse | null>(null);
  const [loadingForecast, setLoadingForecast] = useState<boolean>(false);

  // Active detected intersection
  const activeRoad =
    intersections.find((i) => i.id === selectedId) || intersections[0];

  const roadMeta = activeRoad ? ROAD_METADATA[activeRoad.id] || {
    roadName: activeRoad.name,
    roadNameHi: activeRoad.name_hi || activeRoad.name,
    nearbyIntersection: `${activeRoad.name} [${activeRoad.id}]`,
    freeFlowSpeed: 50,
  } : null;

  // Load predictions for Delhi NCR when inside coverage
  useEffect(() => {
    if (!activeRoad || !isInsideMlCoverage) {
      setForecast15(null);
      setForecast30(null);
      return;
    }

    let isMounted = true;
    setLoadingForecast(true);

    Promise.allSettled([
      api.getForecast(activeRoad.id, 15),
      api.getForecast(activeRoad.id, 30),
    ])
      .then(([res15, res30]) => {
        if (!isMounted) return;
        if (res15.status === "fulfilled") setForecast15(res15.value);
        else setForecast15(null);

        if (res30.status === "fulfilled") setForecast30(res30.value);
        else setForecast30(null);
      })
      .finally(() => {
        if (isMounted) setLoadingForecast(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeRoad?.id, isInsideMlCoverage]);

  // NATIONWIDE LOCATION DETECTION
  const handleDetectLocation = async () => {
    const seq = ++detectSeqRef.current;
    setDetecting(true);
    setUnconfirmedMessage(null);
    setGpsError(null);
    setLoadingTraffic(false);

    try {
      const detected = await detectPreciseUserLocation({
        intersections,
        timeoutMs: 15000,
        onInitialGpsLock: (initial) => {
          if (seq !== detectSeqRef.current) return;

          setGpsData({
            lat: initial.lat,
            lng: initial.lng,
            accuracy: initial.accuracy,
            accuracyAssessment: initial.accuracyAssessment,
            sourceLabel: initial.sourceLabel,
            timestamp: initial.timestamp,
          });
          setDistanceKm(initial.distanceToDelhiKm);
          setIsInsideMlCoverage(initial.isDelhi);

          if (initial.isDelhi && initial.nearestDelhiNodeId) {
            onSelectIntersection(initial.nearestDelhiNodeId);
          } else {
            setForecast15(null);
            setForecast30(null);
          }

          setLoadingTraffic(true);

          onLocationDetected?.({
            lat: initial.lat,
            lng: initial.lng,
            accuracy: initial.accuracy,
            accuracyAssessment: initial.accuracyAssessment,
            roadName: initial.roadName,
            area: initial.area,
            city: initial.city,
            district: initial.district,
            state: initial.state,
            fullAddress: initial.fullAddress,
            isDelhi: initial.isDelhi,
            sourceLabel: initial.sourceLabel,
            geocodeSource: initial.geocodeSource,
            timestamp: initial.timestamp,
            traffic: null,
          });
        },
      });

      if (seq !== detectSeqRef.current) return;

      const resolvedDetails: LocationDetails = {
        road: detected.roadName,
        area: detected.area,
        city: detected.city,
        district: detected.district,
        state: detected.state,
        fullAddress: detected.fullAddress,
        geocodeSource: detected.geocodeSource,
        resolved: detected.geocodeResolved,
      };
      setLocationDetails(resolvedDetails);

      if (detected.traffic) {
        setCoordTraffic(detected.traffic);
      }
      setLoadingTraffic(false);
      setDetecting(false);

      onLocationDetected?.({
        lat: detected.lat,
        lng: detected.lng,
        accuracy: detected.accuracy,
        accuracyAssessment: detected.accuracyAssessment,
        roadName: detected.roadName,
        area: detected.area,
        city: detected.city,
        district: detected.district,
        state: detected.state,
        fullAddress: detected.fullAddress,
        isDelhi: detected.isDelhi,
        sourceLabel: detected.sourceLabel,
        geocodeSource: detected.geocodeSource,
        timestamp: detected.timestamp,
        traffic: detected.traffic,
      });
    } catch (err) {
      if (seq !== detectSeqRef.current) return;
      const geoErr = err as GeolocationErrorInfo;
      setDetecting(false);
      setLoadingTraffic(false);
      setGpsError(geoErr);
      setUnconfirmedMessage(isHindi ? geoErr.messageHi : geoErr.message);
      onLocationDetected?.(null);
    }
  };

  // Compute Active Speed & Congestion Level (never leak Delhi corridor speeds when GPS is outside Delhi)
  const isExternalLocation = Boolean(gpsData && !isInsideMlCoverage);
  const hasLiveCoordinateTraffic = Boolean(
    coordTraffic?.traffic_available && coordTraffic.current_speed !== undefined
  );

  const activeCurrentSpeed: number | null = hasLiveCoordinateTraffic
    ? coordTraffic!.current_speed!
    : isExternalLocation
    ? null
    : activeRoad?.current_speed !== undefined
    ? activeRoad.current_speed
    : null;

  const activeFreeFlowSpeed: number | null =
    coordTraffic?.traffic_available && coordTraffic.free_flow_speed !== undefined
      ? coordTraffic.free_flow_speed
      : isExternalLocation
      ? null
      : activeRoad?.baseline_speed || roadMeta?.freeFlowSpeed || null;

  const speedDiff =
    activeCurrentSpeed !== null && activeFreeFlowSpeed !== null
      ? Math.round((activeCurrentSpeed - activeFreeFlowSpeed) * 10) / 10
      : null;

  const classifiedStatus = classifyTrafficCondition({
    currentSpeed: activeCurrentSpeed,
    freeFlowSpeed: activeFreeFlowSpeed,
    congestionLevel: hasLiveCoordinateTraffic
      ? coordTraffic?.congestion_level
      : activeRoad?.congestion_level,
    roadClosure: Boolean(hasLiveCoordinateTraffic && coordTraffic?.road_closure),
    unavailableReason: coordTraffic?.reason,
  });

  const congestionInfo = {
    label: isHindi ? classifiedStatus.labelHi : classifiedStatus.label,
    sublabel: isHindi ? classifiedStatus.meaningHi : classifiedStatus.meaning,
    colorClass: `${classifiedStatus.colorText} ${classifiedStatus.bannerBg} ${classifiedStatus.bannerBorder}`,
    badgeBg: classifiedStatus.dotClass,
    level: classifiedStatus.level,
  };

  // Top 3 nearby monitored roads/intersections sorted by GPS coordinates (or current selection)
  const nearbyIntersections = intersections
    .map((node) => ({
      node,
      distanceKm: gpsData
        ? Number(haversineDistanceKm(gpsData.lat, gpsData.lng, node.latitude, node.longitude).toFixed(1))
        : null,
    }))
    .sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      if (a.node.id === activeRoad?.id) return -1;
      return 0;
    })
    .slice(0, 3);

  const displayRoadName =
    locationDetails?.road ||
    (gpsData && !isInsideMlCoverage
      ? gpsData.accuracyAssessment.isApproximate
        ? "Approximate Coordinate Area"
        : "GPS Coordinate Location"
      : isHindi
      ? roadMeta?.roadNameHi || roadMeta?.roadName
      : roadMeta?.roadName) ||
    (activeRoad ? (isHindi ? activeRoad.name_hi : activeRoad.name) : "Delhi NCR Corridor");

  const displayAreaLabel =
    locationDetails && gpsData
      ? formatCityDistrictState({
          city: locationDetails.city,
          district: locationDetails.district,
          state: locationDetails.state,
          lat: gpsData.lat,
          lng: gpsData.lng,
        })
      : gpsData && !isInsideMlCoverage
      ? `${gpsData.lat.toFixed(4)}, ${gpsData.lng.toFixed(4)}`
      : activeRoad?.zone || "Delhi NCR";

  if (variant === "compact") {
    return (
      <div
        className={`rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] p-5 sm:p-6 shadow-sm space-y-4 ${className}`}
        data-testid="citizen-compact-traffic-card"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Current Detected Location */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#8C93A4]">
              <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
              <span>{isHindi ? "वर्तमान पहचान किया गया स्थान" : "Current Location & Live Traffic"}</span>
              {gpsData && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25 normal-case tracking-normal">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  GPS ±{Math.round(gpsData.accuracy)}m
                </span>
              )}
            </div>

            <h2
              data-testid="detected-road-name"
              className="font-serif text-xl sm:text-2xl font-medium text-slate-900 dark:text-white leading-snug"
            >
              {displayRoadName}
            </h2>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-[#C5C8D0]">
              <span data-testid="detected-city-state">{displayAreaLabel}</span>
              <span className="text-slate-300 dark:text-white/20">•</span>
              <span className="text-[11px] text-slate-500 dark:text-[#8C93A4]">
                {coordTraffic?.traffic_available
                  ? "TomTom Live Flow"
                  : isExternalLocation
                  ? "Live coordinate speed unavailable"
                  : activeRoad?.is_simulated
                  ? "Simulated baseline"
                  : "Live corridor telemetry"}
              </span>
            </div>
          </div>

          {/* Traffic Status Indicator + Compact Speed Summary */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] flex items-center gap-4">
              <div>
                <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-[#8C93A4]">
                  {isHindi ? "वर्तमान गति" : "Current Speed"}
                </span>
                {loadingTraffic ? (
                  <span className="text-sm font-medium text-blue-600 dark:text-[#9AC2FA]">Checking...</span>
                ) : activeCurrentSpeed !== null ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-serif text-2xl font-medium text-slate-900 dark:text-white tabular-nums">
                      {activeCurrentSpeed}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-[#8C93A4]">
                      km/h{activeFreeFlowSpeed ? ` / ${activeFreeFlowSpeed}` : ""}
                    </span>
                  </div>
                ) : (
                  <span className="font-serif text-lg font-medium text-slate-500 dark:text-[#8C93A4]">
                    Unavailable
                  </span>
                )}
              </div>

              <div className="h-8 w-px bg-slate-200 dark:bg-white/[0.08]" />

              <div className="space-y-1">
                <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-[#8C93A4]">
                  {isHindi ? "ट्रैफिक स्थिति" : "Status"}
                </span>
                <span
                  data-testid="overview-traffic-status-pill"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${classifiedStatus.badgeClasses}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${congestionInfo.badgeBg}`} />
                  {congestionInfo.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* GPS Error or Accuracy Advisory (if applicable) */}
        {(gpsError || unconfirmedMessage) && (
          <div
            data-testid="location-error-banner"
            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{unconfirmedMessage}</span>
            </div>
            <button
              type="button"
              data-testid="retry-location-error-btn"
              onClick={handleDetectLocation}
              disabled={detecting}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px] shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isHindi ? "पुनः प्रयास करें" : "Retry GPS"}
            </button>
          </div>
        )}

        {/* Controls Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              data-testid="detect-card-location-btn"
              onClick={handleDetectLocation}
              disabled={detecting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#B4D2FC] text-white dark:text-[#0A0D14] font-semibold text-xs shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
            >
              {detecting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{isHindi ? "पहचान हो रही है..." : "Detecting GPS..."}</span>
                </>
              ) : (
                <>
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{isHindi ? "मेरा स्थान पहचानें" : "Detect My Location"}</span>
                </>
              )}
            </button>

            {compactControlSlot}
          </div>

          {onViewDetails && (
            <button
              type="button"
              onClick={onViewDetails}
              data-testid="overview-view-details-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-[#1B1D22] hover:bg-slate-50 dark:hover:bg-[#23262E] text-xs font-semibold text-slate-700 dark:text-[#E8EAEE] transition-colors cursor-pointer self-start sm:self-auto"
            >
              <span>{isHindi ? "लाइव विवरण देखें" : "View Details"}</span>
              <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm overflow-hidden transition-colors ${className}`}>
      {/* CARD TOP NAVIGATION TABS */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-slate-100 dark:border-white/[0.07] bg-slate-50/50 dark:bg-[#161920]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("detect")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "detect"
                ? "bg-blue-600 text-white dark:bg-[#9AC2FA] dark:text-[#0A0D14] shadow-sm"
                : "text-slate-600 dark:text-[#C5C8D0] hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{isHindi ? "लाइव स्थान एवं ट्रैफिक" : "Live Location & Flow"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("coverage")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "coverage"
                ? "bg-blue-600 text-white dark:bg-[#9AC2FA] dark:text-[#0A0D14] shadow-sm"
                : "text-slate-600 dark:text-[#C5C8D0] hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>{isHindi ? "डेटा कवरेज मैट्रिक्स" : "Data Coverage"}</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>{isHindi ? "गोपनीयता-प्रथम जीपीएस" : "Privacy-First Telemetry"}</span>
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-[#8C93A4]">
            <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-[#9AC2FA]" />
            <span>{lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          </div>
        </div>
      </div>

      {/* TAB 1: LOCATION DETECTION, TRAFFIC INFO, PREDICTION, ALTERNATIVE ROUTES */}
      {activeTab === "detect" && (
        <div className="p-5 sm:p-6 space-y-5">
          {/* ACTION BAR: Detect Button + Nationwide Scope Notice */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50/80 dark:bg-[#161920] border border-slate-200/80 dark:border-white/[0.08]">
            <div>
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-blue-600 dark:text-[#9AC2FA]" />
                <h3 className="font-serif text-base sm:text-lg font-medium text-slate-900 dark:text-white">
                  {isHindi ? "अखिल भारतीय स्थान एवं ट्रैफिक पहचान" : "Nationwide Location & Live Traffic Detection"}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-[#C5C8D0] mt-0.5">
                {isHindi
                  ? "उच्च-सटीकता डिवाइस जीपीएस एवं लाइव टॉमटॉम ट्रैफिक प्रवाह द्वारा सटीक सड़क व शहर की पहचान।"
                  : "Pinpoints your actual device GPS coordinates anywhere you travel with live reverse geocoding and TomTom flow telemetry."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-testid="detect-card-location-btn"
                onClick={handleDetectLocation}
                disabled={detecting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#B4D2FC] text-white dark:text-[#0A0D14] font-semibold text-xs sm:text-sm shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
              >
                {detecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isHindi ? "जीपीएस एवं ट्रैफिक लॉक हो रहा है..." : "Locking GPS & Telemetry..."}</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4" />
                    <span>{isHindi ? "मेरा स्थान पहचानें (Detect My Location)" : "Detect My Location"}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 3-TIER STATUS INDICATORS: GPS Fix • Source • Timestamp • Telemetry • ML Model */}
          {gpsData && (
            <div className="space-y-2.5" data-testid="location-status-panel">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between text-xs gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                  <span
                    className="font-bold text-slate-900 dark:text-slate-100"
                    data-testid="detected-city-state"
                  >
                    {locationDetails
                      ? formatCityDistrictState({
                          city: locationDetails.city,
                          district: locationDetails.district,
                          state: locationDetails.state,
                          lat: gpsData.lat,
                          lng: gpsData.lng,
                        })
                      : isHindi
                      ? "पता खोजा जा रहा है..."
                      : "Resolving city & district..."}
                  </span>
                  <span
                    className="text-slate-500 dark:text-slate-400 font-mono text-[11px]"
                    data-testid="detected-coordinates"
                  >
                    ({gpsData.lat.toFixed(5)}°, {gpsData.lng.toFixed(5)}°)
                  </span>
                  <span className="text-slate-400">•</span>
                  <span
                    className="text-slate-600 dark:text-slate-300"
                    data-testid="detected-accuracy"
                  >
                    Accuracy:{" "}
                    <b>
                      ±
                      {gpsData.accuracy >= 1000
                        ? `${(gpsData.accuracy / 1000).toFixed(2)} km (${gpsData.accuracy} m)`
                        : `${gpsData.accuracy} m`}
                    </b>
                  </span>
                  <span className="text-slate-400">•</span>
                  <span
                    className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1"
                    data-testid="detected-timestamp"
                  >
                    <Clock className="w-3 h-3" />
                    {gpsData.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>

                {/* Status Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    data-testid="detected-source-badge"
                  >
                    {gpsData.sourceLabel}
                  </span>

                  {/* 1. GPS Accuracy Tier */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      gpsData.accuracyAssessment.tier === "high"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : gpsData.accuracyAssessment.tier === "moderate"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {isHindi
                      ? gpsData.accuracyAssessment.labelHi
                      : gpsData.accuracyAssessment.label}
                  </span>

                  {/* 2. TomTom Telemetry Status */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      coordTraffic?.traffic_available
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-600 text-white"
                    }`}
                  >
                    {coordTraffic?.traffic_available
                      ? `TomTom Live${locationDetails?.city ? `: ${locationDetails.city}` : ""}`
                      : "TomTom Check"}
                  </span>

                  {/* 3. ML Model Registry Status */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      isInsideMlCoverage
                        ? "bg-indigo-600 text-white"
                        : "bg-amber-500 text-white"
                    }`}
                  >
                    {isInsideMlCoverage ? "ML: Delhi Model" : "ML: Outside Delhi Grid"}
                  </span>
                </div>
              </div>

              {/* COARSE / APPROXIMATE ACCURACY WARNING */}
              {gpsData.accuracyAssessment.warning && (
                <div
                  data-testid="location-accuracy-warning"
                  className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">
                        {isHindi
                          ? "अनुमानित / कम सटीकता चेतावनी"
                          : "Approximate Location Warning"}
                      </span>
                      <p className="text-[11px] leading-relaxed mt-0.5">
                        {isHindi
                          ? gpsData.accuracyAssessment.warningHi
                          : gpsData.accuracyAssessment.warning}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="retry-location-btn"
                    onClick={handleDetectLocation}
                    disabled={detecting}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isHindi ? "पुनः प्रयास करें" : "Retry Precise GPS"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ERROR OR PERMISSION BANNER */}
          {(gpsError || unconfirmedMessage) && (
            <div
              data-testid="location-error-banner"
              className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold block">{unconfirmedMessage}</span>
                  {gpsError?.code === "permission_denied" && (
                    <span className="text-[11px] opacity-90 block">
                      {isHindi
                        ? "टिप: एड्रेस बार में लॉक/लोकेशन आइकन पर क्लिक करके स्थान अनुमति 'Allow' करें, या नीचे उपलब्ध चौराहा चुनें।"
                        : "Tip: Open the site permissions icon in your browser address bar, set Location to Allow, then click Retry GPS — or pick any monitored junction below."}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                data-testid="retry-location-error-btn"
                onClick={handleDetectLocation}
                disabled={detecting}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isHindi ? "पुनः प्रयास करें" : "Retry GPS"}
              </button>
            </div>
          )}

          {/* CORE ROAD & TRAFFIC METRICS (Road Name, Real Speed, Congestion) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. ROAD NAME & CITY RESOLUTION */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4] uppercase tracking-wider block">
                  {isHindi ? "पहचानी गई सड़क एवं शहर" : "Detected Road & City"}
                </span>

                <h4
                  data-testid="detected-road-name"
                  className="font-serif text-lg font-medium text-slate-900 dark:text-white mt-1 leading-snug"
                >
                  {locationDetails?.road ||
                    (gpsData && !isInsideMlCoverage
                      ? gpsData.accuracyAssessment.isApproximate
                        ? "Approximate Coordinate Area"
                        : "GPS Coordinate Location"
                      : isHindi
                      ? roadMeta?.roadNameHi || roadMeta?.roadName
                      : roadMeta?.roadName)}
                </h4>

                <div className="mt-2 p-2.5 rounded-lg bg-blue-50/70 dark:bg-[#111318] border border-blue-200/70 dark:border-white/[0.08] text-xs text-slate-800 dark:text-[#E8EAEE] space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-blue-600 dark:text-[#9AC2FA] font-semibold shrink-0">
                      City / State:
                    </span>
                    <span className="font-semibold text-right">
                      {locationDetails && gpsData
                        ? formatCityDistrictState({
                            city: locationDetails.city,
                            district: locationDetails.district,
                            state: locationDetails.state,
                            lat: gpsData.lat,
                            lng: gpsData.lng,
                          })
                        : gpsData && !isInsideMlCoverage
                        ? `${gpsData.lat.toFixed(4)}, ${gpsData.lng.toFixed(4)}`
                        : "Delhi NCR Hub"}
                    </span>
                  </div>
                  {locationDetails?.district && (
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-[#C5C8D0]">
                      <span>District:</span>
                      <span className="font-medium text-right">{locationDetails.district}</span>
                    </div>
                  )}
                  {locationDetails?.area && locationDetails.area !== locationDetails.city && (
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-[#C5C8D0]">
                      <span>Area / Ward:</span>
                      <span className="text-right">{locationDetails.area}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between text-[11px] text-slate-500 dark:text-[#8C93A4]">
                <span>Geocoding Source:</span>
                <span className="font-semibold text-slate-800 dark:text-[#E8EAEE]">
                  {locationDetails
                    ? locationDetails.geocodeSource === "tomtom_reverse_geocode"
                      ? "TomTom Reverse Geocode"
                      : locationDetails.geocodeSource === "coordinates_only"
                      ? "Exact GPS Coordinates Only"
                      : "OpenStreetMap Nominatim"
                    : "Sensor Corridor Matching"}
                </span>
              </div>
            </div>

            {/* 2. REAL SPEED VS FREE-FLOW SPEED */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4] uppercase tracking-wider block">
                  {isHindi ? "वर्तमान गति बनाम मुक्त प्रवाह" : "Current vs Free-Flow Speed"}
                </span>

                {loadingTraffic ? (
                  <div className="flex items-center gap-2 py-3 text-xs text-blue-600 dark:text-[#9AC2FA]">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Querying TomTom live telemetry...</span>
                  </div>
                ) : activeCurrentSpeed !== null && activeFreeFlowSpeed !== null ? (
                  <>
                    <div className="flex items-baseline gap-2 mt-1.5">
                      <span className="font-serif text-3xl sm:text-4xl font-medium text-slate-900 dark:text-white tabular-nums">
                        {activeCurrentSpeed}
                      </span>
                      <span className="text-sm font-semibold text-slate-500 dark:text-[#8C93A4]">km/h</span>
                    </div>

                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-slate-600 dark:text-[#C5C8D0]">
                        <span>Free-Flow Baseline:</span>
                        <b className="text-slate-900 dark:text-white">{activeFreeFlowSpeed} km/h</b>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-[#C5C8D0]">
                        <span>Speed Variance:</span>
                        <b className={(speedDiff ?? 0) < 0 ? "text-rose-500" : "text-emerald-500"}>
                          {(speedDiff ?? 0) < 0
                            ? `${speedDiff} km/h (Slow)`
                            : `+${speedDiff} km/h (Smooth)`}
                        </b>
                      </div>
                    </div>

                    {/* Capacity Flow Bar */}
                    <div className="mt-2.5">
                      <div className="flex justify-between text-[10px] text-slate-400 dark:text-[#8C93A4] mb-1">
                        <span>
                          Flow Efficiency:{" "}
                          {Math.round((activeCurrentSpeed / Math.max(activeFreeFlowSpeed, 1)) * 100)}%
                        </span>
                        <span>100% Free-flow</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-[#1B1D22] h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            activeCurrentSpeed >= 35
                              ? "bg-emerald-500"
                              : activeCurrentSpeed >= 22
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((activeCurrentSpeed / Math.max(activeFreeFlowSpeed, 1)) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-2 space-y-1.5">
                    <div className="font-serif text-2xl font-medium text-slate-500 dark:text-[#8C93A4]">
                      Unavailable
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-[#8C93A4] leading-relaxed">
                      {coordTraffic?.reason ||
                        (isHindi
                          ? "इन निर्देशांकों के लिए लाइव सड़क गति उपलब्ध नहीं है।"
                          : "Live road segment speed was not returned for this exact coordinate point.")}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between text-[11px] text-slate-500 dark:text-[#8C93A4]">
                <span>Data Feed:</span>
                <span
                  className={`font-semibold ${
                    coordTraffic?.traffic_available || (activeRoad && !activeRoad.is_simulated)
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {coordTraffic?.traffic_available
                    ? `TomTom Live Flow${locationDetails?.city ? ` (${locationDetails.city})` : ""}`
                    : isExternalLocation
                    ? "Coordinate Flow Unavailable"
                    : activeRoad?.is_simulated
                    ? "Simulated Baseline (Delhi NCR)"
                    : "Delhi NCR Live Feed"}
                </span>
              </div>
            </div>

            {/* 3. CONGESTION LEVEL */}
            <div className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 ${congestionInfo.colorClass}`}>
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                  <span>{isHindi ? "ट्रैफिक भीड़ स्तर" : "Congestion Level"}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${congestionInfo.badgeBg}`} />
                </div>

                <h4 className="font-serif text-xl font-medium mt-1.5">
                  {congestionInfo.label}
                </h4>

                <p className="text-xs mt-1 leading-relaxed opacity-95">
                  {congestionInfo.sublabel}
                </p>
              </div>

              <div className="pt-2 border-t border-current/20 flex items-center justify-between text-[11px] font-semibold opacity-95">
                <span>Condition Tier:</span>
                <span className="capitalize font-bold">
                  {congestionInfo.level === "smooth"
                    ? "Smooth (Green)"
                    : congestionInfo.level === "moderate"
                    ? "Moderate (Yellow)"
                    : congestionInfo.level === "heavy"
                    ? "Heavy (Orange)"
                    : congestionInfo.level === "severe"
                    ? "Severe (Red)"
                    : "Unavailable (Gray)"}
                </span>
              </div>
            </div>
          </div>

          {/* NEARBY MONITORED ROADS & INTERSECTIONS STRIP */}
          {nearbyIntersections.length > 0 && (
            <div
              className="p-4 rounded-2xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] space-y-2.5"
              data-testid="nearby-roads-strip"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
                  <span>
                    {gpsData
                      ? isHindi
                        ? "आपके निकटतम मॉनिटर किए गए चौराहे / सड़कें"
                        : "Nearest Monitored Corridors & Intersections"
                      : isHindi
                      ? "मॉनिटर किए गए प्रमुख चौराहे"
                      : "Nearby Monitored Delhi NCR Intersections"}
                  </span>
                </span>
                {gpsData && !isInsideMlCoverage && distanceKm !== null && (
                  <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                    Closest corridor sensor is {distanceKm} km away (outside local city telemetry)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {nearbyIntersections.map(({ node, distanceKm: dist }) => {
                  const st = classifyTrafficCondition({
                    currentSpeed: node.current_speed,
                    freeFlowSpeed: node.baseline_speed,
                    congestionLevel: node.congestion_level,
                  });
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => onSelectIntersection(node.id)}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        node.id === selectedId
                          ? "border-blue-500 dark:border-[#9AC2FA]/50 bg-blue-50/70 dark:bg-[#9AC2FA]/[0.08]"
                          : "border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111318] hover:border-blue-400 dark:hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {isHindi ? node.name_hi : node.name}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${st.badgeClasses}`}>
                          {isHindi ? st.shortLabelHi : st.shortLabel}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-[#8C93A4]">
                        <span>{node.current_speed} km/h ({node.is_simulated ? "Simulated" : "Live"})</span>
                        <span>{dist !== null ? `${dist} km away` : node.zone}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 15-30 MINUTE PREDICTION SECTION (Progressive Disclosure) */}
          <details className="group rounded-2xl bg-blue-50/40 dark:bg-[#161920] border border-blue-200/70 dark:border-white/[0.08] overflow-hidden">
            <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer p-4 sm:p-5 flex flex-wrap items-center justify-between gap-2 hover:bg-blue-50/70 dark:hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600 dark:text-[#9AC2FA]" />
                <h4 className="font-serif font-medium text-base text-slate-900 dark:text-white">
                  {isHindi ? "अगले 15–30 मिनट का ट्रैफिक AI पूर्वानुमान" : "AI Traffic Forecast (+15 & +30 Min)"}
                </h4>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {isInsideMlCoverage && forecast15?.predicted_speed !== undefined && (
                  <span className="font-mono text-[11px] text-slate-600 dark:text-[#C5C8D0]">
                    +15m: {forecast15.predicted_speed} km/h
                    {forecast30?.predicted_speed !== undefined ? ` • +30m: ${forecast30.predicted_speed} km/h` : ""}
                  </span>
                )}
                <span className="text-[11px] font-semibold text-blue-600 dark:text-[#9AC2FA] group-open:hidden">
                  {isHindi ? "पूर्वानुमान देखें" : "View Forecast"}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4] hidden group-open:inline">
                  {isHindi ? "छिपाएं" : "Hide"}
                </span>
              </div>
            </summary>

            <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3 border-t border-blue-200/50 dark:border-white/[0.07] pt-3">
              <div className="flex items-center justify-between text-[11px] text-blue-700 dark:text-[#9AC2FA] font-medium">
                <span>
                  {isInsideMlCoverage
                    ? "Historical Traffic Pattern Learning"
                    : distanceKm !== null
                    ? `~${distanceKm} km outside Delhi ML sensor grid`
                    : "Machine Learning Model Registry"}
                </span>
              </div>

            {isInsideMlCoverage ? (
              loadingForecast ? (
                <div className="p-6 text-center text-xs text-blue-600 dark:text-[#9AC2FA] flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Computing AI forecast curves...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 15m Horizon */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 dark:text-[#C5C8D0] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
                        <span>+15 Minutes Prediction</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-[#9AC2FA]/15 text-blue-700 dark:text-[#9AC2FA]">
                        +15 Min
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="font-serif text-2xl font-medium text-slate-900 dark:text-white tabular-nums">
                        {forecast15?.predicted_speed !== undefined
                          ? `${forecast15.predicted_speed} km/h`
                          : "Unavailable"}
                      </span>
                      <span className="text-xs font-semibold capitalize text-blue-600 dark:text-[#9AC2FA]">
                        {forecast15?.predicted_congestion_level || "Pending"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-[#C5C8D0]">
                      {forecast15?.expected_congestion_onset || "Waiting for forecast telemetry..."}
                    </p>
                  </div>

                  {/* 30m Horizon */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 dark:text-[#C5C8D0] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
                        <span>+30 Minutes Prediction</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-[#9AC2FA]/15 text-blue-700 dark:text-[#9AC2FA]">
                        +30 Min
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="font-serif text-2xl font-medium text-slate-900 dark:text-white tabular-nums">
                        {forecast30?.predicted_speed !== undefined
                          ? `${forecast30.predicted_speed} km/h`
                          : "Unavailable"}
                      </span>
                      <span className="text-xs font-semibold capitalize text-blue-600 dark:text-[#9AC2FA]">
                        {forecast30?.predicted_congestion_level || "Pending"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-[#C5C8D0]">
                      {forecast30?.expected_congestion_onset || "Waiting for forecast telemetry..."}
                    </p>
                  </div>
                </div>
              )
            ) : (
              /* OUTSIDE DELHI: Never invent predictions for Agra/Dehradun! */
              <div className="p-4 rounded-xl bg-white/90 dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] text-xs space-y-2">
                <div className="flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-blue-600 dark:text-[#9AC2FA] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">
                      {isHindi ? "इस क्षेत्र के लिए एमएल पूर्वानुमान उपलब्ध नहीं है" : "Prediction unavailable for this region"}
                    </span>
                    <p className="text-slate-600 dark:text-[#C5C8D0] mt-1 leading-relaxed">
                      {isHindi
                        ? `मशीन लर्निंग मॉडल वर्तमान में दिल्ली एनसीआर के सत्यापित सेंसर नेटवर्क पर प्रशिक्षित है। ${locationDetails?.city || "इस क्षेत्र"} (${locationDetails?.state || "भारत"}) के लिए ऐतिहासिक प्रशिक्षण डेटा मॉडल रजिस्ट्री में उपलब्ध नहीं है। ऊपर प्रदर्शित टॉमटॉम लाइव डेटा ${locationDetails?.city || "आपके शहर"} की वास्तविक वर्तमान स्थिति को दर्शाता है।`
                        : `The Federated Learning ML model is currently trained on the verified smart corridor sensor network of Delhi NCR. Historical continuous observations for ${locationDetails?.city || "this city"} (${locationDetails?.state || "India"}) are not yet registered in the active prediction model. Live TomTom speed displayed above accurately reflects authentic current conditions.`}
                    </p>
                  </div>
                </div>
              </div>
            )}
            </div>
          </details>

          {/* SMART ROUTE RECOMMENDATION CALLOUT */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 dark:bg-[#9AC2FA]/15 text-white dark:text-[#9AC2FA] border border-transparent dark:border-[#9AC2FA]/30 flex items-center justify-center shrink-0">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <span className="font-serif font-medium text-base text-slate-900 dark:text-white block">
                  {isHindi ? "स्मार्ट रूट एवं यात्रा समय विकल्प" : "Smart Route Recommendation"}
                </span>
                <p className="text-slate-500 dark:text-[#8C93A4] text-[11px] mt-0.5 leading-relaxed">
                  {isHindi
                    ? "अपने शुरुआती बिंदु और गंतव्य के बीच वैकल्पिक मार्गों, वास्तविक ट्रैफिक विलंब एवं यात्रा समय की तुलना करें।"
                    : "Compare alternative routes, real-time traffic delay breakdowns, and choose the fastest commute."}
                </p>
              </div>
            </div>
            {onSwitchToRoutes ? (
              <button
                type="button"
                onClick={onSwitchToRoutes}
                className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#B4D2FC] text-white dark:text-[#0A0D14] font-semibold text-xs shadow-sm inline-flex items-center gap-2 shrink-0 transition-colors cursor-pointer"
              >
                <span>{isHindi ? "स्मार्ट रूट खोलें" : "Explore Smart Routes"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <Link
                to="/routes"
                className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#B4D2FC] text-white dark:text-[#0A0D14] font-semibold text-xs shadow-sm inline-flex items-center gap-2 shrink-0 transition-colors"
              >
                <span>{isHindi ? "स्मार्ट रूट खोलें" : "Explore Smart Routes"}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      )}
{/* TAB 2: TRAFFIC DATA COVERAGE */}
      {activeTab === "coverage" && (
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-white/[0.08]">
            <div>
              <h3 className="font-serif font-medium text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600 dark:text-[#9AC2FA]" />
                <span>Pan-India Traffic Data Coverage Matrix</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#8C93A4] mt-0.5">
                Transparent verification of monitored telemetry corridors, pan-India GPS flow coverage, and unmonitored segments.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-[#9AC2FA]/15 text-blue-700 dark:text-[#9AC2FA] border border-blue-200 dark:border-[#9AC2FA]/30">
              Pan-India GPS Flow Active
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/[0.08]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#161920] border-b border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#C5C8D0] font-semibold">
                  <th className="p-3">Corridor / City</th>
                  <th className="p-3">Region / State</th>
                  <th className="p-3">Coverage Tier</th>
                  <th className="p-3">Data Status</th>
                  <th className="p-3">Telemetry Feed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {COVERAGE_DATA.map((item, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors ${
                      item.isCovered ? "" : "bg-red-50/20 dark:bg-red-950/10 text-slate-400"
                    }`}
                  >
                    <td className="p-3 font-semibold">{item.road}</td>
                    <td className="p-3 text-slate-500">{item.zone}</td>
                    <td className="p-3 font-mono text-[11px]">{item.node}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.isCovered
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {item.isCovered ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {item.status}
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            {item.status}
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 text-[11px]">{item.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </div>
  );
};

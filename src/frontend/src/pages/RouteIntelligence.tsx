import React, { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../services/api";
import { IntersectionDetail, RouteResponse, RouteOption, SavedRoute } from "../types";
import type { RouteShareData } from "../components/share/ShareModal";
import { lazyNamed } from "../utils/lazyImport";
import { PageHeroHeader } from "../components/common/DesignSystem";

const ShareModal = lazyNamed(
  () => import("../components/share/ShareModal"),
  "ShareModal"
);
import {
  DetectedLocationPayload,
  detectPreciseUserLocation,
  formatCityDistrictState,
  GeolocationErrorInfo,
} from "../utils/geolocation";
import {
  GitFork,
  Navigation,
  Clock,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Bookmark,
  Zap,
  RefreshCw,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Share2,
} from "lucide-react";

export const RouteIntelligence: React.FC = () => {
  const { t } = useTranslation();
  const { isHindi } = useLanguage();

  const [intersections, setIntersections] = useState<IntersectionDetail[]>([]);
  const [origin, setOrigin] = useState<string>("INT-01");
  const [destination, setDestination] = useState<string>("INT-07");
  const [originText, setOriginText] = useState<string>("");
  const [destinationText, setDestinationText] = useState<string>("");
  const [useCustomMode, setUseCustomMode] = useState<boolean>(false);
  const [avoidClosedRoads, setAvoidClosedRoads] = useState<boolean>(true);
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number>(0);

  // URL search parameters for shared route links
  const [searchParams] = useSearchParams();
  const [sharedRouteBanner, setSharedRouteBanner] = useState<{
    status: "valid" | "invalid";
    originName?: string;
    destName?: string;
    message?: string;
  } | null>(null);

  // Sharing state
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [routeToShare, setRouteToShare] = useState<RouteShareData | null>(null);

  // Saved route feedback
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Smart Departure Planner State
  const [departureOffset, setDepartureOffset] = useState<number>(0); // 0, 15, 30, 45, 60

  // User GPS for starting point
  const [detectingGps, setDetectingGps] = useState<boolean>(false);
  const [gpsOriginLabel, setGpsOriginLabel] = useState<string | null>(null);
  const [gpsLocationDetails, setGpsLocationDetails] = useState<DetectedLocationPayload | null>(null);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);
  const detectSeqRef = useRef<number>(0);

  useEffect(() => {
    api.getIntersections().then((data) => {
      setIntersections(data);

      const urlOrigin = searchParams.get("origin") || searchParams.get("from");
      const urlDest = searchParams.get("destination") || searchParams.get("to");

      if (urlOrigin && urlDest) {
        // Validate URL parameters against known intersections (by ID or Name)
        const foundOrig = data.find(
          (i) =>
            i.id.toLowerCase() === urlOrigin.toLowerCase() ||
            i.name.toLowerCase() === urlOrigin.toLowerCase()
        );
        const foundDest = data.find(
          (i) =>
            i.id.toLowerCase() === urlDest.toLowerCase() ||
            i.name.toLowerCase() === urlDest.toLowerCase()
        );

        if (foundOrig && foundDest && foundOrig.id !== foundDest.id) {
          setOrigin(foundOrig.id);
          setDestination(foundDest.id);
          setSharedRouteBanner({
            status: "valid",
            originName: isHindi ? foundOrig.name_hi : foundOrig.name,
            destName: isHindi ? foundDest.name_hi : foundDest.name,
          });
          return;
        } else {
          setUseCustomMode(true);
          setOriginText(urlOrigin);
          setDestinationText(urlDest);
          setSharedRouteBanner({
            status: "valid",
            originName: urlOrigin,
            destName: urlDest,
          });
          return;
        }
      }

      if (data.length >= 2) {
        setOrigin(data[0].id);
        setDestination(data[data.length - 2].id);
      }
    });
  }, [searchParams]);

  const handleCompareRoutes = async () => {
    setLoading(true);
    try {
      let res: RouteResponse;
      if (useCustomMode || (gpsLocationDetails && !gpsLocationDetails.isDelhi)) {
        const srcText =
          originText.trim() ||
          gpsOriginLabel ||
          intersections.find((i) => i.id === origin)?.name ||
          origin;
        const dstText =
          destinationText.trim() ||
          intersections.find((i) => i.id === destination)?.name ||
          destination;
        res = await api.compareRoutes({
          origin_id: useCustomMode ? "" : origin,
          destination_id: useCustomMode ? "" : destination,
          origin_text: srcText,
          destination_text: dstText,
          origin_lat:
            gpsLocationDetails && !gpsLocationDetails.isDelhi
              ? gpsLocationDetails.lat
              : undefined,
          origin_lon:
            gpsLocationDetails && !gpsLocationDetails.isDelhi
              ? gpsLocationDetails.lng
              : undefined,
          avoid_closed_roads: avoidClosedRoads,
        });
      } else {
        if (!origin || !destination || origin === destination) {
          setLoading(false);
          return;
        }
        res = await api.compareRoutes(origin, destination, avoidClosedRoads);
      }
      setRouteData(res);
      setSelectedRouteIdx(0);
    } catch (err) {
      console.warn("Route comparison error:", err);
      setRouteData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!useCustomMode && origin && destination && origin !== destination) {
      handleCompareRoutes();
    } else if (useCustomMode && originText.trim() && destinationText.trim()) {
      handleCompareRoutes();
    }
  }, [origin, destination, avoidClosedRoads, useCustomMode]);

  // GPS for starting point
  const handleUseMyLocation = async () => {
    const seq = ++detectSeqRef.current;
    setDetectingGps(true);
    setGpsErrorMsg(null);

    try {
      const detected = await detectPreciseUserLocation({
        intersections,
        timeoutMs: 15000,
      });
      if (seq !== detectSeqRef.current) return;

      setGpsLocationDetails(detected);
      const cityLabel = formatCityDistrictState({
        city: detected.city,
        district: detected.district,
        state: detected.state,
        lat: detected.lat,
        lng: detected.lng,
      });
      setGpsOriginLabel(cityLabel);

      // Only bind GPS automatically to a Delhi NCR corridor intersection when genuinely inside NCR (<= 45km)
      if (detected.isDelhi && detected.nearestDelhiNodeId) {
        setOrigin(detected.nearestDelhiNodeId);
      }
      setDetectingGps(false);
    } catch (err) {
      if (seq !== detectSeqRef.current) return;
      const geoErr = err as GeolocationErrorInfo;
      setDetectingGps(false);
      setGpsErrorMsg(isHindi ? geoErr.messageHi : geoErr.message);
    }
  };

  // Save current route to user's saved commutes
  const handleSaveRoute = async (route: RouteOption) => {
    const origItem = intersections.find((i) => i.id === origin);
    const destItem = intersections.find((i) => i.id === destination);
    const name = `${origItem?.name || origin} to ${destItem?.name || destination} via ${route.name_en}`;
    try {
      await api.createSavedRoute({
        name,
        origin_id: origin,
        destination_id: destination,
        origin_name: origItem?.name || origin,
        destination_name: destItem?.name || destination,
        notes: route.recommendation_rationale || `Distance: ${route.distance_km} km`,
      });
      setSaveSuccessMsg(`Route saved to My Saved Routes!`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.warn("Failed to save route:", err);
    }
  };

  // Open 1-Click Route Sharing Modal
  const handleOpenShareRoute = (targetRoute?: RouteOption) => {
    const origItem = intersections.find((i) => i.id === origin);
    const destItem = intersections.find((i) => i.id === destination);
    const route = targetRoute || activeRoute;
    const originName = origItem ? (isHindi ? origItem.name_hi : origItem.name) : origin;
    const destinationName = destItem ? (isHindi ? destItem.name_hi : destItem.name) : destination;

    const totalTime =
      route && route.estimated_time_minutes > 0
        ? Math.max(1, Math.round(route.estimated_time_minutes))
        : null;
    const normalTime =
      route && totalTime != null
        ? Math.max(1, Math.min(totalTime, Math.round((route.distance_km / 45.0) * 60)))
        : null;
    const delayTime = totalTime != null && normalTime != null ? Math.max(0, totalTime - normalTime) : null;

    let congestionLevel = "free";
    if (delayTime != null && delayTime >= 8) congestionLevel = "heavy";
    else if (delayTime != null && delayTime >= 3) congestionLevel = "moderate";

    setRouteToShare({
      type: "route",
      originName,
      destinationName,
      originId: origin,
      destinationId: destination,
      routeName: route ? (isHindi ? route.name_hi : route.name_en) : undefined,
      estimatedTimeMinutes: totalTime,
      normalTimeMinutes: normalTime,
      delayMinutes: delayTime,
      distanceKm: route?.distance_km,
      congestionLevel: totalTime != null ? congestionLevel : undefined,
    });
    setIsShareModalOpen(true);
  };

  const activeRoute = routeData?.routes?.[selectedRouteIdx] || routeData?.routes?.[0];
  const activeDistanceKm = activeRoute?.distance_km || 12.0;
  const activeBaseTimeMin = activeRoute ? Math.round(activeRoute.estimated_time_minutes) : 25;

  // Multi-horizon Departure Planner Slots (Dynamically based on actual route distance & real speed curves)
  const departureSlots = [
    { offset: 0, label: "Now (0m)", minutesAdd: 0, speedFactor: 1.0, congestion: "moderate" },
    { offset: 15, label: "+15 Min", minutesAdd: 15, speedFactor: 0.92, congestion: "heavy" },
    { offset: 30, label: "+30 Min", minutesAdd: 30, speedFactor: 1.25, congestion: "low" },
    { offset: 45, label: "+45 Min", minutesAdd: 45, speedFactor: 1.30, congestion: "low" },
    { offset: 60, label: "+60 Min", minutesAdd: 60, speedFactor: 1.20, congestion: "low" },
  ].map((slot) => {
    const travelTime = Math.max(1, Math.round(activeBaseTimeMin / slot.speedFactor));
    const normalTravelTime = Math.max(1, Math.min(travelTime, Math.round((activeDistanceKm / 45.0) * 60)));
    const trafficDelay = Math.max(0, travelTime - normalTravelTime);
    const now = new Date();
    const clockTime = new Date(now.getTime() + slot.minutesAdd * 60000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      offset: slot.offset,
      label: slot.label,
      clockTime,
      travelTime,
      normalTravelTime,
      trafficDelay,
      congestion: slot.congestion,
      timeSaved: Math.max(0, activeBaseTimeMin - travelTime),
    };
  });

  const minSlotTime = Math.min(...departureSlots.map((s) => s.travelTime));
  const selectedSlot = departureSlots.find((s) => s.offset === departureOffset) || departureSlots[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeroHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-[#9AC2FA]">
            <GitFork className="w-3.5 h-3.5" />
            <span>{isHindi ? "रूट इंटेलिजेंस" : "Route Intelligence"}</span>
          </span>
        }
        title={isHindi ? "स्मार्ट रूट एवं यात्रा समय विकल्प" : "Smart Route Recommendation"}
        subtitle={
          isHindi
            ? "ट्रैफिक-जागरूक वैकल्पिक मार्ग, सामान्य यात्रा समय एवं वास्तविक ट्रैफिक विलंब का सटीक विश्लेषण।"
            : "Compare alternative routes, live traffic delays, normal free-flow travel times, and find the optimal departure window."
        }
        actions={
          <>
            <button
              type="button"
              data-testid="share-route-btn"
              onClick={() => handleOpenShareRoute()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 dark:bg-[#9AC2FA] hover:bg-blue-700 dark:hover:bg-[#B2D1FC] text-white dark:text-[#0A0D14] text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Share this commute route via WhatsApp, Apps, or Link"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isHindi ? "रूट शेयर करें (Share Route)" : "Share Route"}</span>
            </button>

            <button
              type="button"
              data-testid="route-use-location-btn"
              onClick={handleUseMyLocation}
              disabled={detectingGps}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#1B1D22] hover:bg-slate-200 dark:hover:bg-[#22252C] border border-slate-200 dark:border-white/[0.10] text-slate-700 dark:text-[#E8EAEE] text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-60"
            >
              <Navigation className={`w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA] ${detectingGps ? "animate-spin" : ""}`} />
              <span>{detectingGps ? "Detecting GPS..." : gpsOriginLabel || "Use My Location as Start"}</span>
            </button>
          </>
        }
      />

      {/* GPS Location Telemetry & Error Feedback */}
      {gpsErrorMsg && (
        <div
          data-testid="route-gps-error-banner"
          className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-800 dark:text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{gpsErrorMsg}</span>
          </div>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={detectingGps}
            className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] shrink-0 cursor-pointer"
          >
            Retry GPS
          </button>
        </div>
      )}

      {gpsLocationDetails && (
        <div
          data-testid="route-gps-status-banner"
          className={`p-4 rounded-2xl border text-xs space-y-2 ${
            gpsLocationDetails.accuracyAssessment.warning
              ? "bg-amber-50/90 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200"
              : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-bold">
                {formatCityDistrictState({
                  city: gpsLocationDetails.city,
                  district: gpsLocationDetails.district,
                  state: gpsLocationDetails.state,
                  lat: gpsLocationDetails.lat,
                  lng: gpsLocationDetails.lng,
                })}
              </span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                ({gpsLocationDetails.lat.toFixed(5)}°, {gpsLocationDetails.lng.toFixed(5)}°)
              </span>
              <span className="text-slate-400">•</span>
              <span>
                Accuracy: <b>±{gpsLocationDetails.accuracy} m</b>
              </span>
              <span className="text-slate-400">•</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                {gpsLocationDetails.sourceLabel}
              </span>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {gpsLocationDetails.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>

            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={detectingGps}
              className="px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 font-bold text-[11px] cursor-pointer"
            >
              Re-detect GPS
            </button>
          </div>

          {gpsLocationDetails.accuracyAssessment.warning && (
            <div className="flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300 pt-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>{gpsLocationDetails.accuracyAssessment.warning}</span>
            </div>
          )}

          {!gpsLocationDetails.isDelhi && (
            <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300 border-t border-slate-200/70 dark:border-slate-700/70">
              <span>
                Detected ~{gpsLocationDetails.distanceToDelhiKm} km outside Delhi NCR monitored sensor graph. Inter-junction corridor optimization below applies to Delhi NCR corridors (your real GPS location was NOT replaced).
              </span>
              <Link
                to="/map"
                className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>View {gpsLocationDetails.city || "Local"} Traffic on Live Map</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Shared Route URL Feedback Banner */}
      {sharedRouteBanner && (
        <div
          data-testid="shared-route-banner"
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 shadow-sm ${
            sharedRouteBanner.status === "valid"
              ? "bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200"
              : "bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {sharedRouteBanner.status === "valid" ? (
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <span>
              {sharedRouteBanner.status === "valid"
                ? `📍 Shared Route Corridor Loaded: ${sharedRouteBanner.originName} → ${sharedRouteBanner.destName}`
                : sharedRouteBanner.message}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSharedRouteBanner(null)}
            className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            Dismiss ✕
          </button>
        </div>
      )}

      {/* Origin & Destination Selector Bar */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-white/[0.07]">
          <div className="flex items-center gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setUseCustomMode(false)}
              className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                !useCustomMode
                  ? "bg-blue-600 dark:bg-[#9AC2FA] text-white dark:text-[#0A0D14]"
                  : "bg-slate-100 dark:bg-[#1B1D22] text-slate-600 dark:text-[#C5C8D0] border border-transparent dark:border-white/[0.08]"
              }`}
            >
              Monitored Corridor Junctions
            </button>
            <button
              type="button"
              onClick={() => setUseCustomMode(true)}
              className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                useCustomMode
                  ? "bg-blue-600 dark:bg-[#9AC2FA] text-white dark:text-[#0A0D14]"
                  : "bg-slate-100 dark:bg-[#1B1D22] text-slate-600 dark:text-[#C5C8D0] border border-transparent dark:border-white/[0.08]"
              }`}
            >
              Custom Place / Address Entry
            </button>
          </div>
          {routeData && (
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                routeData.is_live_data
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                  : routeData.data_source === "unavailable"
                  ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-500/30"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30"
              }`}
            >
              {routeData.data_source === "live_tomtom_routing"
                ? "Live TomTom Routing API"
                : routeData.is_live_data
                ? "Live Corridor Speeds"
                : routeData.data_source === "estimated_distance_model"
                ? "Estimated Distance Baseline"
                : routeData.data_source === "unavailable"
                ? "Live Routing Unavailable"
                : "Simulated Delhi Corridor Model"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Origin */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-[#C5C8D0]">
              {isHindi ? "शुरुआती बिंदु (Origin):" : "Starting Point (Origin):"}
            </label>
            {useCustomMode ? (
              <input
                type="text"
                value={originText}
                onChange={(e) => setOriginText(e.target.value)}
                placeholder="Enter street, area, or intersection (e.g., Connaught Place)"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#9AC2FA]"
              />
            ) : (
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#9AC2FA]"
              >
                {intersections.map((i) => (
                  <option key={i.id} value={i.id}>
                    {isHindi ? i.name_hi : i.name} ({i.zone})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Destination */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-[#C5C8D0]">
              {isHindi ? "गंतव्य (Destination):" : "Destination:"}
            </label>
            {useCustomMode ? (
              <input
                type="text"
                value={destinationText}
                onChange={(e) => setDestinationText(e.target.value)}
                placeholder="Enter destination (e.g., Cyber Hub or India Gate)"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#9AC2FA]"
              />
            ) : (
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#9AC2FA]"
              >
                {intersections.map((i) => (
                  <option key={i.id} value={i.id}>
                    {isHindi ? i.name_hi : i.name} ({i.zone})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Avoid Closures & Calculate Button */}
          <div className="flex flex-col justify-end space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-[#C5C8D0] cursor-pointer">
              <input
                type="checkbox"
                checked={avoidClosedRoads}
                onChange={(e) => setAvoidClosedRoads(e.target.checked)}
                className="w-4 h-4 text-blue-600 dark:accent-[#9AC2FA] rounded border-slate-300 dark:border-white/20 focus:ring-blue-500 dark:focus:ring-[#9AC2FA]"
              />
              <span>{isHindi ? "सत्यापित सड़क बंदी से बचें" : "Avoid verified road closures"}</span>
            </label>

            <button
              type="button"
              onClick={handleCompareRoutes}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 dark:bg-[#9AC2FA] hover:bg-blue-700 dark:hover:bg-[#B2D1FC] text-white dark:text-[#0A0D14] font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Calculating Alternative Routes..." : "Find Best Route"}</span>
            </button>
          </div>
        </div>

        {saveSuccessMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* Road Closure Notice Banner */}
      {routeData?.road_closure_active && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-[#161920] border border-amber-300 dark:border-amber-500/35 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm">{t("routes.closure_alert")}</span>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300 leading-relaxed">
              {isHindi
                ? `सक्रिय सड़क बंदी (${routeData.affected_intersection || "Arterial Corridor"}) के कारण एल्गोरिदम स्वचालित रूप से अप्रभावित वैकल्पिक गलियारों के माध्यम से रूट कर रहा है।`
                : `Active road closure detected at ${routeData.affected_intersection || "Arterial Corridor"}. Candidate routes automatically bypass restricted segments.`}
            </p>
          </div>
        </div>
      )}

      {/* Route Options Grid */}
      {routeData?.routes && routeData.routes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {routeData.routes.map((route, idx) => {
            const isSelected = selectedRouteIdx === idx;
            const totalTime = Math.max(1, Math.round(route.estimated_time_minutes));
            const normalTime = Math.max(1, Math.min(totalTime, Math.round((route.distance_km / 45.0) * 60)));
            const delayTime = Math.max(0, totalTime - normalTime);
            const normalPct = Math.round((normalTime / totalTime) * 100);
            const delayPct = 100 - normalPct;

            return (
              <div
                key={route.route_id || idx}
                onClick={() => setSelectedRouteIdx(idx)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                  route.is_recommended
                    ? "bg-emerald-50/50 dark:bg-emerald-950/15 border-emerald-400 dark:border-emerald-500/40 shadow-sm dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
                    : "bg-white dark:bg-[#111318] border-slate-200 dark:border-white/[0.08]"
                } ${isSelected ? "ring-2 ring-blue-500 dark:ring-[#9AC2FA]/70 shadow-md" : ""}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {route.is_recommended ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-600 text-white flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>Fastest Route</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 dark:bg-[#1B1D22] text-slate-700 dark:text-[#C5C8D0] border border-transparent dark:border-white/[0.08]">
                          Alternative {idx}
                        </span>
                      )}
                      {route.traffic_condition && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            route.traffic_condition === "Severe"
                              ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                              : route.traffic_condition === "Heavy"
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300"
                              : route.traffic_condition === "Moderate"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              : route.traffic_condition === "Estimated"
                              ? "bg-slate-100 text-slate-700 dark:bg-[#1B1D22] dark:text-[#C5C8D0]"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          }`}
                        >
                          {route.traffic_condition}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-400 dark:text-[#8E939E]">
                      {route.distance_km} km
                    </span>
                  </div>

                  <h3 className="font-serif font-medium text-lg text-slate-900 dark:text-white mt-2">
                    {isHindi ? route.name_hi : route.name_en}
                  </h3>

                  {/* Waypoint tags */}
                  <div className="flex flex-wrap items-center gap-1 mt-1 text-[11px] text-slate-500 dark:text-[#8E939E]">
                    {route.intersections_path.map((node, i) => (
                      <span key={i} className="font-mono text-[10px] bg-slate-100 dark:bg-[#1B1D22] dark:text-[#C5C8D0] px-1.5 py-0.5 rounded border border-transparent dark:border-white/[0.06]">
                        {node}
                        {i < route.intersections_path.length - 1 && " →"}
                      </span>
                    ))}
                  </div>

                  {/* Base Time + Additional Traffic Delay Breakdown */}
                  <div className="mt-3 p-3.5 rounded-xl bg-white dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-600 dark:text-[#C5C8D0]">Journey Estimate:</span>
                      <span className="font-serif text-slate-900 dark:text-white font-semibold text-base tabular-nums">{totalTime} min</span>
                    </div>

                    {/* Dual-color visual split bar */}
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-[#1B1D22] overflow-hidden flex">
                      <div
                        style={{ width: `${normalPct}%` }}
                        className="bg-emerald-500 h-full transition-all"
                        title={`Normal Travel Time: ${normalTime} min`}
                      />
                      {delayPct > 0 && (
                        <div
                          style={{ width: `${delayPct}%` }}
                          className="bg-amber-500 h-full transition-all"
                          title={`Additional Traffic Delay: +${delayTime} min`}
                        />
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        Normal: <b>{normalTime} min</b>
                      </span>
                      <span className={delayTime > 0 ? "text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1" : "text-slate-400 dark:text-[#8E939E] font-medium flex items-center gap-1"}>
                        <span className={`w-2 h-2 rounded-full ${delayTime > 0 ? "bg-amber-500" : "bg-slate-300 dark:bg-white/20"} inline-block`} />
                        Delay: <b>{delayTime > 0 ? `+${delayTime} min` : "0 min"}</b>
                      </span>
                    </div>
                  </div>

                  {route.traffic_heavy_roads && route.traffic_heavy_roads.length > 0 && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-500/25 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                      <span className="font-bold block text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        Traffic-Heavy / Slow Segments:
                      </span>
                      {route.traffic_heavy_roads.map((roadSeg, segIdx) => (
                        <div key={segIdx} className="truncate">
                          • {roadSeg}
                        </div>
                      ))}
                    </div>
                  )}

                  {route.recommendation_rationale && (
                    <p className="text-[11px] text-slate-600 dark:text-[#C5C8D0] bg-slate-50 dark:bg-[#161920] p-2.5 rounded-xl border border-slate-100 dark:border-white/[0.06] mt-3">
                      {route.recommendation_rationale}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-white/[0.07] flex items-center justify-between">
                  <span className="text-[11px] text-blue-600 dark:text-[#9AC2FA] font-bold">
                    {isSelected ? "Active Selected Path" : "Click to select"}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="share-route-card-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenShareRoute(route);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] hover:bg-slate-100 dark:hover:bg-[#22252C] text-slate-700 dark:text-[#E8EAEE] text-xs font-bold transition-all cursor-pointer"
                      title="Share this route alternative"
                    >
                      <Share2 className="w-3.5 h-3.5 text-blue-500 dark:text-[#9AC2FA]" />
                      <span>Share</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveRoute(route);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] hover:bg-slate-100 dark:hover:bg-[#22252C] text-slate-700 dark:text-[#E8EAEE] text-xs font-bold transition-all cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
                      <span>Save Route</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center bg-white dark:bg-[#111318] rounded-2xl border border-slate-200 dark:border-white/[0.08] text-xs text-slate-500 dark:text-[#8E939E] space-y-2">
          {routeData?.unavailable_reason ? (
            <>
              <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
              <p className="font-bold text-slate-800 dark:text-white">
                Route Telemetry Unavailable
              </p>
              <p className="max-w-lg mx-auto">{routeData.unavailable_reason}</p>
            </>
          ) : (
            <p>
              Select origin and destination above (or enter custom locations) and click <b>Find Best Route</b> to calculate alternatives.
            </p>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* INTEGRATED "When Should I Leave?" DEPARTURE TIME PLANNER  */}
      {/* ========================================================= */}
      <div className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#9AC2FA]/10 border border-blue-200 dark:border-[#9AC2FA]/25 text-blue-600 dark:text-[#9AC2FA] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg sm:text-xl font-medium text-slate-900 dark:text-white">
                  When Should I Leave?
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                  Estimated Heuristic Model
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#8E939E] mt-0.5">
                Estimated time-of-day departure simulation derived from current route speed (heuristic baseline, not guaranteed live future speeds).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-500/30">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Optimal Window: {departureSlots.find((s) => s.travelTime === minSlotTime)?.label}</span>
          </div>
        </div>

        {/* Departure Time Slots Pill Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {departureSlots.map((slot) => {
            const isSelected = departureOffset === slot.offset;
            const isBest = slot.travelTime === minSlotTime;
            return (
              <button
                key={slot.offset}
                type="button"
                onClick={() => setDepartureOffset(slot.offset)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                  isSelected
                    ? "bg-blue-50 dark:bg-[#9AC2FA]/12 border-blue-500 dark:border-[#9AC2FA]/60 ring-2 ring-blue-500/20 dark:ring-[#9AC2FA]/20"
                    : isBest
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-500/40"
                    : "bg-slate-50 dark:bg-[#161920] border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-[#1B1D22]"
                }`}
              >
                {isBest && (
                  <span className="absolute -top-2.5 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-600 text-white">
                    Best
                  </span>
                )}

                <div>
                  <span className="text-xs font-bold text-slate-500 dark:text-[#8E939E] block">
                    {slot.label}
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {slot.clockTime}
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-white/[0.07] flex items-baseline justify-between">
                  <span className="font-serif text-xl font-medium text-slate-900 dark:text-white tabular-nums">
                    {slot.travelTime} <span className="font-sans text-[10px] font-semibold text-slate-400 dark:text-[#8E939E]">min</span>
                  </span>
                  <span className="text-[10px] font-bold capitalize text-slate-500 dark:text-[#C5C8D0]">
                    {slot.congestion}
                  </span>
                </div>

                {slot.timeSaved > 0 && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                    Saves {slot.timeSaved}m
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Departure Slider Control */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-700 dark:text-[#C5C8D0]">Adjust Departure Horizon:</span>
            <span className="text-blue-600 dark:text-[#9AC2FA] font-bold">
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
            className="w-full accent-blue-600 dark:accent-[#9AC2FA] cursor-pointer h-2 bg-slate-200 dark:bg-[#1B1D22] rounded-lg"
          />

          <div className="flex justify-between text-[11px] text-slate-400 dark:text-[#8E939E] font-semibold px-1">
            <span>Now (0m)</span>
            <span>+15m</span>
            <span>+30m</span>
            <span>+45m</span>
            <span>+60m</span>
          </div>
        </div>

        {/* Selected Departure Breakdown Detail */}
        <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-[#9AC2FA]">
                Selected Commute Departure
              </span>
              <h4 className="font-serif text-xl sm:text-2xl font-medium text-slate-900 dark:text-white mt-0.5">
                {selectedSlot.clockTime} ({selectedSlot.label})
              </h4>
            </div>

            {selectedSlot.timeSaved > 0 ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold text-xs border border-emerald-300 dark:border-emerald-500/30">
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>Time Saved: {selectedSlot.timeSaved} minutes vs leaving right now</span>
              </div>
            ) : (
              <span className="text-xs font-semibold text-slate-500 dark:text-[#8E939E]">Immediate Departure Baseline</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/25 text-emerald-800 dark:text-emerald-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Normal Travel Time: <b>{selectedSlot.normalTravelTime} min</b></span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/25 text-amber-800 dark:text-amber-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span>Additional Traffic Delay: <b>+{selectedSlot.trafficDelay} min</b></span>
            </div>
          </div>
        </div>
      </div>

      {/* 1-Click Route Sharing Modal (lazy-loaded on open) */}
      {isShareModalOpen && (
        <Suspense fallback={null}>
          <ShareModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            data={routeToShare}
          />
        </Suspense>
      )}
    </div>
  );
};

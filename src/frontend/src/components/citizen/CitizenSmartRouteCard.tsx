import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Clock,
  Crosshair,
  GitFork,
  Navigation,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { api } from "../../services/api";
import { IntersectionDetail, RouteOption, RouteResponse } from "../../types";
import { DetectedLocationEvent } from "../location/DetectMyLocationCard";
import { formatCityDistrictState } from "../../utils/geolocation";

interface CitizenSmartRouteCardProps {
  isHindi: boolean;
  intersections: IntersectionDetail[];
  detectedLocation: DetectedLocationEvent | null;
  defaultOriginId?: string;
}

const getConditionPillClasses = (condition?: string) => {
  switch ((condition || "").toLowerCase()) {
    case "severe":
      return "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800";
    case "heavy":
      return "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800";
    case "moderate":
      return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
    case "estimated":
      return "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    default:
      return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
  }
};

const formatRouteSourceLabel = (source?: string, isLive?: boolean) => {
  if (source === "live_tomtom_routing") return "Live TomTom Routing API";
  if (source === "live_tomtom_corridor" || isLive) return "Live TomTom Corridor Speeds";
  if (source === "estimated_distance_model") return "Estimated Distance Model (Live Unavailable)";
  if (source === "unavailable") return "Routing Telemetry Unavailable";
  return "Simulated Delhi Corridor Model";
};

export const CitizenSmartRouteCard: React.FC<CitizenSmartRouteCardProps> = ({
  isHindi,
  intersections,
  detectedLocation,
  defaultOriginId = "INT-01",
}) => {
  const [sourceInput, setSourceInput] = useState<string>("Connaught Central Circle");
  const [destInput, setDestInput] = useState<string>("Cyber Hub Gateway");
  const [usingGpsSource, setUsingGpsSource] = useState<boolean>(false);
  const [avoidClosures, setAvoidClosures] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);

  useEffect(() => {
    if (intersections.length >= 2 && !routeData && !loading) {
      const orig = intersections.find((i) => i.id === defaultOriginId) || intersections[0];
      const dest =
        intersections.find((i) => i.id !== orig.id && i.id === "INT-07") ||
        intersections.find((i) => i.id !== orig.id) ||
        intersections[1];
      setSourceInput(orig.name);
      setDestInput(dest.name);
      runRouteSearch(orig.name, dest.name, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intersections.length]);

  const matchNodeId = (text: string): string => {
    const clean = text.trim().toLowerCase();
    const found = intersections.find(
      (i) => i.id.toLowerCase() === clean || i.name.toLowerCase() === clean
    );
    return found ? found.id : "";
  };

  const runRouteSearch = async (
    rawSource: string,
    rawDest: string,
    withGps: boolean,
    avoid = avoidClosures
  ) => {
    const src = rawSource.trim();
    const dst = rawDest.trim();
    if (!src || !dst) {
      setErrorMsg(
        isHindi
          ? "कृपया शुरुआती स्थान और गंतव्य दोनों दर्ज करें।"
          : "Please enter both a starting location and a destination."
      );
      return;
    }

    setErrorMsg(null);
    setLoading(true);
    try {
      const originNodeId = withGps ? "" : matchNodeId(src);
      const destNodeId = matchNodeId(dst);

      const response = await api.compareRoutes({
        origin_id: originNodeId,
        destination_id: destNodeId,
        origin_text: src,
        destination_text: dst,
        origin_lat: withGps && detectedLocation ? detectedLocation.lat : undefined,
        origin_lon: withGps && detectedLocation ? detectedLocation.lng : undefined,
        avoid_closed_roads: avoid,
      });
      setRouteData(response);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to calculate route alternatives.";
      setErrorMsg(msg);
      setRouteData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runRouteSearch(sourceInput, destInput, usingGpsSource);
  };

  const handleUseDetectedOrigin = () => {
    if (!detectedLocation) return;
    const label =
      detectedLocation.roadName ||
      formatCityDistrictState({
        city: detectedLocation.city,
        district: detectedLocation.district,
        state: detectedLocation.state,
        lat: detectedLocation.lat,
        lng: detectedLocation.lng,
      });
    setSourceInput(label);
    setUsingGpsSource(true);
  };

  const handleSwapEndpoints = () => {
    setUsingGpsSource(false);
    const prevSource = sourceInput;
    setSourceInput(destInput);
    setDestInput(prevSource);
  };

  const originParam = encodeURIComponent(matchNodeId(sourceInput) || sourceInput.trim());
  const destParam = encodeURIComponent(matchNodeId(destInput) || destInput.trim());

  return (
    <div
      className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4"
      data-testid="citizen-smart-route-card"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.07]">
        <div>
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4 text-blue-600 dark:text-[#9AC2FA]" />
            <h2 className="font-serif font-medium text-base sm:text-lg text-slate-900 dark:text-white">
              {isHindi ? "स्मार्ट रूट सहायता और वैकल्पिक मार्ग" : "Smart Route Assistance"}
            </h2>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#8C93A4] mt-0.5">
            {isHindi
              ? "स्रोत और गंतव्य दर्ज करें, सबसे तेज़ मार्ग देखें और भीड़-भाड़ वाली सड़कों से बचें।"
              : "Enter your source and destination to compare route alternatives, travel time, and heavy-traffic segments."}
          </p>
        </div>

        <Link
          to={`/routes?from=${originParam}&to=${destParam}`}
          className="text-xs font-semibold text-blue-600 dark:text-[#9AC2FA] hover:underline inline-flex items-center gap-1 shrink-0"
        >
          <span>{isHindi ? "पूर्ण प्रस्थान योजना खोलें" : "Departure Timing & Map Planner"}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Source & Destination Input Form */}
      <form onSubmit={handleSubmit} className="space-y-3" data-testid="citizen-route-form">
        <datalist id="citizen-junction-options">
          {intersections.map((node) => (
            <option key={node.id} value={node.name}>
              {node.zone} ({node.id})
            </option>
          ))}
        </datalist>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4 space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-[#C5C8D0]">
                {isHindi ? "प्रारंभिक स्थान (Source)" : "Source / Starting Point"}
              </label>
              {detectedLocation && (
                <button
                  type="button"
                  onClick={handleUseDetectedOrigin}
                  className="text-[11px] font-semibold text-blue-600 dark:text-[#9AC2FA] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  data-testid="route-use-gps-btn"
                >
                  <Crosshair className="w-3 h-3" />
                  <span>{isHindi ? "मेरा GPS" : "Use My GPS"}</span>
                </button>
              )}
            </div>
            <input
              type="text"
              list="citizen-junction-options"
              value={sourceInput}
              onChange={(e) => {
                setSourceInput(e.target.value);
                setUsingGpsSource(false);
              }}
              placeholder={isHindi ? "जैसे: कनॉट प्लेस या कस्टम पता" : "e.g., Connaught Central Circle or custom place"}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#8C93A4] focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#9AC2FA]"
              data-testid="route-source-input"
            />
          </div>

          <div className="md:col-span-1 flex justify-center">
            <button
              type="button"
              onClick={handleSwapEndpoints}
              className="p-2 rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-600 dark:text-[#C5C8D0] transition-colors cursor-pointer"
              title="Swap source and destination"
              aria-label="Swap source and destination"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          <div className="md:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-[#C5C8D0] block">
              {isHindi ? "गंतव्य (Destination)" : "Destination"}
            </label>
            <input
              type="text"
              list="citizen-junction-options"
              value={destInput}
              onChange={(e) => setDestInput(e.target.value)}
              placeholder={isHindi ? "जैसे: साइबर हब या एम्स" : "e.g., Cyber Hub Gateway or custom place"}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#8C93A4] focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#9AC2FA]"
              data-testid="route-destination-input"
            />
          </div>

          <div className="md:col-span-3 flex flex-col gap-1.5">
            <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-[#C5C8D0] cursor-pointer">
              <input
                type="checkbox"
                checked={avoidClosures}
                onChange={(e) => setAvoidClosures(e.target.checked)}
                className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 dark:border-white/20"
              />
              <span>{isHindi ? "सड़क बंदी से बचें" : "Avoid closed roads"}</span>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#B4D2FC] disabled:opacity-60 text-white dark:text-[#0A0D14] text-xs font-semibold shadow-sm inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              data-testid="find-smart-route-btn"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
              <span>{loading ? "Comparing..." : isHindi ? "सर्वोत्तम मार्ग खोजें" : "Compare Routes"}</span>
            </button>
          </div>
        </div>
      </form>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-medium">
          {errorMsg}
        </div>
      )}

      {/* Provenance & Closure Notices */}
      {routeData && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#161920] border border-slate-200/80 dark:border-white/[0.08] text-[11px]">
            <span className="text-slate-600 dark:text-[#C5C8D0] font-medium">
              {routeData.advisory_notice}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0 ${
                routeData.is_live_data
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border dark:border-emerald-800/60"
                  : routeData.data_source === "unavailable"
                  ? "bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300 border dark:border-red-800/60"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border dark:border-amber-800/60"
              }`}
              data-testid="route-data-source-badge"
            >
              {formatRouteSourceLabel(routeData.data_source, routeData.is_live_data)}
            </span>
          </div>

          {routeData.road_closure_active && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Active road closure alert at <b>{routeData.affected_intersection || "arterial junction"}</b>. Detour options prioritize open corridors.
              </span>
            </div>
          )}

          {routeData.unavailable_reason && routeData.routes.length === 0 && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-600 dark:text-[#C5C8D0] flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {isHindi ? "मार्ग डेटा अनुपलब्ध" : "Live Route Calculation Unavailable"}
                </p>
                <p className="mt-0.5">{routeData.unavailable_reason}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Route Alternatives Grid */}
      {routeData?.routes && routeData.routes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {routeData.routes.map((route: RouteOption, idx: number) => {
            const heavyRoads = route.traffic_heavy_roads || [];
            const condition = route.traffic_condition || (route.congestion_exposure_pct >= 25 ? "Heavy" : "Smooth");
            return (
              <div
                key={route.route_id || idx}
                className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-colors ${
                  route.is_recommended
                    ? "bg-emerald-50/50 dark:bg-[#161920] border-emerald-400 dark:border-emerald-500/45 shadow-sm"
                    : "bg-slate-50/60 dark:bg-[#161920] border-slate-200 dark:border-white/[0.08]"
                }`}
                data-testid={route.is_recommended ? "fastest-route-card" : `alternative-route-card-${idx}`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    {route.is_recommended ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-600 text-white inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>{isHindi ? "सबसे तेज़ मार्ग" : "Fastest Route"}</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-slate-200/80 dark:bg-[#1B1D22] text-slate-700 dark:text-[#C5C8D0] border border-transparent dark:border-white/[0.08]">
                        {isHindi ? `वैकल्पिक ${idx}` : `Alternative ${idx}`}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getConditionPillClasses(
                        condition
                      )}`}
                    >
                      {condition}
                    </span>
                  </div>

                  <h3 className="font-serif text-sm sm:text-base font-medium text-slate-900 dark:text-white leading-snug">
                    {isHindi ? route.name_hi : route.name_en}
                  </h3>

                  <div className="flex items-baseline justify-between pt-1">
                    <div className="flex items-baseline gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA] self-center" />
                      <span className="font-serif text-2xl font-medium text-slate-900 dark:text-white tabular-nums">
                        {Math.max(1, Math.round(route.estimated_time_minutes))}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-[#8C93A4]">min</span>
                      {(route.delay_minutes ?? 0) > 0 && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 ml-1">
                          (+{route.delay_minutes}m delay)
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-500 dark:text-[#8C93A4]">
                      {route.distance_km} km
                    </span>
                  </div>

                  {(heavyRoads.length > 0 || route.recommendation_rationale) && (
                    <details className="group pt-1">
                      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer text-[11px] font-semibold text-blue-600 dark:text-[#9AC2FA] hover:underline flex items-center justify-between gap-2">
                        <span>
                          {heavyRoads.length > 0
                            ? isHindi
                              ? `व्यस्त सड़क विवरण (${heavyRoads.length})`
                              : `Route & bottleneck details (${heavyRoads.length})`
                            : isHindi
                            ? "मार्ग विवरण देखें"
                            : "View route details"}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-[#8C93A4] group-open:hidden">
                          {isHindi ? "खोलें" : "Show"}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-[#8C93A4] hidden group-open:inline">
                          {isHindi ? "छिपाएं" : "Hide"}
                        </span>
                      </summary>
                      <div className="mt-2 space-y-2">
                        {heavyRoads.length > 0 && (
                          <div className="p-2.5 rounded-xl bg-amber-50/90 dark:bg-[#111318] border border-amber-200 dark:border-amber-500/30 space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{isHindi ? "भारी ट्रैफिक वाली सड़कें" : "Traffic-Heavy Segments"}</span>
                            </span>
                            <ul className="text-[11px] text-amber-900 dark:text-[#C5C8D0] space-y-0.5">
                              {heavyRoads.map((seg, sIdx) => (
                                <li key={sIdx} className="truncate" title={seg}>
                                  • {seg}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {route.recommendation_rationale && (
                          <p className="text-[11px] text-slate-600 dark:text-[#C5C8D0] leading-relaxed">
                            {route.recommendation_rationale}
                          </p>
                        )}
                      </div>
                    </details>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.07] flex items-center justify-between text-[10px] text-slate-400 dark:text-[#8C93A4]">
                  <span>{route.is_live_data ? "Real-time API" : "Estimated / Model"}</span>
                  <span className="font-mono">{route.congestion_exposure_pct}% congested</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

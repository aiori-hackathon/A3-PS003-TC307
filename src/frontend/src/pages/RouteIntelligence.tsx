import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../services/api";
import { IntersectionDetail, RouteResponse, RouteOption } from "../types";
import {
  GitFork,
  Navigation,
  Clock,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

export const RouteIntelligence: React.FC = () => {
  const { t } = useTranslation();
  const { isHindi } = useLanguage();

  const [intersections, setIntersections] = useState<IntersectionDetail[]>([]);
  const [origin, setOrigin] = useState<string>("INT-01");
  const [destination, setDestination] = useState<string>("INT-07");
  const [avoidClosedRoads, setAvoidClosedRoads] = useState<boolean>(true);
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    api.getIntersections().then((data) => {
      setIntersections(data);
      if (data.length >= 2) {
        setOrigin(data[0].id);
        setDestination(data[data.length - 2].id);
      }
    });
  }, []);

  const handleCompareRoutes = async () => {
    if (!origin || !destination) return;
    setLoading(true);
    try {
      const res = await api.compareRoutes(origin, destination, avoidClosedRoads);
      setRouteData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (origin && destination) {
      handleCompareRoutes();
    }
  }, [origin, destination, avoidClosedRoads]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t("routes.title")}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t("routes.subtitle")}
        </p>
      </div>

      {/* Origin & Destination Selector Bar */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
          {/* Origin */}
          <div className="space-y-1 w-full sm:w-auto flex-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t("routes.origin")}:
            </label>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {intersections.map((i) => (
                <option key={i.id} value={i.id}>
                  {isHindi ? i.name_hi : i.name} ({i.id})
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:flex items-center text-slate-400 pt-5">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Destination */}
          <div className="space-y-1 w-full sm:w-auto flex-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t("routes.destination")}:
            </label>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {intersections.map((i) => (
                <option key={i.id} value={i.id}>
                  {isHindi ? i.name_hi : i.name} ({i.id})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Avoid Closed Roads Toggle & Action Button */}
        <div className="flex items-center gap-4 self-start sm:self-auto">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={avoidClosedRoads}
              onChange={(e) => setAvoidClosedRoads(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <span>{isHindi ? "बंद सड़कों से बचें" : "Avoid Closed Roads"}</span>
          </label>

          <button
            onClick={handleCompareRoutes}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-md transition-all shrink-0"
          >
            {loading ? "..." : t("routes.calc_btn")}
          </button>
        </div>
      </div>

      {/* Road Closure Notice Banner */}
      {routeData?.road_closure_active && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">{t("routes.closure_alert")}</span>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300">
              {isHindi
                ? `सक्रिय सड़क बंदी (${routeData.affected_intersection || "Arterial Corridor"}) के कारण एल्गोरिदम स्वचालित रूप से अप्रभावित वैकल्पिक गलियारों के माध्यम से रूट कर रहा है।`
                : `Active road closure detected at ${routeData.affected_intersection || "Arterial Corridor"}. Candidate routes pass around blocked segments.`}
            </p>
          </div>
        </div>
      )}

      {/* Route Options Grid */}
      <div className="space-y-4">
        {routeData?.routes.map((route: RouteOption) => (
          <div
            key={route.route_id}
            className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              route.is_recommended
                ? "border-2 border-emerald-500 shadow-md ring-2 ring-emerald-500/10"
                : "border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Navigation className={`w-4 h-4 ${route.is_recommended ? "text-emerald-500" : "text-slate-400"}`} />
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  {isHindi ? route.name_hi : route.name_en}
                </h3>
                {route.is_recommended && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase border border-emerald-500/20">
                    {t("routes.route_recommended")}
                  </span>
                )}
              </div>

              {/* Waypoints Path */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span className="font-medium text-slate-700 dark:text-slate-300">{isHindi ? "मार्ग पथ:" : "Path:"}</span>
                {route.intersections_path.map((node, i) => (
                  <React.Fragment key={i}>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-800 dark:text-slate-200 font-semibold">
                      {node}
                    </span>
                    {i < route.intersections_path.length - 1 && <span>→</span>}
                  </React.Fragment>
                ))}
              </div>

              {/* Recommendation Rationale */}
              {route.recommendation_rationale && (
                <p className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                  💡 {route.recommendation_rationale}
                </p>
              )}
            </div>

            {/* Metrics Chips */}
            <div className="flex items-center gap-4 text-xs shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-center min-w-[90px]">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Travel Time</span>
                <p className={`text-base font-bold mt-0.5 ${route.is_recommended ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>
                  {route.estimated_time_minutes} min
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-center min-w-[80px]">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Distance</span>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {route.distance_km} km
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-center min-w-[90px]">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Congestion</span>
                <p className={`text-base font-bold mt-0.5 ${route.congestion_exposure_pct > 40 ? "text-red-500" : "text-slate-700 dark:text-slate-300"}`}>
                  {route.congestion_exposure_pct}%
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Advisory Notice Banner */}
      <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
        <span>⚠️ {routeData?.advisory_notice || "Advisory demonstration routing. Modeled on simulated Delhi NCR corridors. Obey all municipal road signs and traffic authorities."}</span>
        <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0 ml-2">Software Simulation</span>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../services/api";
import { IntersectionDetail, PredictionResponse, ProviderStatusDTO } from "../types";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import {
  MapPin,
  Filter,
  Activity,
  Gauge,
  AlertTriangle,
  Cpu,
  TrendingUp,
  Shield,
  Layers,
  ChevronRight,
  Info,
  Search,
  RefreshCw,
  Clock,
} from "lucide-react";

// Predefined arterial corridor links in Delhi NCR demo network
const ARTERIAL_EDGES = [
  ["INT-01", "INT-02"],
  ["INT-01", "INT-03"],
  ["INT-02", "INT-03"],
  ["INT-01", "INT-04"],
  ["INT-02", "INT-04"],
  ["INT-04", "INT-05"],
  ["INT-05", "INT-06"],
  ["INT-03", "INT-06"],
  ["INT-06", "INT-07"],
  ["INT-05", "INT-07"],
  ["INT-07", "INT-08"],
  ["INT-04", "INT-08"],
];

// Create custom SVG markers for Leaflet based on congestion status
const createCustomIcon = (congestion: string) => {
  let color = "#10B981"; // green
  if (congestion === "moderate") color = "#F59E0B"; // yellow
  if (congestion === "severe") color = "#EF4444"; // red

  const svgHtml = `
    <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background-color: ${color}; opacity: 0.3; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="width: 22px; height: 22px; border-radius: 50%; background-color: ${color}; border: 2.5px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
        <div style="width: 6px; height: 6px; border-radius: 50%; background-color: white;"></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: "custom-traffic-pin",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

export const LiveTrafficMap: React.FC = () => {
  const { t } = useTranslation();
  const { isHindi } = useLanguage();

  const [intersections, setIntersections] = useState<IntersectionDetail[]>([]);
  const [selectedIntersection, setSelectedIntersection] = useState<IntersectionDetail | null>(null);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [loadingPred, setLoadingPred] = useState<boolean>(false);
  const [providerStatus, setProviderStatus] = useState<ProviderStatusDTO | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [congestionFilter, setCongestionFilter] = useState<string>("all");

  const loadData = async (showLoading = false) => {
    try {
      if (showLoading) setRefreshing(true);
      const [status, data] = await Promise.all([
        api.getProviderStatus(),
        api.getIntersections(),
      ]);
      setProviderStatus(status);
      setIntersections(data);
      setLastRefreshedAt(new Date());
      setSelectedIntersection((prev) => {
        if (!prev && data.length > 0) return data[0];
        if (prev) {
          const updated = data.find((i) => i.id === prev.id);
          return updated || prev;
        }
        return null;
      });
    } catch (err) {
      console.error("Failed to load live traffic data:", err);
    } finally {
      if (showLoading) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // Refresh traffic data periodically every 30 seconds
    const interval = setInterval(() => {
      loadData(false);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedIntersection) {
      setLoadingPred(true);
      api
        .runPrediction(selectedIntersection.id, 30)
        .then((pred) => setPrediction(pred))
        .catch(console.error)
        .finally(() => setLoadingPred(false));
    }
  }, [selectedIntersection]);

  const filteredIntersections = intersections.filter((item) => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        item.name.toLowerCase().includes(q) ||
        item.name_hi.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.zone.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (zoneFilter !== "all" && item.zone !== zoneFilter) return false;
    if (congestionFilter !== "all" && item.congestion_level !== congestionFilter) return false;
    return true;
  });

  const interMap = new Map(intersections.map((i) => [i.id, i]));

  return (
    <div className="space-y-6">
      {/* Provider Fallback Notice */}
      {providerStatus?.error_fallback_active && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold">Provider Fallback Active: </span>
            <span>{providerStatus.message} (Serving cached or simulated observations)</span>
          </div>
        </div>
      )}

      {/* Title & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t("map.title")}
            </h1>
            {providerStatus?.mode === "live" ? (
              providerStatus.error_fallback_active ? (
                <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  TomTom Fallback
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  TomTom Live Feed
                </span>
              )
            ) : (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Delhi NCR Simulation
              </span>
            )}
            {providerStatus?.last_sync_time && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-normal ml-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{new Date(providerStatus.last_sync_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("map.subtitle")}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={isHindi ? "जंक्शन खोजें..." : "Search junction..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none font-medium w-32 sm:w-40"
            />
          </div>

          {/* Zone Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none font-medium"
            >
              <option value="all">{isHindi ? "सभी क्षेत्र (All Zones)" : "All Zones"}</option>
              <option value="CBD">CBD</option>
              <option value="Arterial">Arterial</option>
              <option value="Tech Corridor">Tech Corridor</option>
            </select>
          </div>

          {/* Congestion Level Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <select
              value={congestionFilter}
              onChange={(e) => setCongestionFilter(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none font-medium"
            >
              <option value="all">{isHindi ? "सभी स्तर (All Severities)" : "All Severities"}</option>
              <option value="low">{t("common.low")}</option>
              <option value="moderate">{t("common.moderate")}</option>
              <option value="severe">{t("common.severe")}</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm text-xs font-medium transition-all"
            title="Refresh traffic observations now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-500" : ""}`} />
            <span className="hidden sm:inline">{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Map + Detail Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaflet Map (2 Columns on large desktop) */}
        <div className="lg:col-span-2 flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-[460px] sm:h-[540px] relative">
          <MapContainer
            center={[28.58, 77.18]}
            zoom={11}
            scrollWheelZoom={true}
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Arterial Corridor Road Segments */}
            {ARTERIAL_EDGES.map(([uId, vId], idx) => {
              const uNode = interMap.get(uId);
              const vNode = interMap.get(vId);
              if (!uNode || !vNode) return null;
              const avgSpd = (uNode.current_speed + vNode.current_speed) / 2;
              const color = avgSpd >= 40 ? "#10B981" : avgSpd >= 25 ? "#F59E0B" : "#EF4444";
              return (
                <Polyline
                  key={`edge-${idx}`}
                  positions={[
                    [uNode.latitude, uNode.longitude],
                    [vNode.latitude, vNode.longitude],
                  ]}
                  pathOptions={{
                    color,
                    weight: 4.5,
                    opacity: 0.75,
                    dashArray: avgSpd < 20 ? "8, 6" : undefined,
                  }}
                />
              );
            })}
            {filteredIntersections.map((inter) => (
              <Marker
                key={inter.id}
                position={[inter.latitude, inter.longitude]}
                icon={createCustomIcon(inter.congestion_level)}
                eventHandlers={{
                  click: () => setSelectedIntersection(inter),
                }}
              >
                <Popup>
                  <div className="p-1 text-slate-900 text-xs font-sans">
                    <p className="font-bold text-sm mb-1">{isHindi ? inter.name_hi : inter.name}</p>
                    <p>
                      {isHindi ? "वॉल्यूम: " : "Volume: "}
                      <b>{inter.current_volume} veh/15m</b>
                    </p>
                    <p>
                      {isHindi ? "औसत गति: " : "Speed: "}
                      <b>{inter.current_speed} km/h</b>
                    </p>
                    <p>
                      {isHindi ? "जोखिम स्कोर: " : "Risk Score: "}
                      <b className={inter.risk_score > 60 ? "text-red-600" : "text-emerald-600"}>
                        {inter.risk_score} / 100
                      </b>
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Map Legend Overlay */}
          <div className="absolute bottom-4 left-4 z-[400] p-3 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-md text-xs space-y-1.5">
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider mb-1">
              {t("map.legend_title")}
            </p>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-600 dark:text-slate-300">{t("map.legend_green")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
              <span className="text-slate-600 dark:text-slate-300">{t("map.legend_yellow")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
              <span className="text-slate-600 dark:text-slate-300">{t("map.legend_red")}</span>
            </div>
          </div>
        </div>

        {/* Selected Intersection Detail Panel (1 Column) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t("map.panel_title")}
                </h3>
              </div>
              {selectedIntersection && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                    selectedIntersection.congestion_level === "severe"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                      : selectedIntersection.congestion_level === "moderate"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  }`}
                >
                  {t(`common.${selectedIntersection.congestion_level}`)}
                </span>
              )}
            </div>

            {selectedIntersection ? (
              <div className="mt-4 space-y-4">
                {/* Intersection Name & Provenance */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                      {isHindi ? selectedIntersection.name_hi : selectedIntersection.name}
                    </h4>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold whitespace-nowrap ${
                        selectedIntersection.source === "live_provider"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                          : selectedIntersection.source === "cached"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800"
                      }`}
                    >
                      {selectedIntersection.source === "live_provider"
                        ? "TomTom Live Feed"
                        : selectedIntersection.source === "cached"
                        ? "Cached Provider Snapshot"
                        : "Corridor Benchmark"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ID: {selectedIntersection.id} • Zone: {selectedIntersection.zone}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Source: <strong className="text-slate-700 dark:text-slate-200 capitalize">{(selectedIntersection.source || "simulated").replace('_', ' ')}</strong></span>
                    <span>•</span>
                    <span>Updated: <strong className="text-slate-700 dark:text-slate-200">{selectedIntersection.last_updated ? new Date(selectedIntersection.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (selectedIntersection.data_freshness || "Current")}</strong></span>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                    <span className="text-slate-500 text-[11px]">{t("map.current_vol")}</span>
                    <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                      {selectedIntersection.current_volume} {t("common.vph")}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                    <span className="text-slate-500 text-[11px]">{t("map.current_spd")}</span>
                    <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                      {selectedIntersection.current_speed} {t("common.kmh")}
                    </p>
                  </div>
                </div>

                {/* Congestion Risk Gauge */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">{t("map.risk_score")}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedIntersection.risk_score} / 100
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        selectedIntersection.risk_score > 60
                          ? "bg-red-500"
                          : selectedIntersection.risk_score > 35
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${selectedIntersection.risk_score}%` }}
                    />
                  </div>
                </div>

                {/* 30m AI Forecast */}
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60">
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-300">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{t("map.forecast_30m")}</span>
                    </div>
                    {prediction && (
                      <span
                        className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                          prediction.model_readiness === "ready"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"
                        }`}
                      >
                        {prediction.model_readiness || "ready"}
                      </span>
                    )}
                  </div>

                  {loadingPred ? (
                    <p className="text-xs font-medium text-slate-500 mt-2">Calculating 30m forecast...</p>
                  ) : prediction?.model_readiness === "ready" ? (
                    <>
                      <p className="text-xl font-bold text-blue-950 dark:text-blue-100 mt-1">
                        {prediction.predicted_volume} {t("common.vph")}
                      </p>
                      <p className="text-[11px] text-blue-600 dark:text-blue-300 mt-0.5">
                        {isHindi ? "अनुमानित गति: " : "Expected speed: "}
                        <b>{prediction.predicted_speed} km/h</b>
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 pt-1 border-t border-blue-200/50 dark:border-blue-900/50">
                        <span>Model: {prediction.model_type}</span>
                        <span>MAE: {prediction.test_mae}</span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                      <p className="font-semibold">Model Status: {prediction?.model_readiness || "Calibrating"}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Predictions will activate once historical training completes.
                      </p>
                    </div>
                  )}
                </div>

                {/* Local Edge Node Info */}
                <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-purple-500" />
                    <span className="text-slate-600 dark:text-slate-300">
                      {t("map.edge_client")}
                    </span>
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">
                    {selectedIntersection.edge_client_id}
                  </span>
                </div>

                {/* Recommended Control Action */}
                <div className="text-xs space-y-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {t("map.recommended_action")}:
                  </span>
                  <p className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                    {selectedIntersection.congestion_level === "severe"
                      ? isHindi
                        ? "धौला कुआँ दिशा में ग्रीन सिग्नल समय 20 सेकंड बढ़ाएं और इनर रिंग पर डायवर्जन नोटिस दें।"
                        : "Extend green signal interval by 20s and display variable message detour warning on Inner Ring."
                      : selectedIntersection.congestion_level === "moderate"
                      ? isHindi
                        ? "पेरिफेरल जंक्शनों पर सिग्नल साइकिल को 90 सेकंड पर संतुलित रखें।"
                        : "Maintain coordinated 90s signal cycle timing across peripheral approaches."
                      : isHindi
                        ? "ट्रैफिक प्रवाह सामान्य है। किसी आपातकालीन हस्तक्षेप की आवश्यकता नहीं।"
                        : "Traffic flow normal. Standard timing cycle operating without intervention."}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-6">{t("map.no_selection")}</p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>
              {selectedIntersection?.is_simulated
                ? t("common.simulated_notice")
                : "Real-world traffic observations sourced from TomTom Traffic Flow API."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

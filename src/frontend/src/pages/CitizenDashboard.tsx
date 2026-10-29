import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import {
  IntersectionDetail,
  IncidentItem,
  PredictionResponse,
  ProviderStatusDTO,
  CorridorDetail,
} from "../types";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
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
  ShieldCheck,
  Sparkles,
  Info,
  Calendar,
  AlertCircle,
} from "lucide-react";

// Predefined arterial links for Leaflet display
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

// Helper: Custom map icon for citizens
const createCitizenIcon = (congestion: string) => {
  let color = "#10B981"; // green
  if (congestion === "moderate") color = "#F59E0B"; // amber
  if (congestion === "severe") color = "#EF4444"; // red

  const html = `
    <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 30px; height: 30px; border-radius: 50%; background-color: ${color}; opacity: 0.35; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="width: 20px; height: 20px; border-radius: 50%; background-color: ${color}; border: 2px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
        <div style="width: 6px; height: 6px; border-radius: 50%; background-color: white;"></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "citizen-map-pin",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

export const CitizenDashboard: React.FC = () => {
  const { isHindi } = useLanguage();
  const { user } = useAuth();

  const [intersections, setIntersections] = useState<IntersectionDetail[]>([]);
  const [selectedId, setSelectedId] = useState<string>("INT-01");
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [corridors, setCorridors] = useState<CorridorDetail[]>([]);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatusDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const loadData = async (showLoading = false) => {
    try {
      if (showLoading) setRefreshing(true);
      const [interList, incList, status, corrList] = await Promise.all([
        api.getIntersections(),
        api.getIncidents(undefined, "open", false),
        api.getProviderStatus(),
        api.getCorridors(),
      ]);

      setIntersections(interList);
      setIncidents(incList);
      setProviderStatus(status);
      setCorridors(corrList);
      setLastRefreshedAt(new Date());

      if (interList.length > 0 && !interList.find((i) => i.id === selectedId)) {
        setSelectedId(interList[0].id);
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
    // 30s auto-refresh
    const interval = setInterval(() => loadData(false), 30000);
    return () => clearInterval(interval);
  }, []);

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

  // Simplified Traffic Condition label
  const getSimpleTrafficStatus = (item?: IntersectionDetail) => {
    if (!item) return { label: "Checking...", color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800", border: "border-slate-300" };
    if (item.congestion_level === "severe" || item.current_speed < 20) {
      return {
        label: isHindi ? "भारी ट्रैफिक — धीमी गति" : "Heavy Traffic — Slow Moving",
        advice: isHindi ? "मार्ग में 10-15 मिनट की देरी संभावित है। यदि संभव हो तो वैकल्पिक मार्ग या दिल्ली मेट्रो का उपयोग करें।" : "Expect 10-15 min delays. Consider alternative arterial routes or Delhi Metro.",
        color: "text-red-700 dark:text-red-300",
        bg: "bg-red-50 dark:bg-red-950/40",
        border: "border-red-300 dark:border-red-800",
        dot: "bg-red-500",
      };
    }
    if (item.congestion_level === "moderate" || item.current_speed < 32) {
      return {
        label: isHindi ? "मध्यम ट्रैफिक — सामान्य गति" : "Moderate Traffic — Moving Steadily",
        advice: isHindi ? "यातायात सुचारू रूप से चल रहा है। पीक ऑवर्स के दौरान 5 मिनट का अतिरिक्त समय रखें।" : "Traffic moving steadily. Allow an extra 5 minutes during peak transit hours.",
        color: "text-amber-700 dark:text-amber-300",
        bg: "bg-amber-50 dark:bg-amber-950/40",
        border: "border-amber-300 dark:border-amber-800",
        dot: "bg-amber-500",
      };
    }
    return {
      label: isHindi ? "खुला रास्ता — सुगम आवागमन" : "Free Flow — Clear Roads",
      advice: isHindi ? "सड़कें पूरी तरह खुली हैं। यात्रा के लिए यह सबसे उपयुक्त समय है।" : "Roads are clear. Optimal conditions for your commute.",
      color: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-300 dark:border-emerald-800",
      dot: "bg-emerald-500",
    };
  };

  const statusInfo = getSimpleTrafficStatus(selectedIntersection);
  const isSimulatedTraffic =
    providerStatus?.mode !== "live" ||
    Boolean(providerStatus?.error_fallback_active) ||
    Boolean(selectedIntersection?.is_simulated);

  // Clean user display name so unwanted "Demo" label or badge is not rendered
  const citizenDisplayName = user?.full_name
    ? user.full_name.replace(/\s*\((?:Demo|डेमो)\)/gi, "").replace(/\bDemo\b/gi, "").trim()
    : "";

  return (
    <div className="space-y-6">
      {/* Citizen Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 pointer-events-none transform skew-x-12" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-white/20 text-white backdrop-blur-sm">
                {isHindi ? "नागरिक आवागमन पोर्टल" : "Citizen Commute Portal"}
              </span>
              <span className="text-blue-100 text-xs">• Delhi NCR Transit Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1.5">
              {isHindi
                ? `नमस्ते, ${citizenDisplayName || "दिल्ली यात्री"}`
                : `Welcome, ${citizenDisplayName || "Delhi Commuter"}`}
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-xl">
              {isHindi
                ? "आज के सुरक्षित और आसान सफर के लिए वास्तविक समय का दिल्ली एनसीआर ट्रैफिक विवरण।"
                : "Real-time Delhi NCR traffic conditions, live speeds, corridor travel times, and simple commute forecasts."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white text-blue-700 hover:bg-blue-50 shadow transition-all active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
              <span>{refreshing ? "Updating..." : "Refresh Traffic"}</span>
            </button>
            <Link
              to="/routes"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-800/60 hover:bg-blue-800/80 text-white border border-white/20 shadow transition-all"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{isHindi ? "मार्ग योजना" : "Plan Route"}</span>
            </Link>
          </div>
        </div>

        {/* Provenance Strip */}
        <div className="mt-4 pt-3 border-t border-white/20 flex flex-wrap items-center justify-between text-xs text-blue-100 gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                !isSimulatedTraffic && providerStatus?.is_online
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-amber-400"
              }`}
            />
            <span className="font-semibold">
              {!isSimulatedTraffic && providerStatus?.is_online
                ? "Live TomTom Traffic Feed Active (Delhi NCR)"
                : "Live traffic unavailable — showing simulated data"}
            </span>
            <span
              className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                !isSimulatedTraffic && providerStatus?.is_online
                  ? "bg-emerald-500/30 text-emerald-100 border border-emerald-400/30"
                  : "bg-amber-500/30 text-amber-100 border border-amber-400/30"
              }`}
            >
              {!isSimulatedTraffic && providerStatus?.is_online ? "Verified Live Flow" : "Simulated Model"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-blue-200">
            <Clock className="w-3 h-3" />
            <span>
              Last updated: {lastRefreshedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>
      </div>

      {/* Honest Warning Banner when simulated fallback is active */}
      {isSimulatedTraffic && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-sm text-amber-800 dark:text-amber-200">
              {isHindi
                ? "लाइव ट्रैफिक अनुपलब्ध — सिम्युलेटेड डेटा प्रदर्शित किया जा रहा है"
                : "Live traffic unavailable — showing simulated data"}
            </p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300">
              {providerStatus?.message || "Using calibrated Delhi NCR traffic model. Measurements reflect synthetic baseline estimates."}
            </p>
          </div>
        </div>
      )}

      {/* Location Selector Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {isHindi ? "अपना क्षेत्र चुनें:" : "Select your area or junction:"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {intersections.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                selectedId === item.id
                  ? "bg-blue-600 text-white shadow-sm font-semibold"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {isHindi ? item.name_hi : item.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Status Card + Interactive Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selected Area Traffic Card (1 Col) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {isHindi ? "वर्तमान स्थिति" : "Current Condition"}
              </span>
              <span className="text-[10px] text-slate-400">
                Zone: {selectedIntersection?.zone || "Central"}
              </span>
            </div>

            <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              {isHindi ? selectedIntersection?.name_hi : selectedIntersection?.name}
            </h2>

            {/* Condition Banner */}
            <div className={`mt-3 p-3.5 rounded-xl border ${statusInfo.bg} ${statusInfo.border} space-y-1.5`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${statusInfo.dot} shrink-0`} />
                <span className={`font-bold text-sm ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {statusInfo.advice}
              </p>
            </div>

            {/* Key Metrics for Commuters */}
            <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500 text-[11px] flex items-center gap-1">
                  <Car className="w-3.5 h-3.5 text-blue-500" />
                  {isHindi ? "वर्तमान गति" : "Current Speed"}
                </span>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {selectedIntersection?.current_speed !== undefined ? `${selectedIntersection.current_speed} ` : "— "}
                  <span className="text-xs font-normal text-slate-500">km/h</span>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500 text-[11px] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  {isHindi ? "सामान्य गति" : "Normal Speed"}
                </span>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {selectedIntersection?.baseline_speed !== undefined ? `${selectedIntersection.baseline_speed} ` : "— "}
                  <span className="text-xs font-normal text-slate-500">km/h</span>
                </p>
              </div>
            </div>

            {/* Simple 30-Minute Commute Forecast */}
            <div className="mt-4 p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isHindi ? "30 मिनट का AI पूर्वानुमान" : "30-Min AI Forecast"}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold uppercase tracking-wider">
                  Forecast
                </span>
              </div>
              <p className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5 italic">
                {isHindi
                  ? "ट्रैफिक ट्रेंड पर आधारित सांख्यिकीय पूर्वानुमान (वर्तमान प्रेक्षण नहीं)"
                  : "Predictive model estimate based on live observation trend (not current measurement)"}
              </p>
              <p className="text-xs text-indigo-900 dark:text-indigo-200 mt-2 font-medium">
                {prediction?.expected_congestion_onset || (isHindi ? "सामान्य प्रवाह अपेक्षित है।" : "Normal traffic flow expected over the next half hour.")}
              </p>
              {prediction?.predicted_speed !== undefined && (
                <div className="flex items-center justify-between text-[11px] text-indigo-700 dark:text-indigo-300 mt-2 pt-2 border-t border-indigo-200/60 dark:border-indigo-900/40">
                  <span>
                    {isHindi ? "अनुमानित गति: " : "Forecasted speed: "}
                    <b>~{prediction.predicted_speed} km/h</b>
                  </span>
                  <span>
                    {isHindi ? "अपेक्षित स्थिति: " : "Expected: "}
                    <b className="capitalize">{prediction.predicted_congestion_level}</b>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span>Source:</span>
              <span
                className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                  selectedIntersection?.is_simulated
                    ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                    : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {selectedIntersection?.is_simulated ? "Simulated Baseline" : "TomTom Live Flow API"}
              </span>
            </div>
            <Link
              to="/map"
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-0.5"
            >
              <span>Full Map</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Live Delhi NCR Commuter Map (2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-[420px] sm:h-[480px] relative">
          <MapContainer
            center={[28.60, 77.20]}
            zoom={11}
            scrollWheelZoom={true}
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Corridor road lines */}
            {ARTERIAL_EDGES.map(([uId, vId], idx) => {
              const uNode = interMap.get(uId);
              const vNode = interMap.get(vId);
              if (!uNode || !vNode) return null;
              const avgSpd = (uNode.current_speed + vNode.current_speed) / 2;
              const color = avgSpd >= 35 ? "#10B981" : avgSpd >= 22 ? "#F59E0B" : "#EF4444";
              return (
                <Polyline
                  key={`edge-${idx}`}
                  positions={[
                    [uNode.latitude, uNode.longitude],
                    [vNode.latitude, vNode.longitude],
                  ]}
                  pathOptions={{ color, weight: 4, opacity: 0.7 }}
                />
              );
            })}

            {/* Junction markers */}
            {intersections.map((inter) => (
              <Marker
                key={inter.id}
                position={[inter.latitude, inter.longitude]}
                icon={createCitizenIcon(inter.congestion_level)}
                eventHandlers={{
                  click: () => setSelectedId(inter.id),
                }}
              >
                <Popup>
                  <div className="text-xs p-1 text-slate-800 font-sans">
                    <p className="font-bold text-sm mb-1">{isHindi ? inter.name_hi : inter.name}</p>
                    <p>
                      Traffic:{" "}
                      <b>
                        {inter.congestion_level === "severe"
                          ? "Heavy Traffic"
                          : inter.congestion_level === "moderate"
                          ? "Moderate Traffic"
                          : "Free Flow"}
                      </b>
                    </p>
                    <p>Speed: <b>{inter.current_speed} km/h</b></p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Simple Legend Overlay */}
          <div className="absolute bottom-3 left-3 z-[400] p-2.5 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow text-[11px] space-y-1">
            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">Traffic Legend</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Free Flow (&gt; 35 km/h)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Moderate (22 - 35 km/h)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>Heavy (&lt; 22 km/h)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Live Corridor Travel Times + Important Travel Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estimated Travel Times Across Major Corridors */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-blue-600" />
              <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {isHindi ? "प्रमुख गलियारों में यात्रा समय" : "Key Corridor Travel Times"}
              </h2>
            </div>
            <span className="text-[11px] text-slate-400">
              {isSimulatedTraffic ? "Model estimates" : "Based on live TomTom speeds"}
            </span>
          </div>

          <div className="space-y-2.5">
            {corridors.length > 0 ? (
              corridors.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {isHindi ? c.name_hi : c.name}
                      </h3>
                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                          c.is_simulated
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                            : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {c.is_simulated ? "Simulated" : "Live"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isHindi && c.description_hi ? c.description_hi : c.description} • {c.distance_km} km • Avg Spd: {c.average_speed} km/h
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                      {c.travel_time_minutes} <span className="text-xs font-normal text-slate-500">min</span>
                    </span>
                    <span
                      className={`block text-[10px] font-bold uppercase ${
                        c.congestion_level === "heavy"
                          ? "text-red-600"
                          : c.congestion_level === "moderate"
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {isHindi ? c.condition_label_hi : c.condition_label}
                    </span>
                    {c.delay_minutes > 0 && (
                      <span className="block text-[10px] text-red-500 font-medium">
                        +{c.delay_minutes} min delay
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">
                Loading corridor travel time estimates...
              </div>
            )}
          </div>

          <div className="pt-2">
            <Link
              to="/routes"
              className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center justify-center gap-1 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40"
            >
              <span>Calculate custom point-to-point route travel times</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Travel Alerts & Traffic Warnings */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {isHindi ? "सड़क अलर्ट एवं सूचनाएं" : "Live Travel Alerts & Road Warnings"}
              </h2>
            </div>
            <span className="text-[11px] text-slate-400">
              {incidents.length} Active Notice{incidents.length !== 1 ? "s" : ""}
            </span>
          </div>

          {incidents.length > 0 ? (
            <div className="space-y-2.5">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className={`p-3 rounded-xl border flex items-start gap-3 ${
                    inc.severity === "critical"
                      ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-900 dark:text-red-200"
                      : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200"
                  }`}
                >
                  <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${inc.severity === "critical" ? "text-red-600" : "text-amber-600"}`} />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">
                        {isHindi ? inc.intersection_name_hi : inc.intersection_name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {inc.is_simulated && (
                          <span className="text-[9px] uppercase font-bold px-1 rounded bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                            Drill
                          </span>
                        )}
                        <span className="text-[10px] uppercase font-bold tracking-wider">
                          {inc.incident_type}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed">
                      {isHindi ? inc.description_hi : inc.description_en}
                    </p>
                    <p className="mt-1 font-semibold text-[10px] opacity-90">
                      Advisory: {isHindi ? inc.recommended_action_hi : inc.recommended_action_en}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <h3 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
                {isHindi ? "कोई बड़ी रुकावट नहीं" : "No Road Closures or Severe Delays"}
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 max-w-sm mx-auto">
                {isHindi
                  ? "सभी मुख्य दिल्ली एनसीआर गलियारे सामान्य रूप से संचालित हो रहे हैं।"
                  : "All monitored Delhi NCR arterial junctions are operating with normal flow."}
              </p>
            </div>
          )}

          {/* Quick Helpful Links for Commuters */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
            <Link
              to="/assistant"
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-purple-500" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">AI Commute Helper</span>
                <span className="text-[10px] text-slate-400">Ask traffic questions</span>
              </div>
            </Link>

            <Link
              to="/privacy"
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Citizen Privacy</span>
                <span className="text-[10px] text-slate-400">Data protection rights</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

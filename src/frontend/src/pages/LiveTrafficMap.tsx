import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../services/api";
import { IntersectionDetail, IncidentItem, ProviderStatusDTO, VoiceTrafficContext } from "../types";
import { useVoiceAdvisory } from "../hooks/useVoiceAdvisory";
import { VoiceAdvisoryControl } from "../components/voice/VoiceAdvisoryControl";
import { DriverHud, UserLocationState } from "../components/hud/DriverHud";
import {
  detectPreciseUserLocation,
  formatCityDistrictState,
  GeolocationErrorInfo,
} from "../utils/geolocation";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import {
  Compass,
  MapPin,
  RefreshCw,
  Clock,
  Car,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Navigation,
  Search,
  Filter,
  ShieldCheck,
  Radio,
  Layers,
  ChevronRight,
  Info,
  Maximize2,
  Crosshair,
} from "lucide-react";

// Delhi NCR Arterial network links for visualization when viewing Delhi corridor
const DELHI_ARTERIAL_EDGES = [
  ["INT-01", "INT-02"],
  ["INT-01", "INT-03"],
  ["INT-02", "INT-04"],
  ["INT-03", "INT-04"],
  ["INT-04", "INT-05"],
  ["INT-05", "INT-06"],
  ["INT-06", "INT-07"],
  ["INT-07", "INT-08"],
  ["INT-04", "INT-08"],
];

// Pulsating GPS User Location Icon
const createUserLocationIcon = () => {
  const html = `
    <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background-color: rgba(37, 99, 235, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="width: 20px; height: 20px; border-radius: 50%; background-color: #2563eb; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
        <div style="width: 6px; height: 6px; border-radius: 50%; background-color: #ffffff;"></div>
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: "gps-user-marker",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// Monitored Junction Marker
const createJunctionIcon = (congestion: string) => {
  let color = "#10b981";
  if (congestion === "moderate") color = "#f59e0b";
  if (congestion === "severe") color = "#ef4444";

  const html = `
    <div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="background-color: white; width: 6px; height: 6px; border-radius: 50%;"></div>
    </div>
  `;
  return L.divIcon({
    html,
    className: "junction-marker",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Leaflet Map Controller to fly to coordinates smoothly
const MapFlyToController: React.FC<{
  targetCoords?: [number, number] | null;
  zoom?: number;
}> = ({ targetCoords, zoom = 15 }) => {
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

interface CoordinateTrafficState {
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
  fetchedAt?: Date;
}

export const LiveTrafficMap: React.FC = () => {
  const { t } = useTranslation();
  const { isHindi } = useLanguage();

  // Network data
  const [intersections, setIntersections] = useState<IntersectionDetail[]>([]);
  const [selectedIntersection, setSelectedIntersection] = useState<IntersectionDetail | null>(null);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [providerStatus, setProviderStatus] = useState<ProviderStatusDTO | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // GPS & Live Location detection state
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocationState | null>(null);
  const [coordTraffic, setCoordTraffic] = useState<CoordinateTrafficState | null>(null);
  const [loadingTraffic, setLoadingTraffic] = useState<boolean>(false);
  const detectSeqRef = useRef<number>(0);

  // Driver HUD / Commute Mode state
  const [isHudOpen, setIsHudOpen] = useState<boolean>(false);

  // Map viewport target
  const [mapTarget, setMapTarget] = useState<[number, number] | null>([28.6139, 77.209]); // Default Delhi center
  const [mapZoom, setMapZoom] = useState<number>(12);

  // Filter & Mode toggle
  const [showDelhiNetwork, setShowDelhiNetwork] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"location_telemetry" | "network_overview">("location_telemetry");

  // Voice advisory context derivation
  const voiceContext = React.useMemo<VoiceTrafficContext | null>(() => {
    if (userLocation) {
      return {
        roadName: userLocation.roadName,
        city: userLocation.city,
        currentSpeed: coordTraffic?.current_speed,
        freeFlowSpeed: coordTraffic?.free_flow_speed,
        congestionLevel: (coordTraffic?.congestion_level as "low" | "moderate" | "severe") || undefined,
        roadClosure: coordTraffic?.road_closure ?? false,
        trafficAvailable: coordTraffic?.traffic_available ?? false,
        isLoading: loadingTraffic,
        reason: coordTraffic?.reason,
      };
    }
    if (selectedIntersection) {
      return {
        roadName: selectedIntersection.name,
        city: "Delhi NCR",
        currentSpeed: selectedIntersection.current_speed,
        freeFlowSpeed: selectedIntersection.current_speed + 15,
        congestionLevel: (selectedIntersection.congestion_level as "low" | "moderate" | "severe") || undefined,
        roadClosure: false,
        trafficAvailable: true,
      };
    }
    return null;
  }, [userLocation, coordTraffic, selectedIntersection, loadingTraffic]);

  const userLocationRef = useRef<UserLocationState | null>(null);
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  const voiceAdvisory = useVoiceAdvisory(voiceContext);

  // Load backend baseline data
  const loadNetworkData = async (showLoading = false) => {
    try {
      if (showLoading) setRefreshing(true);
      const [statusRes, interListRes, incListRes] = await Promise.allSettled([
        api.getProviderStatus(),
        api.getIntersections(),
        api.getIncidents(undefined, "open", false),
      ]);

      if (statusRes.status === "fulfilled") setProviderStatus(statusRes.value);
      if (interListRes.status === "fulfilled") setIntersections(interListRes.value);
      if (incListRes.status === "fulfilled") setIncidents(incListRes.value);

      // Refresh current GPS coordinate traffic flow if user location is active
      if (userLocationRef.current) {
        api.getLiveTrafficByCoordinates(userLocationRef.current.lat, userLocationRef.current.lng)
          .then((data) => {
            setCoordTraffic({
              ...data,
              fetchedAt: new Date(),
            });
          })
          .catch((err) => {
            console.warn("Background coordinate traffic refresh error:", err);
          });
      }

      setLastRefreshedAt(new Date());
    } catch (err) {
      console.warn("Live traffic map data fetch error:", err);
    } finally {
      if (showLoading) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNetworkData();
    const interval = setInterval(() => loadNetworkData(false), 30000);
    return () => clearInterval(interval);
  }, []);

  // DETECT MY LOCATION IMPLEMENTATION (strict high-accuracy GPS, zero silent IP overrides)
  const handleDetectLocation = async () => {
    const seq = ++detectSeqRef.current;
    setDetectingLocation(true);
    setLocationError(null);

    try {
      const detected = await detectPreciseUserLocation({
        intersections,
        timeoutMs: 15000,
        onInitialGpsLock: (initial) => {
          if (seq !== detectSeqRef.current) return;

          setMapTarget([initial.lat, initial.lng]);
          setMapZoom(15);

          if (!initial.isDelhi) {
            setSelectedIntersection(null);
            setShowDelhiNetwork(false);
          }

          setDetectingLocation(false);
          setLoadingTraffic(true);

          setUserLocation({
            lat: initial.lat,
            lng: initial.lng,
            accuracy: initial.accuracy,
            roadName: initial.roadName,
            area: initial.area,
            city: initial.city,
            district: initial.district,
            state: initial.state,
            fullAddress: initial.fullAddress,
            isDelhi: initial.isDelhi,
            gpsSpeed: initial.gpsSpeedKmh,
            sourceLabel: initial.sourceLabel,
            geocodeSource: initial.geocodeSource,
            detectedAt: initial.timestamp,
            accuracyWarning: initial.accuracyAssessment.warning,
            isApproximate: initial.accuracyAssessment.isApproximate,
          });
        },
      });

      if (seq !== detectSeqRef.current) return;

      setUserLocation({
        lat: detected.lat,
        lng: detected.lng,
        accuracy: detected.accuracy,
        roadName: detected.roadName,
        area: detected.area,
        city: detected.city,
        district: detected.district,
        state: detected.state,
        fullAddress: detected.fullAddress,
        isDelhi: detected.isDelhi,
        gpsSpeed: detected.gpsSpeedKmh,
        sourceLabel: detected.sourceLabel,
        geocodeSource: detected.geocodeSource,
        detectedAt: detected.timestamp,
        accuracyWarning: detected.accuracyAssessment.warning,
        isApproximate: detected.accuracyAssessment.isApproximate,
      });

      if (detected.traffic) {
        setCoordTraffic({
          ...detected.traffic,
          fetchedAt: detected.traffic.fetchedAt || new Date(),
        });
      }
      setLoadingTraffic(false);
      setDetectingLocation(false);
    } catch (err) {
      if (seq !== detectSeqRef.current) return;
      const geoErr = err as GeolocationErrorInfo;
      setDetectingLocation(false);
      setLoadingTraffic(false);
      setLocationError(isHindi ? geoErr.messageHi : geoErr.message);
    }
  };

  const interMap = new Map(intersections.map((i) => [i.id, i]));

  // Determine Data Source Provenance state
  const getProvenanceState = () => {
    if (!coordTraffic) {
      return {
        badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
        label: "Awaiting GPS Detection",
        type: "INITIAL",
      };
    }
    if (coordTraffic.traffic_available && coordTraffic.provider_name?.includes("TomTom")) {
      return {
        badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800",
        label: "LIVE DATA (TomTom Traffic Flow)",
        type: "LIVE",
      };
    }
    if (!coordTraffic.traffic_available) {
      return {
        badge: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800",
        label: "UNAVAILABLE (No Telemetry for this coordinate)",
        type: "UNAVAILABLE",
      };
    }
    return {
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800",
      label: "DEMO DATA (Simulated Model)",
      type: "DEMO",
    };
  };

  const provenance = getProvenanceState();

  return (
    <div className="space-y-6">
      {/* Top Header & Detect Location Control Bar */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#161920] text-blue-600 dark:text-[#9AC2FA] border border-blue-200 dark:border-white/[0.10] flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-[1.75rem] font-serif font-semibold tracking-tight text-slate-900 dark:text-white">
                  {isHindi ? "लाइव लोकेशन मैप एवं ट्रैफिक" : "Live Location Map"}
                </h1>
                <p className="text-xs text-slate-500 dark:text-[#8C93A4] mt-0.5">
                  {isHindi
                    ? "वास्तविक जीपीएस स्थान का पता लगाएं और टॉमटॉम लाइव फ्लो टेलीमेट्री देखें。"
                    : "Detect your actual GPS coordinates anywhere across India and view authentic live road traffic conditions."}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              data-testid="detect-location-btn"
              onClick={handleDetectLocation}
              disabled={detectingLocation}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#7FB0F7] text-white dark:text-[#0A0D14] font-semibold text-xs sm:text-sm shadow-sm transition-all disabled:opacity-60 cursor-pointer"
            >
              {detectingLocation ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{isHindi ? "जीपीएस लॉक हो रहा है..." : "Locking GPS Coordinates..."}</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4" />
                  <span>{isHindi ? "मेरा स्थान पहचानें (Detect My Location)" : "Detect My Location"}</span>
                </>
              )}
            </button>

            {/* Start Commute / Driver HUD Button */}
            <button
              type="button"
              data-testid="start-commute-btn"
              onClick={() => setIsHudOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-[#1B1D22] dark:hover:bg-[#232730] dark:text-white font-semibold text-xs sm:text-sm transition-all cursor-pointer border border-slate-200 dark:border-white/[0.10]"
              title="Open Full-Screen Driver HUD Commute Mode"
            >
              <Car className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>{isHindi ? "कम्यूट मोड (Start Commute)" : "Start Commute"}</span>
            </button>

            {userLocation && (
              <button
                type="button"
                onClick={() => {
                  setMapTarget([userLocation.lat, userLocation.lng]);
                  setMapZoom(16);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] text-slate-700 dark:text-[#E8EAEE] hover:bg-slate-100 dark:hover:bg-[#232730] font-semibold text-xs transition-all cursor-pointer"
                title="Center map on detected coordinates"
              >
                <Crosshair className="w-4 h-4 text-blue-600 dark:text-[#9AC2FA]" />
                <span>{isHindi ? "स्थान पर केंद्रित करें" : "Center on Me"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => loadNetworkData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] text-slate-700 dark:text-[#E8EAEE] hover:bg-slate-100 dark:hover:bg-[#232730] font-semibold text-xs transition-all cursor-pointer"
              title="Refresh traffic observations"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#9AC2FA]" : ""}`} />
              <span className="hidden sm:inline">{refreshing ? "Refreshing..." : "Refresh Feed"}</span>
            </button>
          </div>
        </div>

        {/* Location Error Alert */}
        {locationError && (
          <div
            data-testid="live-map-location-error"
            className="mt-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-800 dark:text-red-300 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{locationError}</span>
            </div>
            <button
              type="button"
              data-testid="live-map-retry-error-btn"
              onClick={handleDetectLocation}
              className="px-3 py-1 rounded-lg bg-red-600 text-white font-bold text-[11px] hover:bg-red-500 shrink-0 cursor-pointer"
            >
              Retry GPS
            </button>
          </div>
        )}

        {/* Coarse / Approximate Accuracy Warning */}
        {userLocation?.accuracyWarning && (
          <div
            data-testid="live-map-accuracy-warning"
            className="mt-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Approximate Location Warning (±{userLocation.accuracy} m)</span>
                <p className="text-[11px] mt-0.5">{userLocation.accuracyWarning}</p>
              </div>
            </div>
            <button
              type="button"
              data-testid="live-map-retry-accuracy-btn"
              onClick={handleDetectLocation}
              disabled={detectingLocation}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shrink-0 cursor-pointer disabled:opacity-50"
            >
              Retry GPS
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Interactive Map + Live Telemetry Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEAFLET MAP CONTAINER (2 Cols on Desktop) */}
        <div className="lg:col-span-2 flex flex-col rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm overflow-hidden h-[480px] sm:h-[580px] relative">
          <MapContainer
            center={mapTarget || [28.6139, 77.209]}
            zoom={mapZoom}
            scrollWheelZoom={true}
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapFlyToController targetCoords={mapTarget} zoom={mapZoom} />

            {/* GPS User Location Marker */}
            {userLocation && (
              <>
                <Marker
                  position={[userLocation.lat, userLocation.lng]}
                  icon={createUserLocationIcon()}
                >
                  <Popup>
                    <div className="p-1 text-slate-900 dark:text-[#E8EAEE] text-xs space-y-0.5">
                      <p className="font-bold text-sm text-blue-600 dark:text-[#9AC2FA]">{userLocation.roadName}</p>
                      <p className="text-[11px] text-slate-600 dark:text-[#C5C8D0]">
                        {formatCityDistrictState({
                          city: userLocation.city,
                          district: userLocation.district,
                          state: userLocation.state,
                          lat: userLocation.lat,
                          lng: userLocation.lng,
                        })}
                      </p>
                      <p className="text-[10px] font-mono text-slate-500 dark:text-[#8C93A4]">
                        {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)} • ±{userLocation.accuracy} m
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-[#8C93A4]">
                        Source: {userLocation.sourceLabel || "Device GPS / Browser Location"}
                      </p>
                      {userLocation.isApproximate && (
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          Approximate / coarse accuracy fix
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
                <Circle
                  center={[userLocation.lat, userLocation.lng]}
                  radius={Math.max(userLocation.accuracy, 30)}
                  pathOptions={{
                    color: userLocation.isApproximate ? "#d97706" : "#2563eb",
                    fillColor: userLocation.isApproximate ? "#f59e0b" : "#3b82f6",
                    fillOpacity: 0.15,
                    weight: 1.5,
                  }}
                />
              </>
            )}

            {/* Delhi Monitored Corridor Overlay (Only if enabled or user is in Delhi) */}
            {showDelhiNetwork && (
              <>
                {DELHI_ARTERIAL_EDGES.map(([uId, vId], idx) => {
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

                {intersections.map((inter) => (
                  <Marker
                    key={inter.id}
                    position={[inter.latitude, inter.longitude]}
                    icon={createJunctionIcon(inter.congestion_level)}
                    eventHandlers={{
                      click: () => {
                        setSelectedIntersection(inter);
                        setMapTarget([inter.latitude, inter.longitude]);
                      },
                    }}
                  >
                    <Popup>
                      <div className="p-1 text-slate-900 dark:text-[#E8EAEE] text-xs font-sans">
                        <p className="font-bold text-sm mb-1 dark:text-white">{isHindi ? inter.name_hi : inter.name}</p>
                        <p>
                          {isHindi ? "गति: " : "Speed: "}
                          <b>{inter.current_speed} km/h</b>
                        </p>
                        <p>
                          {isHindi ? "स्थिति: " : "Congestion: "}
                          <b className="capitalize">{inter.congestion_level}</b>
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </>
            )}
          </MapContainer>

          {/* Floating Map Legend & Control Overlay */}
          <div className="absolute bottom-4 left-4 z-[400] p-3 rounded-2xl bg-white/95 dark:bg-[#111318]/92 backdrop-blur-md border border-slate-200 dark:border-white/[0.10] shadow-lg text-xs space-y-1.5">
            <p className="font-bold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider mb-1">
              Traffic Flow Legend
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-600 dark:text-[#C5C8D0]">Free-Flow (Low Density)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span className="text-slate-600 dark:text-[#C5C8D0]">Moderate Transit</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
              <span className="text-slate-600 dark:text-[#C5C8D0]">Heavy / Congested Delay</span>
            </div>
          </div>

          {/* Toggle Delhi Network Overlay Button */}
          <div className="absolute top-4 right-4 z-[400]">
            <button
              type="button"
              onClick={() => setShowDelhiNetwork((prev) => !prev)}
              className="px-3 py-1.5 rounded-xl bg-white/95 dark:bg-[#111318]/92 backdrop-blur-md border border-slate-200 dark:border-white/[0.10] shadow-md text-xs font-semibold text-slate-800 dark:text-[#E8EAEE] hover:bg-slate-50 dark:hover:bg-[#1B1D22] flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
              <span>
                {userLocation && !userLocation.isDelhi
                  ? showDelhiNetwork
                    ? "Hide Delhi Reference Nodes"
                    : "Show Delhi Reference Nodes"
                  : showDelhiNetwork
                  ? "Hide Delhi NCR Nodes"
                  : "Show Delhi NCR Nodes"}
              </span>
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: LIVE TELEMETRY & LOCATION DETAILS */}
        <div className="flex flex-col justify-between p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-5">
          <div className="space-y-4">
            {/* Provenance Badge */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.08]">
              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${provenance.badge}`}>
                {provenance.label}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-[#8C93A4] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{lastRefreshedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              </span>
            </div>

            {/* Location Title & Address */}
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-600 dark:text-[#9AC2FA]">
                {userLocation ? "DETECTED COMMUTE CORRIDOR" : "MONITORED REGION"}
              </span>
              <h3
                data-testid="live-map-road-name"
                className="text-xl font-serif font-semibold text-slate-900 dark:text-white mt-0.5"
              >
                {userLocation?.roadName || selectedIntersection?.name || "Detect your location above"}
              </h3>
              <p
                data-testid="live-map-city-address"
                className="text-xs text-slate-500 dark:text-[#8C93A4] mt-1 leading-relaxed"
              >
                {userLocation
                  ? `${formatCityDistrictState({
                      city: userLocation.city,
                      district: userLocation.district,
                      state: userLocation.state,
                      lat: userLocation.lat,
                      lng: userLocation.lng,
                    })} (${userLocation.fullAddress})`
                  : "Click 'Detect My Location' to pinpoint your exact road coordinates and live TomTom traffic flow anywhere you travel."}
              </p>

              {userLocation && (
                <div
                  data-testid="live-map-gps-meta"
                  className="mt-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] text-[11px] space-y-1 text-slate-600 dark:text-[#C5C8D0]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 dark:text-[#8C93A4]">GPS Coordinates:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">
                      {userLocation.lat.toFixed(5)}°, {userLocation.lng.toFixed(5)}°
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 dark:text-[#8C93A4]">Accuracy Radius:</span>
                    <span className="font-bold">±{userLocation.accuracy} meters</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 dark:text-[#8C93A4]">Location Source:</span>
                    <span className="font-bold text-blue-600 dark:text-[#9AC2FA]">
                      {userLocation.sourceLabel || "Device GPS / Browser Location"}
                    </span>
                  </div>
                  {userLocation.detectedAt && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 dark:text-[#8C93A4]">Detected At:</span>
                      <span className="font-mono">
                        {userLocation.detectedAt.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hands-Free Audio Guidance Control Card */}
            <VoiceAdvisoryControl advisory={voiceAdvisory} />

            {/* Live Speed vs Free-Flow Telemetry */}
            {userLocation && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-[#C5C8D0]">
                  <span>Current Road Speed</span>
                  <span className="text-[11px] text-slate-400 dark:text-[#8C93A4]">
                    Confidence: {coordTraffic?.confidence ? `${Math.round(coordTraffic.confidence * 100)}%` : "Verified GPS"}
                  </span>
                </div>

                {loadingTraffic ? (
                  <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#9AC2FA]" />
                    <span>Querying TomTom live telemetry...</span>
                  </div>
                ) : coordTraffic?.traffic_available ? (
                  <div className="space-y-3">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-serif font-semibold text-slate-900 dark:text-white tabular-nums">
                          {coordTraffic.current_speed !== undefined ? coordTraffic.current_speed : "--"}
                        </span>
                        <span className="text-xs font-bold text-slate-500 dark:text-[#8C93A4]">km/h</span>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Free-Flow Speed</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          {coordTraffic.free_flow_speed !== undefined ? `${coordTraffic.free_flow_speed} km/h` : "--"}
                        </span>
                      </div>
                    </div>

                    {/* Congestion Level Banner */}
                    <div
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                        coordTraffic.congestion_level === "severe"
                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60"
                          : coordTraffic.congestion_level === "moderate"
                          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60"
                      }`}
                    >
                      <span className="capitalize">Condition: {coordTraffic.congestion_level || "Normal"}</span>
                      {coordTraffic.road_closure && (
                        <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] uppercase font-extrabold">
                          Road Closed
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                    <span className="font-bold block">Telemetry Unavailable for this Point</span>
                    <p className="text-[11px] leading-relaxed">
                      {coordTraffic?.reason || "TomTom flow data is not registered for this specific coordinate. Speed measurements will activate once telemetry is published."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Region ML Scope Notice */}
            {userLocation && !userLocation.isDelhi && (
              <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-[#161920] border border-blue-200 dark:border-[#9AC2FA]/25 text-xs text-blue-900 dark:text-[#C5C8D0] space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                  <Info className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
                  <span>Regional Location Supported</span>
                </span>
                <p className="text-[11px] text-slate-600 dark:text-[#8C93A4] leading-relaxed">
                  Your coordinates ({userLocation.city || `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`}) are mapped with live GPS and TomTom flow telemetry. Federated Learning predictive models are currently trained on continuous Delhi NCR corridors.
                </p>
              </div>
            )}
          </div>

          {/* Privacy Badge */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-600 dark:text-[#8C93A4] flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-[11px]">
              <b className="text-slate-900 dark:text-white">Privacy-First Navigation:</b> Your location coordinates are used strictly for immediate traffic telemetry.
            </span>
          </div>
        </div>
      </div>

      {/* Driver HUD / Commute Mode Full-Screen Dashboard */}
      <DriverHud
        isOpen={isHudOpen}
        onClose={() => setIsHudOpen(false)}
        userLocation={userLocation}
        coordTraffic={coordTraffic}
        selectedIntersection={selectedIntersection}
        loadingTraffic={loadingTraffic}
        detectingLocation={detectingLocation}
        locationError={locationError}
        onDetectLocation={handleDetectLocation}
        lastRefreshedAt={lastRefreshedAt}
        onRefreshFeed={() => loadNetworkData(true)}
        refreshing={refreshing}
        voiceAdvisory={voiceAdvisory}
        isHindi={isHindi}
      />
    </div>
  );
};

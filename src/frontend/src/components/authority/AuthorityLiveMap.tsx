import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import {
  MapPin,
  AlertTriangle,
  Radio,
  Eye,
  Layers,
  ShieldAlert,
  Car,
  Compass,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  IntersectionDetail,
  CitizenReport,
  IncidentItem,
  EmergencyCorridorRequest,
} from "../../types";

// Known coordinates mapping for Delhi NCR arterial locations
const KNOWN_COORDINATES: Record<string, [number, number]> = {
  "INT-01": [28.6328, 77.2197],
  "INT-02": [28.6292, 77.2285],
  "INT-03": [28.6329, 77.2185],
  "INT-04": [28.5714, 77.1983],
  "INT-05": [28.5833, 77.1685],
  "INT-06": [28.5921, 77.1594],
  "INT-07": [28.4986, 77.0878],
  "INT-08": [28.4715, 77.0984],
  "connaught": [28.6328, 77.2197],
  "barakhamba": [28.6292, 77.2285],
  "rajiv chowk": [28.6329, 77.2185],
  "ring road": [28.5714, 77.1983],
  "aiims": [28.5714, 77.1983],
  "moti bagh": [28.5833, 77.1685],
  "dhaula kuan": [28.5921, 77.1594],
  "cyber hub": [28.4986, 77.0878],
  "gurugram": [28.4986, 77.0878],
  "golf course": [28.4715, 77.0984],
  "lajpat nagar": [28.5677, 77.2433],
  "ito": [28.6297, 77.2436],
  "karol bagh": [28.6517, 77.1906],
  "saket": [28.5244, 77.2066],
  "noida": [28.5708, 77.3261],
};

const DELHI_ARTERIAL_EDGES: [string, string][] = [
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

function resolveReportCoords(report: CitizenReport): [number, number] | null {
  if (report.latitude && report.longitude) {
    return [report.latitude, report.longitude];
  }
  const loc = (report.location_name || "").toLowerCase();
  for (const [key, coords] of Object.entries(KNOWN_COORDINATES)) {
    if (loc.includes(key)) {
      // Add slight random offset (+- 0.003) so overlapping reports are distinguishable
      const hash = report.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const latOffset = ((hash % 10) - 5) * 0.0007;
      const lonOffset = (((hash >> 2) % 10) - 5) * 0.0007;
      return [coords[0] + latOffset, coords[1] + lonOffset];
    }
  }
  return [28.6139 + ((report.id.length % 5) - 2) * 0.015, 77.209 + ((report.id.length % 3) - 1) * 0.015];
}

// Custom icons
const createJunctionIcon = (congestion: string, isSelected: boolean) => {
  let color = "#10b981";
  if (congestion === "moderate") color = "#f59e0b";
  if (congestion === "severe") color = "#ef4444";

  const size = isSelected ? 30 : 22;
  const border = isSelected ? "4px solid #ffffff" : "2.5px solid #ffffff";
  const shadow = isSelected ? "0 0 12px rgba(37,99,235,0.8)" : "0 2px 6px rgba(0,0,0,0.3)";

  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: ${border};
        box-shadow: ${shadow};
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="background-color: white; width: 6px; height: 6px; border-radius: 50%;"></div>
      </div>
    `,
    className: "authority-junction-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const createIncidentMarkerIcon = (category: string, priority: string, status: string) => {
  let bg = "#f59e0b";
  let letter = "!";
  if (category === "accident") {
    bg = "#ef4444";
    letter = "A";
  } else if (category === "waterlogging") {
    bg = "#0284c7";
    letter = "W";
  } else if (category === "damaged_road") {
    bg = "#ea580c";
    letter = "R";
  } else if (category === "broken_signal") {
    bg = "#8b5cf6";
    letter = "S";
  } else if (category === "road_blockage") {
    bg = "#dc2626";
    letter = "B";
  }

  const isCritical = (priority || "").toLowerCase() === "critical";
  const isResolved = (status || "").toLowerCase() === "resolved";

  return L.divIcon({
    html: `
      <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
        ${isCritical && !isResolved ? `<div style="position: absolute; inset: -4px; border-radius: 50%; background-color: ${bg}; opacity: 0.4; animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ""}
        <div style="
          background-color: ${isResolved ? "#10b981" : bg};
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: 2px solid white;
          box-shadow: 0 3px 8px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 11px;
          font-family: monospace;
        ">
          ${isResolved ? "✓" : letter}
        </div>
      </div>
    `,
    className: "authority-incident-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

const createTerminalGpsIcon = (isApproximate?: boolean) =>
  L.divIcon({
    html: `
      <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; inset: 0; border-radius: 50%; background-color: ${isApproximate ? "#f59e0b" : "#2563eb"}; opacity: 0.28;"></div>
        <div style="
          background-color: ${isApproximate ? "#d97706" : "#2563eb"};
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2.5px solid #ffffff;
          box-shadow: 0 0 10px ${isApproximate ? "rgba(217,119,6,0.75)" : "rgba(37,99,235,0.85)"};
        "></div>
      </div>
    `,
    className: "authority-terminal-gps-marker",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

const MapRecenterController: React.FC<{ coords: [number, number]; zoom: number }> = ({ coords, zoom }) => {
  const map = useMap();
  React.useEffect(() => {
    map.setView(coords, zoom, { animate: true });
  }, [coords, zoom, map]);
  return null;
};

export interface AuthorityDetectedLocation {
  lat: number;
  lng: number;
  accuracy: number;
  roadName: string;
  city: string;
  district?: string;
  state: string;
  sourceLabel: string;
  timestamp: Date;
  isApproximate?: boolean;
  accuracyWarning?: string | null;
}

export interface AuthorityLiveMapProps {
  intersections?: IntersectionDetail[];
  reports?: CitizenReport[];
  incidents?: IncidentItem[];
  emergencyCorridors?: EmergencyCorridorRequest[];
  activeCorridorRoute?: string[];
  affectedSegment?: [string, string] | null;
  selectedJunctionId?: string | null;
  onSelectJunction?: (junctionId: string) => void;
  onSelectReport?: (report: CitizenReport) => void;
  compact?: boolean;
  centerCoords?: [number, number];
  zoom?: number;
  userLocation?: AuthorityDetectedLocation | null;
}

export const AuthorityLiveMap: React.FC<AuthorityLiveMapProps> = ({
  intersections = [],
  reports = [],
  incidents = [],
  emergencyCorridors = [],
  activeCorridorRoute,
  affectedSegment,
  selectedJunctionId,
  onSelectJunction,
  onSelectReport,
  compact = false,
  centerCoords = [28.6139, 77.209], // Central Delhi
  zoom = 12,
  userLocation = null,
}) => {
  const [showJunctions, setShowJunctions] = React.useState<boolean>(true);
  const [showReports, setShowReports] = React.useState<boolean>(true);
  const [showCorridors, setShowCorridors] = React.useState<boolean>(true);

  // Derive active emergency route path intersection IDs
  const highlightedRouteNodes = useMemo(() => {
    if (activeCorridorRoute && activeCorridorRoute.length > 0) {
      return activeCorridorRoute;
    }
    const activeCorridor = emergencyCorridors.find((c) => c.status === "ACTIVE" || c.status === "APPROVED");
    if (activeCorridor && activeCorridor.route_path) {
      return activeCorridor.route_path;
    }
    return [];
  }, [activeCorridorRoute, emergencyCorridors]);

  // Fallback default intersections if API is loading
  const effectiveJunctions = useMemo(() => {
    if (intersections.length > 0) return intersections;
    return [
      { id: "INT-01", name: "Connaught Central Circle", name_hi: "कनॉट सेंट्रल सर्कल", zone: "Central Delhi", latitude: 28.6328, longitude: 77.2197, baseline_speed: 50, capacity: 4500, edge_client_id: "edge-01", current_volume: 3200, current_speed: 42, congestion_level: "low", risk_score: 18, edge_status: "active" },
      { id: "INT-02", name: "Barakhamba Road Crossing", name_hi: "बाराखंभा रोड क्रॉसिंग", zone: "Central Delhi", latitude: 28.6292, longitude: 77.2285, baseline_speed: 45, capacity: 4000, edge_client_id: "edge-02", current_volume: 2900, current_speed: 38, congestion_level: "low", risk_score: 22, edge_status: "active" },
      { id: "INT-03", name: "Rajiv Chowk Metro Radial", name_hi: "राजीव चौक मेट्रो रेडियल", zone: "Central Delhi", latitude: 28.6329, longitude: 77.2185, baseline_speed: 40, capacity: 5000, edge_client_id: "edge-03", current_volume: 4100, current_speed: 25, congestion_level: "moderate", risk_score: 54, edge_status: "active" },
      { id: "INT-04", name: "Ring Road Arterial Junction", name_hi: "रिंग रोड आर्टेरियल जंक्शन", zone: "South Delhi", latitude: 28.5714, longitude: 77.1983, baseline_speed: 55, capacity: 6000, edge_client_id: "edge-04", current_volume: 5200, current_speed: 28, congestion_level: "moderate", risk_score: 58, edge_status: "active" },
      { id: "INT-05", name: "Moti Bagh Flyover Split", name_hi: "मोती बाग फ्लाईओवर स्प्लिट", zone: "South Delhi", latitude: 28.5833, longitude: 77.1685, baseline_speed: 60, capacity: 5500, edge_client_id: "edge-05", current_volume: 3400, current_speed: 48, congestion_level: "low", risk_score: 19, edge_status: "active" },
      { id: "INT-06", name: "Dhaula Kuan Interchange", name_hi: "धौला कुआं इंटरचेंज", zone: "West Delhi", latitude: 28.5921, longitude: 77.1594, baseline_speed: 50, capacity: 7000, edge_client_id: "edge-06", current_volume: 6800, current_speed: 18, congestion_level: "severe", risk_score: 88, edge_status: "active" },
      { id: "INT-07", name: "Cyber Hub Gateway", name_hi: "साइबर हब गेटवे", zone: "Gurugram / NCR", latitude: 28.4986, longitude: 77.0878, baseline_speed: 50, capacity: 5800, edge_client_id: "edge-07", current_volume: 4800, current_speed: 32, congestion_level: "moderate", risk_score: 46, edge_status: "active" },
      { id: "INT-08", name: "Golf Course Express Radial", name_hi: "गोल्फ कोर्स एक्सप्रेस रेडियल", zone: "Gurugram / NCR", latitude: 28.4715, longitude: 77.0984, baseline_speed: 65, capacity: 5200, edge_client_id: "edge-08", current_volume: 3100, current_speed: 52, congestion_level: "low", risk_score: 15, edge_status: "active" },
    ] as IntersectionDetail[];
  }, [intersections]);

  // Build coordinate lookup map for junctions
  const junctionCoordMap = useMemo(() => {
    const map = new Map<string, [number, number]>();
    for (const j of effectiveJunctions) {
      map.set(j.id, [j.latitude, j.longitude]);
    }
    return map;
  }, [effectiveJunctions]);

  // Polyline coordinates for Delhi Arterial Edges
  const edgeSegments = useMemo(() => {
    return DELHI_ARTERIAL_EDGES.map(([fromId, toId]) => {
      const fromCoord = junctionCoordMap.get(fromId) || KNOWN_COORDINATES[fromId];
      const toCoord = junctionCoordMap.get(toId) || KNOWN_COORDINATES[toId];
      if (!fromCoord || !toCoord) return null;

      const isHighlighted =
        highlightedRouteNodes.includes(fromId) && highlightedRouteNodes.includes(toId);

      const isAffected = !!affectedSegment && (
        (fromId === affectedSegment[0] && toId === affectedSegment[1]) ||
        (fromId === affectedSegment[1] && toId === affectedSegment[0])
      );

      return {
        fromId,
        toId,
        coords: [fromCoord, toCoord] as [[number, number], [number, number]],
        isHighlighted,
        isAffected,
      };
    }).filter(Boolean);
  }, [junctionCoordMap, highlightedRouteNodes, affectedSegment]);

  // Filtered reports with valid resolved coordinates
  const mappedReports = useMemo(() => {
    return reports
      .filter((r) => r.status !== "dismissed")
      .map((r) => ({
        report: r,
        coords: resolveReportCoords(r),
      }))
      .filter((item): item is { report: CitizenReport; coords: [number, number] } => item.coords !== null);
  }, [reports]);

  const mapHeight = compact ? "h-[320px] sm:h-[340px]" : "h-[480px] sm:h-[540px]";

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-white/[0.08] shadow-xs bg-slate-900 dark:bg-[#0D0F14]" data-testid="authority-live-map">
      {/* Top Map Layer Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#111318]/92 backdrop-blur-md border border-white/[0.10] shadow-lg text-[11px] pointer-events-auto">
          <button
            onClick={() => setShowJunctions((v) => !v)}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              showJunctions ? "bg-[#9AC2FA] text-[#0A0D14]" : "text-[#8C93A4] hover:text-white"
            }`}
          >
            <Radio className="w-3 h-3" />
            <span>Arterials ({effectiveJunctions.length})</span>
          </button>

          <button
            onClick={() => setShowReports((v) => !v)}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              showReports ? "bg-amber-500 text-[#0A0D14]" : "text-[#8C93A4] hover:text-white"
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Citizen Incidents ({mappedReports.length})</span>
          </button>

          {highlightedRouteNodes.length > 0 && (
            <button
              onClick={() => setShowCorridors((v) => !v)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                showCorridors ? "bg-blue-500 text-white" : "text-[#8C93A4] hover:text-white"
              }`}
            >
              <Compass className="w-3 h-3" />
              <span>Green Corridor ({highlightedRouteNodes.length})</span>
            </button>
          )}
        </div>

        {/* Live Legend */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#111318]/92 backdrop-blur-md border border-white/[0.10] text-[10px] text-[#C5C8D0] font-mono pointer-events-auto">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Free Flow</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Moderate</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Congested</span>
          </div>
        </div>
      </div>

      {/* Leaflet Map Container */}
      <div className={`w-full ${mapHeight}`}>
        <MapContainer
          center={centerCoords}
          zoom={zoom}
          scrollWheelZoom={!compact}
          className="w-full h-full z-0"
        >
          <MapRecenterController coords={centerCoords} zoom={zoom} />

          {/* Authority Terminal GPS Location Marker & Accuracy Radius */}
          {userLocation && (
            <>
              <Marker
                position={[userLocation.lat, userLocation.lng]}
                icon={createTerminalGpsIcon(userLocation.isApproximate)}
              >
                <Popup>
                  <div className="p-1.5 text-slate-900 dark:text-[#E8EAEE] text-xs font-sans space-y-1 min-w-[180px]">
                    <p className="font-bold text-sm text-blue-600 dark:text-[#9AC2FA]">{userLocation.roadName}</p>
                    <p className="text-[11px] text-slate-600 dark:text-[#C5C8D0]">
                      {[userLocation.city, userLocation.district, userLocation.state]
                        .filter((v, idx, arr) => v && arr.indexOf(v) === idx)
                        .join(", ")}
                    </p>
                    <p className="text-[10px] font-mono text-slate-500 dark:text-[#8C93A4]">
                      {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)} • ±{userLocation.accuracy} m
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-[#8C93A4]">
                      Source: {userLocation.sourceLabel}
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
                  fillOpacity: 0.14,
                  weight: 1.5,
                }}
              />
            </>
          )}

          {/* Dark / CartoDB Tile Layer */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          {/* Arterial Corridor Links */}
          {showCorridors &&
            edgeSegments.map((edge) => {
              if (!edge) return null;
              return (
                <Polyline
                  key={`${edge.fromId}-${edge.toId}`}
                  positions={edge.coords}
                  pathOptions={{
                    color: edge.isAffected ? "#ef4444" : edge.isHighlighted ? "#06b6d4" : "#94a3b8",
                    weight: edge.isAffected ? 7 : edge.isHighlighted ? 6 : 3,
                    opacity: edge.isAffected ? 1.0 : edge.isHighlighted ? 0.95 : 0.6,
                    dashArray: edge.isAffected ? "8 6" : edge.isHighlighted ? "8 6" : undefined,
                  }}
                />
              );
            })}

          {/* Arterial Junction Markers */}
          {showJunctions &&
            effectiveJunctions.map((j) => {
              const isSelected = selectedJunctionId === j.id;
              return (
                <Marker
                  key={j.id}
                  position={[j.latitude, j.longitude]}
                  icon={createJunctionIcon(j.congestion_level, isSelected)}
                  eventHandlers={{
                    click: () => onSelectJunction && onSelectJunction(j.id),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                    <div className="font-sans text-xs">
                      <div className="font-bold text-slate-900 dark:text-white">{j.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-[#8C93A4] font-mono">
                        Speed: {j.current_speed} km/h • {j.congestion_level.toUpperCase()}
                      </div>
                    </div>
                  </Tooltip>
                  <Popup>
                    <div className="p-2 space-y-2 text-xs font-sans min-w-[180px]">
                      <div className="flex items-center justify-between border-b pb-1">
                        <span className="font-mono font-bold text-blue-600">{j.id}</span>
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {j.congestion_level}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{j.name}</div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] bg-slate-50 dark:bg-[#161920] border border-transparent dark:border-white/[0.06] p-2 rounded">
                        <div>
                          <span className="text-slate-400 dark:text-[#8C93A4] block text-[9px]">Speed</span>
                          <span className="font-bold font-mono">{j.current_speed} km/h</span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-[#8C93A4] block text-[9px]">Flow Status</span>
                          <span className="font-bold font-mono text-emerald-600">Online</span>
                        </div>
                      </div>
                      {onSelectJunction && (
                        <button
                          onClick={() => onSelectJunction(j.id)}
                          className="w-full mt-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#7FB0F7] text-white dark:text-[#0A0D14] font-bold text-[10px] cursor-pointer"
                        >
                          Inspect Junction Telemetry
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

          {/* Citizen Reported Incidents Layer */}
          {showReports &&
            mappedReports.map(({ report: r, coords }) => (
              <Marker
                key={r.id}
                position={coords}
                icon={createIncidentMarkerIcon(r.category, r.priority || "medium", r.status)}
                eventHandlers={{
                  click: () => onSelectReport && onSelectReport(r),
                }}
              >
                <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
                  <div className="font-sans text-xs">
                    <span className="font-mono font-bold text-amber-700">{r.id}: </span>
                    <span className="font-semibold text-slate-900 dark:text-white">{r.location_name}</span>
                    <div className="text-[10px] text-slate-500 dark:text-[#8C93A4] capitalize">{r.category.replace("_", " ")}</div>
                  </div>
                </Tooltip>
                <Popup>
                  <div className="p-2 space-y-2 text-xs font-sans min-w-[210px] max-w-[260px]">
                    <div className="flex items-center justify-between border-b pb-1">
                      <span className="font-mono font-bold text-amber-600">{r.id}</span>
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        {r.status}
                      </span>
                    </div>

                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate">{r.location_name}</span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-[#C5C8D0] leading-snug line-clamp-2">
                      {r.description}
                    </p>

                    {r.photo_url && (
                      <div className="w-full h-20 rounded overflow-hidden bg-slate-100 border border-slate-200">
                        <img src={r.photo_url} alt="Evidence" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Priority: {(r.priority || "medium").toUpperCase()}</span>
                      <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>

                    {onSelectReport && (
                      <button
                        onClick={() => onSelectReport(r)}
                        className="w-full mt-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#7FB0F7] text-white dark:text-[#0A0D14] font-bold text-[10px] cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Review Citizen Complaint</span>
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>
    </div>
  );
};

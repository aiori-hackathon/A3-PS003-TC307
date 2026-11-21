import React from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { IntersectionDetail } from "../../types";
import { DetectedLocationEvent } from "../location/DetectMyLocationCard";
import { formatCityDistrictState } from "../../utils/geolocation";

const CitizenMapFlyToController: React.FC<{ center: [number, number]; zoom: number }> = ({
  center,
  zoom,
}) => {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo(center, zoom, { animate: true, duration: 0.9 });
  }, [center, zoom, map]);
  return null;
};

const createDetectedUserPin = (isApproximate?: boolean) =>
  L.divIcon({
    html: `
      <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; inset: 0; border-radius: 50%; background-color: ${isApproximate ? "#f59e0b" : "#2563eb"}; opacity: 0.3;"></div>
        <div style="width: 14px; height: 14px; border-radius: 50%; background-color: ${isApproximate ? "#d97706" : "#2563eb"}; border: 2.5px solid white; box-shadow: 0 0 10px rgba(37,99,235,0.8);"></div>
      </div>
    `,
    className: "citizen-detected-gps-pin",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

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

const createCitizenIcon = (congestion: string) => {
  let color = "#10B981";
  if (congestion === "moderate") color = "#F59E0B";
  if (congestion === "severe") color = "#EF4444";

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

interface CitizenTrafficMapCardProps {
  showingDetectedLocation: boolean;
  detectedLocation: DetectedLocationEvent | null;
  selectedIntersection?: IntersectionDetail;
  intersections: IntersectionDetail[];
  interMap: Map<string, IntersectionDetail>;
  isHindi: boolean;
  lastRefreshedAt: Date;
  onSelectIntersection: (id: string) => void;
}

export const CitizenTrafficMapCard: React.FC<CitizenTrafficMapCardProps> = ({
  showingDetectedLocation,
  detectedLocation,
  selectedIntersection,
  intersections,
  interMap,
  isHindi,
  lastRefreshedAt,
  onSelectIntersection,
}) => {
  return (
    <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm overflow-hidden h-[420px] sm:h-[480px] relative">
      <MapContainer
        center={
          showingDetectedLocation && detectedLocation
            ? [detectedLocation.lat, detectedLocation.lng]
            : [28.6, 77.2]
        }
        zoom={showingDetectedLocation && detectedLocation ? 14 : 11}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <CitizenMapFlyToController
          center={
            showingDetectedLocation && detectedLocation
              ? [detectedLocation.lat, detectedLocation.lng]
              : selectedIntersection
                ? [selectedIntersection.latitude, selectedIntersection.longitude]
                : [28.6, 77.2]
          }
          zoom={showingDetectedLocation && detectedLocation ? 14 : 11}
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Detected User GPS Marker & Accuracy Circle */}
        {detectedLocation && (
          <>
            <Marker
              position={[detectedLocation.lat, detectedLocation.lng]}
              icon={createDetectedUserPin(detectedLocation.accuracyAssessment.isApproximate)}
            >
              <Popup>
                <div className="text-xs p-1 text-slate-800 dark:text-[#E8EAEE] font-sans space-y-0.5">
                  <p className="font-bold text-sm text-blue-600 dark:text-[#9AC2FA]">{detectedLocation.roadName}</p>
                  <p className="text-[11px] text-slate-600 dark:text-[#C5C8D0]">
                    {formatCityDistrictState({
                      city: detectedLocation.city,
                      district: detectedLocation.district,
                      state: detectedLocation.state,
                      lat: detectedLocation.lat,
                      lng: detectedLocation.lng,
                    })}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500 dark:text-[#8C93A4]">
                    {detectedLocation.lat.toFixed(5)}, {detectedLocation.lng.toFixed(5)} • ±
                    {detectedLocation.accuracy} m
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-[#8C93A4]">
                    Source: {detectedLocation.sourceLabel}
                  </p>
                </div>
              </Popup>
            </Marker>
            <Circle
              center={[detectedLocation.lat, detectedLocation.lng]}
              radius={Math.max(detectedLocation.accuracy, 30)}
              pathOptions={{
                color: detectedLocation.accuracyAssessment.isApproximate ? "#d97706" : "#2563eb",
                fillColor: detectedLocation.accuracyAssessment.isApproximate ? "#f59e0b" : "#3b82f6",
                fillOpacity: 0.14,
                weight: 1.5,
              }}
            />
          </>
        )}

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
              click: () => onSelectIntersection(inter.id),
            }}
          >
            <Popup>
              <div className="text-xs p-1 text-slate-800 dark:text-[#E8EAEE] font-sans">
                <p className="font-bold text-sm mb-1 text-slate-900 dark:text-white">{isHindi ? inter.name_hi : inter.name}</p>
                <p className="dark:text-[#C5C8D0]">
                  Traffic:{" "}
                  <b className="dark:text-white">
                    {inter.congestion_level === "severe"
                      ? "Heavy Traffic"
                      : inter.congestion_level === "moderate"
                        ? "Moderate Traffic"
                        : "Free Flow"}
                  </b>
                </p>
                <p className="dark:text-[#C5C8D0]">
                  Speed: <b className="dark:text-white">{inter.current_speed} km/h</b>
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Enhanced Map Legend & Sync Overlay */}
      <div className="absolute bottom-3 left-3 z-[400] p-3 rounded-xl bg-white/95 dark:bg-[#111318]/92 backdrop-blur-md border border-slate-200 dark:border-white/[0.08] shadow-lg text-[11px] space-y-1.5">
        <div className="flex items-center justify-between gap-3 pb-1 border-b border-slate-100 dark:border-white/[0.08]">
          <span className="font-semibold text-slate-900 dark:text-white block">Traffic Condition</span>
          <span className="text-[10px] text-slate-400 dark:text-[#8C93A4] font-mono">
            {lastRefreshedAt.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">
            Green – Low traffic (&gt; 35 km/h)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          <span className="font-semibold text-amber-700 dark:text-amber-300">
            Yellow – Moderate traffic (22 - 35 km/h)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
          <span className="font-semibold text-red-700 dark:text-red-300">
            Red – Heavy traffic (&lt; 22 km/h)
          </span>
        </div>
      </div>
    </div>
  );
};

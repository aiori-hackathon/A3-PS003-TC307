import { api } from "../services/api";
import { IntersectionDetail } from "../types";

export const DELHI_CENTER_COORDS: [number, number] = [28.6139, 77.209];
export const DELHI_NCR_COVERAGE_RADIUS_KM = 45;
export const POOR_ACCURACY_THRESHOLD_METERS = 500;
export const VERY_COARSE_ACCURACY_THRESHOLD_METERS = 2000;

export type GeolocationErrorCode =
  | "unsupported"
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "unknown";

export interface GeolocationErrorInfo {
  code: GeolocationErrorCode;
  message: string;
  messageHi: string;
}

export type AccuracyTier = "high" | "moderate" | "poor";

export interface AccuracyAssessment {
  tier: AccuracyTier;
  accuracyMeters: number;
  label: string;
  labelHi: string;
  isApproximate: boolean;
  warning: string | null;
  warningHi: string | null;
}

export interface ReverseGeocodeInfo {
  resolved: boolean;
  road: string;
  area: string;
  city: string;
  district: string;
  state: string;
  country: string;
  postcode: string;
  fullAddress: string;
  geocodeSource:
    | "tomtom_reverse_geocode"
    | "nominatim"
    | "nominatim_client"
    | "coordinates_only";
}

export interface CoordinateTrafficTelemetry {
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
  fetchedAt: Date;
}

export interface DetectedLocationPayload {
  lat: number;
  lng: number;
  accuracy: number;
  accuracyAssessment: AccuracyAssessment;
  gpsSpeedKmh: number | null;
  sourceLabel: string;
  timestamp: Date;
  roadName: string;
  area: string;
  city: string;
  district: string;
  state: string;
  country: string;
  fullAddress: string;
  geocodeSource: ReverseGeocodeInfo["geocodeSource"];
  geocodeResolved: boolean;
  isDelhi: boolean;
  nearestDelhiNodeId: string | null;
  nearestDelhiNodeName: string | null;
  distanceToDelhiKm: number;
  traffic: CoordinateTrafficTelemetry | null;
}

/**
 * Great-circle Haversine distance in kilometers between two WGS84 points.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Evaluates whether a coordinate falls within the monitored Delhi NCR corridor sensor graph.
 */
export function evaluateDelhiCorridorProximity(
  lat: number,
  lng: number,
  intersections: IntersectionDetail[] = []
): {
  isDelhi: boolean;
  nearestNode: IntersectionDetail | null;
  distanceKm: number;
} {
  if (intersections.length > 0) {
    let closest = intersections[0];
    let minDistance = Infinity;
    for (const node of intersections) {
      const dist = haversineDistanceKm(lat, lng, node.latitude, node.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        closest = node;
      }
    }
    return {
      isDelhi: minDistance <= DELHI_NCR_COVERAGE_RADIUS_KM,
      nearestNode: closest,
      distanceKm: Number(minDistance.toFixed(1)),
    };
  }

  const distFromCenter = haversineDistanceKm(
    lat,
    lng,
    DELHI_CENTER_COORDS[0],
    DELHI_CENTER_COORDS[1]
  );
  return {
    isDelhi: distFromCenter <= DELHI_NCR_COVERAGE_RADIUS_KM,
    nearestNode: null,
    distanceKm: Number(distFromCenter.toFixed(1)),
  };
}

/**
 * Classifies browser geolocation accuracy radius and produces warnings for coarse fixes.
 */
export function assessLocationAccuracy(accuracyMetersRaw: number): AccuracyAssessment {
  const accuracyMeters = Math.max(1, Math.round(accuracyMetersRaw || 0));

  if (accuracyMeters <= 100) {
    return {
      tier: "high",
      accuracyMeters,
      label: "High-Precision GPS / Wi-Fi Fix",
      labelHi: "उच्च-सटीकता जीपीएस / वाई-फाई लोकेशन",
      isApproximate: false,
      warning: null,
      warningHi: null,
    };
  }

  if (accuracyMeters <= POOR_ACCURACY_THRESHOLD_METERS) {
    return {
      tier: "moderate",
      accuracyMeters,
      label: "Approximate Neighborhood Fix",
      labelHi: "अनुमानित क्षेत्रीय लोकेशन",
      isApproximate: true,
      warning: null,
      warningHi: null,
    };
  }

  const distanceText =
    accuracyMeters >= 1000
      ? `${(accuracyMeters / 1000).toFixed(1)} km`
      : `${accuracyMeters} m`;

  if (accuracyMeters > VERY_COARSE_ACCURACY_THRESHOLD_METERS) {
    return {
      tier: "poor",
      accuracyMeters,
      label: "Coarse Network / Approximate Location",
      labelHi: "कम सटीकता (नेटवर्क/आईपी अनुमान)",
      isApproximate: true,
      warning: `Low location accuracy (±${distanceText}). Your browser or OS returned a network/ISP-level fix instead of precise GPS/Wi-Fi, so the city shown may reflect your regional network gateway. Enable Precise Location & Wi-Fi in system settings and Retry.`,
      warningHi: `लोकेशन सटीकता कम है (±${distanceText})। ब्राउज़र/सिस्टम ने सटीक GPS के बजाय नेटवर्क/आईपी-स्तर का स्थान दिया है, जिससे शहर गलत दिख सकता है। कृपया सेटिंग्स में सटीक लोकेशन और Wi-Fi चालू करके पुनः प्रयास करें।`,
    };
  }

  return {
    tier: "poor",
    accuracyMeters,
    label: "Coarse / Approximate Location",
    labelHi: "कम सटीक अनुमानित स्थान",
    isApproximate: true,
    warning: `Moderate/low location accuracy (±${distanceText}). Position may not match your exact street. Ensure device Location Services are enabled and click Retry for a tighter fix.`,
    warningHi: `स्थान सटीकता मध्यम/कम है (±${distanceText})। सड़क स्तर की पुष्टि के लिए लोकेशन सेवाएं चालू करके पुनः प्रयास करें।`,
  };
}

/**
 * Formats geolocation error codes into clear user-facing guidance.
 */
export function mapGeolocationError(err?: GeolocationPositionError | null): GeolocationErrorInfo {
  if (!err) {
    return {
      code: "unknown",
      message: "Unable to determine device location. Please check browser permissions and try again.",
      messageHi: "डिवाइस स्थान प्राप्त नहीं हो सका। कृपया ब्राउज़र अनुमति जांचें और पुनः प्रयास करें।",
    };
  }

  if (err.code === 1) {
    return {
      code: "permission_denied",
      message:
        "Location permission was denied. Allow browser location access in your address bar settings and click Retry.",
      messageHi:
        "लोकेशन अनुमति अस्वीकार की गई। कृपया ब्राउज़र सेटिंग्स में लोकेशन की अनुमति दें और पुनः प्रयास करें।",
    };
  }

  if (err.code === 2) {
    return {
      code: "position_unavailable",
      message:
        "Location information is currently unavailable from your device/OS sensor. Ensure OS Location Services and Wi-Fi are enabled and Retry.",
      messageHi:
        "डिवाइस/ओएस सेंसर से स्थान उपलब्ध नहीं है। कृपया सिस्टम लोकेशन सेवाएं और Wi-Fi चालू करके पुनः प्रयास करें।",
    };
  }

  if (err.code === 3) {
    return {
      code: "timeout",
      message:
        "High-accuracy GPS/Wi-Fi location request timed out before acquiring a fix. Click Retry to try again.",
      messageHi:
        "उच्च-सटीकता लोकेशन अनुरोध समय समाप्त हो गया। कृपया पुनः प्रयास करें।",
    };
  }

  return {
    code: "unknown",
    message: err.message || "Geolocation failed unexpectedly. Please retry.",
    messageHi: err.message || "लोकेशन पहचानने में त्रुटि हुई। कृपया पुनः प्रयास करें।",
  };
}

/**
 * Requests actual WGS84 coordinates from the browser Geolocation API with strict high accuracy
 * and zero cache tolerance (`enableHighAccuracy: true`, `maximumAge: 0`).
 * Never falls back silently to IP-based geolocation.
 */
export function getBrowserPositionHighAccuracy(
  timeoutMs = 15000
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const unsupportedErr: GeolocationErrorInfo = {
        code: "unsupported",
        message: "Geolocation API is not supported by your current browser.",
        messageHi: "आपके वर्तमान ब्राउज़र में जियोलोकेशन समर्थित नहीं है।",
      };
      reject(unsupportedErr);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (err) => reject(mapGeolocationError(err)),
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Resolves city, district, state, area, and road for exact WGS84 coordinates without any
 * hardcoded city bounding-box guesses or IP substitutions.
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<ReverseGeocodeInfo> {
  // Primary: Backend proxy using TomTom Search Reverse Geocode -> Nominatim (with proper User-Agent)
  try {
    const res = await api.reverseGeocode(lat, lng);
    if (res && res.resolved && (res.city || res.state || res.road || res.district)) {
      return {
        resolved: true,
        road: res.road || "",
        area: res.area || "",
        city: res.city || res.district || "",
        district: res.district || "",
        state: res.state || "",
        country: res.country || "",
        postcode: res.postcode || "",
        fullAddress: res.full_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        geocodeSource: res.source === "tomtom_reverse_geocode" ? "tomtom_reverse_geocode" : "nominatim",
      };
    }
  } catch {
    // Fall through to secondary Nominatim lookup below
  }

  // Secondary direct OpenStreetMap Nominatim lookup only if backend reverse geocode did not resolve
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(
        6
      )}&lon=${lng.toFixed(6)}&zoom=18&addressdetails=1&accept-language=en`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (resp.ok) {
      const data = await resp.json();
      const addr = data?.address || {};
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.city_district ||
        addr.county ||
        addr.state_district ||
        "";
      const road =
        addr.road ||
        addr.pedestrian ||
        addr.highway ||
        addr.suburb ||
        addr.neighbourhood ||
        addr.hamlet ||
        "";
      const area =
        addr.suburb ||
        addr.neighbourhood ||
        addr.residential ||
        addr.quarter ||
        addr.village ||
        addr.town ||
        "";
      const district = addr.state_district || addr.county || "";
      const state = addr.state || addr.region || "";
      const country = addr.country || "";
      const postcode = addr.postcode || "";
      const fullAddress =
        data?.display_name ||
        [road, area, city, district, state, country].filter(Boolean).join(", ");

      if (city || state || road || district) {
        return {
          resolved: true,
          road,
          area,
          city: city || district,
          district,
          state,
          country,
          postcode,
          fullAddress: fullAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          geocodeSource: "nominatim_client",
        };
      }
    }
  } catch {
    // Fall through to honest coordinate-only output
  }

  return {
    resolved: false,
    road: "",
    area: "",
    city: "",
    district: "",
    state: "",
    country: "",
    postcode: "",
    fullAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    geocodeSource: "coordinates_only",
  };
}

/**
 * Formats non-redundant human-readable City / District / State subtitle.
 */
export function formatCityDistrictState(loc: {
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  lat: number;
  lng: number;
}): string {
  const parts: string[] = [];
  const pushUnique = (val?: string) => {
    const clean = (val || "").trim();
    if (!clean) return;
    const exists = parts.some((p) => p.toLowerCase() === clean.toLowerCase());
    if (!exists) parts.push(clean);
  };

  pushUnique(loc.city);
  if (
    loc.district &&
    loc.city &&
    !loc.district.toLowerCase().includes(loc.city.toLowerCase()) &&
    !loc.city.toLowerCase().includes(loc.district.toLowerCase())
  ) {
    pushUnique(loc.district);
  } else if (!loc.city) {
    pushUnique(loc.district);
  }
  pushUnique(loc.state);

  if (parts.length === 0) {
    return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
  }
  return parts.join(", ");
}

/**
 * End-to-end location detection flow:
 * 1. Acquires high-accuracy device coordinates (`enableHighAccuracy: true`, `maximumAge: 0`).
 * 2. Calls optional `onInitialGpsLock` immediately with genuine coordinates & accuracy warning.
 * 3. Runs reverse geocoding (preserving exact coordinates) + TomTom coordinate flow telemetry in parallel.
 */
export async function detectPreciseUserLocation(options?: {
  intersections?: IntersectionDetail[];
  timeoutMs?: number;
  onInitialGpsLock?: (initial: DetectedLocationPayload) => void;
}): Promise<DetectedLocationPayload> {
  const position = await getBrowserPositionHighAccuracy(options?.timeoutMs ?? 15000);
  const { latitude: lat, longitude: lng, accuracy, speed } = position.coords;
  const timestamp = position.timestamp ? new Date(position.timestamp) : new Date();
  const gpsSpeedKmh =
    speed !== null && speed !== undefined && !Number.isNaN(speed)
      ? Math.max(0, Math.round(speed * 3.6))
      : null;

  const accuracyAssessment = assessLocationAccuracy(accuracy);
  const proximity = evaluateDelhiCorridorProximity(
    lat,
    lng,
    options?.intersections || []
  );

  const initialPayload: DetectedLocationPayload = {
    lat,
    lng,
    accuracy: accuracyAssessment.accuracyMeters,
    accuracyAssessment,
    gpsSpeedKmh,
    sourceLabel: "Device GPS / Browser Location",
    timestamp,
    roadName: proximity.isDelhi
      ? proximity.nearestNode?.name || "Delhi NCR Corridor"
      : `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    area: "",
    city: proximity.isDelhi ? "Delhi NCR" : "",
    district: "",
    state: proximity.isDelhi ? "Delhi NCR" : "",
    country: "",
    fullAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    geocodeSource: "coordinates_only",
    geocodeResolved: false,
    isDelhi: proximity.isDelhi,
    nearestDelhiNodeId: proximity.nearestNode?.id || null,
    nearestDelhiNodeName: proximity.nearestNode?.name || null,
    distanceToDelhiKm: proximity.distanceKm,
    traffic: null,
  };

  options?.onInitialGpsLock?.(initialPayload);

  const [revResult, trafficResult] = await Promise.allSettled([
    reverseGeocodeCoordinates(lat, lng),
    api.getLiveTrafficByCoordinates(lat, lng),
  ]);

  const geo: ReverseGeocodeInfo =
    revResult.status === "fulfilled"
      ? revResult.value
      : {
          resolved: false,
          road: "",
          area: "",
          city: "",
          district: "",
          state: "",
          country: "",
          postcode: "",
          fullAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          geocodeSource: "coordinates_only",
        };

  let traffic: CoordinateTrafficTelemetry | null = null;
  if (trafficResult.status === "fulfilled") {
    traffic = { ...trafficResult.value, fetchedAt: new Date() };
  } else {
    traffic = {
      traffic_available: false,
      reason: "Live TomTom flow endpoint could not be reached for these coordinates.",
      fetchedAt: new Date(),
    };
  }

  const resolvedCity = geo.city || geo.district || "";
  const resolvedState = geo.state || (geo.country ? geo.country : "");
  const resolvedRoad =
    geo.road ||
    geo.area ||
    (resolvedCity ? `${resolvedCity} Road Segment` : `GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`);

  return {
    ...initialPayload,
    roadName: resolvedRoad,
    area: geo.area || resolvedCity,
    city: resolvedCity,
    district: geo.district,
    state: resolvedState,
    country: geo.country,
    fullAddress: geo.fullAddress,
    geocodeSource: geo.geocodeSource,
    geocodeResolved: geo.resolved,
    traffic,
  };
}

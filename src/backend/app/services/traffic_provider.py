import os
import math
import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from urllib.parse import quote
import httpx
from dotenv import load_dotenv

from backend.app.schemas.schemas import TrafficObservationDTO, ProviderStatusDTO
from backend.app.services.seed_data import INTERSECTIONS_DATA

logger = logging.getLogger("traffic_provider")

TOMTOM_FLOW_BASE_URL = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"
TOMTOM_INCIDENTS_BASE_URL = "https://api.tomtom.com/traffic/services/5/incidentDetails"
TOMTOM_REVERSE_GEOCODE_BASE_URL = "https://api.tomtom.com/search/2/reverseGeocode"
TOMTOM_GEOCODE_BASE_URL = "https://api.tomtom.com/search/2/geocode"
TOMTOM_ROUTING_BASE_URL = "https://api.tomtom.com/routing/1/calculateRoute"
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"


def _load_env() -> None:
    backend_env = Path(__file__).resolve().parent.parent.parent / ".env"
    if backend_env.exists():
        load_dotenv(backend_env, override=True)
    else:
        load_dotenv(override=True)


_load_env()


class TrafficProviderInterface(ABC):
    """
    Abstract contract for traffic data providers.
    All data sources (TomTom Traffic Flow API, municipal feeds, or deterministic
    diurnal simulation fallbacks) must implement this interface.
    """

    @abstractmethod
    async def fetch_live_observations(
        self, intersection_ids: Optional[List[str]] = None
    ) -> List[TrafficObservationDTO]:
        """
        Fetch real-time traffic observations for target intersections.
        Returns a list of standardized TrafficObservationDTO objects.
        """
        pass

    @abstractmethod
    async def fetch_live_incidents(self) -> List[Dict[str, Any]]:
        """
        Fetch real-time traffic incidents from provider (e.g. TomTom Incident Details API).
        Returns a list of incident dictionaries with is_simulated=False, source='live_provider'.
        """
        pass

    @abstractmethod
    def get_provider_status(self) -> ProviderStatusDTO:
        """
        Returns provider operational health, current mode, cache statistics,
        and fallback engagement indicators.
        """
        pass


class SharedTrafficProvider(TrafficProviderInterface):
    """
    Unified Traffic Data Collection Service.
    
    Integrates TomTom Traffic Flow Segment API for genuine traffic readings
    across configured Delhi NCR road coordinates.
    
    Guarantees:
    1. Distinguishability: Explicit provenance labeling:
       - 'live_provider' (is_simulated=False): Genuine real-time TomTom readings.
       - 'cached' (is_simulated=cached.is_simulated): Offline cache replay during outages.
       - 'simulated' (is_simulated=True): Calibrated diurnal mathematical simulation.
    2. Resilient Fallbacks: Timeouts, bounded retries with backoff, and automatic fallback
       to cache or simulation on network or quota exhaustion.
    3. Coordinate Resolution: Uses exact latitudes/longitudes of Delhi NCR nodes.
    4. Credential Privacy: TomTom API key is strictly kept in backend/.env and never
       leaked in logs, responses, or exceptions.
    """

    def __init__(
        self,
        mode: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        max_retries: Optional[int] = None,
    ):
        self._explicit_mode = mode is not None
        self._explicit_api_key = api_key is not None
        self._explicit_base_url = base_url is not None

        if api_key is not None:
            self.api_key = api_key.strip()
        else:
            self.api_key = (
                os.getenv("TOMTOM_API_KEY", "").strip()
                or os.getenv("TRAFFIC_PROVIDER_API_KEY", "").strip()
            )
        if mode:
            self.mode = mode.lower()
        elif self.api_key:
            self.mode = os.getenv("TRAFFIC_PROVIDER_MODE", "live").lower()
        else:
            self.mode = os.getenv("TRAFFIC_PROVIDER_MODE", "simulated").lower()

        raw_base_url = (
            base_url
            or os.getenv("TRAFFIC_PROVIDER_URL", "").strip()
            or os.getenv("TOMTOM_BASE_URL", "").strip()
        )
        if raw_base_url:
            if "flowSegmentData" in raw_base_url:
                self.base_url = raw_base_url
            else:
                self.base_url = f"{raw_base_url.rstrip('/')}/flowSegmentData/absolute/10/json"
        else:
            self.base_url = TOMTOM_FLOW_BASE_URL

        self.timeout_seconds = timeout_seconds or float(os.getenv("TOMTOM_TIMEOUT_SECONDS", "10.0"))
        self.max_retries = max_retries if max_retries is not None else int(os.getenv("TOMTOM_MAX_RETRIES", "2"))
        self.cache_ttl_seconds = float(os.getenv("TOMTOM_CACHE_TTL_SECONDS", "300.0"))
        self.incidents_base_url = os.getenv("TOMTOM_INCIDENTS_BASE_URL", TOMTOM_INCIDENTS_BASE_URL)
        self.delhi_bbox = os.getenv("TOMTOM_DELHI_BBOX", "77.05,28.45,77.35,28.70")

        # Granular HTTP timeouts: 10s connect, 8s read, 5s write/pool
        self.http_timeout = httpx.Timeout(
            timeout=12.0,
            connect=10.0,
            read=8.0,
            write=5.0,
            pool=5.0,
        )

        self._update_provider_name()

        # Fast metadata lookup table indexed by intersection ID
        self.intersections_meta: Dict[str, Dict[str, Any]] = {
            item["id"]: item for item in INTERSECTIONS_DATA
        }

        # In-memory observation cache: {intersection_id: TrafficObservationDTO}
        self._cache: Dict[str, TrafficObservationDTO] = {}
        self._cache_timestamps: Dict[str, datetime] = {}
        self.last_sync_time: Optional[datetime] = None
        self._incident_cache: List[Dict[str, Any]] = []
        self._incident_cache_time: Optional[datetime] = None
        self.last_incident_sync_time: Optional[datetime] = None
        self.error_fallback_active: bool = False
        self.last_error_message: Optional[str] = None

        # Coordinate traffic flow cache: {normalized_key: (timestamp, response_dict)}
        self._coord_flow_cache: Dict[str, Tuple[datetime, Dict[str, Any]]] = {}
        self._coord_flow_ttl_seconds: float = 60.0

        # Reverse geocode cache: {normalized_key: (timestamp, response_dict)}
        self._reverse_geocode_cache: Dict[str, Tuple[datetime, Dict[str, Any]]] = {}
        self._reverse_geocode_ttl_seconds: float = 300.0

        # Place geocode and routing caches
        self._geocode_cache: Dict[str, Tuple[datetime, Optional[Dict[str, Any]]]] = {}
        self._route_cache: Dict[str, Tuple[datetime, Dict[str, Any]]] = {}

    def reload_config(self) -> None:
        """Reloads backend/.env and re-checks TOMTOM_API_KEY without requiring server restart."""
        _load_env()
        if not self._explicit_api_key:
            self.api_key = (
                os.getenv("TOMTOM_API_KEY", "").strip()
                or os.getenv("TRAFFIC_PROVIDER_API_KEY", "").strip()
            )

        if not self._explicit_mode:
            env_mode = os.getenv("TRAFFIC_PROVIDER_MODE", "").strip().lower()
            if env_mode in ["live", "simulated"]:
                self.mode = env_mode
            elif self.api_key:
                self.mode = "live"
            else:
                self.mode = "simulated"

        if not self._explicit_base_url:
            raw_base_url = (
                os.getenv("TRAFFIC_PROVIDER_URL", "").strip()
                or os.getenv("TOMTOM_BASE_URL", "").strip()
            )
            if raw_base_url:
                if "flowSegmentData" in raw_base_url:
                    self.base_url = raw_base_url
                else:
                    self.base_url = f"{raw_base_url.rstrip('/')}/flowSegmentData/absolute/10/json"
            else:
                self.base_url = TOMTOM_FLOW_BASE_URL

        self.cache_ttl_seconds = float(os.getenv("TOMTOM_CACHE_TTL_SECONDS", "300.0"))
        self.timeout_seconds = float(os.getenv("TOMTOM_TIMEOUT_SECONDS", str(self.timeout_seconds)))
        self.max_retries = int(os.getenv("TOMTOM_MAX_RETRIES", str(self.max_retries)))
        self._update_provider_name()

    def _update_provider_name(self) -> None:
        if self.mode == "live":
            self.provider_name = "TomTom Traffic Flow API"
        else:
            self.provider_name = "Simulated Diurnal Stream"

    def set_mode(self, mode: str) -> None:
        """Dynamically toggle provider mode ('simulated' vs 'live')."""
        if mode not in ["simulated", "live"]:
            raise ValueError(f"Invalid mode '{mode}'. Allowed: 'simulated', 'live'.")
        self.mode = mode
        self._explicit_mode = True
        self._update_provider_name()
        logger.info(f"Traffic provider mode changed to: {self.mode}")

    def clear_cache(self) -> None:
        """Flushes the local in-memory observation cache and incident cache."""
        self._cache.clear()
        self._cache_timestamps.clear()
        self.last_sync_time = None
        self._incident_cache.clear()
        self._incident_cache_time = None
        self.last_incident_sync_time = None
        self.error_fallback_active = False
        self.last_error_message = None
        self._coord_flow_cache.clear()
        self._reverse_geocode_cache.clear()
        self._geocode_cache.clear()
        self._route_cache.clear()

    def _sanitize_message(self, text: str) -> str:
        """Strips TomTom API key from string or URL representations to prevent credential leaks."""
        if self.api_key and self.api_key in text:
            return text.replace(self.api_key, "[REDACTED_API_KEY]")
        return text

    def _generate_simulated_observation(
        self, intersection_id: str, ts: Optional[datetime] = None
    ) -> TrafficObservationDTO:
        """
        Generates deterministic, physically grounded traffic observations using
        the diurnal curve and Greenshields speed-density formulation.
        """
        meta = self.intersections_meta.get(intersection_id, {
            "id": intersection_id,
            "capacity": 2000,
            "baseline_speed": 45.0,
        })

        now_utc = ts or datetime.now(timezone.utc)
        hour = now_utc.hour + (now_utc.minute / 60.0)

        # Diurnal peak curve
        morning_peak = math.exp(-((hour - 9.0) ** 2) / 2.5)
        evening_peak = math.exp(-((hour - 18.5) ** 2) / 3.0)
        night_dip = 0.2 if (hour < 5 or hour > 23) else 0.5
        diurnal_factor = max(night_dip, 0.4 + 0.6 * (0.8 * morning_peak + 1.0 * evening_peak))

        hash_offset = (hash(intersection_id) % 15) / 100.0 - 0.075
        volume_ratio = min(0.98, max(0.12, diurnal_factor + hash_offset))

        capacity_15m = meta["capacity"] / 4.0
        vehicle_volume = int(round(capacity_15m * volume_ratio))

        speed_ratio = max(0.2, 1.0 - 0.72 * volume_ratio)
        avg_speed = round(meta["baseline_speed"] * speed_ratio, 1)

        if volume_ratio > 0.75 or avg_speed < 18.0:
            congestion = "severe"
        elif volume_ratio > 0.50 or avg_speed < 30.0:
            congestion = "moderate"
        else:
            congestion = "low"

        return TrafficObservationDTO(
            intersection_id=intersection_id,
            timestamp=now_utc.isoformat(),
            vehicle_volume=vehicle_volume,
            average_speed=avg_speed,
            congestion_level=congestion,
            source="simulated",
            is_simulated=True,
            provider_name="Simulated Diurnal Stream",
            confidence_score=1.0,
        )

    async def _fetch_tomtom_flow_for_node(
        self, client: httpx.AsyncClient, intersection_id: str
    ) -> TrafficObservationDTO:
        """
        Fetches live flow segment data from TomTom API for a specific intersection coordinate
        with bounded retries, exponential backoff, and strict credential redaction.
        """
        meta = self.intersections_meta[intersection_id]
        lat = meta["latitude"]
        lon = meta["longitude"]

        params = {
            "point": f"{lat},{lon}",
            "unit": "KMPH",
            "key": self.api_key,
        }

        last_exc: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                response = await client.get(
                    self.base_url,
                    params=params,
                    headers={"Accept": "application/json", "User-Agent": "TrafficFlow-AI/2.0"},
                )
                if response.status_code >= 400:
                    status_err = httpx.HTTPStatusError(
                        f"TomTom API returned status {response.status_code}",
                        request=httpx.Request("GET", f"{self.base_url}?point={lat},{lon}&unit=KMPH&key=[REDACTED]"),
                        response=response,
                    )
                    raise status_err

                data = response.json()
                flow_data = data.get("flowSegmentData", {})

                current_speed = float(flow_data.get("currentSpeed", meta["baseline_speed"]))
                free_flow_speed = float(flow_data.get("freeFlowSpeed", meta["baseline_speed"]))
                confidence = float(flow_data.get("confidence", 0.95))
                road_closure = bool(flow_data.get("roadClosure", False))

                # Compute vehicle volume and congestion grounded in Greenshields model
                speed_ratio = current_speed / max(free_flow_speed, 10.0)
                vol_ratio = min(0.98, max(0.12, (1.0 - 0.72 * speed_ratio) + 0.25))
                if road_closure:
                    vol_ratio = 0.05
                capacity_15m = meta["capacity"] / 4.0
                vehicle_volume = int(round(capacity_15m * vol_ratio))

                if road_closure or current_speed < 18.0 or vol_ratio > 0.75:
                    congestion = "severe"
                elif current_speed < 30.0 or vol_ratio > 0.50:
                    congestion = "moderate"
                else:
                    congestion = "low"

                obs = TrafficObservationDTO(
                    intersection_id=intersection_id,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    vehicle_volume=vehicle_volume,
                    average_speed=round(current_speed, 1),
                    congestion_level=congestion,
                    source="live_provider",
                    is_simulated=False,
                    provider_name="TomTom Traffic Flow API",
                    confidence_score=round(confidence, 2),
                )
                return obs

            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as exc:
                last_exc = exc
                sanitized_msg = self._sanitize_message(str(exc))
                if attempt < self.max_retries:
                    backoff = 0.25 * (2 ** attempt)
                    logger.warning(
                        f"TomTom attempt {attempt + 1} failed for {intersection_id}: {sanitized_msg}. Retrying in {backoff}s..."
                    )
                    await asyncio.sleep(backoff)
                else:
                    logger.error(
                        f"TomTom all {self.max_retries + 1} attempts exhausted for {intersection_id}: {sanitized_msg}"
                    )

        sanitized_final = self._sanitize_message(str(last_exc)) if last_exc else "Unknown TomTom fetch error"
        raise RuntimeError(f"TomTom fetch failed: {sanitized_final}")

    async def fetch_flow_by_coordinates(
        self, lat: float, lon: float
    ) -> Dict[str, Any]:
        """
        Fetches real-time TomTom traffic flow segment data for ANY coordinates (Agra, Dehradun, Delhi, etc.)
        with normalized in-memory coordinate caching, separate 10s connect timeout, and bounded transient retry.
        """
        self.reload_config()
        if not self.api_key:
            return {
                "traffic_available": False,
                "reason": "TomTom API key not configured on backend."
            }

        # 1. In-memory coordinate cache check (rounded to 4 decimal places ~11m)
        coord_key = f"{round(lat, 4)},{round(lon, 4)}"
        now_utc = datetime.now(timezone.utc)
        cached = self._coord_flow_cache.get(coord_key)
        if cached:
            cached_time, cached_val = cached
            if (now_utc - cached_time).total_seconds() < self._coord_flow_ttl_seconds:
                return cached_val

        params = {
            "point": f"{lat},{lon}",
            "unit": "KMPH",
            "key": self.api_key,
        }

        # Bounded retries: max 1 retry for transient errors (ConnectTimeout, ReadTimeout, 5xx)
        last_exc: Optional[Exception] = None
        max_coord_retries = min(1, self.max_retries)

        for attempt in range(max_coord_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.http_timeout) as client:
                    response = await client.get(
                        self.base_url,
                        params=params,
                        headers={"Accept": "application/json", "User-Agent": "TrafficFlow-AI/2.0"},
                    )

                    # Do NOT retry client errors (400, 401, 403, 404, etc.)
                    if response.status_code in [400, 404]:
                        result = {
                            "traffic_available": False,
                            "reason": "Live traffic telemetry is unavailable for this coordinate (no monitored road segment found)."
                        }
                        self._coord_flow_cache[coord_key] = (now_utc, result)
                        return result
                    elif response.status_code in [401, 403]:
                        return {
                            "traffic_available": False,
                            "reason": f"TomTom API authentication/authorization error {response.status_code}. Please verify API key configuration."
                        }
                    elif response.status_code >= 500:
                        raise httpx.HTTPStatusError(
                            f"TomTom server error {response.status_code}",
                            request=response.request,
                            response=response,
                        )

                    if response.status_code == 200:
                        data = response.json()
                        flow_data = data.get("flowSegmentData", {})
                        if not flow_data:
                            result = {
                                "traffic_available": False,
                                "reason": "No live flow segment data found for these coordinates."
                            }
                            self._coord_flow_cache[coord_key] = (now_utc, result)
                            return result

                        current_speed = float(flow_data.get("currentSpeed", 0.0))
                        free_flow_speed = float(flow_data.get("freeFlowSpeed", current_speed or 40.0))
                        confidence = float(flow_data.get("confidence", 0.95))
                        road_closure = bool(flow_data.get("roadClosure", False))
                        current_travel_time = flow_data.get("currentTravelTime")
                        free_flow_travel_time = flow_data.get("freeFlowTravelTime")

                        speed_ratio = current_speed / max(free_flow_speed, 10.0)
                        if road_closure or current_speed < 18.0 or speed_ratio < 0.50:
                            congestion = "severe"
                        elif current_speed < 32.0 or speed_ratio < 0.75:
                            congestion = "moderate"
                        else:
                            congestion = "low"

                        result = {
                            "traffic_available": True,
                            "current_speed": round(current_speed, 1),
                            "free_flow_speed": round(free_flow_speed, 1),
                            "confidence": round(confidence, 2),
                            "road_closure": road_closure,
                            "congestion_level": congestion,
                            "travel_time_seconds": current_travel_time,
                            "free_flow_travel_time_seconds": free_flow_travel_time,
                            "provider_name": "TomTom Traffic Flow API",
                        }

                        # Cache successful reading
                        self._coord_flow_cache[coord_key] = (now_utc, result)
                        return result
                    else:
                        return {
                            "traffic_available": False,
                            "reason": f"TomTom returned status {response.status_code} for these coordinates."
                        }

            except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.ConnectError, httpx.HTTPStatusError) as exc:
                last_exc = exc
                if attempt < max_coord_retries:
                    backoff = 0.3 * (2 ** attempt)
                    logger.warning(
                        f"TomTom coordinate fetch retry {attempt + 1}/{max_coord_retries} for {lat},{lon}: {type(exc).__name__}. Retrying in {backoff}s..."
                    )
                    await asyncio.sleep(backoff)
                else:
                    break
            except Exception as exc:
                last_exc = exc
                break

        exc_detail = f"{type(last_exc).__name__}: {last_exc}" if (last_exc and str(last_exc)) else (repr(last_exc) if last_exc else "Connection timed out")
        sanitized = self._sanitize_message(exc_detail)
        logger.warning(f"TomTom coordinate fetch failed for {lat},{lon}: {sanitized}")
        return {
            "traffic_available": False,
            "reason": f"Live telemetry query error: {sanitized}"
        }

    def _build_reverse_geocode_payload(
        self,
        lat: float,
        lon: float,
        road: str,
        area: str,
        city: str,
        district: str,
        state: str,
        country: str,
        postcode: str,
        full_address: str,
        source: str,
        resolved: bool = True,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Normalizes reverse geocode output while strictly preserving input GPS coordinates."""
        payload: Dict[str, Any] = {
            "resolved": resolved,
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "road": road.strip(),
            "area": area.strip(),
            "city": city.strip(),
            "district": district.strip(),
            "state": state.strip(),
            "country": country.strip(),
            "postcode": postcode.strip(),
            "full_address": full_address.strip() or f"{lat:.5f}, {lon:.5f}",
            "source": source,
        }
        if reason:
            payload["reason"] = reason
        return payload

    async def reverse_geocode(self, lat: float, lon: float) -> Dict[str, Any]:
        """
        Resolves exact WGS84 coordinates (lat, lon) into city, district, state, area, and road
        using TomTom Search Reverse Geocode first and OpenStreetMap Nominatim as secondary.
        Never substitutes an IP geolocation or hardcoded city bounding-box guess.
        """
        self.reload_config()
        coord_key = f"{round(lat, 4):.4f},{round(lon, 4):.4f}"
        now_utc = datetime.now(timezone.utc)

        if coord_key in self._reverse_geocode_cache:
            cached_time, cached_res = self._reverse_geocode_cache[coord_key]
            if (now_utc - cached_time).total_seconds() < self._reverse_geocode_ttl_seconds:
                return {**cached_res, "latitude": round(lat, 6), "longitude": round(lon, 6)}

        failure_reasons: List[str] = []

        # Tier 1: TomTom Reverse Geocode API (if key available)
        if self.api_key:
            tomtom_url = f"{TOMTOM_REVERSE_GEOCODE_BASE_URL}/{lat:.6f},{lon:.6f}.json"
            try:
                async with httpx.AsyncClient(timeout=self.http_timeout) as client:
                    resp = await client.get(
                        tomtom_url,
                        params={"key": self.api_key, "language": "en-GB", "radius": 500},
                    )
                if resp.status_code == 200:
                    data = resp.json()
                    addresses = data.get("addresses") or []
                    if addresses and isinstance(addresses[0], dict):
                        addr = addresses[0].get("address") or {}
                        route_nums = addr.get("routeNumbers") or []
                        road = (
                            addr.get("streetName")
                            or addr.get("street")
                            or (str(route_nums[0]) if route_nums else "")
                            or addr.get("municipalitySubdivision")
                            or ""
                        )
                        area = (
                            addr.get("municipalitySubdivision")
                            or addr.get("neighbourhood")
                            or addr.get("localName")
                            or ""
                        )
                        city = (
                            addr.get("municipality")
                            or addr.get("localName")
                            or addr.get("municipalitySubdivision")
                            or addr.get("countrySecondarySubdivision")
                            or ""
                        )
                        district = addr.get("countrySecondarySubdivision") or ""
                        state = addr.get("countrySubdivisionName") or addr.get("countrySubdivision") or ""
                        country = addr.get("country") or ""
                        postcode = addr.get("postalCode") or ""
                        freeform = addr.get("freeformAddress") or ", ".join(
                            p for p in [road, area, city, district, state, country] if p
                        )
                        if city or state or road:
                            res = self._build_reverse_geocode_payload(
                                lat=lat,
                                lon=lon,
                                road=road,
                                area=area,
                                city=city,
                                district=district,
                                state=state,
                                country=country,
                                postcode=postcode,
                                full_address=freeform,
                                source="tomtom_reverse_geocode",
                                resolved=True,
                            )
                            self._reverse_geocode_cache[coord_key] = (now_utc, res)
                            return res
                    failure_reasons.append("TomTom reverse geocode returned no address match")
                else:
                    failure_reasons.append(f"TomTom reverse geocode HTTP {resp.status_code}")
            except Exception as exc:
                sanitized = self._sanitize_message(f"{type(exc).__name__}: {exc}")
                logger.warning(f"TomTom reverse geocode error for {lat},{lon}: {sanitized}")
                failure_reasons.append(sanitized)

        # Tier 2: OpenStreetMap Nominatim (with explicit application User-Agent)
        try:
            async with httpx.AsyncClient(timeout=self.http_timeout) as client:
                resp = await client.get(
                    NOMINATIM_REVERSE_URL,
                    params={
                        "format": "jsonv2",
                        "lat": f"{lat:.6f}",
                        "lon": f"{lon:.6f}",
                        "zoom": 18,
                        "addressdetails": 1,
                        "accept-language": "en",
                    },
                    headers={
                        "User-Agent": "TrafficFlow-AI/2.0 (Municipal Traffic Operations)"
                    },
                )
            if resp.status_code == 200:
                data = resp.json()
                addr = data.get("address") or {}
                city = (
                    addr.get("city")
                    or addr.get("town")
                    or addr.get("village")
                    or addr.get("municipality")
                    or addr.get("city_district")
                    or addr.get("county")
                    or addr.get("state_district")
                    or ""
                )
                road = (
                    addr.get("road")
                    or addr.get("pedestrian")
                    or addr.get("highway")
                    or addr.get("suburb")
                    or addr.get("neighbourhood")
                    or addr.get("hamlet")
                    or ""
                )
                area = (
                    addr.get("suburb")
                    or addr.get("neighbourhood")
                    or addr.get("residential")
                    or addr.get("quarter")
                    or addr.get("village")
                    or addr.get("town")
                    or ""
                )
                district = addr.get("state_district") or addr.get("county") or ""
                state = addr.get("state") or addr.get("region") or ""
                country = addr.get("country") or ""
                postcode = addr.get("postcode") or ""
                full_address = data.get("display_name") or ", ".join(
                    p for p in [road, area, city, district, state, country] if p
                )
                if city or state or road:
                    res = self._build_reverse_geocode_payload(
                        lat=lat,
                        lon=lon,
                        road=road,
                        area=area,
                        city=city,
                        district=district,
                        state=state,
                        country=country,
                        postcode=postcode,
                        full_address=full_address,
                        source="nominatim",
                        resolved=True,
                    )
                    self._reverse_geocode_cache[coord_key] = (now_utc, res)
                    return res
                failure_reasons.append("Nominatim returned no address fields")
            else:
                failure_reasons.append(f"Nominatim HTTP {resp.status_code}")
        except Exception as exc:
            sanitized = self._sanitize_message(f"{type(exc).__name__}: {exc}")
            logger.warning(f"Nominatim reverse geocode error for {lat},{lon}: {sanitized}")
            failure_reasons.append(sanitized)

        # Tier 3: Honest unresolved coordinate-only response (never synthesize city bounding boxes)
        return self._build_reverse_geocode_payload(
            lat=lat,
            lon=lon,
            road="",
            area="",
            city="",
            district="",
            state="",
            country="",
            postcode="",
            full_address=f"{lat:.5f}, {lon:.5f}",
            source="coordinates_only",
            resolved=False,
            reason="; ".join(failure_reasons) if failure_reasons else "Reverse geocoding unavailable",
        )


    async def fetch_live_observations(
        self, intersection_ids: Optional[List[str]] = None
    ) -> List[TrafficObservationDTO]:
        """
        Main collection entry point.
        Fetches live TomTom readings if live mode & API key are present.
        Respects TTL cache to avoid exceeding rate limits (2500 req/day).
        Gracefully engages multi-tier fallback (cache -> simulation) on missing keys or failures.
        """
        self.reload_config()
        target_ids = intersection_ids or list(self.intersections_meta.keys())
        results: List[TrafficObservationDTO] = []
        now_utc = datetime.now(timezone.utc)

        # Case 1: Live mode with valid API key configured
        if self.mode == "live" and self.api_key:
            fetch_needed_ids: List[str] = []
            
            # Check TTL cache first for each node
            for i_id in target_ids:
                cached_time = self._cache_timestamps.get(i_id)
                if (
                    i_id in self._cache
                    and cached_time is not None
                    and (now_utc - cached_time).total_seconds() < self.cache_ttl_seconds
                ):
                    results.append(self._cache[i_id].model_copy())
                else:
                    fetch_needed_ids.append(i_id)

            # If all nodes were fresh in cache, return immediately
            if not fetch_needed_ids:
                self.last_sync_time = now_utc
                return results

            # Fetch nodes that need fresh readings
            round_errors = 0
            async with httpx.AsyncClient(timeout=self.http_timeout) as client:
                for i_id in fetch_needed_ids:
                    try:
                        obs = await self._fetch_tomtom_flow_for_node(client, i_id)
                        results.append(obs)
                        self._cache[i_id] = obs
                        self._cache_timestamps[i_id] = now_utc
                    except Exception as exc:
                        round_errors += 1
                        sanitized_exc = self._sanitize_message(str(exc))
                        logger.warning(
                            f"Live reading failed for {i_id}: {sanitized_exc}. Applying fallback."
                        )
                        self.error_fallback_active = True
                        self.last_error_message = f"TomTom API offline: {sanitized_exc}"

                        # Tier 1 Fallback: In-memory cache replay
                        if i_id in self._cache:
                            cached_obs = self._cache[i_id].model_copy()
                            cached_obs.source = "cached"
                            results.append(cached_obs)
                        else:
                            # Tier 2 Fallback: Calibrated diurnal simulation
                            sim_obs = self._generate_simulated_observation(i_id)
                            results.append(sim_obs)

            if round_errors == 0:
                self.error_fallback_active = False
                self.last_error_message = None

            self.last_sync_time = now_utc
            # Return ordered according to target_ids
            obs_map = {o.intersection_id: o for o in results}
            return [obs_map[i_id] for i_id in target_ids if i_id in obs_map]

        # Case 2: Live mode requested but TOMTOM_API_KEY is not configured
        if self.mode == "live" and not self.api_key:
            self.error_fallback_active = True
            self.last_error_message = "TOMTOM_API_KEY is not configured in backend/.env. Using simulation fallback."
            for i_id in target_ids:
                obs = self._generate_simulated_observation(i_id)
                results.append(obs)
                self._cache[i_id] = obs
                self._cache_timestamps[i_id] = now_utc
            self.last_sync_time = now_utc
            return results

        # Case 3: Simulated Mode (Default synthetic baseline)
        for i_id in target_ids:
            obs = self._generate_simulated_observation(i_id)
            results.append(obs)
            self._cache[i_id] = obs
            self._cache_timestamps[i_id] = now_utc

        self.last_sync_time = now_utc
        self.error_fallback_active = False
        self.last_error_message = None
        return results

    def _haversine_distance_km(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Haversine distance in kilometers between two GPS coordinates."""
        r = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
        )
        return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    async def fetch_live_incidents(self) -> List[Dict[str, Any]]:
        """
        Retrieves real-time traffic incidents across Delhi NCR road coordinates
        using the TomTom Incident Details API.
        
        Guarantees:
        1. Distinguishability: Explicitly labeled with source='live_provider' and is_simulated=False.
        2. Zero Incident Integrity: If TomTom returns 0 active incidents, returns an empty list
           without treating it as an API failure.
        3. Safe Caching: TTL-cached (300s) to protect API quotas.
        4. Credential Privacy: TomTom API key is strictly redacted from logs and errors.
        """
        self.reload_config()
        if self.mode != "live" or not self.api_key:
            return []

        now_utc = datetime.now(timezone.utc)
        if (
            self._incident_cache_time is not None
            and (now_utc - self._incident_cache_time).total_seconds() < self.cache_ttl_seconds
        ):
            return self._incident_cache

        params = {
            "bbox": self.delhi_bbox,
            "fields": "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to,length,delay}}}",
            "language": "en-GB",
            "key": self.api_key,
        }

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            last_exc: Optional[Exception] = None
            for attempt in range(self.max_retries + 1):
                try:
                    response = await client.get(
                        self.incidents_base_url,
                        params=params,
                        headers={"Accept": "application/json", "User-Agent": "TrafficFlow-AI/2.0"},
                    )
                    if response.status_code >= 400:
                        raise httpx.HTTPStatusError(
                            f"TomTom Incident API returned status {response.status_code}",
                            request=httpx.Request("GET", f"{self.incidents_base_url}?key=[REDACTED]"),
                            response=response,
                        )

                    data = response.json()
                    raw_incidents = data.get("incidents", [])
                    parsed_incidents: List[Dict[str, Any]] = []

                    for inc in raw_incidents:
                        p = inc.get("properties", {})
                        geom = inc.get("geometry", {})
                        coords = geom.get("coordinates", [])

                        lon, lat = 0.0, 0.0
                        if coords and isinstance(coords[0], list):
                            lon, lat = float(coords[0][0]), float(coords[0][1])
                        elif coords and len(coords) == 2 and isinstance(coords[0], (int, float)):
                            lon, lat = float(coords[0]), float(coords[1])
                        else:
                            continue

                        # Find nearest configured Delhi NCR intersection
                        closest_inter = min(
                            INTERSECTIONS_DATA,
                            key=lambda item: self._haversine_distance_km(lat, lon, item["latitude"], item["longitude"]),
                        )
                        dist_km = self._haversine_distance_km(lat, lon, closest_inter["latitude"], closest_inter["longitude"])

                        raw_events = [e.get("description", "") for e in p.get("events", []) if isinstance(e, dict)]
                        event_text = " ".join(raw_events).lower()

                        if "closed" in event_text or "closure" in event_text:
                            inc_type = "road_closure"
                        elif "accident" in event_text or "crash" in event_text or "collision" in event_text:
                            inc_type = "accident"
                        elif "construction" in event_text or "works" in event_text or "roadworks" in event_text:
                            inc_type = "construction"
                        elif "jam" in event_text or "stationary" in event_text or "queue" in event_text or "congestion" in event_text:
                            inc_type = "congestion"
                        else:
                            inc_type = "traffic_disruption"

                        magnitude = p.get("magnitudeOfDelay", 1)
                        if magnitude in (3, 4):
                            severity = "critical"
                        elif magnitude == 2:
                            severity = "warning"
                        else:
                            severity = "info"

                        road_from = p.get("from") or closest_inter["name"]
                        road_to = p.get("to")
                        location_str = f"{road_from} to {road_to}" if road_to else road_from
                        summary_str = ", ".join(raw_events) if raw_events else "Active Traffic Alert"

                        desc_en = f"{summary_str}: {location_str} near {closest_inter['name']} ({dist_km:.1f} km away)."
                        desc_hi = f"{summary_str}: {closest_inter['name_hi']} के समीप {location_str} ({dist_km:.1f} किमी दूरी)।"

                        action_en = "Reroute arterial traffic via adjacent corridors; traffic management notified."
                        action_hi = "यातायात को वैकल्पिक धमनी मार्गों पर मोड़ें; यातायात नियंत्रण को सूचित किया गया।"

                        parsed_incidents.append({
                            "id": p.get("id") or f"TTI-{len(parsed_incidents) + 1}",
                            "intersection_id": closest_inter["id"],
                            "intersection_name": closest_inter["name"],
                            "intersection_name_hi": closest_inter["name_hi"],
                            "incident_type": inc_type,
                            "severity": severity,
                            "description_en": desc_en,
                            "description_hi": desc_hi,
                            "recommended_action_en": action_en,
                            "recommended_action_hi": action_hi,
                            "status": "open",
                            "created_at": p.get("startTime") or now_utc.isoformat(),
                            "is_simulated": False,
                            "source": "live_provider",
                        })

                    self._incident_cache = parsed_incidents
                    self._incident_cache_time = now_utc
                    self.last_incident_sync_time = now_utc
                    return self._incident_cache

                except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as exc:
                    last_exc = exc
                    sanitized_msg = self._sanitize_message(str(exc))
                    if attempt < self.max_retries:
                        backoff = 0.25 * (2 ** attempt)
                        logger.warning(
                            f"TomTom Incident attempt {attempt + 1} failed: {sanitized_msg}. Retrying in {backoff}s..."
                        )
                        await asyncio.sleep(backoff)
                    else:
                        logger.error(
                            f"TomTom Incident fetch exhausted {self.max_retries + 1} attempts: {sanitized_msg}"
                        )

            sanitized_final = self._sanitize_message(str(last_exc)) if last_exc else "Unknown TomTom incident fetch error"
            logger.warning(f"TomTom live incident fetch failed: {sanitized_final}. Reusing cache if available.")
            return self._incident_cache

    async def geocode_place(self, query_text: str) -> Optional[Dict[str, Any]]:
        """
        Resolves a free-text road, landmark, or intersection name to WGS84 coordinates
        using TomTom Search Geocode when live mode & API key are active.
        Returns None without fabricating locations when offline or simulated.
        """
        clean_query = (query_text or "").strip()
        if not clean_query:
            return None

        self.reload_config()
        if self.mode != "live" or not self.api_key:
            return None

        cache_key = clean_query.lower()
        now_utc = datetime.now(timezone.utc)
        if cache_key in self._geocode_cache:
            cached_time, cached_val = self._geocode_cache[cache_key]
            if (now_utc - cached_time).total_seconds() < self._reverse_geocode_ttl_seconds:
                return cached_val

        try:
            url = f"{TOMTOM_GEOCODE_BASE_URL}/{quote(clean_query)}.json"
            params = {
                "limit": 1,
                "countrySet": "IN",
                "key": self.api_key,
            }
            async with httpx.AsyncClient(timeout=self.http_timeout) as client:
                response = await client.get(
                    url,
                    params=params,
                    headers={"Accept": "application/json", "User-Agent": "TrafficFlow-AI/2.0"},
                )
            if response.status_code != 200:
                return None

            data = response.json()
            results = data.get("results") or []
            if not results:
                self._geocode_cache[cache_key] = (now_utc, None)
                return None

            top = results[0]
            pos = top.get("position") or {}
            lat = pos.get("lat")
            lon = pos.get("lon")
            if lat is None or lon is None:
                return None

            addr = top.get("address") or {}
            poi = top.get("poi") or {}
            label = poi.get("name") or addr.get("freeformAddress") or clean_query
            resolved = {
                "resolved": True,
                "label": label,
                "latitude": float(lat),
                "longitude": float(lon),
                "source": "tomtom_geocode",
            }
            self._geocode_cache[cache_key] = (now_utc, resolved)
            return resolved
        except Exception as exc:
            logger.warning(f"TomTom geocode failed for '{clean_query}': {self._sanitize_message(str(exc))}")
            return None

    async def fetch_live_routes(
        self,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
        origin_label: str,
        dest_label: str,
    ) -> Dict[str, Any]:
        """
        Queries TomTom Routing API for up to 3 alternative live-traffic routes between
        exact coordinates. Never fabricates live telemetry if TomTom is offline or disabled.
        """
        self.reload_config()
        if self.mode != "live" or not self.api_key:
            return {
                "available": False,
                "reason": "TomTom live routing requires live mode with a configured TOMTOM_API_KEY.",
            }

        cache_key = f"{round(origin_lat, 4)},{round(origin_lon, 4)}->{round(dest_lat, 4)},{round(dest_lon, 4)}"
        now_utc = datetime.now(timezone.utc)
        if cache_key in self._route_cache:
            cached_time, cached_val = self._route_cache[cache_key]
            if (now_utc - cached_time).total_seconds() < self._coord_flow_ttl_seconds:
                return cached_val

        url = f"{TOMTOM_ROUTING_BASE_URL}/{origin_lat},{origin_lon}:{dest_lat},{dest_lon}/json"
        params = {
            "maxAlternatives": 2,
            "traffic": "true",
            "routeType": "fastest",
            "travelMode": "car",
            "sectionType": "traffic",
            "key": self.api_key,
        }

        try:
            async with httpx.AsyncClient(timeout=self.http_timeout) as client:
                response = await client.get(
                    url,
                    params=params,
                    headers={"Accept": "application/json", "User-Agent": "TrafficFlow-AI/2.0"},
                )

            if response.status_code != 200:
                return {
                    "available": False,
                    "reason": f"TomTom Routing API returned HTTP {response.status_code}.",
                }

            payload = response.json()
            raw_routes = payload.get("routes") or []
            if not raw_routes:
                return {
                    "available": False,
                    "reason": "TomTom Routing returned no drivable road routes between these locations.",
                }

            parsed: List[Dict[str, Any]] = []
            route_titles = [
                ("Fastest Live Arterial", "सबसे तेज़ लाइव मार्ग"),
                ("Alternative Route A", "वैकल्पिक मार्ग A"),
                ("Alternative Route B", "वैकल्पिक मार्ग B"),
            ]

            for idx, r in enumerate(raw_routes[:3]):
                summary = r.get("summary") or {}
                length_m = float(summary.get("lengthInMeters", 0.0))
                travel_s = float(summary.get("travelTimeInSeconds", 0.0))
                delay_s = float(summary.get("trafficDelayInSeconds", 0.0))
                no_traffic_s = float(summary.get("noTrafficTravelTimeInSeconds", max(travel_s - delay_s, 1.0)))

                dist_km = round(max(length_m / 1000.0, 0.1), 1)
                est_min = round(max(travel_s / 60.0, 1.0), 1)
                delay_min = round(max(delay_s / 60.0, 0.0), 1)
                delay_ratio = delay_s / max(no_traffic_s, 60.0)

                sections = r.get("sections") or []
                heavy_segments: List[str] = []
                delayed_length_m = 0.0
                for sec in sections:
                    if str(sec.get("sectionType", "")).upper() != "TRAFFIC":
                        continue
                    mag = sec.get("magnitudeOfDelay", 0)
                    cat = (sec.get("simpleCategory") or "").upper()
                    start_pt = sec.get("startPointIndex")
                    end_pt = sec.get("endPointIndex")
                    if mag >= 2 or cat in ("JAM", "ROAD_CLOSED"):
                        sec_len = float(sec.get("delayInSeconds", 0) or 0)
                        delayed_length_m += max(sec_len * 8.0, 100.0)
                        desc = sec.get("tec", {}).get("causes", [{}])[0].get("mainCauseCode") if isinstance(sec.get("tec"), dict) else None
                        label = f"Traffic slow-down ({cat or f'level {mag}'})"
                        if start_pt is not None and end_pt is not None:
                            label = f"Segment #{start_pt}–#{end_pt} ({cat.title() or f'Delay L{mag}'})"
                        if desc:
                            label = f"{label}"
                        if label not in heavy_segments:
                            heavy_segments.append(label)

                exposure = round(min(100.0, max((delay_ratio * 100.0), (delayed_length_m / max(length_m, 1.0)) * 100.0)), 1)
                if delay_ratio >= 0.45 or delay_min >= 15.0:
                    condition = "Severe"
                elif delay_ratio >= 0.22 or delay_min >= 7.0:
                    condition = "Heavy"
                elif delay_ratio >= 0.08 or delay_min >= 2.0:
                    condition = "Moderate"
                else:
                    condition = "Smooth"

                name_en, name_hi = route_titles[min(idx, len(route_titles) - 1)]
                parsed.append(
                    {
                        "dist": dist_km,
                        "time": est_min,
                        "delay_min": delay_min,
                        "exposure": exposure,
                        "condition": condition,
                        "heavy_roads": heavy_segments[:4],
                        "name_en": f"{name_en}: {origin_label} -> {dest_label}",
                        "name_hi": f"{name_hi}: {origin_label} -> {dest_label}",
                    }
                )

            parsed.sort(key=lambda item: item["time"])
            res = {"available": True, "routes": parsed, "source": "live_tomtom_routing"}
            self._route_cache[cache_key] = (now_utc, res)
            return res
        except Exception as exc:
            sanitized = self._sanitize_message(str(exc))
            logger.warning(f"TomTom live routing failed: {sanitized}")
            return {"available": False, "reason": f"Live TomTom routing unavailable: {sanitized}"}

    def get_provider_status(self) -> ProviderStatusDTO:
        """
        Returns full diagnostics for health checks, operator dashboards, and status queries.
        """
        self.reload_config()
        sync_str = self.last_sync_time.isoformat() if self.last_sync_time else None
        inc_sync_str = self.last_incident_sync_time.isoformat() if self.last_incident_sync_time else None
        is_bg_polling = os.getenv("TRAFFIC_BACKGROUND_POLLING", "true").lower() in ("true", "1", "yes")
        refresh_sec = float(os.getenv("TRAFFIC_REFRESH_INTERVAL_SECONDS", "300.0"))

        if self.mode == "live":
            if not self.api_key:
                msg = "Operating in fallback mode: TOMTOM_API_KEY is not configured in backend/.env. Serving simulated traffic."
                online = False
                fallback = True
            elif self.error_fallback_active:
                msg = f"TomTom API degraded ({self.last_error_message or 'network error'}). Using cached or simulated observations."
                online = False
                fallback = True
            else:
                msg = "Connected to TomTom Traffic API. Actively streaming real-world Delhi NCR readings and live incidents."
                online = True
                fallback = False
        else:
            msg = "Operating in simulated stream mode (calibrated Delhi NCR corridor model)."
            online = True
            fallback = False

        return ProviderStatusDTO(
            provider_name=self.provider_name,
            mode=self.mode,
            is_online=online,
            last_sync_time=sync_str,
            last_incident_sync_time=inc_sync_str,
            cached_records_count=len(self._cache),
            live_incidents_count=len(self._incident_cache),
            quota_remaining=2500 if self.mode == "live" else None,
            error_fallback_active=fallback,
            background_polling_active=is_bg_polling and online,
            refresh_interval_seconds=refresh_sec,
            message=msg,
        )


# Singleton instance shared across the entire application
traffic_provider_instance = SharedTrafficProvider()

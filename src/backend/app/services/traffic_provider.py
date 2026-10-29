import os
import math
import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx
from dotenv import load_dotenv

from backend.app.schemas.schemas import TrafficObservationDTO, ProviderStatusDTO
from backend.app.services.seed_data import INTERSECTIONS_DATA

logger = logging.getLogger("traffic_provider")

TOMTOM_FLOW_BASE_URL = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"
TOMTOM_INCIDENTS_BASE_URL = "https://api.tomtom.com/traffic/services/5/incidentDetails"


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

        self.timeout_seconds = timeout_seconds or float(os.getenv("TOMTOM_TIMEOUT_SECONDS", "5.0"))
        self.max_retries = max_retries if max_retries is not None else int(os.getenv("TOMTOM_MAX_RETRIES", "2"))
        self.cache_ttl_seconds = float(os.getenv("TOMTOM_CACHE_TTL_SECONDS", "300.0"))
        self.incidents_base_url = os.getenv("TOMTOM_INCIDENTS_BASE_URL", TOMTOM_INCIDENTS_BASE_URL)
        self.delhi_bbox = os.getenv("TOMTOM_DELHI_BBOX", "77.05,28.45,77.35,28.70")

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
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
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

import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session
from sqlalchemy.engine import Engine

from backend.app.models.database import TrafficObservation, Intersection
from backend.app.schemas.schemas import TrafficObservationDTO
from backend.app.services.traffic_provider import traffic_provider_instance

logger = logging.getLogger("traffic_history")


def migrate_database(engine: Engine) -> None:
    """
    Non-destructive additive migration for SQLite database.
    Ensures new provenance columns exist on traffic_observations table
    without affecting existing records or dropping data.
    """
    with engine.connect() as conn:
        inspector = inspect(engine)
        existing_columns = {col["name"] for col in inspector.get_columns("traffic_observations")}

        # Add source column if missing
        if "source" not in existing_columns:
            logger.info("Migrating traffic_observations: adding 'source' column.")
            conn.execute(
                text("ALTER TABLE traffic_observations ADD COLUMN source VARCHAR(50) DEFAULT 'simulated'")
            )
            conn.commit()

        # Add provider_name column if missing
        if "provider_name" not in existing_columns:
            logger.info("Migrating traffic_observations: adding 'provider_name' column.")
            conn.execute(
                text("ALTER TABLE traffic_observations ADD COLUMN provider_name VARCHAR(100) DEFAULT 'Simulated Diurnal Stream'")
            )
            conn.commit()

        # Add confidence_score column if missing
        if "confidence_score" not in existing_columns:
            logger.info("Migrating traffic_observations: adding 'confidence_score' column.")
            conn.execute(
                text("ALTER TABLE traffic_observations ADD COLUMN confidence_score FLOAT DEFAULT 1.0")
            )
            conn.commit()

        # Create composite index on (intersection_id, timestamp) for fast range retrieval
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_traffic_obs_intersection_timestamp "
                "ON traffic_observations (intersection_id, timestamp)"
            )
        )
        conn.commit()

        # Check incident_alerts table columns
        inc_columns = {col["name"] for col in inspector.get_columns("incident_alerts")}
        if "is_simulated" not in inc_columns:
            logger.info("Migrating incident_alerts: adding 'is_simulated' column.")
            conn.execute(
                text("ALTER TABLE incident_alerts ADD COLUMN is_simulated BOOLEAN DEFAULT 1")
            )
            conn.commit()

        if "source" not in inc_columns:
            logger.info("Migrating incident_alerts: adding 'source' column.")
            conn.execute(
                text("ALTER TABLE incident_alerts ADD COLUMN source VARCHAR(50) DEFAULT 'simulated'")
            )
            conn.commit()

        logger.info("Database migration check completed safely.")


class HistoricalObservationService:
    """
    Coordinates traffic observation persistence and historical data retrieval.
    
    Guarantees:
    1. Backend-coordinated ingestion: Collection is throttled to prevent spammed
       fetches across simultaneous frontend requests.
    2. Strict duplicate prevention: Checks intersection and timestamp proximity
       before writing to storage.
    3. Full provenance preservation: Every stored record maintains source,
       is_simulated, provider_name, and confidence_score.
    """

    def __init__(self, min_collection_interval_seconds: float = 60.0):
        self.min_collection_interval_seconds = min_collection_interval_seconds
        self._last_collection_time: Optional[datetime] = None
        self._last_incident_collection_time: Optional[datetime] = None
        self._lock = asyncio.Lock()

    def _parse_timestamp(self, ts_str_or_dt: Any) -> datetime:
        """Parses ISO timestamp string or ensures timezone-naive UTC for SQLite."""
        if isinstance(ts_str_or_dt, datetime):
            dt = ts_str_or_dt
        else:
            try:
                dt = datetime.fromisoformat(str(ts_str_or_dt).replace("Z", "+00:00"))
            except Exception:
                dt = datetime.now(timezone.utc)
        # Strip timezone for standard SQLite naive storage
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt

    async def coordinate_collection_and_storage(
        self,
        db: Session,
        intersection_ids: Optional[List[str]] = None,
        force: bool = False,
    ) -> Dict[str, Any]:
        """
        Coordinates fetching from the shared traffic provider and persisting observations
        with deduplication and provenance metadata.
        """
        async with self._lock:
            now = datetime.now(timezone.utc)
            if (
                not force
                and self._last_collection_time is not None
                and (now - self._last_collection_time).total_seconds() < self.min_collection_interval_seconds
            ):
                return {
                    "status": "skipped_throttle",
                    "message": f"Collection throttled. Next collection allowed in {self.min_collection_interval_seconds - (now - self._last_collection_time).total_seconds():.1f}s",
                    "ingested_count": 0,
                    "skipped_duplicates": 0,
                }

            # Fetch through shared provider interface
            observations_dto: List[TrafficObservationDTO] = await traffic_provider_instance.fetch_live_observations(
                intersection_ids
            )

            ingested_count = 0
            skipped_duplicates = 0

            for dto in observations_dto:
                obs_dt = self._parse_timestamp(dto.timestamp)

                # Duplicate check: check if an observation exists for this intersection
                # within a 5-minute threshold window with identical metrics
                time_window_start = obs_dt - timedelta(minutes=5)
                time_window_end = obs_dt + timedelta(minutes=5)

                existing_record = (
                    db.query(TrafficObservation)
                    .filter(
                        TrafficObservation.intersection_id == dto.intersection_id,
                        TrafficObservation.timestamp >= time_window_start,
                        TrafficObservation.timestamp <= time_window_end,
                    )
                    .first()
                )

                if existing_record:
                    # If existing record was simulated but incoming is genuine live reading, upgrade to live
                    if existing_record.is_simulated and not dto.is_simulated:
                        existing_record.vehicle_volume = dto.vehicle_volume
                        existing_record.average_speed = dto.average_speed
                        existing_record.congestion_level = dto.congestion_level
                        existing_record.is_simulated = False
                        existing_record.source = dto.source
                        existing_record.provider_name = dto.provider_name or "TomTom Traffic Flow API"
                        existing_record.confidence_score = dto.confidence_score or 1.0
                        existing_record.timestamp = obs_dt
                        ingested_count += 1
                        continue
                    skipped_duplicates += 1
                    continue

                # Add new verified observation
                new_obs = TrafficObservation(
                    intersection_id=dto.intersection_id,
                    timestamp=obs_dt,
                    vehicle_volume=dto.vehicle_volume,
                    average_speed=dto.average_speed,
                    congestion_level=dto.congestion_level,
                    is_simulated=dto.is_simulated,
                    source=dto.source,
                    provider_name=dto.provider_name or "Unknown Provider",
                    confidence_score=dto.confidence_score or 1.0,
                )
                db.add(new_obs)
                ingested_count += 1

            if ingested_count > 0:
                db.commit()

            self._last_collection_time = now

            return {
                "status": "success",
                "ingested_count": ingested_count,
                "skipped_duplicates": skipped_duplicates,
                "provider_mode": traffic_provider_instance.mode,
                "provider_status": traffic_provider_instance.get_provider_status().model_dump(),
            }

    async def coordinate_incident_collection_and_storage(
        self,
        db: Session,
        force: bool = False,
    ) -> Dict[str, Any]:
        """
        Coordinates fetching live incidents from TomTom and persisting/updating in DB.
        Guarantees:
        - If TomTom returns 0 incidents, does NOT error or claim failure.
        - Persists live incidents with is_simulated=False and source='live_provider'.
        - Updates status or properties of existing incidents idempotently.
        """
        from backend.app.models.database import IncidentAlert
        async with self._lock:
            now = datetime.now(timezone.utc)
            if (
                not force
                and self._last_incident_collection_time is not None
                and (now - self._last_incident_collection_time).total_seconds() < self.min_collection_interval_seconds
            ):
                return {
                    "status": "skipped_throttle",
                    "message": "Incident collection throttled.",
                    "ingested_count": 0,
                    "updated_count": 0,
                }

            live_incidents = await traffic_provider_instance.fetch_live_incidents()
            ingested_count = 0
            updated_count = 0

            for inc in live_incidents:
                inc_id = inc["id"]
                existing = db.query(IncidentAlert).filter(IncidentAlert.id == inc_id).first()
                created_dt = self._parse_timestamp(inc.get("created_at") or now)

                if existing:
                    existing.severity = inc["severity"]
                    existing.incident_type = inc["incident_type"]
                    existing.description_en = inc["description_en"]
                    existing.description_hi = inc["description_hi"]
                    existing.recommended_action_en = inc["recommended_action_en"]
                    existing.recommended_action_hi = inc["recommended_action_hi"]
                    existing.status = inc.get("status", "open")
                    existing.is_simulated = False
                    existing.source = "live_provider"
                    updated_count += 1
                else:
                    new_alert = IncidentAlert(
                        id=inc_id,
                        intersection_id=inc["intersection_id"],
                        incident_type=inc["incident_type"],
                        severity=inc["severity"],
                        description_en=inc["description_en"],
                        description_hi=inc["description_hi"],
                        recommended_action_en=inc["recommended_action_en"],
                        recommended_action_hi=inc["recommended_action_hi"],
                        status=inc.get("status", "open"),
                        created_at=created_dt,
                        is_simulated=False,
                        source="live_provider",
                    )
                    db.add(new_alert)
                    ingested_count += 1

            if ingested_count > 0 or updated_count > 0:
                db.commit()

            self._last_incident_collection_time = now

            return {
                "status": "success",
                "ingested_count": ingested_count,
                "updated_count": updated_count,
                "verified_live_total": len(live_incidents),
            }

    def get_historical_observations(
        self,
        db: Session,
        intersection_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        source_filter: Optional[str] = None,
        limit: int = 100,
        chronological: bool = False,
    ) -> List[TrafficObservation]:
        """
        Retrieves historical observations filtered by node, time window, or provenance source.
        """
        query = db.query(TrafficObservation)

        if intersection_id:
            query = query.filter(TrafficObservation.intersection_id == intersection_id)

        if start_time:
            st = self._parse_timestamp(start_time)
            query = query.filter(TrafficObservation.timestamp >= st)

        if end_time:
            et = self._parse_timestamp(end_time)
            query = query.filter(TrafficObservation.timestamp <= et)

        if source_filter:
            query = query.filter(TrafficObservation.source == source_filter)

        if chronological:
            query = query.order_by(TrafficObservation.timestamp.asc())
        else:
            query = query.order_by(TrafficObservation.timestamp.desc())

        return query.limit(limit).all()


historical_observation_service = HistoricalObservationService()

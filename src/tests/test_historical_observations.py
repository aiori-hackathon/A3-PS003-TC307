import pytest
from datetime import datetime, timezone, timedelta
from backend.app.database import SessionLocal, engine
from backend.app.models.database import TrafficObservation
from backend.app.services.traffic_history import (
    migrate_database,
    historical_observation_service,
)
from backend.app.schemas.schemas import TrafficObservationDTO


def test_database_migration_safety_and_idempotence():
    """Verify that migration is strictly idempotent and non-destructive."""
    # Running multiple times must never throw errors or lose rows
    migrate_database(engine)
    migrate_database(engine)

    db = SessionLocal()
    try:
        count = db.query(TrafficObservation).count()
        assert count >= 2768, "Existing observations must be preserved"

        sample = db.query(TrafficObservation).first()
        assert hasattr(sample, "source")
        assert hasattr(sample, "provider_name")
        assert hasattr(sample, "confidence_score")
        assert sample.source in ["simulated", "live_provider", "cached", "sensor"]
    finally:
        db.close()


@pytest.mark.anyio
async def test_duplicate_protection_during_ingestion():
    """Verify that observations for the same intersection within proximity are deduplicated."""
    db = SessionLocal()
    try:
        now_dt = datetime.now(timezone.utc).replace(tzinfo=None)

        # Insert a reference record
        ref_obs = TrafficObservation(
            intersection_id="INT-02",
            timestamp=now_dt,
            vehicle_volume=350,
            average_speed=40.0,
            congestion_level="low",
            is_simulated=True,
            source="simulated",
            provider_name="Test Suite",
            confidence_score=1.0,
        )
        db.add(ref_obs)
        db.commit()

        initial_count = db.query(TrafficObservation).filter(
            TrafficObservation.intersection_id == "INT-02"
        ).count()

        # Attempt to coordinate ingestion with force=True for INT-02
        # Since ref_obs was just created at now_dt, the check within 5-min must deduplicate it
        res = await historical_observation_service.coordinate_collection_and_storage(
            db, intersection_ids=["INT-02"], force=True
        )
        assert res["status"] == "success"
        assert res["skipped_duplicates"] >= 1

        new_count = db.query(TrafficObservation).filter(
            TrafficObservation.intersection_id == "INT-02"
        ).count()
        # Count must remain unchanged due to duplicate suppression
        assert new_count == initial_count

        # Clean up test record
        db.delete(ref_obs)
        db.commit()
    finally:
        db.close()


@pytest.mark.anyio
async def test_backend_coordinated_collection_and_throttling():
    """Verify backend-coordinated collection, provenance recording, and request throttling."""
    db = SessionLocal()
    try:
        # First call with force=True must succeed
        res1 = await historical_observation_service.coordinate_collection_and_storage(
            db, intersection_ids=["INT-07"], force=True
        )
        assert res1["status"] == "success"
        assert "provider_status" in res1

        # Immediate second call without force must be throttled to prevent spamming
        res2 = await historical_observation_service.coordinate_collection_and_storage(
            db, intersection_ids=["INT-07"], force=False
        )
        assert res2["status"] == "skipped_throttle"
        assert res2["ingested_count"] == 0
    finally:
        db.close()


def test_historical_retrieval_with_provenance_and_filters():
    """Verify historical observation retrieval with provenance metadata and query filters."""
    db = SessionLocal()
    try:
        # Retrieve recent observations for INT-01
        obs_list = historical_observation_service.get_historical_observations(
            db, intersection_id="INT-01", limit=10
        )
        assert len(obs_list) > 0
        for obs in obs_list:
            assert obs.intersection_id == "INT-01"
            assert obs.source is not None
            assert obs.vehicle_volume >= 0
            assert obs.average_speed > 0
            assert obs.congestion_level in ["low", "moderate", "severe"]

        # Test filter by source
        sim_obs = historical_observation_service.get_historical_observations(
            db, intersection_id="INT-01", source_filter="simulated", limit=5
        )
        assert len(sim_obs) > 0
        for s in sim_obs:
            assert s.source == "simulated"
            assert s.is_simulated is True
    finally:
        db.close()

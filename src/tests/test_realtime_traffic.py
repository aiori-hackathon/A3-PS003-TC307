import os
import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock, AsyncMock
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import SessionLocal, engine
from backend.app.models.database import TrafficObservation, IncidentAlert, Intersection
from backend.app.services.traffic_provider import SharedTrafficProvider, traffic_provider_instance
from backend.app.services.traffic_history import (
    HistoricalObservationService,
    historical_observation_service,
    migrate_database,
)
from backend.app.ml.predictor import predictor_instance
from backend.app.main import background_traffic_poller


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    migrate_database(engine)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    return TestClient(app)


# --- 1. Live Flow & Provenance ---
def test_provider_live_flow_provenance():
    async def _run():
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "flowSegmentData": {
                "currentSpeed": 38.5,
                "freeFlowSpeed": 50.0,
                "confidence": 0.92,
                "roadClosure": False,
            }
        }

        provider = SharedTrafficProvider(mode="live", api_key="dummy_valid_test_key")
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            observations = await provider.fetch_live_observations(["INT-01"])

            assert len(observations) == 1
            obs = observations[0]
            assert obs.intersection_id == "INT-01"
            assert obs.source == "live_provider"
            assert obs.is_simulated is False
            assert obs.average_speed == 38.5
            assert obs.confidence_score == 0.92

    asyncio.run(_run())


# --- 2. Fallback on Missing Key ---
def test_provider_simulated_fallback_on_missing_key():
    async def _run():
        provider = SharedTrafficProvider(mode="live", api_key="")
        observations = await provider.fetch_live_observations(["INT-01"])

        assert len(observations) == 1
        obs = observations[0]
        assert obs.is_simulated is True
        assert obs.source == "simulated"
        assert "Simulated" in obs.provider_name
        assert provider.error_fallback_active is True

    asyncio.run(_run())


# --- 3. Live Incident Ingestion & Nearest Node Mapping ---
def test_provider_live_incidents_ingestion():
    async def _run():
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "incidents": [
                {
                    "properties": {
                        "id": "TTI-TEST-001",
                        "magnitudeOfDelay": 3,
                        "startTime": "2026-10-24T00:00:00Z",
                        "from": "Barakhamba Road",
                        "to": "Janpath",
                        "events": [{"code": 401, "description": "Closed"}],
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[77.2180, 28.6320], [77.2190, 28.6330]],
                    },
                }
            ]
        }

        provider = SharedTrafficProvider(mode="live", api_key="dummy_valid_test_key")
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            incidents = await provider.fetch_live_incidents()

            assert len(incidents) == 1
            inc = incidents[0]
            assert inc["id"] == "TTI-TEST-001"
            assert inc["intersection_id"] == "INT-03"  # Nearest intersection (Rajiv Chowk Metro Radial, 0.11km)
            assert inc["incident_type"] == "road_closure"
            assert inc["severity"] == "critical"
            assert inc["is_simulated"] is False
            assert inc["source"] == "live_provider"

    asyncio.run(_run())


# --- 4. Zero Incidents Handled Gracefully (Req 7) ---
def test_zero_incidents_handled_gracefully():
    async def _run():
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"incidents": []}

        provider = SharedTrafficProvider(mode="live", api_key="dummy_valid_test_key")
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            incidents = await provider.fetch_live_incidents()

            # Must return empty list, NOT raise error or trigger fallback
            assert incidents == []
            assert provider.error_fallback_active is False
            status = provider.get_provider_status()
            assert status.live_incidents_count == 0

    asyncio.run(_run())


# --- 5. Duplicate Prevention and Throttling ---
def test_throttling_and_duplicate_prevention(db_session):
    async def _run():
        service = HistoricalObservationService(min_collection_interval_seconds=60.0)
        service._last_collection_time = datetime.now(timezone.utc)

        # Calling within 60s without force=True must throttle
        res = await service.coordinate_collection_and_storage(db_session, force=False)
        assert res["status"] == "skipped_throttle"
        assert res["ingested_count"] == 0

        # Incident service throttling
        service._last_incident_collection_time = datetime.now(timezone.utc)
        inc_res = await service.coordinate_incident_collection_and_storage(db_session, force=False)
        assert inc_res["status"] == "skipped_throttle"

    asyncio.run(_run())


# --- 6. Prediction Freshness: Recent Observation ---
def test_prediction_freshness_recent(db_session):
    recent_ts = datetime.now(timezone.utc) - timedelta(minutes=5)
    obs = TrafficObservation(
        intersection_id="INT-01",
        timestamp=recent_ts.replace(tzinfo=None),
        vehicle_volume=180,
        average_speed=36.0,
        congestion_level="low",
        is_simulated=False,
        source="live_provider",
    )
    db_session.add(obs)
    db_session.commit()

    pred = predictor_instance.predict(db_session, intersection_id="INT-01", horizon_minutes=15)
    assert pred["is_stale"] is False
    assert pred["freshness_warning"] is None
    assert pred["observation_age_minutes"] < 30.0


# --- 7. Prediction Freshness: Stale Observation Warning ---
def test_prediction_freshness_stale_warning(db_session):
    # Temporarily remove any INT-08 observations newer than 40 minutes ago
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=40)
    db_session.query(TrafficObservation).filter(
        TrafficObservation.intersection_id == "INT-08",
        TrafficObservation.timestamp >= cutoff.replace(tzinfo=None),
    ).delete()
    
    stale_ts = datetime.now(timezone.utc) - timedelta(minutes=50)
    obs = TrafficObservation(
        intersection_id="INT-08",
        timestamp=stale_ts.replace(tzinfo=None),
        vehicle_volume=190,
        average_speed=34.0,
        congestion_level="low",
        is_simulated=False,
        source="live_provider",
    )
    db_session.add(obs)
    db_session.commit()

    pred = predictor_instance.predict(db_session, intersection_id="INT-08", horizon_minutes=15)
    assert pred["is_stale"] is True
    assert pred["freshness_warning"] is not None
    assert "older than 30 minutes" in pred["freshness_warning"].lower() or "minutes old" in pred["freshness_warning"].lower()


# --- 8. Background Poller Graceful Shutdown ---
def test_background_poller_shutdown():
    async def _run():
        shutdown_event = asyncio.Event()
        shutdown_event.set()

        task = asyncio.create_task(background_traffic_poller(shutdown_event))
        await asyncio.wait_for(task, timeout=2.0)
        assert task.done()

    asyncio.run(_run())


# --- 9. Incidents Endpoint Provenance Separation ---
def test_incidents_endpoint_separation(client, db_session):
    db_session.query(IncidentAlert).filter(IncidentAlert.id.in_(["TEST-SIM-1", "TEST-LIVE-1"])).delete()

    sim_alert = IncidentAlert(
        id="TEST-SIM-1",
        intersection_id="INT-01",
        incident_type="surge",
        severity="warning",
        description_en="Simulated peak rush hour queue.",
        description_hi="सिम्युलेटेड पीक आवर्स कतार।",
        recommended_action_en="Preemptively adjust signal splits.",
        recommended_action_hi="सिग्नल का समय समायोजित करें।",
        status="open",
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        is_simulated=True,
        source="simulated",
    )
    live_alert = IncidentAlert(
        id="TEST-LIVE-1",
        intersection_id="INT-02",
        incident_type="road_closure",
        severity="critical",
        description_en="Real-world closure on ITO approach.",
        description_hi="आईटीओ एप्रोच पर सड़क बंद।",
        recommended_action_en="Divert traffic to Ring Road.",
        recommended_action_hi="ट्रैफिक को रिंग रोड पर डायवर्ट करें।",
        status="open",
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        is_simulated=False,
        source="live_provider",
    )
    db_session.add(sim_alert)
    db_session.add(live_alert)
    db_session.commit()

    resp_live = client.get("/api/incidents?include_simulated=false")
    assert resp_live.status_code == 200
    live_items = resp_live.json()
    assert all(item["is_simulated"] is False for item in live_items)
    assert any(item["id"] == "TEST-LIVE-1" for item in live_items)
    assert not any(item["id"] == "TEST-SIM-1" for item in live_items)

    db_session.query(IncidentAlert).filter(IncidentAlert.id.in_(["TEST-SIM-1", "TEST-LIVE-1"])).delete()
    db_session.commit()

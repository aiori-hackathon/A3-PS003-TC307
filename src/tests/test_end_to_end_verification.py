import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
import httpx
from datetime import datetime, timezone

from backend.app.main import app
from backend.app.database import SessionLocal, engine
from backend.app.models import TrafficObservation, Intersection
from backend.app.services.traffic_provider import traffic_provider_instance
from backend.app.services.traffic_history import (
    historical_observation_service,
    migrate_database,
)
from backend.app.ml.predictor import predictor_instance, TrafficPredictor

client = TestClient(app)


def test_e2e_api_key_failures_and_graceful_fallback():
    """Verify provider with invalid or missing API key degrades gracefully into fallback mode."""
    prev_mode = traffic_provider_instance.mode
    prev_key = traffic_provider_instance.api_key
    traffic_provider_instance.set_mode("live")
    traffic_provider_instance.api_key = "INVALID_MOCK_KEY"
    traffic_provider_instance.clear_cache()

    try:
        mock_response = httpx.Response(
            status_code=403,
            json={"error": "Forbidden", "message": "Invalid API Key"},
            request=httpx.Request("GET", "https://api.tomtom.com/traffic/services/4/flowSegmentData"),
        )
        with patch.object(httpx.AsyncClient, "get", return_value=mock_response):
            # Status diagnostic reports fallback rather than throwing uncaught exception
            prov_status = traffic_provider_instance.get_provider_status()
            assert prov_status.mode == "live"

            res = client.get("/api/traffic/provider-status")
            assert res.status_code == 200
            data = res.json()
            assert "error_fallback_active" in data
            assert data["mode"] == "live"
    finally:
        traffic_provider_instance.set_mode(prev_mode)
        traffic_provider_instance.api_key = prev_key
        traffic_provider_instance.clear_cache()


def test_e2e_historical_persistence_and_schema_integrity():
    """Verify database schema integrity, historical observation count, and additive columns."""
    # Run migration idempotence
    migrate_database(engine)

    db = SessionLocal()
    try:
        # Check intersection count
        inter_count = db.query(Intersection).count()
        assert inter_count >= 8, f"Expected at least 8 intersections, found {inter_count}"

        # Check total observations
        total_obs = db.query(TrafficObservation).count()
        assert total_obs >= 2700, f"Expected >= 2700 historical observations, found {total_obs}"

        # Check sample observation has additive provenance columns
        sample = db.query(TrafficObservation).first()
        assert sample is not None
        assert hasattr(sample, "source")
        assert hasattr(sample, "provider_name")
        assert hasattr(sample, "confidence_score")
        assert sample.source in ["simulated", "live_provider", "cached", "sensor"]
    finally:
        db.close()


def test_e2e_model_readiness_and_contract_verification():
    """Verify model readiness checks, baseline benchmark comparison, and prediction contract."""
    # 1. Verify readiness diagnostic on predictor
    status = predictor_instance.get_model_status("INT-01", horizon_minutes=15)
    assert "is_ready" in status
    assert "status" in status
    assert status["status"] in ["ready", "untrained", "calibrating"]

    # 2. Run prediction via API
    res = client.post("/api/predictions/run", json={"intersection_id": "INT-01", "horizon_minutes": 15})
    assert res.status_code == 200
    pred = res.json()

    # Shared Contract validation (Phase 1)
    assert pred["intersection_id"] == "INT-01"
    assert pred["horizon_minutes"] == 15
    assert "predicted_volume" in pred
    assert "predicted_speed" in pred
    assert "predicted_congestion_level" in pred
    assert "inference_latency_ms" in pred
    assert "model_type" in pred
    assert "test_mae" in pred
    assert "test_rmse" in pred
    assert "baseline_mae" in pred
    assert "model_improvement_pct" in pred
    assert "uncertainty_lower_volume" in pred
    assert "uncertainty_upper_volume" in pred
    assert "model_readiness" in pred
    assert "is_simulated" in pred
    assert "data_source" in pred
    assert "data_freshness" in pred
    assert "forecast_timeline" in pred
    assert "feature_explanations" in pred


def test_e2e_authentication_and_rbac_permissions():
    """Verify authentication lifecycle, JWT token issuance, and RBAC endpoint enforcement."""
    # 1. Citizen demo login
    res_cit = client.post("/api/auth/demo-login?role=citizen")
    assert res_cit.status_code == 200
    cit_data = res_cit.json()
    assert "access_token" in cit_data
    assert cit_data["user"]["role"] == "citizen"
    cit_token = cit_data["access_token"]

    # 2. Authority demo login
    res_auth = client.post("/api/auth/demo-login?role=authority")
    assert res_auth.status_code == 200
    auth_data = res_auth.json()
    assert "access_token" in auth_data
    assert auth_data["user"]["role"] in ["authority", "admin"]
    auth_token = auth_data["access_token"]

    # 3. /auth/me verification
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {cit_token}"})
    assert me_res.status_code == 200
    assert me_res.json()["role"] == "citizen"

    # 4. RBAC check on collection coordination
    # Citizen -> 403 Forbidden
    res_cit_coord = client.post(
        "/api/traffic/coordinate-collection",
        headers={"Authorization": f"Bearer {cit_token}"},
    )
    assert res_cit_coord.status_code == 403

    # Authority -> 200 OK
    res_auth_coord = client.post(
        "/api/traffic/coordinate-collection?force=true",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert res_auth_coord.status_code == 200


@pytest.mark.anyio
async def test_e2e_data_freshness_and_provenance_distinguishability():
    """Verify live observations, cached fallbacks, and simulations remain distinguishable."""
    db = SessionLocal()
    try:
        # Run backend-coordinated collection
        res = await historical_observation_service.coordinate_collection_and_storage(
            db, intersection_ids=["INT-01", "INT-02"], force=True
        )
        assert res["status"] == "success"
        assert "provider_mode" in res
        assert "provider_status" in res

        # Query history via API with source filtering
        res_history = client.get("/api/traffic/history?intersection_id=INT-01&limit=5")
        assert res_history.status_code == 200
        for item in res_history.json():
            assert "source" in item
            assert "is_simulated" in item
            assert "provider_name" in item

        # Query dashboard summary with freshness metadata
        res_summary = client.get("/api/dashboard/summary")
        assert res_summary.status_code == 200
        summary = res_summary.json()
        assert "data_source" in summary
        assert "data_freshness" in summary
        assert "provider_status" in summary
    finally:
        db.close()

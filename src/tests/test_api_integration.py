import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
import httpx

from backend.app.main import app
from backend.app.services.traffic_provider import traffic_provider_instance

client = TestClient(app)


def test_health_endpoint_with_provider_and_model_diagnostics():
    """Verify /api/health exposes service health, provider status, and model readiness count."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "provider_status" in data
    assert "mode" in data["provider_status"]
    assert "models_ready_count" in data
    assert "database_status" in data
    assert data["database_status"] == "connected"


def test_traffic_provider_status_endpoint():
    """Verify /api/traffic/provider-status reflects provider state and fallback diagnostics."""
    res = client.get("/api/traffic/provider-status")
    assert res.status_code == 200
    data = res.json()
    assert "provider_name" in data
    assert "mode" in data
    assert "is_online" in data
    assert "error_fallback_active" in data
    assert "message" in data


def test_dashboard_summary_includes_provenance_and_freshness():
    """Verify /api/dashboard/summary includes data freshness, source, and provider status."""
    res = client.get("/api/dashboard/summary")
    assert res.status_code == 200
    data = res.json()
    assert "data_source" in data
    assert "data_freshness" in data
    assert "provider_status" in data
    assert "is_simulated" in data
    assert data["total_intersections"] >= 8


def test_intersection_details_provenance_fields():
    """Verify intersection lists and details carry source, is_simulated, and freshness tags."""
    # List endpoint
    res_list = client.get("/api/traffic/intersections")
    assert res_list.status_code == 200
    inter_list = res_list.json()
    assert len(inter_list) >= 8
    first = inter_list[0]
    assert "source" in first
    assert "is_simulated" in first
    assert "data_freshness" in first
    assert "last_updated" in first

    # Single detail endpoint
    res_single = client.get(f"/api/traffic/intersections/{first['id']}")
    assert res_single.status_code == 200
    single = res_single.json()
    assert single["id"] == first["id"]
    assert "source" in single
    assert "is_simulated" in single
    assert "data_freshness" in single


def test_traffic_history_with_provenance_and_source_filter():
    """Verify /api/traffic/history returns complete observation provenance and supports source filtering."""
    res = client.get("/api/traffic/history?intersection_id=INT-01&limit=10")
    assert res.status_code == 200
    history = res.json()
    assert len(history) > 0
    for item in history:
        assert "source" in item
        assert "is_simulated" in item
        assert "provider_name" in item
        assert "confidence_score" in item

    # Filter by source=simulated
    res_filtered = client.get("/api/traffic/history?intersection_id=INT-01&source=simulated&limit=5")
    assert res_filtered.status_code == 200
    for item in res_filtered.json():
        assert item["source"] == "simulated"
        assert item["is_simulated"] is True


def test_prediction_endpoint_with_readiness_and_uncertainty():
    """Verify /api/predictions/run returns model readiness, test metrics, and empirical uncertainty."""
    res = client.post(
        "/api/predictions/run",
        json={"intersection_id": "INT-01", "horizon_minutes": 15},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["intersection_id"] == "INT-01"
    assert data["horizon_minutes"] == 15
    assert data["model_readiness"] == "ready"
    assert "test_mae" in data
    assert "test_rmse" in data
    assert "uncertainty_lower_volume" in data
    assert "uncertainty_upper_volume" in data
    assert "uncertainty_method" in data
    assert data["predicted_speed"] > 0


def test_coordinated_collection_rbac_security():
    """Verify /api/traffic/coordinate-collection requires Authority/Admin role and denies Citizens."""
    # 1. Unauthenticated request -> 401
    res_unauth = client.post("/api/traffic/coordinate-collection")
    assert res_unauth.status_code == 401

    # 2. Citizen user -> 403 Forbidden
    auth_citizen = client.post("/api/auth/demo-login?role=citizen")
    assert auth_citizen.status_code == 200
    cit_token = auth_citizen.json()["access_token"]
    res_cit = client.post(
        "/api/traffic/coordinate-collection",
        headers={"Authorization": f"Bearer {cit_token}"},
    )
    assert res_cit.status_code == 403

    # 3. Authority user -> 200 OK
    auth_authority = client.post("/api/auth/demo-login?role=authority")
    assert auth_authority.status_code == 200
    auth_token = auth_authority.json()["access_token"]
    res_auth = client.post(
        "/api/traffic/coordinate-collection?force=true",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert res_auth.status_code == 200
    data = res_auth.json()
    assert data["status"] == "success"
    assert "ingested_count" in data


@pytest.mark.anyio
async def test_distinguish_provider_failure_from_traffic_conditions():
    """Verify provider failure activates fallback diagnostics without faking live status."""
    prev_mode = traffic_provider_instance.mode
    traffic_provider_instance.set_mode("live")
    traffic_provider_instance.api_key = "test_failing_key"
    traffic_provider_instance.base_url = "http://127.0.0.1:9999"
    traffic_provider_instance.clear_cache()

    try:
        # Trigger live fetch failure
        with patch.object(httpx.AsyncClient, "get", side_effect=httpx.ConnectError("Network unreachable")):
            obs = await traffic_provider_instance.fetch_live_observations(["INT-01"])
            assert len(obs) == 1
            assert obs[0].is_simulated is True
            # Status diagnostic clearly reports failure rather than crash
            prov_status = traffic_provider_instance.get_provider_status()
            assert prov_status.mode == "live"
            assert prov_status.error_fallback_active is True
            assert prov_status.is_online is False
    finally:
        traffic_provider_instance.set_mode(prev_mode)
        traffic_provider_instance.clear_cache()

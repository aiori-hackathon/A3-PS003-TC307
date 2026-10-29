import os
from unittest.mock import patch
import httpx
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.traffic_provider import SharedTrafficProvider, traffic_provider_instance
from backend.app.schemas.schemas import TrafficObservationDTO, ProviderStatusDTO

client = TestClient(app)


MOCK_TOMTOM_SUCCESS_PAYLOAD = {
    "flowSegmentData": {
        "frc": "FRC1",
        "currentSpeed": 34.2,
        "freeFlowSpeed": 48.0,
        "currentTravelTime": 140,
        "freeFlowTravelTime": 95,
        "confidence": 0.98,
        "roadClosure": False,
        "coordinates": {"coordinate": []},
    }
}


@pytest.mark.anyio
async def test_live_tomtom_success_response():
    """Verify live TomTom 200 response parsing, calculation, and provenance tagging."""
    provider = SharedTrafficProvider(
        mode="live",
        api_key="tomtom_secret_key_12345",
        max_retries=1,
    )
    provider.clear_cache()

    async def mock_get(self, url, **kwargs):
        req = httpx.Request("GET", str(url))
        return httpx.Response(200, json=MOCK_TOMTOM_SUCCESS_PAYLOAD, request=req)

    with patch.object(httpx.AsyncClient, "get", new=mock_get):
        obs_list = await provider.fetch_live_observations(["INT-01", "INT-02"])
        assert len(obs_list) == 2

        for obs in obs_list:
            assert isinstance(obs, TrafficObservationDTO)
            assert obs.source == "live_provider"
            assert obs.is_simulated is False
            assert obs.average_speed == 34.2
            assert obs.confidence_score == 0.98
            assert obs.provider_name == "TomTom Traffic Flow API"
            assert obs.vehicle_volume > 0

    status = provider.get_provider_status()
    assert status.mode == "live"
    assert status.is_online is True
    assert status.error_fallback_active is False
    assert "Actively streaming" in status.message


@pytest.mark.anyio
async def test_live_mode_missing_api_key_honest_fallback():
    """Verify that when mode is live but API key is missing, system falls back to simulation honestly."""
    provider = SharedTrafficProvider(
        mode="live",
        api_key="",
    )
    provider.clear_cache()

    obs_list = await provider.fetch_live_observations(["INT-01"])
    assert len(obs_list) == 1
    obs = obs_list[0]

    # Must be honestly labeled as simulated, not live!
    assert obs.source == "simulated"
    assert obs.is_simulated is True
    assert obs.provider_name == "Simulated Diurnal Stream"

    status = provider.get_provider_status()
    assert status.mode == "live"
    assert status.is_online is False
    assert status.error_fallback_active is True
    assert "TOMTOM_API_KEY is not configured" in status.message


@pytest.mark.anyio
async def test_api_failure_and_credential_sanitization():
    """Verify that on API 403/500 errors, fallback engages and the API key is never leaked in errors."""
    secret_key = "super_secret_tomtom_key_xyz987"
    provider = SharedTrafficProvider(
        mode="live",
        api_key=secret_key,
        max_retries=1,
    )
    provider.clear_cache()

    async def mock_failing_get(self, url, **kwargs):
        req = httpx.Request("GET", f"https://api.tomtom.com/traffic/services/4?key={secret_key}")
        return httpx.Response(403, json={"error": "Forbidden: Invalid API Key"}, request=req)

    with patch.object(httpx.AsyncClient, "get", new=mock_failing_get):
        obs_list = await provider.fetch_live_observations(["INT-03"])
        assert len(obs_list) == 1
        obs = obs_list[0]

        # Resilient simulation fallback
        assert obs.source == "simulated"
        assert obs.is_simulated is True

    status = provider.get_provider_status()
    assert status.error_fallback_active is True
    assert status.is_online is False

    # CRITICAL: Verify the secret key is NOT present in any error message or status message!
    assert secret_key not in (status.message or "")
    assert secret_key not in (provider.last_error_message or "")


@pytest.mark.anyio
async def test_cache_ttl_prevents_excessive_api_calls():
    """Verify that observations are cached within TTL to stay within TomTom free tier rate limit."""
    call_count = 0
    provider = SharedTrafficProvider(
        mode="live",
        api_key="test_key",
        max_retries=0,
    )
    provider.cache_ttl_seconds = 300.0
    provider.clear_cache()

    async def counting_mock_get(self, url, **kwargs):
        nonlocal call_count
        call_count += 1
        req = httpx.Request("GET", str(url))
        return httpx.Response(200, json=MOCK_TOMTOM_SUCCESS_PAYLOAD, request=req)

    with patch.object(httpx.AsyncClient, "get", new=counting_mock_get):
        # First call hits API
        first_readings = await provider.fetch_live_observations(["INT-01"])
        assert call_count == 1
        assert first_readings[0].source == "live_provider"

        # Second call within TTL should reuse cache and NOT call TomTom again
        second_readings = await provider.fetch_live_observations(["INT-01"])
        assert call_count == 1  # No additional API call!
        assert second_readings[0].average_speed == first_readings[0].average_speed


def test_api_endpoints_live_diagnostics():
    """Verify /api/traffic/provider-status and /api/traffic/intersections endpoints."""
    res_status = client.get("/api/traffic/provider-status")
    assert res_status.status_code == 200
    data = res_status.json()
    assert "mode" in data
    assert "provider_name" in data
    assert "is_online" in data
    assert "error_fallback_active" in data
    assert "message" in data

    res_inter = client.get("/api/traffic/intersections")
    assert res_inter.status_code == 200
    intersections = res_inter.json()
    assert len(intersections) >= 8
    for item in intersections:
        assert "id" in item
        assert "current_speed" in item
        assert "current_volume" in item
        assert "source" in item
        assert "is_simulated" in item

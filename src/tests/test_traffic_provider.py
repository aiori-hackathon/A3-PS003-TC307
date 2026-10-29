import pytest
from unittest.mock import patch, MagicMock
import httpx
from backend.app.services.traffic_provider import SharedTrafficProvider, traffic_provider_instance
from backend.app.schemas.schemas import TrafficObservationDTO, ProviderStatusDTO


@pytest.mark.anyio
async def test_shared_traffic_provider_simulated_mode():
    provider = SharedTrafficProvider(mode="simulated")
    status = provider.get_provider_status()
    assert status.mode == "simulated"
    assert status.is_online is True
    assert status.error_fallback_active is False

    observations = await provider.fetch_live_observations(["INT-01", "INT-02"])
    assert len(observations) == 2
    for obs in observations:
        assert isinstance(obs, TrafficObservationDTO)
        assert obs.intersection_id in ["INT-01", "INT-02"]
        assert obs.source == "simulated"
        assert obs.is_simulated is True
        assert obs.vehicle_volume >= 0
        assert obs.average_speed > 0
        assert obs.congestion_level in ["low", "moderate", "severe"]

    updated_status = provider.get_provider_status()
    assert updated_status.cached_records_count >= 2


@pytest.mark.anyio
async def test_tomtom_mocked_live_flow_reading():
    """Verify parsing and provenance tagging of genuine TomTom flowSegmentData responses."""
    mock_tomtom_response = {
        "flowSegmentData": {
            "frc": "FRC1",
            "currentSpeed": 38.5,
            "freeFlowSpeed": 45.0,
            "currentTravelTime": 120,
            "freeFlowTravelTime": 90,
            "confidence": 0.96,
            "roadClosure": False,
            "coordinates": {"coordinate": []},
        }
    }

    provider = SharedTrafficProvider(
        mode="live",
        api_key="mock_valid_tomtom_key",
        max_retries=1,
    )
    provider.clear_cache()

    async def mock_get(self, url, **kwargs):
        req = httpx.Request("GET", str(url))
        return httpx.Response(200, json=mock_tomtom_response, request=req)

    with patch.object(httpx.AsyncClient, "get", new=mock_get):
        observations = await provider.fetch_live_observations(["INT-01"])
        assert len(observations) == 1
        obs = observations[0]

        assert obs.intersection_id == "INT-01"
        assert obs.source == "live_provider"
        assert obs.is_simulated is False
        assert obs.average_speed == 38.5
        assert obs.confidence_score == 0.96
        assert obs.provider_name == "TomTom Traffic Flow API"
        assert obs.congestion_level in ["low", "moderate", "severe"]
        assert obs.vehicle_volume > 0

    status = provider.get_provider_status()
    assert status.mode == "live"
    assert status.is_online is True
    assert status.error_fallback_active is False
    assert "Actively streaming real-world Delhi NCR readings" in status.message


@pytest.mark.anyio
async def test_tomtom_mocked_retry_and_transient_recovery():
    """Verify bounded retry recovers after a transient error."""
    mock_tomtom_response = {
        "flowSegmentData": {
            "frc": "FRC1",
            "currentSpeed": 25.0,
            "freeFlowSpeed": 50.0,
            "currentTravelTime": 180,
            "freeFlowTravelTime": 90,
            "confidence": 0.92,
            "roadClosure": False,
        }
    }

    call_count = 0

    async def mock_transient_get(self, url, **kwargs):
        nonlocal call_count
        call_count += 1
        req = httpx.Request("GET", str(url))
        if call_count == 1:
            # First attempt fails with transient 503 Service Unavailable
            return httpx.Response(503, json={"error": "Rate limit / transient busy"}, request=req)
        return httpx.Response(200, json=mock_tomtom_response, request=req)

    provider = SharedTrafficProvider(
        mode="live",
        api_key="mock_key",
        max_retries=2,
    )

    with patch.object(httpx.AsyncClient, "get", new=mock_transient_get):
        observations = await provider.fetch_live_observations(["INT-06"])
        assert len(observations) == 1
        obs = observations[0]
        assert obs.source == "live_provider"
        assert obs.is_simulated is False
        assert obs.average_speed == 25.0
        assert call_count == 2  # Verified retry succeeded


@pytest.mark.anyio
async def test_tomtom_failure_cache_fallback():
    """Verify that when TomTom is unreachable, cached observations are served with source='cached'."""
    provider = SharedTrafficProvider(
        mode="live",
        api_key="mock_key",
        max_retries=1,
    )
    # Pre-populate cache with a previously recorded live reading
    live_obs = TrafficObservationDTO(
        intersection_id="INT-04",
        timestamp="2026-10-21T12:00:00Z",
        vehicle_volume=520,
        average_speed=42.0,
        congestion_level="low",
        source="live_provider",
        is_simulated=False,
        provider_name="TomTom Traffic Flow API",
    )
    provider._cache["INT-04"] = live_obs

    async def mock_failing_get(self, url, **kwargs):
        raise httpx.ConnectError("Connection refused by gateway")

    with patch.object(httpx.AsyncClient, "get", new=mock_failing_get):
        observations = await provider.fetch_live_observations(["INT-04"])
        assert len(observations) == 1
        obs = observations[0]
        assert obs.intersection_id == "INT-04"
        assert obs.source == "cached"
        assert obs.is_simulated is False

    status = provider.get_provider_status()
    assert status.error_fallback_active is True
    assert status.is_online is False


@pytest.mark.anyio
async def test_tomtom_failure_simulation_fallback():
    """Verify that when TomTom is unreachable and cache is empty, calibrated simulation is used."""
    provider = SharedTrafficProvider(
        mode="live",
        api_key="mock_key",
        max_retries=0,
    )
    provider.clear_cache()

    async def mock_failing_get(self, url, **kwargs):
        raise httpx.TimeoutException("Read timeout after 5.0s")

    with patch.object(httpx.AsyncClient, "get", new=mock_failing_get):
        observations = await provider.fetch_live_observations(["INT-05"])
        assert len(observations) == 1
        obs = observations[0]
        assert obs.intersection_id == "INT-05"
        assert obs.source == "simulated"
        assert obs.is_simulated is True

    status = provider.get_provider_status()
    assert status.error_fallback_active is True


@pytest.mark.anyio
async def test_singleton_traffic_provider_instance():
    assert traffic_provider_instance is not None
    obs = await traffic_provider_instance.fetch_live_observations()
    assert len(obs) >= 8

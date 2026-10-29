import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_corridors_endpoint_returns_live_traffic_data():
    """Verify /api/traffic/corridors returns 4 Delhi corridors calculated from live observations."""
    response = client.get("/api/traffic/corridors")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 4
    for corridor in data:
        assert "id" in corridor
        assert "name" in corridor
        assert "distance_km" in corridor
        assert corridor["distance_km"] > 0
        assert "average_speed" in corridor
        assert corridor["average_speed"] > 0
        assert "travel_time_minutes" in corridor
        assert corridor["travel_time_minutes"] > 0
        assert "congestion_level" in corridor
        assert corridor["congestion_level"] in ["free", "moderate", "heavy"]
        assert "is_simulated" in corridor
        assert "source" in corridor
        # Speed and travel time must be mathematically consistent: time = (dist / speed) * 60
        expected_time = max(1, int(round((corridor["distance_km"] / corridor["average_speed"]) * 60.0)))
        assert abs(corridor["travel_time_minutes"] - expected_time) <= 1


def test_prediction_forecast_endpoint():
    """Verify /api/prediction/forecast returns AI forecast distinctly marked as a predictive model."""
    response = client.get("/api/prediction/forecast?intersection_id=INT-01&horizon_minutes=30")
    assert response.status_code == 200
    data = response.json()
    assert data["intersection_id"] == "INT-01"
    assert data["horizon_minutes"] == 30
    assert "predicted_speed" in data
    assert "predicted_volume" in data
    assert "is_forecast" in data
    assert data["is_forecast"] is True
    assert "data_source" in data
    assert "model_type" in data


def test_incidents_filtering_excludes_simulated_drills_for_citizens():
    """Verify /api/incidents?include_simulated=false filters out simulated surge drills."""
    # When include_simulated=False, no simulated incident descriptions should appear
    response = client.get("/api/incidents?include_simulated=false")
    assert response.status_code == 200
    data = response.json()
    for inc in data:
        assert inc.get("is_simulated", False) is False
        assert "simulated" not in inc.get("description_en", "").lower()


def test_intersections_endpoint_provenance_and_data_integrity():
    """Verify all 8 monitored Delhi NCR intersections report valid speeds and proper provenance."""
    response = client.get("/api/traffic/intersections")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 8
    for item in data:
        assert "id" in item
        assert "name" in item
        assert "current_speed" in item
        assert item["current_speed"] > 0
        assert "baseline_speed" in item
        assert item["baseline_speed"] > 0
        assert "congestion_level" in item
        assert item["congestion_level"] in ["low", "moderate", "severe"]
        assert "source" in item
        assert "is_simulated" in item

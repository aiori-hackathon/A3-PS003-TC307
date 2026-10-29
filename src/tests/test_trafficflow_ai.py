import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_public_registration_assigns_citizen_role():
    """Verify that public registration always assigns citizen role."""
    import uuid
    unique_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Citizen Commuter",
            "email": unique_email,
            "password": "StrongPassword123!",
            "confirm_password": "StrongPassword123!",
        },
    )
    assert res.status_code in [200, 201], res.text
    data = res.json()
    assert data["user"]["role"] == "citizen"


def test_horizon_validation():
    """Verify explicit horizon validation: 15, 30, 60, 360, 1440 allowed; others 422."""
    for h in [15, 30, 60, 360, 1440]:
        res = client.post(
            "/api/predictions/run",
            json={"intersection_id": "INT-01", "horizon_minutes": h},
        )
        assert res.status_code == 200, f"Horizon {h} failed: {res.text}"
        data = res.json()
        assert data["horizon_minutes"] == h
        assert "predicted_volume" in data
        assert "predicted_speed" in data
        assert "estimated_travel_time_min" in data
        assert "expected_congestion_onset" in data
        assert "forecast_timeline" in data

    # Arbitrary horizon must be rejected with 422
    for bad_h in [10, 45, 90, 720, 9999]:
        bad_res = client.post(
            "/api/predictions/run",
            json={"intersection_id": "INT-01", "horizon_minutes": bad_h},
        )
        assert bad_res.status_code == 422, f"Disallowed horizon {bad_h} should return 422"


def test_route_intelligence_and_closure_avoidance():
    """Verify graph-based routing and closure avoidance."""
    res = client.post(
        "/api/routes/compare",
        json={
            "origin_id": "INT-01",
            "destination_id": "INT-07",
            "avoid_closed_roads": True,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert len(data["routes"]) > 0
    assert "advisory_notice" in data
    rec_route = next((r for r in data["routes"] if r["is_recommended"]), None)
    assert rec_route is not None
    assert rec_route["estimated_time_minutes"] > 0
    assert rec_route["recommendation_rationale"] is not None


def test_digital_twin_scenarios_with_authority_role():
    """Verify digital twin simulator across the 4 focused scenarios."""
    # Obtain authority token via demo login
    auth_res = client.post("/api/auth/demo-login?role=authority")
    assert auth_res.status_code == 200
    token = auth_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    scenarios = [
        ("increased_volume", {"volume_multiplier": 1.4}),
        ("road_closure", {"target_intersection_id": "INT-04"}),
        ("heavy_rainfall", {"rainfall_intensity_mm": 50.0}),
        ("major_event", {"event_crowd_size": 35000, "target_intersection_id": "INT-01"}),
    ]

    for sc_name, extra_params in scenarios:
        payload = {"scenario": sc_name, **extra_params}
        res = client.post("/api/digital-twin/simulate", json=payload, headers=headers)
        assert res.status_code == 200, f"Scenario {sc_name} failed: {res.text}"
        data = res.json()
        assert data["scenario"] == sc_name
        assert data["status"] == "applied"
        assert len(data["affected_nodes"]) > 0
        assert "baseline_metrics" in data
        assert "simulated_metrics" in data
        assert "node_comparisons" in data
        assert len(data["node_comparisons"]) == 8


def test_citizen_forbidden_from_simulating():
    """Verify citizen role cannot trigger digital twin simulations."""
    cit_res = client.post("/api/auth/demo-login?role=citizen")
    assert cit_res.status_code == 200
    token = cit_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/api/digital-twin/simulate",
        json={"scenario": "increased_volume"},
        headers=headers,
    )
    assert res.status_code == 403


def test_incident_threshold_evaluation():
    """Verify threshold evaluation and topological spillover risk derivation."""
    res = client.post(
        "/api/incidents/evaluate",
        json={
            "volume_capacity_threshold": 0.70,
            "speed_threshold_kmh": 25.0,
            "horizon_minutes": 30,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert "early_warnings" in data
    assert "spillover_risks" in data
    assert "thresholds_applied" in data
    assert data["thresholds_applied"]["volume_capacity_threshold"] == 0.70


def test_chat_assistant():
    """Verify bilingual chat assistant references TrafficFlow AI."""
    res = client.post(
        "/api/chat",
        json={"message": "Who developed TrafficFlow AI and what is the tagline?", "language": "en"},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert "response" in data
    assert "TrafficFlow" in data["response"] or "Nexora" in data["response"]

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import SessionLocal, engine
from backend.app.models.database import (
    CitizenNotification,
    CitizenReport,
    CitizenReportTimeline,
    EmergencyCorridorRequest,
    EmergencyCorridorTimeline,
    IncidentAlert,
)
from backend.app.services.traffic_history import migrate_database


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    migrate_database(engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_demo_headers(client: TestClient, role: str) -> dict:
    res = client.post(f"/api/auth/demo-login?role={role}")
    assert res.status_code == 200, f"Demo login failed for {role}: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_compare_routes_monitored_junctions_and_closure_avoidance(client, db_session):
    """Verify monitored junction routing metadata, conditions, heavy segments, and closure bypass."""
    baseline = client.post(
        "/api/routes/compare",
        json={
            "origin_id": "INT-01",
            "destination_id": "INT-07",
            "avoid_closed_roads": True,
        },
    )
    assert baseline.status_code == 200, baseline.text
    data = baseline.json()
    assert data["origin"] == "INT-01"
    assert data["destination"] == "INT-07"
    assert data["origin_label"]
    assert data["destination_label"]
    assert data["data_source"] in ("live_tomtom_corridor", "simulated_corridor_model")
    assert isinstance(data["is_live_data"], bool)
    assert len(data["routes"]) > 0

    for route in data["routes"]:
        assert route["traffic_condition"] in ("Smooth", "Moderate", "Heavy", "Severe")
        assert isinstance(route["traffic_heavy_roads"], list)
        assert route["delay_minutes"] >= 0
        assert route["data_source"] in ("live_tomtom_corridor", "simulated_corridor_model")

    rec_routes = [r for r in data["routes"] if r["is_recommended"]]
    assert len(rec_routes) == 1

    closure_id = "TEST-CLOSE-INT02"
    closure_alert = IncidentAlert(
        id=closure_id,
        intersection_id="INT-02",
        incident_type="road_closure",
        severity="critical",
        description_en="Test emergency bridge repair closure.",
        description_hi="परीक्षण पुल मरम्मत सड़क बंद।",
        recommended_action_en="Use bypass corridor.",
        recommended_action_hi="बायपास कॉरिडोर का उपयोग करें।",
        status="open",
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        is_simulated=True,
        source="simulated",
    )
    try:
        db_session.add(closure_alert)
        db_session.commit()

        bypass_res = client.post(
            "/api/routes/compare",
            json={
                "origin_id": "INT-01",
                "destination_id": "INT-07",
                "avoid_closed_roads": True,
            },
        )
        assert bypass_res.status_code == 200, bypass_res.text
        bypass_data = bypass_res.json()
        assert bypass_data["road_closure_active"] is True
        rec_bypass = next((r for r in bypass_data["routes"] if r["is_recommended"]), None)
        assert rec_bypass is not None
        assert bypass_data["affected_intersection"] not in rec_bypass["intersections_path"] or len(bypass_data["routes"]) == 1
    finally:
        db_session.query(IncidentAlert).filter(IncidentAlert.id == closure_id).delete()
        db_session.commit()


def test_compare_routes_custom_coordinates_offline_honest_fallback(client):
    """Custom coordinates with unavailable live routing must return honest estimated_distance_model."""
    with patch(
        "backend.app.api.endpoints.traffic_provider_instance.fetch_live_routes",
        new_callable=AsyncMock,
        return_value={
            "available": False,
            "reason": "TomTom live routing key unavailable in offline verification.",
        },
    ):
        res = client.post(
            "/api/routes/compare",
            json={
                "origin_text": "BSM Chowk, Roorkee",
                "destination_text": "IIT Roorkee Main Gate",
                "origin_lat": 29.8543,
                "origin_lon": 77.8880,
                "destination_lat": 29.8649,
                "destination_lon": 77.8965,
                "avoid_closed_roads": True,
            },
        )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["data_source"] == "estimated_distance_model"
    assert data["is_live_data"] is False
    assert data["unavailable_reason"] is not None
    assert "unavailable" in data["unavailable_reason"].lower()
    assert len(data["routes"]) == 1
    opt = data["routes"][0]
    assert opt["traffic_condition"] == "Estimated"
    assert opt["data_source"] == "estimated_distance_model"
    assert opt["is_live_data"] is False
    assert opt["distance_km"] > 0


def test_compare_routes_custom_coordinates_live_tomtom_mocked(client):
    """Custom coordinates return live_tomtom_routing alternatives when TomTom Routing API succeeds."""
    mocked_live = {
        "available": True,
        "routes": [
            {
                "name_en": "Fastest Live Route (via Ring Road)",
                "name_hi": "सबसे तेज़ लाइव मार्ग",
                "dist": 8.4,
                "time": 16.5,
                "exposure": 12.0,
                "condition": "Smooth",
                "heavy_roads": [],
                "delay_min": 1.5,
            },
            {
                "name_en": "Alternative Live Route (via Main Bazar)",
                "name_hi": "वैकल्पिक लाइव मार्ग",
                "dist": 7.9,
                "time": 26.0,
                "exposure": 48.0,
                "condition": "Heavy",
                "heavy_roads": ["Main Bazar Junction (~16 km/h)"],
                "delay_min": 8.0,
            },
        ],
    }
    with patch(
        "backend.app.api.endpoints.traffic_provider_instance.fetch_live_routes",
        new_callable=AsyncMock,
        return_value=mocked_live,
    ):
        res = client.post(
            "/api/routes/compare",
            json={
                "origin_text": "Current GPS (Roorkee)",
                "destination_text": "Haridwar Bypass",
                "origin_lat": 29.8543,
                "origin_lon": 77.8880,
                "destination_lat": 29.9100,
                "destination_lon": 78.0200,
                "avoid_closed_roads": True,
            },
        )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["data_source"] == "live_tomtom_routing"
    assert data["is_live_data"] is True
    assert data["unavailable_reason"] is None
    assert len(data["routes"]) == 2
    assert data["routes"][0]["is_recommended"] is True
    assert data["routes"][0]["traffic_condition"] == "Smooth"
    assert data["routes"][0]["is_live_data"] is True
    assert data["routes"][1]["traffic_condition"] == "Heavy"
    assert "Main Bazar Junction (~16 km/h)" in data["routes"][1]["traffic_heavy_roads"]


def test_compare_routes_unresolvable_custom_place_returns_unavailable(client):
    """Unresolvable custom text endpoints return empty routes instead of fabricated data."""
    with patch(
        "backend.app.api.endpoints.traffic_provider_instance.geocode_place",
        new_callable=AsyncMock,
        return_value=None,
    ):
        res = client.post(
            "/api/routes/compare",
            json={
                "origin_text": "Unresolved Place Alpha 999",
                "destination_text": "Unresolved Place Beta 999",
                "avoid_closed_roads": True,
            },
        )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["routes"] == []
    assert data["data_source"] == "unavailable"
    assert data["is_live_data"] is False
    assert data["unavailable_reason"]


def test_emergency_corridors_all_citizen_vehicle_types_gps_and_rbac(client, db_session):
    """Verify Citizen SOS accepts all frontend vehicle types, GPS origin, user_id empty isolation, and RBAC."""
    citizen_headers = _get_demo_headers(client, "citizen")
    authority_headers = _get_demo_headers(client, "authority")
    test_user_id = "cit_test_sos_probe_01"

    # Unused user_id must return empty list rather than seeding a fake demo record
    empty_res = client.get(f"/api/emergency/corridors?user_id={test_user_id}")
    assert empty_res.status_code == 200
    assert empty_res.json() == []

    created_ids = []
    vehicle_types = ["fire_truck", "police_escort", "medical_emergency", "ambulance"]
    try:
        for v_type in vehicle_types:
            create_res = client.post(
                "/api/emergency/corridors",
                headers=citizen_headers,
                json={
                    "vehicle_type": v_type,
                    "origin_id": "GPS_CURRENT",
                    "origin_name": "GPS Location near Connaught Place",
                    "origin_lat": 28.6305,
                    "origin_lon": 77.2185,
                    "destination_id": "INT-04",
                    "destination_name": "AIIMS Trauma Centre Arterial [INT-04]",
                    "priority": "critical",
                    "description": f"Automated verification dispatch for {v_type}",
                    "user_id": test_user_id,
                },
            )
            assert create_res.status_code == 200, f"{v_type} failed: {create_res.text}"
            body = create_res.json()
            created_ids.append(body["id"])
            assert body["status"] == "REQUESTED"
            assert body["vehicle_type"] == v_type
            assert body["origin_lat"] == pytest.approx(28.6305, abs=1e-4)
            assert body["origin_lon"] == pytest.approx(77.2185, abs=1e-4)
            assert len(body["route_path"]) >= 1

        history_res = client.get(f"/api/emergency/corridors?user_id={test_user_id}")
        assert history_res.status_code == 200
        returned_ids = {item["id"] for item in history_res.json()}
        assert set(created_ids).issubset(returned_ids)

        target_id = created_ids[0]
        # Citizens & unauthenticated requests cannot change official emergency corridor status
        unauth_put = client.put(
            f"/api/emergency/corridors/{target_id}/status",
            json={"status": "APPROVED", "authority_notes": "Unauthorized"},
        )
        assert unauth_put.status_code == 401

        cit_put = client.put(
            f"/api/emergency/corridors/{target_id}/status",
            headers=citizen_headers,
            json={"status": "APPROVED", "authority_notes": "Citizen cannot approve"},
        )
        assert cit_put.status_code == 403

        auth_put = client.put(
            f"/api/emergency/corridors/{target_id}/status",
            headers=authority_headers,
            json={"status": "APPROVED", "authority_notes": "Verified green wave cleared."},
        )
        assert auth_put.status_code == 200, auth_put.text
        assert auth_put.json()["status"] == "APPROVED"
    finally:
        if created_ids:
            db_session.query(EmergencyCorridorTimeline).filter(
                EmergencyCorridorTimeline.request_id.in_(created_ids)
            ).delete(synchronize_session=False)
            db_session.query(EmergencyCorridorRequest).filter(
                EmergencyCorridorRequest.id.in_(created_ids)
            ).delete(synchronize_session=False)
            db_session.query(CitizenNotification).filter(
                CitizenNotification.user_id == test_user_id
            ).delete(synchronize_session=False)
            db_session.commit()


def test_citizen_reports_accept_all_citizen_categories(client, db_session):
    """Verify Citizen Complaint API accepts all public categories and persists GPS + unverified status."""
    citizen_headers = _get_demo_headers(client, "citizen")
    test_user_id = "cit_test_report_probe_01"
    categories = [
        "damaged_road",
        "congestion",
        "broken_signal",
        "accident",
        "road_blockage",
        "waterlogging",
    ]
    created_ids = []
    try:
        for cat in categories:
            res = client.post(
                "/api/citizen/reports",
                headers=citizen_headers,
                json={
                    "category": cat,
                    "location_name": f"Test Sector {cat}",
                    "latitude": 28.6315,
                    "longitude": 77.2167,
                    "description": f"Verification test submission for category {cat}",
                    "user_id": test_user_id,
                },
            )
            assert res.status_code == 200, f"Category {cat} rejected: {res.text}"
            item = res.json()
            created_ids.append(item["id"])
            assert item["status"] == "unverified"
            assert item["category"] == cat
            assert len(item["timeline"]) >= 1
    finally:
        if created_ids:
            db_session.query(CitizenReportTimeline).filter(
                CitizenReportTimeline.report_id.in_(created_ids)
            ).delete(synchronize_session=False)
            db_session.query(CitizenReport).filter(
                CitizenReport.id.in_(created_ids)
            ).delete(synchronize_session=False)
            db_session.query(CitizenNotification).filter(
                CitizenNotification.user_id == test_user_id
            ).delete(synchronize_session=False)
            db_session.commit()

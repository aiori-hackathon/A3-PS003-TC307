import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_role_based_token_issuance():
    """Verify backend issues distinct JWT tokens with correct roles."""
    # 1. Citizen demo login
    res_citizen = client.post("/api/auth/demo-login?role=citizen")
    assert res_citizen.status_code == 200
    data_citizen = res_citizen.json()
    assert data_citizen["user"]["role"] == "citizen"
    assert "access_token" in data_citizen

    # 2. Admin/Authority demo login
    res_admin = client.post("/api/auth/demo-login?role=authority")
    assert res_admin.status_code == 200
    data_admin = res_admin.json()
    assert data_admin["user"]["role"] in ("admin", "authority")
    assert "access_token" in data_admin


def test_citizen_blocked_from_admin_operational_endpoints():
    """Verify citizen role is strictly rejected with HTTP 403 Forbidden on admin APIs."""
    res_citizen = client.post("/api/auth/demo-login?role=citizen")
    token = res_citizen.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Surge simulation trigger
    res_surge = client.post("/api/dashboard/surge", headers=headers)
    assert res_surge.status_code == 403
    assert "Access forbidden" in res_surge.json()["detail"]

    # Digital Twin simulation
    res_sim = client.post("/api/digital-twin/simulate", json={"scenario": "normal"}, headers=headers)
    assert res_sim.status_code == 403

    # Federated learning round initiation
    res_fl = client.post("/api/federated/rounds/start", json={"client_ids": ["client_a"]}, headers=headers)
    assert res_fl.status_code == 403

    # Communication optimization experiment
    res_opt = client.post(
        "/api/optimizer/experiments",
        json={"top_k_retention_pct": 50.0, "int8_quantization": True, "event_driven_threshold": 0.15},
        headers=headers,
    )
    assert res_opt.status_code == 403

    # Coordinated collection trigger
    res_coord = client.post("/api/traffic/coordinate-collection", headers=headers)
    assert res_coord.status_code == 403

    # Incident status override
    res_inc = client.patch("/api/incidents/INC-01", json={"status": "resolved"}, headers=headers)
    assert res_inc.status_code == 403


def test_citizen_permitted_commuter_endpoints():
    """Verify citizen role can access all citizen commute APIs successfully."""
    res_citizen = client.post("/api/auth/demo-login?role=citizen")
    token = res_citizen.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Intersections
    res_inter = client.get("/api/traffic/intersections", headers=headers)
    assert res_inter.status_code == 200
    assert len(res_inter.json()) == 8

    # Incidents list
    res_inc = client.get("/api/incidents", headers=headers)
    assert res_inc.status_code == 200

    # Predictions run
    res_pred = client.post("/api/predictions/run", json={"intersection_id": "INT-01", "horizon_minutes": 30}, headers=headers)
    assert res_pred.status_code == 200
    assert "predicted_speed" in res_pred.json()

    # Routes compare
    res_routes = client.post("/api/routes/compare", json={"origin_id": "INT-01", "destination_id": "INT-07", "avoid_closed_roads": True}, headers=headers)
    assert res_routes.status_code == 200
    assert "routes" in res_routes.json()

    # Profile check
    res_me = client.get("/api/auth/me", headers=headers)
    assert res_me.status_code == 200
    assert res_me.json()["role"] == "citizen"


def test_admin_permitted_operational_endpoints():
    """Verify admin role has full access to operational controls."""
    res_admin = client.post("/api/auth/demo-login?role=authority")
    token = res_admin.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Surge simulation
    res_surge = client.post("/api/dashboard/surge", headers=headers)
    assert res_surge.status_code == 200
    assert "affected_nodes" in res_surge.json()

    # Dashboard summary
    res_dash = client.get("/api/dashboard/summary", headers=headers)
    assert res_dash.status_code == 200
    assert res_dash.json()["total_intersections"] == 8

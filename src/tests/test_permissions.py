import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import engine, Base, SessionLocal
from backend.app.models.database import User, PasswordResetToken
from backend.app.services.seed_data import seed_database
from backend.app.services.auth import seed_demo_user


def test_role_security_and_permissions():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    seed_demo_user(db)

    # Clean up test user
    db.query(User).filter(User.email == "public.citizen@test.com").delete()
    db.commit()

    client = TestClient(app)

    # 1. Public Registration MUST always be assigned role="citizen"
    reg_res = client.post("/api/auth/register", json={
        "full_name": "Pooja Verma",
        "email": "public.citizen@test.com",
        "password": "CitizenSecret@2026",
        "confirm_password": "CitizenSecret@2026",
    })
    assert reg_res.status_code == 201, reg_res.text
    citizen_data = reg_res.json()
    assert citizen_data["user"]["role"] == "citizen", f"Expected citizen, got {citizen_data['user']['role']}"
    citizen_token = citizen_data["access_token"]
    citizen_headers = {"Authorization": f"Bearer {citizen_token}"}
    print("Test 1: Public registration strictly assigns citizen role OK!")

    # 2. Citizen attempt to access operational endpoints MUST receive HTTP 403 Forbidden
    res_surge = client.post("/api/dashboard/surge", headers=citizen_headers)
    assert res_surge.status_code == 403, f"Expected 403, got {res_surge.status_code}"
    print("Test 2a: Citizen blocked from /dashboard/surge OK!")

    res_fl = client.post("/api/federated/rounds/start", json={"client_ids": ["client_a"]}, headers=citizen_headers)
    assert res_fl.status_code == 403, f"Expected 403, got {res_fl.status_code}"
    print("Test 2b: Citizen blocked from /federated/rounds/start OK!")

    res_opt = client.post("/api/optimizer/experiments", json={"top_k_retention_pct": 50.0, "int8_quantization": True, "event_driven_threshold": 0.15}, headers=citizen_headers)
    assert res_opt.status_code == 403, f"Expected 403, got {res_opt.status_code}"
    print("Test 2c: Citizen blocked from /optimizer/experiments OK!")

    res_sim = client.post("/api/digital-twin/simulate", json={"scenario": "normal"}, headers=citizen_headers)
    assert res_sim.status_code == 403, f"Expected 403, got {res_sim.status_code}"
    print("Test 2d: Citizen blocked from /digital-twin/simulate OK!")

    # 3. Authority Demo Login gets authority role and CAN access operational endpoints
    res_auth_login = client.post("/api/auth/demo-login?role=authority")
    assert res_auth_login.status_code == 200
    auth_data = res_auth_login.json()
    assert auth_data["user"]["role"] in ("admin", "authority")
    auth_token = auth_data["access_token"]
    auth_headers = {"Authorization": f"Bearer {auth_token}"}
    print("Test 3: Authority demo login receives admin/authority role OK!")

    # 4. Authority access to operational endpoint succeeds with HTTP 200
    res_auth_surge = client.post("/api/dashboard/surge", headers=auth_headers)
    assert res_auth_surge.status_code == 200
    print("Test 4: Authority access to /dashboard/surge allowed OK!")

    # 5. Citizen demo login gets citizen role
    res_citizen_demo = client.post("/api/auth/demo-login?role=citizen")
    assert res_citizen_demo.status_code == 200
    assert res_citizen_demo.json()["user"]["role"] == "citizen"
    print("Test 5: Citizen demo login returns citizen role OK!")

    db.close()
    print("ALL ROLE SECURITY & BACKEND PERMISSION TESTS PASSED!")


if __name__ == "__main__":
    test_role_security_and_permissions()

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import engine, Base, SessionLocal
from backend.app.models.database import User, PasswordResetToken
from backend.app.services.seed_data import seed_database
from backend.app.services.auth import seed_demo_user


def test_auth_system():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    seed_demo_user(db)

    # Clean up test user and tokens to ensure repeatable idempotent test execution
    db.query(PasswordResetToken).delete()
    db.query(User).filter(User.email.in_(["rohit.sharma@trafficfl.gov.in", "mismatch@trafficfl.gov.in"])).delete()
    db.commit()

    client = TestClient(app)

    # 1. Successful Registration
    reg_payload = {
        "full_name": "Dr. Rohit Sharma",
        "email": "rohit.sharma@trafficfl.gov.in",
        "password": "SecurePassword@2026",
        "confirm_password": "SecurePassword@2026",
    }
    res_reg = client.post("/api/auth/register", json=reg_payload)
    assert res_reg.status_code == 201, res_reg.text
    reg_data = res_reg.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == "rohit.sharma@trafficfl.gov.in"
    print("Test 1: User Registration OK!")

    # 2. Duplicate Email Rejection
    res_dup = client.post("/api/auth/register", json=reg_payload)
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.json()["detail"].lower()
    print("Test 2: Duplicate Email Rejection OK!")

    # 3. Password Mismatch Rejection
    bad_match = {
        "full_name": "Test User",
        "email": "mismatch@trafficfl.gov.in",
        "password": "Password123",
        "confirm_password": "DifferentPassword123",
    }
    res_mismatch = client.post("/api/auth/register", json=bad_match)
    assert res_mismatch.status_code == 400
    print("Test 3: Password Mismatch Rejection OK!")

    # 4. Successful Login
    login_payload = {
        "email": "rohit.sharma@trafficfl.gov.in",
        "password": "SecurePassword@2026",
    }
    res_login = client.post("/api/auth/login", json=login_payload)
    assert res_login.status_code == 200
    login_data = res_login.json()
    token = login_data["access_token"]
    assert token is not None
    print("Test 4: User Login OK!")

    # 5. Invalid Password Rejection
    res_bad_login = client.post("/api/auth/login", json={
        "email": "rohit.sharma@trafficfl.gov.in",
        "password": "WrongPassword123"
    })
    assert res_bad_login.status_code == 401
    print("Test 5: Bad Password Rejection OK!")

    # 6. Demo Login
    res_demo = client.post("/api/auth/demo-login")
    assert res_demo.status_code == 200
    assert res_demo.json()["user"]["is_demo"] is True
    print("Test 6: Demo Login OK!")

    # 7. Protected Endpoint /api/auth/me
    headers = {"Authorization": f"Bearer {token}"}
    res_me = client.get("/api/auth/me", headers=headers)
    assert res_me.status_code == 200
    assert res_me.json()["email"] == "rohit.sharma@trafficfl.gov.in"
    print("Test 7: Protected /api/auth/me with valid Bearer token OK!")

    # 8. Unauthenticated Access to /api/auth/me (must fail with 401)
    res_unauth = client.get("/api/auth/me")
    assert res_unauth.status_code == 401
    print("Test 8: Unauthenticated access blocked OK!")

    # 9. Forgot Password Workflow
    res_forgot = client.post("/api/auth/forgot-password", json={"email": "rohit.sharma@trafficfl.gov.in"})
    assert res_forgot.status_code == 200
    forgot_data = res_forgot.json()
    reset_token = forgot_data.get("reset_token")
    assert reset_token is not None
    print("Test 9: Forgot Password token generation OK!")

    # 10. Reset Password with Single-Use Verification
    res_reset = client.post("/api/auth/reset-password", json={
        "token": reset_token,
        "new_password": "NewUpdatedPassword@2026",
        "confirm_password": "NewUpdatedPassword@2026"
    })
    assert res_reset.status_code == 200
    print("Test 10: Reset Password with token OK!")

    # 11. Reusing Token Must Fail (Single-use security)
    res_reuse = client.post("/api/auth/reset-password", json={
        "token": reset_token,
        "new_password": "AnotherPassword@2026",
    })
    assert res_reuse.status_code == 400
    print("Test 11: Single-use token reuse prevention OK!")

    # 12. Login with New Password
    res_new_login = client.post("/api/auth/login", json={
        "email": "rohit.sharma@trafficfl.gov.in",
        "password": "NewUpdatedPassword@2026"
    })
    assert res_new_login.status_code == 200
    print("Test 12: Login with New Password OK!")

    db.close()
    print("ALL AUTHENTICATION TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    test_auth_system()

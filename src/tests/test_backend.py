import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import engine, Base, SessionLocal
from backend.app.services.seed_data import seed_database
from backend.app.optimizer.compression import optimizer_instance
import numpy as np


def test_system():
    # 1. DB Init
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)

    client = TestClient(app)

    # 2. Health check
    res_health = client.get("/api/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "healthy"
    print("Health check OK!")

    # 3. Dashboard summary
    res_dash = client.get("/api/dashboard/summary")
    assert res_dash.status_code == 200
    dash_data = res_dash.json()
    assert dash_data["total_intersections"] == 8
    assert dash_data["active_edge_nodes"] == 3
    print("Dashboard summary OK!", dash_data["total_intersections"], "intersections")

    # 4. Predictions test
    res_pred = client.post("/api/predictions/run", json={"intersection_id": "INT-01", "horizon_minutes": 30})
    assert res_pred.status_code == 200
    pred_data = res_pred.json()
    assert "predicted_volume" in pred_data
    assert pred_data["test_mae"] > 0
    assert pred_data["inference_latency_ms"] >= 0
    print(f"Prediction OK! Horizon 30m: {pred_data['predicted_volume']} vehicles, Latency: {pred_data['inference_latency_ms']}ms, Test MAE: {pred_data['test_mae']}")

    # Authenticate as authority to access protected municipal endpoints
    auth_res = client.post("/api/auth/demo-login?role=authority")
    assert auth_res.status_code == 200
    token = auth_res.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 5. Federated Learning Round test
    res_fl = client.post("/api/federated/rounds/start", json={
        "aggregation_method": "FedAvg",
        "apply_compression": True,
        "top_k_retention_pct": 50.0,
        "int8_quantization": True
    }, headers=auth_headers)
    assert res_fl.status_code == 200
    fl_data = res_fl.json()
    assert fl_data["status"] == "success"
    assert fl_data["round_number"] >= 7
    print(f"Federated Round OK! Round {fl_data['round_number']}, Loss: {fl_data['global_loss']}, Payload: {fl_data['total_payload_bytes']} bytes")

    # 6. Communication Optimizer experiment & Pareto test
    res_opt = client.post("/api/optimizer/experiments", json={
        "name": "Test Optimizer Run",
        "top_k_retention_pct": 35.0,
        "int8_quantization": True,
        "event_driven_threshold": 0.25,
        "rounds": 5
    }, headers=auth_headers)
    assert res_opt.status_code == 200
    opt_data = res_opt.json()
    assert opt_data["savings_pct"] > 70.0
    print(f"Optimizer Experiment OK! Savings: {opt_data['savings_pct']}%, Reconstruction MSE: {opt_data['reconstruction_mse']}")

    # 7. Pareto test
    res_pareto = client.get("/api/optimizer/pareto")
    assert res_pareto.status_code == 200
    pareto_data = res_pareto.json()
    assert len(pareto_data["experiments"]) > 0
    assert pareto_data["recommended_config"] is not None
    print(f"Pareto Frontier OK! {len(pareto_data['experiments'])} experiments, Recommended: {pareto_data['recommended_config']['name']}")

    # 8. Chatbot test (English & Hindi)
    res_chat_en = client.post("/api/chat", json={"message": "Which intersections are currently congested?"})
    assert res_chat_en.status_code == 200
    assert len(res_chat_en.json()["response"]) > 0
    print("Chatbot EN response OK!")

    res_chat_hi = client.post("/api/chat", json={"message": "फेडरेटेड लर्निंग से संचार में कितनी बचत हुई?"})
    assert res_chat_hi.status_code == 200
    assert len(res_chat_hi.json()["response"]) > 0
    assert res_chat_hi.json()["language"] == "hi"
    print("Chatbot HI response OK!")

    # 9. Quantization unit test check
    test_tensor = np.array([-1.5, 0.0, 0.25, 1.8, 3.4], dtype=np.float32)
    q_vals, scale, x_min, rec_mse = optimizer_instance.quantize_int8(test_tensor)
    assert len(q_vals) == 5
    assert rec_mse < 0.01
    print(f"Quantization verification OK! Scale: {scale:.4f}, MSE: {rec_mse:.6f}")

    db.close()
    print("ALL BACKEND VERIFICATION TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    test_system()

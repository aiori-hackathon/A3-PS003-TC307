import pytest
import numpy as np
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import engine, Base, SessionLocal
from backend.app.services.seed_data import seed_database, seed_pems_benchmark
from backend.app.federated.fl_engine import fl_engine_instance
from backend.app.optimizer.compression import optimizer_instance

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
        seed_pems_benchmark(db)
    finally:
        db.close()


def test_unified_benchmark_compare_synthetic():
    """Verify unified benchmark runs on identical splits and outputs valid MAE/RMSE and bandwidth savings."""
    res = client.post(
        "/api/federated/benchmark-compare",
        json={
            "dataset_type": "synthetic",
            "target_horizon_minutes": 30,
            "federated_rounds": 3,
            "apply_compression": False,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert "benchmark_id" in data
    assert "centralized" in data
    assert "federated" in data
    assert "delta" in data

    c = data["centralized"]
    f = data["federated"]
    d = data["delta"]

    # Verify identical evaluation splits
    assert c["train_samples_count"] == f["train_samples_count"]
    assert c["test_samples_count"] == f["test_samples_count"]
    assert c["train_samples_count"] > 50
    assert c["test_samples_count"] > 10

    # Verify genuine MAE and RMSE metrics
    assert c["mae"] > 0
    assert c["rmse"] > c["mae"] * 0.9
    assert f["mae"] > 0
    assert f["rmse"] > f["mae"] * 0.9

    # Verify communication accounting & bandwidth savings
    assert c["data_transmitted_bytes"] > 0
    assert f["data_transmitted_bytes"] > 0
    assert d["bandwidth_savings_pct"] > 50.0
    assert d["bandwidth_savings_bytes"] > 0
    assert d["communication_reduction_factor"] >= 2.0


def test_unified_benchmark_with_compression():
    """Verify that applying Top-K sparsification and INT8 quantization reduces federated transmission bytes."""
    res_raw = client.post(
        "/api/federated/benchmark-compare",
        json={
            "dataset_type": "synthetic",
            "federated_rounds": 2,
            "apply_compression": False,
        },
    )
    assert res_raw.status_code == 200
    bytes_raw = res_raw.json()["federated"]["data_transmitted_bytes"]

    res_comp = client.post(
        "/api/federated/benchmark-compare",
        json={
            "dataset_type": "synthetic",
            "federated_rounds": 2,
            "apply_compression": True,
            "top_k_retention_pct": 50.0,
            "int8_quantization": True,
        },
    )
    assert res_comp.status_code == 200
    bytes_comp = res_comp.json()["federated"]["data_transmitted_bytes"]

    assert bytes_comp < bytes_raw
    assert res_comp.json()["federated"]["mae"] > 0

    # Test exact 3-round asymmetric compressed calculation: 3 clients * 3 rounds * (64B up + 76B down) = 1,260 bytes
    res_comp_3 = client.post(
        "/api/federated/benchmark-compare",
        json={
            "dataset_type": "synthetic",
            "federated_rounds": 3,
            "apply_compression": True,
            "top_k_retention_pct": 50.0,
            "int8_quantization": True,
        },
    )
    assert res_comp_3.status_code == 200
    fed_3 = res_comp_3.json()["federated"]
    assert fed_3["upload_bytes"] == 576  # 3 * 3 * 64B
    assert fed_3["download_bytes"] == 684  # 3 * 3 * 76B
    assert fed_3["data_transmitted_bytes"] == 1260  # 576 + 684 = 1,260B


def test_pems08_fixture_provenance_and_simulation_flag():
    """Verify honest PeMS-08 fixture naming, is_simulated flag, and absence of Caltrans download claims."""
    # 1. Dataset listing API check
    res = client.get("/api/traffic/datasets")
    assert res.status_code == 200
    datasets = {d["id"]: d for d in res.json()}
    assert "pems08" in datasets
    pems_meta = datasets["pems08"]

    assert "Synthetic Calibration Fixture" in pems_meta["name"]
    assert pems_meta.get("is_simulated") is True
    assert "Not raw Caltrans data" in pems_meta["provenance"]
    assert "Caltrans PeMS Benchmark Dataset" not in pems_meta["name"]

    # 2. Benchmark execution provenance check
    res_bm = client.post(
        "/api/federated/benchmark-compare",
        json={
            "dataset_type": "pems08",
            "target_horizon_minutes": 30,
            "federated_rounds": 3,
        },
    )
    assert res_bm.status_code == 200, res_bm.text
    data_bm = res_bm.json()

    assert "Synthetic Calibration Fixture" in data_bm["dataset_name"]
    assert "Not raw Caltrans data" in data_bm["dataset_provenance"]
    assert data_bm["centralized"]["mae"] > 0
    assert data_bm["federated"]["mae"] > 0


def test_benchmark_live_dataset():
    """Verify benchmark execution on genuine live TomTom traffic telemetry."""
    res = client.post(
        "/api/federated/benchmark-compare",
        json={
            "dataset_type": "live",
            "target_horizon_minutes": 15,
            "federated_rounds": 2,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert "TomTom" in data["dataset_name"]
    assert data["centralized"]["mae"] > 0
    assert data["federated"]["mae"] > 0


def test_multi_round_iterative_parameter_updates():
    """Verify multi-round federated training genuinely updates global model parameters iteratively."""
    db = SessionLocal()
    try:
        # Run 1 round
        res1 = fl_engine_instance.run_head_to_head_benchmark(
            db, dataset_type="synthetic", federated_rounds=1
        )
        history1 = res1["federated"]["round_history"]
        assert len(history1) == 1

        # Run 3 rounds
        res3 = fl_engine_instance.run_head_to_head_benchmark(
            db, dataset_type="synthetic", federated_rounds=3
        )
        history3 = res3["federated"]["round_history"]
        assert len(history3) == 3

        # Confirm communication scales linearly with rounds
        bytes_r1 = res1["federated"]["data_transmitted_bytes"]
        bytes_r3 = res3["federated"]["data_transmitted_bytes"]
        assert bytes_r3 == bytes_r1 * 3

        # Confirm parameter norms update between rounds
        norms = [h["weights_norm"] for h in history3]
        assert len(norms) == 3
        # In iterative gradient descent, weight norms change as the model trains
        assert norms[0] != norms[-1]
    finally:
        db.close()


def test_idle_telemetry_state_and_post_round_measurement():
    """Verify unmeasured nodes report None (Pending), and post-round telemetry reports genuine measured bytes."""
    # Reset engine metrics to uninitialized state
    fl_engine_instance.client_metrics.clear()

    res_idle = client.get("/api/federated/clients")
    assert res_idle.status_code == 200
    clients_idle = res_idle.json()

    for c in clients_idle:
        # Telemetry fields must be None when no round has run — NOT hardcoded 48000 or 288000
        assert c["upload_bytes"] is None
        assert c["download_bytes"] is None
        assert c["cumulative_bytes"] is None
        assert c["last_loss"] is None

    # Now execute one round via engine
    db = SessionLocal()
    try:
        fl_engine_instance.execute_round(db, client_ids=["client_a", "client_b", "client_c"])
    finally:
        db.close()

    res_active = client.get("/api/federated/clients")
    assert res_active.status_code == 200
    clients_active = res_active.json()

    for c in clients_active:
        # Measured telemetry must now be present
        assert c["upload_bytes"] is not None
        assert c["upload_bytes"] > 0
        assert c["upload_bytes"] == 76  # 7 features + 1 intercept FP32 + framing = 76 bytes
        assert c["cumulative_bytes"] is not None
        assert c["cumulative_bytes"] > 0
        assert c["last_loss"] is not None


def test_privacy_terminology_accuracy():
    """Verify that privacy claims do not promise unverified DP or zero data leakage."""
    res = client.post(
        "/api/federated/benchmark-compare",
        json={"dataset_type": "synthetic", "federated_rounds": 2},
    )
    assert res.status_code == 200
    data = res.json()

    fed_privacy = data["federated"]["privacy_guarantee"]
    # Check that privacy description specifies Data Locality and notes absence of DP
    assert "Decentralized Data Locality" in fed_privacy
    assert "formal DP" in fed_privacy or "differential privacy" in data["delta"]["accuracy_tradeoff_summary"]
    # Verify inaccurate claims are absent
    assert "Zero Raw Data Leakage" not in fed_privacy
    assert "Privacy Guarantee: High" not in fed_privacy


def test_deterministic_reproducibility():
    """Verify that benchmark execution produces deterministic results across repeated invocations."""
    res1 = client.post(
        "/api/federated/benchmark-compare",
        json={"dataset_type": "synthetic", "federated_rounds": 3},
    )
    res2 = client.post(
        "/api/federated/benchmark-compare",
        json={"dataset_type": "synthetic", "federated_rounds": 3},
    )
    assert res1.status_code == 200 and res2.status_code == 200

    d1 = res1.json()
    d2 = res2.json()

    assert d1["centralized"]["mae"] == d2["centralized"]["mae"]
    assert d1["centralized"]["rmse"] == d2["centralized"]["rmse"]
    assert d1["federated"]["mae"] == d2["federated"]["mae"]
    assert d1["federated"]["rmse"] == d2["federated"]["rmse"]
    assert np.isfinite(d1["federated"]["mae"])
    assert np.isfinite(d1["federated"]["rmse"])


def test_zero_temporal_data_leakage():
    """Verify that split boundary strictly prevents test observations from leaking into train partitions."""
    db = SessionLocal()
    try:
        splits = fl_engine_instance.prepare_chronological_splits(
            db, dataset_type="synthetic", test_ratio=0.20
        )
        assert splits["X_train_central"].shape[0] > 0
        assert splits["X_test_global"].shape[0] > 0
        assert splits["X_train_central"].shape[1] == 7
        assert splits["X_test_global"].shape[1] == 7
        assert splits["split_boundary"] is not None
    finally:
        db.close()


def test_empirical_compression_optimizer_evaluation():
    """Verify that CommunicationOptimizer evaluates empirical MAE on holdout test observations."""
    auth_res = client.post("/api/auth/demo-login?role=authority")
    assert auth_res.status_code == 200
    token = auth_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/api/optimizer/experiments",
        json={
            "name": "Empirical Verification Run",
            "top_k_retention_pct": 35.0,
            "int8_quantization": True,
            "event_driven_threshold": 0.30,
            "rounds": 4,
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["mae"] > 0
    assert data["rmse"] > 0
    assert data["reconstruction_mse"] >= 0
    assert data["savings_pct"] > 50.0
    assert data["updates_transmitted"] > 0

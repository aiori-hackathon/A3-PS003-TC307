"""
Automated verification tests for Prompt 1: Genuine Public Traffic Dataset integration (PS-003).
Covers dataset loading, schema validation, timestamp parsing & chronological sorting,
missing-value handling, deterministic sensor-to-client mapping, absence of synthetic fallbacks,
leakage-free chronological train/test separation, and end-to-end Centralized vs FedAvg benchmark execution.
"""

from pathlib import Path
import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.app.database import Base, SessionLocal, engine
from backend.app.federated.fl_engine import fl_engine_instance
from backend.app.federated.public_dataset import (
    PEMS08_FEATURE_NAMES,
    PublicDatasetNotFoundError,
    PublicDatasetValidationError,
    PublicTrafficDatasetLoader,
)
from backend.app.main import app
from backend.app.services.seed_data import seed_database, seed_pems_benchmark

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
        seed_pems_benchmark(db)
    finally:
        db.close()


def test_public_dataset_listing_distinguishes_genuine_vs_synthetic():
    """Verify /api/traffic/datasets exposes genuine PeMS08 separately from synthetic fixtures."""
    res = client.get("/api/traffic/datasets")
    assert res.status_code == 200, res.text
    datasets = {d["id"]: d for d in res.json()}

    assert "pems08_public" in datasets
    pub = datasets["pems08_public"]
    assert pub["is_active"] is True
    assert pub["is_simulated"] is False
    assert pub["is_genuine_public"] is True
    assert pub["ps003_eligible"] is True
    assert pub["nodes_count"] == 170
    assert pub["total_samples"] > 3_000_000
    assert "CC-BY-4.0" in pub["licensing"]
    assert "zenodo" in pub["documentation_url"].lower()
    assert pub["target_unit"] == "veh/5m"
    assert pub["status_error"] is None

    # Synthetic calibration fixtures must stay explicitly labeled non-official
    for syn_id in ("pems08", "synthetic"):
        assert syn_id in datasets
        assert datasets[syn_id]["is_simulated"] is True
        assert datasets[syn_id]["is_genuine_public"] is False
        assert datasets[syn_id]["ps003_eligible"] is False


def test_pems08_loading_chronological_purge_and_deterministic_clients():
    """
    Verify genuine PeMS08 loads cleanly, preserves all 170 original sensor IDs,
    maps deterministically to 4 virtual clients, and enforces leakage-free purge gap.
    """
    splits_a = PublicTrafficDatasetLoader.load_pems08_benchmark_splits(
        horizon_minutes=15, test_ratio=0.20, num_clients=4
    )
    splits_b = PublicTrafficDatasetLoader.load_pems08_benchmark_splits(
        horizon_minutes=15, test_ratio=0.20, num_clients=4
    )

    assert splits_a.dataset_id == "pems08_public"
    assert splits_a.sensors_count == 170
    assert len(splits_a.original_sensor_ids) == 170
    assert splits_a.original_sensor_ids[0] == "PEMS08-S000"
    assert splits_a.original_sensor_ids[-1] == "PEMS08-S169"
    assert splits_a.num_clients == 4
    assert splits_a.feature_names == PEMS08_FEATURE_NAMES
    assert splits_a.X_train_central.shape[1] == 8
    assert splits_a.X_test_global.shape[1] == 8

    # Deterministic partitioning and complete disjoint sensor coverage
    assert splits_a.client_sensor_map == splits_b.client_sensor_map
    assigned = [sid for sids in splits_a.client_sensor_map.values() for sid in sids]
    assert len(assigned) == 170
    assert len(set(assigned)) == 170

    # Preserves finite non-negative zero-traffic readings while tracking invalid/out-of-bounds exclusions
    assert splits_a.raw_points_total == 17856 * 170
    assert splits_a.invalid_or_dropout_points == 0
    assert splits_a.valid_points_count == splits_a.raw_points_total
    assert splits_a.extra_metadata.get("zero_traffic_points") == 10560

    # Strict temporal purge: max training target timestamp strictly precedes min test input timestamp
    assert splits_a.max_train_target_iso < splits_a.min_test_input_iso

    # Consistent concatenated train count between clients and centralized matrix
    sum_client_train = sum(len(v["X_train"]) for v in splits_a.client_data.values())
    assert sum_client_train == len(splits_a.X_train_central)


def test_no_synthetic_fallback_when_genuine_file_missing(tmp_path, monkeypatch):
    """Ensure missing genuine dataset files raise explicit errors rather than synthetic fallbacks."""
    with pytest.raises(PublicDatasetNotFoundError):
        PublicTrafficDatasetLoader.load_pems08_benchmark_splits(data_dir=tmp_path)

    meta_missing = PublicTrafficDatasetLoader.get_pems08_metadata(data_dir=tmp_path)
    assert meta_missing["is_active"] is False
    assert meta_missing["total_samples"] == 0
    assert meta_missing["status_error"] is not None

    # API endpoint must fail with HTTP 503 if DEFAULT_PUBLIC_DATA_DIR has no file
    monkeypatch.setattr(
        "backend.app.federated.public_dataset.DEFAULT_PUBLIC_DATA_DIR",
        tmp_path,
    )
    res = client.post(
        "/api/federated/benchmark-compare",
        json={"dataset_type": "pems08_public", "target_horizon_minutes": 15},
    )
    assert res.status_code == 503


def test_schema_validation_on_malformed_npz(tmp_path):
    """Malformed NPZ (missing 'data' key, wrong channel count, or excessive NaNs) must fail explicitly."""
    bad_key_npz = tmp_path / "PEMS08.npz"
    np.savez(bad_key_npz, wrong=np.zeros((100, 10, 3)))
    with pytest.raises(PublicDatasetValidationError, match="missing.*'data'|key 'data'"):
        PublicTrafficDatasetLoader.load_pems08_benchmark_splits(data_dir=tmp_path)

    bad_ch_npz = tmp_path / "PEMS08.npz"
    np.savez(bad_ch_npz, data=np.zeros((200, 10, 2)))
    with pytest.raises(PublicDatasetValidationError, match="Expected 3 channels"):
        PublicTrafficDatasetLoader.load_pems08_benchmark_splits(data_dir=tmp_path)

    all_nan_npz = tmp_path / "PEMS08.npz"
    arr = np.full((200, 8, 3), np.nan)
    np.savez(all_nan_npz, data=arr)
    with pytest.raises(PublicDatasetValidationError, match="Excessive invalid or missing records"):
        PublicTrafficDatasetLoader.load_pems08_benchmark_splits(data_dir=tmp_path)

    # Incompatible horizon for 5-minute data must fail validation explicitly
    with pytest.raises(PublicDatasetValidationError, match="multiple of 5"):
        PublicTrafficDatasetLoader.load_pems08_benchmark_splits(horizon_minutes=17)


def test_tabular_csv_validation_sorting_and_missing_values(tmp_path):
    """
    Verify tabular CSV validator:
    - rejects missing required columns
    - sorts shuffled timestamps chronologically per sensor
    - excludes NA/negative measurements cleanly
    - maps sorted original sensor_ids deterministically to 4 virtual clients
    """
    missing_col_csv = tmp_path / "missing_cols.csv"
    missing_col_csv.write_text("timestamp,sensor_id,flow\n2026-01-01T00:00:00Z,S1,120\n", encoding="utf-8")
    with pytest.raises(PublicDatasetValidationError, match="missing required columns"):
        PublicTrafficDatasetLoader.load_and_validate_tabular_csv(missing_col_csv)

    # Build a clean multi-sensor CSV in intentionally shuffled chronological order + isolated NA rows
    valid_csv = tmp_path / "shuffled_traffic.csv"
    rows = []
    sensors = ["SENS_D", "SENS_A", "SENS_C", "SENS_B"]
    from datetime import datetime, timedelta

    t0 = datetime(2026, 5, 1, 0, 0, 0)
    for step in range(40):
        ts = (t0 + timedelta(minutes=15 * step)).isoformat() + "Z"
        for idx, s in enumerate(sensors):
            if step == 10 and s == "SENS_B":
                rows.append(f"{ts},{s},NA,55.0,0.05")
            elif step == 11 and s == "SENS_C":
                rows.append(f"{ts},{s},-5,55.0,0.05")
            elif step == 12 and s == "SENS_D":
                # Valid zero-traffic observation must NOT be discarded
                rows.append(f"{ts},{s},0,55.0,0.0")
            else:
                flow = 150 + step * 2 + idx * 10
                spd = 60.0 - (step % 5)
                rows.append(f"{ts},{s},{flow},{spd},0.08")

    rows.reverse()  # intentionally unsorted chronological order
    valid_csv.write_text(
        "timestamp,sensor_id,flow,speed,occupy\n" + "\n".join(rows) + "\n",
        encoding="utf-8",
    )

    parsed = PublicTrafficDatasetLoader.load_and_validate_tabular_csv(
        valid_csv, horizon_minutes=15, test_ratio=0.20, num_clients=4
    )
    assert parsed.original_sensor_ids == ["SENS_A", "SENS_B", "SENS_C", "SENS_D"]
    assert parsed.invalid_or_dropout_points == 2  # NA and negative row excluded cleanly
    assert parsed.max_train_target_iso < parsed.min_test_input_iso
    assert parsed.X_train_central.shape[1] == 8
    assert parsed.X_test_global.shape[1] == 8


def test_pems08_public_benchmark_end_to_end():
    """Verify full Centralized vs FedAvg benchmark on genuine public PeMS08 via API."""
    res = client.post(
        "/api/federated/benchmark-compare",
        json={
            "dataset_type": "pems08_public",
            "target_horizon_minutes": 15,
            "federated_rounds": 5,
            "apply_compression": True,
            "top_k_retention_pct": 50.0,
            "int8_quantization": True,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["dataset_id"] == "pems08_public"
    assert data["is_simulated"] is False
    assert data["is_genuine_public"] is True
    assert data["data_type_label"] == "Public"
    assert data["target_unit"] == "veh/5m"
    assert data["sensors_count"] == 170
    assert "CC-BY-4.0" in (data.get("dataset_license") or "")

    c = data["centralized"]
    f = data["federated"]
    d = data["delta"]

    assert c["train_samples_count"] == f["train_samples_count"]
    assert c["test_samples_count"] == f["test_samples_count"]
    assert c["train_samples_count"] > 2_000_000
    assert c["test_samples_count"] > 500_000
    assert c["parameter_count"] == 9
    assert f["parameter_count"] == 9
    assert f["participating_clients"] == 4

    assert np.isfinite(c["mae"]) and c["mae"] > 0
    assert np.isfinite(f["mae"]) and f["mae"] > 0
    assert c["rmse"] >= c["mae"]
    assert f["rmse"] >= f["mae"]
    assert d["bandwidth_savings_pct"] > 99.0

    # Verify convergence progresses smoothly across rounds
    history = f["round_history"]
    assert len(history) == 5
    assert history[-1]["test_mae"] < history[0]["test_mae"]
    assert len(data["client_summary"]) == 4


def test_no_random_fallback_when_db_empty(monkeypatch):
    """Ensure fl_engine does not fall back to np.random.randn on empty DB partitions."""
    monkeypatch.setattr(np.random, "randn", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("np.random.randn must not be called as fallback")))
    db = SessionLocal()
    try:
        with pytest.raises(ValueError):
            fl_engine_instance.get_client_local_data(db, "non_existent_client_xyz")
    finally:
        db.close()

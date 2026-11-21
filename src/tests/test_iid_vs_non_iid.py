"""
Focused automated verification tests for Prompt 2: IID vs Non-IID Federated Learning Experiments.
Validates sample conservation, zero train/test temporal leakage, deterministic reproducibility,
genuine PeMS08 inter-client heterogeneity vs IID uniformity, Centralized invariance,
API schema validation, and backward compatibility.
"""

from datetime import datetime, timedelta
from pathlib import Path
import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.app.database import Base, SessionLocal, engine
from backend.app.federated.public_dataset import (
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


def _write_heterogeneous_corridor_csv(csv_path: Path, num_steps: int = 80) -> Path:
    """Create a deterministic 4-sensor chronological CSV fixture with distinct sensor regimes."""
    lines = ["timestamp,sensor_id,flow,speed,occupancy"]
    start = datetime(2025, 1, 1, 0, 0, 0)
    base_flows = {
        "S_A": 120.0,
        "S_B": 240.0,
        "S_C": 360.0,
        "S_D": 480.0,
    }
    for step in range(num_steps):
        ts = (start + timedelta(minutes=5 * step)).isoformat()
        wave = 25.0 * np.sin(step / 5.0)
        for idx, (sid, base_flow) in enumerate(base_flows.items()):
            flow = round(base_flow + wave + idx * 3.0 + (step % 7), 2)
            speed = round(max(20.0, 68.0 - idx * 6.0 - 0.5 * (step % 5)), 2)
            occ = round(min(0.95, 0.03 + idx * 0.04 + 0.002 * (step % 6)), 4)
            lines.append(f"{ts},{sid},{flow},{speed},{occ}")
    csv_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return csv_path


def _sorted_row_signature(X: np.ndarray, y: np.ndarray) -> np.ndarray:
    combined = np.column_stack([X, y])
    order = np.lexsort(combined.T[::-1])
    return combined[order]


def test_exact_sample_conservation_no_leakage_and_corridor_order(tmp_path: Path):
    """
    Verify on a deterministic 4-corridor CSV fixture that both IID and Non-IID:
    1. Partition every eligible training window cleanly with zero duplication or loss.
    2. Preserve an identical holdout test split with strict temporal purge isolation.
    3. Preserve ascending chronological window order within each Non-IID physical corridor.
    """
    csv_file = _write_heterogeneous_corridor_csv(tmp_path / "corridors.csv", num_steps=90)

    non_iid = PublicTrafficDatasetLoader.load_and_validate_tabular_csv(
        csv_file, horizon_minutes=15, test_ratio=0.20, num_clients=4,
        partition_strategy="non_iid", random_seed=42,
    )
    iid = PublicTrafficDatasetLoader.load_and_validate_tabular_csv(
        csv_file, horizon_minutes=15, test_ratio=0.20, num_clients=4,
        partition_strategy="iid", random_seed=42,
    )

    # Identical global chronological train/test splits and boundaries
    assert non_iid.max_train_target_iso < non_iid.min_test_input_iso
    assert non_iid.max_train_target_iso == iid.max_train_target_iso
    assert non_iid.min_test_input_iso == iid.min_test_input_iso
    assert non_iid.split_boundary_iso == iid.split_boundary_iso
    assert np.array_equal(non_iid.X_test_global, iid.X_test_global)
    assert np.array_equal(non_iid.y_test_global, iid.y_test_global)
    assert np.array_equal(non_iid.X_train_central, iid.X_train_central)
    assert np.array_equal(non_iid.y_train_central, iid.y_train_central)

    # Exact multiset conservation across partitioned client windows (no drop, no duplicate)
    for split_obj in (non_iid, iid):
        part_X = np.vstack([c["X_train"] for c in split_obj.client_data.values()])
        part_y = np.concatenate([c["y_train"] for c in split_obj.client_data.values()])
        assert len(part_X) == len(split_obj.X_train_central)
        assert np.allclose(
            _sorted_row_signature(part_X, part_y),
            _sorted_row_signature(split_obj.X_train_central, split_obj.y_train_central),
        )

    # Non-IID keeps original corridor sensors and chronological order inside each client
    assert non_iid.client_sensor_map["csv_zone_1"] == ["S_A"]
    assert non_iid.client_sensor_map["csv_zone_4"] == ["S_D"]
    for cid, cdata in non_iid.client_data.items():
        # Feature 3 is linear time progress within the dataset -> strictly non-decreasing
        time_progress = cdata["X_train"][:, 3]
        assert np.all(np.diff(time_progress) >= 0), f"{cid} lost chronological ordering"


def test_pems08_iid_vs_non_iid_distribution_heterogeneity_and_reproducibility():
    """
    Verify on genuine PEMS08.npz (h=15):
    - Total training observations across 4 clients equal Centralized train count (2,427,090).
    - IID produces nearly identical client distributions (CV < 1%) and balanced sample counts.
    - Non-IID preserves physical corridors with pronounced real flow/occupancy heterogeneity.
    - Identical seed reproduces identical partitions; different seed changes IID shuffling.
    """
    non_iid_a = PublicTrafficDatasetLoader.load_pems08_benchmark_splits(
        horizon_minutes=15, num_clients=4, partition_strategy="non_iid", random_seed=42
    )
    iid_a = PublicTrafficDatasetLoader.load_pems08_benchmark_splits(
        horizon_minutes=15, num_clients=4, partition_strategy="iid", random_seed=42
    )
    iid_repeat = PublicTrafficDatasetLoader.load_pems08_benchmark_splits(
        horizon_minutes=15, num_clients=4, partition_strategy="iid", random_seed=42
    )
    iid_other_seed = PublicTrafficDatasetLoader.load_pems08_benchmark_splits(
        horizon_minutes=15, num_clients=4, partition_strategy="iid", random_seed=99
    )

    # Conservation of training sample counts
    non_iid_counts = [s["train_samples"] for s in non_iid_a.client_statistics]
    iid_counts = [s["train_samples"] for s in iid_a.client_statistics]
    assert sum(non_iid_counts) == len(non_iid_a.X_train_central) == 2_427_090
    assert sum(iid_counts) == len(iid_a.X_train_central) == 2_427_090
    assert max(iid_counts) - min(iid_counts) <= 1

    # Identical global train/test summaries regardless of partitioning strategy
    assert non_iid_a.distribution_analysis["train_summary"] == iid_a.distribution_analysis["train_summary"]
    assert non_iid_a.distribution_analysis["test_summary"] == iid_a.distribution_analysis["test_summary"]

    # Non-IID exhibits genuine inter-corridor heterogeneity; IID is near-uniform
    iid_diff = iid_a.distribution_analysis["inter_client_differences"]
    non_iid_diff = non_iid_a.distribution_analysis["inter_client_differences"]
    assert iid_diff["flow_heterogeneity_cv_pct"] < 1.0
    assert non_iid_diff["flow_heterogeneity_cv_pct"] > iid_diff["flow_heterogeneity_cv_pct"] * 5.0
    assert non_iid_diff["flow_mean_range"] > iid_diff["flow_mean_range"] * 10.0

    # Deterministic seed reproducibility
    assert iid_a.client_statistics == iid_repeat.client_statistics
    for cid in iid_a.client_data:
        assert np.array_equal(iid_a.client_data[cid]["y_train"], iid_repeat.client_data[cid]["y_train"])

    assert iid_a.client_statistics != iid_other_seed.client_statistics
    assert not np.array_equal(
        iid_a.client_data["pems08_zone_1"]["y_train"],
        iid_other_seed.client_data["pems08_zone_1"]["y_train"],
    )


def test_benchmark_compare_api_iid_non_iid_and_centralized_invariance():
    """
    Verify /api/federated/benchmark-compare runs both IID and Non-IID on genuine PeMS08,
    keeps Centralized metrics invariant to partitioning, preserves provenance & license,
    and maintains backward-compatible defaults when partition_strategy is omitted.
    """
    res_iid = client.post(
        "/api/federated/benchmark-compare",
        json={
            "dataset_type": "pems08_public",
            "target_horizon_minutes": 15,
            "federated_rounds": 3,
            "partition_strategy": "iid",
            "random_seed": 42,
        },
    )
    assert res_iid.status_code == 200, res_iid.text
    d_iid = res_iid.json()

    res_non_iid = client.post(
        "/api/federated/benchmark-compare",
        json={
            "dataset_type": "pems08_public",
            "target_horizon_minutes": 15,
            "federated_rounds": 3,
            "partition_strategy": "non_iid",
            "random_seed": 42,
        },
    )
    assert res_non_iid.status_code == 200, res_non_iid.text
    d_non_iid = res_non_iid.json()

    # Backward compatibility when partition_strategy is omitted -> defaults to non_iid
    res_default = client.post(
        "/api/federated/benchmark-compare",
        json={
            "dataset_type": "pems08_public",
            "target_horizon_minutes": 15,
            "federated_rounds": 3,
        },
    )
    assert res_default.status_code == 200, res_default.text
    assert res_default.json()["partition_strategy"] == "non_iid"

    assert d_iid["partition_strategy"] == "iid"
    assert d_non_iid["partition_strategy"] == "non_iid"
    assert d_iid["is_genuine_public"] is True
    assert d_iid["is_simulated"] is False
    assert "CC-BY-4.0" in (d_iid.get("dataset_license") or "")

    # Centralized Ridge baseline is mathematically invariant to client partitioning
    assert d_iid["centralized"]["mae"] == d_non_iid["centralized"]["mae"]
    assert d_iid["centralized"]["rmse"] == d_non_iid["centralized"]["rmse"]
    assert d_iid["centralized"]["train_samples_count"] == d_non_iid["centralized"]["train_samples_count"]
    assert d_iid["centralized"]["test_samples_count"] == d_non_iid["centralized"]["test_samples_count"]

    for payload in (d_iid, d_non_iid):
        assert len(payload["client_statistics"]) == 4
        assert payload["federated"]["mae"] > 0
        assert payload["federated"]["rmse"] >= payload["federated"]["mae"] * 0.9
        assert len(payload["federated"]["round_history"]) == 3


def test_side_by_side_partition_comparison_endpoint_public_and_synthetic():
    """
    Verify POST /api/federated/benchmark-partition-compare executes controlled side-by-side
    IID vs Non-IID experiments under identical splits, rounds, hyperparameters, and seed
    for both genuine PeMS08 and synthetic fixtures, and stays reproducible across runs.
    """
    pub_res = client.post(
        "/api/federated/benchmark-partition-compare",
        json={
            "dataset_type": "pems08_public",
            "target_horizon_minutes": 15,
            "federated_rounds": 3,
            "random_seed": 42,
        },
    )
    assert pub_res.status_code == 200, pub_res.text
    pub = pub_res.json()

    assert pub["is_genuine_public"] is True
    assert pub["is_simulated"] is False
    assert pub["shared_config"]["centralized_independent_of_partition"] is True
    assert pub["centralized"]["train_samples_count"] == pub["iid"]["federated"]["train_samples_count"]
    assert pub["centralized"]["train_samples_count"] == pub["non_iid"]["federated"]["train_samples_count"]

    summary = pub["comparison_summary"]
    assert summary["iid_mae"] == pub["iid"]["federated"]["mae"]
    assert summary["non_iid_mae"] == pub["non_iid"]["federated"]["mae"]
    assert summary["non_iid_flow_mean_range"] > summary["iid_flow_mean_range"]
    assert summary["non_iid_flow_heterogeneity_cv_pct"] > summary["iid_flow_heterogeneity_cv_pct"]

    # Deterministic reproducibility on synthetic DB fixture
    syn_a = client.post(
        "/api/federated/benchmark-partition-compare",
        json={
            "dataset_type": "synthetic",
            "target_horizon_minutes": 15,
            "federated_rounds": 3,
            "random_seed": 42,
        },
    )
    syn_b = client.post(
        "/api/federated/benchmark-partition-compare",
        json={
            "dataset_type": "synthetic",
            "target_horizon_minutes": 15,
            "federated_rounds": 3,
            "random_seed": 42,
        },
    )
    assert syn_a.status_code == 200 and syn_b.status_code == 200
    da, db_json = syn_a.json(), syn_b.json()
    assert da["is_simulated"] is True
    assert da["is_genuine_public"] is False
    assert da["centralized"]["mae"] == db_json["centralized"]["mae"]
    assert da["iid"]["federated"]["mae"] == db_json["iid"]["federated"]["mae"]
    assert da["non_iid"]["federated"]["mae"] == db_json["non_iid"]["federated"]["mae"]


def test_invalid_partition_strategy_and_seed_rejected():
    """Verify unsupported partitioning strategies and invalid random seeds fail loudly."""
    bad_strategy_api = client.post(
        "/api/federated/benchmark-compare",
        json={
            "dataset_type": "pems08_public",
            "partition_strategy": "dirichlet_invalid",
        },
    )
    assert bad_strategy_api.status_code == 422

    bad_seed_api = client.post(
        "/api/federated/benchmark-partition-compare",
        json={
            "dataset_type": "pems08_public",
            "random_seed": -5,
        },
    )
    assert bad_seed_api.status_code == 422

    with pytest.raises(PublicDatasetValidationError):
        PublicTrafficDatasetLoader.load_pems08_benchmark_splits(
            horizon_minutes=15,
            partition_strategy="random_corrupted",
        )

    with pytest.raises(PublicDatasetValidationError):
        PublicTrafficDatasetLoader.load_pems08_benchmark_splits(
            horizon_minutes=15,
            partition_strategy="iid",
            random_seed=-1,
        )

"""
Focused automated verification tests for Prompt 3: Reproducible Three-Seed Federated Learning Experiments.
Validates default 3-seed execution (42, 123, 2026), seed propagation, reproducibility without caching,
IID/Non-IID seed parity, unrounded Mean & Sample SD (ddof=1) calculations, matching-round convergence
aggregation, non-silent partial/full failure handling, strict invalid-seed rejection, and backward
compatibility of existing single-seed endpoints.
"""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.app.database import Base, SessionLocal, engine
from backend.app.federated.fl_engine import FederatedLearningEngine, fl_engine_instance
from backend.app.federated.public_dataset import PublicDatasetValidationError
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


def test_default_three_seeds_pems08_end_to_end_and_unrounded_statistics():
    """
    Verify default seeds [42, 123, 2026] execute on genuine PeMS08 across Centralized, IID, and Non-IID:
    - All 3 seeds execute completely with matching seed parity across groups.
    - Aggregated Mean & Sample SD (ddof=1) match unrounded per-seed values directly.
    - Full-precision IID metrics retain genuine seed-to-seed variance (not wiped by premature rounding).
    - Provenance, CC-BY-4.0 attribution, and per-round convergence are preserved cleanly.
    """
    res = client.post(
        "/api/federated/benchmark-multi-seed",
        json={
            "dataset_type": "pems08_public",
            "target_horizon_minutes": 15,
            "federated_rounds": 3,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["seeds"] == [42, 123, 2026]
    assert data["experiment_status"] == "completed"
    assert data["is_complete"] is True
    assert data["successful_runs_count"] == 3
    assert data["failed_runs_count"] == 0
    assert data["failures"] == []
    assert data["is_genuine_public"] is True
    assert data["is_simulated"] is False
    assert "CC-BY-4.0" in (data.get("dataset_license") or "")
    assert data["experiment_config"]["cached_results_reused"] is False

    groups = data["groups"]
    assert set(groups.keys()) == {"centralized", "iid", "non_iid"}

    # Exact matching seeds in order across Centralized, IID, and Non-IID
    for gname, grp in groups.items():
        assert grp["is_complete"] is True
        assert grp["successful_runs_count"] == 3
        assert grp["failed_runs_count"] == 0
        assert grp["successful_seeds"] == [42, 123, 2026]
        assert [r["seed"] for r in grp["per_seed_results"]] == [42, 123, 2026]
        assert all(r["status"] == "success" for r in grp["per_seed_results"])

    # Unrounded Mean & Bessel-corrected Sample SD (ddof=1) exact numerical verification
    for gname in ("centralized", "iid", "non_iid"):
        grp = groups[gname]
        summary = grp["summary"]
        assert summary["std_formula"] == "sample_std_ddof_1"
        maes = np.array([r["mae"] for r in grp["per_seed_results"]], dtype=np.float64)
        rmses = np.array([r["rmse"] for r in grp["per_seed_results"]], dtype=np.float64)
        assert np.isclose(summary["mean_mae"], float(np.mean(maes)), rtol=0.0, atol=1e-12)
        assert np.isclose(summary["std_mae"], float(np.std(maes, ddof=1)), rtol=0.0, atol=1e-12)
        assert np.isclose(summary["mean_rmse"], float(np.mean(rmses)), rtol=0.0, atol=1e-12)
        assert np.isclose(summary["std_rmse"], float(np.std(rmses, ddof=1)), rtol=0.0, atol=1e-12)

        if gname in ("iid", "non_iid"):
            f_maes = np.array(
                [r["final_round_mae"] for r in grp["per_seed_results"]], dtype=np.float64
            )
            f_rmses = np.array(
                [r["final_round_rmse"] for r in grp["per_seed_results"]], dtype=np.float64
            )
            assert np.isclose(summary["mean_final_round_mae"], float(np.mean(f_maes)), rtol=0.0, atol=1e-12)
            assert np.isclose(summary["std_final_round_mae"], float(np.std(f_maes, ddof=1)), rtol=0.0, atol=1e-12)
            assert np.isclose(summary["mean_final_round_rmse"], float(np.mean(f_rmses)), rtol=0.0, atol=1e-12)
            assert np.isclose(summary["std_final_round_rmse"], float(np.std(f_rmses, ddof=1)), rtol=0.0, atol=1e-12)
            assert len(grp["aggregated_convergence"]) == 3

    # Full-precision IID captures genuine cross-seed numerical variance without premature rounding
    assert groups["iid"]["summary"]["std_mae"] > 0.0
    assert groups["iid"]["summary"]["std_rmse"] > 0.0


def test_multi_seed_reproducibility_and_seed_propagation(monkeypatch):
    """
    Verify:
    - Repeating the same seeds [42, 123, 2026] reproduces identical outputs.
    - All configured seeds are independently forwarded into prepare_chronological_splits,
      _fit_centralized_baseline, and _run_federated_training (no cached shortcut).
    - IID and Non-IID execute with matching seeds for every run.
    """
    observed_split_calls = []
    observed_central_seeds = []
    observed_fed_calls = []

    orig_prepare = fl_engine_instance.prepare_chronological_splits
    orig_central = fl_engine_instance._fit_centralized_baseline
    orig_fed = fl_engine_instance._run_federated_training

    def spy_prepare(*args, **kwargs):
        observed_split_calls.append((kwargs.get("partition_strategy"), kwargs.get("random_seed")))
        return orig_prepare(*args, **kwargs)

    def spy_central(*args, **kwargs):
        observed_central_seeds.append(kwargs.get("random_seed"))
        return orig_central(*args, **kwargs)

    def spy_fed(*args, **kwargs):
        observed_fed_calls.append((kwargs.get("partition_strategy"), kwargs.get("random_seed")))
        return orig_fed(*args, **kwargs)

    monkeypatch.setattr(fl_engine_instance, "prepare_chronological_splits", spy_prepare)
    monkeypatch.setattr(fl_engine_instance, "_fit_centralized_baseline", spy_central)
    monkeypatch.setattr(fl_engine_instance, "_run_federated_training", spy_fed)

    res_a = client.post(
        "/api/federated/benchmark-multi-seed",
        json={
            "dataset_type": "synthetic",
            "target_horizon_minutes": 15,
            "federated_rounds": 3,
            "seeds": [42, 123, 2026],
        },
    )
    assert res_a.status_code == 200, res_a.text
    a = res_a.json()

    # Verify independent execution for every seed & matching IID/Non-IID seed propagation
    assert observed_central_seeds == [42, 123, 2026]
    assert observed_fed_calls == [
        ("iid", 42),
        ("non_iid", 42),
        ("iid", 123),
        ("non_iid", 123),
        ("iid", 2026),
        ("non_iid", 2026),
    ]
    assert ("iid", 42) in observed_split_calls
    assert ("iid", 123) in observed_split_calls
    assert ("iid", 2026) in observed_split_calls

    # Second run reproduces identical metrics (and doubles call count -> zero cached results!)
    res_b = client.post(
        "/api/federated/benchmark-multi-seed",
        json={
            "dataset_type": "synthetic",
            "target_horizon_minutes": 15,
            "federated_rounds": 3,
            "seeds": [42, 123, 2026],
        },
    )
    assert res_b.status_code == 200, res_b.text
    b = res_b.json()
    assert len(observed_central_seeds) == 6
    assert a["is_simulated"] is True
    assert a["is_genuine_public"] is False

    metric_keys = [
        "sample_count",
        "std_formula",
        "mean_mae",
        "std_mae",
        "mean_rmse",
        "std_rmse",
        "mean_final_round_mae",
        "std_final_round_mae",
        "mean_final_round_rmse",
        "std_final_round_rmse",
        "mean_data_transmitted_bytes",
    ]
    for gname in ("centralized", "iid", "non_iid"):
        sa, sb = a["groups"][gname]["summary"], b["groups"][gname]["summary"]
        for k in metric_keys:
            assert sa[k] == sb[k], f"Mismatch in {gname}.summary[{k}]"
        assert sa["mean_duration_ms"] > 0 and sb["mean_duration_ms"] > 0
        for r_a, r_b in zip(
            a["groups"][gname]["per_seed_results"],
            b["groups"][gname]["per_seed_results"],
        ):
            assert r_a["seed"] == r_b["seed"]
            assert r_a["mae"] == r_b["mae"]
            assert r_a["rmse"] == r_b["rmse"]
            assert r_a["round_history"] == r_b["round_history"]


def test_failed_seed_run_reported_and_marked_incomplete(monkeypatch):
    """
    Verify that when one seed fails (e.g. seed 123 raises an exception during IID training),
    the failure is NOT silently omitted:
    - experiment_status == 'incomplete_partial_failure' & is_complete is False.
    - failed seed 123 appears in failures, failed_seeds, and per_seed_results with error message.
    - Incomplete aggregate reflects only successfully completed seeds [42, 2026] and never fabricates 123.
    """
    orig_fed = fl_engine_instance._run_federated_training

    def failing_fed_for_123(*args, **kwargs):
        if kwargs.get("partition_strategy") == "iid" and kwargs.get("random_seed") == 123:
            raise RuntimeError("Simulated edge training timeout on seed 123")
        return orig_fed(*args, **kwargs)

    monkeypatch.setattr(fl_engine_instance, "_run_federated_training", failing_fed_for_123)

    res = client.post(
        "/api/federated/benchmark-multi-seed",
        json={
            "dataset_type": "synthetic",
            "target_horizon_minutes": 15,
            "federated_rounds": 3,
            "seeds": [42, 123, 2026],
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["experiment_status"] == "incomplete_partial_failure"
    assert data["is_complete"] is False
    assert data["successful_runs_count"] == 2
    assert data["failed_runs_count"] == 1
    assert data["warning_message"] is not None
    assert "123" in data["warning_message"]

    assert any(f["seed"] == 123 and f["group"] == "iid" for f in data["failures"])

    iid_grp = data["groups"]["iid"]
    assert iid_grp["aggregate_status"] == "incomplete_partial_failure"
    assert iid_grp["is_complete"] is False
    assert iid_grp["requested_runs_count"] == 3
    assert iid_grp["successful_runs_count"] == 2
    assert iid_grp["failed_runs_count"] == 1
    assert iid_grp["successful_seeds"] == [42, 2026]
    assert [f["seed"] for f in iid_grp["failed_seeds"]] == [123]
    assert "123" in iid_grp["status_note"]

    by_seed = {r["seed"]: r for r in iid_grp["per_seed_results"]}
    assert by_seed[123]["status"] == "failed"
    assert "Simulated edge training timeout on seed 123" in by_seed[123]["error"]
    assert by_seed[123]["mae"] is None

    # Mean & sample SD computed strictly over [42, 2026] without premature rounding
    ok_maes = np.array([by_seed[42]["mae"], by_seed[2026]["mae"]], dtype=np.float64)
    assert np.isclose(iid_grp["summary"]["mean_mae"], float(np.mean(ok_maes)), rtol=0.0, atol=1e-12)
    assert np.isclose(iid_grp["summary"]["std_mae"], float(np.std(ok_maes, ddof=1)), rtol=0.0, atol=1e-12)


def test_aggregated_convergence_uses_only_matching_rounds_from_successful_runs():
    """
    Verify _aggregate_round_convergence:
    - Excludes failed runs.
    - Aggregates ONLY round indices present across ALL successful runs.
    - Computes exact unrounded Mean and Sample SD (ddof=1) without prior rounding.
    """
    sample_runs = [
        {
            "seed": 42,
            "status": "success",
            "round_history": [
                {"round": 1, "test_mae": 30.1234, "test_rmse": 40.5678, "weights_norm": 1.0},
                {"round": 2, "test_mae": 22.1111, "test_rmse": 31.2222, "weights_norm": 1.2},
                {"round": 3, "test_mae": 18.5555, "test_rmse": 27.6666, "weights_norm": 1.4},
            ],
        },
        {
            "seed": 123,
            "status": "failed",
            "error": "Timeout",
            "round_history": [
                {"round": 1, "test_mae": 999.0, "test_rmse": 999.0, "weights_norm": 0.0},
            ],
        },
        {
            "seed": 2026,
            "status": "success",
            "round_history": [
                {"round": 1, "test_mae": 30.2234, "test_rmse": 40.7678, "weights_norm": 1.0},
                {"round": 2, "test_mae": 22.3111, "test_rmse": 31.4222, "weights_norm": 1.2},
                # Round 3 absent in 2026 -> round 3 must NOT be aggregated across a mismatched subset
            ],
        },
    ]

    agg = FederatedLearningEngine._aggregate_round_convergence(sample_runs)
    assert [r["round"] for r in agg] == [1, 2]
    assert all(r["completed_seeds_count"] == 2 for r in agg)

    r1_maes = np.array([30.1234, 30.2234], dtype=np.float64)
    r1_rmses = np.array([40.5678, 40.7678], dtype=np.float64)
    assert np.isclose(agg[0]["mean_mae"], float(np.mean(r1_maes)), rtol=0.0, atol=1e-12)
    assert np.isclose(agg[0]["std_mae"], float(np.std(r1_maes, ddof=1)), rtol=0.0, atol=1e-12)
    assert np.isclose(agg[0]["mean_rmse"], float(np.mean(r1_rmses)), rtol=0.0, atol=1e-12)
    assert np.isclose(agg[0]["std_rmse"], float(np.std(r1_rmses, ddof=1)), rtol=0.0, atol=1e-12)


@pytest.mark.parametrize(
    "bad_seeds",
    [
        [],
        [-1, 42, 123],
        [42, 42, 123],
        [True, 42, 123],
        [42.5, 123, 2026],
        ["abc", "def"],
        list(range(11)),
    ],
)
def test_invalid_seed_inputs_rejected_http_422(bad_seeds):
    """Verify empty, negative, duplicate, boolean, float, non-numeric, or oversized seed lists fail cleanly."""
    res = client.post(
        "/api/federated/benchmark-multi-seed",
        json={
            "dataset_type": "synthetic",
            "seeds": bad_seeds,
        },
    )
    assert res.status_code == 422, f"Expected 422 for seeds={bad_seeds}, got {res.status_code}: {res.text}"


def test_direct_engine_seed_validation_and_single_seed_endpoints_intact():
    """Verify direct engine seed validator rejects invalid lists and single-seed endpoints remain operational."""
    with pytest.raises(PublicDatasetValidationError):
        FederatedLearningEngine.validate_seed_list([])
    with pytest.raises(PublicDatasetValidationError):
        FederatedLearningEngine.validate_seed_list([42, 42])

    res_single = client.post(
        "/api/federated/benchmark-compare",
        json={
            "dataset_type": "synthetic",
            "partition_strategy": "iid",
            "random_seed": 123,
            "federated_rounds": 2,
        },
    )
    assert res_single.status_code == 200, res_single.text
    assert res_single.json()["random_seed"] == 123

    res_pair = client.post(
        "/api/federated/benchmark-partition-compare",
        json={
            "dataset_type": "synthetic",
            "random_seed": 2026,
            "federated_rounds": 2,
        },
    )
    assert res_pair.status_code == 200, res_pair.text
    assert res_pair.json()["random_seed"] == 2026

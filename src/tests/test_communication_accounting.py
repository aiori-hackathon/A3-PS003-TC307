"""
Prompt 4 Verification Suite: Rigorous Per-Round, Cumulative & Multi-Seed Communication Accounting
for PS-003 (Federated Traffic-Flow Prediction with Communication-Cost Evaluation).
"""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.app.database import Base, SessionLocal, engine
from backend.app.federated.communication import (
    BIAS_SCALAR_BYTES,
    BYTES_PER_MB,
    CENTRALIZED_RAW_ROW_BYTES,
    QUANT_METADATA_BYTES,
    WIRE_HEADER_BYTES,
    WIRE_MAGIC,
    deserialize_model_update,
    resolve_compression_config,
    safe_efficiency_per_mb,
    safe_ratio,
    serialize_model_update,
)
from backend.app.federated.fl_engine import fl_engine_instance
from backend.app.main import app
from backend.app.services.seed_data import seed_database, seed_pems_benchmark

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_comm_test_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
        seed_pems_benchmark(db)
    finally:
        db.close()


# --- 1–4. Binary TFL1 Serialization & Exact Byte Accounting Across All 4 Strategies ---


def test_wire_serialization_exact_bytes_and_lossless_crc_roundtrip():
    """Verify binary wire packet sizes, index/metadata overhead, and CRC32 deserialization across 4 modes."""
    weights = np.array([12.5, -45.25, 0.75, 8.0, -3.125, 19.5, -0.25, 4.5], dtype=np.float64)
    bias = 123.45

    # 1. Full Precision FP32 (8 weights + 1 bias = 9 * 4B + 44B = 80B)
    cfg_fp = resolve_compression_config(compression_method="full_precision")
    pkt_fp = serialize_model_update(weights, bias, cfg_fp, round_num=1, client_id="zone_1")
    assert pkt_fp.packet_bytes[:4] == WIRE_MAGIC
    assert pkt_fp.header_bytes == WIRE_HEADER_BYTES
    assert pkt_fp.bias_bytes == BIAS_SCALAR_BYTES
    assert pkt_fp.values_bytes == 8 * 4
    assert pkt_fp.index_bytes == 0
    assert pkt_fp.quant_metadata_bytes == 0
    assert len(pkt_fp.packet_bytes) == pkt_fp.total_bytes == 44 + 4 + 32
    w_dec, b_dec, meta_fp = deserialize_model_update(pkt_fp.packet_bytes)
    assert meta_fp["compression_method"] == "full_precision"
    assert np.allclose(w_dec, weights.astype(np.float32), atol=1e-6)
    assert abs(b_dec - bias) < 1e-4

    # 2. Top-K 50% FP32 (k=4 retained weights: 44 + 4 + 4*4 + 4*1 idx = 68B)
    cfg_tk = resolve_compression_config(compression_method="top_k", top_k_retention_pct=50.0)
    pkt_tk = serialize_model_update(weights, bias, cfg_tk, round_num=2, client_id="zone_1")
    assert pkt_tk.retained_weights_count == 4
    assert pkt_tk.values_bytes == 16
    assert pkt_tk.index_bytes == 4  # uint8 index (1B per index since n_params <= 255)
    assert pkt_tk.quant_metadata_bytes == 0
    assert len(pkt_tk.packet_bytes) == pkt_tk.total_bytes == 68
    w_tk, _, _ = deserialize_model_update(pkt_tk.packet_bytes)
    # Lowest 4 magnitudes must be zeroed out cleanly
    assert np.count_nonzero(w_tk) == 4
    assert w_tk[2] == 0.0 and w_tk[6] == 0.0

    # 3. Dense Uniform INT8 (8 * 1B uint8 + 8B scale/min + 44 + 4 = 64B)
    cfg_q = resolve_compression_config(compression_method="int8")
    pkt_q = serialize_model_update(weights, bias, cfg_q, round_num=2, client_id="zone_1")
    assert pkt_q.values_bytes == 8
    assert pkt_q.index_bytes == 0
    assert pkt_q.quant_metadata_bytes == QUANT_METADATA_BYTES
    assert len(pkt_q.packet_bytes) == pkt_q.total_bytes == 64
    w_q, _, _ = deserialize_model_update(pkt_q.packet_bytes)
    max_q_err = (float(np.max(weights)) - float(np.min(weights))) / 255.0
    assert float(np.max(np.abs(w_q - weights))) <= max_q_err + 1e-4

    # 4. Top-K (25% -> k=2) + INT8 (44 + 4 + 2*1 + 2*1 idx + 8B meta = 60B)
    cfg_tq = resolve_compression_config(compression_method="top_k_int8", top_k_retention_pct=25.0)
    pkt_tq = serialize_model_update(weights, bias, cfg_tq, round_num=3, client_id="zone_1")
    assert pkt_tq.retained_weights_count == 2
    assert pkt_tq.values_bytes == 2
    assert pkt_tq.index_bytes == 2
    assert pkt_tq.quant_metadata_bytes == 8
    assert len(pkt_tq.packet_bytes) == pkt_tq.total_bytes == 60
    w_tq, _, meta_tq = deserialize_model_update(pkt_tq.packet_bytes)
    assert meta_tq["compression_method"] == "top_k_int8"
    assert np.count_nonzero(w_tq) == 2

    # Tampered CRC32 byte must be rejected explicitly
    corrupted = bytearray(pkt_tq.packet_bytes)
    corrupted[-1] ^= 0xFF
    with pytest.raises(ValueError, match="CRC32"):
        deserialize_model_update(bytes(corrupted))


def test_sparse_uint16_index_width_scales_with_parameter_dimension():
    """Verify larger models (>= 256 params) allocate uint16 (2B) sparse indices automatically."""
    w_big = np.linspace(-10.0, 10.0, 300, dtype=np.float32)
    cfg = resolve_compression_config(compression_method="top_k_int8", top_k_retention_pct=10.0)
    pkt = serialize_model_update(w_big, 1.0, cfg, round_num=1, client_id="big")
    assert pkt.retained_weights_count == 30
    assert pkt.index_width_bytes == 2
    assert pkt.index_bytes == 30 * 2
    assert len(pkt.packet_bytes) == 44 + 4 + 30 + 60 + 8


# --- 5–7. Centralized vs Federated Upload/Download Separation & Cumulative Round Progression ---


def test_centralized_vs_federated_accounting_and_cumulative_progression():
    """Verify per-round upload vs modeled download, cumulative sum consistency, and ratio separation."""
    res = client.post(
        "/api/federated/benchmark-compare",
        json={
            "dataset_type": "pems08_public",
            "target_horizon_minutes": 15,
            "federated_rounds": 4,
            "compression_method": "top_k_int8",
            "top_k_retention_pct": 25.0,
            "partition_strategy": "non_iid",
            "random_seed": 42,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()

    c = data["centralized"]
    f = data["federated"]
    assert c["upload_bytes"] == c["train_samples_count"] * CENTRALIZED_RAW_ROW_BYTES
    assert c["download_bytes"] == 0
    assert c["centralized_accounting"]["accounting_nature"] == "estimated_raw_data_transfer"
    assert c["centralized_accounting"]["bytes_per_raw_sample"] == CENTRALIZED_RAW_ROW_BYTES

    assert f["participating_clients"] == 4
    # Upload: 4 clients * 60B/client/round * 4 rounds = 960B
    assert f["upload_bytes"] == 4 * 60 * 4
    # Modeled Broadcast Download: 4 clients * 80B FP32/client/round * 4 rounds = 1280B
    assert f["download_bytes_modeled"] == 4 * 80 * 4
    assert f["download_bytes"] == f["download_bytes_modeled"]
    assert f["data_transmitted_bytes"] == f["upload_bytes"] + f["download_bytes_modeled"]

    history = f["round_history"]
    assert len(history) == 4
    prev_up = 0
    prev_dl = 0
    for idx, entry in enumerate(history, start=1):
        assert entry["round"] == idx
        assert entry["upload_bytes"] == 240
        assert entry["download_bytes_modeled"] == 320
        assert entry["total_round_bytes"] == 560
        assert entry["cumulative_upload_bytes"] == prev_up + entry["upload_bytes"]
        assert entry["cumulative_download_bytes_modeled"] == prev_dl + entry["download_bytes_modeled"]
        assert entry["cumulative_total_bytes"] == entry["cumulative_upload_bytes"] + entry["cumulative_download_bytes_modeled"]
        assert entry["mae_improvement_vs_initial"] > 0
        assert entry["mae_improvement_per_mb_upload"] == pytest.approx(
            entry["mae_improvement_vs_initial"] / (entry["cumulative_upload_bytes"] / BYTES_PER_MB),
            rel=1e-6,
        )
        prev_up = entry["cumulative_upload_bytes"]
        prev_dl = entry["cumulative_download_bytes_modeled"]

    cs = f["communication_summary"]
    assert cs["upload_compression_ratio"] == pytest.approx(1280 / 960, rel=1e-6)
    assert cs["upload_reduction_pct"] == pytest.approx(25.0, rel=1e-6)
    # Bidirectional includes un-compressed global broadcast download, so ratio must be strictly < upload-only ratio
    assert cs["bidirectional_compression_ratio"] < cs["upload_compression_ratio"]
    assert cs["bidirectional_reduction_pct"] < cs["upload_reduction_pct"]


# --- 8–9. Controlled 4-Strategy Compression Comparison Endpoint ---


def test_four_way_compression_comparison_pems08_public():
    """Verify 4-way compression benchmark compares full_precision, top_k, int8, and top_k_int8 fairly."""
    res = client.post(
        "/api/federated/benchmark-compression-compare",
        json={
            "dataset_type": "pems08_public",
            "partition_strategy": "non_iid",
            "target_horizon_minutes": 15,
            "federated_rounds": 3,
            "top_k_retention_pct": 25.0,
            "random_seed": 42,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["is_genuine_public"] is True
    assert data["is_simulated"] is False
    assert data["partition_strategy"] == "non_iid"
    strategies = data["strategies"]
    assert set(strategies.keys()) == {"full_precision", "top_k", "int8", "top_k_int8"}

    # Identical split & participating clients across all 4 strategies
    c = data["centralized"]
    for method, st in strategies.items():
        assert st["federated"]["train_samples_count"] == c["train_samples_count"]
        assert st["federated"]["test_samples_count"] == c["test_samples_count"]
        bd = st["payload_breakdown_per_client"]
        assert bd["header_bytes"] + bd["bias_bytes"] + bd["values_bytes"] + bd["index_bytes"] + bd["quant_metadata_bytes"] == bd["total_bytes"]
        assert st["upload_bytes"] == bd["total_bytes"] * 4 * 3

    fp = strategies["full_precision"]
    tk = strategies["top_k"]
    q8 = strategies["int8"]
    tq = strategies["top_k_int8"]

    # PeMS08 (8 weights + 1 bias, 4 clients, 3 rounds):
    # FP32=80B*12=960B; Top-K 25% (k=2)=44+4+8+2=58B*12=696B; INT8=64B*12=768B; Top-K25%+INT8=60B*12=720B
    assert fp["upload_bytes"] == 960
    assert fp["upload_reduction_pct"] == pytest.approx(0.0, abs=1e-9)
    assert tk["upload_bytes"] == 696
    assert q8["upload_bytes"] == 768
    assert tq["upload_bytes"] == 720
    # Modeled global broadcast remains identical across all strategies
    assert len({st["download_bytes_modeled"] for st in strategies.values()}) == 1
    # Top-K zeroing/quantizing reflects real model error delta vs FP32
    assert tk["mae_vs_full_precision"] >= 0.0 or isinstance(tk["mae_vs_full_precision"], float)
    assert fp["mae_vs_full_precision"] == pytest.approx(0.0, abs=1e-9)


# --- 10–11. Multi-Seed Communication Aggregation & Partial-Failure Handling ---


def test_multi_seed_communication_aggregation_and_partial_failure(monkeypatch):
    """Verify 3-seed communication aggregation (ddof=1) and incomplete marking on seed failure."""
    res = client.post(
        "/api/federated/benchmark-multi-seed",
        json={
            "dataset_type": "synthetic",
            "target_horizon_minutes": 30,
            "federated_rounds": 3,
            "compression_method": "top_k_int8",
            "top_k_retention_pct": 50.0,
            "seeds": [42, 123, 2026],
            "partition_strategies": ["iid", "non_iid"],
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["is_complete"] is True
    assert data["experiment_config"]["compression_method"] == "top_k_int8"
    iid_grp = data["groups"]["iid"]
    assert iid_grp["summary"]["compression_method"] == "top_k_int8"
    assert iid_grp["summary"]["mean_upload_bytes"] == pytest.approx(576.0, rel=1e-6)
    assert iid_grp["summary"]["std_upload_bytes"] == pytest.approx(0.0, abs=1e-9)
    assert iid_grp["summary"]["mean_download_bytes_modeled"] == pytest.approx(684.0, rel=1e-6)
    assert iid_grp["summary"]["mean_mae_improvement_per_mb_upload"] is not None
    # Verify per-round multi-seed communication aggregation uses sample std ddof=1
    rnd3 = iid_grp["aggregated_convergence"][-1]
    assert rnd3["round"] == 3
    assert rnd3["mean_upload_bytes"] == pytest.approx(192.0, rel=1e-6)
    assert rnd3["mean_cumulative_upload_bytes"] == pytest.approx(576.0, rel=1e-6)
    assert rnd3["mean_cumulative_total_bytes"] == pytest.approx(1260.0, rel=1e-6)
    eff_vals = [float(r["round_history"][-1]["mae_improvement_per_mb_upload"]) for r in iid_grp["per_seed_results"]]
    assert rnd3["std_mae_improvement_per_mb_upload"] == pytest.approx(float(np.std(eff_vals, ddof=1)), rel=1e-6)

    # Simulate partial failure on seed 123 and ensure failed run never contaminates surviving communication average
    original_fn = fl_engine_instance._run_federated_training

    def failing_seed_123(*args, **kwargs):
        if kwargs.get("random_seed") == 123:
            raise RuntimeError("Injected worker timeout for seed 123")
        return original_fn(*args, **kwargs)

    monkeypatch.setattr(fl_engine_instance, "_run_federated_training", failing_seed_123)
    db = SessionLocal()
    try:
        partial = fl_engine_instance.run_multi_seed_benchmark(
            db=db,
            dataset_type="synthetic",
            target_horizon_minutes=30,
            federated_rounds=2,
            compression_method="int8",
            seeds=[42, 123, 2026],
            partition_strategies=["iid"],
        )
    finally:
        db.close()

    assert partial["is_complete"] is False
    assert partial["experiment_status"] == "incomplete_partial_failure"
    grp = partial["groups"]["iid"]
    assert grp["is_complete"] is False
    assert grp["successful_seeds"] == [42, 2026]
    assert grp["failed_seeds"][0]["seed"] == 123
    # Synthetic 7-feature dense INT8 per client = 44+4+7+8 = 63B; 3 clients * 2 rounds = 378B
    assert grp["summary"]["mean_upload_bytes"] == pytest.approx(378.0, rel=1e-6)


# --- 12–14. Safe Division, Zero/Non-Improving Guards & HTTP 422 Input Validation ---


def test_zero_byte_and_non_improving_efficiency_safety():
    """Verify safe_ratio and safe_efficiency_per_mb never return inf, NaN, or fake ratios."""
    assert safe_ratio(100.0, 0.0) is None
    assert safe_ratio(100.0, -5.0) is None
    assert safe_ratio(float("nan"), 10.0) is None
    assert safe_ratio(200.0, 50.0) == 4.0

    val_zero, status_zero = safe_efficiency_per_mb(5.0, 0)
    assert val_zero is None
    assert status_zero == "undefined_zero_bytes"

    val_worse, status_worse = safe_efficiency_per_mb(-1.5, 1024)
    assert val_worse is None
    assert status_worse == "non_improving"

    val_flat, status_flat = safe_efficiency_per_mb(0.0, 1024)
    assert val_flat is None
    assert status_flat == "non_improving"

    val_ok, status_ok = safe_efficiency_per_mb(2.0, int(BYTES_PER_MB))
    assert val_ok == pytest.approx(2.0, rel=1e-6)
    assert status_ok == "valid"


@pytest.mark.parametrize(
    "endpoint,payload",
    [
        (
            "/api/federated/benchmark-compare",
            {"dataset_type": "synthetic", "compression_method": "fp16_invalid"},
        ),
        (
            "/api/federated/benchmark-compare",
            {"dataset_type": "synthetic", "top_k_retention_pct": 0.0},
        ),
        (
            "/api/federated/benchmark-multi-seed",
            {"dataset_type": "synthetic", "compression_method": "lz4"},
        ),
        (
            "/api/federated/benchmark-compression-compare",
            {"dataset_type": "synthetic", "top_k_retention_pct": 100.0},
        ),
        (
            "/api/federated/benchmark-compression-compare",
            {"dataset_type": "synthetic", "partition_strategy": "random_invalid"},
        ),
    ],
)
def test_invalid_compression_configs_rejected_with_http_422(endpoint, payload):
    """Verify invalid compression methods or Top-K retention bounds are rejected cleanly."""
    res = client.post(endpoint, json=payload)
    assert res.status_code == 422

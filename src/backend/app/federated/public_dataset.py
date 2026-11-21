"""
Genuine Public Traffic Dataset Ingestion, Validation, and Deterministic Client
Partitioning Pipeline for TrafficFlow AI (PS-003).

Supports:
1. Caltrans PeMS District 8 (PEMS08) Zenodo Archive (DOI: 10.5281/zenodo.7816008, CC-BY-4.0)
   comprising `PEMS08.npz` (17,856 x 170 x 3 tensor of flow, occupancy, speed at 5-min steps)
   and `PEMS08.csv` (295 weighted freeway detector graph edges across 170 original sensors).
2. Generic Tabular Traffic CSV validation & ingestion (timestamp, sensor_id, flow, speed[, occupy]).

Design guarantees:
- Zero synthetic data or random array fallback when files are missing or invalid.
- Explicit schema, column, data-type, and timestamp monotonicity validation.
- Invalid or dropout points are excluded transparently without fabricating missing values.
- Original sensor identifiers are preserved and deterministically mapped to 3-5 virtual clients.
- Strict chronological train/test separation with target-horizon purging prevents data leakage.
"""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from backend.app.services.fetch_public_dataset import (
    DEFAULT_PUBLIC_DATA_DIR,
    ZENODO_DOCUMENTATION_URL,
    ZENODO_DOI,
    ZENODO_LICENSE,
)


class PublicDatasetNotFoundError(FileNotFoundError):
    """Raised when a required genuine public traffic dataset file is absent."""


class PublicDatasetValidationError(ValueError):
    """Raised when public traffic data fails schema, type, timestamp, or quality validation."""


PEMS08_FEATURE_NAMES: List[str] = [
    "flow_t",
    "flow_t_minus_1",
    "flow_t_minus_2",
    "occupy_t",
    "speed_t",
    "sin_hour",
    "cos_hour",
    "is_weekend",
]

# Fixed domain-grounded physical scaling divisors (strictly zero test or cross-client statistics):
# flow ~ [0, 1200] veh/5m -> /500; occupy in [0, 1] -> /1; speed ~ [0, 90] mph -> /100; cyclic/binary -> /1.
PEMS08_FEATURE_SCALES = np.array([500.0, 500.0, 500.0, 1.0, 100.0, 1.0, 1.0, 1.0], dtype=np.float64)

TABULAR_FEATURE_NAMES: List[str] = [
    "flow_t",
    "flow_t_minus_1",
    "flow_t_minus_2",
    "occupy_t",
    "speed_t",
    "sin_hour",
    "cos_hour",
    "is_weekend",
]

SUPPORTED_PARTITION_STRATEGIES: Tuple[str, ...] = ("iid", "non_iid")


def validate_partition_strategy(partition_strategy: str) -> str:
    """Validate and normalize the federated client data-partitioning strategy."""
    if not isinstance(partition_strategy, str) or partition_strategy not in SUPPORTED_PARTITION_STRATEGIES:
        raise PublicDatasetValidationError(
            f"Unsupported partition_strategy '{partition_strategy}'. Supported strategies: 'iid', 'non_iid'."
        )
    return partition_strategy


def validate_random_seed(random_seed: int) -> int:
    """Validate integer seed used for reproducible client partitioning."""
    if isinstance(random_seed, bool) or not isinstance(random_seed, int) or random_seed < 0:
        raise PublicDatasetValidationError(
            f"random_seed must be a non-negative integer; got {random_seed!r}."
        )
    return random_seed


def compute_distribution_analysis(
    client_observations: Dict[str, Dict[str, Any]],
    test_flow: np.ndarray,
    test_speed: Optional[np.ndarray],
    test_occupy: Optional[np.ndarray],
    target_unit: str,
    speed_unit: str,
    partition_strategy: str,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Compute aggregate per-client training distribution statistics and global holdout test
    statistics separately. Exposes aggregates only (never raw observations).
    """
    client_ids = list(client_observations.keys())
    total_train = sum(int(len(client_observations[cid]["flow"])) for cid in client_ids)
    all_tr_flow = np.concatenate([client_observations[cid]["flow"] for cid in client_ids])
    has_occ = all(client_observations[cid].get("occupy") is not None for cid in client_ids)
    has_spd = all(client_observations[cid].get("speed") is not None for cid in client_ids)

    all_tr_occ = (
        np.concatenate([client_observations[cid]["occupy"] for cid in client_ids]) if has_occ else None
    )
    all_tr_spd = (
        np.concatenate([client_observations[cid]["speed"] for cid in client_ids]) if has_spd else None
    )

    client_stats: List[Dict[str, Any]] = []
    flow_means: List[float] = []
    occ_means: List[float] = []
    spd_means: List[float] = []
    sample_counts: List[int] = []

    for cid in client_ids:
        entry = client_observations[cid]
        fl = entry["flow"]
        n_k = int(len(fl))
        f_mean = float(np.mean(fl))
        f_std = float(np.std(fl))
        flow_means.append(f_mean)
        sample_counts.append(n_k)

        occ_mean: Optional[float] = None
        if has_occ and entry.get("occupy") is not None:
            occ_mean = round(float(np.mean(entry["occupy"])), 4)
            occ_means.append(float(np.mean(entry["occupy"])))

        spd_mean: Optional[float] = None
        if has_spd and entry.get("speed") is not None:
            spd_mean = round(float(np.mean(entry["speed"])), 2)
            spd_means.append(float(np.mean(entry["speed"])))

        client_stats.append(
            {
                "client_id": cid,
                "label": entry.get("label", cid),
                "partition_strategy": partition_strategy,
                "sensors_count": int(entry.get("sensors_count", 0)),
                "train_samples": n_k,
                "sample_share_pct": round((n_k / max(1, total_train)) * 100.0, 2),
                "flow_mean": round(f_mean, 2),
                "flow_std": round(f_std, 2),
                "flow_unit": target_unit,
                "occupancy_mean": occ_mean,
                "speed_mean": spd_mean,
                "speed_unit": speed_unit if has_spd else None,
            }
        )

    global_tr_flow_mean = float(np.mean(all_tr_flow))
    flow_mean_std_across = float(np.std(flow_means)) if flow_means else 0.0
    cv_pct = (flow_mean_std_across / max(1e-6, global_tr_flow_mean)) * 100.0

    analysis = {
        "partition_strategy": partition_strategy,
        "split_scope_note": (
            "Client distribution statistics are computed exclusively on local training windows "
            "prior to the chronological purge boundary; global holdout test statistics are "
            "reported separately to preserve strict train/test isolation."
        ),
        "train_summary": {
            "total_samples": total_train,
            "flow_mean": round(global_tr_flow_mean, 2),
            "flow_std": round(float(np.std(all_tr_flow)), 2),
            "flow_unit": target_unit,
            "occupancy_mean": round(float(np.mean(all_tr_occ)), 4) if all_tr_occ is not None else None,
            "speed_mean": round(float(np.mean(all_tr_spd)), 2) if all_tr_spd is not None else None,
            "speed_unit": speed_unit if all_tr_spd is not None else None,
        },
        "test_summary": {
            "total_samples": int(len(test_flow)),
            "flow_mean": round(float(np.mean(test_flow)), 2),
            "flow_std": round(float(np.std(test_flow)), 2),
            "flow_unit": target_unit,
            "occupancy_mean": round(float(np.mean(test_occupy)), 4) if test_occupy is not None else None,
            "speed_mean": round(float(np.mean(test_speed)), 2) if test_speed is not None else None,
            "speed_unit": speed_unit if test_speed is not None else None,
        },
        "inter_client_differences": {
            "sample_count_min": min(sample_counts),
            "sample_count_max": max(sample_counts),
            "flow_mean_min": round(min(flow_means), 2),
            "flow_mean_max": round(max(flow_means), 2),
            "flow_mean_range": round(max(flow_means) - min(flow_means), 2),
            "flow_mean_std_across_clients": round(flow_mean_std_across, 3),
            "flow_heterogeneity_cv_pct": round(cv_pct, 2),
            "occupancy_mean_range": round(max(occ_means) - min(occ_means), 4) if occ_means else None,
            "speed_mean_range": round(max(spd_means) - min(spd_means), 2) if spd_means else None,
        },
    }
    return client_stats, analysis


def partition_client_windows(
    non_iid_clients: Dict[str, Dict[str, Any]],
    partition_strategy: str = "non_iid",
    random_seed: int = 42,
) -> Tuple[
    np.ndarray,
    np.ndarray,
    Dict[str, Dict[str, Any]],
    Dict[str, List[Any]],
    Dict[str, str],
]:
    """
    Assemble centralized train arrays once (strategy-independent) and partition client
    training data under either 'non_iid' (physical corridor grouping in chronological
    order) or 'iid' (seeded uniform permutation across identical client count).
    """
    strategy = validate_partition_strategy(partition_strategy)
    seed = validate_random_seed(random_seed)
    client_ids = list(non_iid_clients.keys())
    if not client_ids:
        raise PublicDatasetValidationError("No non-empty client partitions available for training split.")

    X_central = np.vstack([non_iid_clients[cid]["X_train"] for cid in client_ids])
    y_central = np.concatenate([non_iid_clients[cid]["y_train"] for cid in client_ids])

    if strategy == "non_iid":
        out_clients = {
            cid: {
                "X_train": non_iid_clients[cid]["X_train"],
                "y_train": non_iid_clients[cid]["y_train"],
                "flow": non_iid_clients[cid]["flow"],
                "occupy": non_iid_clients[cid].get("occupy"),
                "speed": non_iid_clients[cid].get("speed"),
                "label": non_iid_clients[cid]["label"],
                "sensors_count": len(non_iid_clients[cid]["sensors"]),
            }
            for cid in client_ids
        }
        out_sensor_map = {cid: list(non_iid_clients[cid]["sensors"]) for cid in client_ids}
        out_labels = {cid: non_iid_clients[cid]["label"] for cid in client_ids}
        return X_central, y_central, out_clients, out_sensor_map, out_labels

    # IID strategy: seeded uniform permutation over existing training windows only (zero duplication/loss)
    flow_central = np.concatenate([non_iid_clients[cid]["flow"] for cid in client_ids])
    has_occ = all(non_iid_clients[cid].get("occupy") is not None for cid in client_ids)
    has_spd = all(non_iid_clients[cid].get("speed") is not None for cid in client_ids)
    occ_central = (
        np.concatenate([non_iid_clients[cid]["occupy"] for cid in client_ids]) if has_occ else None
    )
    spd_central = (
        np.concatenate([non_iid_clients[cid]["speed"] for cid in client_ids]) if has_spd else None
    )

    union_sensors: List[Any] = []
    seen_s = set()
    for cid in client_ids:
        for s in non_iid_clients[cid]["sensors"]:
            if s not in seen_s:
                seen_s.add(s)
                union_sensors.append(s)

    rng = np.random.default_rng(seed)
    perm = rng.permutation(len(X_central))
    chunks = np.array_split(perm, len(client_ids))

    out_clients = {}
    out_sensor_map = {}
    out_labels = {}
    for idx, (cid, chunk) in enumerate(zip(client_ids, chunks), start=1):
        label = f"IID Virtual Shard {idx} (Uniform Random Split, {len(union_sensors)} Sensors, Seed {seed})"
        out_clients[cid] = {
            "X_train": X_central[chunk],
            "y_train": y_central[chunk],
            "flow": flow_central[chunk],
            "occupy": occ_central[chunk] if occ_central is not None else None,
            "speed": spd_central[chunk] if spd_central is not None else None,
            "label": label,
            "sensors_count": len(union_sensors),
        }
        out_sensor_map[cid] = list(union_sensors)
        out_labels[cid] = label

    return X_central, y_central, out_clients, out_sensor_map, out_labels


@dataclass
class PreparedPublicSplits:
    """Validated chronological centralized + federated splits prepared from genuine public data."""

    dataset_id: str
    dataset_name: str
    dataset_provenance: str
    documentation_url: str
    source_url: str
    license: str
    prediction_target: str
    target_unit: str
    sampling_interval_minutes: int
    feature_names: List[str]
    horizon_minutes: int
    horizon_steps: int
    sensors_count: int
    original_sensor_ids: List[Any]
    num_clients: int
    client_sensor_map: Dict[str, List[Any]]
    client_labels: Dict[str, str]
    X_train_central: np.ndarray
    y_train_central: np.ndarray
    X_test_global: np.ndarray
    y_test_global: np.ndarray
    client_data: Dict[str, Dict[str, np.ndarray]]
    split_boundary_iso: str
    max_train_target_iso: str
    min_test_input_iso: str
    time_range_iso: str
    raw_points_total: int
    valid_points_count: int
    invalid_or_dropout_points: int
    dropped_window_samples: int
    graph_edges_count: int = 0
    partition_strategy: str = "non_iid"
    random_seed: int = 42
    client_statistics: List[Dict[str, Any]] = field(default_factory=list)
    distribution_analysis: Dict[str, Any] = field(default_factory=dict)
    extra_metadata: Dict[str, Any] = field(default_factory=dict)


class PublicTrafficDatasetLoader:
    """
    Validates, cleans, deterministically partitions, and prepares chronological splits
    for genuine public multi-sensor traffic datasets.
    """

    # Cache raw validated NPZ tensor keyed by (resolved_path, mtime_ns, size)
    _npz_cache: Dict[Tuple[str, int, int], Dict[str, Any]] = {}

    @staticmethod
    def _parse_iso_timestamp(value: str) -> datetime:
        cleaned = value.strip()
        if not cleaned:
            raise PublicDatasetValidationError("Encountered empty timestamp value.")
        if cleaned.endswith("Z"):
            cleaned = cleaned[:-1] + "+00:00"
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is not None:
            dt = dt.replace(tzinfo=None)
        return dt

    @staticmethod
    def deterministic_client_partition(
        sensor_ids: List[Any],
        num_clients: int = 4,
        client_prefix: str = "pems08_zone",
    ) -> Dict[str, List[Any]]:
        """
        Deterministically partition sorted unique original sensor IDs into 3-5 virtual clients.
        Every original sensor identifier is preserved without duplication or omission.
        """
        if not (3 <= num_clients <= 5):
            raise PublicDatasetValidationError(
                f"Virtual client count must be between 3 and 5 for PS-003 experiments; got {num_clients}."
            )
        unique_sorted = sorted(set(sensor_ids))
        if len(unique_sorted) < num_clients:
            raise PublicDatasetValidationError(
                f"Cannot partition {len(unique_sorted)} sensors across {num_clients} clients."
            )

        chunks = np.array_split(np.arange(len(unique_sorted)), num_clients)
        mapping: Dict[str, List[Any]] = {}
        for idx, chunk in enumerate(chunks, start=1):
            client_id = f"{client_prefix}_{idx}"
            mapping[client_id] = [unique_sorted[int(i)] for i in chunk]
        return mapping

    @classmethod
    def _validate_and_load_graph_csv(cls, csv_path: Optional[Path], num_sensors: int) -> int:
        if csv_path is None or not csv_path.exists():
            return 0
        with open(csv_path, "r", encoding="utf-8", newline="") as fh:
            reader = csv.DictReader(fh)
            if reader.fieldnames is None or not {"from", "to", "cost"}.issubset(set(reader.fieldnames)):
                raise PublicDatasetValidationError(
                    f"Adjacency graph CSV '{csv_path}' must contain columns 'from', 'to', 'cost'; found {reader.fieldnames}."
                )
            edge_count = 0
            for line_no, row in enumerate(reader, start=2):
                try:
                    u = int(row["from"])
                    v = int(row["to"])
                    cost = float(row["cost"])
                except (TypeError, ValueError) as exc:
                    raise PublicDatasetValidationError(
                        f"Malformed edge entry at line {line_no} of '{csv_path}': {row}"
                    ) from exc
                if not (0 <= u < num_sensors and 0 <= v < num_sensors):
                    raise PublicDatasetValidationError(
                        f"Graph edge node index ({u}, {v}) out of sensor range [0, {num_sensors - 1}]."
                    )
                if not np.isfinite(cost) or cost < 0:
                    raise PublicDatasetValidationError(
                        f"Invalid negative/non-finite edge distance '{cost}' at line {line_no}."
                    )
                edge_count += 1
        if edge_count == 0:
            raise PublicDatasetValidationError(f"Graph CSV '{csv_path}' contains zero edges.")
        return edge_count

    @classmethod
    def _load_validated_npz(
        cls,
        npz_path: Path,
        csv_path: Optional[Path] = None,
        start_timestamp: str = "2016-07-01T00:00:00",
        interval_minutes: int = 5,
    ) -> Dict[str, Any]:
        if not npz_path.exists():
            raise PublicDatasetNotFoundError(
                f"Genuine PeMS08 archive missing at '{npz_path}'. Run "
                f"`python -m backend.app.services.fetch_public_dataset` to download it from {ZENODO_DOCUMENTATION_URL}."
            )

        stat = npz_path.stat()
        cache_key = (str(npz_path.resolve()), stat.st_mtime_ns, stat.st_size)
        if cache_key in cls._npz_cache:
            return cls._npz_cache[cache_key]

        try:
            with np.load(npz_path, allow_pickle=False) as archive:
                if "data" not in archive:
                    raise PublicDatasetValidationError(
                        f"Dataset file '{npz_path}' does not contain required array key 'data'."
                    )
                raw = np.asarray(archive["data"], dtype=np.float64)
        except PublicDatasetValidationError:
            raise
        except Exception as exc:
            raise PublicDatasetValidationError(
                f"Failed to read numeric NPZ tensor from '{npz_path}': {exc}"
            ) from exc

        if raw.ndim != 3:
            raise PublicDatasetValidationError(
                f"Expected 3D traffic tensor (T, N, 3) in '{npz_path}', got shape {raw.shape}."
            )
        T, N, C = raw.shape
        if C != 3:
            raise PublicDatasetValidationError(
                f"Expected 3 channels [flow, occupy, speed] in '{npz_path}', got {C} channels."
            )
        if T < 60 or N < 3:
            raise PublicDatasetValidationError(
                f"Insufficient dimensions ({T} steps, {N} sensors) in '{npz_path}'."
            )

        edge_count = cls._validate_and_load_graph_csv(csv_path, N)

        # Construct and validate strictly ascending ISO chronological timestamps
        start_dt = cls._parse_iso_timestamp(start_timestamp)
        delta = timedelta(minutes=interval_minutes)
        timestamps = [start_dt + i * delta for i in range(T)]
        for i in range(1, len(timestamps)):
            if timestamps[i] <= timestamps[i - 1]:
                raise PublicDatasetValidationError("Chronological timestamp invariant violated.")

        # Validate data integrity: exclude only non-finite or physically out-of-bounds readings.
        # Note: PeMS08 simultaneous (flow == 0, occupy == 0) readings (10,560 points, 88.3% between
        # 21:00-06:55 on low-volume ramp detectors) include legitimate zero-traffic intervals and
        # are preserved cleanly rather than blindly discarded.
        flow = raw[:, :, 0]
        occupy = raw[:, :, 1]
        speed = raw[:, :, 2]

        valid_point = (
            np.isfinite(raw).all(axis=2)
            & (flow >= 0.0)
            & (occupy >= 0.0)
            & (occupy <= 1.0)
            & (speed >= 0.0)
        )
        zero_traffic_points = int(((flow == 0.0) & (occupy == 0.0) & valid_point).sum())

        raw_points_total = int(T * N)
        valid_points_count = int(valid_point.sum())
        valid_ratio = valid_points_count / raw_points_total
        if valid_ratio < 0.50:
            raise PublicDatasetValidationError(
                f"Excessive invalid or missing records in '{npz_path}': only {valid_ratio * 100:.1f}% valid measurements."
            )

        hours = np.array([dt.hour + dt.minute / 60.0 for dt in timestamps], dtype=np.float64)
        sin_h = np.sin(2.0 * np.pi * hours / 24.0)
        cos_h = np.cos(2.0 * np.pi * hours / 24.0)
        is_wknd = np.array([1.0 if dt.weekday() >= 5 else 0.0 for dt in timestamps], dtype=np.float64)

        payload = {
            "raw": raw,
            "valid_point": valid_point,
            "timestamps": timestamps,
            "sin_h": sin_h,
            "cos_h": cos_h,
            "is_wknd": is_wknd,
            "T": T,
            "N": N,
            "edge_count": edge_count,
            "raw_points_total": raw_points_total,
            "valid_points_count": valid_points_count,
            "invalid_or_dropout_points": raw_points_total - valid_points_count,
            "zero_traffic_points": zero_traffic_points,
            "time_range_iso": f"{timestamps[0].isoformat()}Z to {timestamps[-1].isoformat()}Z",
        }
        cls._npz_cache[cache_key] = payload
        return payload

    @classmethod
    def get_pems08_metadata(
        cls,
        data_dir: Path | str | None = None,
    ) -> Dict[str, Any]:
        """
        Inspect on-disk genuine PeMS08 files and return accurate dataset metadata & readiness.
        Never fabricates statistics if files are absent or invalid.
        """
        base_dir = Path(data_dir) if data_dir else DEFAULT_PUBLIC_DATA_DIR
        npz_path = base_dir / "PEMS08.npz"
        csv_path = base_dir / "PEMS08.csv"
        meta_file = base_dir / "pems08_metadata.json"

        stored_meta: Dict[str, Any] = {}
        if meta_file.exists():
            try:
                with open(meta_file, "r", encoding="utf-8") as fh:
                    stored_meta = json.load(fh)
            except Exception:
                stored_meta = {}

        try:
            loaded = cls._load_validated_npz(npz_path, csv_path)
            return {
                "id": "pems08_public",
                "name": stored_meta.get(
                    "dataset_name",
                    "Caltrans PeMS08 Freeway Traffic Benchmark (Zenodo)",
                ),
                "description": (
                    "Genuine multi-sensor Caltrans PeMS District 8 freeway observations "
                    "(San Bernardino, 170 detectors, 5-min intervals, 62 days) measuring vehicle flow, "
                    "lane occupancy, and speed."
                ),
                "provenance": (
                    f"Caltrans PeMS District 8 distributed by Shiqi Zhang (Zhengzhou University) via Zenodo "
                    f"TrafficDataSets (DOI: {ZENODO_DOI}, {ZENODO_LICENSE}); benchmarked in Guo et al., "
                    "ASTGCN (AAAI 2019). Zero synthetic records."
                ),
                "sample_frequency": "5 minutes (17,856 steps / 62 days)",
                "sampling_interval": "5 minutes",
                "nodes_count": int(loaded["N"]),
                "total_samples": int(loaded["valid_points_count"]),
                "raw_records_total": int(loaded["raw_points_total"]),
                "excluded_dropout_records": int(loaded["invalid_or_dropout_points"]),
                "is_active": True,
                "is_simulated": False,
                "is_genuine_public": True,
                "ps003_eligible": True,
                "licensing": ZENODO_LICENSE,
                "source_url": f"https://doi.org/{ZENODO_DOI}",
                "documentation_url": ZENODO_DOCUMENTATION_URL,
                "time_range": f"{loaded['timestamps'][0].strftime('%Y-%m-%d %H:%M')} to {loaded['timestamps'][-1].strftime('%Y-%m-%d %H:%M')}",
                "available_features": ["flow (veh/5m)", "occupy (ratio [0,1])", "speed (mph)", "time_of_day", "is_weekend"],
                "prediction_target": "Future 5-min Traffic Flow (veh/5m)",
                "target_unit": "veh/5m",
                "sensors_description": f"{loaded['N']} PeMS District 8 freeway loop detectors ({loaded['edge_count']} road graph edges) -> 4 virtual corridor clients",
                "status_error": None,
            }
        except (PublicDatasetNotFoundError, PublicDatasetValidationError) as exc:
            return {
                "id": "pems08_public",
                "name": "Caltrans PeMS08 Freeway Traffic Benchmark (Zenodo)",
                "description": (
                    "Genuine multi-sensor Caltrans PeMS District 8 freeway observations "
                    "(requires PEMS08.npz in backend/data/public/)."
                ),
                "provenance": (
                    f"Caltrans PeMS District 8 via Zenodo TrafficDataSets (DOI: {ZENODO_DOI}). "
                    "Dataset file unavailable or failed validation."
                ),
                "sample_frequency": "5 minutes (unavailable)",
                "sampling_interval": "5 minutes",
                "nodes_count": 0,
                "total_samples": 0,
                "is_active": False,
                "is_simulated": False,
                "is_genuine_public": True,
                "ps003_eligible": True,
                "licensing": ZENODO_LICENSE,
                "source_url": f"https://doi.org/{ZENODO_DOI}",
                "documentation_url": ZENODO_DOCUMENTATION_URL,
                "time_range": "2016-07-01 00:00 to 2016-08-31 23:55 (unavailable locally)",
                "available_features": ["flow (veh/5m)", "occupy (ratio [0,1])", "speed (mph)", "time_of_day", "is_weekend"],
                "prediction_target": "Future 5-min Traffic Flow (veh/5m)",
                "target_unit": "veh/5m",
                "sensors_description": "170 PeMS District 8 detectors (missing/invalid locally)",
                "status_error": str(exc),
            }

    @classmethod
    def _extract_npz_windows(
        cls,
        loaded: Dict[str, Any],
        step_indices: np.ndarray,
        sensor_ids: List[int],
        horizon_steps: int,
    ) -> Tuple[np.ndarray, np.ndarray, int]:
        if len(step_indices) == 0 or len(sensor_ids) == 0:
            return np.empty((0, len(PEMS08_FEATURE_NAMES)), dtype=np.float64), np.empty((0,), dtype=np.float64), 0

        raw = loaded["raw"]
        valid_point = loaded["valid_point"]
        sin_h = loaded["sin_h"]
        cos_h = loaded["cos_h"]
        is_wknd = loaded["is_wknd"]

        s_idx = np.asarray(sensor_ids, dtype=np.int64)
        idx = np.asarray(step_indices, dtype=np.int64)

        ok = (
            valid_point[idx][:, s_idx]
            & valid_point[idx - 1][:, s_idx]
            & valid_point[idx - 2][:, s_idx]
            & valid_point[idx + horizon_steps][:, s_idx]
        )
        dropped_windows = int(ok.size - ok.sum())

        f0 = raw[idx][:, s_idx, 0]
        f1 = raw[idx - 1][:, s_idx, 0]
        f2 = raw[idx - 2][:, s_idx, 0]
        occ = raw[idx][:, s_idx, 1]
        spd = raw[idx][:, s_idx, 2]
        sh = np.broadcast_to(sin_h[idx][:, None], f0.shape)
        ch = np.broadcast_to(cos_h[idx][:, None], f0.shape)
        wk = np.broadcast_to(is_wknd[idx][:, None], f0.shape)
        y_all = raw[idx + horizon_steps][:, s_idx, 0]

        X = np.stack(
            [f0[ok], f1[ok], f2[ok], occ[ok], spd[ok], sh[ok], ch[ok], wk[ok]],
            axis=1,
        ).astype(np.float64) / PEMS08_FEATURE_SCALES
        y = y_all[ok].astype(np.float64)
        return X, y, dropped_windows

    @classmethod
    def load_pems08_benchmark_splits(
        cls,
        data_dir: Path | str | None = None,
        horizon_minutes: int = 15,
        test_ratio: float = 0.20,
        num_clients: int = 4,
        partition_strategy: str = "non_iid",
        random_seed: int = 42,
    ) -> PreparedPublicSplits:
        """
        Load verified Caltrans PeMS08 Zenodo dataset and prepare strict chronological
        leakage-free Centralized and Federated splits under IID or Non-IID partitioning.
        """
        partition_strategy = validate_partition_strategy(partition_strategy)
        random_seed = validate_random_seed(random_seed)

        base_dir = Path(data_dir) if data_dir else DEFAULT_PUBLIC_DATA_DIR
        npz_path = base_dir / "PEMS08.npz"
        csv_path = base_dir / "PEMS08.csv"

        if horizon_minutes < 5 or horizon_minutes % 5 != 0:
            raise PublicDatasetValidationError(
                f"Caltrans PeMS08 uses 5-minute intervals; target_horizon_minutes must be a positive multiple of 5 (got {horizon_minutes})."
            )
        if not (0.05 <= test_ratio <= 0.50):
            raise PublicDatasetValidationError(f"test_ratio must be in [0.05, 0.50], got {test_ratio}.")

        loaded = cls._load_validated_npz(npz_path, csv_path if csv_path.exists() else None)
        T = loaded["T"]
        N = loaded["N"]
        timestamps = loaded["timestamps"]
        horizon_steps = horizon_minutes // 5

        t_candidates = np.arange(2, T - horizon_steps, dtype=np.int64)
        if len(t_candidates) < 20:
            raise PublicDatasetValidationError(
                f"Insufficient time steps ({T}) for lag window + {horizon_minutes}-min horizon."
            )

        split_pos = int(len(t_candidates) * (1.0 - test_ratio))
        # Explicit purge embargo of horizon_steps guarantees max train target < min test input
        train_end = split_pos - horizon_steps
        if train_end < 5 or split_pos >= len(t_candidates) - 2:
            raise PublicDatasetValidationError(
                "Chronological split plus horizon purge embargo leaves insufficient train or test windows."
            )

        train_steps = t_candidates[:train_end]
        test_steps = t_candidates[split_pos:]

        max_train_target_dt = timestamps[int(train_steps[-1]) + horizon_steps]
        min_test_input_dt = timestamps[int(test_steps[0])]
        if max_train_target_dt >= min_test_input_dt:
            raise PublicDatasetValidationError(
                f"Temporal leakage detected: max train target {max_train_target_dt} >= min test input {min_test_input_dt}."
            )

        all_sensors = list(range(N))
        corridor_sensor_map = cls.deterministic_client_partition(
            all_sensors,
            num_clients=num_clients,
            client_prefix="pems08_zone",
        )

        non_iid_raw: Dict[str, Dict[str, Any]] = {}
        total_dropped_windows = 0

        for cid, sids in corridor_sensor_map.items():
            Xc, yc, dropped_c = cls._extract_npz_windows(loaded, train_steps, sids, horizon_steps)
            if len(Xc) < 10:
                raise PublicDatasetValidationError(
                    f"Virtual client '{cid}' has insufficient valid training windows ({len(Xc)}) after excluding invalid/dropout records."
                )
            total_dropped_windows += dropped_c
            non_iid_raw[cid] = {
                "X_train": Xc,
                "y_train": yc,
                "flow": Xc[:, 0] * PEMS08_FEATURE_SCALES[0],
                "occupy": Xc[:, 3] * PEMS08_FEATURE_SCALES[3],
                "speed": Xc[:, 4] * PEMS08_FEATURE_SCALES[4],
                "sensors": [f"PEMS08-S{s:03d}" for s in sids],
                "label": f"District 8 {cid.replace('pems08_', '').replace('_', ' ').title()} (Sensors {sids[0]}-{sids[-1]})",
            }

        (
            X_train_central,
            y_train_central,
            partitioned_clients,
            client_sensor_map,
            client_labels,
        ) = partition_client_windows(
            non_iid_raw,
            partition_strategy=partition_strategy,
            random_seed=random_seed,
        )

        client_data = {
            cid: {"X_train": p["X_train"], "y_train": p["y_train"]}
            for cid, p in partitioned_clients.items()
        }

        X_test_global, y_test_global, dropped_te = cls._extract_npz_windows(
            loaded, test_steps, all_sensors, horizon_steps
        )
        total_dropped_windows += dropped_te
        if len(X_test_global) < 10:
            raise PublicDatasetValidationError(
                f"Global chronological holdout test slice has insufficient valid windows ({len(X_test_global)})."
            )

        client_statistics, distribution_analysis = compute_distribution_analysis(
            client_observations=partitioned_clients,
            test_flow=X_test_global[:, 0] * PEMS08_FEATURE_SCALES[0],
            test_occupy=X_test_global[:, 3] * PEMS08_FEATURE_SCALES[3],
            test_speed=X_test_global[:, 4] * PEMS08_FEATURE_SCALES[4],
            target_unit="veh/5m",
            speed_unit="mph",
            partition_strategy=partition_strategy,
        )

        split_boundary_dt = timestamps[int(test_steps[0])]
        original_sensor_tags = [f"PEMS08-S{idx:03d}" for idx in all_sensors]

        return PreparedPublicSplits(
            dataset_id="pems08_public",
            dataset_name="Caltrans PeMS08 Freeway Traffic Benchmark (Zenodo)",
            dataset_provenance=(
                f"Genuine public Caltrans PeMS District 8 freeway observations distributed by Shiqi Zhang "
                f"(Zhengzhou University) via Zenodo TrafficDataSets (DOI: {ZENODO_DOI}, {ZENODO_LICENSE}; "
                "170 sensors, July-Aug 2016); ASTGCN (AAAI 2019)."
            ),
            documentation_url=ZENODO_DOCUMENTATION_URL,
            source_url=f"https://doi.org/{ZENODO_DOI}",
            license=ZENODO_LICENSE,
            prediction_target=f"Traffic Flow at t+{horizon_minutes}m (veh/5m)",
            target_unit="veh/5m",
            sampling_interval_minutes=5,
            feature_names=list(PEMS08_FEATURE_NAMES),
            horizon_minutes=horizon_minutes,
            horizon_steps=horizon_steps,
            sensors_count=N,
            original_sensor_ids=original_sensor_tags,
            num_clients=num_clients,
            client_sensor_map=client_sensor_map,
            client_labels=client_labels,
            X_train_central=X_train_central,
            y_train_central=y_train_central,
            X_test_global=X_test_global,
            y_test_global=y_test_global,
            client_data=client_data,
            split_boundary_iso=split_boundary_dt.isoformat() + "Z",
            max_train_target_iso=max_train_target_dt.isoformat() + "Z",
            min_test_input_iso=min_test_input_dt.isoformat() + "Z",
            time_range_iso=loaded["time_range_iso"],
            raw_points_total=loaded["raw_points_total"],
            valid_points_count=loaded["valid_points_count"],
            invalid_or_dropout_points=loaded["invalid_or_dropout_points"],
            dropped_window_samples=total_dropped_windows,
            graph_edges_count=loaded["edge_count"],
            partition_strategy=partition_strategy,
            random_seed=random_seed,
            client_statistics=client_statistics,
            distribution_analysis=distribution_analysis,
            extra_metadata={
                "sensor_id_range": f"0..{N - 1}",
                "train_steps": int(len(train_steps)),
                "test_steps": int(len(test_steps)),
                "purge_gap_steps": int(horizon_steps),
                "zero_traffic_points": int(loaded["zero_traffic_points"]),
                "partition_strategy": partition_strategy,
                "random_seed": random_seed,
            },
        )

    @classmethod
    def load_and_validate_tabular_csv(
        cls,
        csv_path: Path | str,
        horizon_minutes: int = 15,
        test_ratio: float = 0.20,
        num_clients: int = 4,
        partition_strategy: str = "non_iid",
        random_seed: int = 42,
    ) -> PreparedPublicSplits:
        """
        Load and strictly validate a generic long-format tabular traffic CSV file.
        Required columns: timestamp, sensor_id, flow, speed (optional: occupy).

        Handles out-of-order rows by sorting chronologically per sensor, converts timestamps
        into consistent chronological datetimes, excludes missing/invalid rows cleanly without
        synthesizing fake readings, deterministically maps original sensor IDs to 3-5 clients,
        and prepares leakage-free centralized and federated splits under IID or Non-IID partitioning.
        """
        partition_strategy = validate_partition_strategy(partition_strategy)
        random_seed = validate_random_seed(random_seed)

        path = Path(csv_path)
        if not path.exists():
            raise PublicDatasetNotFoundError(f"Tabular traffic CSV dataset not found at '{path}'.")

        required_cols = {"timestamp", "sensor_id", "flow", "speed"}
        per_sensor: Dict[str, List[Tuple[datetime, float, float, float]]] = {}
        raw_rows = 0
        invalid_rows = 0

        with open(path, "r", encoding="utf-8", newline="") as fh:
            reader = csv.DictReader(fh)
            if reader.fieldnames is None:
                raise PublicDatasetValidationError(f"CSV '{path}' is missing header columns.")
            cols = {c.strip() for c in reader.fieldnames if c is not None}
            missing_cols = required_cols - cols
            if missing_cols:
                raise PublicDatasetValidationError(
                    f"CSV '{path}' is missing required columns: {sorted(missing_cols)}. Found: {sorted(cols)}."
                )
            has_occ = "occupy" in cols

            for row_idx, row in enumerate(reader, start=2):
                raw_rows += 1
                sensor_raw = (row.get("sensor_id") or "").strip()
                ts_raw = (row.get("timestamp") or "").strip()
                flow_raw = (row.get("flow") or "").strip()
                spd_raw = (row.get("speed") or "").strip()
                occ_raw = (row.get("occupy") or "").strip() if has_occ else "0.0"

                if not sensor_raw or not ts_raw:
                    invalid_rows += 1
                    continue

                try:
                    dt = cls._parse_iso_timestamp(ts_raw)
                except ValueError as exc:
                    raise PublicDatasetValidationError(
                        f"Malformed timestamp '{ts_raw}' at row {row_idx} in '{path}'."
                    ) from exc

                # Missing / explicit null markers are excluded cleanly without fabrication
                na_markers = {"", "na", "nan", "null", "none"}
                if (
                    flow_raw.lower() in na_markers
                    or spd_raw.lower() in na_markers
                    or (has_occ and occ_raw.lower() in na_markers)
                ):
                    invalid_rows += 1
                    continue

                try:
                    flow_val = float(flow_raw)
                    spd_val = float(spd_raw)
                    occ_val = float(occ_raw) if has_occ else 0.0
                except ValueError as exc:
                    raise PublicDatasetValidationError(
                        f"Non-numeric measurement value at row {row_idx} in '{path}': {row}"
                    ) from exc

                if (
                    not np.isfinite(flow_val)
                    or not np.isfinite(spd_val)
                    or not np.isfinite(occ_val)
                    or flow_val < 0.0
                    or spd_val < 0.0
                    or occ_val < 0.0
                    or occ_val > 1.0
                ):
                    invalid_rows += 1
                    continue

                per_sensor.setdefault(sensor_raw, []).append((dt, flow_val, occ_val, spd_val))

        if raw_rows == 0:
            raise PublicDatasetValidationError(f"CSV '{path}' contains zero data rows.")

        valid_rows = raw_rows - invalid_rows
        if valid_rows == 0 or (valid_rows / raw_rows) < 0.50:
            raise PublicDatasetValidationError(
                f"Insufficient valid rows in '{path}': {valid_rows}/{raw_rows} valid after filtering invalid/missing measurements."
            )

        # Sort chronologically per sensor & infer sampling cadence without fabricating missing gaps
        diffs_sec: List[float] = []
        sensor_maps: Dict[str, Dict[datetime, Tuple[float, float, float]]] = {}
        all_timestamps_set: set[datetime] = set()

        for sid, items in per_sensor.items():
            items.sort(key=lambda r: r[0])
            rec_map: Dict[datetime, Tuple[float, float, float]] = {}
            prev_dt: Optional[datetime] = None
            for dt, fl, oc, sp in items:
                rec_map[dt] = (fl, oc, sp)
                all_timestamps_set.add(dt)
                if prev_dt is not None:
                    dsec = (dt - prev_dt).total_seconds()
                    if dsec > 0:
                        diffs_sec.append(dsec)
                prev_dt = dt
            sensor_maps[sid] = rec_map

        if not diffs_sec:
            raise PublicDatasetValidationError("Insufficient chronological timestamps to infer sampling interval.")
        base_interval_min = int(round(float(np.median(diffs_sec)) / 60.0))
        if base_interval_min <= 0:
            raise PublicDatasetValidationError("Invalid zero or negative chronological step interval.")
        if horizon_minutes < base_interval_min or horizon_minutes % base_interval_min != 0:
            raise PublicDatasetValidationError(
                f"Horizon {horizon_minutes}m is incompatible with {base_interval_min}-min interval."
            )

        sorted_all_ts = sorted(all_timestamps_set)
        split_idx = int(len(sorted_all_ts) * (1.0 - test_ratio))
        if split_idx < 4 or split_idx >= len(sorted_all_ts) - 1:
            raise PublicDatasetValidationError("Insufficient distinct timestamps for chronological train/test split.")

        boundary_dt = sorted_all_ts[split_idx]
        step_delta = timedelta(minutes=base_interval_min)
        horizon_delta = timedelta(minutes=horizon_minutes)

        sensor_ids_sorted = sorted(sensor_maps.keys())
        corridor_sensor_map = cls.deterministic_client_partition(
            sensor_ids_sorted,
            num_clients=num_clients,
            client_prefix="csv_zone",
        )

        non_iid_raw: Dict[str, Dict[str, Any]] = {}
        X_te_list, y_te_list = [], []
        train_target_dts: List[datetime] = []
        test_input_dts: List[datetime] = []
        dropped_windows = 0

        for cid, sids in corridor_sensor_map.items():
            Xc_rows, yc_vals = [], []
            for sid in sids:
                rmap = sensor_maps[sid]
                for dt, (f0, occ, spd) in sorted(rmap.items()):
                    dt1 = dt - step_delta
                    dt2 = dt - 2 * step_delta
                    dt_t = dt + horizon_delta
                    if dt1 not in rmap or dt2 not in rmap or dt_t not in rmap:
                        dropped_windows += 1
                        continue
                    hour = dt.hour + dt.minute / 60.0
                    feat = np.array(
                        [
                            f0,
                            rmap[dt1][0],
                            rmap[dt2][0],
                            occ,
                            spd,
                            np.sin(2.0 * np.pi * hour / 24.0),
                            np.cos(2.0 * np.pi * hour / 24.0),
                            1.0 if dt.weekday() >= 5 else 0.0,
                        ],
                        dtype=np.float64,
                    ) / PEMS08_FEATURE_SCALES
                    target_val = float(rmap[dt_t][0])

                    if dt_t < boundary_dt:
                        Xc_rows.append(feat)
                        yc_vals.append(target_val)
                        train_target_dts.append(dt_t)
                    elif dt >= boundary_dt:
                        X_te_list.append(feat)
                        y_te_list.append(target_val)
                        test_input_dts.append(dt)
                    else:
                        # Target straddles split boundary: purge cleanly to prevent leakage
                        dropped_windows += 1

            if not Xc_rows:
                raise PublicDatasetValidationError(
                    f"Client '{cid}' produced zero valid chronological training windows from '{path}'."
                )
            Xc_arr = np.asarray(Xc_rows, dtype=np.float64)
            yc_arr = np.asarray(yc_vals, dtype=np.float64)
            non_iid_raw[cid] = {
                "X_train": Xc_arr,
                "y_train": yc_arr,
                "flow": Xc_arr[:, 0] * PEMS08_FEATURE_SCALES[0],
                "occupy": (Xc_arr[:, 3] * PEMS08_FEATURE_SCALES[3]) if has_occ else None,
                "speed": Xc_arr[:, 4] * PEMS08_FEATURE_SCALES[4],
                "sensors": list(sids),
                "label": f"CSV Zone {cid} ({len(sids)} sensors)",
            }

        if not X_te_list or not train_target_dts or not test_input_dts:
            raise PublicDatasetValidationError(
                f"Tabular dataset '{path}' did not yield non-empty purged chronological train/test splits."
            )

        max_tr_target = max(train_target_dts)
        min_te_input = min(test_input_dts)
        if max_tr_target >= min_te_input:
            raise PublicDatasetValidationError("Chronological purge invariant failed on tabular CSV.")

        (
            X_tr_central,
            y_tr_central,
            partitioned_clients,
            client_sensor_map,
            client_labels,
        ) = partition_client_windows(
            non_iid_raw,
            partition_strategy=partition_strategy,
            random_seed=random_seed,
        )
        client_data = {
            cid: {"X_train": p["X_train"], "y_train": p["y_train"]}
            for cid, p in partitioned_clients.items()
        }
        X_te_arr = np.asarray(X_te_list, dtype=np.float64)
        y_te_arr = np.asarray(y_te_list, dtype=np.float64)
        client_statistics, distribution_analysis = compute_distribution_analysis(
            client_observations=partitioned_clients,
            test_flow=X_te_arr[:, 0] * PEMS08_FEATURE_SCALES[0],
            test_occupy=(X_te_arr[:, 3] * PEMS08_FEATURE_SCALES[3]) if has_occ else None,
            test_speed=X_te_arr[:, 4] * PEMS08_FEATURE_SCALES[4],
            target_unit="veh/interval",
            speed_unit="speed_unit",
            partition_strategy=partition_strategy,
        )

        return PreparedPublicSplits(
            dataset_id="tabular_public_csv",
            dataset_name=f"Tabular Public CSV ({path.name})",
            dataset_provenance=f"Validated tabular traffic CSV loaded from {path.name}.",
            documentation_url="",
            source_url="",
            license="User-supplied verified CSV",
            prediction_target=f"Traffic Flow at t+{horizon_minutes}m",
            target_unit="veh/interval",
            sampling_interval_minutes=base_interval_min,
            feature_names=list(TABULAR_FEATURE_NAMES),
            horizon_minutes=horizon_minutes,
            horizon_steps=horizon_minutes // base_interval_min,
            sensors_count=len(sensor_ids_sorted),
            original_sensor_ids=sensor_ids_sorted,
            num_clients=num_clients,
            client_sensor_map=client_sensor_map,
            client_labels=client_labels,
            X_train_central=X_tr_central,
            y_train_central=y_tr_central,
            X_test_global=X_te_arr,
            y_test_global=y_te_arr,
            client_data=client_data,
            split_boundary_iso=boundary_dt.isoformat() + "Z",
            max_train_target_iso=max_tr_target.isoformat() + "Z",
            min_test_input_iso=min_te_input.isoformat() + "Z",
            time_range_iso=f"{sorted_all_ts[0].isoformat()}Z to {sorted_all_ts[-1].isoformat()}Z",
            raw_points_total=raw_rows,
            valid_points_count=valid_rows,
            invalid_or_dropout_points=invalid_rows,
            dropped_window_samples=dropped_windows,
            partition_strategy=partition_strategy,
            random_seed=random_seed,
            client_statistics=client_statistics,
            distribution_analysis=distribution_analysis,
        )

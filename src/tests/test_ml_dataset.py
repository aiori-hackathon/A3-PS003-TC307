import pytest
from datetime import datetime, timezone, timedelta
import numpy as np

from backend.app.database import SessionLocal
from backend.app.models.database import TrafficObservation
from backend.app.ml.predictor import (
    ChronologicalDatasetBuilder,
    ChronologicalTrafficDataset,
    InsufficientDataError,
    predictor_instance,
)


@pytest.fixture
def synthetic_traffic_fixture():
    """
    Synthetic fixture created strictly for unit testing.
    Never labeled as real-world model results.
    """
    base_time = datetime(2026, 10, 1, 8, 0, 0)
    observations = []

    # Generate 50 contiguous 15-minute observations for INT-01
    for step in range(50):
        t = base_time + timedelta(minutes=15 * step)
        obs = TrafficObservation(
            id=10000 + step,
            intersection_id="INT-01",
            timestamp=t,
            vehicle_volume=300 + (step % 10) * 15,
            average_speed=45.0 - (step % 8) * 2.0,
            congestion_level="low" if step % 2 == 0 else "moderate",
            is_simulated=True,
            source="simulated",
            provider_name="Test Synthetic Fixture",
            confidence_score=1.0,
        )
        observations.append(obs)

    return observations


def test_chronological_split_and_leakage_prevention(synthetic_traffic_fixture):
    """Verify that train, validation, and test splits are strictly chronological without overlap."""
    dataset = ChronologicalDatasetBuilder.prepare_dataset(
        synthetic_traffic_fixture,
        intersection_id="INT-01",
        genuine_only=False,
        min_samples=25,
        train_ratio=0.70,
        val_ratio=0.15,
        test_ratio=0.15,
    )

    assert isinstance(dataset, ChronologicalTrafficDataset)
    assert dataset.intersection_id == "INT-01"
    assert dataset.is_genuine is False
    assert "Synthetic / Fixture" in dataset.data_source_label

    # Check non-empty arrays
    assert len(dataset.X_train) > 0
    assert len(dataset.X_val) > 0
    assert len(dataset.X_test) > 0

    # Verify strict temporal sequencing to prevent data leakage
    max_train_time = max(dataset.train_timestamps)
    min_val_time = min(dataset.val_timestamps)
    max_val_time = max(dataset.val_timestamps)
    min_test_time = min(dataset.test_timestamps)

    assert max_train_time < min_val_time, "Train data must precede validation data chronologically"
    assert max_val_time < min_test_time, "Validation data must precede test data chronologically"


def test_15m_speed_target_alignment(synthetic_traffic_fixture):
    """Verify target speed aligns exactly to the 15-minute ahead observation."""
    dataset = ChronologicalDatasetBuilder.prepare_dataset(
        synthetic_traffic_fixture,
        intersection_id="INT-01",
        genuine_only=False,
        min_samples=20,
    )

    # For each sample, the target speed must match the speed observed 15 minutes after current timestamp
    obs_by_time = {o.timestamp: o.average_speed for o in synthetic_traffic_fixture}

    for i, t in enumerate(dataset.train_timestamps):
        expected_target_time = t + timedelta(minutes=15)
        expected_target_speed = obs_by_time[expected_target_time]
        actual_target_speed = dataset.y_train_speed[i]
        assert actual_target_speed == pytest.approx(expected_target_speed, abs=1e-3)


def test_road_identity_isolation(synthetic_traffic_fixture):
    """Verify that observations from different road intersections are isolated and never cross-contaminate."""
    # Add observations for a different intersection (INT-02) interleaved in time
    mixed_observations = list(synthetic_traffic_fixture)
    for step in range(20):
        t = datetime(2026, 10, 1, 8, 0, 0) + timedelta(minutes=15 * step)
        mixed_observations.append(
            TrafficObservation(
                id=20000 + step,
                intersection_id="INT-02",
                timestamp=t,
                vehicle_volume=999,  # Distinct value
                average_speed=10.0,
                congestion_level="severe",
                is_simulated=True,
                source="simulated",
            )
        )

    dataset_int1 = ChronologicalDatasetBuilder.prepare_dataset(
        mixed_observations,
        intersection_id="INT-01",
        genuine_only=False,
        min_samples=20,
    )
    assert dataset_int1.intersection_id == "INT-01"
    # Ensure INT-02 volumes (999) never leaked into INT-01 feature matrices
    assert np.all(dataset_int1.X_train[:, 2] != 999)


def test_genuine_vs_simulated_filtering():
    """Verify that genuine_only=True selects only genuine observations and rejects synthetic data."""
    base_time = datetime(2026, 10, 1, 8, 0, 0)
    mixed_obs = []

    # 35 synthetic observations
    for i in range(35):
        mixed_obs.append(
            TrafficObservation(
                id=30000 + i,
                intersection_id="INT-03",
                timestamp=base_time + timedelta(minutes=15 * i),
                vehicle_volume=200,
                average_speed=40.0,
                congestion_level="low",
                is_simulated=True,
                source="simulated",
            )
        )

    # When requesting genuine_only, 0 genuine records must raise InsufficientDataError
    with pytest.raises(InsufficientDataError) as exc_info:
        ChronologicalDatasetBuilder.prepare_dataset(
            mixed_obs,
            intersection_id="INT-03",
            genuine_only=True,
            min_samples=30,
        )
    assert "genuine" in str(exc_info.value).lower()

    # Now add 35 genuine observations
    for i in range(35):
        mixed_obs.append(
            TrafficObservation(
                id=40000 + i,
                intersection_id="INT-03",
                timestamp=base_time + timedelta(hours=20) + timedelta(minutes=15 * i),
                vehicle_volume=250,
                average_speed=38.0,
                congestion_level="low",
                is_simulated=False,
                source="live_provider",
                provider_name="TomTom Traffic Flow API",
                confidence_score=0.98,
            )
        )

    # Now genuine_only should succeed
    genuine_dataset = ChronologicalDatasetBuilder.prepare_dataset(
        mixed_obs,
        intersection_id="INT-03",
        genuine_only=True,
        min_samples=30,
    )
    assert genuine_dataset.is_genuine is True
    assert genuine_dataset.data_source_label == "Genuine Live Provider Observations"
    assert genuine_dataset.total_valid_samples >= 10


def test_missing_observations_gap_handling():
    """Verify that temporal gaps (> 20 min) are handled safely without computing corrupted lag features."""
    base_time = datetime(2026, 10, 1, 8, 0, 0)
    gap_observations = []

    # 15 observations before gap
    for i in range(15):
        gap_observations.append(
            TrafficObservation(
                id=50000 + i,
                intersection_id="INT-04",
                timestamp=base_time + timedelta(minutes=15 * i),
                vehicle_volume=400,
                average_speed=50.0,
                congestion_level="low",
                is_simulated=True,
                source="simulated",
            )
        )

    # Jump forward by 3 hours (a large outage gap)
    post_gap_time = base_time + timedelta(minutes=15 * 14) + timedelta(hours=3)

    # 15 observations after gap
    for i in range(15):
        gap_observations.append(
            TrafficObservation(
                id=60000 + i,
                intersection_id="INT-04",
                timestamp=post_gap_time + timedelta(minutes=15 * i),
                vehicle_volume=420,
                average_speed=48.0,
                congestion_level="low",
                is_simulated=True,
                source="simulated",
            )
        )

    dataset = ChronologicalDatasetBuilder.prepare_dataset(
        gap_observations,
        intersection_id="INT-04",
        genuine_only=False,
        min_samples=25,
    )
    # Must report detected gaps and preserve valid sequences
    assert dataset.missing_gap_count >= 1
    assert dataset.total_valid_samples > 0


def test_insufficient_history_handling():
    """Verify that insufficient observations safely raise InsufficientDataError."""
    few_obs = [
        TrafficObservation(
            id=70001,
            intersection_id="INT-05",
            timestamp=datetime(2026, 10, 1, 8, 0),
            vehicle_volume=200,
            average_speed=40.0,
            congestion_level="low",
            is_simulated=True,
            source="simulated",
        ),
        TrafficObservation(
            id=70002,
            intersection_id="INT-05",
            timestamp=datetime(2026, 10, 1, 8, 15),
            vehicle_volume=210,
            average_speed=39.0,
            congestion_level="low",
            is_simulated=True,
            source="simulated",
        ),
    ]

    with pytest.raises(InsufficientDataError) as exc_info:
        ChronologicalDatasetBuilder.prepare_dataset(
            few_obs,
            intersection_id="INT-05",
            min_samples=20,
        )
    assert "Insufficient" in str(exc_info.value)


def test_prepare_dataset_from_live_database():
    """Verify dataset construction directly from the live database historical observations."""
    db = SessionLocal()
    try:
        dataset = predictor_instance.prepare_dataset_from_db(
            db,
            intersection_id="INT-01",
            genuine_only=False,
            min_samples=30,
        )
        assert dataset.intersection_id == "INT-01"
        assert len(dataset.X_train) > 0
        assert len(dataset.X_val) > 0
        assert len(dataset.X_test) > 0
        assert dataset.X_train.shape[1] == len(ChronologicalDatasetBuilder.FEATURE_NAMES)
        assert max(dataset.train_timestamps) < min(dataset.val_timestamps)
    finally:
        db.close()

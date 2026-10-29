import os
import pytest
from backend.app.database import SessionLocal
from backend.app.ml.predictor import (
    TrafficPredictor,
    ModelEvaluationResult,
    ModelNotReadyError,
    InsufficientDataError,
    predictor_instance,
)


def test_model_training_and_baseline_comparison():
    """Verify training of 15-minute speed model and genuinely measured baseline comparison."""
    db = SessionLocal()
    try:
        predictor = TrafficPredictor()
        eval_result = predictor.train_speed_model(db, intersection_id="INT-01")

        assert isinstance(eval_result, ModelEvaluationResult)
        assert eval_result.intersection_id == "INT-01"
        assert eval_result.horizon_minutes == 15
        assert eval_result.model_mae > 0.0
        assert eval_result.model_rmse > 0.0
        assert eval_result.baseline_mae > 0.0
        assert eval_result.baseline_rmse > 0.0
        assert eval_result.test_samples_count > 0
        assert eval_result.residual_std_err > 0.0
        assert -100.0 <= eval_result.improvement_pct <= 100.0
    finally:
        db.close()


def test_model_readiness_checks():
    """Verify model readiness diagnostics before and after training."""
    predictor = TrafficPredictor()

    # Brand new intersection must report untrained
    status_untrained = predictor.get_model_status("INT-NONEXISTENT", horizon_minutes=15)
    assert status_untrained["is_ready"] is False
    assert status_untrained["status"] == "untrained"

    db = SessionLocal()
    try:
        predictor.train_speed_model(db, intersection_id="INT-02")
        status_ready = predictor.get_model_status("INT-02", horizon_minutes=15)
        assert status_ready["is_ready"] is True
        assert status_ready["status"] == "ready"
        assert "mae" in status_ready["metrics"]
    finally:
        db.close()


def test_model_artifact_persistence_and_loading():
    """Verify model saving to disk, clearing in-memory cache, and reloading artifact."""
    db = SessionLocal()
    try:
        predictor = TrafficPredictor()
        predictor.train_speed_model(db, intersection_id="INT-03")
        assert predictor.is_ready("INT-03", 15) is True

        # Clear in-memory dictionary
        predictor.models.clear()
        predictor.metrics.clear()
        predictor.speed_models.clear()
        predictor.speed_metrics.clear()
        assert "INT-03" not in predictor.speed_models

        # Reload from disk artifact
        loaded = predictor.load_model_artifact("INT-03", horizon_minutes=15)
        assert loaded is True
        assert predictor.is_ready("INT-03", 15) is True
        assert "mae" in predictor.speed_metrics["INT-03"][15]
    finally:
        db.close()


def test_speed_prediction_inference_without_retraining():
    """Verify reusable speed inference latency, uncertainty bounds, and no-retrain behavior."""
    db = SessionLocal()
    try:
        predictor = TrafficPredictor()
        # Train once
        predictor.train_speed_model(db, intersection_id="INT-04")
        model_before = predictor.speed_models["INT-04"][15]

        # Execute multiple inference passes
        res1 = predictor.predict_speed(db, intersection_id="INT-04", horizon_minutes=15)
        res2 = predictor.predict_speed(db, intersection_id="INT-04", horizon_minutes=15)

        # Model instance in memory must remain the exact same (no retraining)
        assert predictor.speed_models["INT-04"][15] is model_before

        assert res1["intersection_id"] == "INT-04"
        assert res1["horizon_minutes"] == 15
        assert res1["predicted_speed"] > 0
        assert res1["uncertainty_lower_speed"] <= res1["predicted_speed"] <= res1["uncertainty_upper_speed"]
        assert res1["inference_latency_ms"] < 100.0  # Fast inference
    finally:
        db.close()


def test_no_fabrication_on_insufficient_history():
    """Verify that predictions are not fabricated when intersection history is missing."""
    db = SessionLocal()
    try:
        predictor = TrafficPredictor()
        with pytest.raises(InsufficientDataError):
            predictor.predict_speed(db, intersection_id="INT-EMPTY-XYZ", horizon_minutes=15)
    finally:
        db.close()


def test_preservation_of_phase1_prediction_contract():
    """Verify that full shared prediction contract is preserved across all supported horizons."""
    db = SessionLocal()
    try:
        # Test horizon 15m and 60m
        for h in [15, 60]:
            pred = predictor_instance.predict(db, intersection_id="INT-01", horizon_minutes=h)
            required_keys = [
                "intersection_id",
                "intersection_name",
                "horizon_minutes",
                "predicted_volume",
                "predicted_speed",
                "predicted_congestion_level",
                "estimated_travel_time_min",
                "expected_congestion_onset",
                "uncertainty_lower_volume",
                "uncertainty_upper_volume",
                "uncertainty_method",
                "inference_latency_ms",
                "model_type",
                "test_mae",
                "test_rmse",
                "feature_explanations",
                "forecast_timeline",
                "forecast_generated_at",
                "data_source",
                "data_freshness",
                "is_simulated",
            ]
            for k in required_keys:
                assert k in pred, f"Missing required contract key '{k}'"
            assert pred["horizon_minutes"] == h
            assert pred["predicted_speed"] > 0
    finally:
        db.close()

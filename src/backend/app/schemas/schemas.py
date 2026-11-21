from datetime import datetime
from typing import List, Optional, Dict, Any, Set
from pydantic import BaseModel, Field, field_validator


# --- Intersections & Traffic ---
class IntersectionBase(BaseModel):
    id: str
    name: str
    name_hi: str
    zone: str
    latitude: float
    longitude: float
    baseline_speed: float
    capacity: int
    edge_client_id: Optional[str] = None


class IntersectionDetail(IntersectionBase):
    current_volume: int
    current_speed: float
    congestion_level: str  # "low", "moderate", "severe"
    risk_score: float  # 0 to 100
    edge_status: str  # "active", "training", "idle", "disconnected"
    source: str = "simulated"
    is_simulated: bool = True
    data_freshness: str = "Recent (< 15 min)"
    last_updated: Optional[str] = None
    free_flow_speed: Optional[float] = None
    delay_seconds: Optional[float] = None
    queue_length: Optional[int] = None
    confidence_score: Optional[float] = None


class CorridorDetail(BaseModel):
    id: str
    name: str
    name_hi: str
    description: str
    description_hi: Optional[str] = None
    distance_km: float
    origin_id: str
    origin_name: str
    destination_id: str
    destination_name: str
    average_speed: float
    travel_time_minutes: int
    free_flow_time_minutes: int
    delay_minutes: int
    congestion_level: str  # "free", "moderate", "heavy"
    condition_label: str
    condition_label_hi: str
    source: str = "live_provider"
    is_simulated: bool = False
    data_freshness: str = "Recent (< 15 min)"
    last_updated: Optional[str] = None


class TrafficObservationItem(BaseModel):
    id: Optional[int] = None
    intersection_id: Optional[str] = None
    timestamp: str
    time_label: Optional[str] = None
    vehicle_volume: int
    average_speed: float
    congestion_level: str
    source: str = "simulated"
    is_simulated: bool = True
    provider_name: Optional[str] = "Simulated Diurnal Stream"
    confidence_score: Optional[float] = 1.0


class TrafficObservationDTO(BaseModel):
    intersection_id: str
    timestamp: str
    vehicle_volume: int
    average_speed: float
    congestion_level: str  # "low", "moderate", "severe"
    source: str = "simulated"  # "live_provider", "simulated", "cached", "sensor"
    is_simulated: bool = True
    provider_name: Optional[str] = "Simulated Diurnal Stream"
    confidence_score: Optional[float] = 1.0


class ProviderStatusDTO(BaseModel):
    provider_name: str
    mode: str  # "live" or "simulated"
    is_online: bool
    last_sync_time: Optional[str] = None
    last_incident_sync_time: Optional[str] = None
    cached_records_count: int = 0
    live_incidents_count: int = 0
    quota_remaining: Optional[int] = None
    error_fallback_active: bool = False
    background_polling_active: bool = False
    refresh_interval_seconds: float = 300.0
    message: str


# --- Dashboard ---
class DashboardSummary(BaseModel):
    total_intersections: int
    average_speed: float
    congested_roads_count: int
    predicted_congestion_events: int
    active_edge_nodes: int
    federated_round: int
    communication_savings_pct: float
    recent_volume_trend: List[Dict[str, Any]]
    speed_trend: List[Dict[str, Any]]
    congestion_distribution: Dict[str, int]
    communication_savings_trend: List[Dict[str, Any]]
    is_simulated: bool = True
    data_source: str = "Simulated Diurnal Stream"
    data_freshness: str = "Recent (< 15 min)"
    provider_status: Optional[ProviderStatusDTO] = None


# --- Predictions ---
ALLOWED_HORIZONS: Set[int] = {15, 30, 60, 360, 1440}


class PredictionRequest(BaseModel):
    intersection_id: str
    horizon_minutes: int = 60
    use_optimized_fl: bool = True

    @field_validator("horizon_minutes")
    @classmethod
    def validate_horizon(cls, v: int) -> int:
        if v not in ALLOWED_HORIZONS:
            raise ValueError(
                f"Invalid horizon_minutes '{v}'. Supported horizons: 15 (15m), 30 (30m), 60 (1h), 360 (6h), 1440 (24h)."
            )
        return v


class FeatureAttribution(BaseModel):
    feature: str
    feature_hi: str
    weight: float
    impact: str  # "increases_traffic" or "decreases_traffic"


class PredictionResponse(BaseModel):
    intersection_id: str
    intersection_name: str
    intersection_name_hi: str
    horizon_minutes: int
    predicted_volume: int
    predicted_speed: float
    predicted_congestion_level: str
    estimated_travel_time_min: float
    expected_congestion_onset: Optional[str] = None
    congestion_trend: Optional[str] = 'stable'
    recommended_departure_time: Optional[str] = None
    uncertainty_lower_volume: Optional[int] = None
    uncertainty_upper_volume: Optional[int] = None
    uncertainty_method: Optional[str] = None
    inference_latency_ms: float
    model_type: str = "Ridge Regression (Chronological Split)"
    model_version: str = "v1.4.2-ridge-fl"
    test_mae: float
    test_rmse: float
    feature_explanations: List[FeatureAttribution]
    forecast_timeline: List[Dict[str, Any]]
    forecast_generated_at: str
    data_source: str = "Reproducible Synthetic Delhi NCR Dataset"
    data_freshness: str = "Recent (< 15 min)"
    is_simulated: bool = True
    observation_timestamp: Optional[str] = None
    observation_age_minutes: Optional[float] = None
    is_stale: bool = False
    freshness_warning: Optional[str] = None
    model_readiness: str = "ready"
    baseline_mae: Optional[float] = None
    baseline_rmse: Optional[float] = None
    model_improvement_pct: Optional[float] = None
    is_forecast: bool = True


# --- Federated Learning ---
class ClientStatus(BaseModel):
    id: str
    name: str
    name_hi: str
    zone: str
    status: str
    local_samples: int
    battery_health: float
    network_latency: float
    last_loss: Optional[float] = None
    model_update_bytes: Optional[int] = None
    upload_bytes: Optional[int] = None
    download_bytes: Optional[int] = None
    cumulative_bytes: Optional[int] = None


def _validate_compression_method(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    supported = ("full_precision", "top_k", "int8", "top_k_int8")
    if value not in supported:
        raise ValueError(
            f"Unsupported compression_method '{value}'. Supported values are {list(supported)}."
        )
    return value


class BenchmarkCompareRequest(BaseModel):
    dataset_type: str = Field(default="synthetic", pattern="^(synthetic|pems08|pems08_public|live)$")
    target_horizon_minutes: int = Field(default=30, ge=5, le=1440)
    federated_rounds: int = Field(default=3, ge=1, le=10)
    apply_compression: bool = False
    top_k_retention_pct: float = Field(default=100.0, gt=0.0, le=100.0)
    int8_quantization: bool = False
    compression_method: Optional[str] = None
    partition_strategy: str = Field(default="non_iid")
    random_seed: int = Field(default=42, ge=0, le=2_147_483_647)

    @field_validator("partition_strategy")
    @classmethod
    def check_partition_strategy(cls, value: str) -> str:
        if value not in ("iid", "non_iid"):
            raise ValueError(
                f"Unsupported partition_strategy '{value}'. Supported values are 'iid' or 'non_iid'."
            )
        return value

    @field_validator("compression_method")
    @classmethod
    def check_compression_method(cls, value: Optional[str]) -> Optional[str]:
        return _validate_compression_method(value)


class PartitionComparisonRequest(BaseModel):
    dataset_type: str = Field(default="pems08_public", pattern="^(synthetic|pems08|pems08_public|live)$")
    target_horizon_minutes: int = Field(default=15, ge=5, le=1440)
    federated_rounds: int = Field(default=5, ge=1, le=10)
    apply_compression: bool = False
    top_k_retention_pct: float = Field(default=100.0, gt=0.0, le=100.0)
    int8_quantization: bool = False
    compression_method: Optional[str] = None
    random_seed: int = Field(default=42, ge=0, le=2_147_483_647)

    @field_validator("compression_method")
    @classmethod
    def check_compression_method(cls, value: Optional[str]) -> Optional[str]:
        return _validate_compression_method(value)


class ClientDistributionStat(BaseModel):
    client_id: str
    label: str
    partition_strategy: str
    sensors_count: int
    train_samples: int
    sample_share_pct: float
    flow_mean: float
    flow_std: float
    flow_unit: str
    occupancy_mean: Optional[float] = None
    speed_mean: Optional[float] = None
    speed_unit: Optional[str] = None


class BenchmarkApproachResult(BaseModel):
    model_name: str
    parameter_count: Optional[int] = None
    training_paradigm: str
    privacy_guarantee: str
    train_samples_count: int
    test_samples_count: int
    mae: float
    rmse: float
    data_transmitted_bytes: int
    data_transmitted_formatted: str
    upload_bytes: int
    download_bytes: int
    download_bytes_modeled: Optional[int] = None
    participating_clients: int
    training_duration_ms: float
    round_history: Optional[List[Dict[str, Any]]] = None
    communication_summary: Optional[Dict[str, Any]] = None
    centralized_accounting: Optional[Dict[str, Any]] = None


class BenchmarkDeltaComparison(BaseModel):
    mae_delta: float
    mae_delta_pct: float
    rmse_delta: float
    rmse_delta_pct: float
    bandwidth_savings_bytes: int
    bandwidth_savings_pct: float
    communication_reduction_factor: float
    accuracy_tradeoff_summary: str


class BenchmarkCompareResponse(BaseModel):
    benchmark_id: str
    executed_at: str
    dataset_id: Optional[str] = None
    dataset_name: str
    dataset_provenance: str
    is_simulated: bool = False
    is_genuine_public: bool = False
    data_type_label: str = "Synthetic"
    dataset_license: Optional[str] = None
    source_url: Optional[str] = None
    documentation_url: Optional[str] = None
    sensors_count: Optional[int] = None
    sampling_interval: Optional[str] = None
    time_range: Optional[str] = None
    target_unit: str = "veh/15m"
    prediction_target: str
    target_horizon_minutes: int
    partition_strategy: str = "non_iid"
    random_seed: int = 42
    training_config: Optional[Dict[str, Any]] = None
    accounting_type: Optional[str] = None
    client_summary: Optional[List[Dict[str, Any]]] = None
    client_statistics: Optional[List[ClientDistributionStat]] = None
    distribution_analysis: Optional[Dict[str, Any]] = None
    centralized: BenchmarkApproachResult
    federated: BenchmarkApproachResult
    delta: BenchmarkDeltaComparison
    assumptions: List[str]
    methodology: str


class PartitionStrategyResult(BaseModel):
    partition_strategy: str
    federated: BenchmarkApproachResult
    delta: BenchmarkDeltaComparison
    client_statistics: List[ClientDistributionStat]
    distribution_analysis: Dict[str, Any]
    client_summary: List[Dict[str, Any]]


class PartitionComparisonResponse(BaseModel):
    experiment_id: str
    executed_at: str
    dataset_id: str
    dataset_name: str
    dataset_provenance: str
    is_simulated: bool = False
    is_genuine_public: bool = False
    data_type_label: str = "Public"
    dataset_license: Optional[str] = None
    source_url: Optional[str] = None
    documentation_url: Optional[str] = None
    sensors_count: Optional[int] = None
    sampling_interval: Optional[str] = None
    time_range: Optional[str] = None
    target_unit: str = "veh/5m"
    prediction_target: str
    target_horizon_minutes: int
    random_seed: int
    shared_config: Dict[str, Any]
    centralized: BenchmarkApproachResult
    iid: PartitionStrategyResult
    non_iid: PartitionStrategyResult
    comparison_summary: Dict[str, Any]


class MultiSeedBenchmarkRequest(BaseModel):
    dataset_type: str = Field(default="pems08_public", pattern="^(synthetic|pems08|pems08_public|live)$")
    target_horizon_minutes: int = Field(default=15, ge=5, le=1440)
    federated_rounds: int = Field(default=5, ge=1, le=10)
    apply_compression: bool = False
    top_k_retention_pct: float = Field(default=100.0, gt=0.0, le=100.0)
    int8_quantization: bool = False
    compression_method: Optional[str] = None
    seeds: List[int] = Field(default_factory=lambda: [42, 123, 2026])
    partition_strategies: List[str] = Field(default_factory=lambda: ["iid", "non_iid"])

    @field_validator("compression_method")
    @classmethod
    def check_compression_method(cls, value: Optional[str]) -> Optional[str]:
        return _validate_compression_method(value)

    @field_validator("seeds", mode="before")
    @classmethod
    def check_seeds(cls, value: Any) -> List[int]:
        if not isinstance(value, list) or not value:
            raise ValueError("seeds must be a non-empty list of distinct non-negative integers (default [42, 123, 2026]).")
        if len(value) > 10:
            raise ValueError("seeds cannot exceed 10 runs per experiment request.")
        validated: List[int] = []
        seen = set()
        for item in value:
            if isinstance(item, bool) or not isinstance(item, int):
                raise ValueError(f"Invalid seed '{item}'. All seeds must be strict integers (not booleans, floats, or strings).")
            if item < 0 or item > 2_147_483_647:
                raise ValueError(f"Seed {item} is out of valid bounds [0, 2147483647].")
            if item in seen:
                raise ValueError(f"Duplicate seed {item} is not allowed; each run requires a distinct seed.")
            seen.add(item)
            validated.append(item)
        return validated

    @field_validator("partition_strategies")
    @classmethod
    def check_partition_strategies(cls, value: List[str]) -> List[str]:
        if not value:
            raise ValueError("partition_strategies must contain at least one strategy ('iid' or 'non_iid').")
        validated: List[str] = []
        for s in value:
            if s not in ("iid", "non_iid"):
                raise ValueError(f"Unsupported partition_strategy '{s}'. Supported values are 'iid' or 'non_iid'.")
            if s not in validated:
                validated.append(s)
        return validated


class SeedFailureDetail(BaseModel):
    seed: int
    group: str
    error: str


class SeedIndividualResult(BaseModel):
    seed: int
    status: str
    error: Optional[str] = None
    train_samples_count: Optional[int] = None
    test_samples_count: Optional[int] = None
    mae: Optional[float] = None
    rmse: Optional[float] = None
    final_round_mae: Optional[float] = None
    final_round_rmse: Optional[float] = None
    data_transmitted_bytes: Optional[int] = None
    data_transmitted_formatted: Optional[str] = None
    upload_bytes: Optional[int] = None
    download_bytes_modeled: Optional[int] = None
    compression_method: Optional[str] = None
    upload_compression_ratio: Optional[float] = None
    upload_reduction_pct: Optional[float] = None
    bidirectional_compression_ratio: Optional[float] = None
    bidirectional_reduction_pct: Optional[float] = None
    mae_improvement_per_mb_upload: Optional[float] = None
    rmse_improvement_per_mb_upload: Optional[float] = None
    mae_improvement_per_mb_total: Optional[float] = None
    rmse_improvement_per_mb_total: Optional[float] = None
    communication_summary: Optional[Dict[str, Any]] = None
    training_duration_ms: Optional[float] = None
    round_history: List[Dict[str, Any]] = Field(default_factory=list)
    distribution_heterogeneity_cv_pct: Optional[float] = None
    distribution_flow_mean_range: Optional[float] = None


class AggregatedRoundMetric(BaseModel):
    round: int
    completed_seeds_count: int
    compression_method: Optional[str] = None
    mean_mae: Optional[float] = None
    std_mae: Optional[float] = None
    min_mae: Optional[float] = None
    max_mae: Optional[float] = None
    mean_rmse: Optional[float] = None
    std_rmse: Optional[float] = None
    min_rmse: Optional[float] = None
    max_rmse: Optional[float] = None
    mean_upload_bytes: Optional[float] = None
    std_upload_bytes: Optional[float] = None
    mean_download_bytes_modeled: Optional[float] = None
    std_download_bytes_modeled: Optional[float] = None
    mean_total_round_bytes: Optional[float] = None
    std_total_round_bytes: Optional[float] = None
    mean_cumulative_upload_bytes: Optional[float] = None
    std_cumulative_upload_bytes: Optional[float] = None
    mean_cumulative_download_bytes_modeled: Optional[float] = None
    std_cumulative_download_bytes_modeled: Optional[float] = None
    mean_cumulative_total_bytes: Optional[float] = None
    std_cumulative_total_bytes: Optional[float] = None
    mean_cumulative_upload_mb: Optional[float] = None
    mean_cumulative_download_mb_modeled: Optional[float] = None
    mean_cumulative_total_mb: Optional[float] = None
    mean_upload_compression_ratio: Optional[float] = None
    mean_upload_reduction_pct: Optional[float] = None
    mean_bidirectional_compression_ratio: Optional[float] = None
    mean_bidirectional_reduction_pct: Optional[float] = None
    mean_mae_improvement_per_mb_upload: Optional[float] = None
    std_mae_improvement_per_mb_upload: Optional[float] = None
    mean_rmse_improvement_per_mb_upload: Optional[float] = None
    std_rmse_improvement_per_mb_upload: Optional[float] = None
    mean_mae_improvement_per_mb_total: Optional[float] = None
    mean_rmse_improvement_per_mb_total: Optional[float] = None


class MultiSeedGroupSummary(BaseModel):
    sample_count: int
    std_formula: str
    compression_method: Optional[str] = None
    mean_mae: Optional[float] = None
    std_mae: Optional[float] = None
    mean_rmse: Optional[float] = None
    std_rmse: Optional[float] = None
    mean_final_round_mae: Optional[float] = None
    std_final_round_mae: Optional[float] = None
    mean_final_round_rmse: Optional[float] = None
    std_final_round_rmse: Optional[float] = None
    mean_data_transmitted_bytes: Optional[float] = None
    std_data_transmitted_bytes: Optional[float] = None
    mean_upload_bytes: Optional[float] = None
    std_upload_bytes: Optional[float] = None
    mean_download_bytes_modeled: Optional[float] = None
    std_download_bytes_modeled: Optional[float] = None
    mean_upload_compression_ratio: Optional[float] = None
    mean_upload_reduction_pct: Optional[float] = None
    mean_bidirectional_compression_ratio: Optional[float] = None
    mean_bidirectional_reduction_pct: Optional[float] = None
    mean_mae_improvement_per_mb_upload: Optional[float] = None
    std_mae_improvement_per_mb_upload: Optional[float] = None
    mean_rmse_improvement_per_mb_upload: Optional[float] = None
    std_rmse_improvement_per_mb_upload: Optional[float] = None
    mean_mae_improvement_per_mb_total: Optional[float] = None
    mean_rmse_improvement_per_mb_total: Optional[float] = None
    mean_duration_ms: Optional[float] = None


class MultiSeedGroupResult(BaseModel):
    group_name: str
    partition_strategy: str
    aggregate_status: str
    is_complete: bool
    requested_runs_count: int
    successful_runs_count: int
    failed_runs_count: int
    successful_seeds: List[int]
    failed_seeds: List[SeedFailureDetail]
    status_note: str
    summary: MultiSeedGroupSummary
    per_seed_results: List[SeedIndividualResult]
    aggregated_convergence: List[AggregatedRoundMetric]


class MultiSeedBenchmarkResponse(BaseModel):
    experiment_id: str
    executed_at: str
    dataset_id: str
    dataset_name: str
    dataset_provenance: str
    is_simulated: bool = False
    is_genuine_public: bool = False
    data_type_label: str = "Public"
    dataset_license: Optional[str] = None
    source_url: Optional[str] = None
    documentation_url: Optional[str] = None
    sensors_count: Optional[int] = None
    sampling_interval: Optional[str] = None
    time_range: Optional[str] = None
    target_unit: str = "veh/5m"
    prediction_target: str
    target_horizon_minutes: int
    partition_strategy: str
    partition_strategies: List[str]
    seeds: List[int]
    experiment_status: str
    is_complete: bool
    successful_runs_count: int
    failed_runs_count: int
    total_group_runs_count: int
    successful_group_runs_count: int
    failed_group_runs_count: int
    failures: List[SeedFailureDetail]
    warning_message: Optional[str] = None
    experiment_config: Dict[str, Any]
    groups: Dict[str, MultiSeedGroupResult]
    comparison_summary: Dict[str, Any]


class CompressionComparisonRequest(BaseModel):
    dataset_type: str = Field(default="pems08_public", pattern="^(synthetic|pems08|pems08_public|live)$")
    partition_strategy: str = Field(default="non_iid")
    target_horizon_minutes: int = Field(default=15, ge=5, le=1440)
    federated_rounds: int = Field(default=5, ge=1, le=25)
    top_k_retention_pct: float = Field(default=50.0, gt=0.0, lt=100.0)
    random_seed: int = Field(default=42, ge=0, le=2_147_483_647)

    @field_validator("partition_strategy")
    @classmethod
    def check_partition_strategy(cls, value: str) -> str:
        if value not in ("iid", "non_iid"):
            raise ValueError(
                f"Unsupported partition_strategy '{value}'. Supported values are 'iid' or 'non_iid'."
            )
        return value


class CompressionStrategyResult(BaseModel):
    compression_method: str
    compression_description: str
    federated: BenchmarkApproachResult
    delta: BenchmarkDeltaComparison
    mae: float
    rmse: float
    mae_vs_full_precision: float
    rmse_vs_full_precision: float
    mae_vs_centralized: float
    rmse_vs_centralized: float
    upload_bytes: int
    download_bytes_modeled: int
    total_bytes: int
    upload_compression_ratio: Optional[float] = None
    upload_reduction_pct: Optional[float] = None
    bidirectional_compression_ratio: Optional[float] = None
    bidirectional_reduction_pct: Optional[float] = None
    mae_improvement_per_mb_upload: Optional[float] = None
    rmse_improvement_per_mb_upload: Optional[float] = None
    mae_improvement_per_mb_total: Optional[float] = None
    rmse_improvement_per_mb_total: Optional[float] = None
    payload_breakdown_per_client: Dict[str, int]
    round_history: List[Dict[str, Any]]
    communication_summary: Dict[str, Any]


class CompressionComparisonResponse(BaseModel):
    experiment_id: str
    executed_at: str
    dataset_id: str
    dataset_name: str
    dataset_provenance: str
    is_simulated: bool = False
    is_genuine_public: bool = False
    data_type_label: str = "Public"
    dataset_license: Optional[str] = None
    source_url: Optional[str] = None
    documentation_url: Optional[str] = None
    sensors_count: Optional[int] = None
    sampling_interval: Optional[str] = None
    time_range: Optional[str] = None
    target_unit: str = "veh/5m"
    prediction_target: str
    target_horizon_minutes: int
    partition_strategy: str
    random_seed: int
    shared_config: Dict[str, Any]
    centralized: BenchmarkApproachResult
    strategies: Dict[str, CompressionStrategyResult]
    best_accuracy_strategy: str
    lowest_upload_strategy: str
    overhead_limitations_note: str
    scientific_summary: str


class TrafficDatasetInfo(BaseModel):
    id: str
    name: str
    description: str
    provenance: str
    sample_frequency: str
    sampling_interval: Optional[str] = None
    nodes_count: int
    total_samples: int
    raw_records_total: Optional[int] = None
    excluded_dropout_records: Optional[int] = None
    is_active: bool
    is_simulated: bool = False
    is_genuine_public: bool = False
    ps003_eligible: bool = False
    licensing: str
    source_url: Optional[str] = None
    documentation_url: Optional[str] = None
    time_range: Optional[str] = None
    available_features: List[str] = Field(default_factory=list)
    prediction_target: Optional[str] = None
    target_unit: Optional[str] = None
    sensors_description: Optional[str] = None
    status_error: Optional[str] = None


class FederatedRoundStartRequest(BaseModel):
    client_ids: Optional[List[str]] = None
    aggregation_method: str = "FedAvg"
    apply_compression: bool = False
    top_k_retention_pct: float = Field(default=100.0, ge=10.0, le=100.0)
    int8_quantization: bool = False


class FederatedRoundResponse(BaseModel):
    round_number: int
    participating_clients: List[str]
    client_weights_sample_ratios: Dict[str, float]
    global_loss: float
    test_mae: float
    test_rmse: float
    total_payload_bytes: int
    raw_centralized_bytes: int
    reduction_vs_centralized_pct: float
    status: str = "success"


# --- Optimizer ---
class OptimizerExperimentRequest(BaseModel):
    name: Optional[str] = "Custom Experiment"
    top_k_retention_pct: float = Field(default=50.0, ge=10.0, le=100.0)
    int8_quantization: bool = True
    event_driven_threshold: float = Field(default=0.25, ge=0.05, le=1.0)
    rounds: int = Field(default=5, ge=1, le=20)


class OptimizerExperimentResult(BaseModel):
    id: int
    name: str
    top_k_retention_pct: float
    int8_quantization: bool
    event_driven_threshold: float
    baseline_bytes: int
    optimized_bytes: int
    savings_pct: float
    mae: float
    rmse: float
    reconstruction_mse: float
    updates_transmitted: int
    updates_skipped: int
    is_pareto_optimal: bool = False
    timestamp: str


class ParetoFrontierResponse(BaseModel):
    experiments: List[OptimizerExperimentResult]
    recommended_config: Optional[OptimizerExperimentResult] = None
    baseline_reference: Dict[str, Any]


# --- Incidents ---
class IncidentItem(BaseModel):
    id: str
    intersection_id: str
    intersection_name: str
    intersection_name_hi: str
    incident_type: str
    severity: str  # "critical", "warning", "info"
    description_en: str
    description_hi: str
    recommended_action_en: str
    recommended_action_hi: str
    status: str  # "open", "acknowledged", "resolved"
    created_at: str
    is_simulated: bool = False
    source: str = "live_provider"


class IncidentUpdateRequest(BaseModel):
    status: str = Field(pattern="^(open|acknowledged|resolved)$")


class IncidentCreateRequest(BaseModel):
    intersection_id: str
    incident_type: str = "authority_advisory"
    severity: str = "warning"
    description_en: str
    description_hi: Optional[str] = None
    recommended_action_en: str
    recommended_action_hi: Optional[str] = None
    source: Optional[str] = "authority_advisory"


# --- Routes ---
class RouteQuery(BaseModel):
    origin_id: str = ""
    destination_id: str = ""
    origin_text: Optional[str] = None
    destination_text: Optional[str] = None
    origin_lat: Optional[float] = None
    origin_lon: Optional[float] = None
    destination_lat: Optional[float] = None
    destination_lon: Optional[float] = None
    avoid_closed_roads: bool = True


class RouteOption(BaseModel):
    route_id: str
    name_en: str
    name_hi: str
    intersections_path: List[str]
    distance_km: float
    estimated_time_minutes: float
    congestion_exposure_pct: float
    is_recommended: bool
    recommendation_rationale: Optional[str] = None
    traffic_condition: str = "Smooth"
    traffic_heavy_roads: List[str] = []
    delay_minutes: float = 0.0
    data_source: str = "simulated_corridor_model"
    is_live_data: bool = False


class RouteResponse(BaseModel):
    origin: str
    destination: str
    routes: List[RouteOption]
    road_closure_active: bool
    affected_intersection: Optional[str] = None
    origin_label: Optional[str] = None
    destination_label: Optional[str] = None
    data_source: str = "simulated_corridor_model"
    is_live_data: bool = False
    unavailable_reason: Optional[str] = None
    advisory_notice: str = "Advisory demonstration routing. Modeled on simulated Delhi NCR corridors. Obey all municipal road signs and traffic authorities."


# --- Digital Twin ---
class DigitalTwinScenarioRequest(BaseModel):
    scenario: str = Field(
        ...,
        pattern="^(normal|morning_rush|evening_rush|sudden_surge|road_closure|edge_node_failure|network_delay|increased_volume|heavy_rainfall|major_event)$",
    )
    volume_multiplier: Optional[float] = Field(default=1.3, ge=1.0, le=2.5)
    target_intersection_id: Optional[str] = "INT-04"
    rainfall_intensity_mm: Optional[float] = Field(default=45.0, ge=0.0, le=150.0)
    event_crowd_size: Optional[int] = Field(default=30000, ge=1000, le=100000)


class DigitalTwinScenarioResponse(BaseModel):
    scenario: str
    status: str
    message_en: str
    message_hi: str
    affected_nodes: List[str]
    baseline_metrics: Optional[Dict[str, Any]] = None
    simulated_metrics: Optional[Dict[str, Any]] = None
    node_comparisons: Optional[List[Dict[str, Any]]] = None
    network_summary: Dict[str, Any]
    is_simulation: bool = True


# --- Incident Threshold Evaluation ---
class IncidentEvaluationRequest(BaseModel):
    volume_capacity_threshold: float = Field(default=0.75, ge=0.5, le=1.0)
    speed_threshold_kmh: float = Field(default=20.0, ge=5.0, le=50.0)
    horizon_minutes: int = Field(default=30)


class SpilloverRiskNode(BaseModel):
    intersection_id: str
    intersection_name: str
    adjacent_to: str
    risk_level: str
    recommended_action: str


class IncidentEvaluationResponse(BaseModel):
    evaluated_at: str
    active_incidents_count: int
    predicted_congestion_count: int
    thresholds_applied: Dict[str, float]
    early_warnings: List[Dict[str, Any]]
    spillover_risks: List[SpilloverRiskNode]
    advisory_notice: str = "Demonstration incident evaluation based on configurable sensor thresholds."


# --- Chat ---
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default_session"
    language: Optional[str] = "en"
    selected_intersection_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    language: str
    data_citations: List[str]
    observed_facts: List[str]
    model_predictions: List[str]
    recommendations: List[str]
    suggested_followups: List[str]


# --- Authentication ---
class UserRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=150)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: Optional[str] = None


class UserLoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=150)
    password: str = Field(..., min_length=1)
    remember_me: bool = False


class UserResponse(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    is_active: bool
    is_demo: bool
    created_at: str


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=150)


class ForgotPasswordResponse(BaseModel):
    message: str
    reset_token: Optional[str] = None  # Returned for local development ease


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10)
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: Optional[str] = None



class SavedRouteDTO(BaseModel):
    id: str
    user_id: Optional[str] = None
    name: str
    origin_id: str
    destination_id: str
    origin_name: str
    destination_name: str
    notes: Optional[str] = None
    created_at: str


class SavedRouteCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    origin_id: str = Field(..., min_length=1, max_length=50)
    destination_id: str = Field(..., min_length=1, max_length=50)
    origin_name: str = Field(..., min_length=1, max_length=100)
    destination_name: str = Field(..., min_length=1, max_length=100)
    notes: Optional[str] = None


class CitizenReportTimelineDTO(BaseModel):
    id: str
    report_id: str
    from_status: str
    to_status: str
    resolution_note: Optional[str] = None
    actor_id: Optional[str] = None
    actor_role: str = "authority"
    created_at: str


class CitizenNotificationDTO(BaseModel):
    id: str
    user_id: str
    report_id: str
    title: str
    message: str
    status: str
    resolution_note: Optional[str] = None
    location_name: Optional[str] = None
    is_read: bool = False
    created_at: str


class CitizenReportStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(verified|in_progress|resolved|dismissed|unverified)$")
    resolution_note: Optional[str] = Field(None, max_length=1000)

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v: Any) -> Any:
        return v.strip().lower() if isinstance(v, str) else v


class CitizenReportDTO(BaseModel):
    id: str
    user_id: Optional[str] = None
    category: str
    location_name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: str
    photo_url: Optional[str] = None
    status: str = "unverified"
    resolution_note: Optional[str] = None
    priority: Optional[str] = "medium"
    updated_at: Optional[str] = None
    created_at: str
    timeline: List[CitizenReportTimelineDTO] = []


class CitizenReportCreateRequest(BaseModel):
    category: str = Field(..., min_length=2, max_length=50)
    location_name: str = Field(..., min_length=2, max_length=150)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: str = Field(..., min_length=3, max_length=1000)
    photo_url: Optional[str] = None
    user_id: Optional[str] = None


class CitizenReportStatsDTO(BaseModel):
    total_reports: int
    pending_verification: int
    verified_reports: int
    issues_in_progress: int
    resolved_issues: int
    dismissed_reports: int
    resolution_rate_pct: float
    by_status: List[Dict[str, Any]]
    daily_submissions: List[Dict[str, Any]]
    area_breakdown: List[Dict[str, Any]]
    priority_breakdown: Dict[str, int]


# --- Emergency Vehicle Green Corridor Schemas ---

class EmergencyCorridorCreateRequest(BaseModel):
    vehicle_type: str = Field(
        ...,
        pattern="^(ambulance|fire_brigade|fire_truck|police|police_escort|medical_emergency|sos)$",
    )
    origin_id: str = Field(..., min_length=2, max_length=50)
    origin_name: str = Field(..., min_length=2, max_length=150)
    origin_lat: Optional[float] = None
    origin_lon: Optional[float] = None
    destination_id: str = Field(..., min_length=2, max_length=50)
    destination_name: str = Field(..., min_length=2, max_length=150)
    destination_lat: Optional[float] = None
    destination_lon: Optional[float] = None
    priority: str = Field(default="critical", pattern="^(critical|high|medium)$")
    description: Optional[str] = Field(None, max_length=1000)
    user_id: Optional[str] = None


class EmergencyCorridorStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(REQUESTED|APPROVED|REJECTED|ACTIVE|COMPLETED|CANCELLED)$")
    authority_notes: Optional[str] = Field(None, max_length=1000)


class EmergencyCorridorTimelineDTO(BaseModel):
    id: str
    request_id: str
    from_status: str
    to_status: str
    notes: Optional[str] = None
    actor_id: Optional[str] = None
    actor_role: str = "authority"
    created_at: str


class EmergencyIntersectionDetailDTO(BaseModel):
    intersection_id: str
    name: str
    latitude: float
    longitude: float
    current_speed: float
    congestion_level: str
    simulated_signal_status: str
    recommended_action: str


class EmergencyRouteDetailDTO(BaseModel):
    route_id: str
    name: str
    intersections_path: List[str]
    distance_km: float
    normal_travel_time_min: float
    corridor_travel_time_min: float
    time_saved_minutes: float
    congestion_exposure_pct: float
    is_recommended: bool
    intersections: List[EmergencyIntersectionDetailDTO] = []


class EmergencyCorridorDTO(BaseModel):
    id: str
    user_id: Optional[str] = None
    vehicle_type: str
    origin_id: str
    origin_name: str
    origin_lat: Optional[float] = None
    origin_lon: Optional[float] = None
    destination_id: str
    destination_name: str
    destination_lat: Optional[float] = None
    destination_lon: Optional[float] = None
    priority: str = "critical"
    description: Optional[str] = None
    status: str = "REQUESTED"
    recommended_route_id: Optional[str] = None
    route_path: List[str] = []
    distance_km: float = 0.0
    estimated_time_minutes: float = 0.0
    priority_intersections_count: int = 0
    authority_notes: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    timeline: List[EmergencyCorridorTimelineDTO] = []
    route_details: Optional[EmergencyRouteDetailDTO] = None


class EmergencyCorridorStatsDTO(BaseModel):
    total_requests: int
    active_requests: int
    approved_requests: int
    completed_requests: int
    cancelled_requests: int
    rejected_requests: int
    by_vehicle_type: Dict[str, int]
    by_priority: Dict[str, int]

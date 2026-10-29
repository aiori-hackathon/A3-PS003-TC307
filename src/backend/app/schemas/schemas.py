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


class BenchmarkCompareRequest(BaseModel):
    dataset_type: str = Field(default="synthetic", pattern="^(synthetic|pems08|live)$")
    target_horizon_minutes: int = Field(default=30, ge=15, le=1440)
    federated_rounds: int = Field(default=3, ge=1, le=10)
    apply_compression: bool = False
    top_k_retention_pct: float = Field(default=100.0, ge=10.0, le=100.0)
    int8_quantization: bool = False


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
    participating_clients: int
    training_duration_ms: float
    round_history: Optional[List[Dict[str, Any]]] = None


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
    dataset_name: str
    dataset_provenance: str
    prediction_target: str
    target_horizon_minutes: int
    accounting_type: Optional[str] = None
    centralized: BenchmarkApproachResult
    federated: BenchmarkApproachResult
    delta: BenchmarkDeltaComparison
    assumptions: List[str]
    methodology: str


class TrafficDatasetInfo(BaseModel):
    id: str
    name: str
    description: str
    provenance: str
    sample_frequency: str
    nodes_count: int
    total_samples: int
    is_active: bool
    is_simulated: bool = False
    licensing: str


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


# --- Routes ---
class RouteQuery(BaseModel):
    origin_id: str
    destination_id: str
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


class RouteResponse(BaseModel):
    origin: str
    destination: str
    routes: List[RouteOption]
    road_closure_active: bool
    affected_intersection: Optional[str] = None
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


export interface ProviderStatusDTO {
  provider_name: string;
  mode: "live" | "simulated";
  is_online: boolean;
  last_sync_time?: string | null;
  last_incident_sync_time?: string | null;
  cached_records_count: number;
  live_incidents_count?: number;
  quota_remaining?: number | null;
  error_fallback_active: boolean;
  background_polling_active?: boolean;
  refresh_interval_seconds?: number;
  message: string;
}

export interface TrafficObservationItem {
  id?: number;
  intersection_id?: string;
  timestamp: string;
  time_label?: string;
  vehicle_volume: number;
  average_speed: number;
  congestion_level: "low" | "moderate" | "severe";
  source?: string;
  is_simulated?: boolean;
  provider_name?: string;
  confidence_score?: number;
}

export interface IntersectionDetail {
  id: string;
  name: string;
  name_hi: string;
  zone: string;
  latitude: number;
  longitude: number;
  baseline_speed: number;
  capacity: number;
  edge_client_id: string;
  current_volume: number;
  current_speed: number;
  congestion_level: "low" | "moderate" | "severe";
  risk_score: number;
  edge_status: "active" | "training" | "idle" | "disconnected";
  source?: string;
  is_simulated?: boolean;
  data_freshness?: string;
  last_updated?: string | null;
}

export interface DashboardSummary {
  total_intersections: number;
  average_speed: number;
  congested_roads_count: number;
  predicted_congestion_events: number;
  active_edge_nodes: number;
  federated_round: number;
  communication_savings_pct: number;
  recent_volume_trend: Array<{ time: string; volume: number; predicted: number }>;
  speed_trend: Array<{ time: string; speed: number }>;
  congestion_distribution: { low: number; moderate: number; severe: number };
  communication_savings_trend: Array<{ round: string; baseline_kb: number; optimized_kb: number; savings_pct: number }>;
  is_simulated: boolean;
  data_source?: string;
  data_freshness?: string;
  provider_status?: ProviderStatusDTO;
}

export interface FeatureAttribution {
  feature: string;
  feature_hi: string;
  weight: number;
  impact: "increases_traffic" | "decreases_traffic";
}

export interface PredictionResponse {
  intersection_id: string;
  intersection_name: string;
  intersection_name_hi: string;
  horizon_minutes: number;
  predicted_volume: number;
  predicted_speed: number;
  predicted_congestion_level: "low" | "moderate" | "severe";
  estimated_travel_time_min?: number;
  expected_congestion_onset?: string | null;
  uncertainty_lower_volume?: number | null;
  uncertainty_upper_volume?: number | null;
  uncertainty_method?: string | null;
  inference_latency_ms: number;
  model_type: string;
  model_version?: string;
  test_mae: number;
  test_rmse: number;
  feature_explanations: FeatureAttribution[];
  forecast_timeline: Array<{ time: string; actual?: number | null; predicted?: number | null; type: string }>;
  forecast_generated_at?: string;
  data_source?: string;
  data_freshness?: string;
  is_simulated: boolean;
  observation_timestamp?: string | null;
  observation_age_minutes?: number | null;
  is_stale?: boolean;
  freshness_warning?: string | null;
  model_readiness?: string;
  baseline_mae?: number | null;
  baseline_rmse?: number | null;
  model_improvement_pct?: number | null;
  is_forecast?: boolean;
}

export interface ClientStatus {
  id: string;
  name: string;
  name_hi: string;
  zone: string;
  status: string;
  local_samples: number;
  battery_health: number;
  network_latency: number;
  last_loss?: number | null;
  model_update_bytes?: number | null;
  upload_bytes?: number | null;
  download_bytes?: number | null;
  cumulative_bytes?: number | null;
}

export interface BenchmarkApproachResult {
  model_name: string;
  parameter_count?: number;
  training_paradigm: string;
  privacy_guarantee: string;
  train_samples_count: number;
  test_samples_count: number;
  mae: number;
  rmse: number;
  data_transmitted_bytes: number;
  data_transmitted_formatted: string;
  upload_bytes: number;
  download_bytes: number;
  participating_clients: number;
  training_duration_ms: number;
  round_history?: Array<{
    round: number;
    test_mae: number;
    test_rmse: number;
    weights_norm: number;
  }>;
}

export interface BenchmarkDeltaComparison {
  mae_delta: number;
  mae_delta_pct: number;
  rmse_delta: number;
  rmse_delta_pct: number;
  bandwidth_savings_bytes: number;
  bandwidth_savings_pct: number;
  communication_reduction_factor: number;
  accuracy_tradeoff_summary: string;
}

export interface BenchmarkCompareResponse {
  benchmark_id: string;
  executed_at: string;
  dataset_name: string;
  dataset_provenance: string;
  prediction_target: string;
  target_horizon_minutes: number;
  accounting_type?: string;
  centralized: BenchmarkApproachResult;
  federated: BenchmarkApproachResult;
  delta: BenchmarkDeltaComparison;
  assumptions: string[];
  methodology: string;
}

export interface BenchmarkCompareRequest {
  dataset_type?: "synthetic" | "pems08" | "live";
  target_horizon_minutes?: number;
  federated_rounds?: number;
  apply_compression?: boolean;
  top_k_retention_pct?: number;
  int8_quantization?: boolean;
}

export interface TrafficDatasetInfo {
  id: string;
  name: string;
  description: string;
  provenance: string;
  sample_frequency: string;
  nodes_count: number;
  total_samples: number;
  is_active: boolean;
  is_simulated?: boolean;
  licensing: string;
}

export interface FederatedRoundResponse {
  round_number: number;
  participating_clients: string[];
  client_weights_sample_ratios: Record<string, number>;
  global_loss: number;
  test_mae: number;
  test_rmse: number;
  total_payload_bytes: number;
  raw_centralized_bytes: number;
  reduction_vs_centralized_pct: number;
  status: string;
}

export interface OptimizerExperimentResult {
  id: number;
  name: string;
  top_k_retention_pct: number;
  int8_quantization: boolean;
  event_driven_threshold: number;
  baseline_bytes: number;
  optimized_bytes: number;
  savings_pct: number;
  mae: number;
  rmse: number;
  reconstruction_mse: number;
  updates_transmitted: number;
  updates_skipped: number;
  is_pareto_optimal?: boolean;
  timestamp: string;
  event_logs?: Array<{ round: number; change_score: number; synchronized: boolean; reason: string }>;
}

export interface ParetoFrontierResponse {
  experiments: OptimizerExperimentResult[];
  recommended_config?: OptimizerExperimentResult | null;
  baseline_reference: { bytes: number; mae: number; rmse: number };
}

export interface IncidentItem {
  id: string;
  intersection_id: string;
  intersection_name: string;
  intersection_name_hi: string;
  incident_type: string;
  severity: "critical" | "warning" | "info";
  description_en: string;
  description_hi: string;
  recommended_action_en: string;
  recommended_action_hi: string;
  status: "open" | "acknowledged" | "resolved";
  created_at: string;
  is_simulated?: boolean;
  source?: string;
}

export interface CorridorDetail {
  id: string;
  name: string;
  name_hi: string;
  description: string;
  description_hi?: string;
  distance_km: number;
  origin_id: string;
  origin_name: string;
  destination_id: string;
  destination_name: string;
  average_speed: number;
  travel_time_minutes: number;
  free_flow_time_minutes: number;
  delay_minutes: number;
  congestion_level: "free" | "moderate" | "heavy";
  condition_label: string;
  condition_label_hi: string;
  source: string;
  is_simulated: boolean;
  data_freshness: string;
  last_updated?: string | null;
}

export interface RouteOption {
  route_id: string;
  name_en: string;
  name_hi: string;
  intersections_path: string[];
  distance_km: number;
  estimated_time_minutes: number;
  congestion_exposure_pct: number;
  is_recommended: boolean;
  recommendation_rationale?: string;
}

export interface RouteResponse {
  origin: string;
  destination: string;
  routes: RouteOption[];
  road_closure_active: boolean;
  affected_intersection?: string | null;
  advisory_notice?: string;
}

export interface ChatResponse {
  response: string;
  language: string;
  data_citations: string[];
  observed_facts: string[];
  model_predictions: string[];
  recommendations: string[];
  suggested_followups: string[];
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  municipality?: string;
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ForgotPasswordResponse {
  message: string;
  reset_token?: string | null;
}

export interface DigitalTwinNodeComparison {
  id: string;
  name: string;
  baseline_volume: number;
  simulated_volume: number;
  baseline_speed: number;
  simulated_speed: number;
  congestion_level: string;
}

export interface DigitalTwinResponse {
  scenario: string;
  status: string;
  message_en: string;
  message_hi: string;
  affected_nodes: string[];
  baseline_metrics?: {
    average_network_speed: number;
    total_network_volume: number;
    congested_intersections: number;
  };
  simulated_metrics?: {
    average_network_speed: number;
    total_network_volume: number;
    congested_intersections: number;
  };
  node_comparisons?: DigitalTwinNodeComparison[];
  network_summary: any;
  is_simulation?: boolean;
}

export interface SpilloverRiskNode {
  intersection_id: string;
  intersection_name: string;
  adjacent_to: string;
  risk_level: string;
  recommended_action: string;
}

export interface IncidentEvaluationResponse {
  evaluated_at: string;
  active_incidents_count: number;
  predicted_congestion_count: number;
  thresholds_applied: {
    volume_capacity_threshold: number;
    speed_threshold_kmh: number;
    horizon_minutes: number;
  };
  early_warnings: Array<{
    intersection_id: string;
    intersection_name: string;
    zone: string;
    volume_ratio: number;
    speed_kmh: number;
    threshold_exceeded: string;
    expected_onset: string;
    status: string;
  }>;
  spillover_risks: SpilloverRiskNode[];
  advisory_notice: string;
}



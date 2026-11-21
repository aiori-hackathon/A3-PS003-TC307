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
  free_flow_speed?: number;
  delay_seconds?: number;
  queue_length?: number;
  confidence_score?: number;
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
  congestion_trend?: "increasing" | "decreasing" | "stable";
  recommended_departure_time?: string;
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

export type CompressionMethod = "full_precision" | "top_k" | "int8" | "top_k_int8";

export interface RoundCommunicationRecord {
  round: number;
  test_mae: number;
  test_rmse: number;
  test_mae_exact?: number;
  test_rmse_exact?: number;
  weights_norm: number;
  participating_clients?: number;
  model_parameter_count?: number;
  retained_weights_count?: number;
  compression_method?: CompressionMethod | string | null;
  uncompressed_update_bytes_per_client?: number;
  actual_upload_bytes_per_client?: number;
  upload_header_bytes_per_client?: number;
  upload_bias_bytes_per_client?: number;
  upload_values_bytes_per_client?: number;
  upload_index_bytes_per_client?: number;
  upload_quant_metadata_bytes_per_client?: number;
  uncompressed_round_upload_bytes?: number;
  upload_bytes?: number;
  download_bytes_modeled?: number;
  total_round_bytes?: number;
  cumulative_upload_bytes?: number;
  cumulative_download_bytes_modeled?: number;
  cumulative_total_bytes?: number;
  cumulative_upload_mb?: number;
  cumulative_download_mb_modeled?: number;
  cumulative_total_mb?: number;
  upload_compression_ratio?: number | null;
  upload_reduction_pct?: number | null;
  bidirectional_compression_ratio?: number | null;
  bidirectional_reduction_pct?: number | null;
  mae_improvement_vs_initial?: number | null;
  rmse_improvement_vs_initial?: number | null;
  mae_improvement_per_mb_upload?: number | null;
  rmse_improvement_per_mb_upload?: number | null;
  mae_improvement_per_mb_total?: number | null;
  rmse_improvement_per_mb_total?: number | null;
  mae_efficiency_status?: string | null;
  rmse_efficiency_status?: string | null;
}

export interface CommunicationSummary {
  accounting_convention: string;
  compression_method: CompressionMethod | string;
  compression_description: string;
  top_k_retention_pct: number;
  int8_quantization: boolean;
  rounds_executed: number;
  participating_clients: number;
  model_parameter_count: number;
  retained_weights_per_client: number;
  uncompressed_update_bytes_per_client: number;
  actual_upload_bytes_per_client: number;
  payload_breakdown_per_client: {
    header_bytes: number;
    bias_bytes: number;
    values_bytes: number;
    index_bytes: number;
    quant_metadata_bytes: number;
    total_bytes: number;
  };
  total_upload_bytes: number;
  total_download_bytes_modeled: number;
  total_bidirectional_bytes: number;
  uncompressed_upload_bytes_baseline: number;
  uncompressed_bidirectional_bytes_baseline: number;
  upload_compression_ratio?: number | null;
  upload_reduction_pct?: number | null;
  bidirectional_compression_ratio?: number | null;
  bidirectional_reduction_pct?: number | null;
  vs_centralized_raw_upload_bytes: number;
  vs_centralized_upload_only_reduction_factor?: number | null;
  vs_centralized_bidirectional_reduction_factor?: number | null;
  initial_model_mae: number;
  initial_model_rmse: number;
  final_model_mae: number;
  final_model_rmse: number;
  mae_improvement_vs_initial: number;
  rmse_improvement_vs_initial: number;
  mae_improvement_per_mb_upload?: number | null;
  rmse_improvement_per_mb_upload?: number | null;
  mae_improvement_per_mb_total?: number | null;
  rmse_improvement_per_mb_total?: number | null;
  mae_efficiency_status: string;
  rmse_efficiency_status: string;
  efficiency_baseline_note: string;
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
  download_bytes_modeled?: number | null;
  participating_clients: number;
  training_duration_ms: number;
  round_history?: RoundCommunicationRecord[];
  communication_summary?: CommunicationSummary | null;
  centralized_accounting?: Record<string, any> | null;
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

export type PartitionStrategy = "iid" | "non_iid";

export interface ClientDistributionStat {
  client_id: string;
  label: string;
  partition_strategy: string;
  sensors_count: number;
  train_samples: number;
  sample_share_pct: number;
  flow_mean: number;
  flow_std: number;
  flow_unit: string;
  occupancy_mean?: number | null;
  speed_mean?: number | null;
  speed_unit?: string | null;
}

export interface DistributionSummaryBlock {
  total_samples: number;
  flow_mean: number;
  flow_std: number;
  flow_unit: string;
  occupancy_mean?: number | null;
  speed_mean?: number | null;
  speed_unit?: string | null;
}

export interface DistributionAnalysis {
  partition_strategy: string;
  split_scope_note: string;
  train_summary: DistributionSummaryBlock;
  test_summary: DistributionSummaryBlock;
  inter_client_differences: {
    sample_count_min: number;
    sample_count_max: number;
    flow_mean_min: number;
    flow_mean_max: number;
    flow_mean_range: number;
    flow_mean_std_across_clients: number;
    flow_heterogeneity_cv_pct: number;
    occupancy_mean_range?: number | null;
    speed_mean_range?: number | null;
  };
}

export interface BenchmarkCompareResponse {
  benchmark_id: string;
  executed_at: string;
  dataset_id?: string;
  dataset_name: string;
  dataset_provenance: string;
  is_simulated?: boolean;
  is_genuine_public?: boolean;
  data_type_label?: string;
  dataset_license?: string | null;
  source_url?: string | null;
  documentation_url?: string | null;
  sensors_count?: number;
  sampling_interval?: string;
  time_range?: string | null;
  target_unit?: string;
  prediction_target: string;
  target_horizon_minutes: number;
  partition_strategy?: PartitionStrategy | string;
  random_seed?: number;
  training_config?: Record<string, any> | null;
  accounting_type?: string;
  client_summary?: Array<{
    client_id: string;
    label: string;
    sensors_count: number;
    sensor_sample: Array<string | number>;
    train_samples: number;
    sample_share_pct?: number | null;
    flow_mean?: number | null;
    flow_std?: number | null;
    occupancy_mean?: number | null;
    speed_mean?: number | null;
  }> | null;
  client_statistics?: ClientDistributionStat[] | null;
  distribution_analysis?: DistributionAnalysis | null;
  centralized: BenchmarkApproachResult;
  federated: BenchmarkApproachResult;
  delta: BenchmarkDeltaComparison;
  assumptions: string[];
  methodology: string;
}

export interface BenchmarkCompareRequest {
  dataset_type?: "pems08_public" | "synthetic" | "pems08" | "live";
  target_horizon_minutes?: number;
  federated_rounds?: number;
  apply_compression?: boolean;
  top_k_retention_pct?: number;
  int8_quantization?: boolean;
  compression_method?: CompressionMethod;
  partition_strategy?: PartitionStrategy;
  random_seed?: number;
}

export interface PartitionComparisonRequest {
  dataset_type?: "pems08_public" | "synthetic" | "pems08" | "live";
  target_horizon_minutes?: number;
  federated_rounds?: number;
  apply_compression?: boolean;
  top_k_retention_pct?: number;
  int8_quantization?: boolean;
  compression_method?: CompressionMethod;
  random_seed?: number;
}

export interface PartitionStrategyResult {
  partition_strategy: PartitionStrategy | string;
  federated: BenchmarkApproachResult;
  delta: BenchmarkDeltaComparison;
  client_statistics: ClientDistributionStat[];
  distribution_analysis: DistributionAnalysis;
  client_summary: Array<Record<string, any>>;
}

export interface PartitionComparisonResponse {
  experiment_id: string;
  executed_at: string;
  dataset_id: string;
  dataset_name: string;
  dataset_provenance: string;
  is_simulated?: boolean;
  is_genuine_public?: boolean;
  data_type_label?: string;
  dataset_license?: string | null;
  source_url?: string | null;
  documentation_url?: string | null;
  sensors_count?: number;
  sampling_interval?: string;
  time_range?: string | null;
  target_unit?: string;
  prediction_target: string;
  target_horizon_minutes: number;
  random_seed: number;
  shared_config: Record<string, any>;
  centralized: BenchmarkApproachResult;
  iid: PartitionStrategyResult;
  non_iid: PartitionStrategyResult;
  comparison_summary: {
    iid_mae: number;
    non_iid_mae: number;
    non_iid_minus_iid_mae: number;
    iid_rmse: number;
    non_iid_rmse: number;
    non_iid_minus_iid_rmse: number;
    iid_flow_mean_range: number;
    non_iid_flow_mean_range: number;
    iid_flow_heterogeneity_cv_pct: number;
    non_iid_flow_heterogeneity_cv_pct: number;
    scientific_summary: string;
  };
}

export interface MultiSeedBenchmarkRequest {
  dataset_type?: "pems08_public" | "synthetic" | "pems08" | "live";
  target_horizon_minutes?: number;
  federated_rounds?: number;
  apply_compression?: boolean;
  top_k_retention_pct?: number;
  int8_quantization?: boolean;
  compression_method?: CompressionMethod;
  seeds?: number[];
  partition_strategies?: PartitionStrategy[];
}

export interface SeedFailureDetail {
  seed: number;
  group: string;
  error: string;
}

export interface SeedIndividualResult {
  seed: number;
  status: string;
  error?: string | null;
  train_samples_count?: number | null;
  test_samples_count?: number | null;
  mae?: number | null;
  rmse?: number | null;
  final_round_mae?: number | null;
  final_round_rmse?: number | null;
  data_transmitted_bytes?: number | null;
  data_transmitted_formatted?: string | null;
  upload_bytes?: number | null;
  download_bytes_modeled?: number | null;
  compression_method?: string | null;
  upload_compression_ratio?: number | null;
  upload_reduction_pct?: number | null;
  bidirectional_compression_ratio?: number | null;
  bidirectional_reduction_pct?: number | null;
  mae_improvement_per_mb_upload?: number | null;
  rmse_improvement_per_mb_upload?: number | null;
  mae_improvement_per_mb_total?: number | null;
  rmse_improvement_per_mb_total?: number | null;
  communication_summary?: CommunicationSummary | null;
  training_duration_ms?: number | null;
  round_history: RoundCommunicationRecord[];
  distribution_heterogeneity_cv_pct?: number | null;
  distribution_flow_mean_range?: number | null;
}

export interface AggregatedRoundMetric {
  round: number;
  completed_seeds_count: number;
  compression_method?: string | null;
  mean_mae?: number | null;
  std_mae?: number | null;
  min_mae?: number | null;
  max_mae?: number | null;
  mean_rmse?: number | null;
  std_rmse?: number | null;
  min_rmse?: number | null;
  max_rmse?: number | null;
  mean_upload_bytes?: number | null;
  std_upload_bytes?: number | null;
  mean_download_bytes_modeled?: number | null;
  std_download_bytes_modeled?: number | null;
  mean_total_round_bytes?: number | null;
  std_total_round_bytes?: number | null;
  mean_cumulative_upload_bytes?: number | null;
  std_cumulative_upload_bytes?: number | null;
  mean_cumulative_download_bytes_modeled?: number | null;
  std_cumulative_download_bytes_modeled?: number | null;
  mean_cumulative_total_bytes?: number | null;
  std_cumulative_total_bytes?: number | null;
  mean_cumulative_upload_mb?: number | null;
  mean_cumulative_download_mb_modeled?: number | null;
  mean_cumulative_total_mb?: number | null;
  mean_upload_compression_ratio?: number | null;
  mean_upload_reduction_pct?: number | null;
  mean_bidirectional_compression_ratio?: number | null;
  mean_bidirectional_reduction_pct?: number | null;
  mean_mae_improvement_per_mb_upload?: number | null;
  std_mae_improvement_per_mb_upload?: number | null;
  mean_rmse_improvement_per_mb_upload?: number | null;
  std_rmse_improvement_per_mb_upload?: number | null;
  mean_mae_improvement_per_mb_total?: number | null;
  mean_rmse_improvement_per_mb_total?: number | null;
}

export interface MultiSeedGroupSummary {
  sample_count: number;
  std_formula: string;
  compression_method?: string | null;
  mean_mae?: number | null;
  std_mae?: number | null;
  mean_rmse?: number | null;
  std_rmse?: number | null;
  mean_final_round_mae?: number | null;
  std_final_round_mae?: number | null;
  mean_final_round_rmse?: number | null;
  std_final_round_rmse?: number | null;
  mean_data_transmitted_bytes?: number | null;
  std_data_transmitted_bytes?: number | null;
  mean_upload_bytes?: number | null;
  std_upload_bytes?: number | null;
  mean_download_bytes_modeled?: number | null;
  std_download_bytes_modeled?: number | null;
  mean_upload_compression_ratio?: number | null;
  mean_upload_reduction_pct?: number | null;
  mean_bidirectional_compression_ratio?: number | null;
  mean_bidirectional_reduction_pct?: number | null;
  mean_mae_improvement_per_mb_upload?: number | null;
  std_mae_improvement_per_mb_upload?: number | null;
  mean_rmse_improvement_per_mb_upload?: number | null;
  std_rmse_improvement_per_mb_upload?: number | null;
  mean_mae_improvement_per_mb_total?: number | null;
  mean_rmse_improvement_per_mb_total?: number | null;
  mean_duration_ms?: number | null;
}

export interface MultiSeedGroupResult {
  group_name: string;
  partition_strategy: string;
  aggregate_status: string;
  is_complete: boolean;
  requested_runs_count: number;
  successful_runs_count: number;
  failed_runs_count: number;
  successful_seeds: number[];
  failed_seeds: SeedFailureDetail[];
  status_note: string;
  summary: MultiSeedGroupSummary;
  per_seed_results: SeedIndividualResult[];
  aggregated_convergence: AggregatedRoundMetric[];
}

export interface MultiSeedBenchmarkResponse {
  experiment_id: string;
  executed_at: string;
  dataset_id: string;
  dataset_name: string;
  dataset_provenance: string;
  is_simulated?: boolean;
  is_genuine_public?: boolean;
  data_type_label?: string;
  dataset_license?: string | null;
  source_url?: string | null;
  documentation_url?: string | null;
  sensors_count?: number;
  sampling_interval?: string;
  time_range?: string | null;
  target_unit?: string;
  prediction_target: string;
  target_horizon_minutes: number;
  partition_strategy: string;
  partition_strategies: PartitionStrategy[];
  seeds: number[];
  experiment_status: string;
  is_complete: boolean;
  successful_runs_count: number;
  failed_runs_count: number;
  total_group_runs_count: number;
  successful_group_runs_count: number;
  failed_group_runs_count: number;
  failures: SeedFailureDetail[];
  warning_message?: string | null;
  experiment_config: Record<string, any>;
  groups: Record<string, MultiSeedGroupResult>;
  comparison_summary: Record<string, any>;
}

export interface CompressionComparisonRequest {
  dataset_type?: "pems08_public" | "synthetic" | "pems08" | "live";
  partition_strategy?: PartitionStrategy;
  target_horizon_minutes?: number;
  federated_rounds?: number;
  top_k_retention_pct?: number;
  random_seed?: number;
}

export interface CompressionStrategyResult {
  compression_method: CompressionMethod | string;
  compression_description: string;
  federated: BenchmarkApproachResult;
  delta: BenchmarkDeltaComparison;
  mae: number;
  rmse: number;
  mae_vs_full_precision: number;
  rmse_vs_full_precision: number;
  mae_vs_centralized: number;
  rmse_vs_centralized: number;
  upload_bytes: number;
  download_bytes_modeled: number;
  total_bytes: number;
  upload_compression_ratio?: number | null;
  upload_reduction_pct?: number | null;
  bidirectional_compression_ratio?: number | null;
  bidirectional_reduction_pct?: number | null;
  mae_improvement_per_mb_upload?: number | null;
  rmse_improvement_per_mb_upload?: number | null;
  mae_improvement_per_mb_total?: number | null;
  rmse_improvement_per_mb_total?: number | null;
  payload_breakdown_per_client: {
    header_bytes: number;
    bias_bytes: number;
    values_bytes: number;
    index_bytes: number;
    quant_metadata_bytes: number;
    total_bytes: number;
  };
  round_history: RoundCommunicationRecord[];
  communication_summary: CommunicationSummary;
}

export interface CompressionComparisonResponse {
  experiment_id: string;
  executed_at: string;
  dataset_id: string;
  dataset_name: string;
  dataset_provenance: string;
  is_simulated?: boolean;
  is_genuine_public?: boolean;
  data_type_label?: string;
  dataset_license?: string | null;
  source_url?: string | null;
  documentation_url?: string | null;
  sensors_count?: number;
  sampling_interval?: string;
  time_range?: string | null;
  target_unit?: string;
  prediction_target: string;
  target_horizon_minutes: number;
  partition_strategy: string;
  random_seed: number;
  shared_config: Record<string, any>;
  centralized: BenchmarkApproachResult;
  strategies: Record<string, CompressionStrategyResult>;
  best_accuracy_strategy: string;
  lowest_upload_strategy: string;
  overhead_limitations_note: string;
  scientific_summary: string;
}

export interface TrafficDatasetInfo {
  id: string;
  name: string;
  description: string;
  provenance: string;
  sample_frequency: string;
  sampling_interval?: string;
  nodes_count: number;
  total_samples: number;
  raw_records_total?: number | null;
  excluded_dropout_records?: number | null;
  is_active: boolean;
  is_simulated?: boolean;
  is_genuine_public?: boolean;
  ps003_eligible?: boolean;
  licensing: string;
  source_url?: string | null;
  documentation_url?: string | null;
  time_range?: string | null;
  available_features?: string[];
  prediction_target?: string | null;
  target_unit?: string | null;
  sensors_description?: string | null;
  status_error?: string | null;
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
  traffic_condition?: "Smooth" | "Moderate" | "Heavy" | "Severe" | "Estimated" | string;
  traffic_heavy_roads?: string[];
  delay_minutes?: number;
  data_source?: string;
  is_live_data?: boolean;
}

export interface RouteResponse {
  origin: string;
  destination: string;
  routes: RouteOption[];
  road_closure_active: boolean;
  affected_intersection?: string | null;
  origin_label?: string | null;
  destination_label?: string | null;
  data_source?: string;
  is_live_data?: boolean;
  unavailable_reason?: string | null;
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




export interface SavedRoute {
  id: string;
  user_id?: string | null;
  name: string;
  origin_id: string;
  destination_id: string;
  origin_name: string;
  destination_name: string;
  notes?: string | null;
  created_at: string;
}

export interface CitizenReportTimeline {
  id: string;
  report_id: string;
  from_status: string;
  to_status: string;
  resolution_note?: string | null;
  actor_id?: string | null;
  actor_role: string;
  created_at: string;
}

export interface CitizenNotification {
  id: string;
  user_id: string;
  report_id: string;
  title: string;
  message: string;
  status: string;
  resolution_note?: string | null;
  location_name?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface CitizenReport {
  id: string;
  user_id?: string | null;
  category: "road_blockage" | "waterlogging" | "damaged_road" | "broken_signal" | "accident" | string;
  location_name: string;
  latitude?: number | null;
  longitude?: number | null;
  description: string;
  photo_url?: string | null;
  status: "unverified" | "verified" | "in_progress" | "resolved" | "dismissed" | string;
  resolution_note?: string | null;
  priority?: "critical" | "high" | "medium" | "low" | string;
  updated_at?: string | null;
  created_at: string;
  timeline?: CitizenReportTimeline[];
}

export interface CitizenReportStats {
  total_reports: number;
  pending_verification: number;
  verified_reports: number;
  issues_in_progress: number;
  resolved_issues: number;
  dismissed_reports: number;
  resolution_rate_pct: number;
  by_status: Array<{ status: string; label: string; count: number; color: string }>;
  daily_submissions: Array<{ date: string; count: number }>;
  area_breakdown: Array<{ area: string; count: number }>;
  priority_breakdown: Record<string, number>;
}

export interface VoiceAdvisoryState {
  isEnabled: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  isSupported: boolean;
  language: 'en' | 'hi';
  hasHindiVoice: boolean;
  lastAnnouncement: string | null;
  statusText: string;
}

export interface VoiceTrafficContext {
  roadName?: string;
  city?: string;
  currentSpeed?: number;
  freeFlowSpeed?: number;
  congestionLevel?: string;
  roadClosure?: boolean;
  trafficAvailable: boolean;
  isLoading?: boolean;
  reason?: string;
}



export interface EmergencyIntersectionDetail {
  intersection_id: string;
  name: string;
  latitude: number;
  longitude: number;
  current_speed: number;
  congestion_level: "low" | "moderate" | "severe" | string;
  simulated_signal_status: string;
  recommended_action: string;
}

export interface EmergencyRouteDetail {
  route_id: string;
  name: string;
  intersections_path: string[];
  distance_km: number;
  normal_travel_time_min: number;
  corridor_travel_time_min: number;
  time_saved_minutes: number;
  congestion_exposure_pct: number;
  is_recommended: boolean;
  intersections: EmergencyIntersectionDetail[];
}

export interface EmergencyCorridorTimeline {
  id: string;
  request_id: string;
  from_status: string;
  to_status: string;
  notes?: string | null;
  actor_id?: string | null;
  actor_role: string;
  created_at: string;
}

export interface EmergencyCorridorRequest {
  id: string;
  user_id?: string | null;
  vehicle_type: "ambulance" | "fire_brigade" | "police" | string;
  origin_id: string;
  origin_name: string;
  origin_lat?: number | null;
  origin_lon?: number | null;
  destination_id: string;
  destination_name: string;
  destination_lat?: number | null;
  destination_lon?: number | null;
  priority: "critical" | "high" | "medium" | string;
  description?: string | null;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | string;
  recommended_route_id?: string | null;
  route_path: string[];
  distance_km: number;
  estimated_time_minutes: number;
  priority_intersections_count: number;
  authority_notes?: string | null;
  created_at: string;
  updated_at?: string | null;
  timeline?: EmergencyCorridorTimeline[];
  route_details?: EmergencyRouteDetail | null;
}

export interface EmergencyCorridorStats {
  total_requests: number;
  active_requests: number;
  approved_requests: number;
  completed_requests: number;
  cancelled_requests: number;
  rejected_requests: number;
  by_vehicle_type: Record<string, number>;
  by_priority: Record<string, number>;
}

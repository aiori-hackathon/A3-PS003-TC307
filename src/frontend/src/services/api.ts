import {
  DashboardSummary,
  IntersectionDetail,
  CorridorDetail,
  PredictionResponse,
  ClientStatus,
  FederatedRoundResponse,
  OptimizerExperimentResult,
  ParetoFrontierResponse,
  IncidentItem,
  RouteResponse,
  ChatResponse,
  User,
  AuthTokenResponse,
  ForgotPasswordResponse,
  DigitalTwinResponse,
  IncidentEvaluationResponse,
  ProviderStatusDTO,
  BenchmarkCompareResponse,
  BenchmarkCompareRequest,
  TrafficDatasetInfo,
} from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("trafficfl_token");
  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let errorMessage = `API error ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson && errJson.detail) {
        errorMessage = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      const errorBody = await res.text().catch(() => "");
      if (errorBody) errorMessage = errorBody;
    }
    throw new Error(errorMessage);
  }

  return res.json();
}

export const api = {
  // Authentication
  login: (email: string, password: string, rememberMe = false) =>
    fetchJson<AuthTokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, remember_me: rememberMe }),
    }),

  register: (fullName: string, email: string, password: string, confirmPassword?: string) =>
    fetchJson<AuthTokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
        confirm_password: confirmPassword,
      }),
    }),

  demoLogin: (role: "authority" | "citizen" = "authority") =>
    fetchJson<AuthTokenResponse>(`/auth/demo-login?role=${role}`, {
      method: "POST",
    }),

  getMe: () => fetchJson<User>("/auth/me"),

  logout: () =>
    fetchJson<{ message: string }>("/auth/logout", {
      method: "POST",
    }),

  forgotPassword: (email: string) =>
    fetchJson<ForgotPasswordResponse>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string, confirmPassword?: string) =>
    fetchJson<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    }),

  // Dashboard
  getDashboardSummary: () => fetchJson<DashboardSummary>("/dashboard/summary"),
  triggerSurge: () =>
    fetchJson<{ message: string; affected_nodes: string[] }>("/dashboard/surge", {
      method: "POST",
    }),

  // Traffic & Intersections
  getProviderStatus: () => fetchJson<ProviderStatusDTO>("/traffic/provider-status"),
  getCorridors: () => fetchJson<CorridorDetail[]>("/traffic/corridors"),
  coordinateCollection: (force = false) =>
    fetchJson<{
      status: string;
      message: string;
      observations_ingested: number;
      corridors_processed: number;
      timestamp: string;
    }>(`/traffic/coordinate-collection?force=${force}`, {
      method: "POST",
    }),
  getIntersections: () => fetchJson<IntersectionDetail[]>("/traffic/intersections"),
  getIntersectionDetail: (id: string) =>
    fetchJson<IntersectionDetail>(`/traffic/intersections/${id}`),
  getTrafficHistory: (intersectionId?: string, limit = 48) => {
    const q = new URLSearchParams();
    if (intersectionId) q.append("intersection_id", intersectionId);
    q.append("limit", limit.toString());
    return fetchJson<Array<{
      id: number;
      intersection_id: string;
      timestamp: string;
      time_label: string;
      vehicle_volume: number;
      average_speed: number;
      congestion_level: string;
    }>>(`/traffic/history?${q.toString()}`);
  },

  // Predictions
  getForecast: (intersectionId: string, horizonMinutes = 30) =>
    fetchJson<PredictionResponse>(
      `/prediction/forecast?intersection_id=${encodeURIComponent(intersectionId)}&horizon_minutes=${horizonMinutes}`
    ),
  runPrediction: (intersectionId: string, horizonMinutes = 30) =>
    fetchJson<PredictionResponse>("/predictions/run", {
      method: "POST",
      body: JSON.stringify({
        intersection_id: intersectionId,
        horizon_minutes: horizonMinutes,
      }),
    }),

  // Federated Learning
  getFLClients: () => fetchJson<ClientStatus[]>("/federated/clients"),
  getFLStatus: () =>
    fetchJson<{
      current_round: number;
      global_loss: number;
      test_mae: number;
      test_rmse: number;
      rounds_history: Array<{ round: number; loss: number; mae: number; rmse: number; bytes: number }>;
    }>("/federated/status"),
  startFLRound: (params: {
    client_ids?: string[];
    aggregation_method?: string;
    apply_compression?: boolean;
    top_k_retention_pct?: number;
    int8_quantization?: boolean;
  }) =>
    fetchJson<FederatedRoundResponse>("/federated/rounds/start", {
      method: "POST",
      body: JSON.stringify(params),
    }),
  runBenchmarkCompare: (params?: BenchmarkCompareRequest) =>
    fetchJson<BenchmarkCompareResponse>("/federated/benchmark-compare", {
      method: "POST",
      body: JSON.stringify(params || {}),
    }),
  getTrafficDatasets: () => fetchJson<TrafficDatasetInfo[]>("/traffic/datasets"),
  seedPeMSDataset: () =>
    fetchJson<{ status: string; result: any }>("/traffic/datasets/seed-pems", {
      method: "POST",
    }),

  // Optimizer
  runExperiment: (params: {
    name?: string;
    top_k_retention_pct: number;
    int8_quantization: boolean;
    event_driven_threshold: number;
    rounds?: number;
  }) =>
    fetchJson<OptimizerExperimentResult>("/optimizer/experiments", {
      method: "POST",
      body: JSON.stringify(params),
    }),
  getParetoFrontier: () => fetchJson<ParetoFrontierResponse>("/optimizer/pareto"),

  // Digital Twin
  simulateScenario: (
    params:
      | string
      | {
          scenario: string;
          volume_multiplier?: number;
          target_intersection_id?: string;
          rainfall_intensity_mm?: number;
          event_crowd_size?: number;
        }
  ) => {
    const body = typeof params === "string" ? { scenario: params } : params;
    return fetchJson<DigitalTwinResponse>("/digital-twin/simulate", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // Incidents
  getIncidents: (severity?: string, status?: string, includeSimulated?: boolean) => {
    const q = new URLSearchParams();
    if (severity) q.append("severity", severity);
    if (status) q.append("status", status);
    if (includeSimulated !== undefined) q.append("include_simulated", includeSimulated.toString());
    const qs = q.toString();
    return fetchJson<IncidentItem[]>(`/incidents${qs ? `?${qs}` : ""}`);
  },
  updateIncidentStatus: (id: string, status: "open" | "acknowledged" | "resolved") =>
    fetchJson<IncidentItem>(`/incidents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  evaluateIncidents: (params?: {
    volume_capacity_threshold?: number;
    speed_threshold_kmh?: number;
    horizon_minutes?: number;
  }) =>
    fetchJson<IncidentEvaluationResponse>("/incidents/evaluate", {
      method: "POST",
      body: JSON.stringify(params || {}),
    }),

  // Route Intelligence
  compareRoutes: (originId: string, destinationId: string, avoidClosed = true) =>
    fetchJson<RouteResponse>("/routes/compare", {
      method: "POST",
      body: JSON.stringify({
        origin_id: originId,
        destination_id: destinationId,
        avoid_closed_roads: avoidClosed,
      }),
    }),

  // Analytics & CSV
  getAnalyticsExperiments: () =>
    fetchJson<OptimizerExperimentResult[]>("/analytics/experiments"),
  getExportCsvUrl: () => `${API_BASE}/analytics/export-csv`,

  // Chat
  sendChatMessage: (message: string, language = "en", intersectionId?: string) =>
    fetchJson<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        language,
        selected_intersection_id: intersectionId,
      }),
    }),
};

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
  PartitionComparisonRequest,
  PartitionComparisonResponse,
  MultiSeedBenchmarkRequest,
  MultiSeedBenchmarkResponse,
  CompressionComparisonRequest,
  CompressionComparisonResponse,
  TrafficDatasetInfo,
  SavedRoute,
  CitizenReport,
  CitizenReportTimeline,
  CitizenNotification,
  CitizenReportStats,
  EmergencyCorridorRequest,
  EmergencyCorridorStats,
  EmergencyRouteDetail,
} from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

/** Resolves backend-relative upload/media URLs (e.g. /api/uploads/evidence/...) reliably across dev & production ports. */
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  if (url.startsWith("/") && API_ORIGIN) {
    return `${API_ORIGIN}${url}`;
  }
  return url;
}

export const AUTH_TOKEN_KEY = "trafficfl_token";
export const AUTH_USER_KEY = "trafficfl_user";

/** Reads active bearer token from localStorage (remembered device) or sessionStorage (tab session). */
export function getStoredAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY);
}

/** Reads serialized non-sensitive user profile from persistent or session storage safely. */
export function getStoredAuthUser<T = User>(): T | null {
  const raw = localStorage.getItem(AUTH_USER_KEY) ?? sessionStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Persists JWT and user metadata to localStorage only when rememberDevice is enabled, else sessionStorage. */
export function persistAuthSession(token: string, user: User, rememberDevice: boolean): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
  const storage = rememberDevice ? localStorage : sessionStorage;
  storage.setItem(AUTH_TOKEN_KEY, token);
  storage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

/** Clears session artifacts from both persistent and ephemeral browser storage. */
export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getStoredAuthToken();
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
  getDashboardSummary: (signal?: AbortSignal) =>
    fetchJson<DashboardSummary>("/dashboard/summary", signal ? { signal } : undefined),
  triggerSurge: () =>
    fetchJson<{ message: string; affected_nodes: string[] }>("/dashboard/surge", {
      method: "POST",
    }),

  // Traffic & Intersections
  getProviderStatus: (signal?: AbortSignal) =>
    fetchJson<ProviderStatusDTO>("/traffic/provider-status", signal ? { signal } : undefined),
  getCorridors: (signal?: AbortSignal) =>
    fetchJson<CorridorDetail[]>("/traffic/corridors", signal ? { signal } : undefined),
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
  getIntersections: (signal?: AbortSignal) =>
    fetchJson<IntersectionDetail[]>("/traffic/intersections", signal ? { signal } : undefined),
  getIntersectionDetail: (id: string) =>
    fetchJson<IntersectionDetail>(`/traffic/intersections/${id}`),
  getLiveTrafficByCoordinates: (latitude: number, longitude: number) =>
    fetchJson<{
      traffic_available: boolean;
      current_speed?: number;
      free_flow_speed?: number;
      confidence?: number;
      road_closure?: boolean;
      congestion_level?: string;
      travel_time_seconds?: number;
      free_flow_travel_time_seconds?: number;
      provider_name?: string;
      reason?: string;
    }>(`/traffic/live-by-coordinates?latitude=${latitude}&longitude=${longitude}`),
  reverseGeocode: (latitude: number, longitude: number) =>
    fetchJson<{
      resolved: boolean;
      latitude: number;
      longitude: number;
      road: string;
      area: string;
      city: string;
      district: string;
      state: string;
      country: string;
      postcode: string;
      full_address: string;
      source: "tomtom_reverse_geocode" | "nominatim" | "coordinates_only";
      reason?: string;
    }>(`/traffic/reverse-geocode?latitude=${latitude}&longitude=${longitude}`),
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
  runPartitionCompare: (params?: PartitionComparisonRequest) =>
    fetchJson<PartitionComparisonResponse>("/federated/benchmark-partition-compare", {
      method: "POST",
      body: JSON.stringify(params || {}),
    }),
  runMultiSeedBenchmark: (params?: MultiSeedBenchmarkRequest) =>
    fetchJson<MultiSeedBenchmarkResponse>("/federated/benchmark-multi-seed", {
      method: "POST",
      body: JSON.stringify(params || {}),
    }),
  runCompressionCompare: (params?: CompressionComparisonRequest) =>
    fetchJson<CompressionComparisonResponse>("/federated/benchmark-compression-compare", {
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
  getIncidents: (severity?: string, status?: string, includeSimulated?: boolean, signal?: AbortSignal) => {
    const q = new URLSearchParams();
    if (severity) q.append("severity", severity);
    if (status) q.append("status", status);
    if (includeSimulated !== undefined) q.append("include_simulated", includeSimulated.toString());
    const qs = q.toString();
    return fetchJson<IncidentItem[]>(`/incidents${qs ? `?${qs}` : ""}`, signal ? { signal } : undefined);
  },
  updateIncidentStatus: (id: string, status: "open" | "acknowledged" | "resolved") =>
    fetchJson<IncidentItem>(`/incidents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  createIncident: (incident: {
    intersection_id: string;
    incident_type?: string;
    severity?: "critical" | "warning" | "info";
    description_en: string;
    description_hi?: string;
    recommended_action_en: string;
    recommended_action_hi?: string;
    source?: string;
  }) =>
    fetchJson<IncidentItem>("/incidents", {
      method: "POST",
      body: JSON.stringify(incident),
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
  compareRoutes: (
    originOrParams:
      | string
      | {
          origin_id?: string;
          destination_id?: string;
          origin_text?: string;
          destination_text?: string;
          origin_lat?: number;
          origin_lon?: number;
          destination_lat?: number;
          destination_lon?: number;
          avoid_closed_roads?: boolean;
        },
    destinationId?: string,
    avoidClosed = true
  ) => {
    const body =
      typeof originOrParams === "string"
        ? {
            origin_id: originOrParams,
            destination_id: destinationId || "",
            avoid_closed_roads: avoidClosed,
          }
        : {
            avoid_closed_roads: true,
            ...originOrParams,
          };
    return fetchJson<RouteResponse>("/routes/compare", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

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

  // Citizen Commute Hub (Saved Routes & Community Reporting)
  getSavedRoutes: (signal?: AbortSignal) =>
    fetchJson<SavedRoute[]>("/citizen/saved-routes", signal ? { signal } : undefined),
  createSavedRoute: (route: {
    name: string;
    origin_id: string;
    destination_id: string;
    origin_name: string;
    destination_name: string;
    notes?: string;
  }) =>
    fetchJson<SavedRoute>("/citizen/saved-routes", {
      method: "POST",
      body: JSON.stringify(route),
    }),
  deleteSavedRoute: (routeId: string) =>
    fetchJson<{ message: string; id: string }>(`/citizen/saved-routes/${routeId}`, {
      method: "DELETE",
    }),

  getCitizenReports: (signal?: AbortSignal) =>
    fetchJson<CitizenReport[]>("/citizen/reports", signal ? { signal } : undefined),
  getCitizenReportStats: (signal?: AbortSignal) =>
    fetchJson<CitizenReportStats>("/citizen/reports/stats", signal ? { signal } : undefined),
  createCitizenReport: (report: {
    category: string;
    location_name: string;
    latitude?: number;
    longitude?: number;
    description: string;
    photo_url?: string;
    user_id?: string;
  }) =>
    fetchJson<CitizenReport>("/citizen/reports", {
      method: "POST",
      body: JSON.stringify(report),
    }),
  updateCitizenReportStatus: (
    reportId: string,
    status: "verified" | "in_progress" | "resolved" | "dismissed" | "unverified" | string,
    resolution_note?: string
  ) =>
    fetchJson<{
      message: string;
      id: string;
      status: string;
      resolution_note?: string | null;
      report: CitizenReport;
    }>(`/citizen/reports/${reportId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, resolution_note: resolution_note || null }),
    }),
  getCitizenReportTimeline: (reportId: string) =>
    fetchJson<CitizenReportTimeline[]>(`/citizen/reports/${reportId}/timeline`),
  getCitizenNotifications: (userId?: string, signal?: AbortSignal) => {
    const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
    return fetchJson<CitizenNotification[]>(`/citizen/notifications${qs}`, signal ? { signal } : undefined);
  },
  markCitizenNotificationRead: (notificationId: string) =>
    fetchJson<{ message: string; id: string; is_read: boolean }>(
      `/citizen/notifications/${notificationId}/read`,
      { method: "PUT" }
    ),
  markAllCitizenNotificationsRead: (userId?: string) => {
    const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
    return fetchJson<{ message: string; updated_count: number }>(
      `/citizen/notifications/read-all${qs}`,
      { method: "PUT" }
    );
  },
  uploadReportPhoto: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const token = getStoredAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}/citizen/upload-photo`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || `Upload failed with HTTP ${res.status}`);
    }
    return res.json() as Promise<{
      status: string;
      filename: string;
      photo_url: string;
      size_bytes: number;
      content_type: string;
    }>;
  },

  // Emergency Vehicle Green Corridor APIs
  getEmergencyCorridors: (
    params?: { status?: string; vehicle_type?: string; user_id?: string },
    signal?: AbortSignal
  ) => {
    const q = new URLSearchParams();
    if (params?.status) q.append("status", params.status);
    if (params?.vehicle_type) q.append("vehicle_type", params.vehicle_type);
    if (params?.user_id) q.append("user_id", params.user_id);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return fetchJson<EmergencyCorridorRequest[]>(`/emergency/corridors${qs}`, signal ? { signal } : undefined);
  },

  getEmergencyCorridorStats: (signal?: AbortSignal) =>
    fetchJson<EmergencyCorridorStats>("/emergency/corridors/stats", signal ? { signal } : undefined),

  getEmergencyCorridorDetail: (id: string) => fetchJson<EmergencyCorridorRequest>(`/emergency/corridors/${id}`),

  createEmergencyCorridor: (req: {
    vehicle_type: string;
    origin_id: string;
    origin_name: string;
    origin_lat?: number;
    origin_lon?: number;
    destination_id: string;
    destination_name: string;
    destination_lat?: number;
    destination_lon?: number;
    priority?: string;
    description?: string;
    user_id?: string;
  }) =>
    fetchJson<EmergencyCorridorRequest>("/emergency/corridors", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  updateEmergencyCorridorStatus: (id: string, status: string, authority_notes?: string) =>
    fetchJson<EmergencyCorridorRequest>(`/emergency/corridors/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, authority_notes: authority_notes || null }),
    }),

  getEmergencyCorridorRoute: (id: string) => fetchJson<EmergencyRouteDetail>(`/emergency/corridors/${id}/route`),
};

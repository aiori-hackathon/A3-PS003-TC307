import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import {
  EmergencyCorridorRequest,
  CitizenReport,
  IncidentItem,
  RouteResponse,
} from "../types";

export type ScenarioType = "none" | "ambulance" | "waterlogging";
export type ScenarioStatus = "idle" | "running" | "paused" | "completed";

interface SimulationContextType {
  activeScenario: ScenarioType;
  scenarioStatus: ScenarioStatus;
  simulatedCorridor: EmergencyCorridorRequest | null;
  simulatedIncident: CitizenReport | null;
  simulatedAlert: IncidentItem | null;
  simulatedRoute: RouteResponse | null;
  isSimulatorModalOpen: boolean;
  openSimulatorModal: () => void;
  closeSimulatorModal: () => void;
  startAmbulanceScenario: () => void;
  startWaterloggingScenario: () => void;
  pauseScenario: () => void;
  resumeScenario: () => void;
  completeScenario: () => void;
  resetScenario: () => void;
  updateSimulatedCorridorStatus: (status: string, notes?: string) => void;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

// --- PRE-CONFIGURED ISOLATED SIMULATION SCENARIO PAYLOADS ---

// Scenario A: Critical Ambulance Green Corridor (Dhaula Kuan -> AIIMS Trauma Center)
const MOCK_SIMULATED_AMBULANCE_CORRIDOR: EmergencyCorridorRequest = {
  id: "EMG-SIM-911",
  vehicle_type: "ambulance",
  origin_id: "INT-06",
  origin_name: "Dhaula Kuan Interchange",
  destination_id: "INT-04",
  destination_name: "Ring Road Arterial / AIIMS Trauma Center",
  priority: "critical",
  description: "[SIMULATED DEMO] Level-1 Cardiac Ambulance en route to AIIMS Trauma Center. Requesting priority green signal preemption across arterial network.",
  status: "ACTIVE",
  route_path: ["INT-06", "INT-05", "INT-04"],
  distance_km: 7.8,
  estimated_time_minutes: 9.8, // Reduced from 26.5 mins via green corridor preemption
  priority_intersections_count: 3,
  authority_notes: "Simulated green corridor preemptive signal override engaged across INT-06, INT-05, and INT-04.",
  created_at: new Date().toISOString(),
  route_details: {
    route_id: "ROUTE-SIM-EMG-911",
    name: "Dhaula Kuan ➔ AIIMS Green Corridor",
    intersections_path: ["INT-06", "INT-05", "INT-04"],
    distance_km: 7.8,
    normal_travel_time_min: 26.5,
    corridor_travel_time_min: 9.8,
    time_saved_minutes: 16.7,
    congestion_exposure_pct: 12,
    is_recommended: true,
    intersections: [
      {
        intersection_id: "INT-06",
        name: "Dhaula Kuan Interchange",
        latitude: 28.5921,
        longitude: 77.1594,
        current_speed: 48,
        congestion_level: "low",
        simulated_signal_status: "GREEN_PRIORITY",
        recommended_action: "GREEN_HOLD (90s)",
      },
      {
        intersection_id: "INT-05",
        name: "Moti Bagh Flyover Split",
        latitude: 28.5833,
        longitude: 77.1685,
        current_speed: 52,
        congestion_level: "low",
        simulated_signal_status: "GREEN_PRIORITY",
        recommended_action: "GREEN_HOLD (120s)",
      },
      {
        intersection_id: "INT-04",
        name: "Ring Road Arterial Junction",
        latitude: 28.5714,
        longitude: 77.1983,
        current_speed: 45,
        congestion_level: "low",
        simulated_signal_status: "GREEN_PRIORITY",
        recommended_action: "GREEN_HOLD (120s)",
      },
    ],
  },
};

const MOCK_SIMULATED_AMBULANCE_ALERT: IncidentItem = {
  id: "ALERT-SIM-AMB",
  intersection_id: "INT-06",
  intersection_name: "Dhaula Kuan -> AIIMS Green Corridor",
  intersection_name_hi: "धौला कुआँ -> एम्स ग्रीन कॉरिडोर",
  incident_type: "emergency_green_corridor",
  severity: "critical",
  description_en: "[SIMULATED DEMO] Active Ambulance Green Corridor. Signals preempted on Dhaula Kuan - Moti Bagh - Ring Road corridors.",
  description_hi: "[सिम्युलेटेड डेमो] सक्रिय एम्बुलेंस ग्रीन कॉरिडोर। धौला कुआं - मोती बाग - रिंग रोड पर सिग्नल प्राथमिकता सक्रिय।",
  recommended_action_en: "Yield left on Westbound Ring Road. Signal preemption cycle active.",
  recommended_action_hi: "रिंग रोड पर बायीं ओर मुड़ें। सिग्नल प्राथमिकता चक्र सक्रिय।",
  status: "open",
  created_at: new Date().toISOString(),
  is_simulated: true,
  source: "simulation_engine",
};

// Scenario B: Severe Waterlogging Incident & Alternate Routing (Moti Bagh Underpass)
const MOCK_SIMULATED_WATERLOGGING_REPORT: CitizenReport = {
  id: "REP-SIM-WLOG",
  category: "waterlogging",
  location_name: "Moti Bagh Flyover Underpass (INT-05)",
  latitude: 28.5833,
  longitude: 77.1685,
  description: "[SIMULATED DEMO] Severe monsoon surge causing 48cm deep waterlogging in Moti Bagh Underpass. 2 lanes submerged, causing 4.2km queue.",
  priority: "critical",
  status: "in_progress",
  resolution_note: "Simulated emergency drainage crew dispatched with high-capacity dewatering pumps. Traffic diverted.",
  created_at: new Date().toISOString(),
  photo_url: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80",
};

const MOCK_SIMULATED_WATERLOGGING_ALERT: IncidentItem = {
  id: "ALERT-SIM-WLOG",
  intersection_id: "INT-05",
  intersection_name: "Moti Bagh Flyover Split",
  intersection_name_hi: "मोती बाग फ्लाईओवर चौराहा",
  incident_type: "severe_waterlogging",
  severity: "critical",
  description_en: "[SIMULATED DEMO] Severe waterlogging at Moti Bagh Flyover. Capacity reduced by 65%.",
  description_hi: "[सिम्युलेटेड डेमो] मोती बाग फ्लाईओवर पर भारी जलभराव। क्षमता 65% कम।",
  recommended_action_en: "Divert westbound traffic via Barakhamba - Sector Bypass.",
  recommended_action_hi: "बाराखंबा - सेक्टर बाईपास से यातायात मोड़ें।",
  status: "open",
  created_at: new Date().toISOString(),
  is_simulated: true,
  source: "simulation_engine",
};

const MOCK_SIMULATED_WATERLOGGING_ROUTES: RouteResponse = {
  origin: "INT-06",
  destination: "INT-04",
  road_closure_active: true,
  affected_intersection: "INT-05",
  advisory_notice: "[SIMULATION ADVISORY] Primary route via Moti Bagh is blocked by 48cm waterlogging. Diverting via Cyber Hub / Sector Bypass saves 17.7 minutes.",
  routes: [
    {
      route_id: "rt_sim_bypass",
      name_en: "Recommended Bypass: Ring Road Outer Bypass (INT-06 -> INT-07 -> INT-04)",
      name_hi: "अनुशंसित बाईपास: आउटर रिंग रोड बाईपास",
      intersections_path: ["INT-06", "INT-07", "INT-04"],
      distance_km: 11.2,
      estimated_time_minutes: 16.5,
      congestion_exposure_pct: 18.0,
      is_recommended: true,
      recommendation_rationale: "Bypasses submerged Moti Bagh underpass, avoiding 4.2km congestion queue.",
    },
    {
      route_id: "rt_sim_primary_affected",
      name_en: "Primary Arterial (Submerged at Moti Bagh: INT-06 -> INT-05 -> INT-04)",
      name_hi: "प्राथमिक मार्ग (जलभराव से प्रभावित)",
      intersections_path: ["INT-06", "INT-05", "INT-04"],
      distance_km: 7.8,
      estimated_time_minutes: 34.2, // Heavy delay due to waterlogging
      congestion_exposure_pct: 85.0,
      is_recommended: false,
      recommendation_rationale: "Severe delays due to 48cm waterlogging on Moti Bagh underpass.",
    },
  ],
};

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeScenario, setActiveScenario] = useState<ScenarioType>("none");
  const [scenarioStatus, setScenarioStatus] = useState<ScenarioStatus>("idle");
  const [isSimulatorModalOpen, setIsSimulatorModalOpen] = useState<boolean>(false);

  // Scenario Artifacts
  const [simulatedCorridor, setSimulatedCorridor] = useState<EmergencyCorridorRequest | null>(null);
  const [simulatedIncident, setSimulatedIncident] = useState<CitizenReport | null>(null);
  const [simulatedAlert, setSimulatedAlert] = useState<IncidentItem | null>(null);
  const [simulatedRoute, setSimulatedRoute] = useState<RouteResponse | null>(null);

  const openSimulatorModal = useCallback(() => setIsSimulatorModalOpen(true), []);
  const closeSimulatorModal = useCallback(() => setIsSimulatorModalOpen(false), []);

  // Scenario A: Ambulance Emergency
  const startAmbulanceScenario = useCallback(() => {
    setActiveScenario("ambulance");
    setScenarioStatus("running");
    setSimulatedCorridor({ ...MOCK_SIMULATED_AMBULANCE_CORRIDOR, created_at: new Date().toISOString() });
    setSimulatedAlert({ ...MOCK_SIMULATED_AMBULANCE_ALERT, created_at: new Date().toISOString() });
    setSimulatedIncident(null);
    setSimulatedRoute(null);
  }, []);

  // Scenario B: Waterlogging Incident
  const startWaterloggingScenario = useCallback(() => {
    setActiveScenario("waterlogging");
    setScenarioStatus("running");
    setSimulatedIncident({ ...MOCK_SIMULATED_WATERLOGGING_REPORT, created_at: new Date().toISOString() });
    setSimulatedAlert({ ...MOCK_SIMULATED_WATERLOGGING_ALERT, created_at: new Date().toISOString() });
    setSimulatedRoute(MOCK_SIMULATED_WATERLOGGING_ROUTES);
    setSimulatedCorridor(null);
  }, []);

  const pauseScenario = useCallback(() => {
    setScenarioStatus("paused");
  }, []);

  const resumeScenario = useCallback(() => {
    setScenarioStatus("running");
  }, []);

  const completeScenario = useCallback(() => {
    setScenarioStatus("completed");
    if (simulatedCorridor) {
      setSimulatedCorridor((prev) => (prev ? { ...prev, status: "COMPLETED" } : null));
    }
    if (simulatedIncident) {
      setSimulatedIncident((prev) => (prev ? { ...prev, status: "resolved" } : null));
    }
  }, [simulatedCorridor, simulatedIncident]);

  // Clean Reset: Removes all simulation artifacts completely from memory
  const resetScenario = useCallback(() => {
    setActiveScenario("none");
    setScenarioStatus("idle");
    setSimulatedCorridor(null);
    setSimulatedIncident(null);
    setSimulatedAlert(null);
    setSimulatedRoute(null);
  }, []);

  const updateSimulatedCorridorStatus = useCallback((status: string, notes?: string) => {
    setSimulatedCorridor((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        status: status as any,
        authority_notes: notes || prev.authority_notes,
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      activeScenario,
      scenarioStatus,
      simulatedCorridor,
      simulatedIncident,
      simulatedAlert,
      simulatedRoute,
      isSimulatorModalOpen,
      openSimulatorModal,
      closeSimulatorModal,
      startAmbulanceScenario,
      startWaterloggingScenario,
      pauseScenario,
      resumeScenario,
      completeScenario,
      resetScenario,
      updateSimulatedCorridorStatus,
    }),
    [
      activeScenario,
      scenarioStatus,
      simulatedCorridor,
      simulatedIncident,
      simulatedAlert,
      simulatedRoute,
      isSimulatorModalOpen,
      openSimulatorModal,
      closeSimulatorModal,
      startAmbulanceScenario,
      startWaterloggingScenario,
      pauseScenario,
      resumeScenario,
      completeScenario,
      resetScenario,
      updateSimulatedCorridorStatus,
    ]
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
};

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error("useSimulation must be used within a SimulationProvider");
  }
  return context;
};

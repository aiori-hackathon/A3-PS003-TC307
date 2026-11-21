import {
  IntersectionDetail,
  DashboardSummary,
  CitizenReport,
  EmergencyCorridorRequest,
  IncidentItem,
} from "../types";

export type AdvisoryPriority = "critical" | "high" | "medium" | "low";

export type AdvisorySituationType =
  | "emergency_obstruction"
  | "waterlogging"
  | "heavy_congestion"
  | "speed_drop"
  | "multiple_incidents"
  | "spillover_risk"
  | "historical_pattern"
  | "optimal_flow"
  | "insufficient_data";

export type AdvisoryStatus = "new" | "reviewed" | "action_taken" | "dismissed";

export interface MunicipalAdvisory {
  id: string;
  title: string;
  observation: string;
  recommendation: string;
  priority: AdvisoryPriority;
  confidenceScore?: number;
  dataSource: string;
  timestamp: string;
  situationType: AdvisorySituationType;
  location: {
    intersectionId: string;
    name: string;
    latitude: number;
    longitude: number;
    zone?: string;
  };
  supportingData: {
    currentSpeed?: number;
    freeFlowSpeed?: number;
    speedDropPct?: number;
    congestionLevel?: string;
    delaySeconds?: number;
    queueLengthMeters?: number;
    incidentCount?: number;
    relatedReportId?: string;
    relatedReportCategory?: string;
    emergencyCorridorId?: string;
    emergencyVehicleType?: string;
    alternateRoutePath?: string[];
    alternateRouteName?: string;
    alternateTimeSavedMinutes?: number;
    affectedRoadSegment?: [string, string];
  };
  suggestedNextSteps: string[];
  relatedIncidentIds?: string[];
  status: AdvisoryStatus;
}

// Known adjacency graph for Delhi NCR arterial intersections
const ADJACENT_NODES: Record<string, string[]> = {
  "INT-01": ["INT-02", "INT-03", "INT-04"],
  "INT-02": ["INT-01", "INT-03", "INT-04"],
  "INT-03": ["INT-01", "INT-02", "INT-06"],
  "INT-04": ["INT-01", "INT-02", "INT-05", "INT-08"],
  "INT-05": ["INT-04", "INT-06", "INT-07"],
  "INT-06": ["INT-03", "INT-05", "INT-07"],
  "INT-07": ["INT-05", "INT-06", "INT-08"],
  "INT-08": ["INT-04", "INT-07"],
};

// Known bypass routes for key bottlenecks
const KNOWN_BYPASSES: Record<string, { path: string[]; name: string; timeSavedMin: number }> = {
  "INT-05": {
    path: ["INT-06", "INT-07", "INT-04"],
    name: "Outer Ring Road ➔ Cyber Hub Bypass",
    timeSavedMin: 14.5,
  },
  "INT-04": {
    path: ["INT-01", "INT-02", "INT-08"],
    name: "Barakhamba ➔ Golf Course Radial",
    timeSavedMin: 11.2,
  },
  "INT-06": {
    path: ["INT-01", "INT-04", "INT-05"],
    name: "Inner Ring Road Radial Split",
    timeSavedMin: 9.8,
  },
};

const DISMISSED_STORAGE_KEY = "trafficfl_dismissed_advisories_v2";
const HISTORY_STORAGE_KEY = "trafficfl_advisory_history_v2";

export class MunicipalAdvisoryEngine {
  /**
   * Retrieves dismissed advisory IDs from local storage
   */
  static getDismissedIds(): string[] {
    try {
      const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Marks an advisory as dismissed
   */
  static dismissAdvisory(advisoryId: string): void {
    try {
      const dismissed = this.getDismissedIds();
      if (!dismissed.includes(advisoryId)) {
        dismissed.push(advisoryId);
        localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(dismissed));
      }
      this.updateAdvisoryStatusInHistory(advisoryId, "dismissed");
    } catch (e) {
      console.warn("Failed to dismiss advisory in storage:", e);
    }
  }

  /**
   * Clears dismissed advisories (for testing/reset)
   */
  static clearDismissed(): void {
    try {
      localStorage.removeItem(DISMISSED_STORAGE_KEY);
    } catch (e) {
      console.warn("Failed to clear dismissed advisories:", e);
    }
  }

  /**
   * Gets advisory history
   */
  static getHistory(): MunicipalAdvisory[] {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Records or updates advisory in history
   */
  static recordAdvisories(advisories: MunicipalAdvisory[]): void {
    try {
      const currentHistory = this.getHistory();
      const historyMap = new Map<string, MunicipalAdvisory>();

      // Load existing
      currentHistory.forEach((item) => historyMap.set(item.id, item));

      // Merge new
      advisories.forEach((item) => {
        if (!historyMap.has(item.id)) {
          historyMap.set(item.id, item);
        }
      });

      const updated = Array.from(historyMap.values())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50); // keep last 50

      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to record advisory history:", e);
    }
  }

  /**
   * Updates an advisory's status in history
   */
  static updateAdvisoryStatusInHistory(advisoryId: string, status: AdvisoryStatus): void {
    try {
      const history = this.getHistory();
      const idx = history.findIndex((a) => a.id === advisoryId);
      if (idx !== -1) {
        history[idx].status = status;
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
      }
    } catch (e) {
      console.warn("Failed to update advisory status in history:", e);
    }
  }

  /**
   * Evaluates current traffic telemetry, citizen complaints, emergency corridors,
   * and arterial graph topology to generate prioritized Municipal AI Advisories.
   */
  static analyzeTrafficConditions(params: {
    intersections: IntersectionDetail[];
    telemetryData: DashboardSummary | null;
    reports: CitizenReport[];
    emergencyCorridors: EmergencyCorridorRequest[];
    incidents: IncidentItem[];
  }): MunicipalAdvisory[] {
    const { intersections, telemetryData, reports, emergencyCorridors, incidents } = params;

    const advisories: MunicipalAdvisory[] = [];
    const dismissedIds = this.getDismissedIds();
    const nowIso = new Date().toISOString();

    // 0. Insufficient Data Check
    if (!intersections || intersections.length === 0) {
      const noDataAdv: MunicipalAdvisory = {
        id: "ADV-INSUFFICIENT-DATA",
        title: "Telemetry Stream Offline – Insufficient Data for Analysis",
        observation: "Insufficient live sensor or provider data available across monitored municipal junctions.",
        recommendation: "Verify provider connection status and network telemetry feeds.",
        priority: "low",
        dataSource: "TrafficFlow Data Ingestion Service",
        timestamp: nowIso,
        situationType: "insufficient_data",
        location: {
          intersectionId: "NONE",
          name: "City-Wide Telemetry Grid",
          latitude: 28.6139,
          longitude: 77.209,
        },
        supportingData: {},
        suggestedNextSteps: [
          "Check provider health diagnostics in settings",
          "Inspect API gateway connection",
        ],
        status: "new",
      };
      return [noDataAdv];
    }

    const dataSourceName =
      telemetryData?.data_source ||
      (telemetryData?.provider_status?.is_online ? "TomTom Live Telemetry Stream" : "Municipal Telemetry Sensor Grid");

    // Helper map of intersections
    const junctionMap = new Map<string, IntersectionDetail>();
    intersections.forEach((i) => junctionMap.set(i.id, i));

    // =========================================================================
    // SCENARIO 1: Emergency Corridor Obstruction (CRITICAL)
    // Active emergency transit traversing congested, closed, or waterlogged junction
    // =========================================================================
    const activeCorridors = emergencyCorridors.filter(
      (c) => c.status === "ACTIVE" || c.status === "REQUESTED"
    );

    for (const corr of activeCorridors) {
      const routePath = corr.route_path || [];
      for (const jId of routePath) {
        const junc = junctionMap.get(jId);
        if (!junc) continue;

        const freeFlow = junc.free_flow_speed ?? junc.baseline_speed ?? 45;
        const isSevere = junc.congestion_level === "severe";
        const speedDrop = freeFlow > 0
          ? ((freeFlow - junc.current_speed) / freeFlow) * 100
          : 0;
        const isSignificantlySlow = junc.current_speed < 22 || speedDrop > 45;

        // Check if there is an active incident / waterlogging at this junction
        const relatedRep = reports.find(
          (r) =>
            (r.status === "verified" || r.status === "in_progress") &&
            (r.location_name.includes(jId) ||
              r.location_name.toLowerCase().includes(junc.name.toLowerCase().split(" ")[0]))
        );

        if (isSevere || isSignificantlySlow || relatedRep) {
          const advId = `ADV-EMG-${corr.id}-${jId}`;
          const vType = (corr.vehicle_type || "emergency vehicle").toUpperCase();
          const bypass = KNOWN_BYPASSES[jId];

          advisories.push({
            id: advId,
            title: `Emergency Corridor Obstruction: ${corr.destination_name}`,
            observation: `Active ${vType} corridor [${corr.id}] traversing ${junc.name} [${jId}] is experiencing severe arterial delay (Speed: ${junc.current_speed} km/h, ${Math.round(speedDrop)}% below free-flow baseline).${relatedRep ? ` Verified ${relatedRep.category} incident reported on route.` : ""}`,
            recommendation: `Deploy immediate manual green wave override at ${junc.name} [${jId}] and coordinate with field units. ${bypass ? `Recommend candidate bypass via ${bypass.name} (-${bypass.timeSavedMin}m delay).` : "Review alternate arterial detours."}`,
            priority: "critical",
            confidenceScore: junc.confidence_score || 0.95,
            dataSource: `${dataSourceName} & Emergency Dispatch Telemetry`,
            timestamp: nowIso,
            situationType: "emergency_obstruction",
            location: {
              intersectionId: junc.id,
              name: junc.name,
              latitude: junc.latitude,
              longitude: junc.longitude,
              zone: junc.zone,
            },
            supportingData: {
              currentSpeed: junc.current_speed,
              freeFlowSpeed: freeFlow,
              speedDropPct: Math.round(speedDrop),
              congestionLevel: junc.congestion_level,
              delaySeconds: junc.delay_seconds || 180,
              emergencyCorridorId: corr.id,
              emergencyVehicleType: corr.vehicle_type,
              relatedReportId: relatedRep?.id,
              relatedReportCategory: relatedRep?.category,
              alternateRoutePath: bypass?.path,
              alternateRouteName: bypass?.name,
              alternateTimeSavedMinutes: bypass?.timeSavedMin,
            },
            suggestedNextSteps: [
              `Inspect active emergency corridor ${corr.id} on Live Map.`,
              `Engage green-signal preemption protocol at ${junc.name}.`,
              `Notify emergency dispatcher of bypass option via ${bypass?.name || "alternate corridor"}.`,
              `Broadcast urgent public lane-clearance advisory to arterial motorists.`,
            ],
            relatedIncidentIds: relatedRep ? [relatedRep.id] : undefined,
            status: "new",
          });
          break; // One primary obstruction advisory per corridor
        }
      }
    }

    // =========================================================================
    // SCENARIO 2: Verified Waterlogging & Road Closures (CRITICAL / HIGH)
    // Citizen reports with verified or in_progress status
    // =========================================================================
    const criticalReports = reports.filter(
      (r) =>
        (r.status === "verified" || r.status === "in_progress") &&
        (r.category === "waterlogging" || r.category === "road_blockage" || r.category === "accident")
    );

    for (const rep of criticalReports) {
      // Find closest or matching intersection
      let matchedJunc: IntersectionDetail | undefined;
      for (const junc of intersections) {
        if (
          rep.location_name.includes(junc.id) ||
          rep.location_name.toLowerCase().includes(junc.name.toLowerCase().split(" ")[0])
        ) {
          matchedJunc = junc;
          break;
        }
      }
      if (!matchedJunc) {
        matchedJunc = intersections[0]; // fallback to first intersection
      }

      const isWaterlogging = rep.category === "waterlogging";
      const advId = `ADV-HAZARD-${rep.id}`;
      const bypass = KNOWN_BYPASSES[matchedJunc.id] || {
        path: ["INT-06", "INT-07", "INT-04"],
        name: "Outer Ring Road Arterial Bypass",
        timeSavedMin: 12.0,
      };

      advisories.push({
        id: advId,
        title: `${isWaterlogging ? "Severe Monsoon Waterlogging" : "Arterial Road Hazard"}: ${rep.location_name}`,
        observation: `Verified citizen hazard [${rep.id}] confirmed at ${rep.location_name}: "${rep.description}". Roadway throughput reduced; potential vehicle stranding hazard.`,
        recommendation: `Inspect affected road on Live Map and broadcast municipal diversion advisory. ${bypass ? `Recommend arterial bypass via ${bypass.name} (Estimated time saved: ~${bypass.timeSavedMin}m).` : "Coordinate field diversion."}`,
        priority: isWaterlogging || rep.priority === "critical" ? "critical" : "high",
        confidenceScore: 0.92,
        dataSource: "Verified Citizen Complaint Telemetry & TomTom Spatial Stream",
        timestamp: nowIso,
        situationType: isWaterlogging ? "waterlogging" : "multiple_incidents",
        location: {
          intersectionId: matchedJunc.id,
          name: rep.location_name,
          latitude: rep.latitude || matchedJunc.latitude,
          longitude: rep.longitude || matchedJunc.longitude,
          zone: matchedJunc.zone,
        },
        supportingData: {
          currentSpeed: matchedJunc.current_speed,
          freeFlowSpeed: matchedJunc.free_flow_speed,
          congestionLevel: matchedJunc.congestion_level,
          relatedReportId: rep.id,
          relatedReportCategory: rep.category,
          alternateRoutePath: bypass.path,
          alternateRouteName: bypass.name,
          alternateTimeSavedMinutes: bypass.timeSavedMin,
          affectedRoadSegment: [matchedJunc.id, bypass.path[1] || matchedJunc.id],
        },
        suggestedNextSteps: [
          `Review photographic evidence and location marker on Live Map.`,
          `Dispatch municipal drainage / repair team with high-capacity equipment.`,
          `Publish public traffic diversion advisory for ${rep.location_name}.`,
          `Preemptively adjust traffic signal phases on alternate arterial routes.`,
        ],
        relatedIncidentIds: [rep.id],
        status: "new",
      });
    }

    // =========================================================================
    // SCENARIO 3: Heavy Congestion & Significant Speed Drop (HIGH)
    // Speed <= 50% of free-flow speed or congestion_level === "severe"
    // =========================================================================
    const severeJunctions = intersections.filter((j) => {
      const freeFlow = j.free_flow_speed ?? j.baseline_speed ?? 45;
      return (
        j.congestion_level === "severe" ||
        (freeFlow > 0 && j.current_speed <= freeFlow * 0.55 && j.current_speed < 24)
      );
    });

    for (const junc of severeJunctions) {
      const advId = `ADV-CONG-${junc.id}`;
      // Avoid duplicate if emergency corridor already covered this junction
      if (advisories.some((a) => a.location.intersectionId === junc.id && a.priority === "critical")) {
        continue;
      }

      const freeFlow = junc.free_flow_speed ?? junc.baseline_speed ?? 45;
      const speedDrop = freeFlow > 0
        ? Math.round(((freeFlow - junc.current_speed) / freeFlow) * 100)
        : 50;

      const bypass = KNOWN_BYPASSES[junc.id];

      advisories.push({
        id: advId,
        title: `Heavy Congestion & Speed Drop: ${junc.name}`,
        observation: `Severe arterial delay detected at ${junc.name} [${junc.id}]. Monitored speed of ${junc.current_speed} km/h is ${speedDrop}% below the ${freeFlow} km/h free-flow baseline (Delay: +${junc.delay_seconds || 150}s, Queue: ${junc.queue_length || 180}m).`,
        recommendation: `Review upstream arterial green splits and evaluate dynamic signal extension. ${bypass ? `Recommend field detour via ${bypass.name}.` : "Inspect candidate alternate routes in Smart Route intelligence."}`,
        priority: "high",
        confidenceScore: junc.confidence_score || 0.88,
        dataSource: dataSourceName,
        timestamp: nowIso,
        situationType: "heavy_congestion",
        location: {
          intersectionId: junc.id,
          name: junc.name,
          latitude: junc.latitude,
          longitude: junc.longitude,
          zone: junc.zone,
        },
        supportingData: {
          currentSpeed: junc.current_speed,
          freeFlowSpeed: freeFlow,
          speedDropPct: speedDrop,
          congestionLevel: junc.congestion_level,
          delaySeconds: junc.delay_seconds || 150,
          queueLengthMeters: junc.queue_length || 180,
          alternateRoutePath: bypass?.path,
          alternateRouteName: bypass?.name,
          alternateTimeSavedMinutes: bypass?.timeSavedMin,
        },
        suggestedNextSteps: [
          `Focus Live Map view on ${junc.name} to inspect arterial approach queues.`,
          `Check downstream junctions for queue spillover.`,
          `Consider broadcasting municipal slowdown alert if delay exceeds 4 minutes.`,
        ],
        status: "new",
      });
    }

    // =========================================================================
    // SCENARIO 4: Topological Spillover Delay Risk (MEDIUM)
    // Neighbor of severe junction
    // =========================================================================
    for (const severeJunc of severeJunctions) {
      const neighbors = ADJACENT_NODES[severeJunc.id] || [];
      for (const nId of neighbors) {
        const neighborJunc = junctionMap.get(nId);
        if (!neighborJunc || neighborJunc.congestion_level === "severe") continue;

        const advId = `ADV-SPILLOVER-${neighborJunc.id}-${severeJunc.id}`;
        if (advisories.some((a) => a.location.intersectionId === neighborJunc.id)) continue;

        advisories.push({
          id: advId,
          title: `Topological Spillover Risk: ${neighborJunc.name}`,
          observation: `Secondary queue backpressure risk detected at ${neighborJunc.name} [${nId}] due to severe congestion spillback from adjacent ${severeJunc.name} [${severeJunc.id}].`,
          recommendation: `Preemptively extend arterial green split on approach from ${severeJunc.id} by 15-20 seconds to prevent gridlock propagation.`,
          priority: "medium",
          confidenceScore: 0.82,
          dataSource: "Arterial Topology Graph & Live Flow Adjacency Matrix",
          timestamp: nowIso,
          situationType: "spillover_risk",
          location: {
            intersectionId: neighborJunc.id,
            name: neighborJunc.name,
            latitude: neighborJunc.latitude,
            longitude: neighborJunc.longitude,
            zone: neighborJunc.zone,
          },
          supportingData: {
            currentSpeed: neighborJunc.current_speed,
            freeFlowSpeed: neighborJunc.free_flow_speed ?? neighborJunc.baseline_speed ?? 45,
            congestionLevel: neighborJunc.congestion_level,
          },
          suggestedNextSteps: [
            `Monitor approach queue between ${neighborJunc.name} and ${severeJunc.name}.`,
            `Prepare dynamic phase timing adjustment if queue exceeds 120m.`,
          ],
          status: "new",
        });
      }
    }

    // =========================================================================
    // SCENARIO 5: Optimal Flow Baseline (LOW)
    // If no critical or high advisories were generated
    // =========================================================================
    if (advisories.length === 0) {
      const avgSpeed = telemetryData?.average_speed || 42.5;
      const primaryJunc = intersections[0];

      advisories.push({
        id: "ADV-OPTIMAL-FLOW",
        title: "Optimal Arterial Flow Maintained Across Monitored Corridors",
        observation: `All ${intersections.length} monitored Delhi NCR arterial junctions are operating within acceptable service levels (City Average Speed: ${avgSpeed} km/h). No emergency obstructions or road closures detected.`,
        recommendation: "Maintain standard dynamic signal synchronization cycles across arterial networks. Continue continuous telemetry polling.",
        priority: "low",
        confidenceScore: 0.94,
        dataSource: dataSourceName,
        timestamp: nowIso,
        situationType: "optimal_flow",
        location: {
          intersectionId: primaryJunc.id,
          name: "Delhi NCR Arterial Network",
          latitude: primaryJunc.latitude,
          longitude: primaryJunc.longitude,
        },
        supportingData: {
          currentSpeed: avgSpeed,
          freeFlowSpeed: avgSpeed + 8,
          congestionLevel: "low",
        },
        suggestedNextSteps: [
          "Continue monitoring real-time arterial telemetry.",
          "Verify provider latency and caching health.",
        ],
        status: "new",
      });
    }

    // Sort by priority (critical -> high -> medium -> low)
    const priorityWeight: Record<AdvisoryPriority, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    advisories.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    // Record into history
    this.recordAdvisories(advisories);

    // Filter out dismissed advisories for active presentation
    return advisories.filter((a) => !dismissedIds.includes(a.id));
  }
}

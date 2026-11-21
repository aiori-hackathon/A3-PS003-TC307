import React, { useState } from "react";
import {
  Siren,
  ShieldAlert,
  Flame,
  Shield,
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Eye,
  X,
  AlertTriangle,
  ArrowRight,
  Radio,
  Navigation,
  ShieldCheck,
  Plus,
  Share2,
  Compass,
  SlidersHorizontal,
} from "lucide-react";
import { EmergencyCorridorRequest, EmergencyCorridorStats } from "../../types";
import { AuthorityLiveMap } from "./AuthorityLiveMap";
import { ShareModal, RouteShareData } from "../share/ShareModal";
import { api } from "../../services/api";
import { useSimulation } from "../../context/SimulationContext";

interface AuthorityEmergencyOperationsProps {
  corridors: EmergencyCorridorRequest[];
  stats: EmergencyCorridorStats | null;
  loading: boolean;
  onUpdateStatus: (corridorId: string, status: string, notes?: string) => Promise<void>;
  onRefresh?: () => void;
}

export const AuthorityEmergencyOperations: React.FC<AuthorityEmergencyOperationsProps> = ({
  corridors,
  stats,
  loading,
  onUpdateStatus,
  onRefresh,
}) => {
  const [selectedCorridor, setSelectedCorridor] = useState<EmergencyCorridorRequest | null>(null);
  const [actionConfirm, setActionConfirm] = useState<{
    corridor: EmergencyCorridorRequest;
    targetStatus: string;
    notes: string;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [showFiltersDrawer, setShowFiltersDrawer] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New Emergency / Citizen SOS Modal State
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [logVehicleType, setLogVehicleType] = useState<string>("ambulance");
  const [logOrigin, setLogOrigin] = useState<string>("INT-01");
  const [logDestination, setLogDestination] = useState<string>("INT-04");
  const [logPriority, setLogPriority] = useState<string>("critical");
  const [logDescription, setLogDescription] = useState<string>("");
  const [isLoggingEmergency, setIsLoggingEmergency] = useState<boolean>(false);

  // Sharing Modal State
  const [shareData, setShareData] = useState<RouteShareData | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const { activeScenario, simulatedCorridor, updateSimulatedCorridorStatus } = useSimulation();

  // Incorporate isolated in-memory simulated emergency corridor when Scenario A is active
  const effectiveCorridors = React.useMemo(() => {
    if (activeScenario === "ambulance" && simulatedCorridor) {
      return [simulatedCorridor, ...corridors.filter((c) => c.id !== simulatedCorridor.id)];
    }
    return corridors;
  }, [corridors, activeScenario, simulatedCorridor]);

  const total = stats?.total_requests ?? effectiveCorridors.length;
  const active = stats?.active_requests ?? effectiveCorridors.filter((c) => c.status === "ACTIVE").length;
  const approved = stats?.approved_requests ?? effectiveCorridors.filter((c) => c.status === "APPROVED").length;
  const completed = stats?.completed_requests ?? effectiveCorridors.filter((c) => c.status === "COMPLETED").length;
  const sosCount = effectiveCorridors.filter((c) => (c.vehicle_type || "").toLowerCase() === "sos").length;

  const filtered = effectiveCorridors.filter((c) => {
    if (statusFilter !== "all" && (c.status || "").toUpperCase() !== statusFilter.toUpperCase()) {
      return false;
    }
    if (vehicleFilter !== "all" && (c.vehicle_type || "").toLowerCase() !== vehicleFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  const getVehicleBadge = (vType: string) => {
    switch ((vType || "").toLowerCase()) {
      case "sos":
        return {
          label: "SOS Distress Alert",
          icon: ShieldAlert,
          class: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-semibold",
        };
      case "ambulance":
        return {
          label: "Ambulance",
          icon: Siren,
          class: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/25 font-semibold",
        };
      case "fire_brigade":
        return {
          label: "Fire Brigade",
          icon: Flame,
          class: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/25 font-semibold",
        };
      case "police":
        return {
          label: "Police Escort",
          icon: Shield,
          class: "bg-blue-500/10 text-blue-700 dark:text-[#9AC2FA] border-blue-500/25 font-semibold",
        };
      default:
        return {
          label: "Emergency",
          icon: ShieldAlert,
          class: "bg-slate-100 text-slate-700 dark:bg-[#161920] dark:text-[#C5C8D0] border-slate-200 dark:border-white/[0.08]",
        };
    }
  };

  const getStatusBadge = (st: string) => {
    switch ((st || "").toUpperCase()) {
      case "ACTIVE":
        return "bg-[#9AC2FA]/15 text-blue-700 dark:text-[#9AC2FA] border-[#9AC2FA]/30";
      case "APPROVED":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25";
      case "REQUESTED":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25";
      case "COMPLETED":
        return "bg-slate-100 text-slate-700 dark:bg-[#161920] dark:text-[#C5C8D0] border-slate-200 dark:border-white/[0.08]";
      case "REJECTED":
      case "CANCELLED":
        return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-[#161920] dark:text-[#C5C8D0]";
    }
  };

  const handleConfirmAction = async () => {
    if (!actionConfirm) return;
    setIsSubmitting(true);
    try {
      if (actionConfirm.corridor.id.startsWith("EMG-SIM-")) {
        updateSimulatedCorridorStatus(actionConfirm.targetStatus, actionConfirm.notes);
        if (selectedCorridor && selectedCorridor.id === actionConfirm.corridor.id) {
          setSelectedCorridor((prev) =>
            prev ? { ...prev, status: actionConfirm.targetStatus as any } : null
          );
        }
        setActionConfirm(null);
        return;
      }

      await onUpdateStatus(
        actionConfirm.corridor.id,
        actionConfirm.targetStatus,
        actionConfirm.notes
      );
      if (selectedCorridor && selectedCorridor.id === actionConfirm.corridor.id) {
        setSelectedCorridor((prev) =>
          prev ? { ...prev, status: actionConfirm.targetStatus } : null
        );
      }
      setActionConfirm(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to update status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const JUNCTION_NAMES: Record<string, string> = {
    "INT-01": "Connaught Central Circle",
    "INT-02": "Barakhamba Road Crossing",
    "INT-03": "Rajiv Chowk Metro Radial",
    "INT-04": "Ring Road Arterial Junction",
    "INT-05": "Moti Bagh Flyover Split",
    "INT-06": "Dhaula Kuan Interchange",
    "INT-07": "Cyber Hub Gateway",
    "INT-08": "Golf Course Express Radial",
  };

  // Log incoming emergency / SOS request
  const handleLogEmergencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logOrigin || !logDestination || logOrigin === logDestination) {
      alert("Please choose distinct origin and destination intersections.");
      return;
    }
    setIsLoggingEmergency(true);
    try {
      await api.createEmergencyCorridor({
        vehicle_type: logVehicleType,
        origin_id: logOrigin,
        origin_name: JUNCTION_NAMES[logOrigin] || `Junction ${logOrigin}`,
        destination_id: logDestination,
        destination_name: JUNCTION_NAMES[logDestination] || `Junction ${logDestination}`,
        priority: logPriority,
        description: logDescription.trim() || undefined,
      });
      setIsLogModalOpen(false);
      setLogDescription("");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to create emergency corridor request");
    } finally {
      setIsLoggingEmergency(false);
    }
  };

  // Open Route Sharing Modal for Emergency Corridor
  const handleShareCorridorRoute = (corridor: EmergencyCorridorRequest) => {
    const payload: RouteShareData = {
      type: "route",
      originName: corridor.origin_name,
      destinationName: corridor.destination_name,
      originId: corridor.origin_id,
      destinationId: corridor.destination_id,
      routeName: `EMERGENCY GREEN CORRIDOR [${corridor.vehicle_type.toUpperCase()}]`,
      estimatedTimeMinutes: corridor.estimated_time_minutes,
      distanceKm: corridor.distance_km,
      congestionLevel: "PREEMPTED GREEN SIGNAL CORRIDOR",
    };
    setShareData(payload);
    setIsShareModalOpen(true);
  };

  return (
    <div className="space-y-4" data-testid="authority-emergency-operations">
      {/* 4 Emergency Operations KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4]">Total Requests</span>
            <div className="font-serif text-2xl font-medium text-slate-900 dark:text-white mt-1">{total}</div>
            <span className="text-[10px] text-slate-400 dark:text-[#7A8191]">
              {sosCount > 0 ? `${sosCount} SOS Distress` : "All logged"}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-[#161920] border border-blue-200 dark:border-white/[0.08] text-blue-600 dark:text-[#9AC2FA] flex items-center justify-center">
            <Radio className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4]">Active Corridors</span>
            <div className="font-serif text-2xl font-medium text-blue-600 dark:text-[#9AC2FA] mt-1">{active}</div>
            <span className="text-[10px] text-blue-600 dark:text-[#9AC2FA] font-medium">Preemption simulated</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-[#161920] border border-blue-200 dark:border-[#9AC2FA]/25 text-blue-600 dark:text-[#9AC2FA] flex items-center justify-center">
            <Siren className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4]">Approved</span>
            <div className="font-serif text-2xl font-medium text-emerald-600 dark:text-emerald-400 mt-1">{approved}</div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Clearance ready</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-[#161920] border border-emerald-200 dark:border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4]">Completed</span>
            <div className="font-serif text-2xl font-medium text-slate-700 dark:text-[#E5E7EB] mt-1">{completed}</div>
            <span className="text-[10px] text-slate-400 dark:text-[#7A8191]">Safely arrived</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-[#C5C8D0] flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Corridor Requests Queue & Management Table */}
      <div className="bg-white dark:bg-[#111318] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] overflow-hidden">
        {/* Table Header with Filters & Log Request Button */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <h3 className="font-serif text-base font-medium text-slate-900 dark:text-white tracking-[-0.01em]">
              Emergency Assistance & Citizen SOS Queue
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Collapsible Vehicle Filter Toggle */}
            <button
              type="button"
              onClick={() => setShowFiltersDrawer((v) => !v)}
              aria-expanded={showFiltersDrawer}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                showFiltersDrawer || vehicleFilter !== "all"
                  ? "bg-blue-50 dark:bg-[#9AC2FA]/12 text-blue-700 dark:text-[#9AC2FA] border-blue-200 dark:border-[#9AC2FA]/30"
                  : "bg-slate-50 dark:bg-[#161920] text-slate-600 dark:text-[#C5C8D0] border-slate-200 dark:border-white/[0.08]"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{vehicleFilter === "all" ? "Filter Unit" : `Unit: ${vehicleFilter.toUpperCase()}`}</span>
            </button>

            {/* Status Filter Pills */}
            <div className="flex flex-wrap items-center gap-1 text-xs">
              {["all", "ACTIVE", "REQUESTED", "APPROVED", "COMPLETED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    statusFilter === st
                      ? "bg-blue-600 text-white dark:bg-[#9AC2FA] dark:text-[#0A0D14] font-semibold"
                      : "bg-slate-100 dark:bg-[#161920] text-slate-600 dark:text-[#C5C8D0] hover:bg-slate-200 dark:hover:bg-white/[0.06] border border-transparent dark:border-white/[0.06]"
                  }`}
                >
                  {st.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Log Emergency / SOS Call Button */}
            <button
              onClick={() => setIsLogModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
              data-testid="open-log-emergency-btn"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Distress / Corridor</span>
            </button>
          </div>
        </div>

        {/* Collapsible Secondary Unit Type Filter Drawer */}
        {showFiltersDrawer && (
          <div className="px-5 py-3 bg-slate-50/70 dark:bg-[#161920]/70 border-b border-slate-200 dark:border-white/[0.07] flex flex-wrap items-center gap-3 text-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#8C93A4]">
              Responder Type:
            </span>
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#E5E7EB] cursor-pointer"
            >
              <option value="all">All Vehicles & SOS</option>
              <option value="sos">Citizen SOS Distress</option>
              <option value="ambulance">Ambulance</option>
              <option value="fire_brigade">Fire Brigade</option>
              <option value="police">Police Escort</option>
            </select>
          </div>
        )}

        {/* Requests Table */}
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 dark:text-[#8C93A4]">
              No emergency requests matching filter
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#161920] text-[10px] font-semibold uppercase text-slate-500 dark:text-[#8C93A4] border-b border-slate-200 dark:border-white/[0.08]">
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Vehicle & Priority</th>
                  <th className="py-3 px-4">Origin & Destination</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Est. Time / Dist</th>
                  <th className="py-3 px-4 text-right">Triage Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {filtered.map((c) => {
                  const veh = getVehicleBadge(c.vehicle_type);
                  const VehIcon = veh.icon;

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                      onClick={() => setSelectedCorridor(c)}
                      data-testid="emergency-item"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                        <div className="flex flex-col">
                          <span>{c.id}</span>
                          {c.id.startsWith("EMG-SIM-") && (
                            <span className="inline-block mt-0.5 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/25 w-fit">
                              SIMULATED DEMO
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border w-fit ${veh.class}`}>
                            <VehIcon className="w-3 h-3" />
                            <span>{veh.label}</span>
                          </span>
                          <span className="text-[10px] uppercase font-semibold text-rose-600 dark:text-rose-400">
                            {c.priority} Priority
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                          {c.destination_name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-[#8C93A4] line-clamp-1">
                          From: {c.origin_name}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-block font-mono font-semibold uppercase text-[10px] px-2 py-0.5 rounded border ${getStatusBadge(c.status)}`}>
                          {c.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-[11px] text-slate-600 dark:text-[#C5C8D0]">
                        <div className="font-mono font-semibold">{c.estimated_time_minutes} min</div>
                        <div className="text-[10px] text-slate-400 dark:text-[#7A8191]">{c.distance_km} km</div>
                      </td>

                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Share Emergency Route Button */}
                          <button
                            onClick={() => handleShareCorridorRoute(c)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#161920] border border-transparent dark:border-white/[0.08] text-slate-600 dark:text-[#C5C8D0] hover:text-blue-600 dark:hover:text-[#9AC2FA] transition-colors cursor-pointer"
                            title="Share Corridor Route with Emergency Responders"
                            data-testid="share-corridor-btn"
                          >
                            <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
                          </button>

                          <button
                            onClick={() => setSelectedCorridor(c)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#161920] border border-transparent dark:border-white/[0.08] text-slate-600 dark:text-[#C5C8D0] hover:bg-slate-200 dark:hover:bg-white/[0.08] cursor-pointer"
                            title="Inspect Route & Details"
                            data-testid="inspect-corridor-btn"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {c.status === "REQUESTED" && (
                            <>
                              <button
                                onClick={() => setActionConfirm({ corridor: c, targetStatus: "APPROVED", notes: "Approved by municipal traffic dispatcher." })}
                                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                data-testid="approve-corridor-btn"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setActionConfirm({ corridor: c, targetStatus: "REJECTED", notes: "Request rejected due to severe network gridlock." })}
                                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                                data-testid="reject-corridor-btn"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {c.status === "APPROVED" && (
                            <button
                              onClick={() => setActionConfirm({ corridor: c, targetStatus: "ACTIVE", notes: "Activated green corridor signal preemption simulation." })}
                              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-500 dark:bg-[#9AC2FA] dark:hover:bg-[#B0D0FC] text-white dark:text-[#0A0D14] flex items-center gap-1 cursor-pointer"
                              data-testid="activate-sim-btn"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Simulate</span>
                            </button>
                          )}

                          {c.status === "ACTIVE" && (
                            <button
                              onClick={() => setActionConfirm({ corridor: c, targetStatus: "COMPLETED", notes: "Vehicle arrived safely; simulation completed." })}
                              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-violet-600 hover:bg-violet-500 text-white flex items-center gap-1 cursor-pointer"
                              data-testid="stop-sim-btn"
                            >
                              <Square className="w-3 h-3 fill-current" />
                              <span>Complete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL 1: Action Confirmation Modal */}
      {actionConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          onClick={() => setActionConfirm(null)}
          role="dialog"
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
              <h3 className="font-serif font-medium text-base text-slate-900 dark:text-white">
                Confirm Emergency Action: {actionConfirm.targetStatus}
              </h3>
              <button onClick={() => setActionConfirm(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#C5C8D0]">
              Update request <b>{actionConfirm.corridor.id}</b> status to{" "}
              <b className="uppercase text-slate-900 dark:text-white">{actionConfirm.targetStatus}</b>.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4]">Authority Remarks / Notes:</label>
              <textarea
                rows={2}
                value={actionConfirm.notes}
                onChange={(e) => setActionConfirm({ ...actionConfirm, notes: e.target.value })}
                className="w-full p-2.5 text-xs rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1B1D22] text-slate-900 dark:text-[#F5F7FA] focus:outline-none focus:border-[#9AC2FA]/50"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setActionConfirm(null)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/[0.12] text-slate-600 dark:text-[#C5C8D0] hover:bg-slate-100 dark:hover:bg-white/[0.05] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmAction}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 dark:bg-[#9AC2FA] dark:hover:bg-[#B0D0FC] text-white dark:text-[#0A0D14] cursor-pointer"
              >
                {isSubmitting ? "Updating..." : "Confirm Action"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Corridor Details & Route Simulation View with Leaflet Route Map */}
      {selectedCorridor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          onClick={() => setSelectedCorridor(null)}
          role="dialog"
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.1] rounded-2xl p-6 shadow-2xl overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <Siren className="w-5 h-5 text-rose-500" />
                <div>
                  <h3 className="font-serif font-medium text-lg text-slate-900 dark:text-white">
                    Emergency Route Corridor: {selectedCorridor.id}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#8C93A4]">
                    {selectedCorridor.vehicle_type.toUpperCase()} • Priority {selectedCorridor.priority.toUpperCase()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleShareCorridorRoute(selectedCorridor)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 dark:bg-[#9AC2FA] dark:hover:bg-[#B0D0FC] text-white dark:text-[#0A0D14] cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Route</span>
                </button>
                <button onClick={() => setSelectedCorridor(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Embedded Live Map for the Corridor Route */}
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/[0.08]">
              <AuthorityLiveMap
                activeCorridorRoute={selectedCorridor.route_path}
                compact={true}
                zoom={12}
              />
            </div>

            {/* Safety Simulation Disclaimer */}
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-[#161920] border border-blue-200 dark:border-white/[0.08] text-[11px] text-blue-800 dark:text-[#C5C8D0] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-blue-600 dark:text-[#9AC2FA]" />
              <span>Simulated signal preemption recommendation. Real-world traffic signal controllers are not connected.</span>
            </div>

            {/* Route Summary Bar */}
            <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] text-xs">
              <div>
                <span className="text-[10px] text-slate-400 dark:text-[#8C93A4] block">Distance</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">{selectedCorridor.distance_km} km</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 dark:text-[#8C93A4] block">Corridor Transit Time</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{selectedCorridor.estimated_time_minutes} min</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 dark:text-[#8C93A4] block">Priority Intersections</span>
                <span className="font-mono font-semibold text-blue-600 dark:text-[#9AC2FA]">{selectedCorridor.priority_intersections_count} nodes</span>
              </div>
            </div>

            {/* Description */}
            {selectedCorridor.description && (
              <div className="text-xs text-slate-600 dark:text-[#C5C8D0] italic p-3 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.07]">
                "{selectedCorridor.description}"
              </div>
            )}

            {/* Priority Intersections List */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-[#C5C8D0] uppercase tracking-wider">
                Simulated Signal Preemption Actions Along Path
              </h4>
              <div className="space-y-2">
                {selectedCorridor.route_details?.intersections?.map((inter, idx) => (
                  <div
                    key={inter.intersection_id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-blue-600 dark:bg-[#9AC2FA] text-white dark:text-[#0A0D14] font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">{inter.name}</span>
                        <p className="text-[11px] text-slate-500 dark:text-[#8C93A4]">{inter.recommended_action}</p>
                      </div>
                    </div>
                    <span className="font-mono font-semibold text-[10px] uppercase px-2 py-0.5 rounded bg-blue-50 dark:bg-[#9AC2FA]/10 text-blue-700 dark:text-[#9AC2FA] border border-blue-200 dark:border-[#9AC2FA]/25 shrink-0">
                      {inter.simulated_signal_status}
                    </span>
                  </div>
                )) || (
                  <div className="text-xs text-slate-400 dark:text-[#8C93A4] italic font-mono">
                    Route nodes: {selectedCorridor.route_path.join(" ➔ ")}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="pt-3 border-t border-slate-200 dark:border-white/[0.08] flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-[#8C93A4]">Status: <b className="uppercase text-slate-900 dark:text-white">{selectedCorridor.status}</b></span>
              <button
                onClick={() => setSelectedCorridor(null)}
                className="px-4 py-2 font-medium rounded-lg bg-slate-200 dark:bg-white/[0.05] hover:bg-slate-300 dark:hover:bg-white/[0.1] text-slate-700 dark:text-[#EAECEF] border border-transparent dark:border-white/[0.1] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Log Emergency / Citizen SOS Request Modal */}
      {isLogModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          onClick={() => setIsLogModalOpen(false)}
          role="dialog"
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                <h3 className="font-serif font-medium text-base text-slate-900 dark:text-white">
                  Log Emergency Dispatch / Citizen SOS Call
                </h3>
              </div>
              <button onClick={() => setIsLogModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogEmergencySubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4] block mb-1">Request Type</label>
                  <select
                    value={logVehicleType}
                    onChange={(e) => setLogVehicleType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.08] font-medium text-slate-900 dark:text-[#F5F7FA]"
                  >
                    <option value="ambulance">Ambulance (Medical)</option>
                    <option value="fire_brigade">Fire Brigade</option>
                    <option value="police">Police Escort</option>
                    <option value="sos">Citizen SOS Distress</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4] block mb-1">Priority</label>
                  <select
                    value={logPriority}
                    onChange={(e) => setLogPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.08] font-medium text-slate-900 dark:text-[#F5F7FA]"
                  >
                    <option value="critical">Critical (Immediate Preemption)</option>
                    <option value="high">High Priority</option>
                    <option value="medium">Moderate Priority</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4] block mb-1">Origin Junction</label>
                  <select
                    value={logOrigin}
                    onChange={(e) => setLogOrigin(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.08] font-medium text-slate-900 dark:text-[#F5F7FA]"
                  >
                    {["INT-01", "INT-02", "INT-03", "INT-04", "INT-05", "INT-06", "INT-07", "INT-08"].map((id) => (
                      <option key={id} value={id}>
                        {JUNCTION_NAMES[id] || id} [{id}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4] block mb-1">Destination Junction</label>
                  <select
                    value={logDestination}
                    onChange={(e) => setLogDestination(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.08] font-medium text-slate-900 dark:text-[#F5F7FA]"
                  >
                    {["INT-01", "INT-02", "INT-03", "INT-04", "INT-05", "INT-06", "INT-07", "INT-08"].map((id) => (
                      <option key={id} value={id}>
                        {JUNCTION_NAMES[id] || id} [{id}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4] block mb-1">Emergency Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Critical cardiac patient transit / Vehicle trapped in road collapse..."
                  value={logDescription}
                  onChange={(e) => setLogDescription(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-[#F5F7FA] placeholder-slate-400 dark:placeholder-[#7A8191]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-3.5 py-2 font-medium rounded-lg border border-slate-200 dark:border-white/[0.12] text-slate-600 dark:text-[#C5C8D0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoggingEmergency}
                  className="px-4 py-2 font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                >
                  {isLoggingEmergency ? "Logging..." : "Create Emergency Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Modal for Emergency Route */}
      {shareData && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          data={shareData}
        />
      )}
    </div>
  );
};

import React from "react";
import {
  Siren,
  CloudRain,
  AlertTriangle,
  Play,
  Pause,
  CheckCircle2,
  RotateCcw,
  X,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  MapPin,
  Clock,
  Navigation,
  Compass,
  Sparkles,
} from "lucide-react";
import { useSimulation } from "../../context/SimulationContext";

interface AuthorityScenarioSimulatorModalProps {
  onNavigateToLiveMap?: () => void;
  onNavigateToEmergency?: () => void;
}

export const AuthorityScenarioSimulatorModal: React.FC<AuthorityScenarioSimulatorModalProps> = ({
  onNavigateToLiveMap,
  onNavigateToEmergency,
}) => {
  const {
    activeScenario,
    scenarioStatus,
    isSimulatorModalOpen,
    closeSimulatorModal,
    startAmbulanceScenario,
    startWaterloggingScenario,
    pauseScenario,
    resumeScenario,
    completeScenario,
    resetScenario,
    simulatedCorridor,
    simulatedIncident,
  } = useSimulation();

  if (!isSimulatorModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      data-testid="authority-simulator-modal"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#111318] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/70 dark:bg-[#161920]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-[#9AC2FA]/10 text-blue-600 dark:text-[#9AC2FA] border border-blue-500/20 dark:border-[#9AC2FA]/25 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-serif font-medium text-slate-900 dark:text-white">
                  Demo Scenario Simulator
                </h3>
                <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-[#9AC2FA]/15 dark:text-[#9AC2FA] border border-blue-300 dark:border-[#9AC2FA]/30">
                  Authority Only
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#8E939E] mt-0.5">
                Trigger controlled smart-city traffic scenarios for hackathon evaluation and demonstrations.
              </p>
            </div>
          </div>
          <button
            onClick={closeSimulatorModal}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1B1D22] transition-colors cursor-pointer"
            data-testid="close-simulator-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Mandatory Simulation Warning Notice */}
          <div
            className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3"
            data-testid="simulator-warning-notice"
          >
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold uppercase tracking-wider text-[11px] block">
                SIMULATION MODE NOTICE
              </span>
              <p className="text-[11px] leading-relaxed mt-0.5 opacity-90">
                All generated incidents, traffic changes, and emergency activities are simulated. No real emergency services or traffic signals are controlled.
              </p>
            </div>
          </div>

          {/* Active Scenario Control Strip (if running/paused/completed) */}
          {activeScenario !== "none" && (
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-[#161920] border border-slate-300 dark:border-white/[0.10] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-bold text-slate-900 dark:text-white text-xs">
                    Active Scenario:{" "}
                    <span className="capitalize text-blue-600 dark:text-[#9AC2FA]">
                      {activeScenario === "ambulance" ? "Ambulance Emergency" : "Waterlogging Incident"}
                    </span>
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono uppercase font-extrabold px-2 py-0.5 rounded-full ${
                    scenarioStatus === "running"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-400"
                      : scenarioStatus === "paused"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-400"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-400"
                  }`}
                  data-testid="active-scenario-status-pill"
                >
                  Status: {scenarioStatus}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {scenarioStatus === "running" ? (
                  <button
                    onClick={pauseScenario}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-xs cursor-pointer transition-colors"
                    data-testid="simulator-pause-btn"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </button>
                ) : scenarioStatus === "paused" ? (
                  <button
                    onClick={resumeScenario}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs cursor-pointer transition-colors"
                    data-testid="simulator-resume-btn"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume</span>
                  </button>
                ) : null}

                {scenarioStatus !== "completed" && (
                  <button
                    onClick={completeScenario}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-xs cursor-pointer transition-colors"
                    data-testid="simulator-complete-btn"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Complete Scenario</span>
                  </button>
                )}

                <button
                  onClick={resetScenario}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-rose-600 hover:text-white text-slate-800 dark:text-slate-200 font-semibold text-xs shadow-xs cursor-pointer transition-colors"
                  data-testid="simulator-reset-btn"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Demo</span>
                </button>

                {onNavigateToLiveMap && (
                  <button
                    onClick={() => {
                      closeSimulatorModal();
                      onNavigateToLiveMap();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-blue-600 dark:text-cyan-400 font-semibold text-xs hover:bg-slate-300 cursor-pointer ml-auto"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>View on Live Map</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 2 Scenario Execution Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SCENARIO A: AMBULANCE EMERGENCY */}
            <div
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                activeScenario === "ambulance"
                  ? "bg-rose-50/50 dark:bg-rose-950/30 border-rose-400/70 ring-1 ring-rose-500/20"
                  : "bg-white dark:bg-[#161920] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16]"
              }`}
              data-testid="scenario-card-ambulance"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <Siren className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-500/20">
                    Scenario A
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-serif font-semibold text-slate-900 dark:text-white">
                    Ambulance Emergency Scenario
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-[#8C93A4] mt-1 leading-relaxed">
                    Simulate Level-1 cardiac ambulance transit with preemptive green corridor signal override from Dhaula Kuan to AIIMS Trauma Center.
                  </p>
                </div>

                {/* Scenario Highlights */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1B1D22] border border-slate-100 dark:border-white/[0.08] space-y-1.5 text-[10px] font-mono">
                  <div className="flex justify-between text-slate-600 dark:text-[#C5C8D0]">
                    <span>Route:</span>
                    <span className="font-bold text-slate-900 dark:text-white">INT-06 ➔ INT-05 ➔ INT-04</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-[#C5C8D0]">
                    <span>Distance:</span>
                    <span>7.8 km (3 Intersections)</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>Preempted Travel Time:</span>
                    <span>9.8 min (was 26.5m) • -63%</span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={startAmbulanceScenario}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer ${
                    activeScenario === "ambulance"
                      ? "bg-rose-700 text-white shadow-rose-700/30"
                      : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30"
                  }`}
                  data-testid="run-ambulance-scenario-btn"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>
                    {activeScenario === "ambulance"
                      ? "Ambulance Scenario Active"
                      : "Run Ambulance Emergency Scenario"}
                  </span>
                </button>
              </div>
            </div>

            {/* SCENARIO B: WATERLOGGING INCIDENT */}
            <div
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                activeScenario === "waterlogging"
                  ? "bg-amber-50/50 dark:bg-amber-950/25 border-amber-400 dark:border-amber-500/45 ring-2 ring-amber-500/20"
                  : "bg-white dark:bg-[#161920] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15]"
              }`}
              data-testid="scenario-card-waterlogging"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <CloudRain className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-transparent dark:border-amber-500/25">
                    Scenario B
                  </span>
                </div>

                <div>
                  <h4 className="font-serif text-base font-medium text-slate-900 dark:text-white">
                    Waterlogging Incident Scenario
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-[#8E939E] mt-1 leading-relaxed">
                    Simulate severe monsoon waterlogging at Moti Bagh Flyover with real-time queue detection and automated alternate Smart Route recommendation.
                  </p>
                </div>

                {/* Scenario Highlights */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#111318] border border-slate-100 dark:border-white/[0.06] space-y-1.5 text-[10px] font-mono">
                  <div className="flex justify-between text-slate-600 dark:text-[#C5C8D0]">
                    <span>Location:</span>
                    <span className="font-bold text-slate-900 dark:text-white">Moti Bagh Underpass (INT-05)</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-[#C5C8D0]">
                    <span>Severity:</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">48cm deep • Flow -65%</span>
                  </div>
                  <div className="flex justify-between text-blue-600 dark:text-[#9AC2FA] font-bold">
                    <span>Automated Alternate:</span>
                    <span>Outer Ring Road (-17.7m saved)</span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={startWaterloggingScenario}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer ${
                    activeScenario === "waterlogging"
                      ? "bg-amber-700 text-white shadow-amber-700/30"
                      : "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30"
                  }`}
                  data-testid="run-waterlogging-scenario-btn"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>
                    {activeScenario === "waterlogging"
                      ? "Waterlogging Scenario Active"
                      : "Run Waterlogging Incident Scenario"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#0D0F14] flex items-center justify-between text-[11px] text-slate-500 dark:text-[#8C93A4]">
          <span>Simulation memory is isolated from genuine citizen data.</span>
          <button
            onClick={closeSimulatorModal}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-[#1B1D22] text-slate-800 dark:text-[#E8EAEE] border border-transparent dark:border-white/[0.10] font-semibold hover:bg-slate-300 dark:hover:bg-[#232730] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

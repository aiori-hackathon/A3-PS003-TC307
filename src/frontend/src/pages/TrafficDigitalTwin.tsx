import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../services/api";
import {
  Network,
  Play,
  RotateCcw,
  Sun,
  Moon,
  Flame,
  AlertTriangle,
  Radio,
  WifiOff,
  CheckCircle2,
  Info,
  Activity,
  Layers,
} from "lucide-react";

export const TrafficDigitalTwin: React.FC = () => {
  const { t } = useTranslation();
  const { isHindi } = useLanguage();

  const [selectedScenario, setSelectedScenario] = useState<string>("increased_volume");
  const [volMultiplier, setVolMultiplier] = useState<number>(1.35);
  const [targetNode, setTargetNode] = useState<string>("INT-04");
  const [rainfallMm, setRainfallMm] = useState<number>(45.0);
  const [crowdSize, setCrowdSize] = useState<number>(30000);

  const [loading, setLoading] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<any>(null);

  const scenarios = [
    {
      id: "increased_volume",
      icon: Flame,
      title: isHindi ? "ट्रैफिक वॉल्यूम वृद्धि" : "Increased Traffic Volume",
      desc: isHindi ? "समस्त नगरपालिका गलियारों में वॉल्यूम वृद्धि और गति ह्रास का विश्लेषण।" : "Simulate city-wide surge across all arterial corridors.",
    },
    {
      id: "road_closure",
      icon: AlertTriangle,
      title: isHindi ? "गलियारा सड़क बंदी" : "Corridor Road Closure",
      desc: isHindi ? "विशिष्ट गलियारे को बंद करके पड़ोसी नोड्स पर डायवर्जन का परीक्षण।" : "Close a key intersection and observe neighbor rerouting.",
    },
    {
      id: "heavy_rainfall",
      icon: Activity,
      title: isHindi ? "भारी मानसूनी बारिश" : "Heavy Rainfall & Friction Drop",
      desc: isHindi ? "सड़क घर्षण घटने और गति में व्यापक कमी का सिमुलेशन।" : "Evaluate network resilience during surface water accumulation.",
    },
    {
      id: "major_event",
      icon: Layers,
      title: isHindi ? "विशाल जनसमूह / आयोजन" : "Major Public Event Gathering",
      desc: isHindi ? "स्टेडियम या स्थल के पास अत्यधिक भीड़ और कतार फैलाव।" : "Localized high-density vehicle surge around venue node.",
    },
  ];

  const handleApplyScenario = async (scenarioId: string = selectedScenario) => {
    setSelectedScenario(scenarioId);
    setLoading(true);
    try {
      const res = await api.simulateScenario({
        scenario: scenarioId,
        volume_multiplier: volMultiplier,
        target_intersection_id: targetNode,
        rainfall_intensity_mm: rainfallMm,
        event_crowd_size: crowdSize,
      });
      setSimResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t("digital_twin.title")}
          </h1>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Delhi NCR Network Twin
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t("digital_twin.subtitle")}
        </p>
      </div>

      {/* 4 Focused Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {scenarios.map((sc) => {
          const Icon = sc.icon;
          const isSelected = selectedScenario === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => setSelectedScenario(sc.id)}
              className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                isSelected
                  ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 shadow-md ring-2 ring-blue-500/20"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    {sc.title}
                  </h4>
                  <span className="text-[10px] text-slate-400">Software Scenario</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                {sc.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Scenario Parameter Sliders & Action Panel */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
          {isHindi ? "सिमुलेशन पैरामीटर विन्यास" : "Configure Simulation Parameters"}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {selectedScenario === "increased_volume" && (
            <div className="space-y-2 md:col-span-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {isHindi ? "वॉल्यूम मल्टीप्लायर:" : "Volume Multiplier:"}
                </span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {volMultiplier.toFixed(2)}x (+{Math.round((volMultiplier - 1.0) * 100)}%)
                </span>
              </div>
              <input
                type="range"
                min="1.05"
                max="2.0"
                step="0.05"
                value={volMultiplier}
                onChange={(e) => setVolMultiplier(parseFloat(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block">
                Range: 1.05x to 2.0x volume increase across arterial network.
              </span>
            </div>
          )}

          {selectedScenario === "road_closure" && (
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                {isHindi ? "बंद किया जाने वाला जंक्शन:" : "Target Closed Intersection:"}
              </label>
              <select
                value={targetNode}
                onChange={(e) => setTargetNode(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="INT-04">INT-04 (Ring Road Arterial Junction)</option>
                <option value="INT-02">INT-02 (Barakhamba Road Crossing)</option>
                <option value="INT-06">INT-06 (Dhaula Kuan Interchange)</option>
                <option value="INT-07">INT-07 (Cyber Hub Gateway)</option>
              </select>
              <span className="text-[10px] text-slate-400 block">
                Traffic on this corridor drops to 0; traffic diverts to adjacent graph neighbors.
              </span>
            </div>
          )}

          {selectedScenario === "heavy_rainfall" && (
            <div className="space-y-2 md:col-span-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {isHindi ? "वर्षा तीव्रता (मिमी/घंटा):" : "Rainfall Intensity (mm/h):"}
                </span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {rainfallMm} mm/h
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={rainfallMm}
                onChange={(e) => setRainfallMm(parseFloat(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block">
                Heavy precipitation reduces pavement friction and reduces vehicular speeds.
              </span>
            </div>
          )}

          {selectedScenario === "major_event" && (
            <div className="space-y-2 md:col-span-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {isHindi ? "अनुमानित दर्शक संख्या:" : "Estimated Gathering Attendance:"}
                </span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {crowdSize.toLocaleString()} attendees
                </span>
              </div>
              <input
                type="range"
                min="10000"
                max="80000"
                step="5000"
                value={crowdSize}
                onChange={(e) => setCrowdSize(parseInt(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block">
                High localized density around Connaught Place / Stadium radial.
              </span>
            </div>
          )}

          <div className="flex items-end">
            <button
              onClick={() => handleApplyScenario(selectedScenario)}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{loading ? "Simulating..." : isHindi ? "सिमुलेशन चलाएं" : "Run Simulation"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Simulation Feedback Alert */}
      {simResult && (
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
          <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-sm block">
              {t("digital_twin.simulation_impact")}
            </span>
            <p className="leading-relaxed">
              {isHindi ? simResult.message_hi : simResult.message_en}
            </p>
            {simResult.affected_nodes?.length > 0 && (
              <p className="text-[11px] text-blue-600 dark:text-blue-400 font-mono mt-1">
                Affected nodes: {simResult.affected_nodes.join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Baseline vs. Simulated Comparative KPI Row */}
      {simResult?.baseline_metrics && simResult?.simulated_metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs text-slate-500 uppercase font-semibold">Average Network Speed</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {simResult.simulated_metrics.average_network_speed} km/h
              </span>
              <span className="text-xs text-slate-400">
                (Baseline: {simResult.baseline_metrics.average_network_speed} km/h)
              </span>
            </div>
            <span className={`text-[10px] font-semibold mt-1 inline-block ${
              simResult.simulated_metrics.average_network_speed < simResult.baseline_metrics.average_network_speed
                ? "text-red-500"
                : "text-emerald-500"
            }`}>
              {simResult.simulated_metrics.average_network_speed < simResult.baseline_metrics.average_network_speed
                ? `↓ Speed reduced by ${Math.round((1 - simResult.simulated_metrics.average_network_speed / simResult.baseline_metrics.average_network_speed) * 100)}%`
                : "Baseline maintained"}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs text-slate-500 uppercase font-semibold">Total Network Volume</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {simResult.simulated_metrics.total_network_volume} vph
              </span>
              <span className="text-xs text-slate-400">
                (Baseline: {simResult.baseline_metrics.total_network_volume})
              </span>
            </div>
            <span className="text-[10px] text-blue-500 font-semibold mt-1 inline-block">
              Across all 8 monitored arterial intersections
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs text-slate-500 uppercase font-semibold">Congested Intersections</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                {simResult.simulated_metrics.congested_intersections} / 8
              </span>
              <span className="text-xs text-slate-400">
                (Baseline: {simResult.baseline_metrics.congested_intersections})
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 inline-block">
              Threshold: &gt;75% volume/capacity ratio
            </span>
          </div>
        </div>
      )}

      {/* Comparative Impact Table */}
      {simResult?.node_comparisons && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            {isHindi ? "नोड-वार बेसलाइन बनाम सिमुलेटेड प्रभाव तुलना" : "Node-Level Baseline vs. Simulated Impact Matrix"}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2">Intersection</th>
                  <th className="px-3 py-2">Baseline Volume</th>
                  <th className="px-3 py-2">Simulated Volume</th>
                  <th className="px-3 py-2">Baseline Speed</th>
                  <th className="px-3 py-2">Simulated Speed</th>
                  <th className="px-3 py-2">Congestion State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {simResult.node_comparisons.map((node: any) => (
                  <tr key={node.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">
                      {node.name} <span className="font-mono text-slate-400 text-[10px]">({node.id})</span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{node.baseline_volume} veh</td>
                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-slate-100">
                      {node.simulated_volume} veh
                    </td>
                    <td className="px-3 py-2 text-slate-500">{node.baseline_speed} km/h</td>
                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-slate-100">
                      {node.simulated_speed} km/h
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        node.congestion_level === "severe"
                          ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                          : node.congestion_level === "moderate"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      }`}>
                        {node.congestion_level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Advisory Notice Banner */}
      <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
        <span>⚠️ Software scenario simulator. Calculations derived from deterministic traffic models and road topology.</span>
        <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0 ml-2">Smart City Modeling</span>
      </div>
    </div>
  );
};

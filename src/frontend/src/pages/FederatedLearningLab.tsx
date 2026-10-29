import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../services/api";
import {
  ClientStatus,
  FederatedRoundResponse,
  BenchmarkCompareResponse,
  TrafficDatasetInfo,
} from "../types";
import {
  Cpu,
  Server,
  Play,
  RotateCcw,
  CheckCircle2,
  TrendingDown,
  Layers,
  ArrowDown,
  ArrowRight,
  Database,
  Radio,
  ShieldCheck,
  Zap,
  Scale,
  Sliders,
  AlertCircle,
  Info,
  Award,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export const FederatedLearningLab: React.FC = () => {
  const { t } = useTranslation();
  const { isHindi } = useLanguage();

  const [clients, setClients] = useState<ClientStatus[]>([]);
  const [currentRound, setCurrentRound] = useState<number>(6);
  const [lossHistory, setLossHistory] = useState<any[]>([]);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [mode, setMode] = useState<"federated" | "centralized">("federated");
  const [lastRoundResult, setLastRoundResult] = useState<FederatedRoundResponse | null>(null);

  // PS-003 Unified Head-to-Head Benchmark States
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkCompareResponse | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);
  const [benchmarkDataset, setBenchmarkDataset] = useState<"synthetic" | "pems08" | "live">("synthetic");
  const [benchmarkHorizon, setBenchmarkHorizon] = useState<number>(30);
  const [benchmarkRounds, setBenchmarkRounds] = useState<number>(3);
  const [benchmarkCompression, setBenchmarkCompression] = useState<boolean>(true);
  const [benchmarkTopK, setBenchmarkTopK] = useState<number>(50);
  const [benchmarkInt8, setBenchmarkInt8] = useState<boolean>(true);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<TrafficDatasetInfo[]>([]);

  const fetchStatus = async () => {
    try {
      const clientData = await api.getFLClients();
      setClients(clientData);
      const statusData = await api.getFLStatus();
      setCurrentRound(statusData.current_round);
      setLossHistory(
        statusData.rounds_history.map((r) => ({
          round: `R${r.round}`,
          loss: r.loss,
          mae: r.mae,
          rmse: r.rmse,
        }))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const loadDatasets = async () => {
    try {
      const dsList = await api.getTrafficDatasets();
      setDatasets(dsList);
    } catch (err) {
      console.error("Failed loading datasets:", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    loadDatasets();
    // Pre-run an initial benchmark demonstration if not yet executed
    handleRunBenchmark(false);
  }, []);

  const handleRunRound = async () => {
    if (isTraining) return;
    setIsTraining(true);
    setActiveStep(1);

    try {
      await new Promise((res) => setTimeout(res, 600));
      setActiveStep(2);

      await new Promise((res) => setTimeout(res, 600));
      setActiveStep(3);

      const res = await api.startFLRound({
        aggregation_method: "FedAvg",
        apply_compression: true,
        top_k_retention_pct: 50.0,
        int8_quantization: true,
      });
      setLastRoundResult(res);

      await new Promise((res) => setTimeout(res, 500));
      setActiveStep(4);

      await fetchStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setIsTraining(false);
    }
  };

  const handleRunBenchmark = async (manualClick = true) => {
    if (isBenchmarking) return;
    setIsBenchmarking(true);
    setBenchmarkError(null);

    try {
      const res = await api.runBenchmarkCompare({
        dataset_type: benchmarkDataset,
        target_horizon_minutes: benchmarkHorizon,
        federated_rounds: benchmarkRounds,
        apply_compression: benchmarkCompression,
        top_k_retention_pct: benchmarkTopK,
        int8_quantization: benchmarkInt8,
      });
      setBenchmarkResult(res);
      await fetchStatus();
    } catch (err: any) {
      console.error("Benchmark failed:", err);
      if (manualClick) {
        setBenchmarkError(
          err.message || "Failed to execute head-to-head benchmark. Verify backend connection."
        );
      }
    } finally {
      setIsBenchmarking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
              PS-003 Standard Compliance
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            {t("federated.title")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("federated.subtitle")}
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs self-start sm:self-auto">
          <button
            onClick={() => setMode("federated")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              mode === "federated"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-blue-500"
            }`}
          >
            Federated Learning (FedAvg)
          </button>
          <button
            onClick={() => setMode("centralized")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              mode === "centralized"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-blue-500"
            }`}
          >
            {isHindi ? "केंद्रीकृत आधार रेखा (Centralized)" : "Centralized Baseline"}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: PS-003 UNIFIED HEAD-TO-HEAD BENCHMARK (CENTRALIZED VS FEDERATED) */}
      {/* ========================================================================= */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-navy-950 to-slate-900 border border-blue-900/40 text-white shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                {isHindi
                  ? "PS-003: केंद्रीकृत बनाम फेडरेटेड तुलनात्मक बेंचमार्क"
                  : "PS-003 Unified Benchmark: Centralized vs. Federated Learning"}
              </h2>
            </div>
            <p className="text-xs text-slate-300">
              {isHindi
                ? "सटीकता और संचार लागत का प्रत्यक्ष अनुभवजन्य मूल्यांकन (समान कालानुक्रमिक डेटा विभाजन पर)"
                : "Empirical evaluation of prediction accuracy vs. communication bandwidth on identical chronological holdout data."}
            </p>
          </div>

          <button
            onClick={() => handleRunBenchmark(true)}
            disabled={isBenchmarking}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50 shrink-0 self-start md:self-auto cursor-pointer"
          >
            <Play className={`w-4 h-4 ${isBenchmarking ? "animate-spin" : ""}`} />
            <span>
              {isBenchmarking
                ? isHindi
                  ? "बेंचमार्क चल रहा है..."
                  : "Running Dual Benchmark..."
                : isHindi
                ? "तुलनात्मक बेंचमार्क चलाएं"
                : "Run Comparison Benchmark"}
            </span>
          </button>
        </div>

        {/* Benchmark Parameter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs">
          {/* Dataset Selector */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block text-[11px]">
              {isHindi ? "डेटासेट स्रोत:" : "Evaluation Dataset:"}
            </label>
            <select
              value={benchmarkDataset}
              onChange={(e) => setBenchmarkDataset(e.target.value as any)}
              disabled={isBenchmarking}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-medium focus:ring-1 focus:ring-amber-400 focus:outline-none"
            >
              <option value="synthetic">Delhi NCR Diurnal Model (8 Nodes)</option>
              <option value="pems08">PeMS-08-inspired Synthetic Calibration Fixture</option>
              <option value="live">TomTom Real-Time Telemetry Feed</option>
            </select>
          </div>

          {/* Target Horizon */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block text-[11px]">
              {isHindi ? "पूर्वानुमान क्षितिज:" : "Prediction Target Horizon:"}
            </label>
            <select
              value={benchmarkHorizon}
              onChange={(e) => setBenchmarkHorizon(Number(e.target.value))}
              disabled={isBenchmarking}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-medium focus:ring-1 focus:ring-amber-400 focus:outline-none"
            >
              <option value={15}>15 Minutes Ahead (v_t+1)</option>
              <option value={30}>30 Minutes Ahead (v_t+2)</option>
              <option value={60}>60 Minutes Ahead (v_t+4)</option>
            </select>
          </div>

          {/* Federated Rounds */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block text-[11px]">
              {isHindi ? "फेडरेटेड राउंड्स:" : "FedAvg Sync Rounds:"}
            </label>
            <select
              value={benchmarkRounds}
              onChange={(e) => setBenchmarkRounds(Number(e.target.value))}
              disabled={isBenchmarking}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-medium focus:ring-1 focus:ring-amber-400 focus:outline-none"
            >
              <option value={1}>1 Round (Single aggregation)</option>
              <option value={3}>3 Rounds (Standard convergence)</option>
              <option value={5}>5 Rounds (Multi-cycle sync)</option>
            </select>
          </div>

          {/* Compression Toggle */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block text-[11px]">
              {isHindi ? "अपडेट संपीड़न (Compression):" : "Update Compression:"}
            </label>
            <button
              type="button"
              onClick={() => setBenchmarkCompression(!benchmarkCompression)}
              disabled={isBenchmarking}
              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-colors ${
                benchmarkCompression
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
            >
              <span>{benchmarkCompression ? "Top-K 50% + INT8 (Active)" : "None (Raw FP32 Tensors)"}</span>
              <span className={`w-2 h-2 rounded-full ${benchmarkCompression ? "bg-amber-400" : "bg-slate-600"}`} />
            </button>
          </div>
        </div>

        {benchmarkError && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{benchmarkError}</span>
          </div>
        )}

        {/* Benchmark Results Display */}
        {benchmarkResult && (
          <div className="space-y-5 pt-1">
            {/* 3 Core Comparison Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Prediction Accuracy (MAE) */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                  <span>Prediction Error (Test MAE)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    Held-out 20%
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">Centralized</span>
                    <span className="text-xl font-bold font-mono text-rose-300">
                      {benchmarkResult.centralized.mae}
                    </span>
                  </div>
                  <div className="text-center font-bold text-slate-500 text-xs">vs</div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">Federated</span>
                    <span className="text-xl font-bold font-mono text-blue-300">
                      {benchmarkResult.federated.mae}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Accuracy Trade-off:</span>
                  <span
                    className={`font-semibold font-mono ${
                      benchmarkResult.delta.mae_delta <= 1.0
                        ? "text-emerald-400"
                        : "text-amber-400"
                    }`}
                  >
                    {benchmarkResult.delta.mae_delta > 0 ? "+" : ""}
                    {benchmarkResult.delta.mae_delta} ({benchmarkResult.delta.mae_delta_pct > 0 ? "+" : ""}
                    {benchmarkResult.delta.mae_delta_pct}%)
                  </span>
                </div>
              </div>

              {/* Card 2: Root Mean Squared Error (RMSE) */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                  <span>Dispersion (Test RMSE)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    veh/15m
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">Centralized</span>
                    <span className="text-xl font-bold font-mono text-rose-300">
                      {benchmarkResult.centralized.rmse}
                    </span>
                  </div>
                  <div className="text-center font-bold text-slate-500 text-xs">vs</div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">Federated</span>
                    <span className="text-xl font-bold font-mono text-blue-300">
                      {benchmarkResult.federated.rmse}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Dispersion Delta:</span>
                  <span className="font-semibold font-mono text-slate-300">
                    {benchmarkResult.delta.rmse_delta > 0 ? "+" : ""}
                    {benchmarkResult.delta.rmse_delta} ({benchmarkResult.delta.rmse_delta_pct > 0 ? "+" : ""}
                    {benchmarkResult.delta.rmse_delta_pct}%)
                  </span>
                </div>
              </div>

              {/* Card 3: Bandwidth Transmitted & Savings */}
              <div className="p-4 rounded-xl bg-white/5 border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                  <span>Communication Bandwidth</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold uppercase">
                    PS-003 Core
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">Centralized</span>
                    <span className="text-base font-bold font-mono text-rose-300">
                      {benchmarkResult.centralized.data_transmitted_formatted}
                    </span>
                  </div>
                  <div className="text-center font-bold text-slate-500 text-xs">vs</div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">Federated</span>
                    <span className="text-base font-bold font-mono text-emerald-300">
                      {benchmarkResult.federated.data_transmitted_formatted}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Bandwidth Savings:</span>
                  <span className="font-bold font-mono text-emerald-400">
                    {benchmarkResult.delta.bandwidth_savings_pct}% ({benchmarkResult.delta.communication_reduction_factor}x Reduction)
                  </span>
                </div>
              </div>
            </div>

            {/* Comprehensive Architectural Benchmark Table */}
            <div className="overflow-x-auto no-scrollbar rounded-xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-white/5 text-slate-400 border-b border-white/10">
                    <th className="py-2.5 px-3 uppercase text-[10px] font-semibold">Evaluation Dimension</th>
                    <th className="py-2.5 px-3 uppercase text-[10px] font-semibold text-rose-300">Centralized Learning (Baseline)</th>
                    <th className="py-2.5 px-3 uppercase text-[10px] font-semibold text-blue-300">Federated Learning (FedAvg)</th>
                    <th className="py-2.5 px-3 uppercase text-[10px] font-semibold text-emerald-300">Evaluated Impact / Trade-off</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">Learning Paradigm</td>
                    <td className="py-2.5 px-3 text-rose-300">{benchmarkResult.centralized.training_paradigm}</td>
                    <td className="py-2.5 px-3 text-blue-300">{benchmarkResult.federated.training_paradigm}</td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-400">Decentralized Data Locality</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">Data Locality & Exposure Model</td>
                    <td className="py-2.5 px-3 text-rose-300">{benchmarkResult.centralized.privacy_guarantee}</td>
                    <td className="py-2.5 px-3 text-emerald-300 font-semibold">{benchmarkResult.federated.privacy_guarantee}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">Local Partitioning Only (No DP / No SecAgg)</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">Prediction Error (MAE)</td>
                    <td className="py-2.5 px-3 font-mono text-rose-300">{benchmarkResult.centralized.mae} veh/15m</td>
                    <td className="py-2.5 px-3 font-mono text-blue-300">{benchmarkResult.federated.mae} veh/15m</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">Δ {benchmarkResult.delta.mae_delta > 0 ? "+" : ""}{benchmarkResult.delta.mae_delta} ({benchmarkResult.delta.mae_delta_pct > 0 ? "+" : ""}{benchmarkResult.delta.mae_delta_pct}%)</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">Dispersion (RMSE)</td>
                    <td className="py-2.5 px-3 font-mono text-rose-300">{benchmarkResult.centralized.rmse} veh/15m</td>
                    <td className="py-2.5 px-3 font-mono text-blue-300">{benchmarkResult.federated.rmse} veh/15m</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">Δ {benchmarkResult.delta.rmse_delta > 0 ? "+" : ""}{benchmarkResult.delta.rmse_delta} ({benchmarkResult.delta.rmse_delta_pct > 0 ? "+" : ""}{benchmarkResult.delta.rmse_delta_pct}%)</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">Data Transmitted (Total)</td>
                    <td className="py-2.5 px-3 font-mono text-rose-300">{benchmarkResult.centralized.data_transmitted_formatted}</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-300 font-bold">{benchmarkResult.federated.data_transmitted_formatted}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">-{benchmarkResult.delta.bandwidth_savings_pct}% Bandwidth Saved</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">Upload / Download Breakdown</td>
                    <td className="py-2.5 px-3 text-slate-400">Upload: {benchmarkResult.centralized.data_transmitted_formatted} | Down: 0 B</td>
                    <td className="py-2.5 px-3 text-slate-300">Upload: {(benchmarkResult.federated.upload_bytes / 1024).toFixed(1)} KB | Down: {(benchmarkResult.federated.download_bytes / 1024).toFixed(1)} KB</td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {benchmarkResult.federated.upload_bytes === benchmarkResult.federated.download_bytes
                        ? "Symmetric Parameter Exch."
                        : "Asymmetric (64B Up / 76B Down)"}
                    </td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">Training / Test Sample Split</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{benchmarkResult.centralized.train_samples_count} train / {benchmarkResult.centralized.test_samples_count} test</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{benchmarkResult.federated.train_samples_count} train / {benchmarkResult.federated.test_samples_count} test</td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-400">Identical 80/20 Holdout Split</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">Participating Nodes</td>
                    <td className="py-2.5 px-3 text-slate-300">Central cloud server ingests 8 nodes</td>
                    <td className="py-2.5 px-3 text-slate-300">{benchmarkResult.federated.participating_clients} Edge Clients (CBD, Arterial, Tech)</td>
                    <td className="py-2.5 px-3 text-slate-400">Local non-IID partitions</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Side-by-Side Visual Comparison Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">
                  Prediction Error Comparison (Lower is Better)
                </span>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          metric: "MAE",
                          Centralized: benchmarkResult.centralized.mae,
                          Federated: benchmarkResult.federated.mae,
                        },
                        {
                          metric: "RMSE",
                          Centralized: benchmarkResult.centralized.rmse,
                          Federated: benchmarkResult.federated.rmse,
                        },
                      ]}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="metric" stroke="#94A3B8" fontSize={11} />
                      <YAxis stroke="#94A3B8" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0F172A",
                          borderColor: "#334155",
                          borderRadius: "0.5rem",
                          color: "#F8FAFC",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="Centralized" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Federated" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">
                  Communication Data Transfer (KB, Lower is Better)
                </span>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          name: "Data Transfer",
                          Centralized_KB: Math.round(benchmarkResult.centralized.data_transmitted_bytes / 1024),
                          Federated_KB: Math.round(benchmarkResult.federated.data_transmitted_bytes / 1024),
                        },
                      ]}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                      <YAxis stroke="#94A3B8" fontSize={11} unit=" KB" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0F172A",
                          borderColor: "#334155",
                          borderRadius: "0.5rem",
                          color: "#F8FAFC",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="Centralized_KB" name="Centralized Raw Data (KB)" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Federated_KB" name="Federated Model Updates (KB)" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Methodology & Limitations Footnote */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-400 space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span>Methodology, Assumptions & Data Provenance:</span>
              </div>
              <p className="leading-relaxed">
                {benchmarkResult.delta.accuracy_tradeoff_summary}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-slate-500 text-[10px]">
                <span><b>Dataset:</b> {benchmarkResult.dataset_name}</span>
                <span>•</span>
                <span><b>Provenance:</b> {benchmarkResult.dataset_provenance}</span>
                <span>•</span>
                <span><b>ID:</b> {benchmarkResult.benchmark_id}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: FEDERATED ROUND WORKFLOW PROGRESS & TOPOLOGY */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              {isHindi ? `फेडरेटेड राउंड ${currentRound} स्थिति` : `Federated Round ${currentRound} Status`}
            </h3>
            <p className="text-xs text-slate-500">
              {isHindi ? "सैंपल-वेटेड FedAvg एकत्रीकरण एल्गोरिथ्म" : "Sample-count-weighted FedAvg aggregation algorithm"}
            </p>
          </div>
          <button
            onClick={handleRunRound}
            disabled={isTraining}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <Play className={`w-4 h-4 ${isTraining ? "animate-spin" : ""}`} />
            <span>{isTraining ? t("federated.training_in_progress") : t("federated.run_round_btn")}</span>
          </button>
        </div>

        {/* 4 Steps Horizontal (Desktop) / Vertical (Mobile) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {[
            { step: 1, title: t("federated.step_local_train") },
            { step: 2, title: t("federated.step_compress") },
            { step: 3, title: t("federated.step_aggregate") },
            { step: 4, title: t("federated.step_broadcast") },
          ].map((s) => (
            <div
              key={s.step}
              className={`p-3 rounded-xl border transition-all text-xs flex items-center gap-2.5 ${
                activeStep === s.step
                  ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 font-semibold ring-2 ring-blue-500/20"
                  : activeStep > s.step
                  ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                  : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  activeStep === s.step
                    ? "bg-blue-600 text-white"
                    : activeStep > s.step
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {activeStep > s.step ? "✓" : s.step}
              </div>
              <span className="leading-snug">{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Network Topology Architecture Diagram */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
          {isHindi ? "फेडरेटेड क्लाइंट-सर्वर टोपोलॉजी" : "Federated Edge-to-Server Topology"}
        </h3>

        {/* Central Server Box */}
        <div className="max-w-md mx-auto p-4 rounded-2xl bg-gradient-to-br from-navy-900 to-navy-800 text-white border border-blue-500/30 shadow-lg text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
            <Server className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-sm sm:text-base">
            {isHindi ? "केंद्रीय FedAvg एकत्रीकरण सर्वर" : "Central FedAvg Aggregation Server"}
          </h4>
          <p className="text-[11px] text-blue-300 font-mono">
            W_global = Σ (n_k / Σ n_j) × W_k
          </p>
          <div className="flex justify-center items-center gap-4 text-[11px] pt-1 text-slate-300">
            <span>Round: <b>{currentRound}</b></span>
            <span>•</span>
            <span>Test MAE: <b>{lastRoundResult?.test_mae ?? "18.4"}</b></span>
          </div>
        </div>

        {/* Dynamic Transmission Arrows */}
        <div className="flex justify-center text-blue-500 dark:text-blue-400">
          <div className="flex items-center gap-8 sm:gap-16">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono font-bold text-slate-400">
                {mode === "federated" ? "Model Parameters (Top-K / INT8)" : "Raw Observations Stream"}
              </span>
              <ArrowDown className={`w-5 h-5 ${isTraining ? "animate-bounce text-blue-600" : ""}`} />
            </div>
          </div>
        </div>

        {/* 3 Edge Clients Grid with DYNAMIC TELEMETRY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {clients.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-500" />
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    {isHindi ? c.name_hi : c.name}
                  </span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">{isHindi ? "स्थानीय सैंपल्स:" : "Local Samples (n_k):"}</span>
                  <span className="font-mono font-bold">{c.local_samples}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isHindi ? "नेटवर्क लेटेंसी:" : "Network Latency:"}</span>
                  <span className="font-mono">{c.network_latency} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isHindi ? "स्थानीय ट्रेनिंग लॉस:" : "Local Loss:"}</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                    {c.last_loss != null ? (
                      c.last_loss
                    ) : (
                      <span className="text-amber-500 font-medium text-[11px]">{isHindi ? "लंबित" : "Pending"}</span>
                    )}
                  </span>
                </div>
                {/* Dynamically bound transmitted payload from actual backend measurements */}
                <div className="flex justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-400">{isHindi ? "ट्रांसमिटेड पेलोड:" : "Measured Payload:"}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {mode === "federated" ? (
                      c.upload_bytes != null ? (
                        `${(c.upload_bytes / 1024).toFixed(1)} KB`
                      ) : (
                        <span className="text-amber-500 font-medium text-[11px]">{isHindi ? "प्रथम राउंड की प्रतीक्षा" : "Awaiting first round"}</span>
                      )
                    ) : (
                      `${((c.local_samples * 48) / 1024).toFixed(1)} KB`
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">{isHindi ? "संचयी पेलोड:" : "Cumulative:"}</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {c.cumulative_bytes != null ? (
                      `${(c.cumulative_bytes / 1024).toFixed(1)} KB`
                    ) : (
                      <span className="text-amber-500 font-medium text-[11px]">{isHindi ? "लंबित" : "Pending"}</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 text-[10px] text-slate-500 flex items-center justify-between">
                <span>{isHindi ? "कच्चा डेटा स्थिति:" : "Raw Data:"}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {isHindi ? "एज पर स्थानीय रूप से सुरक्षित" : "Held Locally at Edge"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Convergence Curve Chart (Global Loss & Test MAE) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white mb-1">
          {isHindi ? "फेडरेटेड कन्वर्जेंस वक्र (Global Loss & Test MAE)" : "Federated Model Convergence Across Rounds"}
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          {isHindi ? "FedAvg एकत्रीकरण के साथ त्रुटि में निरंतर कमी" : "Chronological reduction in global loss and test MAE error over FedAvg rounds"}
        </p>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lossHistory}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="round" stroke="#94A3B8" fontSize={11} />
              <YAxis stroke="#94A3B8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0F172A",
                  borderColor: "#334155",
                  borderRadius: "0.5rem",
                  color: "#F8FAFC",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line
                type="monotone"
                dataKey="loss"
                name={isHindi ? "ग्लोबल लॉस (Loss)" : "Global Loss"}
                stroke="#EF4444"
                strokeWidth={2}
                dot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="mae"
                name={isHindi ? "टेस्ट MAE" : "Test MAE"}
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

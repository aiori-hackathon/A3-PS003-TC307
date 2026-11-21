import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../services/api";
import {
  ClientStatus,
  FederatedRoundResponse,
  BenchmarkCompareResponse,
  PartitionComparisonResponse,
  MultiSeedBenchmarkResponse,
  MultiSeedGroupResult,
  CompressionMethod,
  CompressionComparisonResponse,
  RoundCommunicationRecord,
  ClientDistributionStat,
  DistributionAnalysis,
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
import { PageHeroHeader, TFL_CHART_THEME } from "../components/common/DesignSystem";
import { SectionTabs } from "../components/common/SectionTabs";

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
  const [partitionCompareResult, setPartitionCompareResult] = useState<PartitionComparisonResponse | null>(null);
  const [multiSeedResult, setMultiSeedResult] = useState<MultiSeedBenchmarkResponse | null>(null);
  const [compressionCompareResult, setCompressionCompareResult] = useState<CompressionComparisonResponse | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);
  const [benchmarkDataset, setBenchmarkDataset] = useState<"pems08_public" | "synthetic" | "pems08" | "live">("pems08_public");
  const [partitionMode, setPartitionMode] = useState<"compare" | "compression_compare" | "non_iid" | "iid" | "multi_seed">("compare");
  const [compressionPartitionStrategy, setCompressionPartitionStrategy] = useState<"non_iid" | "iid">("non_iid");
  const [compressionStrategy, setCompressionStrategy] = useState<CompressionMethod>("top_k_int8");
  const [selectedRoundCommKey, setSelectedRoundCommKey] = useState<string>("non_iid");
  const [labSectionTab, setLabSectionTab] = useState<"benchmarks" | "edge_fleet">("benchmarks");
  const [benchmarkViewTab, setBenchmarkViewTab] = useState<"summary" | "communication">("summary");
  const [commDetailTab, setCommDetailTab] = useState<"charts" | "table">("charts");
  const [showDatasetDetails, setShowDatasetDetails] = useState<boolean>(false);
  const [randomSeed, setRandomSeed] = useState<number>(42);
  const [multiSeedInput, setMultiSeedInput] = useState<string>("42, 123, 2026");
  const [benchmarkHorizon, setBenchmarkHorizon] = useState<number>(30);
  const [benchmarkRounds, setBenchmarkRounds] = useState<number>(3);
  const [benchmarkTopK, setBenchmarkTopK] = useState<number>(50);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<TrafficDatasetInfo[]>([]);

  const applyCompressionPreset = (method: CompressionMethod) => {
    setCompressionStrategy(method);
    if ((method === "top_k" || method === "top_k_int8") && benchmarkTopK >= 100) {
      setBenchmarkTopK(50);
    }
  };

  const selectedDatasetMeta = datasets.find((d) => d.id === benchmarkDataset) || null;

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
    const safeSeed = Number.isFinite(randomSeed) && randomSeed >= 0 ? Math.floor(randomSeed) : 42;

    try {
      const effectiveTopK =
        compressionStrategy === "top_k" || compressionStrategy === "top_k_int8"
          ? Math.min(99, Math.max(1, benchmarkTopK >= 100 ? 50 : benchmarkTopK))
          : 100;

      if (partitionMode === "compression_compare") {
        const res = await api.runCompressionCompare({
          dataset_type: benchmarkDataset,
          partition_strategy: compressionPartitionStrategy,
          target_horizon_minutes: benchmarkHorizon,
          federated_rounds: benchmarkRounds,
          top_k_retention_pct: effectiveTopK,
          random_seed: safeSeed,
        });
        setCompressionCompareResult(res);
        setSelectedRoundCommKey("top_k_int8");
        setMultiSeedResult(null);
        setPartitionCompareResult(null);
        setBenchmarkResult(null);
      } else if (partitionMode === "multi_seed") {
        const rawTokens = multiSeedInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (rawTokens.length === 0) {
          throw new Error("Enter at least one non-negative integer seed (default: 42, 123, 2026).");
        }
        const parsedSeeds = rawTokens.map((tok) => {
          if (!/^\d+$/.test(tok)) {
            throw new Error(`Invalid seed "${tok}". All seeds must be non-negative integers.`);
          }
          return Number(tok);
        });
        if (new Set(parsedSeeds).size !== parsedSeeds.length) {
          throw new Error("Duplicate seeds are not allowed; provide distinct integer seeds (e.g., 42, 123, 2026).");
        }
        const res = await api.runMultiSeedBenchmark({
          dataset_type: benchmarkDataset,
          target_horizon_minutes: benchmarkHorizon,
          federated_rounds: benchmarkRounds,
          apply_compression: compressionStrategy !== "full_precision",
          top_k_retention_pct: effectiveTopK,
          int8_quantization: compressionStrategy === "int8" || compressionStrategy === "top_k_int8",
          compression_method: compressionStrategy,
          seeds: parsedSeeds,
          partition_strategies: ["iid", "non_iid"],
        });
        setMultiSeedResult(res);
        setCompressionCompareResult(null);
        setPartitionCompareResult(null);
        setBenchmarkResult(null);
      } else if (partitionMode === "compare") {
        const res = await api.runPartitionCompare({
          dataset_type: benchmarkDataset,
          target_horizon_minutes: benchmarkHorizon,
          federated_rounds: benchmarkRounds,
          apply_compression: compressionStrategy !== "full_precision",
          top_k_retention_pct: effectiveTopK,
          int8_quantization: compressionStrategy === "int8" || compressionStrategy === "top_k_int8",
          compression_method: compressionStrategy,
          random_seed: safeSeed,
        });
        setPartitionCompareResult(res);
        setSelectedRoundCommKey("non_iid");
        setCompressionCompareResult(null);
        setMultiSeedResult(null);
        setBenchmarkResult(null);
      } else {
        const res = await api.runBenchmarkCompare({
          dataset_type: benchmarkDataset,
          target_horizon_minutes: benchmarkHorizon,
          federated_rounds: benchmarkRounds,
          apply_compression: compressionStrategy !== "full_precision",
          top_k_retention_pct: effectiveTopK,
          int8_quantization: compressionStrategy === "int8" || compressionStrategy === "top_k_int8",
          compression_method: compressionStrategy,
          partition_strategy: partitionMode,
          random_seed: safeSeed,
        });
        setBenchmarkResult(res);
        setCompressionCompareResult(null);
        setPartitionCompareResult(null);
        setMultiSeedResult(null);
      }
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

  const renderProvenanceBanner = (
    isSimulated: boolean | undefined,
    isGenuinePublic: boolean | undefined,
    datasetName: string,
    predictionTarget: string,
    extraBadge?: string
  ) => {
    if (isSimulated) {
      return (
        <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider text-amber-300 mr-2">
              Synthetic Demonstration Only — Not Official PS-003 Public Results
            </span>
            <span className="text-amber-200/90">
              Results shown below are generated from the synthetic calibration fixture ({datasetName}). Select Caltrans PeMS08 (Public) above for genuine public traffic observations.
            </span>
          </div>
        </div>
      );
    }
    return (
      <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Award className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-bold text-emerald-300">
            {isGenuinePublic ? "Verified Public Dataset Result (PS-003 Official)" : "Live Telemetry Result"}
          </span>
          <span className="text-slate-300">• {datasetName}</span>
          {extraBadge && (
            <span className="px-2 py-0.5 rounded bg-[#1B1D22] border border-white/[0.10] text-amber-300 text-[10px] font-mono font-semibold">
              {extraBadge}
            </span>
          )}
        </div>
        <span className="text-[11px] font-mono text-emerald-300">
          Target: {predictionTarget}
        </span>
      </div>
    );
  };

  const renderClientDistributionPanel = (
    title: string,
    stats: ClientDistributionStat[] | null | undefined,
    analysis: DistributionAnalysis | null | undefined
  ) => {
    if (!stats || stats.length === 0) return null;
    const diff = analysis?.inter_client_differences;
    const trainSum = analysis?.train_summary;
    const testSum = analysis?.test_summary;
    const flowUnit = trainSum?.flow_unit || stats[0]?.flow_unit || "veh/5m";
    const hasOcc = stats.some((s) => s.occupancy_mean != null);

    return (
      <div className="p-4 rounded-xl bg-[#161920] border border-white/[0.08] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-xs font-bold text-white">{title}</span>
            <span className="px-2 py-0.5 rounded-full bg-[#1B1D22] border border-white/[0.10] text-[10px] text-slate-300 font-mono">
              {stats.length} Virtual Clients
            </span>
          </div>
          {diff && (
            <span className="text-[11px] font-mono text-amber-300">
              Flow Mean Spread: {diff.flow_mean_range} {flowUnit} (CV {diff.flow_heterogeneity_cv_pct}%)
            </span>
          )}
        </div>

        <div className="overflow-x-auto no-scrollbar rounded-lg border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="bg-white/5 text-slate-400 border-b border-white/10">
                <th className="py-2 px-2.5 font-semibold">Virtual Client (Train Only)</th>
                <th className="py-2 px-2.5 font-semibold">Sensors</th>
                <th className="py-2 px-2.5 font-semibold">Train Samples</th>
                <th className="py-2 px-2.5 font-semibold">Mean Flow ± Std ({flowUnit})</th>
                {hasOcc && <th className="py-2 px-2.5 font-semibold">Mean Occ.</th>}
                <th className="py-2 px-2.5 font-semibold">Mean Speed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300 font-mono">
              {stats.map((c) => (
                <tr key={c.client_id} className="hover:bg-white/5">
                  <td className="py-1.5 px-2.5 font-sans">
                    <span className="font-semibold text-white block">{c.client_id}</span>
                    <span className="text-[10px] text-slate-400">{c.label}</span>
                  </td>
                  <td className="py-1.5 px-2.5">{c.sensors_count}</td>
                  <td className="py-1.5 px-2.5">
                    {c.train_samples.toLocaleString()}{" "}
                    <span className="text-slate-500">({c.sample_share_pct}%)</span>
                  </td>
                  <td className="py-1.5 px-2.5">
                    {c.flow_mean} ± {c.flow_std}
                  </td>
                  {hasOcc && (
                    <td className="py-1.5 px-2.5">
                      {c.occupancy_mean != null ? c.occupancy_mean.toFixed(4) : "—"}
                    </td>
                  )}
                  <td className="py-1.5 px-2.5">
                    {c.speed_mean != null ? `${c.speed_mean} ${c.speed_unit || ""}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {trainSum && testSum && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 pt-1">
            <span>
              <b className="text-slate-300">Train Partition Total ({trainSum.total_samples.toLocaleString()}):</b>{" "}
              Flow {trainSum.flow_mean} ± {trainSum.flow_std} {trainSum.flow_unit}
              {trainSum.occupancy_mean != null ? ` • Occ ${trainSum.occupancy_mean.toFixed(4)}` : ""}
              {trainSum.speed_mean != null ? ` • Speed ${trainSum.speed_mean} ${trainSum.speed_unit || ""}` : ""}
            </span>
            <span>
              <b className="text-blue-300">Global Holdout Test ({testSum.total_samples.toLocaleString()}):</b>{" "}
              Flow {testSum.flow_mean} ± {testSum.flow_std} {testSum.flow_unit}
              {testSum.occupancy_mean != null ? ` • Occ ${testSum.occupancy_mean.toFixed(4)}` : ""}
              {testSum.speed_mean != null ? ` • Speed ${testSum.speed_mean} ${testSum.speed_unit || ""}` : ""}
            </span>
          </div>
        )}
      </div>
    );
  };

  const fmtBytesHuman = (bytes?: number | null): string => {
    if (bytes == null || Number.isNaN(bytes)) return "N/A";
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(4)} MB`;
  };

  const fmtRatioVal = (ratio?: number | null, suffix = "x"): string => {
    if (ratio == null || !Number.isFinite(ratio)) return "N/A";
    return `${ratio.toFixed(2)}${suffix}`;
  };

  const fmtPctVal = (pct?: number | null): string => {
    if (pct == null || !Number.isFinite(pct)) return "N/A";
    return `${pct.toFixed(2)}%`;
  };

  const fmtEffVal = (val?: number | null, status?: string | null, unit = "veh/5m"): string => {
    if (val == null || !Number.isFinite(val)) {
      if (status === "undefined_zero_bytes") return "Undefined (0 B)";
      if (status === "non_improving") return "N/A (Non-improving)";
      return "N/A";
    }
    return `${val.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}/MB`;
  };

  const strategyLabel = (method?: string | null): string => {
    switch (method) {
      case "full_precision":
        return "Full Precision (FP32)";
      case "top_k":
        return "Top-K Sparse (FP32)";
      case "int8":
        return "Uniform INT8";
      case "top_k_int8":
        return "Top-K + INT8";
      default:
        return method || "Unknown";
    }
  };

  const renderCommunicationAnalysisSection = () => {
    // Resolve active round-history streams, target unit, centralized ref, and selector options
    let seriesOptions: Array<{ key: string; label: string; rounds: RoundCommunicationRecord[] }> = [];
    let centralizedBytes: number | null = null;
    let centralizedMae: number | null = null;
    let targetUnit = "veh/5m";

    if (compressionCompareResult) {
      targetUnit = compressionCompareResult.target_unit || "veh/5m";
      centralizedBytes = compressionCompareResult.centralized.upload_bytes ?? compressionCompareResult.centralized.data_transmitted_bytes;
      centralizedMae = compressionCompareResult.centralized.mae;
      seriesOptions = (["full_precision", "top_k", "int8", "top_k_int8"] as const)
        .filter((k) => Boolean(compressionCompareResult.strategies[k]))
        .map((k) => ({
          key: k,
          label: strategyLabel(k),
          rounds: compressionCompareResult.strategies[k].round_history || [],
        }));
    } else if (partitionCompareResult) {
      targetUnit = partitionCompareResult.target_unit || "veh/5m";
      centralizedBytes = partitionCompareResult.centralized.upload_bytes ?? partitionCompareResult.centralized.data_transmitted_bytes;
      centralizedMae = partitionCompareResult.centralized.mae;
      seriesOptions = [
        {
          key: "non_iid",
          label: "Non-IID Corridors",
          rounds: (partitionCompareResult.non_iid.federated.round_history || []) as RoundCommunicationRecord[],
        },
        {
          key: "iid",
          label: "IID Uniform Shards",
          rounds: (partitionCompareResult.iid.federated.round_history || []) as RoundCommunicationRecord[],
        },
      ];
    } else if (benchmarkResult) {
      targetUnit = benchmarkResult.target_unit || "veh/5m";
      centralizedBytes = benchmarkResult.centralized.upload_bytes ?? benchmarkResult.centralized.data_transmitted_bytes;
      centralizedMae = benchmarkResult.centralized.mae;
      seriesOptions = [
        {
          key: "single",
          label: benchmarkResult.partition_strategy === "iid" ? "IID Federated" : "Non-IID Federated",
          rounds: (benchmarkResult.federated.round_history || []) as RoundCommunicationRecord[],
        },
      ];
    } else if (multiSeedResult) {
      targetUnit = multiSeedResult.target_unit || "veh/5m";
      const cSum = multiSeedResult.groups.centralized?.summary;
      centralizedBytes = cSum?.mean_upload_bytes ?? null;
      centralizedMae = cSum?.mean_mae ?? null;
      seriesOptions = (multiSeedResult.partition_strategies || ["iid", "non_iid"])
        .map((ps) => {
          const grp = multiSeedResult.groups[ps];
          const conv = grp?.aggregated_convergence || [];
          return {
            key: ps,
            label: ps === "iid" ? "IID (Mean across Seeds)" : "Non-IID (Mean across Seeds)",
            rounds: conv.map((c) => ({
              round: c.round,
              test_mae: Number((c.mean_mae ?? 0).toFixed(4)),
              test_rmse: Number((c.mean_rmse ?? 0).toFixed(4)),
              weights_norm: 0,
              compression_method: c.compression_method,
              upload_bytes: c.mean_upload_bytes ?? undefined,
              download_bytes_modeled: c.mean_download_bytes_modeled ?? undefined,
              total_round_bytes: c.mean_total_round_bytes ?? undefined,
              cumulative_upload_bytes: c.mean_cumulative_upload_bytes ?? undefined,
              cumulative_download_bytes_modeled: c.mean_cumulative_download_bytes_modeled ?? undefined,
              cumulative_total_bytes: c.mean_cumulative_total_bytes ?? undefined,
              cumulative_upload_mb: c.mean_cumulative_upload_mb ?? undefined,
              cumulative_download_mb_modeled: c.mean_cumulative_download_mb_modeled ?? undefined,
              cumulative_total_mb: c.mean_cumulative_total_mb ?? undefined,
              mae_improvement_per_mb_upload: c.mean_mae_improvement_per_mb_upload ?? null,
              rmse_improvement_per_mb_upload: c.mean_rmse_improvement_per_mb_upload ?? null,
            })),
          };
        })
        .filter((opt) => opt.rounds.length > 0);
    }

    if (seriesOptions.length === 0) return null;
    const activeSeries =
      seriesOptions.find((s) => s.key === selectedRoundCommKey) || seriesOptions[0];
    const activeRounds = activeSeries.rounds || [];
    if (activeRounds.length === 0) return null;

    const perRoundChartData = activeRounds.map((r) => ({
      round: `R${r.round}`,
      Upload_B: Math.round(r.upload_bytes ?? 0),
      Download_Modeled_B: Math.round(r.download_bytes_modeled ?? 0),
      Cumulative_Upload_B: Math.round(r.cumulative_upload_bytes ?? 0),
      Cumulative_Download_B: Math.round(r.cumulative_download_bytes_modeled ?? 0),
      Cumulative_Total_B: Math.round(r.cumulative_total_bytes ?? 0),
      Cumulative_Upload_KB: Number((((r.cumulative_upload_bytes ?? 0) as number) / 1024).toFixed(3)),
      Test_MAE: r.test_mae,
      Test_RMSE: r.test_rmse,
    }));

    const compOrder: CompressionMethod[] = ["full_precision", "top_k", "int8", "top_k_int8"];

    return (
      <div className="p-5 rounded-2xl bg-[#161920] border border-white/[0.08] space-y-5 mt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Radio className="w-4 h-4 text-[#9AC2FA] shrink-0" />
              <h3 className="font-serif text-sm sm:text-base font-medium text-white">
                Per-Round & Cumulative Communication Cost & Convergence Analysis
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#9AC2FA]/12 text-[#9AC2FA] border border-[#9AC2FA]/25">
                TFL1 Binary Wire Accounting
              </span>
            </div>
            <p className="text-[11px] text-[#8C93A4] mt-1">
              Distinguishes <b>Measured Client Upload</b> (actual serialized TFL1 bytes) from <b>Modeled Broadcast Download</b> (FP32 global update) and from Centralized one-time estimated raw data upload ({fmtBytesHuman(centralizedBytes)}). Excludes TCP/IP headers and physical WAN latency.
            </p>
          </div>

          {seriesOptions.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-[#8C93A4] uppercase font-semibold mr-1">Inspect Stream:</span>
              {seriesOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSelectedRoundCommKey(opt.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    activeSeries.key === opt.key
                      ? "bg-[#9AC2FA]/15 border-[#9AC2FA]/50 text-[#9AC2FA]"
                      : "bg-[#111318] border-white/[0.08] text-[#8C93A4] hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Visualization 5: Multi-Seed Communication Mean ± Sample SD Cards & Round Table */}
        {multiSeedResult && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-bold text-cyan-200">
                Multi-Seed Communication Summary ({multiSeedResult.seeds.join(", ")}) — Mean ± Sample SD (ddof=1)
              </h4>
              {!multiSeedResult.is_complete && (
                <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/60 text-amber-300 text-[10px] font-semibold">
                  Incomplete Aggregate (Partial Failure)
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-white/5 border border-rose-500/30 space-y-1.5 text-xs">
                <div className="text-slate-400 font-semibold flex justify-between">
                  <span>Centralized Raw Data Upload</span>
                  <span className="text-[10px] text-rose-300 font-mono">48B/sample est.</span>
                </div>
                <div className="text-lg font-bold font-mono text-rose-300">
                  {fmtBytesHuman(multiSeedResult.groups.centralized?.summary?.mean_upload_bytes)}
                </div>
                <div className="text-[10px] text-slate-400">
                  Download: 0 B • Single centralized ingestion before training
                </div>
              </div>

              {(multiSeedResult.partition_strategies || ["iid", "non_iid"]).map((ps) => {
                const grp = multiSeedResult.groups[ps];
                if (!grp) return null;
                const sm = grp.summary;
                return (
                  <div key={ps} className="p-3.5 rounded-xl bg-white/5 border border-cyan-500/30 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">
                        {ps === "iid" ? "FedAvg IID" : "FedAvg Non-IID"} ({grp.successful_runs_count}/{grp.requested_runs_count})
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono">
                        {strategyLabel(sm.compression_method)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Measured Upload (Mean ± SD)</span>
                        <span className="font-mono font-bold text-emerald-300">
                          {sm.mean_upload_bytes != null ? `${sm.mean_upload_bytes.toFixed(1)} B` : "N/A"}
                          {" ± "}
                          {sm.std_upload_bytes != null ? sm.std_upload_bytes.toFixed(1) : "N/A"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Modeled Download</span>
                        <span className="font-mono text-slate-200">
                          {sm.mean_download_bytes_modeled != null ? `${sm.mean_download_bytes_modeled.toFixed(1)} B` : "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-300 font-mono">
                      <span>Up Red: {fmtPctVal(sm.mean_upload_reduction_pct)}</span>
                      <span>Eff: {fmtEffVal(sm.mean_mae_improvement_per_mb_upload, null, targetUnit)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Per-Round Multi-Seed Communication Mean ± Sample SD Table */}
            {(multiSeedResult.groups[selectedRoundCommKey]?.aggregated_convergence ||
              multiSeedResult.groups.non_iid?.aggregated_convergence ||
              multiSeedResult.groups.iid?.aggregated_convergence ||
              []).length > 0 && (
              <div className="overflow-x-auto no-scrollbar rounded-xl border border-white/10">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-white/5 text-slate-400 border-b border-white/10">
                      <th className="py-2 px-2.5">Multi-Seed Round</th>
                      <th className="py-2 px-2.5 text-center">Seeds</th>
                      <th className="py-2 px-2.5 text-right">Upload (Mean ± SD B)</th>
                      <th className="py-2 px-2.5 text-right">Modeled DL (Mean ± SD B)</th>
                      <th className="py-2 px-2.5 text-right">Cum. Total (Mean B)</th>
                      <th className="py-2 px-2.5 text-right">MAE Imp/MB (Mean ± SD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    {(
                      multiSeedResult.groups[selectedRoundCommKey]?.aggregated_convergence ||
                      multiSeedResult.groups.non_iid?.aggregated_convergence ||
                      multiSeedResult.groups.iid?.aggregated_convergence ||
                      []
                    ).map((pt) => (
                      <tr key={pt.round} className="hover:bg-white/5">
                        <td className="py-1.5 px-2.5 font-mono font-bold text-cyan-300">Round {pt.round}</td>
                        <td className="py-1.5 px-2.5 text-center font-mono text-slate-400">
                          {pt.completed_seeds_count}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono text-emerald-300">
                          {pt.mean_upload_bytes != null ? pt.mean_upload_bytes.toFixed(1) : "N/A"} ±{" "}
                          {pt.std_upload_bytes != null ? pt.std_upload_bytes.toFixed(1) : "N/A"}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono text-indigo-300">
                          {pt.mean_download_bytes_modeled != null ? pt.mean_download_bytes_modeled.toFixed(1) : "N/A"} ±{" "}
                          {pt.std_download_bytes_modeled != null ? pt.std_download_bytes_modeled.toFixed(1) : "N/A"}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono">
                          {pt.mean_cumulative_total_bytes != null ? pt.mean_cumulative_total_bytes.toFixed(1) : "N/A"}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono text-amber-300">
                          {pt.mean_mae_improvement_per_mb_upload != null
                            ? `${pt.mean_mae_improvement_per_mb_upload.toFixed(1)} ± ${
                                pt.std_mae_improvement_per_mb_upload != null
                                  ? pt.std_mae_improvement_per_mb_upload.toFixed(1)
                                  : "N/A"
                              }`
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Visualization 3: 4-Strategy Compression Comparison Table & Bar Chart */}
        {compressionCompareResult && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-amber-300">
                4-Strategy Compression Comparison ({compressionCompareResult.partition_strategy.toUpperCase()}, Seed {compressionCompareResult.random_seed}, {compressionCompareResult.shared_config?.federated_rounds} Rounds)
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">
                Model Params: {compressionCompareResult.shared_config?.parameter_count} | Top-K Retention: {compressionCompareResult.shared_config?.top_k_retention_pct}%
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-emerald-500/30">
                <span className="text-[10px] text-slate-400 uppercase block">Best Accuracy Strategy</span>
                <span className="font-bold text-emerald-300 text-sm">
                  {strategyLabel(compressionCompareResult.best_accuracy_strategy)}
                </span>
                <span className="block text-[11px] font-mono text-slate-300 mt-0.5">
                  MAE {compressionCompareResult.strategies[compressionCompareResult.best_accuracy_strategy]?.mae.toFixed(4)} {targetUnit}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-cyan-500/30">
                <span className="text-[10px] text-slate-400 uppercase block">Lowest Client Upload Strategy</span>
                <span className="font-bold text-cyan-300 text-sm">
                  {strategyLabel(compressionCompareResult.lowest_upload_strategy)}
                </span>
                <span className="block text-[11px] font-mono text-slate-300 mt-0.5">
                  {compressionCompareResult.strategies[compressionCompareResult.lowest_upload_strategy]?.upload_bytes.toLocaleString()} B ({fmtRatioVal(compressionCompareResult.strategies[compressionCompareResult.lowest_upload_strategy]?.upload_compression_ratio)} ratio)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-rose-500/30">
                <span className="text-[10px] text-slate-400 uppercase block">Centralized Baseline (Separated)</span>
                <span className="font-bold text-rose-300 text-sm">
                  Raw Data Upload: {fmtBytesHuman(compressionCompareResult.centralized.upload_bytes)}
                </span>
                <span className="block text-[11px] font-mono text-slate-300 mt-0.5">
                  MAE {compressionCompareResult.centralized.mae} {targetUnit} (One-time ingestion)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar rounded-xl border border-white/10">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="bg-white/5 text-slate-400 border-b border-white/10">
                    <th className="py-2 px-2.5">Strategy</th>
                    <th className="py-2 px-2.5 text-right">Per-Client Breakdown (B)</th>
                    <th className="py-2 px-2.5 text-right">Upload Total</th>
                    <th className="py-2 px-2.5 text-right">Upload Ratio / Red.</th>
                    <th className="py-2 px-2.5 text-right">Modeled DL</th>
                    <th className="py-2 px-2.5 text-right">Bidirectional Total</th>
                    <th className="py-2 px-2.5 text-right">MAE / RMSE ({targetUnit})</th>
                    <th className="py-2 px-2.5 text-right">MAE vs FP32</th>
                    <th className="py-2 px-2.5 text-right">Efficiency (MAE Imp/MB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {compOrder.map((m) => {
                    const st = compressionCompareResult.strategies[m];
                    if (!st) return null;
                    const bd = st.payload_breakdown_per_client;
                    return (
                      <tr key={m} className={selectedRoundCommKey === m ? "bg-cyan-500/10" : "hover:bg-white/5"}>
                        <td className="py-2 px-2.5 font-semibold text-white">{strategyLabel(m)}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-[10px] text-slate-400">
                          {bd.total_bytes}B ({bd.header_bytes}h+{bd.bias_bytes}b+{bd.values_bytes}v+{bd.index_bytes}i+{bd.quant_metadata_bytes}q)
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-300">
                          {st.upload_bytes.toLocaleString()} B
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-cyan-300">
                          {fmtRatioVal(st.upload_compression_ratio)} ({fmtPctVal(st.upload_reduction_pct)})
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-slate-300">
                          {st.download_bytes_modeled.toLocaleString()} B
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-slate-200">
                          {st.total_bytes.toLocaleString()} B
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono">
                          {st.mae.toFixed(4)} / {st.rmse.toFixed(4)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-amber-300">
                          {st.mae_vs_full_precision >= 0 ? "+" : ""}
                          {st.mae_vs_full_precision.toFixed(4)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-emerald-300">
                          {fmtEffVal(st.mae_improvement_per_mb_upload, st.communication_summary?.mae_efficiency_status, targetUnit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200/90 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{compressionCompareResult.overhead_limitations_note}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Bar Chart comparing 4 Compression Strategies Upload vs Modeled Download Bytes */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <span className="text-xs font-semibold text-slate-200 block">
                  Upload vs. Modeled Download Bytes Across 4 Compression Strategies
                </span>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={compOrder
                        .filter((m) => Boolean(compressionCompareResult.strategies[m]))
                        .map((m) => ({
                          strategy: strategyLabel(m),
                          Upload_B: compressionCompareResult.strategies[m].upload_bytes,
                          Download_Modeled_B: compressionCompareResult.strategies[m].download_bytes_modeled,
                        }))}
                      margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={TFL_CHART_THEME.gridStroke} />
                      <XAxis dataKey="strategy" stroke={TFL_CHART_THEME.axisStroke} fontSize={10} />
                      <YAxis stroke={TFL_CHART_THEME.axisStroke} fontSize={10} />
                      <Tooltip contentStyle={TFL_CHART_THEME.tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="Upload_B" name="Measured Client Upload (B)" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Download_Modeled_B" name="Modeled Broadcast DL (B)" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Performance vs Upload Bytes Trade-off Bar/Line across 4 Strategies */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <span className="text-xs font-semibold text-slate-200 block">
                  Accuracy vs. Upload Trade-Off Across Compression Strategies ({targetUnit})
                </span>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={compOrder
                        .filter((m) => Boolean(compressionCompareResult.strategies[m]))
                        .map((m) => ({
                          strategy: strategyLabel(m),
                          Test_MAE: Number(compressionCompareResult.strategies[m].mae.toFixed(4)),
                          Test_RMSE: Number(compressionCompareResult.strategies[m].rmse.toFixed(4)),
                          Upload_KB: Number((compressionCompareResult.strategies[m].upload_bytes / 1024).toFixed(3)),
                        }))}
                      margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={TFL_CHART_THEME.gridStroke} />
                      <XAxis dataKey="strategy" stroke={TFL_CHART_THEME.axisStroke} fontSize={10} />
                      <YAxis yAxisId="err" stroke="#F59E0B" fontSize={10} domain={["auto", "auto"]} />
                      <YAxis yAxisId="kb" orientation="right" stroke="#10B981" fontSize={10} />
                      <Tooltip contentStyle={TFL_CHART_THEME.tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar yAxisId="err" dataKey="Test_MAE" name={`Test MAE (${targetUnit})`} fill="#F59E0B" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="kb" dataKey="Upload_KB" name="Total Upload (KB)" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sub-view Switcher inside Communication Cost Analysis: Visual Curves vs Byte Ledger Table */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTabs
            activeTab={commDetailTab}
            onChange={(id) => setCommDetailTab(id as "charts" | "table")}
            testIdPrefix="fl-comm-subtab"
            tabs={[
              { id: "charts", label: "Upload, Download & Convergence Charts", icon: TrendingDown },
              { id: "table", label: "Per-Round Byte Ledger", icon: Layers, badge: `${activeRounds.length}R` },
            ]}
          />
          <span className="text-[11px] text-[#8C93A4]">
            Measured upload bytes + modeled broadcast bytes
          </span>
        </div>

        {/* Visualizations 1, 2 & 4: Per-Round Bytes, Cumulative Bytes & Convergence vs Communication */}
        {commDetailTab === "charts" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Visualization 1: Per-Round Client Upload vs Modeled Download */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <span className="text-xs font-semibold text-slate-200 block">
              1. Per-Round Communication ({activeSeries.label})
            </span>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perRoundChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={TFL_CHART_THEME.gridStroke} />
                  <XAxis dataKey="round" stroke={TFL_CHART_THEME.axisStroke} fontSize={10} />
                  <YAxis stroke={TFL_CHART_THEME.axisStroke} fontSize={10} />
                  <Tooltip contentStyle={TFL_CHART_THEME.tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  <Bar dataKey="Upload_B" name="Measured Upload (B)" fill="#10B981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Download_Modeled_B" name="Modeled DL (B)" fill="#6366F1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Visualization 2: Cumulative Upload vs Modeled Download vs Total */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <span className="text-xs font-semibold text-slate-200 block">
              2. Cumulative Communication Progression (Bytes)
            </span>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={perRoundChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={TFL_CHART_THEME.gridStroke} />
                  <XAxis dataKey="round" stroke={TFL_CHART_THEME.axisStroke} fontSize={10} />
                  <YAxis stroke={TFL_CHART_THEME.axisStroke} fontSize={10} />
                  <Tooltip contentStyle={TFL_CHART_THEME.tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  <Line type="monotone" dataKey="Cumulative_Upload_B" name="Cum. Upload (B)" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="Cumulative_Download_B" name="Cum. Modeled DL (B)" stroke="#818CF8" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="Cumulative_Total_B" name="Cum. Bidirectional (B)" stroke="#06B6D4" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Visualization 4: MAE / RMSE vs Cumulative Communication */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <span className="text-xs font-semibold text-slate-200 block">
              4. Error vs. Cumulative Upload ({targetUnit})
            </span>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={perRoundChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={TFL_CHART_THEME.gridStroke} />
                  <XAxis dataKey="Cumulative_Upload_KB" stroke={TFL_CHART_THEME.axisStroke} fontSize={10} unit="KB" />
                  <YAxis stroke={TFL_CHART_THEME.axisStroke} fontSize={10} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={TFL_CHART_THEME.tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  <Line type="monotone" dataKey="Test_MAE" name={`Test MAE (${targetUnit})`} stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="Test_RMSE" name={`Test RMSE (${targetUnit})`} stroke="#38BDF8" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {centralizedMae != null && (
              <div className="text-[10px] text-slate-400 font-mono text-right">
                Centralized Reference MAE: {centralizedMae} {targetUnit} (@ {fmtBytesHuman(centralizedBytes)} raw upload)
              </div>
            )}
          </div>
        </div>
        )}

        {/* Detailed Per-Round Communication + Efficiency Progression Table */}
        {commDetailTab === "table" && (
        <div className="overflow-x-auto no-scrollbar rounded-xl border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="bg-white/5 text-slate-400 border-b border-white/10">
                <th className="py-2 px-2.5">Round</th>
                <th className="py-2 px-2.5 text-right">Round Upload (Measured)</th>
                <th className="py-2 px-2.5 text-right">Round Download (Modeled)</th>
                <th className="py-2 px-2.5 text-right">Cum. Upload (B)</th>
                <th className="py-2 px-2.5 text-right">Cum. Total (B)</th>
                <th className="py-2 px-2.5 text-right">Test MAE / RMSE ({targetUnit})</th>
                <th className="py-2 px-2.5 text-right">MAE Imp. / MB (Upload)</th>
                <th className="py-2 px-2.5 text-right">RMSE Imp. / MB (Upload)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {activeRounds.map((r) => (
                <tr key={r.round} className="hover:bg-white/5">
                  <td className="py-2 px-2.5 font-mono font-bold text-cyan-300">Round {r.round}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-emerald-300">
                    {r.upload_bytes != null ? `${Math.round(r.upload_bytes).toLocaleString()} B` : "N/A"}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-indigo-300">
                    {r.download_bytes_modeled != null ? `${Math.round(r.download_bytes_modeled).toLocaleString()} B` : "N/A"}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono">
                    {r.cumulative_upload_bytes != null ? `${Math.round(r.cumulative_upload_bytes).toLocaleString()} B` : "N/A"}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-slate-300">
                    {r.cumulative_total_bytes != null ? `${Math.round(r.cumulative_total_bytes).toLocaleString()} B` : "N/A"}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono">
                    {r.test_mae} / {r.test_rmse}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-amber-300">
                    {fmtEffVal(r.mae_improvement_per_mb_upload, r.mae_efficiency_status, targetUnit)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-sky-300">
                    {fmtEffVal(r.rmse_improvement_per_mb_upload, r.rmse_efficiency_status, targetUnit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Title & View Toggle */}
      <PageHeroHeader
        eyebrow={
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-[#9AC2FA]/12 dark:text-[#9AC2FA] border border-blue-200 dark:border-[#9AC2FA]/25">
            PS-003 Standard Compliance
          </span>
        }
        title={t("federated.title")}
        subtitle={t("federated.subtitle")}
        actions={
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.09] text-xs">
            <button
              onClick={() => setMode("federated")}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                mode === "federated"
                  ? "bg-blue-600 text-white dark:bg-[#9AC2FA] dark:text-[#0A0D14] shadow-sm"
                  : "text-slate-600 dark:text-[#C5C8D0] hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Federated Learning (FedAvg)
            </button>
            <button
              onClick={() => setMode("centralized")}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                mode === "centralized"
                  ? "bg-blue-600 text-white dark:bg-[#9AC2FA] dark:text-[#0A0D14] shadow-sm"
                  : "text-slate-600 dark:text-[#C5C8D0] hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {isHindi ? "केंद्रीकृत आधार रेखा (Centralized)" : "Centralized Baseline"}
            </button>
          </div>
        }
      />

      {/* Dedicated FL Research Workspace Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SectionTabs
          activeTab={labSectionTab}
          onChange={(id) => setLabSectionTab(id as "benchmarks" | "edge_fleet")}
          testIdPrefix="fl-workspace-tab"
          tabs={[
            { id: "benchmarks", label: "PS-003 Empirical Benchmarks", icon: Scale },
            { id: "edge_fleet", label: "Interactive Edge Fleet & FedAvg Round", icon: Cpu, badge: `R${currentRound}` },
          ]}
        />
        <span className="text-[11px] text-slate-500 dark:text-[#8C93A4]">
          {labSectionTab === "benchmarks"
            ? "PeMS08 multi-seed evaluation, partitioning & compression accounting"
            : "Step-by-step FedAvg aggregation topology & edge telemetry"}
        </span>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: PS-003 UNIFIED HEAD-TO-HEAD BENCHMARK (CENTRALIZED VS FEDERATED) */}
      {/* ========================================================================= */}
      {labSectionTab === "benchmarks" && (
      <div className="p-6 rounded-2xl bg-slate-900 dark:bg-[#111318] border border-slate-800 dark:border-white/[0.08] text-white shadow-lg dark:shadow-[0_18px_40px_rgba(0,0,0,0.45)] space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#9AC2FA]" />
              <h2 className="font-serif text-lg sm:text-xl font-medium tracking-[-0.01em] text-white">
                {isHindi
                  ? "PS-003: केंद्रीकृत बनाम फेडरेटेड तुलनात्मक बेंचमार्क"
                  : "PS-003 Unified Benchmark: Centralized vs. Federated Learning"}
              </h2>
            </div>
            <p className="text-xs text-[#C5C8D0]">
              {isHindi
                ? "सटीकता और संचार लागत का प्रत्यक्ष अनुभवजन्य मूल्यांकन (समान कालानुक्रमिक डेटा विभाजन पर)"
                : "Empirical evaluation of prediction accuracy vs. communication bandwidth on identical chronological holdout data."}
            </p>
          </div>

          <button
            onClick={() => handleRunBenchmark(true)}
            disabled={isBenchmarking}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#9AC2FA] hover:bg-[#B4D2FC] text-[#0A0D14] font-semibold text-xs sm:text-sm shadow-sm transition-colors disabled:opacity-50 shrink-0 self-start md:self-auto cursor-pointer"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs">
          {/* Dataset Selector */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block text-[11px]">
              {isHindi ? "डेटासेट स्रोत:" : "Evaluation Dataset:"}
            </label>
            <select
              value={benchmarkDataset}
              onChange={(e) => setBenchmarkDataset(e.target.value as any)}
              disabled={isBenchmarking}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1D22] border border-white/[0.10] text-white text-xs font-medium focus:ring-1 focus:ring-[#9AC2FA] focus:outline-none"
            >
              <option value="pems08_public">Caltrans PeMS08 (Zenodo CC-BY-4.0) — Public</option>
              <option value="pems08">[Synthetic Demo] PeMS-08-inspired Calibration Fixture</option>
              <option value="synthetic">[Synthetic Demo] Delhi NCR Diurnal Model</option>
              <option value="live">TomTom Real-Time Telemetry Feed — Live</option>
            </select>
          </div>

          {/* Data Partitioning & Compression Experiment Mode Selector */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block text-[11px]">
              {isHindi ? "प्रयोग मोड:" : "Experiment Mode:"}
            </label>
            <select
              value={partitionMode}
              onChange={(e) =>
                setPartitionMode(
                  e.target.value as "compare" | "compression_compare" | "non_iid" | "iid" | "multi_seed"
                )
              }
              disabled={isBenchmarking}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1D22] border border-white/[0.10] text-white text-xs font-medium focus:ring-1 focus:ring-[#9AC2FA] focus:outline-none"
            >
              <option value="compare">Side-by-Side Comparison (IID vs. Non-IID)</option>
              <option value="compression_compare">4-Way Compression Comparison (Full / Top-K / INT8 / Top-K+INT8)</option>
              <option value="multi_seed">Three-Seed Reproducibility Study (42, 123, 2026)</option>
              <option value="non_iid">Non-IID Only (Physical Traffic Corridors)</option>
              <option value="iid">IID Only (Uniform Random Train Split)</option>
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
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1D22] border border-white/[0.10] text-white text-xs font-medium focus:ring-1 focus:ring-[#9AC2FA] focus:outline-none"
            >
              <option value={15}>15 Minutes Ahead</option>
              <option value={30}>30 Minutes Ahead</option>
              <option value={60}>60 Minutes Ahead</option>
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
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1D22] border border-white/[0.10] text-white text-xs font-medium focus:ring-1 focus:ring-[#9AC2FA] focus:outline-none"
            >
              <option value={1}>1 Round (Single aggregation)</option>
              <option value={3}>3 Rounds (Standard convergence)</option>
              <option value={5}>5 Rounds (Multi-cycle sync)</option>
              <option value={10}>10 Rounds (Extended convergence)</option>
            </select>
          </div>

          {/* Compression Strategy / Top-K Selector */}
          {partitionMode === "compression_compare" ? (
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold block text-[11px]">
                Partition & Top-K Retention (%):
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={compressionPartitionStrategy}
                  onChange={(e) => setCompressionPartitionStrategy(e.target.value as "non_iid" | "iid")}
                  disabled={isBenchmarking}
                  className="px-2 py-1.5 rounded-lg bg-[#1B1D22] border border-white/[0.10] text-white text-xs font-medium focus:ring-1 focus:ring-[#9AC2FA] focus:outline-none"
                >
                  <option value="non_iid">Non-IID</option>
                  <option value="iid">IID</option>
                </select>
                <select
                  value={benchmarkTopK}
                  onChange={(e) => setBenchmarkTopK(Number(e.target.value))}
                  disabled={isBenchmarking}
                  className="px-2 py-1.5 rounded-lg bg-[#1B1D22] border border-white/[0.10] text-white text-xs font-medium focus:ring-1 focus:ring-[#9AC2FA] focus:outline-none"
                >
                  <option value={25}>Top-K 25%</option>
                  <option value={50}>Top-K 50%</option>
                  <option value={75}>Top-K 75%</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold block text-[11px]">
                {isHindi ? "अपडेट संपीड़न रणनीति:" : "Compression Strategy:"}
              </label>
              <div className="flex gap-1.5">
                <select
                  value={compressionStrategy}
                  onChange={(e) => applyCompressionPreset(e.target.value as CompressionMethod)}
                  disabled={isBenchmarking}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#1B1D22] border border-white/[0.10] text-white text-xs font-medium focus:ring-1 focus:ring-[#9AC2FA] focus:outline-none"
                >
                  <option value="top_k_int8">Top-K + INT8 Quantization</option>
                  <option value="int8">Uniform INT8 Quantization</option>
                  <option value="top_k">Top-K Sparsification Only</option>
                  <option value="full_precision">Full Precision (Raw FP32)</option>
                </select>
                {(compressionStrategy === "top_k" || compressionStrategy === "top_k_int8") && (
                  <select
                    value={benchmarkTopK}
                    onChange={(e) => setBenchmarkTopK(Number(e.target.value))}
                    disabled={isBenchmarking}
                    className="w-20 px-1.5 py-1.5 rounded-lg bg-[#1B1D22] border border-white/[0.10] text-amber-300 font-mono text-xs font-semibold focus:ring-1 focus:ring-[#9AC2FA] focus:outline-none"
                  >
                    <option value={25}>25%</option>
                    <option value={50}>50%</option>
                    <option value={75}>75%</option>
                  </select>
                )}
              </div>
            </div>
          )}

          {/* Reproducible Random Seed / Multi-Seed Input */}
          {partitionMode === "multi_seed" ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <label className="text-slate-400 font-semibold block">
                  {isHindi ? "रैंडम सीड्स (3 डिफ़ॉल्ट):" : "Experiment Seeds (3 Default):"}
                </label>
                {multiSeedInput.trim() !== "42, 123, 2026" && (
                  <button
                    type="button"
                    onClick={() => setMultiSeedInput("42, 123, 2026")}
                    className="text-[10px] text-amber-400 hover:underline font-medium"
                  >
                    Reset 42, 123, 2026
                  </button>
                )}
              </div>
              <input
                type="text"
                value={multiSeedInput}
                onChange={(e) => setMultiSeedInput(e.target.value)}
                disabled={isBenchmarking}
                placeholder="42, 123, 2026"
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1D22] border border-white/[0.10] text-white font-mono text-xs font-medium focus:ring-1 focus:ring-[#9AC2FA] focus:outline-none"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold block text-[11px]">
                {isHindi ? "रैंडम सीड (Random Seed):" : "Random Seed (Deterministic Split):"}
              </label>
              <input
                type="number"
                min={0}
                max={2147483647}
                step={1}
                value={randomSeed}
                onChange={(e) => setRandomSeed(Math.max(0, Number(e.target.value) || 0))}
                disabled={isBenchmarking}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1D22] border border-white/[0.10] text-white font-mono text-xs font-medium focus:ring-1 focus:ring-[#9AC2FA] focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Concise Selected Dataset Information Strip */}
        {selectedDatasetMeta && (
          <div className="p-3.5 rounded-xl bg-[#161920] border border-white/[0.08] space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Database className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="font-semibold text-white truncate">{selectedDatasetMeta.name}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    selectedDatasetMeta.is_genuine_public
                      ? "bg-emerald-950/80 text-emerald-300 border-emerald-700"
                      : selectedDatasetMeta.is_simulated
                      ? "bg-amber-950/80 text-amber-300 border-amber-700"
                      : "bg-blue-950/80 text-blue-300 border-blue-700"
                  }`}
                >
                  {selectedDatasetMeta.is_genuine_public
                    ? "Public • PS-003 Eligible"
                    : selectedDatasetMeta.is_simulated
                    ? "Synthetic • Demo Only"
                    : "Live Telemetry"}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {selectedDatasetMeta.nodes_count.toLocaleString()} sensors • {selectedDatasetMeta.total_samples.toLocaleString()} records
                </span>
                <button
                  type="button"
                  onClick={() => setShowDatasetDetails((v) => !v)}
                  className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] text-[#9AC2FA] hover:bg-white/10 transition-colors cursor-pointer"
                  data-testid="toggle-dataset-specs-btn"
                >
                  {showDatasetDetails ? "Hide Specs" : "Dataset Specs"}
                </button>
              </div>
            </div>

            {showDatasetDetails && (
              <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-[11px]">
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <span className="text-slate-400 block text-[10px]">Data Type</span>
                <span className="font-semibold text-slate-200">
                  {selectedDatasetMeta.is_genuine_public
                    ? "Public"
                    : selectedDatasetMeta.is_simulated
                    ? "Synthetic"
                    : "Live API"}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <span className="text-slate-400 block text-[10px]">Sensors</span>
                <span className="font-mono font-semibold text-slate-200">
                  {selectedDatasetMeta.nodes_count.toLocaleString()}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <span className="text-slate-400 block text-[10px]">Records</span>
                <span className="font-mono font-semibold text-slate-200">
                  {selectedDatasetMeta.total_samples.toLocaleString()}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <span className="text-slate-400 block text-[10px]">Time Coverage</span>
                <span className="font-medium text-slate-200 truncate block" title={selectedDatasetMeta.time_range || selectedDatasetMeta.sample_frequency}>
                  {selectedDatasetMeta.time_range || selectedDatasetMeta.sample_frequency}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <span className="text-slate-400 block text-[10px]">Forecasting Target</span>
                <span className="font-medium text-slate-200 truncate block" title={selectedDatasetMeta.prediction_target || "Traffic Volume"}>
                  {selectedDatasetMeta.prediction_target || "Traffic Volume"}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <span className="text-slate-400 block text-[10px]">Source / Licence</span>
                <span className="font-medium text-slate-200 truncate block" title={`${selectedDatasetMeta.provenance} | ${selectedDatasetMeta.licensing}`}>
                  {selectedDatasetMeta.source_url ? (
                    <a
                      href={selectedDatasetMeta.documentation_url || selectedDatasetMeta.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      Zenodo (CC-BY-4.0)
                    </a>
                  ) : (
                    selectedDatasetMeta.licensing
                  )}
                </span>
              </div>
            </div>

            {selectedDatasetMeta.is_genuine_public && (
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 text-[11px]">
                <span className="font-semibold text-slate-200">Attribution:</span>{" "}
                {selectedDatasetMeta.provenance}
              </div>
            )}
              </>
            )}

            {selectedDatasetMeta.is_simulated && (
              <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-200 text-[11px] flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  <b>Synthetic Demonstration Warning:</b>{" "}
                  {selectedDatasetMeta.provenance}
                </span>
              </div>
            )}

            {selectedDatasetMeta.status_error && (
              <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-[11px]">
                {selectedDatasetMeta.status_error}
              </div>
            )}
          </div>
        )}

        {benchmarkError && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{benchmarkError}</span>
          </div>
        )}

        {/* Sub-Navigation between Accuracy/Partitions vs Per-Round Byte Communication Analysis */}
        {(multiSeedResult || partitionCompareResult || benchmarkResult) && !compressionCompareResult && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <SectionTabs
              activeTab={benchmarkViewTab}
              onChange={(id) => setBenchmarkViewTab(id as "summary" | "communication")}
              testIdPrefix="fl-result-tab"
              tabs={[
                { id: "summary", label: "Model Comparison & Distributions", icon: Scale },
                { id: "communication", label: "Communication Cost & Byte Accounting", icon: Radio },
              ]}
            />
            <span className="text-[11px] text-[#8C93A4]">
              Switch views to inspect MAE/RMSE vs. per-round byte telemetry
            </span>
          </div>
        )}

        {/* Reproducible Multi-Seed Experiment Results (Default: Seeds 42, 123, 2026) */}
        {benchmarkViewTab === "summary" && multiSeedResult && (() => {
          const fmtNum = (val: number | null | undefined, digits = 4) =>
            val == null || !Number.isFinite(val) ? "—" : val.toFixed(digits);
          const fmtStdVal = (val: number | null | undefined, digits = 6) =>
            val == null || !Number.isFinite(val) ? "N/A (<2 runs)" : val.toFixed(digits);

          const cGroup: MultiSeedGroupResult | undefined = multiSeedResult.groups.centralized;
          const iidGroup: MultiSeedGroupResult | undefined = multiSeedResult.groups.iid;
          const nonIidGroup: MultiSeedGroupResult | undefined = multiSeedResult.groups.non_iid;

          const cardDefs: Array<{
            key: string;
            title: string;
            borderClass: string;
            accentClass: string;
            subBadge: string;
            group: MultiSeedGroupResult | undefined;
          }> = [
            {
              key: "centralized",
              title: "Centralized Baseline",
              borderClass: "border-rose-500/30",
              accentClass: "text-rose-300",
              subBadge: "Unified Matrix (Deterministic)",
              group: cGroup,
            },
            {
              key: "iid",
              title: "FedAvg — IID Partition",
              borderClass: "border-blue-500/30",
              accentClass: "text-blue-300",
              subBadge: "Seeded Uniform Split",
              group: iidGroup,
            },
            {
              key: "non_iid",
              title: "FedAvg — Non-IID Corridors",
              borderClass: "border-amber-500/30",
              accentClass: "text-amber-300",
              subBadge: "Physical Corridors (Deterministic)",
              group: nonIidGroup,
            },
          ].filter((item) => Boolean(item.group));

          const iidConv = iidGroup?.aggregated_convergence || [];
          const nonIidConv = nonIidGroup?.aggregated_convergence || [];
          const convMap = new Map<number, any>();
          for (const row of iidConv) {
            convMap.set(row.round, {
              round: `R${row.round}`,
              roundNum: row.round,
              iid_mean_mae: row.mean_mae != null ? Number(row.mean_mae.toFixed(6)) : null,
              iid_std_mae: row.std_mae,
              iid_min_mae: row.min_mae,
              iid_max_mae: row.max_mae,
              iid_mean_rmse: row.mean_rmse != null ? Number(row.mean_rmse.toFixed(6)) : null,
              iid_std_rmse: row.std_rmse,
              completed_seeds_count: row.completed_seeds_count,
            });
          }
          for (const row of nonIidConv) {
            const existing = convMap.get(row.round) || { round: `R${row.round}`, roundNum: row.round };
            convMap.set(row.round, {
              ...existing,
              non_iid_mean_mae: row.mean_mae != null ? Number(row.mean_mae.toFixed(6)) : null,
              non_iid_std_mae: row.std_mae,
              non_iid_min_mae: row.min_mae,
              non_iid_max_mae: row.max_mae,
              non_iid_mean_rmse: row.mean_rmse != null ? Number(row.mean_rmse.toFixed(6)) : null,
              non_iid_std_rmse: row.std_rmse,
              completed_seeds_count: Math.min(
                existing.completed_seeds_count ?? row.completed_seeds_count,
                row.completed_seeds_count
              ),
            });
          }
          const aggChartData = Array.from(convMap.values()).sort((a, b) => a.roundNum - b.roundNum);

          return (
            <div className="space-y-5 pt-1">
              {renderProvenanceBanner(
                multiSeedResult.is_simulated,
                multiSeedResult.is_genuine_public,
                multiSeedResult.dataset_name,
                multiSeedResult.prediction_target,
                `${multiSeedResult.seeds.length}-Seed Study (${multiSeedResult.seeds.join(", ")})`
              )}

              {/* Completion & Sample Standard Deviation Parity Bar */}
              <div className="p-3 rounded-xl bg-[#161920] border border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                <div className="flex flex-wrap items-center gap-2">
                  {multiSeedResult.is_complete ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <span className="font-semibold text-white">
                    {multiSeedResult.is_complete
                      ? `Completed (${multiSeedResult.successful_runs_count}/${multiSeedResult.seeds.length} Independent Runs)`
                      : `Incomplete (${multiSeedResult.successful_runs_count}/${multiSeedResult.seeds.length} Completed)`}
                  </span>
                  <span>•</span>
                  <span className="font-mono text-amber-300">
                    Seeds: [{multiSeedResult.seeds.join(", ")}]
                  </span>
                  <span>•</span>
                  <span>{multiSeedResult.experiment_config?.federated_rounds} FedAvg Rounds</span>
                  <span>•</span>
                  <span>{multiSeedResult.target_horizon_minutes}m Horizon</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                  Aggregates across {multiSeedResult.seeds.length} independent runs • Sample SD (ddof=1) • Rounded for display only
                </span>
              </div>

              {multiSeedResult.warning_message && (
                <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-700/70 text-amber-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{multiSeedResult.warning_message}</span>
                </div>
              )}

              {/* Group Aggregate Summary Cards: Mean ± Sample SD */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {cardDefs.map(({ key, title, borderClass, accentClass, subBadge, group }) => {
                  if (!group) return null;
                  const s = group.summary;
                  return (
                    <div key={key} className={`p-4 rounded-xl bg-white/5 border ${borderClass} space-y-2.5`}>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400 font-semibold">
                        <span>{title}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            group.is_complete
                              ? "bg-slate-800 text-slate-300"
                              : "bg-amber-950/80 text-amber-300 border border-amber-700"
                          }`}
                        >
                          {group.is_complete
                            ? `${group.successful_runs_count}/${group.requested_runs_count} Runs`
                            : `INCOMPLETE ${group.successful_runs_count}/${group.requested_runs_count}`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase block">
                            Mean MAE ± SD
                          </span>
                          <span className={`text-lg font-bold font-mono ${accentClass}`}>
                            {fmtNum(s.mean_mae, 4)}
                          </span>
                          <span className="block text-[11px] font-mono text-slate-400">
                            ± {fmtStdVal(s.std_mae, 6)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase block">
                            Mean RMSE ± SD
                          </span>
                          <span className="text-lg font-bold font-mono text-slate-200">
                            {fmtNum(s.mean_rmse, 4)}
                          </span>
                          <span className="block text-[11px] font-mono text-slate-400">
                            ± {fmtStdVal(s.std_rmse, 6)}
                          </span>
                        </div>
                      </div>

                      {s.mean_final_round_mae != null && (
                        <div className="pt-2 border-t border-white/10 text-[11px] text-slate-400 flex items-center justify-between gap-2">
                          <span>Final-Round MAE:</span>
                          <span className="font-mono text-slate-200">
                            {fmtNum(s.mean_final_round_mae, 4)} ± {fmtStdVal(s.std_final_round_mae, 6)}
                          </span>
                        </div>
                      )}

                      <div className="pt-1 text-[10px] text-slate-500 flex items-center justify-between">
                        <span>{subBadge}</span>
                        <span>{multiSeedResult.target_unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Aggregated Round-by-Round Convergence Chart */}
              {aggChartData.length > 0 && (
                <div className="p-4 rounded-xl bg-[#161920] border border-white/[0.08] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        Aggregated Multi-Seed Convergence ({aggChartData[0]?.completed_seeds_count ?? 0} Matching Successful Seeds per Round)
                      </span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Mean Test MAE ({multiSeedResult.target_unit}) across Rounds
                    </span>
                  </div>

                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={aggChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={TFL_CHART_THEME.gridStroke} />
                        <XAxis dataKey="round" stroke={TFL_CHART_THEME.axisStroke} fontSize={11} />
                        <YAxis stroke={TFL_CHART_THEME.axisStroke} fontSize={11} domain={["auto", "auto"]} />
                        <Tooltip
                          contentStyle={TFL_CHART_THEME.tooltipStyle}
                          formatter={(value: any, name: any) => [`${Number(value).toFixed(4)} ${multiSeedResult.target_unit}`, name]}
                        />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        {iidConv.length > 0 && (
                          <Line
                            type="monotone"
                            dataKey="iid_mean_mae"
                            name="IID Mean MAE"
                            stroke="#3B82F6"
                            strokeWidth={2.5}
                            dot={{ r: 4 }}
                            isAnimationActive={false}
                          />
                        )}
                        {nonIidConv.length > 0 && (
                          <Line
                            type="monotone"
                            dataKey="non_iid_mean_mae"
                            name="Non-IID Mean MAE"
                            stroke="#F59E0B"
                            strokeWidth={2.5}
                            dot={{ r: 4 }}
                            isAnimationActive={false}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Round-by-Round Mean ± SD & Min-Max Spread Table */}
                  <div className="overflow-x-auto no-scrollbar rounded-lg border border-white/10">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-white/5 text-slate-400 uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Round</th>
                          <th className="px-3 py-2">Matched Seeds</th>
                          {iidConv.length > 0 && <th className="px-3 py-2">IID Mean MAE ± SD</th>}
                          {iidConv.length > 0 && <th className="px-3 py-2">IID Mean RMSE ± SD</th>}
                          {nonIidConv.length > 0 && <th className="px-3 py-2">Non-IID Mean MAE ± SD</th>}
                          {nonIidConv.length > 0 && <th className="px-3 py-2">Non-IID Mean RMSE ± SD</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono text-slate-200">
                        {aggChartData.map((row) => (
                          <tr key={row.roundNum}>
                            <td className="px-3 py-1.5 font-semibold text-white">{row.round}</td>
                            <td className="px-3 py-1.5 text-slate-400">{row.completed_seeds_count}</td>
                            {iidConv.length > 0 && (
                              <td className="px-3 py-1.5 text-blue-300">
                                {fmtNum(row.iid_mean_mae, 4)} ± {fmtStdVal(row.iid_std_mae, 6)}
                              </td>
                            )}
                            {iidConv.length > 0 && (
                              <td className="px-3 py-1.5 text-blue-200">
                                {fmtNum(row.iid_mean_rmse, 4)} ± {fmtStdVal(row.iid_std_rmse, 6)}
                              </td>
                            )}
                            {nonIidConv.length > 0 && (
                              <td className="px-3 py-1.5 text-amber-300">
                                {fmtNum(row.non_iid_mean_mae, 4)} ± {fmtStdVal(row.non_iid_std_mae, 6)}
                              </td>
                            )}
                            {nonIidConv.length > 0 && (
                              <td className="px-3 py-1.5 text-amber-200">
                                {fmtNum(row.non_iid_mean_rmse, 4)} ± {fmtStdVal(row.non_iid_std_rmse, 6)}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Individual Seed Results Breakdown Table */}
              <div className="p-4 rounded-xl bg-[#161920] border border-white/[0.08] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Individual Seed Experiment Results ({multiSeedResult.seeds.length} Independent Executions)</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    Each seed runs fresh chronological splits & model training (no cached results)
                  </span>
                </div>
                <div className="overflow-x-auto no-scrollbar rounded-lg border border-white/10">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-white/5 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="px-3 py-2">Seed</th>
                        <th className="px-3 py-2">Centralized MAE / RMSE</th>
                        {iidGroup && <th className="px-3 py-2">IID MAE / RMSE</th>}
                        {iidGroup && <th className="px-3 py-2">IID Final Round MAE</th>}
                        {nonIidGroup && <th className="px-3 py-2">Non-IID MAE / RMSE</th>}
                        {nonIidGroup && <th className="px-3 py-2">Non-IID Final Round MAE</th>}
                        <th className="px-3 py-2">Run Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono text-slate-200">
                      {multiSeedResult.seeds.map((seedVal, idx) => {
                        const cRun = cGroup?.per_seed_results[idx];
                        const iRun = iidGroup?.per_seed_results[idx];
                        const nRun = nonIidGroup?.per_seed_results[idx];
                        const allOk =
                          cRun?.status === "success" &&
                          (!iidGroup || iRun?.status === "success") &&
                          (!nonIidGroup || nRun?.status === "success");
                        const errNote = [cRun?.error, iRun?.error, nRun?.error].filter(Boolean).join(" | ");

                        return (
                          <tr key={seedVal}>
                            <td className="px-3 py-2 font-bold text-amber-300">Seed {seedVal}</td>
                            <td className="px-3 py-2 text-rose-300">
                              {cRun?.status === "success"
                                ? `${fmtNum(cRun.mae, 4)} / ${fmtNum(cRun.rmse, 4)}`
                                : `FAILED`}
                            </td>
                            {iidGroup && (
                              <td className="px-3 py-2 text-blue-300">
                                {iRun?.status === "success"
                                  ? `${fmtNum(iRun.mae, 4)} / ${fmtNum(iRun.rmse, 4)}`
                                  : `FAILED`}
                              </td>
                            )}
                            {iidGroup && (
                              <td className="px-3 py-2 text-blue-200">
                                {iRun?.status === "success" ? fmtNum(iRun.final_round_mae, 4) : "—"}
                              </td>
                            )}
                            {nonIidGroup && (
                              <td className="px-3 py-2 text-amber-300">
                                {nRun?.status === "success"
                                  ? `${fmtNum(nRun.mae, 4)} / ${fmtNum(nRun.rmse, 4)}`
                                  : `FAILED`}
                              </td>
                            )}
                            {nonIidGroup && (
                              <td className="px-3 py-2 text-amber-200">
                                {nRun?.status === "success" ? fmtNum(nRun.final_round_mae, 4) : "—"}
                              </td>
                            )}
                            <td className="px-3 py-2">
                              {allOk ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 text-[10px]">
                                  Success
                                </span>
                              ) : (
                                <span
                                  className="px-2 py-0.5 rounded bg-rose-950/70 border border-rose-700/60 text-rose-300 text-[10px]"
                                  title={errNote}
                                >
                                  Failed: {errNote || "Error"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Determinism, Statistical Formula & Provenance Footnote */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-400 space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  <span>Multi-Seed Statistical Summary, Determinism Scope & Attribution:</span>
                </div>
                <p className="leading-relaxed text-slate-300">
                  {multiSeedResult.comparison_summary?.scientific_summary} Sample standard deviation (ddof=1) is computed across the {multiSeedResult.seeds.length} independent seed runs using unrounded full-precision error metrics. Analytical Centralized Ridge regression, physical Non-IID corridor grouping, zero global weight initialization, and full-batch local GD are deterministic across seeds (yielding 0.000000 SD); IID uniform train-window sharding varies across seeds.
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-slate-500 text-[10px]">
                  <span><b>Dataset:</b> {multiSeedResult.dataset_name}</span>
                  <span>•</span>
                  <span><b>Data Type:</b> {multiSeedResult.data_type_label || (multiSeedResult.is_simulated ? "Synthetic" : "Public")}</span>
                  {multiSeedResult.dataset_license && (
                    <>
                      <span>•</span>
                      <span><b>Licence:</b> {multiSeedResult.dataset_license}</span>
                    </>
                  )}
                  <span>•</span>
                  <span><b>Provenance:</b> {multiSeedResult.dataset_provenance}</span>
                  <span>•</span>
                  <span><b>ID:</b> {multiSeedResult.experiment_id}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Side-by-Side Controlled IID vs Non-IID Comparison Results */}
        {benchmarkViewTab === "summary" && partitionCompareResult && (
          <div className="space-y-5 pt-1">
            {renderProvenanceBanner(
              partitionCompareResult.is_simulated,
              partitionCompareResult.is_genuine_public,
              partitionCompareResult.dataset_name,
              partitionCompareResult.prediction_target,
              `IID vs Non-IID • Seed ${partitionCompareResult.random_seed}`
            )}

            {/* Controlled Fairness Parameter Bar */}
            <div className="p-3 rounded-xl bg-[#161920] border border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold text-white">Controlled Experimental Parity:</span>
                <span>{partitionCompareResult.shared_config?.num_clients} Virtual Clients</span>
                <span>•</span>
                <span>{partitionCompareResult.target_horizon_minutes}m Horizon</span>
                <span>•</span>
                <span>{partitionCompareResult.shared_config?.federated_rounds} FedAvg Rounds</span>
                <span>•</span>
                <span className="font-mono text-amber-300">Seed {partitionCompareResult.random_seed}</span>
              </div>
              <span className="text-[10px] text-emerald-300 font-semibold">
                Centralized Baseline Independent of Client Partitioning
              </span>
            </div>

            {/* 3-Way Comparison Cards: Centralized vs IID FedAvg vs Non-IID FedAvg */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Centralized Reference */}
              <div className="p-4 rounded-xl bg-white/5 border border-rose-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                  <span>Centralized Baseline</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 font-mono">
                    {partitionCompareResult.target_unit}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Test MAE</span>
                    <span className="text-xl font-bold font-mono text-rose-300">
                      {partitionCompareResult.centralized.mae}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase block">Test RMSE</span>
                    <span className="text-xl font-bold font-mono text-rose-200">
                      {partitionCompareResult.centralized.rmse}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Raw Data Upload:</span>
                  <span className="font-mono font-semibold text-rose-300">
                    {partitionCompareResult.centralized.data_transmitted_formatted}
                  </span>
                </div>
              </div>

              {/* FedAvg IID */}
              <div className="p-4 rounded-xl bg-white/5 border border-blue-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                  <span>FedAvg — IID Partition</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 font-mono">
                    CV {partitionCompareResult.comparison_summary.iid_flow_heterogeneity_cv_pct}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Test MAE</span>
                    <span className="text-xl font-bold font-mono text-blue-300">
                      {partitionCompareResult.iid.federated.mae}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase block">Test RMSE</span>
                    <span className="text-xl font-bold font-mono text-blue-200">
                      {partitionCompareResult.iid.federated.rmse}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                  <span>vs. Centralized / Tx:</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {partitionCompareResult.iid.delta.mae_delta > 0 ? "+" : ""}
                    {partitionCompareResult.iid.delta.mae_delta} • {partitionCompareResult.iid.federated.data_transmitted_formatted}
                  </span>
                </div>
              </div>

              {/* FedAvg Non-IID */}
              <div className="p-4 rounded-xl bg-white/5 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                  <span>FedAvg — Non-IID Corridors</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 font-mono">
                    CV {partitionCompareResult.comparison_summary.non_iid_flow_heterogeneity_cv_pct}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Test MAE</span>
                    <span className="text-xl font-bold font-mono text-amber-300">
                      {partitionCompareResult.non_iid.federated.mae}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase block">Test RMSE</span>
                    <span className="text-xl font-bold font-mono text-amber-200">
                      {partitionCompareResult.non_iid.federated.rmse}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Non-IID − IID MAE:</span>
                  <span className="font-mono font-semibold text-amber-300">
                    {partitionCompareResult.comparison_summary.non_iid_minus_iid_mae > 0 ? "+" : ""}
                    {partitionCompareResult.comparison_summary.non_iid_minus_iid_mae} {partitionCompareResult.target_unit}
                  </span>
                </div>
              </div>
            </div>

            {/* Side-by-Side Convergence & Client Flow Distribution Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">
                  Convergence Comparison: IID vs. Non-IID Test MAE ({partitionCompareResult.target_unit})
                </span>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={(partitionCompareResult.iid.federated.round_history || []).map((pt, idx) => ({
                        round: `R${pt.round}`,
                        IID_MAE: pt.test_mae,
                        NonIID_MAE: partitionCompareResult.non_iid.federated.round_history?.[idx]?.test_mae ?? pt.test_mae,
                        Centralized_MAE: partitionCompareResult.centralized.mae,
                      }))}
                      margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={TFL_CHART_THEME.gridStroke} />
                      <XAxis dataKey="round" stroke={TFL_CHART_THEME.axisStroke} fontSize={11} />
                      <YAxis stroke={TFL_CHART_THEME.axisStroke} fontSize={11} />
                      <Tooltip contentStyle={TFL_CHART_THEME.tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Line type="monotone" dataKey="IID_MAE" name="FedAvg IID MAE" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} />
                      <Line type="monotone" dataKey="NonIID_MAE" name="FedAvg Non-IID MAE" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} />
                      <Line type="monotone" dataKey="Centralized_MAE" name="Centralized Ref" stroke="#F43F5E" strokeDasharray="5 5" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">
                  Per-Client Training Mean Flow: IID Uniform vs. Non-IID Corridor Shift ({partitionCompareResult.target_unit})
                </span>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={partitionCompareResult.non_iid.client_statistics.map((nc, idx) => ({
                        client: nc.client_id.replace("pems08_", ""),
                        IID_Mean: partitionCompareResult.iid.client_statistics[idx]?.flow_mean ?? 0,
                        NonIID_Mean: nc.flow_mean,
                      }))}
                      margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={TFL_CHART_THEME.gridStroke} />
                      <XAxis dataKey="client" stroke={TFL_CHART_THEME.axisStroke} fontSize={11} />
                      <YAxis stroke={TFL_CHART_THEME.axisStroke} fontSize={11} />
                      <Tooltip contentStyle={TFL_CHART_THEME.tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="IID_Mean" name="IID Mean Flow" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="NonIID_Mean" name="Non-IID Mean Flow" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Per-Client Distribution Statistics Panels (IID & Non-IID) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {renderClientDistributionPanel(
                "IID Client Partitions (Uniform Sampled Train Windows)",
                partitionCompareResult.iid.client_statistics,
                partitionCompareResult.iid.distribution_analysis
              )}
              {renderClientDistributionPanel(
                "Non-IID Client Partitions (Physical Traffic Corridors)",
                partitionCompareResult.non_iid.client_statistics,
                partitionCompareResult.non_iid.distribution_analysis
              )}
            </div>

            {/* Scientific Findings & Attribution Footnote */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-400 space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span>Controlled Comparison Summary, Assumptions & Attribution:</span>
              </div>
              <p className="leading-relaxed text-slate-300">
                {partitionCompareResult.comparison_summary.scientific_summary} Note: Clients are virtual partitions of the selected traffic dataset rather than physical roadside hardware.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-slate-500 text-[10px]">
                <span><b>Dataset:</b> {partitionCompareResult.dataset_name}</span>
                <span>•</span>
                <span><b>Data Type:</b> {partitionCompareResult.data_type_label || (partitionCompareResult.is_simulated ? "Synthetic" : "Public")}</span>
                {partitionCompareResult.dataset_license && (
                  <>
                    <span>•</span>
                    <span><b>Licence:</b> {partitionCompareResult.dataset_license}</span>
                  </>
                )}
                <span>•</span>
                <span><b>Provenance:</b> {partitionCompareResult.dataset_provenance}</span>
                <span>•</span>
                <span><b>ID:</b> {partitionCompareResult.experiment_id}</span>
              </div>
            </div>
          </div>
        )}

        {/* Single-Strategy Benchmark Results Display */}
        {benchmarkViewTab === "summary" && benchmarkResult && (
          <div className="space-y-5 pt-1">
            {/* Explicit Public vs Synthetic Demonstration Provenance Banner */}
            {renderProvenanceBanner(
              benchmarkResult.is_simulated,
              benchmarkResult.is_genuine_public,
              benchmarkResult.dataset_name,
              benchmarkResult.prediction_target,
              `${benchmarkResult.partition_strategy === "iid" ? "IID" : "Non-IID"} • Seed ${benchmarkResult.random_seed ?? 42}`
            )}

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
                    {benchmarkResult.target_unit || "veh/15m"}
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
                    <td className="py-2.5 px-3 font-mono text-rose-300">{benchmarkResult.centralized.mae} {benchmarkResult.target_unit || "veh/15m"}</td>
                    <td className="py-2.5 px-3 font-mono text-blue-300">{benchmarkResult.federated.mae} {benchmarkResult.target_unit || "veh/15m"}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">Δ {benchmarkResult.delta.mae_delta > 0 ? "+" : ""}{benchmarkResult.delta.mae_delta} ({benchmarkResult.delta.mae_delta_pct > 0 ? "+" : ""}{benchmarkResult.delta.mae_delta_pct}%)</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">Dispersion (RMSE)</td>
                    <td className="py-2.5 px-3 font-mono text-rose-300">{benchmarkResult.centralized.rmse} {benchmarkResult.target_unit || "veh/15m"}</td>
                    <td className="py-2.5 px-3 font-mono text-blue-300">{benchmarkResult.federated.rmse} {benchmarkResult.target_unit || "veh/15m"}</td>
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
                        : "Asymmetric Compressed Exch."}
                    </td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">Training / Test Sample Split</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{benchmarkResult.centralized.train_samples_count.toLocaleString()} train / {benchmarkResult.centralized.test_samples_count.toLocaleString()} test</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{benchmarkResult.federated.train_samples_count.toLocaleString()} train / {benchmarkResult.federated.test_samples_count.toLocaleString()} test</td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-400">Identical 80/20 Holdout Split</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">Participating Nodes</td>
                    <td className="py-2.5 px-3 text-slate-300">
                      Central cloud server ingests {benchmarkResult.sensors_count ?? 8} {benchmarkResult.is_genuine_public ? "freeway detectors" : "nodes"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {benchmarkResult.federated.participating_clients} {benchmarkResult.is_genuine_public ? "Corridor Zones (PEMS08-S000..S169)" : "Edge Clients (CBD, Arterial, Tech)"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {benchmarkResult.is_genuine_public ? "Deterministic corridor partitions" : "Local non-IID partitions"}
                    </td>
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
                      <CartesianGrid strokeDasharray="3 3" stroke={TFL_CHART_THEME.gridStroke} />
                      <XAxis dataKey="metric" stroke={TFL_CHART_THEME.axisStroke} fontSize={11} />
                      <YAxis stroke={TFL_CHART_THEME.axisStroke} fontSize={11} />
                      <Tooltip contentStyle={TFL_CHART_THEME.tooltipStyle} />
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
                      <CartesianGrid strokeDasharray="3 3" stroke={TFL_CHART_THEME.gridStroke} />
                      <XAxis dataKey="name" stroke={TFL_CHART_THEME.axisStroke} fontSize={11} />
                      <YAxis stroke={TFL_CHART_THEME.axisStroke} fontSize={11} unit=" KB" />
                      <Tooltip contentStyle={TFL_CHART_THEME.tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="Centralized_KB" name="Centralized Raw Data (KB)" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Federated_KB" name="Federated Model Updates (KB)" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Per-Client Distribution Statistics Panel */}
            {renderClientDistributionPanel(
              `${benchmarkResult.partition_strategy === "iid" ? "IID" : "Non-IID Corridor"} Client Partitions (Seed ${benchmarkResult.random_seed ?? 42})`,
              benchmarkResult.client_statistics,
              benchmarkResult.distribution_analysis
            )}

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
                <span><b>Strategy:</b> {benchmarkResult.partition_strategy === "iid" ? "IID (Uniform Seeded)" : "Non-IID (Physical Corridors)"}</span>
                <span>•</span>
                <span><b>Seed:</b> {benchmarkResult.random_seed ?? 42}</span>
                <span>•</span>
                <span><b>Data Type:</b> {benchmarkResult.data_type_label || (benchmarkResult.is_simulated ? "Synthetic" : "Public")}</span>
                {benchmarkResult.dataset_license && (
                  <>
                    <span>•</span>
                    <span><b>Licence:</b> {benchmarkResult.dataset_license}</span>
                  </>
                )}
                <span>•</span>
                <span><b>Provenance:</b> {benchmarkResult.dataset_provenance}</span>
                <span>•</span>
                <span><b>ID:</b> {benchmarkResult.benchmark_id}</span>
              </div>
            </div>
          </div>
        )}

        {/* 4-Way Compression Experiment Banner & Scientific Summary */}
        {compressionCompareResult && (
          <div className="space-y-4 pt-1">
            {renderProvenanceBanner(
              compressionCompareResult.is_simulated,
              compressionCompareResult.is_genuine_public,
              compressionCompareResult.dataset_name,
              compressionCompareResult.prediction_target,
              `4-Way Compression • ${compressionCompareResult.partition_strategy.toUpperCase()} • Seed ${compressionCompareResult.random_seed}`
            )}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                <span>Controlled Compression Experiment Summary:</span>
              </div>
              <p>{compressionCompareResult.scientific_summary}</p>
            </div>
          </div>
        )}

        {/* Per-Round & Cumulative Communication Cost & Convergence Section (All Prompt 4 Views) */}
        {(compressionCompareResult || benchmarkViewTab === "communication") &&
          renderCommunicationAnalysisSection()}
      </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: FEDERATED ROUND WORKFLOW PROGRESS & TOPOLOGY                   */}
      {/* ========================================================================= */}
      {labSectionTab === "edge_fleet" && (
      <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif font-medium text-base sm:text-lg text-slate-900 dark:text-white">
              {isHindi ? `फेडरेटेड राउंड ${currentRound} स्थिति` : `Federated Round ${currentRound} Status`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#8E939E]">
              {isHindi ? "सैंपल-वेटेड FedAvg एकत्रीकरण एल्गोरिथ्म" : "Sample-count-weighted FedAvg aggregation algorithm"}
            </p>
          </div>
          <button
            onClick={handleRunRound}
            disabled={isTraining}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#B4D2FC] text-white dark:text-[#0A0D14] font-semibold text-xs sm:text-sm shadow-sm transition-colors disabled:opacity-50 shrink-0 self-start sm:self-auto cursor-pointer"
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
              className={`p-3 rounded-xl border transition-colors text-xs flex items-center gap-2.5 ${
                activeStep === s.step
                  ? "bg-blue-50 dark:bg-[#9AC2FA]/12 border-blue-500 dark:border-[#9AC2FA]/60 text-blue-700 dark:text-[#9AC2FA] font-semibold"
                  : activeStep > s.step
                  ? "bg-emerald-50 dark:bg-emerald-950/25 border-emerald-300 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300"
                  : "bg-slate-50 dark:bg-[#161920] border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-[#8C93A4]"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  activeStep === s.step
                    ? "bg-blue-600 text-white dark:bg-[#9AC2FA] dark:text-[#0A0D14]"
                    : activeStep > s.step
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-300 dark:bg-[#1B1D22] text-slate-700 dark:text-[#C5C8D0]"
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
      <div className="p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] space-y-6">
        <h3 className="font-serif font-medium text-base sm:text-lg text-slate-900 dark:text-white">
          {isHindi ? "फेडरेटेड क्लाइंट-सर्वर टोपोलॉजी" : "Federated Edge-to-Server Topology"}
        </h3>

        {/* Central Server Box */}
        <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-900 dark:bg-[#161920] text-white border border-blue-500/30 dark:border-[#9AC2FA]/30 shadow-sm text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-blue-600 dark:bg-[#9AC2FA]/15 border border-transparent dark:border-[#9AC2FA]/30 flex items-center justify-center text-white dark:text-[#9AC2FA]">
            <Server className="w-6 h-6" />
          </div>
          <h4 className="font-serif font-medium text-base text-white">
            {isHindi ? "केंद्रीय FedAvg एकत्रीकरण सर्वर" : "Central FedAvg Aggregation Server"}
          </h4>
          <p className="text-[11px] text-blue-300 dark:text-[#9AC2FA] font-mono">
            W_global = Σ (n_k / Σ n_j) × W_k
          </p>
          <div className="flex justify-center items-center gap-4 text-[11px] pt-1 text-slate-300 dark:text-[#C5C8D0]">
            <span>Round: <b>{currentRound}</b></span>
            <span>•</span>
            <span>Test MAE: <b>{lastRoundResult?.test_mae ?? "18.4"}</b></span>
          </div>
        </div>

        {/* Dynamic Transmission Arrows */}
        <div className="flex justify-center text-blue-500 dark:text-[#9AC2FA]">
          <div className="flex items-center gap-8 sm:gap-16">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-[#8E939E]">
                {mode === "federated" ? "Model Parameters (Top-K / INT8)" : "Raw Observations Stream"}
              </span>
              <ArrowDown className={`w-5 h-5 ${isTraining ? "text-blue-600 dark:text-[#9AC2FA]" : ""}`} />
            </div>
          </div>
        </div>

        {/* 3 Edge Clients Grid with DYNAMIC TELEMETRY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {clients.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-3 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-500 dark:text-[#9AC2FA]" />
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    {isHindi ? c.name_hi : c.name}
                  </span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 dark:text-[#C5C8D0]">
                <div className="flex justify-between">
                  <span className="text-slate-400 dark:text-[#8E939E]">{isHindi ? "स्थानीय सैंपल्स:" : "Local Samples (n_k):"}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{c.local_samples}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 dark:text-[#8E939E]">{isHindi ? "नेटवर्क लेटेंसी:" : "Network Latency:"}</span>
                  <span className="font-mono">{c.network_latency} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 dark:text-[#8E939E]">{isHindi ? "स्थानीय ट्रेनिंग लॉस:" : "Local Loss:"}</span>
                  <span className="font-mono text-blue-600 dark:text-[#9AC2FA] font-semibold">
                    {c.last_loss != null ? (
                      c.last_loss
                    ) : (
                      <span className="text-amber-500 font-medium text-[11px]">{isHindi ? "लंबित" : "Pending"}</span>
                    )}
                  </span>
                </div>
                {/* Dynamically bound transmitted payload from actual backend measurements */}
                <div className="flex justify-between pt-1 border-t border-slate-200/60 dark:border-white/[0.07]">
                  <span className="text-slate-400 dark:text-[#8E939E]">{isHindi ? "ट्रांसमिटेड पेलोड:" : "Measured Payload:"}</span>
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
                  <span className="text-slate-400 dark:text-[#8E939E]">{isHindi ? "संचयी पेलोड:" : "Cumulative:"}</span>
                  <span className="font-mono text-slate-600 dark:text-[#C5C8D0]">
                    {c.cumulative_bytes != null ? (
                      `${(c.cumulative_bytes / 1024).toFixed(1)} KB`
                    ) : (
                      <span className="text-amber-500 font-medium text-[11px]">{isHindi ? "लंबित" : "Pending"}</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-white dark:bg-[#111318] border border-transparent dark:border-white/[0.06] text-[10px] text-slate-500 dark:text-[#8E939E] flex items-center justify-between">
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
      <div className="p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)]">
        <h3 className="font-serif font-medium text-base sm:text-lg text-slate-900 dark:text-white mb-1">
          {isHindi ? "फेडरेटेड कन्वर्जेंस वक्र (Global Loss & Test MAE)" : "Federated Model Convergence Across Rounds"}
        </h3>
        <p className="text-xs text-slate-500 dark:text-[#8E939E] mb-4">
          {isHindi ? "FedAvg एकत्रीकरण के साथ त्रुटि में निरंतर कमी" : "Chronological reduction in global loss and test MAE error over FedAvg rounds"}
        </p>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lossHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke={TFL_CHART_THEME.gridStroke} />
              <XAxis dataKey="round" stroke={TFL_CHART_THEME.axisStroke} fontSize={11} />
              <YAxis stroke={TFL_CHART_THEME.axisStroke} fontSize={11} />
              <Tooltip contentStyle={TFL_CHART_THEME.tooltipStyle} />
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
      )}
    </div>
  );
};

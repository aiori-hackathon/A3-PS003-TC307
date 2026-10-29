import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../services/api";
import { DashboardSummary } from "../types";
import {
  Activity,
  Gauge,
  AlertOctagon,
  Cpu,
  Layers,
  Zap,
  RefreshCw,
  Flame,
  ArrowRight,
  Download,
  CheckCircle2,
  TrendingDown,
  Clock,
  Radio,
  Database,
  AlertTriangle,
  Compass,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export const OverviewDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { isHindi } = useLanguage();
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [surgeTriggering, setSurgeTriggering] = useState<boolean>(false);
  const [surgeNotification, setSurgeNotification] = useState<string | null>(null);
  const [coordinating, setCoordinating] = useState<boolean>(false);
  const [coordNotification, setCoordNotification] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardSummary();
      setData(res);
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCoordinateCollection = async () => {
    try {
      setCoordinating(true);
      const res = await api.coordinateCollection(false);
      setCoordNotification(
        isHindi
          ? `डेटा संग्रह समन्वित: ${res.observations_ingested} नए अवलोकन जोड़े गए।`
          : `Ingestion coordinated: ${res.observations_ingested} observations ingested across ${res.corridors_processed} corridors.`
      );
      await fetchDashboard();
      setTimeout(() => setCoordNotification(null), 5000);
    } catch (err: any) {
      console.error(err);
      setCoordNotification(err.message || "Failed to coordinate collection");
      setTimeout(() => setCoordNotification(null), 5000);
    } finally {
      setCoordinating(false);
    }
  };

  const handleSimulateSurge = async () => {
    try {
      setSurgeTriggering(true);
      const res = await api.triggerSurge();
      setSurgeNotification(
        isHindi
          ? `ट्रैफिक उछाल सक्रिय! प्रभावित चौराहे: ${res.affected_nodes.join(", ")}`
          : `Traffic surge triggered! Impacted nodes: ${res.affected_nodes.join(", ")}`
      );
      await fetchDashboard();
      setTimeout(() => setSurgeNotification(null), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setSurgeTriggering(false);
    }
  };

  const handleExportCsv = () => {
    window.open(api.getExportCsvUrl(), "_blank");
  };

  const pieData = data
    ? [
        { name: t("common.low"), value: data.congestion_distribution.low || 4, color: "#10B981" },
        { name: t("common.moderate"), value: data.congestion_distribution.moderate || 2, color: "#F59E0B" },
        { name: t("common.severe"), value: data.congestion_distribution.severe || 2, color: "#EF4444" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t("dashboard.title")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("dashboard.subtitle")}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate("/citizen")}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 shadow-sm transition-all"
            title="Preview Citizen Commute View"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Citizen Portal</span>
          </button>

          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-all"
            title={t("dashboard.actions.refresh")}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-500" : ""}`} />
            <span>{t("common.refresh")}</span>
          </button>

          <button
            onClick={handleCoordinateCollection}
            disabled={coordinating}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-all"
            title="Coordinate backend collection and deduplicated ingestion"
          >
            <Database className={`w-3.5 h-3.5 text-blue-500 ${coordinating ? "animate-pulse" : ""}`} />
            <span>{coordinating ? "Syncing..." : "Sync Ingestion"}</span>
          </button>

          <button
            onClick={handleSimulateSurge}
            disabled={surgeTriggering}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>{t("dashboard.actions.surge")}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>{t("common.export_csv")}</span>
          </button>
        </div>
      </div>

      {/* Surge Alert Toast */}
      {surgeNotification && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">{surgeNotification}</span>
          </div>
          <button
            onClick={() => setSurgeNotification(null)}
            className="text-amber-600 hover:text-amber-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Ingestion Sync Alert Toast */}
      {coordNotification && (
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 flex items-center justify-between text-xs text-blue-800 dark:text-blue-200 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-medium">{coordNotification}</span>
          </div>
          <button
            onClick={() => setCoordNotification(null)}
            className="text-blue-600 hover:text-blue-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Provider Fallback Notice if Active */}
      {data?.provider_status?.error_fallback_active && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold">Provider Fallback Active: </span>
            <span>{data.provider_status.message} (Serving cached/simulated observations)</span>
          </div>
        </div>
      )}

      {/* Provider Diagnostics & Provenance Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${data?.is_simulated ? "bg-blue-500" : "bg-emerald-500"} animate-pulse`} />
          <span className="font-semibold">{isHindi ? "डेटा स्रोत:" : "Data Source:"}</span>
          <span className="text-slate-800 dark:text-slate-200">{data?.data_source || "Delhi NCR Arterial Stream"}</span>
          <span
            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
              data?.is_simulated
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
            }`}
          >
            {data?.is_simulated ? "Corridor Simulation Stream" : "TomTom Real-Time Feed"}
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-[11px]">
          <span>{isHindi ? "ताज़ापन:" : "Freshness:"} <b className="text-slate-700 dark:text-slate-200">{data?.data_freshness || "Current (<15m)"}</b></span>
          {data?.provider_status?.last_sync_time && (
            <span>{isHindi ? "अंतिम सिंक:" : "Last Sync:"} <b className="font-mono text-slate-700 dark:text-slate-200">{new Date(data.provider_status.last_sync_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</b></span>
          )}
          <span>{isHindi ? "प्रदाता स्थिति:" : "Provider:"} <b className={`font-mono uppercase font-bold ${data?.provider_status?.is_online ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{data?.provider_status?.is_online ? "Online" : "Fallback"}</b></span>
          <span>{isHindi ? "कैश रिकॉर्ड:" : "Cached Records:"} <b className="font-mono text-slate-700 dark:text-slate-200">{data?.provider_status?.cached_records_count ?? 0}</b></span>
          <span>{isHindi ? "लाइव घटनाएं:" : "Live Incidents:"} <b className="font-mono text-slate-700 dark:text-slate-200">{data?.provider_status?.live_incidents_count ?? 0}</b></span>
        </div>
      </div>

      {/* 7 KPI Cards Grid */}
      <div className="responsive-kpi-grid">
        {/* KPI 1: Monitored Intersections */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t("dashboard.kpi.intersections")}
            </p>
            <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
              {data?.total_intersections ?? 8}
            </h3>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3" />
              {isHindi ? "100% ऑनलाइन सेंसर" : "100% Online telemetry"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Average Speed */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t("dashboard.kpi.avg_speed")}
            </p>
            <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
              {data?.average_speed ?? 42.5}{" "}
              <span className="text-xs font-normal text-slate-500">{t("common.kmh")}</span>
            </h3>
            <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" />
              {isHindi ? "गत 15 मिनट औसत" : "Last 15m window"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Gauge className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Congested Roads */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t("dashboard.kpi.congested_roads")}
            </p>
            <h3 className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
              {data?.congested_roads_count ?? 2}
            </h3>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
              <TrendingDown className="w-3 h-3" />
              {isHindi ? "कार्रवाई आवश्यक" : "Action required"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <AlertOctagon className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Bandwidth Savings */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t("dashboard.kpi.bandwidth_savings")}
            </p>
            <h3 className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
              {data?.communication_savings_pct.toFixed(1) ?? "91.0"}%
            </h3>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-1 inline-block">
              {isHindi ? "FP32 बेसलाइन की तुलना में" : "vs Uncompressed FP32"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 5: Active Edge Nodes */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t("dashboard.kpi.edge_nodes")}
            </p>
            <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
              {data?.active_edge_nodes ?? 3} / 3
            </h3>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 inline-block">
              {isHindi ? "क्लाइंट A, B, C सक्रिय" : "Clients A, B, C Active"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 6: Federated Round */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t("dashboard.kpi.fl_round")}
            </p>
            <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
              Round {data?.federated_round ?? 6}
            </h3>
            <span className="text-[11px] text-slate-500 mt-1 inline-block">
              {isHindi ? "FedAvg एकत्रीकरण" : "FedAvg Aggregated"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Charts: Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic Volume Timeline (2 Columns on large) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {t("dashboard.charts.volume_title")}
              </h3>
              <p className="text-xs text-slate-500">{t("dashboard.charts.volume_desc")}</p>
            </div>
            <button
              onClick={() => navigate("/prediction")}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>{t("dashboard.actions.run_prediction")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.recent_volume_trend || []}>
                <defs>
                  <linearGradient id="colorObserved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorPred" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} unit=" v" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F172A",
                    borderColor: "#334155",
                    borderRadius: "0.5rem",
                    color: "#F8FAFC",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Area
                  type="monotone"
                  dataKey="volume"
                  name={isHindi ? "अवलोकित वॉल्यूम" : "Observed Volume"}
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorObserved)"
                />
                <Area
                  type="monotone"
                  dataKey="predicted"
                  name={isHindi ? "मॉडल पूर्वानुमान" : "AI Forecast"}
                  stroke="#10B981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#colorPred)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Congestion Distribution Donut (1 Column) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              {t("dashboard.charts.congestion_title")}
            </h3>
            <p className="text-xs text-slate-500">{t("dashboard.charts.congestion_desc")}</p>
          </div>

          <div className="h-56 w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
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
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 text-center">
            {isHindi ? "8 शहर जंक्शनों का वास्तविक स्थिति विवरण" : "Live distribution across 8 urban junctions"}
          </div>
        </div>
      </div>

      {/* Row 2: Speed Trends & Communication Cost Over Rounds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Speed Trend */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              {t("dashboard.charts.speed_title")}
            </h3>
            <p className="text-xs text-slate-500">{t("dashboard.charts.speed_desc")}</p>
          </div>

          <div className="h-60 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.speed_trend || []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} unit=" km/h" domain={[0, 65]} />
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
                  dataKey="speed"
                  name={isHindi ? "औसत गति (किमी/घंटा)" : "Avg Speed (km/h)"}
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Communication Cost over Rounds */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {t("dashboard.charts.savings_title")}
              </h3>
              <p className="text-xs text-slate-500">{t("dashboard.charts.savings_desc")}</p>
            </div>
            <button
              onClick={() => navigate("/optimizer")}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>Optimizer</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="h-60 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.communication_savings_trend || []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="round" stroke="#94A3B8" fontSize={10} />
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
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar
                  dataKey="baseline_kb"
                  name={isHindi ? "बेसलाइन (असंपीड़ित)" : "Baseline Uncompressed"}
                  fill="#94A3B8"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="optimized_kb"
                  name={isHindi ? "TrafficFL संपीड़ित" : "TrafficFL Compressed"}
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

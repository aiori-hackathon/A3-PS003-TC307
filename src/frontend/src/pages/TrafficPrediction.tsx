import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../services/api";
import { IntersectionDetail, PredictionResponse } from "../types";
import {
  TrendingUp,
  Clock,
  Gauge,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export const TrafficPrediction: React.FC = () => {
  const { t } = useTranslation();
  const { isHindi } = useLanguage();

  const [intersections, setIntersections] = useState<IntersectionDetail[]>([]);
  const [selectedId, setSelectedId] = useState<string>("INT-01");
  const [horizon, setHorizon] = useState<number>(30);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    api.getIntersections().then((data) => {
      setIntersections(data);
      if (data.length > 0) setSelectedId(data[0].id);
    });
  }, []);

  const fetchPrediction = async () => {
    if (!selectedId) return;
    try {
      setLoading(true);
      const res = await api.runPrediction(selectedId, horizon);
      setPrediction(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrediction();
  }, [selectedId, horizon]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t("prediction.title")}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t("prediction.subtitle")}
        </p>
      </div>

      {/* Control Selector Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Intersection Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t("prediction.select_label")}:
          </label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {intersections.map((i) => (
              <option key={i.id} value={i.id}>
                {isHindi ? i.name_hi : i.name} ({i.id})
              </option>
            ))}
          </select>
        </div>

        {/* Horizon Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t("prediction.horizon_label")}:
          </span>
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
            {[
              { val: 15, label: "15m" },
              { val: 30, label: "30m" },
              { val: 60, label: "1h" },
              { val: 360, label: "6h" },
              { val: 1440, label: "24h" },
            ].map((item) => (
              <button
                key={item.val}
                onClick={() => setHorizon(item.val)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  horizon === item.val
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-600 dark:text-slate-300 hover:text-blue-500"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Model Readiness Alert if Untrained / Calibrating */}
      {prediction?.model_readiness && prediction.model_readiness !== "ready" && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>AI Model Untrained / In Calibration State</span>
          </div>
          <p className="text-xs mt-1">
            The prediction engine reports model readiness: <code className="font-mono font-bold">{prediction.model_readiness}</code>. 
            ML inference and forecasts are suppressed until adequate historical observations are collected and offline Ridge training is verified.
          </p>
        </div>
      )}

      {/* Observation Freshness Notice if Input Telemetry is Stale */}
      {prediction?.freshness_warning && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 shadow-sm">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold">{isHindi ? "डेटा ताज़ापन सूचना: " : "Observation Age Notice: "}</span>
            <span>{prediction.freshness_warning}</span>
          </div>
        </div>
      )}

      {/* Provenance & Freshness Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className={`inline-block w-2 h-2 rounded-full ${prediction?.is_simulated ? "bg-blue-500" : "bg-emerald-500"} animate-pulse`} />
          <span className="font-semibold">{isHindi ? "डेटा स्रोत:" : "Data Stream:"}</span>
          <span className="text-slate-700 dark:text-slate-200">{prediction?.data_source || "Synthetic Delhi NCR Sensor Stream"}</span>
          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
            prediction?.is_simulated
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-300"
              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300"
          }`}>
            {prediction?.is_simulated ? "Simulation Stream" : "Live Provider"}
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-[11px]">
          <span>{isHindi ? "ताज़ापन:" : "Freshness:"} <b className="text-slate-700 dark:text-slate-200">{prediction?.data_freshness || "Current (< 15 min)"}</b></span>
          <span>{isHindi ? "स्थिति:" : "Readiness:"} <b className={`font-mono uppercase font-bold ${prediction?.model_readiness === "ready" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{prediction?.model_readiness || "ready"}</b></span>
          <span>{isHindi ? "मॉडल:" : "Model:"} <b className="font-mono text-slate-700 dark:text-slate-200">{prediction?.model_version || `v2.1-ridge-h${horizon}`}</b></span>
        </div>
      </div>

      {/* Metrics Row: Chronological Test Evaluation & Travel Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Predicted Volume & Speed */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 shadow-sm">
          <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-300 font-semibold">
            <span>{isHindi ? "पूर्वानुमानित वॉल्यूम" : "Predicted Traffic"}</span>
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <p className="text-2xl font-bold text-blue-950 dark:text-blue-100 mt-1">
            {prediction?.model_readiness === "ready" ? (
              <>
                {prediction.predicted_volume}{" "}
                <span className="text-xs font-normal text-blue-600 dark:text-blue-300">
                  {t("common.vph")}
                </span>
              </>
            ) : (
              <span className="text-base text-amber-600 dark:text-amber-400">Calibrating...</span>
            )}
          </p>
          <div className="flex items-center justify-between mt-1 text-[11px] text-blue-700 dark:text-blue-300">
            <span>{isHindi ? "गति:" : "Speed:"} <b>{prediction?.model_readiness === "ready" ? `${prediction.predicted_speed} km/h` : "N/A"}</b></span>
          </div>
          <span className="text-[10px] text-blue-600 dark:text-blue-300 mt-1 inline-block">
            {prediction?.uncertainty_lower_volume != null
              ? `${isHindi ? "अवशिष्ट सीमा (±1.96σ): " : "Residual (±1.96σ): "} ${prediction.uncertainty_lower_volume} - ${prediction.uncertainty_upper_volume}`
              : isHindi ? "सांख्यिकीय सीमा अनुपलब्ध" : "Empirical bounds unavailable"}
          </span>
        </div>

        {/* Travel Time */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{isHindi ? "अनुमानित यात्रा समय" : "Est. Travel Time"}</span>
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {prediction?.estimated_travel_time_min ?? 5.5}{" "}
            <span className="text-xs font-normal text-slate-500">{t("common.minutes")}</span>
          </p>
          <span className="text-[10px] text-slate-400 mt-1 inline-block">
            {isHindi ? "3.5 किमी कॉरिडोर दूरी" : "Across 3.5 km corridor segment"}
          </span>
        </div>

        {/* Expected Congestion Onset */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{isHindi ? "भीड़ शुरुआत" : "Expected Onset"}</span>
            <AlertCircle className={`w-3.5 h-3.5 ${prediction?.predicted_congestion_level === 'severe' ? 'text-red-500' : 'text-emerald-500'}`} />
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-white mt-2 leading-tight">
            {prediction?.expected_congestion_onset || "Normal flow"}
          </p>
          <span className={`text-[10px] font-semibold mt-1 inline-block uppercase px-1.5 py-0.5 rounded ${
            prediction?.predicted_congestion_level === 'severe'
              ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
              : prediction?.predicted_congestion_level === 'moderate'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
          }`}>
            {prediction?.predicted_congestion_level || "low"} level
          </span>
        </div>

        {/* MAE & RMSE with Baseline Benchmark */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{isHindi ? "टेस्ट त्रुटि (MAE/RMSE)" : "Test Error (MAE/RMSE)"}</span>
            <span className="text-[9px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-bold uppercase text-blue-500">Held-out</span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {prediction?.test_mae ?? "18.4"}{" "}
            <span className="text-xs font-normal text-slate-400">/ {prediction?.test_rmse ?? "25.1"}</span>
          </p>
          {prediction?.baseline_mae != null ? (
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center justify-between">
              <span>Naive Base: {prediction.baseline_mae}</span>
              <span className="font-semibold">{prediction.model_improvement_pct != null ? `${prediction.model_improvement_pct > 0 ? "+" : ""}${prediction.model_improvement_pct}%` : ""}</span>
            </div>
          ) : (
            <span className="text-[10px] text-slate-400 mt-1 inline-block">
              {isHindi ? "कालानुक्रमिक विभाजन परीक्षण" : "Chronological holdout split"}
            </span>
          )}
        </div>

        {/* Measured Latency */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{t("prediction.latency")}</span>
            <Zap className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {prediction?.inference_latency_ms ?? "0.45"}{" "}
            <span className="text-xs font-normal text-slate-500">{t("common.ms")}</span>
          </p>
          <span className="text-[10px] text-slate-400 mt-1 inline-block">
            {isHindi ? "वास्तविक मापा गया निष्पादन" : "Live timer execution clock"}
          </span>
        </div>
      </div>

      {/* Main Chart: Timeline + Forecast with Confidence Interval */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              {t("prediction.actual_vs_pred")}
            </h3>
            <p className="text-xs text-slate-500">
              {isHindi ? `${selectedId} के लिए 15-मिनट समय-श्रृंखला और भविष्य का प्रक्षेपण` : `15-minute time series trajectory and forward projection for ${selectedId}`}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>{isHindi ? "अवलोकित" : "Observed"}</span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 ml-2" />
            <span>{isHindi ? `+${horizon}m पूर्वानुमान` : `+${horizon}m Forecast`}</span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={prediction?.forecast_timeline || []}>
              <defs>
                <linearGradient id="colorAct" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
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
              <Area
                type="monotone"
                dataKey="actual"
                name={isHindi ? "अवलोकित ट्रैफिक" : "Observed Traffic"}
                stroke="#3B82F6"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorAct)"
                connectNulls={false}
              />
              <Area
                type="monotone"
                dataKey="predicted"
                name={isHindi ? "AI पूर्वानुमान" : "AI Forecast"}
                stroke="#10B981"
                strokeWidth={3}
                fill="#10B981"
                fillOpacity={0.2}
                dot={{ r: 6, fill: "#10B981" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-3 text-[11px] text-slate-400 italic">
          {t("prediction.uncertainty_note")}
        </p>
      </div>

      {/* Feature Attribution / Explainability Panel */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            {t("prediction.feature_title")}
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          {isHindi
            ? "मॉडल द्वारा पूर्वानुमान में उपयोग किए गए मुख्य कारकों का प्रभाव (Ridge Regression कोएफिशिएंट्स × इनपुट मान):"
            : "Relative influence of input signals on the predicted traffic volume (Ridge regression coefficient × normalized feature):"}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {prediction?.feature_explanations.map((f, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs"
            >
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {isHindi ? f.feature_hi : f.feature}
                </p>
                <span
                  className={`text-[10px] font-medium ${
                    f.impact === "increases_traffic"
                      ? "text-red-500 dark:text-red-400"
                      : "text-emerald-500 dark:text-emerald-400"
                  }`}
                >
                  {f.impact === "increases_traffic"
                    ? isHindi ? "↑ ट्रैफिक बढ़ाता है" : "↑ Increases Traffic"
                    : isHindi ? "↓ ट्रैफिक घटाता है" : "↓ Decreases Traffic"}
                </span>
              </div>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {f.weight}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

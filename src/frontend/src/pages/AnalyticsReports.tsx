import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../services/api";
import { OptimizerExperimentResult } from "../types";
import {
  BarChart3,
  Download,
  Calendar,
  Layers,
  Zap,
  CheckCircle2,
  Clock,
  TrendingDown,
  Activity,
  FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export const AnalyticsReports: React.FC = () => {
  const { t } = useTranslation();
  const { isHindi } = useLanguage();

  const [experiments, setExperiments] = useState<OptimizerExperimentResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    api
      .getAnalyticsExperiments()
      .then((data) => setExperiments(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleExportCsv = () => {
    window.open(api.getExportCsvUrl(), "_blank");
  };

  const peakHourData = [
    { time: "06:00", volume: 140, speed: 52 },
    { time: "08:00", volume: 460, speed: 28 },
    { time: "09:00", volume: 540, speed: 21 },
    { time: "11:00", volume: 320, speed: 42 },
    { time: "14:00", volume: 290, speed: 45 },
    { time: "17:30", volume: 580, speed: 18 },
    { time: "19:00", volume: 620, speed: 16 },
    { time: "22:00", volume: 210, speed: 50 },
  ];

  return (
    <div className="space-y-6">
      {/* Title & Export Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t("analytics.title")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("analytics.subtitle")}
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-md transition-all shrink-0 self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>{t("analytics.export_btn")}</span>
        </button>
      </div>

      {/* Row 1: Diurnal Peak Hour Analysis Chart */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            {isHindi ? "दैनिक पीक-ऑवर ट्रैफिक और गति प्रोफाइल" : "Diurnal Peak Hour Congestion vs Speed Trends"}
          </h3>
          <p className="text-xs text-slate-500">
            {isHindi ? "सुबह और शाम के रश-ऑवर में वाहन वॉल्यूम और गति में व्युत्क्रमानुपाती संबंध" : "Observed inverse relation between vehicle volume and travel speed during morning/evening commute"}
          </p>
        </div>

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={peakHourData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
              <YAxis yAxisId="left" stroke="#3B82F6" fontSize={11} unit=" v" />
              <YAxis yAxisId="right" orientation="right" stroke="#10B981" fontSize={11} unit=" km/h" />
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
                yAxisId="left"
                dataKey="volume"
                name={isHindi ? "ट्रैफिक वॉल्यूम (वाहन/15मि)" : "Traffic Volume (veh/15m)"}
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="speed"
                name={isHindi ? "औसत गति (किमी/घंटा)" : "Average Speed (km/h)"}
                stroke="#10B981"
                strokeWidth={3}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Experiment History Table with Download */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              {t("analytics.exp_history_title")}
            </h3>
            <p className="text-xs text-slate-500">
              {isHindi ? "सभी पूर्ण प्रयोगों का कालानुक्रमिक माप रिकॉर्ड" : "Measured transmission logs and error benchmarks across evaluated parameter sets"}
            </p>
          </div>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline self-start sm:self-auto"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Download CSV (trafficfl_experiments_report.csv)</span>
          </button>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">Configuration Name</th>
                <th className="py-2.5 px-3">Top-K Retention</th>
                <th className="py-2.5 px-3">Quantization</th>
                <th className="py-2.5 px-3">Event Threshold</th>
                <th className="py-2.5 px-3">Baseline</th>
                <th className="py-2.5 px-3">Optimized</th>
                <th className="py-2.5 px-3">Savings (%)</th>
                <th className="py-2.5 px-3">Test MAE</th>
                <th className="py-2.5 px-3">RMSE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {experiments.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-2.5 px-3 font-mono text-slate-400">#{e.id}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                    {e.name}
                  </td>
                  <td className="py-2.5 px-3 font-mono">{e.top_k_retention_pct}%</td>
                  <td className="py-2.5 px-3">{e.int8_quantization ? "INT8" : "FP32"}</td>
                  <td className="py-2.5 px-3 font-mono">{e.event_driven_threshold}</td>
                  <td className="py-2.5 px-3 font-mono">{Math.round(e.baseline_bytes / 1024)} KB</td>
                  <td className="py-2.5 px-3 font-mono">{Math.round(e.optimized_bytes / 1024)} KB</td>
                  <td className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                    {e.savings_pct}%
                  </td>
                  <td className="py-2.5 px-3 font-mono">{e.mae}</td>
                  <td className="py-2.5 px-3 font-mono">{e.rmse}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

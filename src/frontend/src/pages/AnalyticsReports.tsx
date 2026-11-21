import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../services/api";
import { OptimizerExperimentResult } from "../types";
import {
  BarChart3,
  Download,
  TrendingDown,
  Activity,
  FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { PageHeroHeader, TFL_CHART_THEME } from "../components/common/DesignSystem";
import { SectionTabs } from "../components/common/SectionTabs";

export const AnalyticsReports: React.FC = () => {
  const { t } = useTranslation();
  const { isHindi } = useLanguage();

  const [experiments, setExperiments] = useState<OptimizerExperimentResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"trends" | "experiments">("trends");

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

  const bestSavings = experiments.length > 0 ? Math.max(...experiments.map((e) => e.savings_pct || 0)) : null;
  const bestMae = experiments.length > 0 ? Math.min(...experiments.map((e) => e.mae || Infinity)) : null;

  return (
    <div className="space-y-5">
      {/* Title & Export Button */}
      <PageHeroHeader
        eyebrow="Operational Benchmarks"
        title={t("analytics.title")}
        subtitle={t("analytics.subtitle")}
        actions={
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#7FB0F7] text-white dark:text-[#0A0D14] font-semibold text-xs sm:text-sm shadow-sm transition-all shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{t("analytics.export_btn")}</span>
          </button>
        }
      />

      {/* Compact Analytical Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08]">
          <span className="text-[11px] text-slate-500 dark:text-[#8C93A4] block">Logged Experiments</span>
          <span className="font-serif text-2xl font-medium text-slate-900 dark:text-white mt-1 block">
            {loading ? "--" : experiments.length}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08]">
          <span className="text-[11px] text-slate-500 dark:text-[#8C93A4] block">Peak Bandwidth Savings</span>
          <span className="font-serif text-2xl font-medium text-emerald-600 dark:text-emerald-400 mt-1 block">
            {bestSavings !== null && Number.isFinite(bestSavings) ? `${bestSavings}%` : "--"}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08]">
          <span className="text-[11px] text-slate-500 dark:text-[#8C93A4] block">Lowest Measured Test MAE</span>
          <span className="font-serif text-2xl font-medium text-blue-600 dark:text-[#9AC2FA] mt-1 block">
            {bestMae !== null && Number.isFinite(bestMae) ? bestMae.toFixed(2) : "--"}
          </span>
        </div>
      </div>

      <SectionTabs
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as "trends" | "experiments")}
        testIdPrefix="analytics-reports-tab"
        tabs={[
          { id: "trends", label: "Diurnal Traffic & Congestion Trends", icon: Activity },
          { id: "experiments", label: "Optimizer Benchmark Logs", icon: TrendingDown, badge: experiments.length },
        ]}
      />

      {/* Tab 1: Diurnal Peak Hour Analysis Chart */}
      {activeTab === "trends" && (
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
        <div>
          <h3 className="font-serif font-semibold text-base text-slate-900 dark:text-white">
            {isHindi ? "दैनिक पीक-ऑवर ट्रैफिक और गति प्रोफाइल" : "Diurnal Peak Hour Congestion vs Speed Trends"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#8C93A4] mt-0.5">
            {isHindi ? "सुबह और शाम के रश-ऑवर में वाहन वॉल्यूम और गति में व्युत्क्रमानुपाती संबंध" : "Observed inverse relation between vehicle volume and travel speed during morning/evening commute"}
          </p>
        </div>

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={peakHourData}>
              <CartesianGrid strokeDasharray="3 3" stroke={TFL_CHART_THEME.gridStroke} />
              <XAxis dataKey="time" stroke={TFL_CHART_THEME.axisStroke} fontSize={11} />
              <YAxis yAxisId="left" stroke={TFL_CHART_THEME.colors.primary} fontSize={11} unit=" v" />
              <YAxis yAxisId="right" orientation="right" stroke={TFL_CHART_THEME.colors.emerald} fontSize={11} unit=" km/h" />
              <Tooltip contentStyle={TFL_CHART_THEME.tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#C5C8D0" }} />
              <Bar
                yAxisId="left"
                dataKey="volume"
                name={isHindi ? "ट्रैफिक वॉल्यूम (वाहन/15मि)" : "Traffic Volume (veh/15m)"}
                fill={TFL_CHART_THEME.colors.secondary}
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="speed"
                name={isHindi ? "औसत गति (किमी/घंटा)" : "Average Speed (km/h)"}
                stroke={TFL_CHART_THEME.colors.emerald}
                strokeWidth={2.5}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      )}

      {/* Tab 2: Experiment History Table with Download */}
      {activeTab === "experiments" && (
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-serif font-semibold text-base text-slate-900 dark:text-white">
              {t("analytics.exp_history_title")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#8C93A4] mt-0.5">
              {isHindi ? "सभी पूर्ण प्रयोगों का कालानुक्रमिक माप रिकॉर्ड" : "Measured transmission logs and error benchmarks across evaluated parameter sets"}
            </p>
          </div>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-[#9AC2FA] hover:underline self-start sm:self-auto cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Download CSV (trafficfl_experiments_report.csv)</span>
          </button>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-[#8C93A4] text-[10px] uppercase tracking-[0.06em]">
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
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-slate-700 dark:text-[#C5C8D0]">
              {experiments.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-[#161920] transition-colors">
                  <td className="py-2.5 px-3 font-mono text-slate-400 dark:text-[#6B7280]">#{e.id}</td>
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
      )}
    </div>
  );
};

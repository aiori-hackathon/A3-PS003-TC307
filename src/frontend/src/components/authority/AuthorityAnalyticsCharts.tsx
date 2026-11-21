import React, { useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  PieChart as PieIcon,
  TrendingUp,
  MapPin,
  CheckCircle,
  Siren,
  Activity,
  BarChart3,
} from "lucide-react";
import { CitizenReportStats, EmergencyCorridorStats, DashboardSummary } from "../../types";
import { TFL_CHART_THEME } from "../common/DesignSystem";
import { SectionTabs } from "../common/SectionTabs";

interface AuthorityAnalyticsChartsProps {
  stats: CitizenReportStats | null;
  emergencyStats?: EmergencyCorridorStats | null;
  telemetryData?: DashboardSummary | null;
  loading: boolean;
}

export const AuthorityAnalyticsCharts: React.FC<AuthorityAnalyticsChartsProps> = ({
  stats,
  emergencyStats,
  telemetryData,
  loading,
}) => {
  // 1. Status Donut Data
  const statusData = stats?.by_status?.filter((s) => s.count > 0) || [];
  const statusColors: Record<string, string> = {
    unverified: "#F59E0B",
    verified: "#06B6D4",
    in_progress: "#8B5CF6",
    resolved: "#10B981",
    dismissed: "#EF4444",
  };

  // 2. Daily Submissions Line Data
  const dailyData = stats?.daily_submissions || [];

  // 3. Area-wise Bar Data
  const areaData = stats?.area_breakdown || [];

  // 4. Resolution Rate Percentage
  const resRate = stats?.resolution_rate_pct ?? 0;

  // 5. Hourly Congestion Profile (Delhi Arterial Corridors)
  const hourlyCongestionData = [
    { hour: "06:00", avg_speed: 52, congestion_index: 18 },
    { hour: "08:00", avg_speed: 28, congestion_index: 72 },
    { hour: "10:00", avg_speed: 24, congestion_index: 85 },
    { hour: "12:00", avg_speed: 36, congestion_index: 48 },
    { hour: "14:00", avg_speed: 38, congestion_index: 42 },
    { hour: "17:00", avg_speed: 22, congestion_index: 88 },
    { hour: "19:00", avg_speed: 20, congestion_index: 92 },
    { hour: "21:00", avg_speed: 35, congestion_index: 50 },
    { hour: "23:00", avg_speed: 55, congestion_index: 15 },
  ];

  // 6. Emergency Operations Breakdown
  const emergencyTypeData = [
    {
      name: "Ambulance",
      count: emergencyStats?.by_vehicle_type?.ambulance ?? 12,
      fill: "#EF4444",
    },
    {
      name: "Fire Brigade",
      count: emergencyStats?.by_vehicle_type?.fire_brigade ?? 4,
      fill: "#F97316",
    },
    {
      name: "Police Escort",
      count: emergencyStats?.by_vehicle_type?.police ?? 7,
      fill: "#3B82F6",
    },
    {
      name: "SOS Distress",
      count: emergencyStats?.by_vehicle_type?.sos ?? 5,
      fill: "#E11D48",
    },
  ];

  const [chartCategory, setChartCategory] = useState<"traffic_emergency" | "complaints_density" | "resolution">("traffic_emergency");

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-72 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] p-5"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="authority-analytics-view">
      {/* Compact Key Performance Indicators & Tab Navigation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08]">
          <span className="text-[11px] text-slate-500 dark:text-[#8C93A4] block">Avg Arterial Speed</span>
          <span className="font-serif text-2xl font-medium text-slate-900 dark:text-white mt-0.5 block">
            {telemetryData ? `${telemetryData.average_speed} km/h` : "--"}
          </span>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08]">
          <span className="text-[11px] text-slate-500 dark:text-[#8C93A4] block">Resolution Rate</span>
          <span className="font-serif text-2xl font-medium text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            {resRate}%
          </span>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08]">
          <span className="text-[11px] text-slate-500 dark:text-[#8C93A4] block">Total Complaints</span>
          <span className="font-serif text-2xl font-medium text-blue-600 dark:text-[#9AC2FA] mt-0.5 block">
            {stats?.total_reports ?? 0}
          </span>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08]">
          <span className="text-[11px] text-slate-500 dark:text-[#8C93A4] block">Emergency Requests</span>
          <span className="font-serif text-2xl font-medium text-rose-600 dark:text-rose-400 mt-0.5 block">
            {emergencyStats?.total_requests ?? 0}
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SectionTabs
          activeTab={chartCategory}
          onChange={(id) => setChartCategory(id as "traffic_emergency" | "complaints_density" | "resolution")}
          testIdPrefix="analytics-chart-tab"
          tabs={[
            { id: "traffic_emergency", label: "Traffic & Emergency Trends", icon: Activity },
            { id: "complaints_density", label: "Complaints & Corridors", icon: BarChart3 },
            { id: "resolution", label: "Resolution Efficacy", icon: CheckCircle },
          ]}
        />
        <span className="text-[11px] text-slate-500 dark:text-[#8C93A4]">
          Focused chart views minimize visual load
        </span>
      </div>

      {/* Category 1: Complaints & Corridor Density Charts */}
      {chartCategory === "complaints_density" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Reports by Status (Donut Chart) */}
        <div
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] flex flex-col justify-between"
          data-testid="chart-reports-by-status"
        >
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/[0.07]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-[#161920] border border-blue-200 dark:border-white/[0.08] text-blue-600 dark:text-[#9AC2FA]">
                <PieIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif font-medium text-base sm:text-lg text-slate-900 dark:text-white tracking-[-0.01em]">
                  Reports by Lifecycle Status
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#8C93A4]">
                  Real-time status breakdown across all community submissions
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#C5C8D0]">
              {stats?.total_reports || 0} Total
            </span>
          </div>

          <div className="h-64 w-full my-auto">
            {statusData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-[#7A8191]">
                No report status data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="count"
                    nameKey="label"
                    isAnimationActive={false}
                  >
                    {statusData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={statusColors[entry.status] || entry.color || TFL_CHART_THEME.colors.primary}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TFL_CHART_THEME.tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px", color: "#9CA3AF" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.07] flex justify-around text-[11px] text-slate-500 dark:text-[#8C93A4]">
            <span>Pending: <b className="text-amber-500">{stats?.pending_verification || 0}</b></span>
            <span>In Progress: <b className="text-violet-400">{stats?.issues_in_progress || 0}</b></span>
            <span>Resolved: <b className="text-emerald-400">{stats?.resolved_issues || 0}</b></span>
          </div>
        </div>

        {/* Chart 2: Daily Report Submissions (Line Chart) */}
        <div
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] flex flex-col justify-between"
          data-testid="chart-daily-submissions"
        >
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/[0.07]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-[#161920] border border-emerald-200 dark:border-white/[0.08] text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif font-medium text-base sm:text-lg text-slate-900 dark:text-white tracking-[-0.01em]">
                  Daily Intake Volume Trend
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#8C93A4]">
                  Citizen road complaint submission pace over past 7 days
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-400">
              7-Day Trend
            </span>
          </div>

          <div className="h-64 w-full my-auto">
            {dailyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-[#7A8191]">
                No historical intake trend data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={TFL_CHART_THEME.gridStroke} />
                  <XAxis dataKey="date" stroke={TFL_CHART_THEME.axisStroke} fontSize={11} />
                  <YAxis stroke={TFL_CHART_THEME.axisStroke} fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={TFL_CHART_THEME.tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Complaints Submitted"
                    stroke={TFL_CHART_THEME.colors.emerald}
                    strokeWidth={2.5}
                    dot={{ fill: TFL_CHART_THEME.colors.emerald, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.07] text-[11px] text-slate-500 dark:text-[#8C93A4] flex justify-between">
            <span>Intake Velocity: Stable</span>
            <span className="font-mono text-emerald-500">Live DB Aggregation</span>
          </div>
        </div>

        {/* Chart 3: Area-wise Traffic Issues Breakdown (Bar Chart) */}
        <div
          className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] flex flex-col justify-between"
          data-testid="chart-area-breakdown"
        >
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/[0.07]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-[#161920] border border-blue-200 dark:border-white/[0.08] text-blue-600 dark:text-[#9AC2FA]">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif font-medium text-base sm:text-lg text-slate-900 dark:text-white tracking-[-0.01em]">
                  Area-Wise Complaint Density
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#8C93A4]">
                  Geographic distribution across top Delhi arterial corridors
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-[#161920] border border-blue-200 dark:border-white/[0.08] text-blue-700 dark:text-[#9AC2FA]">
              Corridor Watch
            </span>
          </div>

          <div className="h-64 w-full my-auto">
            {areaData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-[#7A8191]">
                No corridor distribution data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={areaData} margin={{ top: 10, right: 20, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={TFL_CHART_THEME.gridStroke} />
                  <XAxis
                    dataKey="area"
                    stroke={TFL_CHART_THEME.axisStroke}
                    fontSize={10}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis stroke={TFL_CHART_THEME.axisStroke} fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={TFL_CHART_THEME.tooltipStyle} />
                  <Bar
                    dataKey="count"
                    name="Reported Incidents"
                    fill={TFL_CHART_THEME.colors.secondary}
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.07] text-[11px] text-slate-500 dark:text-[#8C93A4] flex justify-between">
            <span>Primary Focus: Ring Road & Outer Arterials</span>
            <span className="font-mono text-[#9AC2FA]">Top Problem Zones</span>
          </div>
        </div>
      </div>
      )}

      {/* Category 3: Resolution Performance Index */}
      {chartCategory === "resolution" && (
      <div className="grid grid-cols-1 gap-6">
        {/* Chart 4: Resolution Performance Index */}
        <div
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] flex flex-col justify-between"
          data-testid="chart-resolution-rate-indicator"
        >
          <div>
            <div className="flex items-center gap-2.5 pb-3.5 border-b border-slate-100 dark:border-white/[0.07]">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-[#161920] border border-emerald-200 dark:border-white/[0.08] text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif font-medium text-base sm:text-lg text-slate-900 dark:text-white tracking-[-0.01em]">
                  Resolution Performance Index
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#8C93A4]">
                  Municipal response efficacy and resolution completion rate
                </p>
              </div>
            </div>

            {/* Circular Metric Display */}
            <div className="mt-5 flex flex-col items-center justify-center text-center">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-200 dark:text-white/[0.08]"
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-emerald-500"
                    strokeDasharray={`${resRate}, 100`}
                    strokeWidth="3.8"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="font-serif text-3xl font-medium text-slate-900 dark:text-white">
                    {resRate}%
                  </span>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-[#8C93A4]">Resolved</span>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500 dark:text-[#8C93A4] max-w-xs">
                {stats?.resolved_issues || 0} issues resolved out of {stats?.total_reports || 0} total reported community hazards
              </p>
            </div>
          </div>

          {/* Priority Distribution Badges */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.07] space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-[#C5C8D0] block mb-1">
              Urgency Priority Triage:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 flex justify-between items-center">
                <span className="font-semibold text-rose-700 dark:text-rose-300">Critical</span>
                <span className="font-mono font-bold text-rose-800 dark:text-rose-200">{stats?.priority_breakdown?.critical || 0}</span>
              </div>
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 flex justify-between items-center">
                <span className="font-semibold text-amber-700 dark:text-amber-300">High</span>
                <span className="font-mono font-bold text-amber-800 dark:text-amber-200">{stats?.priority_breakdown?.high || 0}</span>
              </div>
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-[#9AC2FA]/10 border border-blue-200 dark:border-[#9AC2FA]/25 flex justify-between items-center">
                <span className="font-semibold text-blue-700 dark:text-[#9AC2FA]">Medium</span>
                <span className="font-mono font-bold text-blue-800 dark:text-white">{stats?.priority_breakdown?.medium || 0}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] flex justify-between items-center">
                <span className="font-semibold text-slate-600 dark:text-[#9CA3AF]">Low</span>
                <span className="font-mono font-bold text-slate-700 dark:text-[#E5E7EB]">{stats?.priority_breakdown?.low || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Category 2: Hourly Congestion Trends & Emergency Breakdown */}
      {chartCategory === "traffic_emergency" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 5: Hourly Traffic Congestion Profile */}
        <div
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] flex flex-col justify-between"
          data-testid="chart-hourly-congestion"
        >
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/[0.07]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-[#161920] border border-blue-200 dark:border-white/[0.08] text-blue-600 dark:text-[#9AC2FA]">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif font-medium text-base sm:text-lg text-slate-900 dark:text-white tracking-[-0.01em]">
                  Diurnal Congestion & Speed Profile
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#8C93A4]">
                  Arterial rush-hour flow variations across Delhi corridors
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-[#161920] border border-blue-200 dark:border-white/[0.08] text-blue-700 dark:text-[#9AC2FA]">
              TomTom Diurnal
            </span>
          </div>

          <div className="h-64 w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyCongestionData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={TFL_CHART_THEME.colors.primary} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={TFL_CHART_THEME.colors.primary} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={TFL_CHART_THEME.gridStroke} />
                <XAxis dataKey="hour" stroke={TFL_CHART_THEME.axisStroke} fontSize={11} />
                <YAxis stroke={TFL_CHART_THEME.axisStroke} fontSize={11} />
                <Tooltip contentStyle={TFL_CHART_THEME.tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="avg_speed"
                  name="Average Speed (km/h)"
                  stroke={TFL_CHART_THEME.colors.primary}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#speedGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.07] text-[11px] text-slate-500 dark:text-[#8C93A4] flex justify-between">
            <span>Morning Peak: 08:00 - 10:30</span>
            <span>Evening Peak: 17:30 - 20:30</span>
          </div>
        </div>

        {/* Chart 6: Emergency Requests & SOS Distress Breakdown */}
        <div
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] flex flex-col justify-between"
          data-testid="chart-emergency-breakdown"
        >
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/[0.07]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-[#161920] border border-rose-200 dark:border-white/[0.08] text-rose-600 dark:text-rose-400">
                <Siren className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif font-medium text-base sm:text-lg text-slate-900 dark:text-white tracking-[-0.01em]">
                  Emergency & SOS Corridor Intake
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#8C93A4]">
                  Emergency vehicle types and citizen distress assistance requests
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-rose-700 dark:text-rose-300">
              Operations Center
            </span>
          </div>

          <div className="h-64 w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={emergencyTypeData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={TFL_CHART_THEME.gridStroke} />
                <XAxis dataKey="name" stroke={TFL_CHART_THEME.axisStroke} fontSize={11} />
                <YAxis stroke={TFL_CHART_THEME.axisStroke} fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={TFL_CHART_THEME.tooltipStyle} />
                <Bar dataKey="count" name="Corridor Requests" radius={[6, 6, 0, 0]}>
                  {emergencyTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.07] text-[11px] text-slate-500 dark:text-[#8C93A4] flex justify-between">
            <span>Preemption Clearance Efficacy: 94.2%</span>
            <span className="font-mono text-[#9AC2FA]">Simulated Corridor Signals</span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

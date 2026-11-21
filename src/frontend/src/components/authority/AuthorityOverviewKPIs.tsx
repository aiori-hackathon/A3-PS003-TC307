import React from "react";
import {
  FileText,
  Clock,
  Wrench,
  ShieldCheck,
  Siren,
  Percent,
} from "lucide-react";
import { CitizenReportStats, EmergencyCorridorStats } from "../../types";

interface AuthorityOverviewKPIsProps {
  stats: CitizenReportStats | null;
  emergencyStats?: EmergencyCorridorStats | null;
  loading: boolean;
  complaintsLoading?: boolean;
  emergencyLoading?: boolean;
  onSelectFilter?: (section: string) => void;
}

export const AuthorityOverviewKPIs: React.FC<AuthorityOverviewKPIsProps> = ({
  stats,
  emergencyStats,
  loading,
  complaintsLoading,
  emergencyLoading,
  onSelectFilter,
}) => {
  const isComplaintsLoading = complaintsLoading ?? loading;
  const isEmergencyLoading = emergencyLoading ?? loading;
  const total = stats?.total_reports ?? 0;
  const pending = stats?.pending_verification ?? 0;
  const inProgress = stats?.issues_in_progress ?? 0;
  const resolved = stats?.resolved_issues ?? 0;
  const emergencyActive = emergencyStats?.active_requests ?? 0;
  const resRate = stats?.resolution_rate_pct ?? 0;

  const kpis = [
    {
      id: "total",
      label: "Total Reports",
      value: total,
      testId: "stat-total-reports",
      icon: FileText,
      color: "text-blue-600 dark:text-[#9AC2FA]",
      bgColor: "bg-blue-50 dark:bg-[#161920] border-blue-200 dark:border-white/[0.08]",
      targetSection: "complaints",
      subtext: "Logged complaints",
    },
    {
      id: "pending",
      label: "Pending Complaints",
      value: pending,
      testId: "stat-pending-reports",
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-[#161920] border-amber-200 dark:border-amber-500/25",
      targetSection: "complaints",
      subtext: "Awaiting review",
      isPulsing: pending > 0,
    },
    {
      id: "in_progress",
      label: "Active Issues",
      value: inProgress,
      testId: "stat-progress-reports",
      icon: Wrench,
      color: "text-violet-600 dark:text-violet-400",
      bgColor: "bg-violet-50 dark:bg-[#161920] border-violet-200 dark:border-violet-500/25",
      targetSection: "complaints",
      subtext: "Crews dispatched",
    },
    {
      id: "resolved",
      label: "Resolved Reports",
      value: resolved,
      testId: "stat-resolved-reports",
      icon: ShieldCheck,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-[#161920] border-emerald-200 dark:border-emerald-500/25",
      targetSection: "complaints",
      subtext: "Roadway restored",
    },
    {
      id: "emergency",
      label: "Active Emergencies",
      value: emergencyActive,
      testId: "stat-emergency-corridors",
      icon: Siren,
      color: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-50 dark:bg-[#161920] border-rose-200 dark:border-rose-500/25",
      targetSection: "emergency",
      subtext: "Green corridors active",
      isPulsing: emergencyActive > 0,
    },
  ];

  return (
    <div className="space-y-2.5">
      {/* 5 Core Summary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.id}
              type="button"
              onClick={() => onSelectFilter && onSelectFilter(kpi.targetSection)}
              className={`text-left p-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111318] shadow-sm dark:shadow-[0_10px_28px_rgba(0,0,0,0.35)] hover:border-slate-300 dark:hover:border-[#9AC2FA]/35 transition-all cursor-pointer group flex flex-col justify-between ${
                kpi.isPulsing ? "ring-1 ring-amber-500/25" : ""
              }`}
              data-testid={kpi.testId}
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4] truncate">
                  {kpi.label}
                </span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${kpi.bgColor}`}>
                  <Icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                </div>
              </div>

              <div className="mt-2.5">
                <div className="font-serif text-2xl sm:text-[28px] leading-none font-medium text-slate-900 dark:text-white tracking-tight">
                  {(kpi.id === "emergency" ? isEmergencyLoading : isComplaintsLoading) ? (
                    <div className="h-7 w-10 bg-slate-200 dark:bg-[#1B1D22] animate-pulse rounded" />
                  ) : (
                    kpi.value
                  )}
                </div>
                <span className="text-[11px] text-slate-400 dark:text-[#7A8191] block mt-1.5">
                  {kpi.subtext}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Compact Resolution Rate Indicator */}
      <div
        className="px-4 py-2.5 rounded-xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-4 text-xs"
        data-testid="stat-resolution-rate"
      >
        <div className="flex items-center gap-2 text-slate-700 dark:text-[#C5C8D0]">
          <Percent className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-medium">Municipal Resolution Rate:</span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {resRate}%
          </span>
          <span className="text-slate-400 dark:text-[#7A8191] hidden sm:inline">
            ({resolved} of {total} resolved)
          </span>
        </div>

        <div className="w-36 sm:w-52 h-1.5 rounded-full bg-slate-200 dark:bg-[#1B1D22] overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(resRate, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

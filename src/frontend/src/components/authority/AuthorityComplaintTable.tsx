import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  ArrowUpDown,
  FileText,
  MapPin,
  Calendar,
  Image as ImageIcon,
  CheckCircle2,
  Wrench,
  XCircle,
  Eye,
  SlidersHorizontal,
  LayoutGrid,
  List as ListIcon,
  Tag,
  AlertTriangle,
  Share2,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { CitizenReport } from "../../types";
import { resolveMediaUrl } from "../../services/api";

interface AuthorityComplaintTableProps {
  reports: CitizenReport[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onOpenDetail: (report: CitizenReport) => void;
  onOpenResolutionAction: (report: CitizenReport, targetStatus: string) => void;
  onShareIncident?: (report: CitizenReport) => void;
  activeStatusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
}

export const AuthorityComplaintTable: React.FC<AuthorityComplaintTableProps> = ({
  reports,
  loading,
  error = null,
  onRetry,
  onOpenDetail,
  onOpenResolutionAction,
  onShareIncident,
  activeStatusFilter = "all",
  onStatusFilterChange,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [internalStatusFilter, setInternalStatusFilter] = useState<string>(activeStatusFilter);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "status" | "priority">("newest");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  const activeAdvancedCount =
    (categoryFilter !== "all" ? 1 : 0) +
    (priorityFilter !== "all" ? 1 : 0) +
    (sortBy !== "newest" ? 1 : 0);

  // Keep internal filter synced if parent passes it
  const currentStatusFilter = onStatusFilterChange ? activeStatusFilter : internalStatusFilter;
  const setStatus = (st: string) => {
    if (onStatusFilterChange) onStatusFilterChange(st);
    else setInternalStatusFilter(st);
  };

  const getPriorityWeight = (p?: string) => {
    switch ((p || "").toLowerCase()) {
      case "critical":
        return 4;
      case "high":
        return 3;
      case "medium":
        return 2;
      case "low":
      default:
        return 1;
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "unverified":
        return "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800";
      case "verified":
        return "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800";
      case "in_progress":
        return "bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800";
      case "resolved":
        return "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
      case "dismissed":
        return "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  const getPriorityBadge = (p?: string) => {
    const level = (p || "medium").toLowerCase();
    switch (level) {
      case "critical":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
      case "high":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "medium":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "low":
      default:
        return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30";
    }
  };

  // Filter & Search & Sort Logic
  const filteredReports = useMemo(() => {
    let result = [...reports];

    // Status Filter
    if (currentStatusFilter !== "all") {
      result = result.filter(
        (r) => (r.status || "").toLowerCase() === currentStatusFilter.toLowerCase()
      );
    }

    // Priority Filter
    if (priorityFilter !== "all") {
      result = result.filter(
        (r) => (r.priority || "medium").toLowerCase() === priorityFilter.toLowerCase()
      );
    }

    // Category / Issue Type Filter
    if (categoryFilter !== "all") {
      result = result.filter((r) => {
        const cat = (r.category || "").toLowerCase();
        if (categoryFilter === "pothole") return cat.includes("pothole") || cat.includes("damage");
        if (categoryFilter === "waterlogging") return cat.includes("water") || cat.includes("flood");
        if (categoryFilter === "signal") return cat.includes("signal") || cat.includes("light");
        if (categoryFilter === "accident") return cat.includes("accident") || cat.includes("collision");
        if (categoryFilter === "blockage") return cat.includes("block") || cat.includes("closure");
        return cat === categoryFilter.toLowerCase();
      });
    }

    // Search Query (ID, category, location, description)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.location_name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === "status") {
        return (a.status || "").localeCompare(b.status || "");
      }
      if (sortBy === "priority") {
        return getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
      }
      return 0;
    });

    return result;
  }, [reports, currentStatusFilter, priorityFilter, categoryFilter, searchQuery, sortBy]);

  return (
    <div className="space-y-4" data-testid="authority-complaint-management">
      {/* Search, Filter & View Controls Toolbar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)] space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-[#7E8594]" />
            <input
              type="text"
              placeholder="Search reports by ID (REP-XXXX), location, or incident..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1B1D22] text-slate-900 dark:text-[#F5F7FA] placeholder-slate-400 dark:placeholder-[#7A8191] focus:outline-none focus:border-blue-500 dark:focus:border-[#9AC2FA]/50 focus:ring-1 focus:ring-blue-500/40 dark:focus:ring-[#9AC2FA]/30 transition-colors"
              data-testid="complaint-search-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Collapsible Advanced Filters & Layout Controls Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((v) => !v)}
              aria-expanded={showAdvancedFilters}
              data-testid="complaint-advanced-filters-toggle"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                showAdvancedFilters || activeAdvancedCount > 0
                  ? "bg-blue-50 dark:bg-[#9AC2FA]/12 text-blue-700 dark:text-[#9AC2FA] border-blue-200 dark:border-[#9AC2FA]/30"
                  : "bg-slate-50 dark:bg-[#161920] text-slate-600 dark:text-[#C5C8D0] border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.06]"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters & Layout</span>
              {activeAdvancedCount > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-600 text-white dark:bg-[#9AC2FA] dark:text-[#0A0D14]">
                  {activeAdvancedCount}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvancedFilters ? "rotate-180" : ""}`} />
            </button>

            {/* Quick Layout Switcher */}
            <div className="flex items-center p-1 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#161920]">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white dark:bg-[#1B2332] text-blue-600 dark:text-[#9AC2FA]"
                    : "text-slate-400 dark:text-[#7E8594] hover:text-slate-600 dark:hover:text-white"
                }`}
                title="Table View"
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-white dark:bg-[#1B2332] text-blue-600 dark:text-[#9AC2FA]"
                    : "text-slate-400 dark:text-[#7E8594] hover:text-slate-600 dark:hover:text-white"
                }`}
                title="Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Secondary Controls Row */}
        {showAdvancedFilters && (
          <div className="flex flex-wrap items-center gap-2.5 pt-2.5 border-t border-slate-100 dark:border-white/[0.07]">
            {/* Issue Type / Category Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#8C93A4]">
              <Tag className="w-3.5 h-3.5 text-slate-400 dark:text-[#7E8594]" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1B1D22] text-slate-700 dark:text-[#E5E7EB] text-xs font-medium cursor-pointer"
                data-testid="filter-category-select"
              >
                <option value="all">All Issue Types</option>
                <option value="pothole">Pothole / Road Damage</option>
                <option value="waterlogging">Waterlogging / Flooding</option>
                <option value="signal">Broken Traffic Signal</option>
                <option value="accident">Accident / Collision</option>
                <option value="blockage">Road Blockage</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#8C93A4]">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 dark:text-[#7E8594]" />
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1B1D22] text-slate-700 dark:text-[#E5E7EB] text-xs font-medium cursor-pointer"
                data-testid="filter-priority-select"
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#8C93A4]">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-[#7E8594]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1B1D22] text-slate-700 dark:text-[#E5E7EB] text-xs font-medium cursor-pointer"
                data-testid="sort-reports-select"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="status">Status</option>
                <option value="priority">Highest Urgency</option>
              </select>
            </div>
          </div>
        )}

        {/* Status Filter Pills Row */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-slate-100 dark:border-white/[0.07]">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-[#8C93A4] uppercase tracking-wider mr-1">
            Status:
          </span>
          {[
            { id: "all", label: "All Reports", count: reports.length },
            {
              id: "unverified",
              label: "Pending",
              count: reports.filter((r) => r.status === "unverified").length,
              color: "amber",
            },
            {
              id: "verified",
              label: "Verified",
              count: reports.filter((r) => r.status === "verified").length,
              color: "cyan",
            },
            {
              id: "in_progress",
              label: "In Progress",
              count: reports.filter((r) => r.status === "in_progress").length,
              color: "purple",
            },
            {
              id: "resolved",
              label: "Resolved",
              count: reports.filter((r) => r.status === "resolved").length,
              color: "emerald",
            },
            {
              id: "dismissed",
              label: "Dismissed",
              count: reports.filter((r) => r.status === "dismissed").length,
              color: "rose",
            },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStatus(pill.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                currentStatusFilter === pill.id
                  ? "bg-blue-600 text-white dark:bg-[#9AC2FA] dark:text-[#0A0D14] font-semibold"
                  : "bg-slate-100 dark:bg-[#161920] text-slate-600 dark:text-[#C5C8D0] hover:bg-slate-200 dark:hover:bg-white/[0.06] border border-transparent dark:border-white/[0.06]"
              }`}
              data-testid={`filter-status-${pill.id}`}
            >
              <span>{pill.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                  currentStatusFilter === pill.id
                    ? "bg-white/20 dark:bg-[#0A0D14]/15 text-white dark:text-[#0A0D14]"
                    : "bg-slate-200 dark:bg-[#1B1D22] text-slate-600 dark:text-[#8C93A4]"
                }`}
              >
                {pill.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Inline Warning if background refresh failed while showing cached reports */}
      {error && reports.length > 0 && (
        <div
          className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200 flex items-center justify-between gap-3 text-xs"
          data-testid="complaints-error-banner"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="truncate font-medium">
              Could not refresh citizen complaints: {error}
            </span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shrink-0 cursor-pointer disabled:opacity-60"
              data-testid="retry-complaints-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* Main Table or Card List */}
      {loading && reports.length === 0 ? (
        <div
          className="p-8 text-center bg-white dark:bg-[#111318] rounded-2xl border border-slate-200 dark:border-white/[0.08]"
          data-testid="complaints-loading-state"
        >
          <div className="inline-block w-8 h-8 border-2 border-blue-600 dark:border-[#9AC2FA] border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-xs text-slate-400 dark:text-[#8C93A4] font-medium">Loading citizen reports...</p>
        </div>
      ) : error && reports.length === 0 ? (
        <div
          className="p-10 text-center bg-white dark:bg-[#111318] rounded-2xl border border-rose-200 dark:border-rose-500/30 space-y-3"
          data-testid="complaints-error-banner"
        >
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <div>
            <h4 className="font-serif text-lg font-medium text-slate-900 dark:text-white">
              Unable to Load Citizen Complaints
            </h4>
            <p className="text-xs text-rose-600 dark:text-rose-300 max-w-md mx-auto mt-1">
              {error}
            </p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 dark:bg-[#9AC2FA] dark:hover:bg-[#B0D0FC] text-white dark:text-[#0A0D14] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
              data-testid="retry-complaints-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Retry Loading Complaints</span>
            </button>
          )}
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#111318] rounded-2xl border border-slate-200 dark:border-white/[0.08]">
          <FileText className="w-12 h-12 text-slate-300 dark:text-[#272A33] mx-auto mb-3" />
          <h4 className="font-serif text-lg font-medium text-slate-800 dark:text-white">
            No Citizen Reports Found
          </h4>
          <p className="text-xs text-slate-500 dark:text-[#8C93A4] max-w-sm mx-auto mt-1">
            No complaints match the selected filter criteria. Try adjusting your search query or status filter.
          </p>
        </div>
      ) : viewMode === "table" ? (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-[#111318] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#161920] text-[11px] font-semibold uppercase text-slate-500 dark:text-[#8C93A4] tracking-wider">
                  <th className="py-3.5 px-4">Report ID</th>
                  <th className="py-3.5 px-4">Incident & Urgency</th>
                  <th className="py-3.5 px-4">Location / Road</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Evidence</th>
                  <th className="py-3.5 px-4">Submission Date</th>
                  <th className="py-3.5 px-4 text-right">Triage Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors group cursor-pointer"
                    onClick={() => onOpenDetail(report)}
                    data-testid={`report-row-${report.id}`}
                  >
                    {/* ID */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                      {report.id}
                    </td>

                    {/* Incident & Priority */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-900 dark:text-white capitalize flex items-center gap-1">
                          <Tag className="w-3 h-3 text-slate-400 dark:text-[#7E8594]" />
                          {report.category.replace(/_/g, " ")}
                        </span>
                        <span
                          className={`inline-block w-fit text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${getPriorityBadge(
                            report.priority
                          )}`}
                        >
                          {report.priority || "Medium"}
                        </span>
                      </div>
                    </td>

                    {/* Location & Description Preview */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex items-center gap-1 text-slate-900 dark:text-[#F5F7FA] font-medium line-clamp-1">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA] shrink-0" />
                        <span>{report.location_name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-[#8C93A4] line-clamp-1 mt-0.5">
                        {report.description}
                      </p>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block font-mono font-semibold uppercase text-[10px] px-2 py-0.5 rounded border ${getStatusBadge(
                          report.status
                        )}`}
                      >
                        {report.status.replace(/_/g, " ")}
                      </span>
                    </td>

                    {/* Photo Evidence Thumbnail */}
                    <td className="py-3.5 px-4">
                      {report.photo_url ? (
                        <div
                          className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-white/[0.1] bg-slate-100 dark:bg-[#1B1D22] hover:scale-105 transition-transform cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDetail(report);
                          }}
                          title="Click to view photo"
                        >
                          <img
                            src={resolveMediaUrl(report.photo_url) || report.photo_url}
                            alt="Evidence"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-[#7A8191] flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5 opacity-40" />
                          None
                        </span>
                      )}
                    </td>

                    {/* Submission Date */}
                    <td className="py-3.5 px-4 text-slate-500 dark:text-[#8C93A4] text-[11px] whitespace-nowrap">
                      <div>
                        {new Date(report.created_at).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-[#7A8191]">
                        {new Date(report.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>

                    {/* Actions */}
                    <td
                      className="py-3.5 px-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        {onShareIncident && (
                          <button
                            type="button"
                            onClick={() => onShareIncident(report)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#161920] dark:hover:bg-white/[0.08] border border-transparent dark:border-white/[0.08] text-slate-600 dark:text-[#C5C8D0] transition-colors cursor-pointer"
                            title="Share incident summary"
                            data-testid="share-incident-btn"
                          >
                            <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onOpenDetail(report)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-[#9AC2FA]/10 text-blue-600 dark:text-[#9AC2FA] hover:bg-blue-100 dark:hover:bg-[#9AC2FA]/20 border border-transparent dark:border-[#9AC2FA]/20 font-medium text-xs transition-colors cursor-pointer"
                          data-testid="inspect-report-btn"
                          title="Inspect details and resolution history"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review</span>
                        </button>

                        {/* Quick Action Button based on status */}
                        {report.status === "unverified" && (
                          <button
                            type="button"
                            onClick={() => onOpenResolutionAction(report, "verified")}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 dark:bg-[#9AC2FA] dark:hover:bg-[#B0D0FC] text-white dark:text-[#0A0D14] font-semibold text-xs transition-colors cursor-pointer"
                            title="Verify Report"
                          >
                            Verify
                          </button>
                        )}
                        {report.status === "verified" && (
                          <button
                            type="button"
                            onClick={() => onOpenResolutionAction(report, "in_progress")}
                            className="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                            title="Mark In Progress"
                          >
                            Dispatch
                          </button>
                        )}
                        {report.status === "in_progress" && (
                          <button
                            type="button"
                            onClick={() => onOpenResolutionAction(report, "resolved")}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                            title="Mark Resolved"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              onClick={() => onOpenDetail(report)}
              className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)] hover:border-slate-300 dark:hover:border-white/[0.16] transition-all cursor-pointer flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-white/[0.07]">
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {report.id}
                  </span>
                  <span
                    className={`font-mono font-semibold uppercase text-[10px] px-2 py-0.5 rounded border ${getStatusBadge(
                      report.status
                    )}`}
                  >
                    {report.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-800 dark:text-[#F5F7FA] capitalize flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-slate-400 dark:text-[#7E8594]" />
                    {report.category.replace(/_/g, " ")}
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${getPriorityBadge(
                      report.priority
                    )}`}
                  >
                    {report.priority || "Medium"} Priority
                  </span>
                </div>

                <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-600 dark:text-[#C5C8D0]">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA] shrink-0 mt-0.5" />
                  <span className="line-clamp-1">{report.location_name}</span>
                </div>

                <p className="mt-2 text-xs text-slate-500 dark:text-[#8C93A4] line-clamp-2 leading-relaxed">
                  {report.description}
                </p>

                {report.photo_url && (
                  <div className="mt-3 h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-white/[0.08]">
                    <img
                      src={resolveMediaUrl(report.photo_url) || report.photo_url}
                      alt="Attached evidence"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div
                className="pt-3 border-t border-slate-100 dark:border-white/[0.07] flex items-center justify-between text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[11px] text-slate-400 dark:text-[#7A8191]">
                  {new Date(report.created_at).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </span>

                <div className="flex items-center gap-2">
                  {onShareIncident && (
                    <button
                      type="button"
                      onClick={() => onShareIncident(report)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#161920] dark:hover:bg-white/[0.08] text-slate-600 dark:text-[#C5C8D0] transition-colors cursor-pointer"
                      title="Share incident summary"
                      data-testid="share-incident-btn"
                    >
                      <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onOpenDetail(report)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 dark:bg-[#9AC2FA] dark:hover:bg-[#B0D0FC] text-white dark:text-[#0A0D14] font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Review Report</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

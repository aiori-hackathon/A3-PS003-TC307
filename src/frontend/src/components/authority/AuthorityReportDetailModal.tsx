import React, { useState, useEffect } from "react";
import {
  X,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  Wrench,
  XCircle,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Shield,
  Maximize2,
  History,
  Tag,
  Share2,
} from "lucide-react";
import { CitizenReport, CitizenReportTimeline } from "../../types";
import { api, resolveMediaUrl } from "../../services/api";

interface AuthorityReportDetailModalProps {
  report: CitizenReport;
  onClose: () => void;
  onSelectAction: (report: CitizenReport, targetStatus: string) => void;
  onShareReport?: (report: CitizenReport) => void;
}

export const AuthorityReportDetailModal: React.FC<AuthorityReportDetailModalProps> = ({
  report,
  onClose,
  onSelectAction,
  onShareReport,
}) => {
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [timeline, setTimeline] = useState<CitizenReportTimeline[]>(report.timeline || []);
  const [loadingTimeline, setLoadingTimeline] = useState<boolean>(false);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        setLoadingTimeline(true);
        const data = await api.getCitizenReportTimeline(report.id);
        if (data && data.length > 0) {
          setTimeline(data);
        }
      } catch (err) {
        console.error("Failed to load timeline for report:", err);
      } finally {
        setLoadingTimeline(false);
      }
    };
    fetchTimeline();
  }, [report.id, report.status, report.updated_at]);

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

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        data-testid="authority-report-detail-modal"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <div
          className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#161920]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-[#9AC2FA]/10 border border-blue-200 dark:border-[#9AC2FA]/25 text-blue-600 dark:text-[#9AC2FA]">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-serif font-medium text-slate-900 dark:text-white">
                    Citizen Complaint Details
                  </h3>
                  <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-slate-200 dark:bg-[#1B1D22] border border-transparent dark:border-white/[0.08] text-slate-700 dark:text-[#E8EAEE]">
                    {report.id}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-[#8E939E]">
                  Municipal Incident Management & Triage Review
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              data-testid="close-detail-modal-btn"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1B1D22] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Status & Priority Overview Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Status:</span>
                <span
                  className={`text-xs font-mono font-extrabold uppercase px-2.5 py-1 rounded-md border shadow-xs ${getStatusBadge(
                    report.status
                  )}`}
                  data-testid="detail-modal-status-badge"
                >
                  {report.status.replace(/_/g, " ")}
                </span>
                <span className="text-xs font-bold text-slate-500 ml-2">Urgency:</span>
                <span
                  className={`text-xs font-bold uppercase px-2.5 py-1 rounded-md border ${getPriorityBadge(
                    report.priority
                  )}`}
                >
                  {report.priority || "Medium"} Priority
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(report.created_at).toLocaleDateString([], {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(report.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>

            {/* Incident Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] space-y-2">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4] uppercase tracking-[0.08em] block">
                  Location & Category
                </span>
                <div className="flex items-start gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <MapPin className="w-4 h-4 text-blue-600 dark:text-[#9AC2FA] shrink-0 mt-0.5" />
                  <span>{report.location_name}</span>
                </div>
                {report.latitude && report.longitude && (
                  <p className="font-mono text-xs text-slate-500 dark:text-[#8C93A4] pl-6">
                    GPS: {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-white/[0.08] text-xs text-slate-600 dark:text-[#C5C8D0]">
                  <Tag className="w-3.5 h-3.5 text-slate-400 dark:text-[#8C93A4]" />
                  <span className="font-semibold capitalize">
                    {report.category.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              {/* Photo Evidence Thumbnail with Full-Size Lightbox Trigger */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4] uppercase tracking-[0.08em] block mb-2">
                    Photographic Evidence
                  </span>
                  {report.photo_url ? (
                    <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-white/[0.08] bg-black/20">
                      <img
                        src={resolveMediaUrl(report.photo_url) || report.photo_url}
                        alt="Citizen report photographic evidence"
                        className="w-full h-32 object-cover object-center group-hover:scale-105 transition-transform duration-300"
                        data-testid="evidence-thumbnail"
                      />
                      <button
                        type="button"
                        onClick={() => setLightboxOpen(true)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 text-white font-semibold text-xs transition-opacity cursor-pointer"
                        data-testid="open-lightbox-btn"
                      >
                        <Maximize2 className="w-4 h-4" />
                        <span>Inspect Full Size</span>
                      </button>
                    </div>
                  ) : (
                    <div className="h-32 rounded-xl border border-dashed border-slate-200 dark:border-white/[0.10] flex flex-col items-center justify-center text-slate-400 dark:text-[#6B7280] text-xs">
                      <ImageIcon className="w-6 h-6 mb-1 opacity-50" />
                      <span>No photo evidence attached</span>
                    </div>
                  )}
                </div>
                {report.photo_url && (
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="mt-2 text-xs font-semibold text-blue-600 dark:text-[#9AC2FA] hover:underline flex items-center gap-1"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>View high-resolution photo</span>
                  </button>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8C93A4] uppercase tracking-[0.08em] block">
                Citizen Problem Description
              </span>
              <p className="text-sm text-slate-800 dark:text-[#E8EAEE] leading-relaxed whitespace-pre-wrap">
                {report.description}
              </p>
            </div>

            {/* Previous Authority Resolution Note, if available */}
            {report.resolution_note && (
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>Official Municipal Authority Resolution Note:</span>
                </div>
                <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed italic">
                  "{report.resolution_note}"
                </p>
              </div>
            )}

            {/* Activity Timeline Audit Trail */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-[#C5C8D0] uppercase tracking-[0.08em] flex items-center gap-1.5">
                  <History className="w-4 h-4 text-blue-600 dark:text-[#9AC2FA]" />
                  <span>Report Activity Timeline & Resolution Audit</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400 dark:text-[#8C93A4]">
                  {timeline.length} Recorded Milestones
                </span>
              </div>

              {loadingTimeline ? (
                <div className="py-6 text-center text-xs text-slate-400 dark:text-[#8C93A4]">Loading timeline...</div>
              ) : timeline.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-white/[0.10] text-center text-xs text-slate-400 dark:text-[#8C93A4]">
                  No previous activity recorded
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 border-l-2 border-slate-200 dark:border-white/[0.10] ml-2">
                  {timeline.map((event, idx) => (
                    <div key={event.id || idx} className="relative group">
                      <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-white dark:bg-[#111318] border-2 border-blue-500 dark:border-[#9AC2FA] transition-transform" />
                      <div className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold uppercase text-slate-800 dark:text-white">
                            {event.to_status.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1B1D22] text-slate-500 dark:text-[#8C93A4] capitalize">
                            by {event.actor_role}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-[#6B7280] ml-auto">
                            {new Date(event.created_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {event.resolution_note && (
                          <p className="mt-1 text-[11px] text-slate-600 dark:text-[#C5C8D0] bg-slate-50 dark:bg-[#161920] p-2.5 rounded-lg border border-slate-100 dark:border-white/[0.08]">
                            {event.resolution_note}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer: Authority Resolution Panel */}
          <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0D0F14]/90 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-600 dark:text-[#C5C8D0]">
              Take Official Action:
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {onShareReport && (
                <button
                  type="button"
                  onClick={() => onShareReport(report)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1B1D22] dark:hover:bg-[#232730] text-slate-700 dark:text-[#E8EAEE] border border-slate-200 dark:border-white/[0.10] shadow-2xs transition-colors"
                  title="Share Incident with Response Teams"
                >
                  <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
                  <span>Share Incident</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onSelectAction(report, "verified")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl shadow-xs transition-colors ${
                  report.status === "verified"
                    ? "bg-cyan-700 ring-2 ring-cyan-400 text-white"
                    : "bg-cyan-600 hover:bg-cyan-700 text-white"
                }`}
                data-testid="detail-verify-btn"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verify Report</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectAction(report, "in_progress")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl shadow-xs transition-colors ${
                  report.status === "in_progress"
                    ? "bg-purple-700 ring-2 ring-purple-400 text-white"
                    : "bg-purple-600 hover:bg-purple-700 text-white"
                }`}
                data-testid="detail-progress-btn"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Mark In Progress</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectAction(report, "resolved")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl shadow-xs transition-colors ${
                  report.status === "resolved"
                    ? "bg-emerald-700 ring-2 ring-emerald-400 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
                data-testid="detail-resolve-btn"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Resolved</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectAction(report, "dismissed")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl shadow-xs transition-colors ${
                  report.status === "dismissed"
                    ? "bg-rose-700 ring-2 ring-rose-400 text-white"
                    : "bg-rose-600 hover:bg-rose-700 text-white"
                }`}
                data-testid="detail-dismiss-btn"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Dismiss Report</span>
              </button>

              {report.status !== "unverified" && (
                <button
                  type="button"
                  onClick={() => onSelectAction(report, "unverified")}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors"
                  data-testid="detail-reopen-btn"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Reopen (Unverified)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-Size Photograph Lightbox Modal */}
      {lightboxOpen && report.photo_url && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          data-testid="evidence-lightbox-modal"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              title="Close Full Size"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={resolveMediaUrl(report.photo_url) || ""}
              alt="High-resolution evidence"
              className="max-h-[80vh] w-auto rounded-xl object-contain shadow-2xl border border-white/10"
              data-testid="full-size-evidence-image"
            />
            <div className="mt-3 text-center text-xs text-white/80">
              <span className="font-bold">{report.id}</span> • {report.location_name} • Click anywhere outside to close
            </div>
          </div>
        </div>
      )}
    </>
  );
};

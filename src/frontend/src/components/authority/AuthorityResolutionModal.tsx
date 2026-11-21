import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Wrench,
  XCircle,
  AlertTriangle,
  X,
  Send,
  Loader2,
  MapPin,
  Tag,
} from "lucide-react";
import { CitizenReport } from "../../types";

interface AuthorityResolutionModalProps {
  report: CitizenReport;
  targetStatus: "verified" | "in_progress" | "resolved" | "dismissed" | string;
  onConfirm: (reportId: string, status: string, note: string) => Promise<void>;
  onClose: () => void;
  isSubmitting?: boolean;
}

export const AuthorityResolutionModal: React.FC<AuthorityResolutionModalProps> = ({
  report,
  targetStatus,
  onConfirm,
  onClose,
  isSubmitting = false,
}) => {
  const [note, setNote] = useState<string>(report.resolution_note || "");

  const getStatusMeta = (st: string) => {
    switch (st) {
      case "verified":
        return {
          title: "Verify Citizen Report",
          actionText: "Confirm Verification",
          icon: CheckCircle2,
          color: "text-cyan-600 dark:text-cyan-400",
          bgBadge: "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
          btnColor: "bg-cyan-600 hover:bg-cyan-700 text-white",
          placeholder: "e.g. Field camera verification confirmed: roadway obstructed by loose debris.",
          defaultNote: "Confirmed by Municipal Traffic Control. Road inspection scheduled.",
        };
      case "in_progress":
        return {
          title: "Mark as In Progress",
          actionText: "Dispatch Work Order",
          icon: Wrench,
          color: "text-purple-600 dark:text-purple-400",
          bgBadge: "bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800",
          btnColor: "bg-purple-600 hover:bg-purple-700 text-white",
          placeholder: "e.g. Municipal road maintenance crew #4 dispatched with asphalt filler.",
          defaultNote: "Road maintenance operations underway. Crew dispatched to site.",
        };
      case "resolved":
        return {
          title: "Mark as Fully Resolved",
          actionText: "Confirm Resolution",
          icon: CheckCircle2,
          color: "text-emerald-600 dark:text-emerald-400",
          bgBadge: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
          btnColor: "bg-emerald-600 hover:bg-emerald-700 text-white",
          placeholder: "e.g. Obstruction removed, pothole filled, and traffic moving normally.",
          defaultNote: "Issue resolved. Roadway cleared and restored to regular traffic flow.",
        };
      case "dismissed":
        return {
          title: "Dismiss Report",
          actionText: "Confirm Dismissal",
          icon: XCircle,
          color: "text-rose-600 dark:text-rose-400",
          bgBadge: "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
          btnColor: "bg-rose-600 hover:bg-rose-700 text-white",
          placeholder: "e.g. Inspection found no obstruction or issue was already cleared.",
          defaultNote: "Report reviewed by authorities but could not be substantiated or duplicate.",
        };
      case "unverified":
        return {
          title: "Reopen / Set Unverified",
          actionText: "Confirm Reopen",
          icon: AlertTriangle,
          color: "text-amber-600 dark:text-amber-400",
          bgBadge: "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
          btnColor: "bg-amber-600 hover:bg-amber-700 text-white",
          placeholder: "e.g. Reopened for follow-up traffic inspection.",
          defaultNote: "Report reopened by Municipal Traffic Control for renewed verification.",
        };
      default:
        return {
          title: `Update to ${st.toUpperCase()}`,
          actionText: "Update Status",
          icon: Clock,
          color: "text-blue-600 dark:text-blue-400",
          bgBadge: "bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
          btnColor: "bg-blue-600 hover:bg-blue-700 text-white",
          placeholder: "Enter resolution remarks...",
          defaultNote: "",
        };
    }
  };

  const meta = getStatusMeta(targetStatus);
  const Icon = meta.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalNote = note.trim() || meta.defaultNote;
    await onConfirm(report.id, targetStatus, finalNote);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      data-testid="authority-resolution-modal"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#161920]">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${meta.bgBadge}`}>
              <Icon className={`w-5 h-5 ${meta.color}`} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-serif font-medium text-slate-900 dark:text-white">
                {meta.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#8E939E]">
                Official Municipal Action • Submitting citizen will be notified
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1B1D22] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* Report Context Card */}
          <div className="p-3.5 rounded-xl bg-slate-100/70 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-slate-800 dark:text-[#E8EAEE]">
                {report.id}
              </span>
              <span className="font-bold capitalize text-slate-500 dark:text-[#8E939E] flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {report.category.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-[#C5C8D0] font-medium">
              <MapPin className="w-3.5 h-3.5 text-blue-500 dark:text-[#9AC2FA] shrink-0" />
              <span className="line-clamp-1">{report.location_name}</span>
            </div>
            <p className="text-slate-600 dark:text-[#8E939E] italic line-clamp-2 pt-1 border-t border-slate-200 dark:border-white/[0.07]">
              "{report.description}"
            </p>
          </div>

          {/* Transition Visual */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-[#8E939E]">Current Status:</span>
              <span className="font-mono font-bold uppercase text-slate-700 dark:text-[#E8EAEE]">
                {report.status.replace(/_/g, " ")}
              </span>
            </div>
            <span className="text-slate-400 dark:text-[#8E939E]">→</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-[#8E939E]">New Status:</span>
              <span className={`font-mono font-extrabold uppercase px-2 py-0.5 rounded ${meta.bgBadge}`}>
                {targetStatus.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          {/* Official Resolution Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-[#C5C8D0] flex items-center justify-between">
              <span>Official Authority Resolution Note / Remarks:</span>
              <span className="text-[10px] font-normal text-slate-400 dark:text-[#8E939E]">Optional</span>
            </label>
            <textarea
              rows={3}
              placeholder={meta.placeholder}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/[0.10] bg-white dark:bg-[#1B1D22] text-slate-900 dark:text-white text-xs sm:text-sm placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#9AC2FA]"
              data-testid="resolution-note-input"
            />
            <p className="text-[11px] text-slate-400 dark:text-[#8E939E]">
              This note will be permanently logged to the report activity timeline and included in the citizen's notification.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/[0.10] bg-white dark:bg-[#1B1D22] text-slate-700 dark:text-[#E8EAEE] hover:bg-slate-100 dark:hover:bg-[#22252C] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all ${meta.btnColor} ${
                isSubmitting ? "opacity-60 cursor-not-allowed" : ""
              }`}
              data-testid="confirm-status-update-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{meta.actionText}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

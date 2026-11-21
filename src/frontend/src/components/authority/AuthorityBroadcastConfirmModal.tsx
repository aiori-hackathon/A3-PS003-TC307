import React, { useState } from "react";
import {
  Send,
  AlertTriangle,
  X,
  Radio,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { MunicipalAdvisory } from "../../services/advisoryEngine";
import { api } from "../../services/api";

interface AuthorityBroadcastConfirmModalProps {
  advisory: MunicipalAdvisory | null;
  onClose: () => void;
  onSuccess: (incidentId: string) => void;
}

export const AuthorityBroadcastConfirmModal: React.FC<AuthorityBroadcastConfirmModalProps> = ({
  advisory,
  onClose,
  onSuccess,
}) => {
  if (!advisory) return null;
  return (
    <AuthorityBroadcastConfirmModalContent
      advisory={advisory}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
};

const AuthorityBroadcastConfirmModalContent: React.FC<{
  advisory: MunicipalAdvisory;
  onClose: () => void;
  onSuccess: (incidentId: string) => void;
}> = ({ advisory, onClose, onSuccess }) => {

  const [description, setDescription] = useState<string>(
    `[MUNICIPAL TRAFFIC ADVISORY] ${advisory.title}: ${advisory.observation}`
  );
  const [recommendedAction, setRecommendedAction] = useState<string>(
    advisory.recommendation
  );
  const [severity, setSeverity] = useState<"critical" | "warning" | "info">(
    advisory.priority === "critical" ? "critical" : advisory.priority === "high" ? "warning" : "info"
  );
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirmBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !recommendedAction.trim()) {
      setErrorMsg("Description and recommended action cannot be empty.");
      return;
    }

    setIsPublishing(true);
    setErrorMsg(null);
    try {
      const res = await api.createIncident({
        intersection_id: advisory.location.intersectionId === "NONE" ? "INT-01" : advisory.location.intersectionId,
        incident_type: "authority_advisory",
        severity,
        description_en: description.trim(),
        recommended_action_en: recommendedAction.trim(),
        source: "authority_advisory",
      });
      onSuccess(res.id);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to broadcast advisory.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      data-testid="authority-broadcast-confirm-modal"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-[#111318] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/70 dark:bg-[#161920]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-500 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-serif font-semibold text-slate-900 dark:text-white">
                Broadcast Public Traffic Advisory
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official Municipal Alert Dispatcher
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1B1D22] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirmBroadcast} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Explicit Safety Notice */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 space-y-1">
            <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Explicit Municipal Authority Confirmation Required</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              Confirming this broadcast will publish an official traffic advisory across citizen feeds, live traffic alert tickers, and navigation advisory streams.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Severity Select */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-[#C5C8D0] block mb-1">
              Public Alert Severity Tier
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9AC2FA]"
            >
              <option value="critical">Critical (Severe Gridlock / Emergency Obstruction / Monsoon Flood)</option>
              <option value="warning">Warning (Heavy Arterial Slowdown / Lane Restriction)</option>
              <option value="info">Info (Precautionary Advisory / Alternate Flow Notice)</option>
            </select>
          </div>

          {/* Location Summary */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] font-mono text-[11px] text-slate-700 dark:text-[#C5C8D0]">
            <span>Target Location: </span>
            <strong className="text-slate-900 dark:text-white">{advisory.location.name} [{advisory.location.intersectionId}]</strong>
          </div>

          {/* Advisory Description Input */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-[#C5C8D0] block mb-1">
              Public Alert Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#9AC2FA]"
              data-testid="broadcast-description-input"
            />
          </div>

          {/* Recommended Action Input */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-[#C5C8D0] block mb-1">
              Motorist Recommended Action
            </label>
            <textarea
              rows={2}
              value={recommendedAction}
              onChange={(e) => setRecommendedAction(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#9AC2FA]"
              data-testid="broadcast-action-input"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              disabled={isPublishing}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#1B1D22] border border-transparent dark:border-white/[0.10] text-slate-700 dark:text-[#E8EAEE] font-semibold text-xs hover:bg-slate-200 dark:hover:bg-[#22252C] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPublishing}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
              data-testid="confirm-broadcast-submit-btn"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isPublishing ? "Broadcasting..." : "Confirm & Broadcast Advisory"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

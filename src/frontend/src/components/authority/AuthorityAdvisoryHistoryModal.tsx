import React, { useState } from "react";
import {
  History,
  X,
  Search,
  Filter,
  Radio,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { MunicipalAdvisory, MunicipalAdvisoryEngine, AdvisoryStatus } from "../../services/advisoryEngine";

interface AuthorityAdvisoryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAdvisory: (advisory: MunicipalAdvisory) => void;
}

export const AuthorityAdvisoryHistoryModal: React.FC<AuthorityAdvisoryHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectAdvisory,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  if (!isOpen) return null;

  const history = MunicipalAdvisoryEngine.getHistory();

  const filteredHistory = history.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        item.title.toLowerCase().includes(q) ||
        item.location.name.toLowerCase().includes(q) ||
        item.observation.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "high":
        return "bg-orange-500/20 text-orange-300 border-orange-500/40";
      case "medium":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      default:
        return "bg-blue-500/20 text-cyan-300 border-blue-500/40";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "action_taken":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "reviewed":
        return "bg-blue-500/20 text-blue-300 border-blue-500/40";
      case "dismissed":
        return "bg-slate-700/60 text-slate-400 border-slate-600";
      case "new":
      default:
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      data-testid="authority-advisory-history-modal"
    >
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#111318] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/70 dark:bg-[#161920]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#9AC2FA]/10 border border-blue-200 dark:border-[#9AC2FA]/25 text-blue-600 dark:text-[#9AC2FA] flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-serif font-medium text-slate-900 dark:text-white">
                Municipal AI Advisory History & Audit Log
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#8E939E]">
                Review past decision-support recommendations, authority triage actions, and dismissed events.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1B1D22] transition-colors cursor-pointer"
            data-testid="close-advisory-history-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/40 dark:bg-[#111318] flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 dark:text-[#8E939E]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter history by title, location, or keyword..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#9AC2FA]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] font-semibold text-slate-700 dark:text-[#E8EAEE] text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="reviewed">Reviewed</option>
              <option value="action_taken">Action Taken</option>
              <option value="dismissed">Dismissed</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] font-semibold text-slate-700 dark:text-[#E8EAEE] text-xs"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* History List Table / Cards */}
        <div className="p-4 overflow-y-auto space-y-2.5 max-h-[55vh]">
          {filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 dark:text-[#8E939E]">
              No advisory records matching current filters.
            </div>
          ) : (
            filteredHistory.map((adv) => (
              <div
                key={adv.id}
                onClick={() => {
                  onSelectAdvisory(adv);
                  onClose();
                }}
                className="p-3.5 rounded-xl bg-white dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] hover:border-blue-500/40 dark:hover:border-[#9AC2FA]/40 hover:bg-slate-50 dark:hover:bg-[#1B1D22] transition-all cursor-pointer space-y-1.5"
                data-testid={`history-item-${adv.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${getPriorityBadgeClass(adv.priority)}`}>
                      {adv.priority}
                    </span>
                    <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${getStatusBadgeClass(adv.status)}`}>
                      {adv.status.replace("_", " ")}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 dark:text-[#8E939E]">
                      {adv.id}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-400 dark:text-[#8E939E] font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(adv.timestamp).toLocaleString()}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {adv.title}
                </h4>

                <p className="text-[11px] text-slate-600 dark:text-[#C5C8D0] line-clamp-2">
                  {adv.observation}
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-[#8E939E] pt-1">
                  <span>Location: <strong className="text-slate-700 dark:text-[#E8EAEE]">{adv.location.name}</strong></span>
                  <span className="text-blue-600 dark:text-[#9AC2FA] font-semibold hover:underline">Click to view details →</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#161920] flex items-center justify-between text-xs text-slate-400 dark:text-[#8E939E]">
          <span>{filteredHistory.length} recorded historical advisories</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-[#1B1D22] border border-transparent dark:border-white/[0.10] text-slate-800 dark:text-[#E8EAEE] font-bold hover:bg-slate-300 dark:hover:bg-[#22252C] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

import React from "react";
import { Bell, CheckCheck, CheckCircle2, Clock, MapPin, ShieldCheck, X } from "lucide-react";
import { CitizenNotification } from "../../types";

interface CitizenNotificationDrawerProps {
  isOpen: boolean;
  isHindi: boolean;
  notifications: CitizenNotification[];
  unreadCount: number;
  onClose: () => void;
  onMarkRead: (notificationId: string) => Promise<void> | void;
  onMarkAllRead: () => Promise<void> | void;
  onSelectReport?: (reportId: string, notification?: CitizenNotification) => void;
}

const getStatusPillClass = (status: string): string => {
  switch (status.toLowerCase()) {
    case "resolved":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
    case "in_progress":
      return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800";
    case "verified":
      return "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800";
    case "dismissed":
      return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
    default:
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
  }
};

export const CitizenNotificationDrawer: React.FC<CitizenNotificationDrawerProps> = ({
  isOpen,
  isHindi,
  notifications,
  unreadCount,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onSelectReport,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
      onClick={onClose}
      data-testid="notification-center-drawer"
      role="dialog"
      aria-modal="true"
      aria-label={isHindi ? "नागरिक सूचना केंद्र" : "Municipal Notification Center"}
    >
      <div
        className="w-full max-w-md h-full bg-white dark:bg-[#111318] border-l border-slate-200 dark:border-white/[0.08] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/80 dark:bg-[#161920]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700 dark:bg-[#9AC2FA]/15 dark:text-[#9AC2FA]">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-medium text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>{isHindi ? "नगर निगम अपडेट" : "Municipal Updates"}</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-sans font-bold rounded-full bg-rose-600 text-white">
                    {unreadCount}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#8C93A4]">
                {isHindi
                  ? "प्राधिकरण द्वारा आपकी शिकायतों पर की गई कार्रवाई"
                  : "Authority verification, dispatch & resolution updates"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => onMarkAllRead()}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-[#9AC2FA]/15 dark:text-[#9AC2FA] dark:hover:bg-[#9AC2FA]/25 transition-colors cursor-pointer"
                data-testid="mark-all-read-btn"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{isHindi ? "सभी पढ़ें" : "Mark All Read"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1B1D22] transition-colors cursor-pointer"
              data-testid="close-notification-drawer-btn"
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center px-6 text-slate-400 dark:text-[#8C93A4]">
              <Bell className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm font-semibold text-slate-600 dark:text-[#E8EAEE]">
                {isHindi ? "कोई नई सूचना नहीं" : "No notifications yet"}
              </p>
              <p className="text-xs mt-1">
                {isHindi
                  ? "जब अधिकारी आपकी शिकायत की स्थिति बदलेंगे, तो अपडेट यहाँ दिखाई देंगे।"
                  : "Authority status changes and resolution notes for reports will appear here."}
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.is_read) {
                    void onMarkRead(notif.id);
                  }
                  if (onSelectReport && notif.report_id) {
                    onSelectReport(notif.report_id, notif);
                  }
                }}
                className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
                  notif.is_read
                    ? "bg-white dark:bg-[#161920] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16]"
                    : "bg-blue-50/70 dark:bg-[#9AC2FA]/[0.07] border-blue-200 dark:border-[#9AC2FA]/30 shadow-xs hover:border-blue-300 dark:hover:border-[#9AC2FA]/50"
                }`}
                data-testid="notification-item"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-[#9AC2FA] shrink-0" />
                    )}
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {notif.title}
                    </h4>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${getStatusPillClass(
                      notif.status
                    )}`}
                  >
                    {notif.status.replace(/_/g, " ")}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-[#C5C8D0] mt-1.5 leading-relaxed">
                  {notif.message}
                </p>

                {notif.resolution_note && (
                  <div className="mt-2 p-2.5 rounded-lg bg-slate-100/80 dark:bg-[#1B1D22] border border-slate-200/80 dark:border-white/[0.08] text-[11px] text-slate-700 dark:text-[#E8EAEE] flex items-start gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Official Authority Note: </span>
                      <span>{notif.resolution_note}</span>
                    </div>
                  </div>
                )}

                <div className="mt-2.5 flex items-center justify-between gap-2 text-[10px] text-slate-400 dark:text-[#8C93A4]">
                  <div className="flex items-center gap-3 min-w-0">
                    {notif.location_name && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{notif.location_name}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {new Date(notif.created_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {!notif.is_read && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onMarkRead(notif.id);
                      }}
                      className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-[#9AC2FA] hover:underline shrink-0 cursor-pointer"
                      data-testid="mark-read-btn"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Mark Read</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

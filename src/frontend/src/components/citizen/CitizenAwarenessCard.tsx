import React from "react";
import { BookOpen, Compass, Info, ShieldAlert } from "lucide-react";
import { IncidentItem } from "../../types";
import { ClassifiedTrafficStatus } from "../../utils/trafficStatus";

interface CitizenAwarenessCardProps {
  isHindi: boolean;
  activeStatus: ClassifiedTrafficStatus;
  locationName: string;
  activeIncidents: IncidentItem[];
  isSimulatedData: boolean;
}

const GUIDE_LEVELS = [
  {
    key: "smooth",
    title: "Smooth (35+ km/h)",
    titleHi: "सुगम (35+ किमी/घंटा)",
    desc: "Open arterial lanes, minimal signal queues, predictable commute time.",
    descHi: "खुली सड़कें, कम सिग्नल प्रतीक्षा और समय पर यात्रा।",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  {
    key: "moderate",
    title: "Moderate (22–34 km/h)",
    titleHi: "मध्यम (22–34 किमी/घंटा)",
    desc: "Steady urban pace with typical signal stops; plan a 5-min buffer.",
    descHi: "सामान्य शहरी गति; 5 मिनट का अतिरिक्त समय रखें।",
    badge: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  {
    key: "heavy",
    title: "Heavy (14–21 km/h)",
    titleHi: "भारी (14–21 किमी/घंटा)",
    desc: "Noticeable intersection bottlenecks; consider parallel ring roads.",
    descHi: "चौराहों पर भीड़; वैकल्पिक बाईपास या रिंग रोड चुनें।",
    badge: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
    dot: "bg-orange-500",
  },
  {
    key: "severe",
    title: "Severe (< 14 km/h)",
    titleHi: "अत्यधिक गंभीर (< 14 किमी/घंटा)",
    desc: "Gridlock or road closure. Avoid corridor or shift to public transit.",
    descHi: "गंभीर जाम या मार्ग बंद। यात्रा टालें या मेट्रो उपयोग करें।",
    badge: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
    dot: "bg-red-600",
  },
];

export const CitizenAwarenessCard: React.FC<CitizenAwarenessCardProps> = ({
  isHindi,
  activeStatus,
  locationName,
  activeIncidents,
  isSimulatedData,
}) => {
  const hour = new Date().getHours();
  const isPeakWindow = (hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 20);
  const closureCount = activeIncidents.filter((i) => i.incident_type.includes("closure")).length;

  const practicalTip = (() => {
    if (closureCount > 0) {
      return isHindi
        ? `इस समय ${closureCount} सड़क बंदी सूचना सक्रिय है। निकलने से पहले स्मार्ट रूट में 'सड़क बंदी से बचें' विकल्प चालू रखें।`
        : `${closureCount} active road closure notice detected. Keep "Avoid closed roads" enabled in Smart Route Assistance before leaving.`;
    }
    if (activeStatus.level === "severe" || activeStatus.level === "heavy") {
      return isHindi
        ? `${locationName} के आसपास यातायात दबाव अधिक है। संभव हो तो 20–30 मिनट बाद प्रस्थान करें या मेट्रो मार्ग अपनाएं।`
        : `Slow-moving traffic near ${locationName}. If flexible, delay departure by 20–30 minutes or switch to Metro / bypass routes.`;
    }
    if (isPeakWindow) {
      return isHindi
        ? "अभी पीक कम्यूट ऑवर चल रहा है। प्रमुख चौराहों पर अचानक भीड़ बढ़ने से बचने के लिए 10 मिनट पहले निकलें।"
        : "Peak commuter window is active. Leave 10 minutes earlier and keep alternative routes handy for sudden signal queues.";
    }
    return isHindi
      ? "वर्तमान में यातायात सामान्य है। सुरक्षित दूरी बनाए रखें और ट्रैफिक संकेतों का पालन करें।"
      : "Corridor flow is relatively steady. Maintain safe braking gaps and report any sudden hazards in Citizen Complaints.";
  })();

  return (
    <div
      className="p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4"
      data-testid="citizen-awareness-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600 dark:text-[#9AC2FA]" />
          <h2 className="font-serif font-medium text-base sm:text-lg text-slate-900 dark:text-white">
            {isHindi ? "यात्री ट्रैफिक गाइड एवं व्यावहारिक सलाह" : "Traffic Awareness & Practical Commuter Advice"}
          </h2>
        </div>
        <span className="text-[11px] text-slate-400 dark:text-[#8C93A4]">
          {isSimulatedData
            ? isHindi
              ? "मॉडल मार्गदर्शन"
              : "Plain-language commuter reference"
            : isHindi
            ? "लाइव संदर्भ आधारित सलाह"
            : "Live-informed guidance"}
        </span>
      </div>

      {/* Actionable Advice Callout */}
      <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-[#161920] border border-blue-200/70 dark:border-white/[0.09] flex items-start gap-3 text-xs">
        {closureCount > 0 || activeStatus.level === "severe" ? (
          <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
        ) : (
          <Compass className="w-4 h-4 text-blue-600 dark:text-[#9AC2FA] shrink-0 mt-0.5" />
        )}
        <div className="space-y-1">
          <span className="font-semibold text-slate-900 dark:text-[#9AC2FA] block">
            {isHindi ? "आज के सफर के लिए सलाह" : "Commuter Advice for Right Now"}
          </span>
          <p className="text-slate-700 dark:text-[#C5C8D0] leading-relaxed">
            {practicalTip}
          </p>
        </div>
      </div>

      {/* 4-Tier Plain-Language Condition Guide */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {GUIDE_LEVELS.map((tier) => {
          const isCurrent = activeStatus.level === tier.key;
          return (
            <div
              key={tier.key}
              className={`p-3 rounded-xl border text-xs space-y-1 transition-colors ${
                isCurrent
                  ? "border-blue-500 dark:border-[#9AC2FA]/50 ring-1 ring-blue-500/20 dark:ring-[#9AC2FA]/20 bg-blue-50/50 dark:bg-[#9AC2FA]/[0.06]"
                  : "border-slate-200 dark:border-white/[0.07] bg-slate-50/60 dark:bg-[#161920]"
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${tier.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
                  {isHindi ? tier.titleHi : tier.title}
                </span>
                {isCurrent && (
                  <span className="text-[9px] font-bold uppercase text-blue-600 dark:text-[#9AC2FA]">
                    Current
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-[#C5C8D0] leading-relaxed pt-0.5">
                {isHindi ? tier.descHi : tier.desc}
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span>
          {isHindi
            ? "यातायात की स्थिति वास्तविक सड़क गति बनाम सामान्य मुक्त-प्रवाह गति के अनुपात पर आधारित है।"
            : "Conditions compare observed road speed against normal free-flow speed so commuters can judge delay risk at a glance."}
        </span>
      </p>
    </div>
  );
};

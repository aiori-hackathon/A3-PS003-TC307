export type CitizenTrafficLevel = "smooth" | "moderate" | "heavy" | "severe" | "unavailable";

export interface ClassifiedTrafficStatus {
  level: CitizenTrafficLevel;
  shortLabel: string;
  shortLabelHi: string;
  label: string;
  labelHi: string;
  advice: string;
  adviceHi: string;
  meaning: string;
  meaningHi: string;
  colorText: string;
  bannerBg: string;
  bannerBorder: string;
  badgeClasses: string;
  dotClass: string;
}

export interface TrafficConditionInput {
  currentSpeed?: number | null;
  freeFlowSpeed?: number | null;
  congestionLevel?: string | null;
  roadClosure?: boolean;
  unavailableReason?: string | null;
}

/**
 * Classifies live/observed road speed and free-flow baseline into citizen-facing
 * Smooth, Moderate, Heavy, Severe, or Unavailable tiers without inventing missing readings.
 */
export function classifyTrafficCondition(input: TrafficConditionInput): ClassifiedTrafficStatus {
  const { currentSpeed, freeFlowSpeed, congestionLevel, roadClosure, unavailableReason } = input;

  if (roadClosure) {
    return {
      level: "severe",
      shortLabel: "Severe",
      shortLabelHi: "अत्यधिक गंभीर",
      label: "Severe Traffic — Road Closure / Standstill",
      labelHi: "अत्यधिक गंभीर ट्रैफिक — मार्ग बंद / ठहराव",
      meaning: "Active road closure or severe gridlock causing long delays.",
      meaningHi: "सड़क बंद या अत्यधिक जाम के कारण भारी देरी संभव है।",
      advice: "Avoid this stretch completely and take a recommended bypass or Metro.",
      adviceHi: "इस मार्ग से बचें और वैकल्पिक बाईपास या मेट्रो का उपयोग करें।",
      colorText: "text-red-700 dark:text-red-300",
      bannerBg: "bg-red-50 dark:bg-red-950/40",
      bannerBorder: "border-red-300 dark:border-red-800",
      badgeClasses:
        "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
      dotClass: "bg-red-600",
    };
  }

  if (currentSpeed === null || currentSpeed === undefined || Number.isNaN(currentSpeed)) {
    return {
      level: "unavailable",
      shortLabel: "Unavailable",
      shortLabelHi: "डेटा अनुपलब्ध",
      label: "Live Road Speed Unavailable",
      labelHi: "लाइव सड़क गति अनुपलब्ध",
      meaning: "Live road segment flow data could not be retrieved for these coordinates.",
      meaningHi: "इन निर्देशांकों के लिए लाइव सड़क गति डेटा प्राप्त नहीं हो सका।",
      advice:
        unavailableReason ||
        "Check nearby monitored Delhi NCR junctions or retry from an arterial road.",
      adviceHi:
        unavailableReason ||
        "निकटतम दिल्ली एनसीआर जंक्शन जांचें या मुख्य सड़क से पुनः प्रयास करें।",
      colorText: "text-slate-700 dark:text-slate-300",
      bannerBg: "bg-slate-100 dark:bg-slate-800/80",
      bannerBorder: "border-slate-300 dark:border-slate-700",
      badgeClasses:
        "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      dotClass: "bg-slate-400",
    };
  }

  const ff = freeFlowSpeed && freeFlowSpeed > 0 ? freeFlowSpeed : 50;
  const ratio = currentSpeed / Math.max(ff, 10);
  const rawLevel = (congestionLevel || "").toLowerCase();

  if (currentSpeed < 14 || ratio < 0.32 || rawLevel === "critical") {
    return {
      level: "severe",
      shortLabel: "Severe",
      shortLabelHi: "अत्यधिक गंभीर",
      label: "Severe Congestion — Very Slow / Standstill",
      labelHi: "अत्यधिक गंभीर जाम — बहुत धीमी गति",
      meaning: "Bumper-to-bumper delays; speeds under 14 km/h.",
      meaningHi: "वाहनों की कतार और बहुत धीमी गति (14 किमी/घंटा से कम)।",
      advice: "Expect 15–25+ min delays. Postpone non-urgent travel or take Delhi Metro / detour.",
      adviceHi: "15-25+ मिनट की देरी संभावित है। यात्रा टालें या मेट्रो / वैकल्पिक मार्ग अपनाएं।",
      colorText: "text-red-700 dark:text-red-300",
      bannerBg: "bg-red-50 dark:bg-red-950/40",
      bannerBorder: "border-red-300 dark:border-red-800",
      badgeClasses:
        "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
      dotClass: "bg-red-600",
    };
  }

  if (rawLevel === "severe" || rawLevel === "heavy" || currentSpeed < 22 || ratio < 0.5) {
    return {
      level: "heavy",
      shortLabel: "Heavy",
      shortLabelHi: "भारी ट्रैफिक",
      label: "Heavy Traffic — Slow Moving",
      labelHi: "भारी ट्रैफिक — धीमी गति",
      meaning: "Slow queues across intersections; typical speeds 14–21 km/h.",
      meaningHi: "चौराहों पर धीमी गति (14–21 किमी/घंटा) और कतारें।",
      advice: "Allow an extra 10–15 minutes or switch to an arterial bypass below.",
      adviceHi: "10–15 मिनट अतिरिक्त समय लेकर चलें या नीचे दिए गए वैकल्पिक मार्ग का उपयोग करें।",
      colorText: "text-orange-700 dark:text-orange-300",
      bannerBg: "bg-orange-50 dark:bg-orange-950/40",
      bannerBorder: "border-orange-300 dark:border-orange-800",
      badgeClasses:
        "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
      dotClass: "bg-orange-500",
    };
  }

  if (rawLevel === "moderate" || currentSpeed < 35 || ratio < 0.78) {
    return {
      level: "moderate",
      shortLabel: "Moderate",
      shortLabelHi: "मध्यम ट्रैफिक",
      label: "Moderate Traffic — Moving Steadily",
      labelHi: "मध्यम ट्रैफिक — सामान्य गति",
      meaning: "Active urban flow with minor signal delays (22–34 km/h).",
      meaningHi: "सामान्य शहरी यातायात और सिग्नल पर हल्का ठहराव (22–34 किमी/घंटा)।",
      advice: "Traffic is moving steadily. Add a 5-minute buffer during peak commute hours.",
      adviceHi: "यातायात सुचारू रूप से चल रहा है। पीक ऑवर्स में 5 मिनट का बफर रखें।",
      colorText: "text-amber-700 dark:text-amber-300",
      bannerBg: "bg-amber-50 dark:bg-amber-950/40",
      bannerBorder: "border-amber-300 dark:border-amber-800",
      badgeClasses:
        "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
      dotClass: "bg-amber-500",
    };
  }

  return {
    level: "smooth",
    shortLabel: "Smooth",
    shortLabelHi: "सुगम / खुला",
    label: "Smooth Traffic — Clear Flow",
    labelHi: "सुगम आवागमन — खुला रास्ता",
    meaning: "Free-flowing lanes near posted speeds (35+ km/h).",
    meaningHi: "सड़कें खुली हैं और वाहन सामान्य गति (35+ किमी/घंटा) से चल रहे हैं।",
    advice: "Roads are clear along this stretch. Ideal time for your commute.",
    adviceHi: "इस मार्ग पर आवागमन सुगम है। यात्रा के लिए यह उपयुक्त समय है।",
    colorText: "text-emerald-700 dark:text-emerald-300",
    bannerBg: "bg-emerald-50 dark:bg-emerald-950/40",
    bannerBorder: "border-emerald-300 dark:border-emerald-800",
    badgeClasses:
      "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dotClass: "bg-emerald-500",
  };
}

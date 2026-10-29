import React from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import {
  ShieldCheck,
  Lock,
  Cpu,
  Server,
  ArrowRight,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  Database,
  Radio,
} from "lucide-react";

export const PrivacyCenter: React.FC = () => {
  const { t } = useTranslation();
  const { isHindi } = useLanguage();

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t("privacy.title")}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t("privacy.subtitle")}
        </p>
      </div>

      {/* Visual Edge-to-Cloud Architecture Diagram */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            {t("privacy.diagram_title")}
          </h3>
          <p className="text-xs text-slate-500">
            {isHindi
              ? "कच्चा टेलीमेट्री डेटा स्थानीय एज स्तर पर ही रहता है; केवल गणितीय मॉडल पैरामीटर सर्वर तक पहुंचते हैं।"
              : "Raw video and vehicular observations remain strictly on-device; only mathematical model parameters leave the edge."}
          </p>
        </div>

        {/* Diagram Flow Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Edge Devices */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                {isHindi ? "रोडसाइड एज नोड्स (क्लाइंट्स A, B, C)" : "Roadside Edge Sensor Nodes"}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {isHindi ? "सड़क किनारों पर तैनात स्थानीय कम्प्यूट" : "Local IoT computation units"}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold border border-emerald-500/20">
              {isHindi ? "✓ 100% कच्चा डेटा स्थानीय रहता है" : "✓ 100% Raw Data Kept Local"}
            </div>
          </div>

          {/* Transfer Arrow & Compression */}
          <div className="flex flex-col items-center justify-center text-center space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-800">
              <Lock className="w-3.5 h-3.5" />
              <span>RFC 9000 QUIC • Top-K + INT8 Gradients</span>
            </div>
            <div className="text-slate-400">
              <ArrowRight className="w-6 h-6 hidden md:block" />
            </div>
            <span className="text-[10px] text-slate-400 max-w-xs">
              {isHindi
                ? "कोई भी वाहन पहचान या वीडियो फुटेज स्थानांतरित नहीं होता।"
                : "No personal or vehicle-identifying video streams are transmitted."}
            </span>
          </div>

          {/* Central Cloud Server */}
          <div className="p-5 rounded-2xl bg-navy-900 text-white border border-blue-500/30 text-center space-y-3 shadow-md">
            <div className="w-12 h-12 mx-auto rounded-xl bg-blue-600 flex items-center justify-center">
              <Server className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-sm">
                {isHindi ? "केंद्रीय FedAvg एग्रीगेटर" : "Central FedAvg Aggregator"}
              </h4>
              <p className="text-xs text-blue-200 mt-0.5">
                {isHindi ? "वैश्विक मॉडल पैरामीटर एकत्रीकरण" : "Global Parameter Synthesis"}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-white/10 text-blue-200 text-[11px] font-semibold">
              {isHindi ? "केवल गणितीय वेट्स प्राप्त होते हैं" : "Receives Numerical Weights Only"}
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Breakdown: Local vs Transmitted */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Local Storage */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-base">
            <CheckCircle2 className="w-5 h-5" />
            <h3>{t("privacy.local_data_title")}</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {t("privacy.local_data_desc")}
          </p>
          <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">•</span>
              <span>
                {isHindi
                  ? "हाई-डेफिनिशन कैमरा फुटेज और वाहन प्लेट डिटेक्शन केवल स्थानीय रैम में प्रोसेस होते हैं।"
                  : "High-definition camera frames and license plate OCR are processed strictly in edge RAM."}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">•</span>
              <span>
                {isHindi
                  ? "सेंसर टाइमस्टैम्प और व्यक्तिगत वाहन स्पीड रिकॉर्ड 24 घंटे बाद स्थानीय रूप से नष्ट हो जाते हैं।"
                  : "Granular sensor timestamps and individual speeds are automatically purged after 24 hours."}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">•</span>
              <span>
                {isHindi
                  ? "एज नोड और सेंट्रल सर्वर के बीच RFC 9000 (QUIC) आधारित TLS 1.3 एन्क्रिप्टेड टनल।"
                  : "Encrypted point-to-point RFC 9000 (QUIC) multiplexed stream with TLS 1.3 encapsulation."}
              </span>
            </li>
          </ul>
        </div>

        {/* Transmitted Payloads */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-base">
            <Radio className="w-5 h-5" />
            <h3>{t("privacy.cloud_data_title")}</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {t("privacy.cloud_data_desc")}
          </p>
          <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">•</span>
              <span>
                {isHindi
                  ? "टॉप-K स्पार्सिफाइड ग्रेडिएंट इंडेक्स और फ्लोट/INT8 वेट्स।"
                  : "Top-K sparsified gradient indices and quantized INT8 weight matrices."}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">•</span>
              <span>
                {isHindi
                  ? "FedAvg भारण हेतु कुल सैंपल्स की संख्या (n_k)।"
                  : "Total observation sample count (n_k) for FedAvg sample weighting."}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">•</span>
              <span>
                {isHindi
                  ? "नोड स्थिति टेलीमेट्री (बैटरी स्वास्थ्य, नेटवर्क लेटेंसी)।"
                  : "Hardware diagnostics (battery health, latency) without personal user information."}
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Honest Inference Vulnerability Disclosure */}
      <div className="p-5 sm:p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-sm sm:text-base">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <h3>{t("privacy.disclaimer_title")}</h3>
        </div>
        <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          {t("privacy.disclaimer_desc")}
        </p>
        <div className="pt-2 flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-400">
          <span className="font-semibold">Roadmap:</span>
          <span>Differential Privacy (DP-SGD) with Gaussian noise perturbation planned for v2.0 release.</span>
        </div>
      </div>
    </div>
  );
};

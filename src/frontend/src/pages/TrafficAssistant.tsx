import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../services/api";
import { ChatResponse } from "../types";
import {
  Bot,
  Send,
  Loader2,
  CheckCircle,
  TrendingUp,
  AlertTriangle,
  Database,
  Sparkles,
  Shield,
  HelpCircle,
} from "lucide-react";

interface MessageItem {
  sender: "user" | "bot";
  text: string;
  observed_facts?: string[];
  model_predictions?: string[];
  recommendations?: string[];
  citations?: string[];
  timestamp: string;
}

export const TrafficAssistant: React.FC = () => {
  const { t } = useTranslation();
  const { language, isHindi } = useLanguage();
  const [inputMessage, setInputMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const [messages, setMessages] = useState<MessageItem[]>([
    {
      sender: "bot",
      text: isHindi
        ? "नमस्ते! मैं TrafficBot हूँ — स्मार्ट सिटी AI सहायक। मैं वर्तमान टेलीमेट्री, कालानुक्रमिक Ridge Regression मॉडल और 3-क्लाइंट फेडरेटेड लर्निंग के आधार पर सभी प्रश्नों का उत्तर देता हूँ। आप मुझसे क्या जानना चाहते हैं?"
        : "Hello! I am TrafficBot — your smart city AI assistant. Grounded in live sensor telemetry, chronological Ridge Regression models, and 3-client Federated Learning metrics, how can I help you?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || loading) return;

    const userMsg: MessageItem = {
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setLoading(true);

    try {
      const res: ChatResponse = await api.sendChatMessage(text, language);
      const botMsg: MessageItem = {
        sender: "bot",
        text: res.response,
        observed_facts: res.observed_facts,
        model_predictions: res.model_predictions,
        recommendations: res.recommendations,
        citations: res.data_citations,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: isHindi
            ? "प्रतिक्रिया प्राप्त करने में असमर्थ। कृपया जांचें कि बैकएंड सर्वर सक्रिय है।"
            : "Unable to retrieve response from backend API. Please check server connection.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    t("assistant.suggest_1"),
    t("assistant.suggest_2"),
    t("assistant.suggest_3"),
    t("assistant.suggest_4"),
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t("assistant.title")}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t("assistant.subtitle")}
        </p>
      </div>

      {/* Suggested Inquiries Chips */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span>{t("assistant.suggestions_title")}</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(s)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Window */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[520px] sm:h-[600px] overflow-hidden">
        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs sm:text-sm">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm ${
                  m.sender === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200/80 dark:border-slate-700/80"
                }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>

                {/* Grounding Fact Tags */}
                {m.observed_facts && m.observed_facts.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{t("assistant.observed_facts")}</span>
                    </div>
                    <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                      {m.observed_facts.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* AI Model Predictions */}
                {m.model_predictions && m.model_predictions.length > 0 && (
                  <div className="mt-2.5 pt-2 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-600 dark:text-amber-400">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{t("assistant.model_predictions")}</span>
                    </div>
                    <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                      {m.model_predictions.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations */}
                {m.recommendations && m.recommendations.length > 0 && (
                  <div className="mt-2.5 pt-2 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-blue-600 dark:text-blue-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{t("assistant.recommendations")}</span>
                    </div>
                    <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                      {m.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sources Cited */}
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-2.5 pt-1.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Database className="w-3 h-3" />
                    <span>{t("assistant.citations")}: {m.citations.join(", ")}</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 px-1">{m.timestamp}</span>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit text-slate-500 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span>{isHindi ? "डेटाबेस व मॉडल से जानकारी प्राप्त की जा रही है..." : "Querying database & models..."}</span>
            </div>
          )}
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={t("assistant.placeholder")}
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          <button
            type="submit"
            disabled={loading || !inputMessage.trim()}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden xs:inline">{t("assistant.send")}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

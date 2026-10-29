import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../services/api";
import { ChatResponse } from "../../types";
import {
  Bot,
  X,
  Send,
  Loader2,
  CheckCircle,
  TrendingUp,
  AlertTriangle,
  Database,
  Sparkles,
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

export const FloatingChatbot: React.FC = () => {
  const { t } = useTranslation();
  const { language, isHindi } = useLanguage();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const [messages, setMessages] = useState<MessageItem[]>([
    {
      sender: "bot",
      text: isHindi
        ? "नमस्ते! मैं TrafficBot हूँ। मैं वास्तविक समय ट्रैफिक डेटा, Ridge Regression भविष्यवाणियों और फेडरेटेड लर्निंग मेट्रिक्स के आधार पर आपके प्रश्नों का उत्तर दे सकता हूँ।"
        : "Hello! I am TrafficBot. Grounded in real-time sensor observations, Ridge Regression predictions, and Federated Learning metrics, how can I assist you today?",
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
            ? "क्षमा करें, प्रतिक्रिया प्राप्त करने में त्रुटि हुई। कृपया पुनः प्रयास करें।"
            : "Sorry, failed to retrieve an answer from the backend API. Please retry.",
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
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-2xl shadow-blue-500/40 transition-transform hover:scale-105 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Open AI Traffic Assistant"
        >
          <div className="relative">
            <Bot className="w-5 h-5 transition-transform group-hover:rotate-12" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <span className="text-sm font-semibold tracking-wide hidden xs:inline">TrafficBot</span>
        </button>
      )}

      {/* Slide-Up Chat Drawer / Dialog */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-96 md:w-[420px] max-h-[82vh] h-[580px] flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-navy-900 text-white border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm leading-tight">{t("assistant.title")}</h3>
                <p className="text-[10px] text-blue-300">
                  {isHindi ? "डेटा-ग्राउंडेड AI सहायक" : "Grounded Intelligence Assistant"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Suggestions Chips */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
            <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(s)}
                className="shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                    m.sender === "user"
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200/60 dark:border-slate-700/60"
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>

                  {/* Fact / Prediction / Recommendation Tags */}
                  {m.observed_facts && m.observed_facts.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200/40 dark:border-slate-700/40 space-y-1">
                      <div className="flex items-center gap-1 font-semibold text-[10px] text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="w-3 h-3" />
                        <span>{t("assistant.observed_facts")}</span>
                      </div>
                      <ul className="list-disc pl-4 text-[11px] text-slate-600 dark:text-slate-300">
                        {m.observed_facts.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {m.model_predictions && m.model_predictions.length > 0 && (
                    <div className="mt-2 pt-1.5 space-y-1">
                      <div className="flex items-center gap-1 font-semibold text-[10px] text-amber-600 dark:text-amber-400">
                        <TrendingUp className="w-3 h-3" />
                        <span>{t("assistant.model_predictions")}</span>
                      </div>
                      <ul className="list-disc pl-4 text-[11px] text-slate-600 dark:text-slate-300">
                        {m.model_predictions.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {m.recommendations && m.recommendations.length > 0 && (
                    <div className="mt-2 pt-1.5 space-y-1">
                      <div className="flex items-center gap-1 font-semibold text-[10px] text-blue-600 dark:text-blue-400">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{t("assistant.recommendations")}</span>
                      </div>
                      <ul className="list-disc pl-4 text-[11px] text-slate-600 dark:text-slate-300">
                        {m.recommendations.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-2 pt-1 flex items-center gap-1 text-[9px] text-slate-400">
                      <Database className="w-2.5 h-2.5" />
                      <span>{t("assistant.citations")}: {m.citations.join(", ")}</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">{m.timestamp}</span>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span>{isHindi ? "TrafficBot सोच रहा है..." : "TrafficBot is querying sensors..."}</span>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={t("assistant.placeholder")}
              className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !inputMessage.trim()}
              className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shrink-0"
              title={t("assistant.send")}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

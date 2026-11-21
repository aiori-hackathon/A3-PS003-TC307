import React from "react";
import { Volume2, VolumeX, RotateCcw, AlertCircle, Sparkles, Mic } from "lucide-react";
import { UseVoiceAdvisoryReturn } from "../../hooks/useVoiceAdvisory";

interface VoiceAdvisoryControlProps {
  advisory: UseVoiceAdvisoryReturn;
}

export const VoiceAdvisoryControl: React.FC<VoiceAdvisoryControlProps> = ({ advisory }) => {
  const {
    isEnabled,
    isMuted,
    isSpeaking,
    isSupported,
    language,
    lastAnnouncement,
    statusText,
    notice,
    toggleEnabled,
    toggleMute,
    setLanguage,
    replayLastAnnouncement,
    testVoice,
  } = advisory;

  if (!isSupported) {
    return (
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-500 dark:text-[#8E939E] space-y-1">
        <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-[#E8EAEE]">
          <VolumeX className="w-4 h-4 text-slate-400" />
          <span>Speech Synthesis Unavailable</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          Your browser does not support native speech synthesis. Traffic advisory is available as on-screen telemetry.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-3 transition-all">
      {/* Header Row: Speaker Icon, Title & ON/OFF Switch */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              !isEnabled
                ? "bg-slate-100 dark:bg-[#1B1D22] text-slate-400 dark:text-[#8E939E]"
                : isMuted
                ? "bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
                : isSpeaking
                ? "bg-blue-600 dark:bg-[#9AC2FA] text-white dark:text-[#0A0D14]"
                : "bg-blue-50 dark:bg-[#9AC2FA]/10 border border-blue-200 dark:border-[#9AC2FA]/25 text-blue-600 dark:text-[#9AC2FA]"
            }`}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="font-serif text-sm font-medium text-slate-900 dark:text-white truncate">
                Audio Travel Guidance
              </h4>
              <Sparkles className="w-3 h-3 text-blue-500 dark:text-[#9AC2FA] shrink-0" />
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  !isEnabled
                    ? "bg-slate-400"
                    : isMuted
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
              />
              <span className="text-[10px] font-semibold text-slate-500 dark:text-[#8E939E] truncate">
                {statusText}
              </span>
            </div>
          </div>
        </div>

        {/* Accessible ON / OFF Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={toggleEnabled}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#9AC2FA] focus:ring-offset-2 ${
            isEnabled ? "bg-blue-600 dark:bg-[#9AC2FA]" : "bg-slate-300 dark:bg-[#1B1D22]"
          }`}
          title={isEnabled ? "Disable Voice Advisory" : "Enable Hands-Free Voice Advisory"}
        >
          <span className="sr-only">Toggle Audio Guidance</span>
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-[#0A0D14] shadow ring-0 transition duration-200 ease-in-out ${
              isEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Expanded Controls when Guidance is Enabled */}
      {isEnabled ? (
        <div className="space-y-2.5 pt-1 border-t border-slate-200/60 dark:border-white/[0.07]">
          {/* Action Row: Language Selectors, Mute, Replay */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Language Selector Pills */}
            <div className="inline-flex rounded-lg p-0.5 bg-slate-200/70 dark:bg-[#1B1D22] border border-transparent dark:border-white/[0.08] text-[11px] font-bold">
              <button
                type="button"
                data-testid="lang-en"
                onClick={() => setLanguage("en")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  language === "en"
                    ? "bg-white dark:bg-[#9AC2FA] text-blue-600 dark:text-[#0A0D14] shadow-xs"
                    : "text-slate-600 dark:text-[#C5C8D0] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                data-testid="lang-hi"
                onClick={() => setLanguage("hi")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  language === "hi"
                    ? "bg-white dark:bg-[#9AC2FA] text-blue-600 dark:text-[#0A0D14] shadow-xs"
                    : "text-slate-600 dark:text-[#C5C8D0] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                हिंदी
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Test Voice */}
              <button
                type="button"
                data-testid="test-voice-btn"
                onClick={testVoice}
                className="px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50/80 hover:bg-blue-100 dark:border-[#9AC2FA]/25 dark:bg-[#9AC2FA]/10 dark:hover:bg-[#9AC2FA]/15 text-blue-700 dark:text-[#9AC2FA] text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                title="Test browser speech synthesis audio output"
              >
                <Sparkles className="w-3 h-3 text-blue-500 dark:text-[#9AC2FA]" />
                <span>Test Voice</span>
              </button>

              {/* Mute/Unmute */}
              <button
                type="button"
                data-testid="mute-btn"
                onClick={toggleMute}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  isMuted
                    ? "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:border-amber-500/35 dark:text-amber-300"
                    : "border-slate-200 bg-white dark:bg-[#1B1D22] dark:border-white/[0.10] text-slate-600 dark:text-[#E8EAEE] hover:bg-slate-50 dark:hover:bg-[#22252C]"
                }`}
                title={isMuted ? "Unmute Voice Guidance" : "Mute Voice Guidance"}
              >
                {isMuted ? <VolumeX className="w-3 h-3 text-amber-500" /> : <Volume2 className="w-3 h-3 text-slate-500 dark:text-[#C5C8D0]" />}
                <span>{isMuted ? "Unmute" : "Mute"}</span>
              </button>

              {/* Replay */}
              <button
                type="button"
                data-testid="replay-btn"
                onClick={replayLastAnnouncement}
                disabled={isSpeaking}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white dark:bg-[#1B1D22] dark:border-white/[0.10] text-slate-600 dark:text-[#E8EAEE] hover:bg-slate-50 dark:hover:bg-[#22252C] text-[11px] font-semibold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                title="Replay Last Advisory Announcement"
              >
                <RotateCcw className={`w-3 h-3 ${isSpeaking ? "animate-spin" : ""}`} />
                <span>Replay</span>
              </button>
            </div>
          </div>

          {/* Fallback Notice for Missing Language Voice */}
          {notice && (
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/25 text-[10px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span className="leading-tight">{notice}</span>
            </div>
          )}

          {/* Last Announcement Snippet Box */}
          {lastAnnouncement && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200/80 dark:border-white/[0.08] space-y-1">
              <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#8E939E]">
                <span className="flex items-center gap-1">
                  <Mic className="w-2.5 h-2.5 text-blue-500 dark:text-[#9AC2FA]" />
                  <span>Latest Announcement</span>
                </span>
                {isSpeaking && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Now Speaking
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-700 dark:text-[#E8EAEE] leading-snug italic">
                “{lastAnnouncement}”
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/40 dark:border-white/[0.07]">
          <p className="text-[11px] text-slate-500 dark:text-[#8E939E] leading-snug">
            Hands-free speech updates for your detected road and speed. Toggle ON for spoken alerts.
          </p>
          <button
            type="button"
            data-testid="test-voice-btn"
            onClick={testVoice}
            className="shrink-0 px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50/80 hover:bg-blue-100 dark:border-[#9AC2FA]/25 dark:bg-[#9AC2FA]/10 dark:hover:bg-[#9AC2FA]/15 text-blue-700 dark:text-[#9AC2FA] text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
            title="Test browser speech synthesis audio output"
          >
            <Sparkles className="w-3 h-3 text-blue-500 dark:text-[#9AC2FA]" />
            <span>Test Voice</span>
          </button>
        </div>
      )}
    </div>
  );
};

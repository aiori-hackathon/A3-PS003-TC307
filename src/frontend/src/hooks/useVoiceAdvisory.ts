import { useState, useEffect, useRef, useCallback } from "react";
import { VoiceTrafficContext } from "../types";

export interface UseVoiceAdvisoryReturn {
  isEnabled: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  isSupported: boolean;
  language: "en" | "hi";
  hasHindiVoice: boolean;
  lastAnnouncement: string | null;
  statusText: string;
  notice: string | null;
  toggleEnabled: () => void;
  toggleMute: () => void;
  setLanguage: (lang: "en" | "hi") => void;
  replayLastAnnouncement: () => void;
  testVoice: () => void;
  stop: () => void;
}

interface TrafficSnapshot {
  roadName: string;
  congestionLevel: "low" | "moderate" | "severe" | "normal" | "unknown";
  speed: number;
  roadClosure: boolean;
  trafficAvailable: boolean;
  reason?: string;
}

type ChangeReason =
  | "road_closure"
  | "road_reopened"
  | "congestion_worsened"
  | "congestion_improved"
  | "speed_drop"
  | "speed_increase"
  | "new_road"
  | "availability_change";

interface ChangeEvaluation {
  isMeaningful: boolean;
  reason?: ChangeReason;
  isUrgent?: boolean;
}

export function useVoiceAdvisory(context: VoiceTrafficContext | null): UseVoiceAdvisoryReturn {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [language, setLanguageState] = useState<"en" | "hi">("en");
  const [hasHindiVoice, setHasHindiVoice] = useState<boolean>(false);
  const [lastAnnouncement, setLastAnnouncement] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const lastSpokenTextRef = useRef<string | null>(null);
  const lastSpokenTimeRef = useRef<number>(0);

  // Dedicated flag to guarantee the first valid traffic condition snapshot is announced exactly once
  const hasAnnouncedTrafficSnapshotRef = useRef<boolean>(false);
  const lastTrafficConditionRef = useRef<TrafficSnapshot | null>(null);

  // V8 GC anchor to prevent SpeechSynthesisUtterance from being collected mid-speech
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const contextRef = useRef<VoiceTrafficContext | null>(context);
  const isEnabledRef = useRef<boolean>(isEnabled);
  const isMutedRef = useRef<boolean>(isMuted);
  const languageRef = useRef<"en" | "hi">(language);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // Voice loading, capability detection & unpause guard
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const updateVoices = () => {
      const available = window.speechSynthesis.getVoices();
      voicesRef.current = available;
      const hindiFound = available.some((v) => v.lang.toLowerCase().startsWith("hi"));
      setHasHindiVoice(hindiFound);
    };

    updateVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    // Unpause if stuck
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Voice selector helper
  const selectVoice = useCallback((lang: "en" | "hi"): SpeechSynthesisVoice | null => {
    const voices = voicesRef.current;
    if (!voices.length) return null;

    if (lang === "hi") {
      const hindiVoice = voices.find((v) => v.lang.toLowerCase().startsWith("hi"));
      if (hindiVoice) return hindiVoice;
    }

    // Default English selector: prefer Indian English, then general English, then fallback
    const indianEnglish = voices.find((v) => v.lang.toLowerCase().includes("en-in"));
    if (indianEnglish) return indianEnglish;

    const generalEnglish = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
    if (generalEnglish) return generalEnglish;

    return voices[0] || null;
  }, []);

  // Natural Initial Traffic Snapshot Phrase Constructor
  const buildInitialSnapshotPhrase = useCallback((ctx: VoiceTrafficContext, lang: "en" | "hi"): string => {
    const road = ctx.roadName || (lang === "hi" ? "वर्तमान सड़क" : "your current road");
    const speed = ctx.currentSpeed !== undefined ? Math.round(ctx.currentSpeed) : undefined;

    // 1. Telemetry unavailable (honest reporting, no fake fallback)
    if (!ctx.trafficAvailable) {
      return lang === "hi"
        ? `${road} के लिए लाइव ट्रैफ़िक डेटा वर्तमान में उपलब्ध नहीं है।`
        : `Live traffic data is currently unavailable for ${road}.`;
    }

    // 2. Road closure alert
    if (ctx.roadClosure) {
      return lang === "hi"
        ? `सावधान: ${road} पर सड़क बंद होने की सूचना है। कृपया वैकल्पिक मार्ग चुनें।`
        : `Caution: Road closure reported on ${road}. Please consider an alternative route.`;
    }

    // 3. Heavy / Severe congestion
    if (ctx.congestionLevel === "severe") {
      return lang === "hi"
        ? `${road} पर भारी जाम की स्थिति है। वर्तमान गति ${speed || 15} किलोमीटर प्रति घंटा है। कृपया अतिरिक्त समय लेकर चलें या वैकल्पिक मार्ग चुनें।`
        : `Heavy congestion detected on ${road}. Current speed is ${speed || 15} kilometres per hour. Consider an alternate route.`;
    }

    // 4. Moderate congestion
    if (ctx.congestionLevel === "moderate") {
      return lang === "hi"
        ? `${road} पर मध्यम ट्रैफ़िक है। वर्तमान गति ${speed || 25} किलोमीटर प्रति घंटा है। कृपया सुरक्षित दूरी बनाए रखें।`
        : `Moderate traffic detected on ${road}. Current speed is ${speed || 25} kilometres per hour. Please maintain a safe following distance.`;
    }

    // 5. Smooth / Low density flow
    return lang === "hi"
      ? `आप वर्तमान में ${road} पर हैं। यातायात सुगम है और गति ${speed || 40} किलोमीटर प्रति घंटा है।`
      : `You are currently on ${road}. Traffic is moving smoothly at ${speed || 40} kilometres per hour.`;
  }, []);

  // Real-Time Traffic Change Phrase Constructor
  const buildTrafficChangePhrase = useCallback(
    (prev: TrafficSnapshot, curr: TrafficSnapshot, reason: ChangeReason, lang: "en" | "hi"): string => {
      const road = curr.roadName || (lang === "hi" ? "आपकी सड़क" : "your road");
      const speed = Math.round(curr.speed);

      switch (reason) {
        case "road_closure":
          return lang === "hi"
            ? `सावधान: ${road} पर आगे सड़क बंद होने की सूचना है। कृपया वैकल्पिक मार्ग चुनें।`
            : `Traffic alert: Road closure reported ahead on ${road}. Please choose an alternate route.`;

        case "road_reopened":
          return lang === "hi"
            ? `${road} पर सड़क फिर से खुल गई है। यातायात बहाल हो गया है।`
            : `Notice: Road closure cleared on ${road}. Traffic flow has resumed.`;

        case "congestion_worsened":
          if (curr.congestionLevel === "severe") {
            return lang === "hi"
              ? `चेतावनी: ${road} पर भारी जाम लग गया है। गति घटकर ${speed} किलोमीटर प्रति घंटा हो गई है।`
              : `Traffic alert: Heavy congestion building on ${road}. Speed dropped to ${speed} kilometres per hour.`;
          }
          return lang === "hi"
            ? `${road} पर ट्रैफ़िक धीमा हो रहा है। मध्यम जाम, गति घटकर ${speed} किलोमीटर प्रति घंटा हो गई है।`
            : `Traffic slowing down on ${road}. Moderate congestion ahead, speed reduced to ${speed} kilometres per hour.`;

        case "congestion_improved":
          if (curr.congestionLevel === "low" || curr.congestionLevel === "normal") {
            return lang === "hi"
              ? `${road} पर जाम खुल गया है। यातायात अब ${speed} किलोमीटर प्रति घंटा की गति से सुगम है।`
              : `Traffic delay cleared on ${road}. Traffic is now moving smoothly at ${speed} kilometres per hour.`;
          }
          return lang === "hi"
            ? `${road} पर स्थिति में सुधार हो रहा है। गति बढ़कर ${speed} किलोमीटर प्रति घंटा हो गई है।`
            : `Traffic conditions easing on ${road}. Speed has increased to ${speed} kilometres per hour.`;

        case "speed_drop":
          return lang === "hi"
            ? `सूचना: ${road} पर ट्रैफ़िक धीमा हो गया है। गति घटकर ${speed} किलोमीटर प्रति घंटा हो गई है।`
            : `Notice: Traffic slowing on ${road}. Speed dropped to ${speed} kilometres per hour.`;

        case "speed_increase":
          return lang === "hi"
            ? `${road} पर गति बढ़ रही है। वर्तमान गति ${speed} किलोमीटर प्रति घंटा है।`
            : `Traffic speed picking up on ${road}. Currently moving at ${speed} kilometres per hour.`;

        case "new_road":
          if (curr.congestionLevel === "severe") {
            return lang === "hi"
              ? `अब आप ${road} पर हैं। भारी जाम, गति ${speed} किलोमीटर प्रति घंटा है।`
              : `Now on ${road}. Heavy congestion detected, current speed is ${speed} kilometres per hour.`;
          } else if (curr.congestionLevel === "moderate") {
            return lang === "hi"
              ? `अब आप ${road} पर हैं। मध्यम ट्रैफ़िक, गति ${speed} किलोमीटर प्रति घंटा है।`
              : `Now on ${road}. Moderate traffic detected, current speed is ${speed} kilometres per hour.`;
          }
          return lang === "hi"
            ? `अब आप ${road} पर हैं। यातायात सुगम है, गति ${speed} किलोमीटर प्रति घंटा है।`
            : `Now on ${road}. Traffic is moving smoothly at ${speed} kilometres per hour.`;

        case "availability_change":
          if (curr.trafficAvailable) {
            return lang === "hi"
              ? `${road} के लिए लाइव ट्रैफ़िक डेटा कनेक्ट हो गया है। गति ${speed} किलोमीटर प्रति घंटा है।`
              : `Live traffic data connected for ${road}. Current speed is ${speed} kilometres per hour.`;
          }
          return lang === "hi"
            ? `${road} के लिए लाइव ट्रैफ़िक डेटा वर्तमान में उपलब्ध नहीं है।`
            : `Live traffic data is currently unavailable for ${road}.`;

        default:
          return buildInitialSnapshotPhrase(
            {
              roadName: curr.roadName,
              trafficAvailable: curr.trafficAvailable,
              currentSpeed: curr.speed,
              congestionLevel: curr.congestionLevel,
              roadClosure: curr.roadClosure,
            },
            lang
          );
      }
    },
    [buildInitialSnapshotPhrase]
  );

  // Evaluates whether fresh traffic telemetry represents a meaningful driving change
  const evaluateMeaningfulChange = useCallback((prev: TrafficSnapshot | null, curr: TrafficSnapshot): ChangeEvaluation => {
    if (!prev) return { isMeaningful: false };

    // 1. Road closure status change (always meaningful and urgent)
    if (prev.roadClosure !== curr.roadClosure) {
      return {
        isMeaningful: true,
        reason: curr.roadClosure ? "road_closure" : "road_reopened",
        isUrgent: true,
      };
    }

    // 2. Congestion level change (both escalation and improvement are meaningful)
    if (prev.congestionLevel !== curr.congestionLevel) {
      const severityRank: Record<string, number> = { low: 1, normal: 1, moderate: 2, severe: 3, unknown: 0 };
      const prevRank = severityRank[prev.congestionLevel] ?? 1;
      const currRank = severityRank[curr.congestionLevel] ?? 1;

      if (currRank > prevRank) {
        return { isMeaningful: true, reason: "congestion_worsened", isUrgent: true };
      } else if (currRank < prevRank) {
        return { isMeaningful: true, reason: "congestion_improved", isUrgent: false };
      }
    }

    // 3. Significant speed shift >= 12 km/h
    const speedDiff = curr.speed - prev.speed;
    if (Math.abs(speedDiff) >= 12) {
      return {
        isMeaningful: true,
        reason: speedDiff < 0 ? "speed_drop" : "speed_increase",
        isUrgent: speedDiff <= -15, // Sudden sharp brake/drop >= 15 km/h is urgent
      };
    }

    // 4. Commuter turned onto a new road corridor
    if (
      curr.roadName &&
      prev.roadName !== curr.roadName &&
      !curr.roadName.includes("Locating") &&
      !curr.roadName.includes("Connecting")
    ) {
      return { isMeaningful: true, reason: "new_road", isUrgent: false };
    }

    // 5. Telemetry availability state change
    if (prev.trafficAvailable !== curr.trafficAvailable) {
      return { isMeaningful: true, reason: "availability_change", isUrgent: false };
    }

    return { isMeaningful: false };
  }, []);

  // Core speak method with GC protection, unpause check, and queue protection
  const speak = useCallback(
    (text: string, force = false, targetLang?: "en" | "hi") => {
      if (typeof window === "undefined" || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        return;
      }
      if (isMutedRef.current) {
        console.log("[VoiceAdvisory] Audio output suppressed: Guidance is muted.");
        return;
      }

      const currentLang = targetLang || languageRef.current;
      const now = Date.now();
      const COOLDOWN_MS = 30000; // 30-second cooldown between routine condition updates

      // Duplicate prevention: avoid speaking the exact same phrase unless explicitly forced
      if (!force && lastSpokenTextRef.current === text) {
        console.log(`[VoiceAdvisory] Skipped announcement: identical phrase already spoken ("${text.slice(0, 40)}...")`);
        return;
      }

      // Cooldown prevention unless forced by user action or urgent traffic escalation
      if (!force && now - lastSpokenTimeRef.current < COOLDOWN_MS) {
        const remainingSec = Math.round((COOLDOWN_MS - (now - lastSpokenTimeRef.current)) / 1000);
        console.log(`[VoiceAdvisory] Skipped announcement: in cooldown (${remainingSec}s remaining).`);
        return;
      }

      try {
        // Unpause if speech engine paused
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        // Cancel previous active utterance
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        const chosenVoice = selectVoice(currentLang);
        if (chosenVoice) {
          utterance.voice = chosenVoice;
        }
        utterance.lang = currentLang === "hi" && hasHindiVoice ? "hi-IN" : (chosenVoice?.lang || "en-IN");
        utterance.rate = 0.95; // Measured pace for in-car listening
        utterance.pitch = 1.0;

        utterance.onstart = () => {
          setIsSpeaking(true);
          lastSpokenTextRef.current = text;
          lastSpokenTimeRef.current = Date.now();
          console.log(`[VoiceAdvisory] Speaking started: "${text}"`);
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          activeUtteranceRef.current = null;
          console.log("[VoiceAdvisory] Speaking completed.");
        };

        utterance.onerror = (event) => {
          if (event.error !== "canceled" && event.error !== "interrupted") {
            console.warn("[VoiceAdvisory] Speech synthesis error:", event.error);
          }
          setIsSpeaking(false);
          activeUtteranceRef.current = null;
        };

        // V8 GC anchor: preserve utterance reference
        activeUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        setLastAnnouncement(text);
      } catch (err) {
        console.warn("[VoiceAdvisory] Speech synthesis trigger exception:", err);
        setIsSpeaking(false);
      }
    },
    [hasHindiVoice, selectVoice]
  );

  // Direct Test Voice function: runs completely independently of GPS, TomTom, or traffic context
  const testVoice = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setNotice("Speech synthesis is not supported in this browser.");
      return;
    }

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();

      const testText =
        languageRef.current === "hi" && hasHindiVoice
          ? "नमस्ते! ट्रैफिकफ्लो एआई ध्वनि मार्गदर्शन सक्रिय है और सही काम कर रहा है।"
          : "Hello! TrafficFlow AI voice advisory is working.";

      const utterance = new SpeechSynthesisUtterance(testText);
      const chosenVoice = selectVoice(languageRef.current);
      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }
      utterance.lang = languageRef.current === "hi" && hasHindiVoice ? "hi-IN" : (chosenVoice?.lang || "en-IN");
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        console.log("Voice started:", testText);
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        console.log("Voice completed");
        setIsSpeaking(false);
        activeUtteranceRef.current = null;
      };

      utterance.onerror = (event) => {
        console.error("Voice error:", event.error);
        setIsSpeaking(false);
        activeUtteranceRef.current = null;
        if (event.error !== "canceled" && event.error !== "interrupted") {
          setNotice(`Voice test note: ${event.error}`);
        }
      };

      activeUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setLastAnnouncement(testText);
    } catch (err) {
      console.error("Test voice execution error:", err);
      setIsSpeaking(false);
    }
  }, [hasHindiVoice, selectVoice]);

  // Stop active speech immediately
  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      activeUtteranceRef.current = null;
    }
  }, []);

  // React to fresh traffic data: initial snapshot and real-time meaningful changes
  useEffect(() => {
    if (!isEnabled || isMuted || !context) return;

    // Guard 1: Do not speak while telemetry is actively loading
    if (context.isLoading) {
      console.log("[VoiceAdvisory] Telemetry is querying, waiting for resolution...");
      return;
    }

    // Guard 2: Filter provisional road placeholders before genuine road resolves
    const isProvisionalRoad =
      context.roadName &&
      (context.roadName.includes("Locating Road") || context.roadName.includes("Connecting Delhi"));

    if (isProvisionalRoad && !context.trafficAvailable) {
      console.log("[VoiceAdvisory] Provisional road resolving, waiting for actual geocoding...");
      return;
    }

    const currentSnapshot: TrafficSnapshot = {
      roadName: context.roadName || (language === "hi" ? "वर्तमान सड़क" : "Current Road"),
      congestionLevel: (context.congestionLevel as any) || (context.trafficAvailable ? "low" : "unknown"),
      speed: Math.round(
        context.currentSpeed ??
          (context.congestionLevel === "severe" ? 15 : context.congestionLevel === "moderate" ? 25 : 40)
      ),
      roadClosure: Boolean(context.roadClosure),
      trafficAvailable: Boolean(context.trafficAvailable),
      reason: context.reason,
    };

    // CASE 1: First Valid Traffic Condition Snapshot
    // Triggered when user enables voice first, and then valid location/telemetry arrives
    if (!hasAnnouncedTrafficSnapshotRef.current) {
      const phrase = buildInitialSnapshotPhrase(context, language);
      console.log(`[VoiceAdvisory] Announcing first valid traffic condition: "${phrase}"`);
      speak(phrase, true, language);
      hasAnnouncedTrafficSnapshotRef.current = true;
      lastTrafficConditionRef.current = currentSnapshot;
      return;
    }

    // CASE 2: Real-Time Traffic Change Announcements
    const prevSnapshot = lastTrafficConditionRef.current;
    if (!prevSnapshot) {
      lastTrafficConditionRef.current = currentSnapshot;
      return;
    }

    const evaluation = evaluateMeaningfulChange(prevSnapshot, currentSnapshot);
    if (evaluation.isMeaningful && evaluation.reason) {
      const changePhrase = buildTrafficChangePhrase(prevSnapshot, currentSnapshot, evaluation.reason, language);
      console.log(`[VoiceAdvisory] Meaningful traffic change (${evaluation.reason}): "${changePhrase}"`);

      // Urgent changes (road closure, severe escalation) force immediate announcement;
      // non-urgent changes respect the 30s cooldown and identical phrase filter.
      speak(changePhrase, evaluation.isUrgent ?? false, language);
      lastTrafficConditionRef.current = currentSnapshot;
    } else {
      console.log("[VoiceAdvisory] Telemetry refreshed: conditions unchanged or fluctuation below threshold.");
    }
  }, [
    context,
    isEnabled,
    isMuted,
    language,
    buildInitialSnapshotPhrase,
    buildTrafficChangePhrase,
    evaluateMeaningfulChange,
    speak,
  ]);

  // Voice toggle control: speaks immediate feedback or announces existing traffic snapshot
  const toggleEnabled = useCallback(() => {
    setIsEnabled((prev) => {
      const next = !prev;
      isEnabledRef.current = next;

      if (!next) {
        console.log("[VoiceAdvisory] Voice guidance disabled by commuter.");
        stop();
        lastSpokenTextRef.current = null;
        hasAnnouncedTrafficSnapshotRef.current = false;
        lastTrafficConditionRef.current = null;
      } else {
        console.log("[VoiceAdvisory] Voice guidance enabled by commuter.");
        const currentCtx = contextRef.current;
        const currentLang = languageRef.current;

        // SCENARIO 2: Location was detected FIRST, and THEN commuter toggles Voice ON
        const hasValidData =
          currentCtx &&
          currentCtx.roadName &&
          !currentCtx.isLoading &&
          !currentCtx.roadName.includes("Locating") &&
          !currentCtx.roadName.includes("Connecting");

        if (hasValidData) {
          const phrase = buildInitialSnapshotPhrase(currentCtx, currentLang);
          console.log(`[VoiceAdvisory] Announcing existing valid traffic snapshot on enable: "${phrase}"`);
          setTimeout(() => speak(phrase, true, currentLang), 60);
          hasAnnouncedTrafficSnapshotRef.current = true;
          lastTrafficConditionRef.current = {
            roadName: currentCtx.roadName || "Current Road",
            congestionLevel: (currentCtx.congestionLevel as any) || (currentCtx.trafficAvailable ? "low" : "unknown"),
            speed: Math.round(currentCtx.currentSpeed ?? 30),
            roadClosure: Boolean(currentCtx.roadClosure),
            trafficAvailable: Boolean(currentCtx.trafficAvailable),
            reason: currentCtx.reason,
          };
        } else {
          // SCENARIO 1: Commuter toggles Voice ON BEFORE detecting location
          const initialPhrase =
            currentLang === "hi"
              ? "ध्वनि यात्रा मार्गदर्शन सक्षम है। लाइव ट्रैफ़िक सुनने के लिए मेरा स्थान पहचानें पर टैप करें।"
              : "Voice travel guidance enabled. Tap Detect My Location to hear live road traffic.";
          console.log(`[VoiceAdvisory] Location not yet resolved, speaking setup prompt: "${initialPhrase}"`);
          setTimeout(() => speak(initialPhrase, true, currentLang), 60);
          hasAnnouncedTrafficSnapshotRef.current = false;
        }
      }
      return next;
    });
  }, [stop, buildInitialSnapshotPhrase, speak]);

  // Mute control
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      if (next) {
        console.log("[VoiceAdvisory] Voice guidance muted.");
        stop();
      } else {
        console.log("[VoiceAdvisory] Voice guidance unmuted.");
      }
      return next;
    });
  }, [stop]);

  // Language switch control
  const setLanguage = useCallback(
    (lang: "en" | "hi") => {
      setLanguageState(lang);
      languageRef.current = lang;

      if (lang === "hi" && !hasHindiVoice) {
        setNotice("Hindi voice pack not detected in your browser. Audio will play using English speech.");
        setTimeout(() => setNotice(null), 6000);
      } else {
        setNotice(null);
      }

      // Re-announce current condition in newly selected language if guidance is active
      if (isEnabledRef.current && !isMutedRef.current && contextRef.current) {
        const phrase = buildInitialSnapshotPhrase(contextRef.current, lang);
        console.log(`[VoiceAdvisory] Language switched to ${lang}. Speaking: "${phrase}"`);
        speak(phrase, true, lang);
      }
    },
    [hasHindiVoice, buildInitialSnapshotPhrase, speak]
  );

  // Replay last announcement
  const replayLastAnnouncement = useCallback(() => {
    console.log("[VoiceAdvisory] Replay triggered by commuter.");
    if (lastAnnouncement) {
      speak(lastAnnouncement, true, languageRef.current);
    } else if (contextRef.current) {
      const phrase = buildInitialSnapshotPhrase(contextRef.current, languageRef.current);
      speak(phrase, true, languageRef.current);
    } else {
      const fallbackText =
        languageRef.current === "hi"
          ? "ध्वनि यात्रा मार्गदर्शन सक्षम है। लाइव ट्रैफ़िक सुनने के लिए मेरा स्थान पहचानें पर टैप करें।"
          : "Voice travel guidance enabled. Tap Detect My Location to hear live road traffic.";
      speak(fallbackText, true, languageRef.current);
    }
  }, [lastAnnouncement, buildInitialSnapshotPhrase, speak]);

  // Dynamic status text
  const statusText = !isSupported
    ? "Browser Speech Not Supported"
    : !isEnabled
    ? "Voice Guidance Disabled"
    : isMuted
    ? "Voice Guidance Muted"
    : isSpeaking
    ? "Speaking Traffic Advisory..."
    : "Voice Guidance Active";

  return {
    isEnabled,
    isMuted,
    isSpeaking,
    isSupported,
    language,
    hasHindiVoice,
    lastAnnouncement,
    statusText,
    notice,
    toggleEnabled,
    toggleMute,
    setLanguage,
    replayLastAnnouncement,
    testVoice,
    stop,
  };
}

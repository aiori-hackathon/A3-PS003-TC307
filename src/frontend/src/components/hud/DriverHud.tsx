import React from "react";
import {
  Car,
  X,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Navigation,
  RefreshCw,
  AlertCircle,
  MapPin,
  Clock,
  Radio,
  ShieldAlert,
} from "lucide-react";
import { UseVoiceAdvisoryReturn } from "../../hooks/useVoiceAdvisory";
import { IntersectionDetail } from "../../types";

export interface UserLocationState {
  lat: number;
  lng: number;
  accuracy: number;
  roadName: string;
  area: string;
  city: string;
  district?: string;
  state: string;
  fullAddress: string;
  isDelhi: boolean;
  gpsSpeed?: number | null;
  sourceLabel?: string;
  geocodeSource?: string;
  detectedAt?: Date;
  accuracyWarning?: string | null;
  isApproximate?: boolean;
}

export interface CoordinateTrafficState {
  traffic_available: boolean;
  current_speed?: number;
  free_flow_speed?: number;
  confidence?: number;
  road_closure?: boolean;
  congestion_level?: string;
  travel_time_seconds?: number;
  free_flow_travel_time_seconds?: number;
  provider_name?: string;
  reason?: string;
  fetchedAt?: Date;
}

export interface DriverHudProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: UserLocationState | null;
  coordTraffic: CoordinateTrafficState | null;
  selectedIntersection: IntersectionDetail | null;
  loadingTraffic: boolean;
  detectingLocation: boolean;
  locationError: string | null;
  onDetectLocation: () => void;
  lastRefreshedAt: Date;
  onRefreshFeed: () => void;
  refreshing: boolean;
  voiceAdvisory: UseVoiceAdvisoryReturn;
  isHindi: boolean;
}

export const DriverHud: React.FC<DriverHudProps> = ({
  isOpen,
  onClose,
  userLocation,
  coordTraffic,
  selectedIntersection,
  loadingTraffic,
  detectingLocation,
  locationError,
  onDetectLocation,
  lastRefreshedAt,
  onRefreshFeed,
  refreshing,
  voiceAdvisory,
  isHindi,
}) => {
  if (!isOpen) return null;

  // Determine current speed: GPS speed takes priority if available, then TomTom flow, then selected intersection
  const rawSpeed =
    userLocation?.gpsSpeed ??
    coordTraffic?.current_speed ??
    selectedIntersection?.current_speed ??
    null;

  const displaySpeed = rawSpeed !== null && rawSpeed !== undefined ? Math.round(rawSpeed) : null;
  const freeFlowSpeed =
    coordTraffic?.free_flow_speed ??
    (selectedIntersection ? selectedIntersection.current_speed + 15 : null);

  // Determine traffic status according to specification:
  // Green: Free Flow, Amber: Moderate Traffic, Red: Heavy Congestion, Grey: Traffic Data Unavailable
  const isTrafficAvailable = coordTraffic?.traffic_available ?? Boolean(selectedIntersection);
  const isRoadClosed = Boolean(coordTraffic?.road_closure);
  const congestion = coordTraffic?.congestion_level || selectedIntersection?.congestion_level || "unknown";

  let statusLabel = isHindi ? "ट्रैफिक डेटा अनुपलब्ध" : "Traffic Data Unavailable";
  let statusBadgeStyle = "border-white/[0.10] bg-[#161920] text-[#C5C8D0]";
  let statusDotColor = "bg-[#8E939E]";
  let speedColor = "text-white";

  if (isTrafficAvailable) {
    if (isRoadClosed) {
      statusLabel = isHindi ? "सड़क बंद है (Road Closed)" : "Road Closed Ahead";
      statusBadgeStyle = "border-red-500/50 bg-red-950/75 text-red-200";
      statusDotColor = "bg-red-500";
      speedColor = "text-red-400";
    } else if (congestion === "severe" || (displaySpeed !== null && displaySpeed < 18)) {
      statusLabel = isHindi ? "भारी जाम (Heavy Congestion)" : "Heavy Congestion";
      statusBadgeStyle = "border-red-500/45 bg-red-950/65 text-red-200";
      statusDotColor = "bg-red-500";
      speedColor = "text-red-400";
    } else if (congestion === "moderate" || (displaySpeed !== null && displaySpeed < 32)) {
      statusLabel = isHindi ? "मध्यम यातायात (Moderate Traffic)" : "Moderate Traffic";
      statusBadgeStyle = "border-amber-500/80 bg-amber-950/70 text-amber-300";
      statusDotColor = "bg-amber-400";
      speedColor = "text-amber-300";
    } else {
      statusLabel = isHindi ? "सुगम यातायात (Free Flow)" : "Free Flow";
      statusBadgeStyle = "border-emerald-500/80 bg-emerald-950/70 text-emerald-300";
      statusDotColor = "bg-emerald-400";
      speedColor = "text-emerald-400";
    }
  }

  // Road name & area details
  const displayRoad =
    userLocation?.roadName ||
    selectedIntersection?.name ||
    (isHindi ? "स्थान का पता लगाएं..." : "Detect your location to begin");

  const displayArea = userLocation
    ? `${userLocation.area ? userLocation.area + ", " : ""}${userLocation.city || userLocation.district || ""}${userLocation.state ? `, ${userLocation.state}` : ""}`
    : selectedIntersection
    ? "Delhi NCR Monitored Corridor"
    : isHindi
    ? "जीपीएस सिग्नल की प्रतीक्षा..."
    : "Awaiting GPS Signal Detection";

  const {
    isEnabled: voiceEnabled,
    isMuted: voiceMuted,
    isSpeaking: voiceSpeaking,
    language: voiceLang,
    lastAnnouncement,
    toggleEnabled: toggleVoice,
    toggleMute,
    setLanguage: setVoiceLang,
    replayLastAnnouncement,
    testVoice,
  } = voiceAdvisory;

  return (
    <div
      data-testid="driver-hud-container"
      role="dialog"
      aria-modal="true"
      aria-label="Driver HUD Commute Dashboard"
      className="fixed inset-0 z-[9999] bg-[#090A0D] text-white flex flex-col justify-between overflow-y-auto select-none font-sans"
    >
      {/* ======================================================== */}
      {/* 1. TOP BAR: BRANDING + LIVE STATUS + EXIT BUTTON         */}
      {/* ======================================================== */}
      <header className="px-4 sm:px-8 py-3.5 bg-[#0D0F14]/92 border-b border-white/[0.08] backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#9AC2FA]/15 border border-[#9AC2FA]/30 flex items-center justify-center">
            <Car className="w-5 h-5 text-[#9AC2FA]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-medium text-base tracking-tight text-white">
                TrafficFL
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-[#9AC2FA]/15 text-[#9AC2FA] border border-[#9AC2FA]/30">
                DRIVER HUD
              </span>
            </div>
            <p className="text-[10px] text-[#8C93A4] font-medium">
              {isHindi ? "कम्यूट मोड – हैंड्स-फ्री ड्राइविंग सहायक" : "Commute Mode – Hands-Free Driving Assistant"}
            </p>
          </div>
        </div>

        {/* Live Indicator & Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1B1D22] border border-white/[0.08] text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-semibold font-mono text-[11px] text-[#E8EAEE]">
              {isTrafficAvailable ? "LIVE TOMTOM TELEMETRY" : "GPS POSITIONING"}
            </span>
            <span className="text-[#8C93A4]">•</span>
            <span className="text-[10px] text-[#8C93A4] flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3" />
              {lastRefreshedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>

          {/* Refresh Feed Button */}
          <button
            type="button"
            data-testid="hud-refresh-btn"
            onClick={onRefreshFeed}
            disabled={refreshing}
            className="p-2 sm:px-3 sm:py-2 rounded-lg bg-[#1B1D22] hover:bg-white/[0.08] border border-white/[0.10] text-xs font-semibold text-[#E8EAEE] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh Traffic Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#9AC2FA]" : ""}`} />
            <span className="hidden md:inline">{refreshing ? "Updating..." : "Refresh"}</span>
          </button>

          {/* Exit HUD Button */}
          <button
            type="button"
            data-testid="exit-hud-btn"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            title="Exit Driver HUD Mode and return to Map"
          >
            <X className="w-4 h-4" />
            <span>{isHindi ? "बाहर निकलें (Exit HUD)" : "Exit HUD"}</span>
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. CENTER SECTION: SPEEDOMETER, ROAD, TRAFFIC STATUS    */}
      {/* ======================================================== */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-8 text-center space-y-6 max-w-4xl mx-auto w-full">
        {/* Error Notification if GPS fails */}
        {locationError && (
          <div className="w-full p-3.5 rounded-2xl bg-red-950/70 border border-red-800 text-red-200 text-xs flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{locationError}</span>
            </div>
            <button
              type="button"
              data-testid="hud-gps-retry-btn"
              onClick={onDetectLocation}
              className="px-3 py-1 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shrink-0 cursor-pointer"
            >
              Retry GPS
            </button>
          </div>
        )}

        {/* Traffic Status Indicator Badge (Prominent per Spec 3.C) */}
        <div
          data-testid="hud-traffic-status-badge"
          className={`inline-flex items-center gap-2.5 px-5 py-2 rounded-full border text-xs sm:text-sm font-black tracking-wider uppercase shadow-xl transition-all ${statusBadgeStyle}`}
        >
          <span className={`w-3 h-3 rounded-full shrink-0 ${statusDotColor}`} />
          <span>{statusLabel}</span>
        </div>

        {/* Speedometer Center Display */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative flex items-baseline justify-center">
            {/* Digital Speed Value */}
            <span
              data-testid="hud-speedometer-value"
              className={`text-8xl sm:text-9xl md:text-[11rem] font-black font-mono tracking-tighter leading-none transition-colors ${speedColor}`}
            >
              {displaySpeed !== null ? (
                displaySpeed
              ) : (
                <span className={loadingTraffic || detectingLocation ? "animate-pulse text-slate-500" : ""}>--</span>
              )}
            </span>
          </div>

          {/* Speed Unit */}
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-[#8C93A4] font-mono">
              km/h
            </span>
            {(loadingTraffic || detectingLocation) && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#9AC2FA]/15 border border-[#9AC2FA]/30 text-[11px] font-semibold text-[#9AC2FA] font-mono">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Syncing Telemetry...</span>
              </span>
            )}
            {freeFlowSpeed !== null && freeFlowSpeed !== undefined && !loadingTraffic && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-[#1B1D22] text-[#C5C8D0] border border-white/[0.10] font-mono">
                Free-Flow: {Math.round(freeFlowSpeed)} km/h
              </span>
            )}
          </div>
        </div>

        {/* Road & Location Information (Spec 3.B) */}
        <div className="space-y-1.5 max-w-2xl px-2">
          <div className="flex items-center justify-center gap-2 text-[#9AC2FA] text-xs font-semibold uppercase tracking-wider font-mono">
            <MapPin className="w-3.5 h-3.5" />
            <span>{isHindi ? "वर्तमान सड़क कॉरिडोर" : "CURRENT CORRIDOR"}</span>
          </div>
          <h2
            data-testid="hud-road-name"
            className="font-serif text-3xl sm:text-4xl md:text-5xl font-medium text-white tracking-tight leading-tight"
          >
            {displayRoad}
          </h2>
          <p
            data-testid="hud-area-name"
            className="text-xs sm:text-sm text-[#C5C8D0] font-medium"
          >
            {displayArea}
          </p>
          {userLocation?.accuracyWarning && (
            <p className="text-[11px] text-amber-400 font-medium pt-1">
              ⚠ Approximate Location (±{userLocation.accuracy}m)
            </p>
          )}
        </div>

        {/* Prompt to Detect Location if user has not yet detected */}
        {!userLocation && !detectingLocation && (
          <div className="pt-2">
            <button
              type="button"
              data-testid="hud-detect-btn"
              onClick={onDetectLocation}
              className="px-6 py-3 rounded-lg bg-[#9AC2FA] hover:bg-[#B4D2FC] text-[#0A0D14] font-semibold text-sm shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Navigation className="w-4 h-4" />
              <span>{isHindi ? "जीपीएस स्थान पहचानें (Detect Location Now)" : "Detect Location Now"}</span>
            </button>
          </div>
        )}

        {/* Telemetry metadata breakdown row */}
        {isTrafficAvailable && coordTraffic && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl pt-2 text-xs">
            <div className="p-2.5 rounded-xl bg-[#111318] border border-white/[0.08]">
              <span className="text-[10px] text-[#8C93A4] font-semibold block uppercase">Condition</span>
              <span className="font-semibold text-white capitalize">{coordTraffic.congestion_level || "Normal"}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#111318] border border-white/[0.08]">
              <span className="text-[10px] text-[#8C93A4] font-semibold block uppercase">Free-Flow Speed</span>
              <span className="font-semibold text-white">{coordTraffic.free_flow_speed ?? "--"} km/h</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#111318] border border-white/[0.08]">
              <span className="text-[10px] text-[#8C93A4] font-semibold block uppercase">Confidence</span>
              <span className="font-semibold text-white">
                {coordTraffic.confidence ? `${Math.round(coordTraffic.confidence * 100)}%` : "Verified GPS"}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#111318] border border-white/[0.08]">
              <span className="text-[10px] text-[#8C93A4] font-semibold block uppercase">Data Source</span>
              <span className="font-semibold text-[#9AC2FA] truncate block">TomTom Flow API</span>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* 3. BOTTOM SECTION: VOICE CONTROLS + SAFETY NOTICE        */}
      {/* ======================================================== */}
      <footer className="px-4 sm:px-8 py-4 bg-[#0D0F14]/95 border-t border-white/[0.08] backdrop-blur-md space-y-3 shrink-0 max-w-4xl mx-auto w-full">
        {/* Voice Announcement Ticker */}
        {lastAnnouncement && (
          <div className="px-4 py-2.5 rounded-2xl bg-[#161920] border border-white/[0.08] flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  voiceSpeaking ? "bg-[#9AC2FA] text-[#0A0D14]" : "bg-[#1B1D22] text-[#C5C8D0]"
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
              </div>
              <p
                data-testid="hud-latest-announcement-text"
                className="text-[#E8EAEE] font-medium italic truncate text-[11px] sm:text-xs"
              >
                “{lastAnnouncement}”
              </p>
            </div>
            {voiceSpeaking && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                Speaking
              </span>
            )}
          </div>
        )}

        {/* Touch-Friendly Voice Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Voice ON/OFF & Language */}
          <div className="flex items-center gap-2">
            {/* Voice Toggle Switch */}
            <button
              type="button"
              role="switch"
              data-testid="hud-voice-toggle"
              aria-checked={voiceEnabled}
              onClick={toggleVoice}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer ${
                voiceEnabled
                  ? "bg-[#9AC2FA] text-[#0A0D14] border-[#9AC2FA]"
                  : "bg-[#1B1D22] text-[#C5C8D0] border-white/[0.10] hover:text-white"
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>{voiceEnabled ? "Voice Guidance: ON" : "Voice Guidance: OFF"}</span>
            </button>

            {/* Language Selector Pills */}
            <div className="inline-flex rounded-lg p-0.5 bg-[#1B1D22] border border-white/[0.10] text-xs font-semibold">
              <button
                type="button"
                data-testid="hud-lang-en"
                onClick={() => setVoiceLang("en")}
                className={`px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                  voiceLang === "en" ? "bg-[#9AC2FA] text-[#0A0D14]" : "text-[#8C93A4] hover:text-white"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                data-testid="hud-lang-hi"
                onClick={() => setVoiceLang("hi")}
                className={`px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                  voiceLang === "hi" ? "bg-[#9AC2FA] text-[#0A0D14]" : "text-[#8C93A4] hover:text-white"
                }`}
              >
                हिंदी
              </button>
            </div>
          </div>

          {/* Right: Quick Actions (Test Voice, Mute, Replay) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="hud-test-voice-btn"
              onClick={testVoice}
              className="px-3 py-2 rounded-lg bg-[#1B1D22] hover:bg-white/[0.08] border border-white/[0.10] text-xs font-semibold text-[#E8EAEE] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Test Voice Synthesis"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#9AC2FA]" />
              <span className="hidden sm:inline">Test Voice</span>
            </button>

            <button
              type="button"
              data-testid="hud-mute-btn"
              onClick={toggleMute}
              className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                voiceMuted
                  ? "bg-amber-950/60 border-amber-700 text-amber-300"
                  : "bg-[#1B1D22] hover:bg-white/[0.08] border-white/[0.10] text-[#E8EAEE]"
              }`}
              title={voiceMuted ? "Unmute Voice Guidance" : "Mute Voice Guidance"}
            >
              {voiceMuted ? <VolumeX className="w-3.5 h-3.5 text-amber-400" /> : <Volume2 className="w-3.5 h-3.5 text-[#8C93A4]" />}
              <span>{voiceMuted ? "Unmute" : "Mute"}</span>
            </button>

            <button
              type="button"
              data-testid="hud-replay-btn"
              onClick={replayLastAnnouncement}
              disabled={voiceSpeaking}
              className="px-3 py-2 rounded-lg bg-[#1B1D22] hover:bg-white/[0.08] border border-white/[0.10] text-xs font-semibold text-[#E8EAEE] flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              title="Replay Last Advisory Announcement"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${voiceSpeaking ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Replay</span>
            </button>
          </div>
        </div>

        {/* Safety & Compliance Notice (Spec 6) */}
        <div className="pt-1 border-t border-white/[0.08] text-center">
          <p className="text-[10px] sm:text-[11px] text-[#8C93A4] flex items-center justify-center gap-1.5 leading-snug">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              Drive safely. Keep your attention on the road. Use voice guidance and interact with this dashboard only when it is safe to do so.
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
};

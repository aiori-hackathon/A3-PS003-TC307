import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Crosshair,
  MapPin,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { api } from "../../services/api";
import { EmergencyCorridorRequest, IntersectionDetail } from "../../types";
import { DetectedLocationEvent } from "../location/DetectMyLocationCard";
import {
  detectPreciseUserLocation,
  formatCityDistrictState,
  GeolocationErrorInfo,
} from "../../utils/geolocation";

interface CitizenSosPanelProps {
  isHindi: boolean;
  intersections: IntersectionDetail[];
  detectedLocation: DetectedLocationEvent | null;
  currentUserId?: string;
  myRequests: EmergencyCorridorRequest[];
  onRequestSubmitted: (created: EmergencyCorridorRequest) => Promise<void> | void;
}

const EMERGENCY_CONTACTS = [
  { number: "112", label: "National Emergency", labelHi: "राष्ट्रीय आपातकाल (112)", color: "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800" },
  { number: "108", label: "Ambulance / Medical", labelHi: "एम्बुलेंस सेवा (108)", color: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800" },
  { number: "100", label: "Police Control", labelHi: "पुलिस नियंत्रण कक्ष (100)", color: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800" },
  { number: "101", label: "Fire & Rescue", labelHi: "अग्निशमन दल (101)", color: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800" },
  { number: "1095", label: "Traffic Helpline", labelHi: "ट्रैफिक पुलिस हेल्पलाइन (1095)", color: "text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800" },
];

const VEHICLE_LABELS: Record<string, string> = {
  ambulance: "Ambulance / ICU Transit",
  fire_truck: "Fire & Rescue Brigade",
  police_escort: "Police Emergency Escort",
  medical_emergency: "Critical Medical Transfer",
  sos: "General Life-Safety SOS",
};

export const CitizenSosPanel: React.FC<CitizenSosPanelProps> = ({
  isHindi,
  intersections,
  detectedLocation,
  currentUserId,
  myRequests,
  onRequestSubmitted,
}) => {
  const [vehicleType, setVehicleType] = useState<string>("ambulance");
  const [priority, setPriority] = useState<string>("critical");
  const [originId, setOriginId] = useState<string>(intersections[0]?.id || "INT-01");
  const [destId, setDestId] = useState<string>(intersections[3]?.id || intersections[2]?.id || "INT-04");
  const [description, setDescription] = useState<string>("");

  const [shareGpsLocation, setShareGpsLocation] = useState<boolean>(Boolean(detectedLocation));
  const [sharedCoords, setSharedCoords] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    label: string;
  } | null>(
    detectedLocation
      ? {
          lat: detectedLocation.lat,
          lng: detectedLocation.lng,
          accuracy: detectedLocation.accuracy,
          label:
            detectedLocation.roadName ||
            formatCityDistrictState({
              city: detectedLocation.city,
              district: detectedLocation.district,
              state: detectedLocation.state,
              lat: detectedLocation.lat,
              lng: detectedLocation.lng,
            }),
        }
      : null
  );
  const [capturingGps, setCapturingGps] = useState<boolean>(false);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);

  const [pendingConfirmation, setPendingConfirmation] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [confirmedReceipt, setConfirmedReceipt] = useState<EmergencyCorridorRequest | null>(null);
  const [sosError, setSosError] = useState<string | null>(null);

  const handleCaptureGps = async () => {
    setCapturingGps(true);
    setGpsNotice(null);
    setSosError(null);
    try {
      const detected = await detectPreciseUserLocation({ intersections, timeoutMs: 12000 });
      const label =
        detected.roadName ||
        formatCityDistrictState({
          city: detected.city,
          district: detected.district,
          state: detected.state,
          lat: detected.lat,
          lng: detected.lng,
        });
      setSharedCoords({
        lat: detected.lat,
        lng: detected.lng,
        accuracy: detected.accuracy,
        label,
      });
      setShareGpsLocation(true);
      if (detected.nearestDelhiNodeId) {
        setOriginId(detected.nearestDelhiNodeId);
      }
    } catch (err: unknown) {
      const geoErr = err as GeolocationErrorInfo;
      setShareGpsLocation(false);
      setGpsNotice(
        isHindi
          ? geoErr?.messageHi || "GPS लोकेशन प्राप्त नहीं हो सकी। आप नीचे जंक्शन चुन सकते हैं।"
          : geoErr?.message || "Unable to capture GPS coordinates. You may still select an origin junction below."
      );
    } finally {
      setCapturingGps(false);
    }
  };

  const originNode = intersections.find((i) => i.id === originId) || intersections[0];
  const destNode = intersections.find((i) => i.id === destId) || intersections[1];

  const handleOpenConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    setSosError(null);
    setConfirmedReceipt(null);

    if (!shareGpsLocation && originId === destId) {
      setSosError(
        isHindi
          ? "ग्रीन कॉरिडोर के लिए शुरुआती और गंतव्य जंक्शन अलग होने चाहिए।"
          : "Origin and destination junctions must be different unless sharing custom GPS coordinates."
      );
      return;
    }
    if (!destNode) {
      setSosError("Please select a valid destination junction or hospital zone.");
      return;
    }
    if (!shareGpsLocation && !originNode) {
      setSosError("Please select a valid origin junction or enable GPS location sharing.");
      return;
    }

    setPendingConfirmation(true);
  };

  const handleConfirmDispatch = async () => {
    if (!destNode) return;
    setSosError(null);
    setSubmitting(true);
    try {
      const useGps = shareGpsLocation && Boolean(sharedCoords);
      const created = await api.createEmergencyCorridor({
        vehicle_type: vehicleType,
        origin_id: useGps ? "GPS_CURRENT" : originNode!.id,
        origin_name: useGps
          ? `Live GPS: ${sharedCoords!.label}`
          : originNode!.name,
        origin_lat: useGps ? sharedCoords!.lat : originNode!.latitude,
        origin_lon: useGps ? sharedCoords!.lng : originNode!.longitude,
        destination_id: destNode.id,
        destination_name: destNode.name,
        destination_lat: destNode.latitude,
        destination_lon: destNode.longitude,
        priority,
        description:
          description.trim() ||
          `Citizen Emergency SOS (${VEHICLE_LABELS[vehicleType] || vehicleType})`,
        user_id: currentUserId || "usr_demo_citizen",
      });

      setConfirmedReceipt(created);
      setPendingConfirmation(false);
      setDescription("");
      await onRequestSubmitted(created);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Backend emergency dispatch failed. Call 112/108 immediately.";
      setSosError(msg);
      setPendingConfirmation(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" data-testid="card-sos-assistance">
      {/* Left: Helplines + Dispatch Form with Confirmation */}
      <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-[#111318] border border-rose-200 dark:border-rose-500/30 shadow-sm space-y-5">
        <div className="flex items-start gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.08]">
          <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            <Siren className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-medium text-slate-900 dark:text-white">
              {isHindi ? "आपातकालीन सहायता एवं SOS नियंत्रण" : "Emergency Assistance & SOS Dispatch"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#8C93A4] mt-0.5">
              {isHindi
                ? "आपातकालीन हेल्पलाइन पर तुरंत कॉल करें या पुष्टि के बाद ट्रैफिक नियंत्रण कक्ष को ग्रीन कॉरिडोर अनुरोध भेजें।"
                : "Call direct emergency helplines below or submit a verified Green Corridor priority request to Traffic Control."}
            </p>
          </div>
        </div>

        {/* Direct Emergency Contacts Directory */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-rose-600" />
            <span>{isHindi ? "तुरंत आपातकालीन हेल्पलाइन नंबर" : "Direct Emergency Helplines"}</span>
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {EMERGENCY_CONTACTS.map((c) => (
              <a
                key={c.number}
                href={`tel:${c.number}`}
                className={`p-2.5 rounded-xl border text-center hover:opacity-90 transition-opacity ${c.color}`}
                data-testid={`emergency-contact-${c.number}`}
              >
                <span className="text-base font-black block leading-none">{c.number}</span>
                <span className="text-[10px] font-semibold block mt-1 leading-tight">
                  {isHindi ? c.labelHi.replace(/\s*\(\d+\)/, "") : c.label}
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Backend-Verified Dispatch Confirmation Banner */}
        {confirmedReceipt && (
          <div
            className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-1.5"
            data-testid="sos-verified-receipt"
          >
            <div className="flex items-center gap-2 font-extrabold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Dispatch Verified by Server: {confirmedReceipt.id}</span>
            </div>
            <p>
              Status: <b className="uppercase">{confirmedReceipt.status}</b> • Route:{" "}
              <b>{confirmedReceipt.origin_name}</b> → <b>{confirmedReceipt.destination_name}</b> (
              {confirmedReceipt.distance_km} km, ~{confirmedReceipt.estimated_time_minutes} min)
            </p>
          </div>
        )}

        {sosError && (
          <div
            className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs font-semibold text-red-700 dark:text-red-300 flex items-start gap-2"
            data-testid="sos-error-banner"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{sosError}</span>
          </div>
        )}

        {/* SOS Request Form or Explicit User Confirmation Step */}
        {pendingConfirmation ? (
          <div
            className="p-5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/25 border-2 border-rose-400 dark:border-rose-500/45 space-y-4"
            data-testid="sos-confirmation-dialog"
          >
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-serif text-base font-bold text-rose-900 dark:text-rose-200">
                  {isHindi ? "SOS भेजने से पहले विवरण की पुष्टि करें" : "Confirm Emergency SOS Dispatch"}
                </h3>
                <p className="text-xs text-rose-800 dark:text-rose-300 mt-0.5">
                  {isHindi
                    ? "पुष्टि करने पर यह अनुरोध तुरंत नगर निगम ट्रैफिक नियंत्रण कक्ष को भेजा जाएगा।"
                    : "Review your details carefully before alerting Municipal Traffic Operations."}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-[#111318] border border-rose-200 dark:border-rose-500/25 text-xs space-y-1.5 text-slate-700 dark:text-[#E8EAEE]">
              <div>
                <span className="text-slate-400 dark:text-[#8E939E]">Emergency Type: </span>
                <b className="capitalize">{VEHICLE_LABELS[vehicleType] || vehicleType}</b> (
                <span className="uppercase font-bold text-rose-600 dark:text-rose-400">{priority}</span>)
              </div>
              <div>
                <span className="text-slate-400 dark:text-[#8E939E]">Location Shared: </span>
                {shareGpsLocation && sharedCoords ? (
                  <b className="text-emerald-700 dark:text-emerald-300">
                    Yes — GPS ({sharedCoords.lat.toFixed(5)}, {sharedCoords.lng.toFixed(5)} • ±
                    {sharedCoords.accuracy}m • {sharedCoords.label})
                  </b>
                ) : (
                  <b>Corridor Junction: {originNode?.name} ({originNode?.id})</b>
                )}
              </div>
              <div>
                <span className="text-slate-400 dark:text-[#8E939E]">Destination / Hospital Zone: </span>
                <b>{destNode?.name} ({destNode?.id})</b>
              </div>
              {description.trim() && (
                <div>
                  <span className="text-slate-400 dark:text-[#8E939E]">Notes: </span>
                  <span>{description.trim()}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleConfirmDispatch}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold text-xs shadow-sm cursor-pointer"
                data-testid="sos-confirm-dispatch-btn"
              >
                {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{submitting ? "Dispatching..." : "Confirm & Dispatch SOS"}</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingConfirmation(false)}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/[0.12] bg-white dark:bg-[#1B1D22] text-slate-700 dark:text-[#E8EAEE] text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#22252C] cursor-pointer"
                data-testid="sos-cancel-confirm-btn"
              >
                Edit Details
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleOpenConfirmation} className="space-y-3.5" data-testid="sos-form">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#C5C8D0] mb-1">
                  Vehicle / Emergency Type
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  data-testid="sos-vehicle-select"
                >
                  <option value="ambulance">Ambulance / ICU Transit</option>
                  <option value="fire_truck">Fire & Rescue Brigade</option>
                  <option value="police_escort">Police Emergency Escort</option>
                  <option value="medical_emergency">Critical Medical Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#C5C8D0] mb-1">
                  Urgency Level
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                >
                  <option value="critical">Critical — Life-Safety Immediate</option>
                  <option value="high">High — Urgent Priority Corridor</option>
                </select>
              </div>
            </div>

            {/* GPS Location Sharing Option */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-[#E8EAEE] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareGpsLocation}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setShareGpsLocation(next);
                      if (next && !sharedCoords) {
                        handleCaptureGps();
                      }
                    }}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 dark:border-white/20"
                    data-testid="sos-share-gps-checkbox"
                  />
                  <span>{isHindi ? "आपातकाल में मेरा लाइव GPS स्थान साझा करें" : "Share my live GPS location with dispatch"}</span>
                </label>
                <button
                  type="button"
                  onClick={handleCaptureGps}
                  disabled={capturingGps}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-[#9AC2FA]/15 border border-blue-200 dark:border-[#9AC2FA]/30 text-blue-700 dark:text-[#9AC2FA] text-[11px] font-semibold hover:bg-blue-100 dark:hover:bg-[#9AC2FA]/25 cursor-pointer"
                >
                  <Crosshair className={`w-3 h-3 ${capturingGps ? "animate-spin" : ""}`} />
                  <span>{capturingGps ? "Capturing GPS..." : "Refresh GPS Fix"}</span>
                </button>
              </div>

              {shareGpsLocation && sharedCoords && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Sharing: <b>{sharedCoords.label}</b> ({sharedCoords.lat.toFixed(5)}, {sharedCoords.lng.toFixed(5)} • ±
                    {sharedCoords.accuracy}m)
                  </span>
                </p>
              )}
              {gpsNotice && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">{gpsNotice}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#C5C8D0] mb-1">
                  Origin Junction {shareGpsLocation && sharedCoords ? "(Corridor Entry Fallback)" : ""}
                </label>
                <select
                  value={originId}
                  onChange={(e) => setOriginId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                >
                  {intersections.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name} ({node.id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#C5C8D0] mb-1">
                  Destination Junction / Hospital Zone
                </label>
                <select
                  value={destId}
                  onChange={(e) => setDestId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                >
                  {intersections.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name} ({node.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#C5C8D0] mb-1">
                Emergency Details / Patient & Unit Notes
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide unit identifier, patient condition, or exact landmark..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#8C93A4] focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <button
              type="submit"
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
              data-testid="sos-review-submit-btn"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isHindi ? "समीक्षा करें और SOS भेजें" : "Review & Confirm Emergency SOS"}</span>
            </button>
          </form>
        )}
      </div>

      {/* Right: Backend-Verified SOS Request History & Dispatch Status */}
      <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3">
          <div>
            <h3 className="font-serif font-medium text-base text-slate-900 dark:text-white">
              {isHindi ? "मेरे आपातकालीन अनुरोध" : "My Verified SOS Requests"}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-[#8C93A4]">
              {isHindi ? "कंट्रोल रूम से वास्तविक समय स्थिति अपडेट" : "Live dispatch status persisted by Traffic Control"}
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1B1D22] text-slate-700 dark:text-[#C5C8D0] border dark:border-white/[0.08]">
            {myRequests.length}
          </span>
        </div>

        {myRequests.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-[#161920] border border-dashed border-slate-200 dark:border-white/[0.10] text-xs text-slate-500 dark:text-[#8C93A4] space-y-1">
            <Siren className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="font-semibold text-slate-700 dark:text-[#E8EAEE]">
              {isHindi ? "कोई सक्रिय SOS अनुरोध नहीं" : "No Emergency Requests Submitted Yet"}
            </p>
            <p className="text-[11px]">
              {isHindi
                ? "पुष्टि के बाद भेजे गए सभी SOS अनुरोध यहां ट्रैकिंग आईडी के साथ दिखाई देंगे।"
                : "Confirmed SOS corridor dispatches will appear here with real server IDs and authority updates."}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {myRequests.map((req) => (
              <div
                key={req.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {req.id}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      req.status === "ACTIVE" || req.status === "APPROVED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                        : req.status === "REJECTED" || req.status === "CANCELLED"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
                <p className="font-semibold text-slate-800 dark:text-[#E8EAEE]">
                  {req.origin_name} → {req.destination_name}
                </p>
                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-[#8C93A4]">
                  <span className="capitalize">
                    {req.vehicle_type.replace(/_/g, " ")} • {req.distance_km} km (~{req.estimated_time_minutes} min)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {req.authority_notes && (
                  <p className="p-2 rounded-lg bg-blue-50 dark:bg-[#1B1D22] border border-blue-200 dark:border-[#9AC2FA]/30 text-[11px] text-blue-900 dark:text-[#C5C8D0]">
                    Authority Note: {req.authority_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

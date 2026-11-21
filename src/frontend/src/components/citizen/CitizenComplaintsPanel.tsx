import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crosshair,
  FileImage,
  History,
  ImagePlus,
  Loader2,
  MapPin,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  Tag,
  Trash2,
  Upload,
  Wrench,
  XCircle,
} from "lucide-react";
import { api, resolveMediaUrl } from "../../services/api";
import { CitizenReport, CitizenReportTimeline, IntersectionDetail } from "../../types";
import { DetectedLocationEvent } from "../location/DetectMyLocationCard";

interface CitizenComplaintsPanelProps {
  isHindi: boolean;
  reports: CitizenReport[];
  intersections: IntersectionDetail[];
  detectedLocation: DetectedLocationEvent | null;
  currentUserId?: string;
  isAuthorityUser: boolean;
  highlightedReportId?: string | null;
  defaultOpenForm?: boolean;
  loading?: boolean;
  error?: string | null;
  onReportCreated: (report: CitizenReport) => void;
  onRefreshReports: () => Promise<void> | void;
  onShareReport: (report: CitizenReport) => void;
  onPreviewPhoto: (url: string) => void;
  onOpenResolutionAction?: (report: CitizenReport, targetStatus: string) => void;
}

const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const CATEGORY_OPTIONS = [
  { value: "damaged_road", label: "Pothole / Damaged Road", labelHi: "गड्ढा / क्षतिग्रस्त सड़क" },
  { value: "congestion", label: "Severe Traffic Congestion", labelHi: "गंभीर ट्रैफिक जाम" },
  { value: "broken_signal", label: "Broken Traffic Signal", labelHi: "खराब ट्रैफिक सिग्नल" },
  { value: "accident", label: "Traffic Accident", labelHi: "सड़क दुर्घटना" },
  { value: "road_blockage", label: "Obstruction / Road Blockage", labelHi: "सड़क अवरोध / बाधा" },
  { value: "waterlogging", label: "Waterlogging", labelHi: "जलभराव" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All", labelHi: "सभी" },
  { value: "unverified", label: "Unverified", labelHi: "असत्यापित" },
  { value: "verified", label: "Verified", labelHi: "सत्यापित" },
  { value: "in_progress", label: "In Progress", labelHi: "प्रगति पर" },
  { value: "resolved", label: "Resolved", labelHi: "सुलझा हुआ" },
  { value: "dismissed", label: "Dismissed", labelHi: "खारिज" },
];

const getStatusBadgeClasses = (status: string): string => {
  switch (status.toLowerCase()) {
    case "resolved":
      return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
    case "in_progress":
      return "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800";
    case "verified":
      return "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800";
    case "dismissed":
      return "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
    default:
      return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
  }
};

const getPriorityBadgeClasses = (priority?: string): string => {
  switch ((priority || "medium").toLowerCase()) {
    case "critical":
      return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
    case "high":
      return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800";
    case "low":
      return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    default:
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
  }
};

export const CitizenComplaintsPanel: React.FC<CitizenComplaintsPanelProps> = ({
  isHindi,
  reports,
  intersections,
  detectedLocation,
  currentUserId,
  isAuthorityUser,
  highlightedReportId,
  defaultOpenForm = false,
  loading = false,
  error = null,
  onReportCreated,
  onRefreshReports,
  onShareReport,
  onPreviewPhoto,
  onOpenResolutionAction,
}) => {
  const [category, setCategory] = useState<string>("road_blockage");
  const [locationName, setLocationName] = useState<string>("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [description, setDescription] = useState<string>("");

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedReport, setSubmittedReport] = useState<CitizenReport | null>(null);

  const [scopeFilter, setScopeFilter] = useState<"all" | "mine">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedTimelines, setExpandedTimelines] = useState<Record<string, boolean>>({});
  const [timelineCache, setTimelineCache] = useState<Record<string, CitizenReportTimeline[]>>({});
  const [loadingTimelines, setLoadingTimelines] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState<boolean>(Boolean(defaultOpenForm));

  useEffect(() => {
    if (defaultOpenForm) {
      setShowForm(true);
    }
  }, [defaultOpenForm]);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const clearPhotoState = () => {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setPhotoError(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  const handlePhotoSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input value so picking the same replacement file still fires onChange
    e.target.value = "";
    if (!file) return;

    const normalizedType = (file.type || "").toLowerCase();
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const validByExt = ["jpg", "jpeg", "png", "webp"].includes(ext);

    if (!ALLOWED_PHOTO_TYPES.has(normalizedType) && !(normalizedType === "" && validByExt)) {
      setPhotoError("Invalid image format. Please attach a JPG, PNG, or WebP image (max 5 MB).");
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      setPhotoError(`Selected image is ${mb} MB, which exceeds the 5 MB upload limit.`);
      return;
    }

    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }

    setPhotoError(null);
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const handleUseDetectedLocation = () => {
    if (!detectedLocation) return;
    const areaParts = [
      detectedLocation.roadName,
      detectedLocation.area,
      detectedLocation.city,
      detectedLocation.state,
    ]
      .filter(Boolean)
      .filter((part, idx, arr) => arr.indexOf(part) === idx);
    setLocationName(
      areaParts.join(", ") ||
        `${detectedLocation.lat.toFixed(5)}, ${detectedLocation.lng.toFixed(5)}`
    );
    setCoords({ latitude: detectedLocation.lat, longitude: detectedLocation.lng });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const trimmedLocation = locationName.trim();
    const trimmedDesc = description.trim();
    if (!trimmedLocation) {
      setSubmitError("Please specify the incident location or road/intersection.");
      return;
    }
    if (trimmedDesc.length < 5) {
      setSubmitError("Please enter a short description of the traffic issue (at least 5 characters).");
      return;
    }

    setSubmitting(true);
    try {
      let uploadedPhotoUrl: string | undefined;
      if (photoFile) {
        const uploadRes = await api.uploadReportPhoto(photoFile);
        uploadedPhotoUrl = uploadRes.photo_url;
      }

      const matchedNode = intersections.find(
        (node) =>
          node.name.toLowerCase() === trimmedLocation.toLowerCase() ||
          trimmedLocation.toLowerCase().includes(node.name.toLowerCase())
      );

      const created = await api.createCitizenReport({
        category,
        location_name: trimmedLocation,
        latitude: coords?.latitude ?? matchedNode?.latitude,
        longitude: coords?.longitude ?? matchedNode?.longitude,
        description: trimmedDesc,
        photo_url: uploadedPhotoUrl,
        user_id: currentUserId || "usr_demo_citizen",
      });

      setSubmittedReport(created);
      onReportCreated(created);
      setLocationName("");
      setCoords(null);
      setDescription("");
      clearPhotoState();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit traffic complaint.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTimeline = async (report: CitizenReport) => {
    const nextOpen = !expandedTimelines[report.id];
    setExpandedTimelines((prev) => ({ ...prev, [report.id]: nextOpen }));

    if (nextOpen && !timelineCache[report.id] && (!report.timeline || report.timeline.length === 0)) {
      setLoadingTimelines((prev) => ({ ...prev, [report.id]: true }));
      try {
        const entries = await api.getCitizenReportTimeline(report.id);
        setTimelineCache((prev) => ({ ...prev, [report.id]: entries }));
      } catch (err) {
        console.error("Failed to fetch report timeline:", err);
      } finally {
        setLoadingTimelines((prev) => ({ ...prev, [report.id]: false }));
      }
    }
  };

  const filteredReports = useMemo(() => {
    return reports.filter((rep) => {
      if (scopeFilter === "mine" && currentUserId && rep.user_id !== currentUserId) {
        return false;
      }
      if (statusFilter !== "all" && rep.status.toLowerCase() !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [reports, scopeFilter, statusFilter, currentUserId]);

  return (
    <div className="space-y-5" data-testid="card-report-issue">
      {/* Header & Progressive Disclosure Action Bar */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-lg sm:text-xl font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>{isHindi ? "यातायात समस्याएं एवं शिकायतें" : "Traffic Complaints & Reports"}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#8C93A4] mt-0.5">
            {isHindi
              ? "प्राधिकरण सत्यापन और समाधान प्रगति को ट्रैक करें या नई समस्या दर्ज करें।"
              : "Track verified community reports and resolution status, or submit a new traffic issue."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          data-testid="toggle-report-form-btn"
          className={`px-4 py-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors shrink-0 cursor-pointer ${
            showForm
              ? "bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-[#1B1D22] dark:hover:bg-[#252830] dark:text-[#C5C8D0] border border-slate-200 dark:border-white/[0.10]"
              : "bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#B4D2FC] text-white dark:text-[#0A0D14] shadow-sm"
          }`}
        >
          {showForm ? (
            <>
              <ChevronUp className="w-4 h-4" />
              <span>{isHindi ? "फॉर्म बंद करें" : "Hide Report Form"}</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>{isHindi ? "+ नई शिकायत दर्ज करें" : "Report an Issue"}</span>
            </>
          )}
        </button>
      </div>

      {/* Confirmation Banner when form is collapsed right after submission */}
      {!showForm && submittedReport && (
        <div
          className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2"
          data-testid="report-confirmation-banner"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">
                  {isHindi ? "शिकायत सफलतापूर्वक दर्ज हुई!" : "Complaint submitted successfully!"}
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                  ID: <span className="font-mono font-bold">{submittedReport.id}</span> • Status:{" "}
                  <span className="font-mono font-bold uppercase">
                    {submittedReport.status.replace(/_/g, " ")}
                  </span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onShareReport(submittedReport)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/60 transition-colors shrink-0 cursor-pointer"
              data-testid="share-new-report-btn"
            >
              <Share2 className="w-3 h-3" />
              <span>{isHindi ? "साझा करें" : "Share"}</span>
            </button>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Progressive Disclosure: Submit Traffic Complaint & Photo Evidence Form */}
        {showForm && (
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.08]">
            <div>
              <h2 className="font-serif text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>{isHindi ? "यातायात समस्या दर्ज करें" : "Report Traffic Issue"}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#8C93A4] mt-0.5">
                {isHindi
                  ? "फोटो साक्ष्य के साथ सड़क बाधा, जलभराव या खराब सिग्नल की सूचना दें।"
                  : "Submit road blockages, waterlogging, potholes, or signal faults directly to Traffic Authority."}
              </p>
            </div>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-[#9AC2FA]/15 dark:text-[#9AC2FA] dark:border-[#9AC2FA]/30 shrink-0">
              {isHindi ? "लाइव सिंक" : "Authority Sync"}
            </span>
          </div>

          {submittedReport && (
            <div
              className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2"
              data-testid="report-confirmation-banner"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">
                      {isHindi ? "शिकायत सफलतापूर्वक दर्ज हुई!" : "Complaint submitted successfully!"}
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                      ID: <span className="font-mono font-bold">{submittedReport.id}</span> • Status:{" "}
                      <span className="font-mono font-bold uppercase">
                        {submittedReport.status.replace(/_/g, " ")}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onShareReport(submittedReport)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/60 transition-colors shrink-0 cursor-pointer"
                  data-testid="share-new-report-btn"
                >
                  <Share2 className="w-3 h-3" />
                  <span>{isHindi ? "साझा करें" : "Share"}</span>
                </button>
              </div>
            </div>
          )}

          {submitError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-medium">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5" data-testid="citizen-report-form">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#C5C8D0] mb-1">
                {isHindi ? "समस्या का प्रकार" : "Incident Type"}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#9AC2FA]"
                data-testid="report-category-select"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {isHindi ? opt.labelHi : opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#C5C8D0]">
                  {isHindi ? "स्थान / चौराहा" : "Location / Road / Intersection"}
                </label>
                {detectedLocation && (
                  <button
                    type="button"
                    onClick={handleUseDetectedLocation}
                    className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-[#9AC2FA] hover:underline cursor-pointer"
                    data-testid="use-detected-location-btn"
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>{isHindi ? "मेरा GPS उपयोग करें" : "Use My GPS"}</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={locationName}
                onChange={(e) => {
                  setLocationName(e.target.value);
                  if (coords) setCoords(null);
                }}
                placeholder={
                  isHindi
                    ? "उदा. आईटीओ क्रॉसिंग, विकास मार्ग"
                    : "e.g., ITO Crossing, Vikas Marg or Civil Lines Road"
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#8C93A4] focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#9AC2FA]"
                data-testid="report-location-input"
              />
              {coords && (
                <p className="mt-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>
                    GPS coordinates attached ({coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)})
                  </span>
                </p>
              )}
              {intersections.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {intersections.slice(0, 4).map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => {
                        setLocationName(node.name);
                        setCoords({ latitude: node.latitude, longitude: node.longitude });
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 dark:bg-[#1B1D22] dark:text-[#C5C8D0] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                    >
                      + {node.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#C5C8D0] mb-1">
                {isHindi ? "विवरण" : "Description"}
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  isHindi
                    ? "यातायात प्रभाव और सटीक स्थिति का संक्षिप्त विवरण लिखें..."
                    : "Describe the blockage, severity, lane affected, or nearby landmark..."
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#1B1D22] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#8C93A4] focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#9AC2FA]"
                data-testid="report-description-input"
              />
            </div>

            {/* Camera & Gallery Photo Attachment */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161920] border border-slate-200 dark:border-white/[0.08] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-[#E8EAEE] flex items-center gap-1.5">
                  <FileImage className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
                  <span>{isHindi ? "फोटो साक्ष्य (वैकल्पिक)" : "Photo Evidence (Optional)"}</span>
                </span>
                <span className="text-[10px] text-slate-400 dark:text-[#8C93A4]">JPG / PNG / WebP • Max 5 MB</span>
              </div>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={handlePhotoSelection}
                className="hidden"
                data-testid="camera-file-input"
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelection}
                className="hidden"
                data-testid="gallery-file-input"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.10] bg-white dark:bg-[#1B1D22] hover:border-blue-400 dark:hover:border-[#9AC2FA]/50 hover:text-blue-600 dark:hover:text-[#9AC2FA] text-xs font-semibold text-slate-700 dark:text-[#E8EAEE] transition-colors cursor-pointer"
                  data-testid="camera-capture-btn"
                >
                  <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
                  <span>{isHindi ? "कैमरा से लें" : "Capture Photo"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.10] bg-white dark:bg-[#1B1D22] hover:border-blue-400 dark:hover:border-[#9AC2FA]/50 hover:text-blue-600 dark:hover:text-[#9AC2FA] text-xs font-semibold text-slate-700 dark:text-[#E8EAEE] transition-colors cursor-pointer"
                  data-testid="gallery-upload-btn"
                >
                  <ImagePlus className="w-3.5 h-3.5 text-blue-600 dark:text-[#9AC2FA]" />
                  <span>{isHindi ? "गैलरी से चुनें" : "Upload Gallery"}</span>
                </button>
              </div>

              {photoError && (
                <div
                  className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-[11px] font-semibold text-red-700 dark:text-red-300"
                  data-testid="photo-error-msg"
                >
                  {photoError}
                </div>
              )}

              {photoFile && photoPreviewUrl && (
                <div
                  className="p-2.5 rounded-xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] space-y-2"
                  data-testid="photo-preview-card"
                >
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-white/[0.08] h-36 bg-slate-100 dark:bg-[#1B1D22]">
                    <img
                      src={photoPreviewUrl}
                      alt={photoFile.name}
                      className="w-full h-full object-cover"
                      data-testid="photo-preview-thumbnail"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="min-w-0">
                      <p
                        className="font-semibold text-slate-800 dark:text-[#E8EAEE] truncate"
                        data-testid="photo-preview-filename"
                      >
                        {photoFile.name}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-[#8C93A4]">
                        {(photoFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1B1D22] dark:hover:bg-white/[0.08] text-slate-700 dark:text-[#E8EAEE] font-semibold transition-colors cursor-pointer"
                        data-testid="replace-photo-btn"
                      >
                        <Upload className="w-3 h-3" />
                        <span>{isHindi ? "बदलें" : "Replace"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={clearPhotoState}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-semibold transition-colors cursor-pointer"
                        data-testid="remove-photo-btn"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{isHindi ? "हटाएं" : "Remove"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-[#9AC2FA] dark:hover:bg-[#B4D2FC] disabled:opacity-60 text-white dark:text-[#0A0D14] font-semibold text-xs shadow-sm transition-colors cursor-pointer"
              data-testid="submit-complaint-btn"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isHindi ? "सबमिट हो रहा है..." : "Submitting Report..."}</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{isHindi ? "शिकायत दर्ज करें" : "Submit Traffic Complaint"}</span>
                </>
              )}
            </button>
          </form>
        </div>
        )}

        {/* Community & My Complaints Feed */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.08]">
            <div>
              <h2 className="font-serif text-lg font-medium text-slate-900 dark:text-white">
                {isHindi ? "नागरिक शिकायत ट्रैकर" : "Citizen Complaints & Status Feed"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#8C93A4]">
                {isHindi
                  ? "प्राधिकरण सत्यापन और समाधान प्रगति को रीयल-टाइम में ट्रैक करें"
                  : "Track verification, authority resolution notes, and full audit history"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex p-0.5 rounded-lg bg-slate-100 dark:bg-[#1B1D22] border border-transparent dark:border-white/[0.08] text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setScopeFilter("all")}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    scopeFilter === "all"
                      ? "bg-white dark:bg-[#9AC2FA] text-blue-600 dark:text-[#0A0D14] shadow-xs"
                      : "text-slate-500 dark:text-[#8E939E] hover:dark:text-white"
                  }`}
                >
                  {isHindi ? "सभी" : "All Reports"}
                </button>
                <button
                  type="button"
                  onClick={() => setScopeFilter("mine")}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    scopeFilter === "mine"
                      ? "bg-white dark:bg-[#9AC2FA] text-blue-600 dark:text-[#0A0D14] shadow-xs"
                      : "text-slate-500 dark:text-[#8E939E] hover:dark:text-white"
                  }`}
                >
                  {isHindi ? "मेरी शिकायतें" : "My Submissions"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => onRefreshReports()}
                disabled={loading}
                className="p-2 rounded-xl border border-slate-200 dark:border-white/[0.10] bg-white dark:bg-[#1B1D22] text-slate-500 dark:text-[#C5C8D0] hover:text-blue-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#22252C] transition-colors cursor-pointer disabled:opacity-60"
                title="Refresh complaints"
                data-testid="citizen-complaints-refresh-btn"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600 dark:text-[#9AC2FA]" : ""}`} />
              </button>
            </div>
          </div>

          {/* Inline Error Warning if refresh failed while cached complaints remain visible */}
          {error && reports.length > 0 && (
            <div
              className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-200 text-xs flex items-center justify-between gap-2"
              data-testid="citizen-complaints-error"
            >
              <span className="truncate font-medium">Could not refresh complaints: {error}</span>
              <button
                type="button"
                onClick={() => onRefreshReports()}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                data-testid="citizen-complaints-retry-btn"
              >
                Retry
              </button>
            </div>
          )}

          {/* Status Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTER_OPTIONS.map((pill) => {
              const count =
                pill.value === "all"
                  ? reports.length
                  : reports.filter((r) => r.status.toLowerCase() === pill.value).length;
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setStatusFilter(pill.value)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                    statusFilter === pill.value
                      ? "bg-blue-600 dark:bg-[#9AC2FA] text-white dark:text-[#0A0D14] border-blue-600 dark:border-[#9AC2FA]"
                      : "bg-slate-50 dark:bg-[#1B1D22] text-slate-600 dark:text-[#C5C8D0] border-slate-200 dark:border-white/[0.10] hover:border-blue-400 dark:hover:border-[#9AC2FA]/50"
                  }`}
                >
                  {isHindi ? pill.labelHi : pill.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Reports List */}
          <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
            {loading && reports.length === 0 ? (
              <div
                className="p-8 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/40 dark:bg-[#161920] text-center text-slate-400 dark:text-[#8E939E] text-xs space-y-2"
                data-testid="citizen-complaints-loading"
              >
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-[#9AC2FA] mx-auto" />
                <p>
                  {isHindi ? "नागरिक शिकायतें लोड हो रही हैं..." : "Loading citizen complaints..."}
                </p>
              </div>
            ) : error && reports.length === 0 ? (
              <div
                className="p-6 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/80 dark:bg-rose-950/25 text-center space-y-2.5"
                data-testid="citizen-complaints-error"
              >
                <AlertTriangle className="w-7 h-7 text-rose-500 dark:text-rose-400 mx-auto" />
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-200">
                  {isHindi
                    ? "शिकायतें लोड करने में समस्या हुई।"
                    : `Unable to load citizen complaints: ${error}`}
                </p>
                <button
                  type="button"
                  onClick={() => onRefreshReports()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 dark:bg-[#9AC2FA] hover:bg-blue-700 dark:hover:bg-[#B2D1FC] text-white dark:text-[#0A0D14] text-xs font-bold cursor-pointer"
                  data-testid="citizen-complaints-retry-btn"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isHindi ? "पुनः प्रयास करें" : "Retry Loading Complaints"}</span>
                </button>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-white/[0.10] bg-slate-50/30 dark:bg-[#161920] text-center text-slate-400 dark:text-[#8E939E] text-xs">
                {isHindi
                  ? "चयनित फ़िल्टर के लिए कोई शिकायत नहीं मिली।"
                  : "No citizen complaints match the current filter."}
              </div>
            ) : (
              filteredReports.map((rep) => {
                const resolvedPhotoUrl = resolveMediaUrl(rep.photo_url);
                const timelineOpen = Boolean(expandedTimelines[rep.id]);
                const entries =
                  timelineCache[rep.id] ||
                  (rep.timeline && rep.timeline.length > 0 ? rep.timeline : []);
                const isHighlighted = highlightedReportId === rep.id;

                return (
                  <div
                    key={rep.id}
                    id={`citizen-report-${rep.id}`}
                    data-report-id={rep.id}
                    className={`p-4 rounded-xl border transition-all space-y-3 ${
                      isHighlighted
                        ? "border-blue-500 dark:border-[#9AC2FA]/60 ring-2 ring-blue-500/30 dark:ring-[#9AC2FA]/20 bg-blue-50/30 dark:bg-[#9AC2FA]/[0.07]"
                        : "border-slate-200 dark:border-white/[0.08] bg-slate-50/40 dark:bg-[#161920]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-extrabold text-slate-900 dark:text-white">
                          {rep.id}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded border ${getStatusBadgeClasses(
                            rep.status
                          )}`}
                        >
                          {rep.status.replace(/_/g, " ")}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${getPriorityBadgeClasses(
                            rep.priority
                          )}`}
                        >
                          {rep.priority || "medium"}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(rep.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-300">
                      <span className="font-bold capitalize flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5 text-slate-400" />
                        {rep.category.replace(/_/g, " ")}
                      </span>
                      <span className="flex items-center gap-1 font-medium text-blue-700 dark:text-blue-400">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {rep.location_name}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {rep.description}
                    </p>

                    {resolvedPhotoUrl && (
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/[0.08]">
                        <img
                          src={resolvedPhotoUrl}
                          alt={`Evidence for ${rep.id}`}
                          className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-white/[0.08] shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-700 dark:text-[#E8EAEE]">
                            {isHindi ? "संलग्न फोटो साक्ष्य" : "Attached Photo Evidence"}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-[#8E939E] truncate">{rep.photo_url}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onPreviewPhoto(resolvedPhotoUrl)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 dark:bg-[#1B1D22] dark:text-[#C5C8D0] dark:hover:bg-[#9AC2FA]/10 dark:hover:text-[#9AC2FA] border border-transparent dark:border-white/[0.08] text-[11px] font-bold transition-colors shrink-0 cursor-pointer"
                          data-testid="view-evidence-btn"
                        >
                          {isHindi ? "फोटो देखें" : "View Photo"}
                        </button>
                      </div>
                    )}

                    {rep.resolution_note && (
                      <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-[#9AC2FA]/[0.06] border border-blue-200 dark:border-[#9AC2FA]/25 text-xs text-slate-800 dark:text-[#E8EAEE] flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-[#9AC2FA] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-blue-800 dark:text-[#9AC2FA] block text-[11px] uppercase tracking-wider">
                            {isHindi ? "अधिकारी समाधान टिप्पणी" : "Authority Resolution Note"}
                          </span>
                          <p className="mt-0.5">{rep.resolution_note}</p>
                        </div>
                      </div>
                    )}

                    {/* Action Footer */}
                    <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleTimeline(rep)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] text-[11px] font-semibold text-slate-700 dark:text-[#E8EAEE] hover:border-blue-400 dark:hover:border-[#9AC2FA]/50 transition-colors cursor-pointer"
                          data-testid="toggle-timeline-btn"
                        >
                          <History className="w-3 h-3 text-slate-500 dark:text-[#8E939E]" />
                          <span>{isHindi ? "गतिविधि इतिहास" : "Timeline"}</span>
                          {timelineOpen ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onShareReport(rep)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-[#1B1D22] border border-slate-200 dark:border-white/[0.10] text-[11px] font-semibold text-slate-700 dark:text-[#E8EAEE] hover:border-blue-400 dark:hover:border-[#9AC2FA]/50 transition-colors cursor-pointer"
                          data-testid="share-report-btn"
                        >
                          <Share2 className="w-3 h-3 text-blue-500 dark:text-[#9AC2FA]" />
                          <span>{isHindi ? "साझा करें" : "Share"}</span>
                        </button>
                      </div>

                      {/* Authority Triage Controls shown ONLY to Authority/Admin roles */}
                      {isAuthorityUser && onOpenResolutionAction && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenResolutionAction(rep, "verified")}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800 text-[11px] font-bold transition-colors cursor-pointer"
                            data-testid="verify-report-btn"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Verify</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenResolutionAction(rep, "in_progress")}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 text-[11px] font-bold transition-colors cursor-pointer"
                            data-testid="progress-report-btn"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>In Progress</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenResolutionAction(rep, "resolved")}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 text-[11px] font-bold transition-colors cursor-pointer"
                            data-testid="resolve-report-btn"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Resolve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenResolutionAction(rep, "dismissed")}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 text-[11px] font-bold transition-colors cursor-pointer"
                            data-testid="dismiss-report-btn"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Dismiss</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expandable Timeline Audit Trail */}
                    {timelineOpen && (
                      <div
                        className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2.5"
                        data-testid="report-activity-timeline"
                      >
                        {loadingTimelines[rep.id] ? (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Loading audit trail...</span>
                          </div>
                        ) : entries.length === 0 ? (
                          <p className="text-[11px] text-slate-400">
                            Submitted on {new Date(rep.created_at).toLocaleString()} (Unverified).
                          </p>
                        ) : (
                          entries.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start gap-2.5 text-[11px] border-l-2 border-blue-300 dark:border-blue-700 pl-2.5"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                  <span className="font-mono font-bold uppercase text-slate-800 dark:text-slate-200">
                                    {item.from_status
                                      ? `${item.from_status.replace(/_/g, " ")} -> ${item.to_status.replace(
                                          /_/g,
                                          " "
                                        )}`
                                      : item.to_status.replace(/_/g, " ")}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(item.created_at).toLocaleString([], {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                                {item.resolution_note && (
                                  <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                                    {item.resolution_note}
                                  </p>
                                )}
                                <p className="text-[10px] text-slate-400 mt-0.5 uppercase">
                                  Actor: {item.actor_role}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

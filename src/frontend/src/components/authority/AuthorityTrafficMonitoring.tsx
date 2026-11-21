import React from "react";
import { AuthorityDedicatedLiveMap } from "./AuthorityDedicatedLiveMap";
import {
  DashboardSummary,
  CitizenReport,
  IncidentItem,
} from "../../types";

interface AuthorityTrafficMonitoringProps {
  telemetryData: DashboardSummary | null;
  loading: boolean;
  reports?: CitizenReport[];
  incidents?: IncidentItem[];
  onRefresh?: () => void;
  onOpenReportDetail?: (report: CitizenReport) => void;
}

/**
 * Backward compatibility wrapper consolidating Traffic Monitoring into the dedicated Live Map command center.
 */
export const AuthorityTrafficMonitoring: React.FC<AuthorityTrafficMonitoringProps> = (props) => {
  return <AuthorityDedicatedLiveMap {...props} />;
};

export default AuthorityTrafficMonitoring;

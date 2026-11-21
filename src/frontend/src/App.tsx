import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { DashboardRedirect } from "./components/auth/DashboardRedirect";
import { AppLayout } from "./layouts/AppLayout";
import { LoadingFallback } from "./components/common/LoadingFallback";
import { lazyNamed } from "./utils/lazyImport";

// Initial Auth Entry (kept eager for instantaneous login screen render)
import { LoginPage } from "./pages/auth/LoginPage";

// Secondary Auth Pages (lazy-loaded on demand)
const RegisterPage = lazyNamed(() => import("./pages/auth/RegisterPage"), "RegisterPage");
const ForgotPasswordPage = lazyNamed(
  () => import("./pages/auth/ForgotPasswordPage"),
  "ForgotPasswordPage"
);
const ResetPasswordPage = lazyNamed(
  () => import("./pages/auth/ResetPasswordPage"),
  "ResetPasswordPage"
);

// Dashboards & Portals (lazy-loaded per role)
const CitizenDashboard = lazyNamed(
  () => import("./pages/CitizenDashboard"),
  "CitizenDashboard"
);
const OverviewDashboard = lazyNamed(
  () => import("./pages/OverviewDashboard"),
  "OverviewDashboard"
);

// Shared Pages (lazy-loaded per route)
const LiveTrafficMap = lazyNamed(() => import("./pages/LiveTrafficMap"), "LiveTrafficMap");
const RouteIntelligence = lazyNamed(
  () => import("./pages/RouteIntelligence"),
  "RouteIntelligence"
);
const TrafficAssistant = lazyNamed(() => import("./pages/TrafficAssistant"), "TrafficAssistant");
const PrivacyCenter = lazyNamed(() => import("./pages/PrivacyCenter"), "PrivacyCenter");
const Settings = lazyNamed(() => import("./pages/Settings"), "Settings");

// Admin / Authority Management Pages (lazy-loaded per route)
const TrafficPrediction = lazyNamed(
  () => import("./pages/TrafficPrediction"),
  "TrafficPrediction"
);
const FederatedLearningLab = lazyNamed(
  () => import("./pages/FederatedLearningLab"),
  "FederatedLearningLab"
);
const CommunicationOptimizer = lazyNamed(
  () => import("./pages/CommunicationOptimizer"),
  "CommunicationOptimizer"
);
const TrafficDigitalTwin = lazyNamed(
  () => import("./pages/TrafficDigitalTwin"),
  "TrafficDigitalTwin"
);
const IncidentDetection = lazyNamed(
  () => import("./pages/IncidentDetection"),
  "IncidentDetection"
);
const AnalyticsReports = lazyNamed(
  () => import("./pages/AnalyticsReports"),
  "AnalyticsReports"
);

const ComplaintsRedirect: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return user.role === "citizen" ? (
    <Navigate to="/citizen?section=complaints" replace />
  ) : (
    <Navigate to="/dashboard?section=complaints" replace />
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<LoadingFallback variant="fullscreen" label="Loading TrafficFlow AI..." />}>
              <Routes>
              {/* Public Authentication Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Protected Routes inside AppLayout */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                {/* Smart Root Index Route: Routes Citizens to /citizen and Admins to /dashboard */}
                <Route index element={<DashboardRedirect />} />

                {/* Citizen Commuter Portal (Accessible to Citizens and Admins) */}
                <Route
                  path="citizen"
                  element={
                    <ProtectedRoute allowedRoles={["citizen", "admin", "authority"]}>
                      <CitizenDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route path="citizen/complaints" element={<Navigate to="/citizen?section=complaints" replace />} />
                <Route path="complaints" element={<ComplaintsRedirect />} />

                {/* Admin Municipal Overview Dashboard (Protected for Admin/Authority only) */}
                <Route
                  path="dashboard"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "authority"]}>
                      <OverviewDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route path="live-map" element={<Navigate to="/dashboard?section=live_map" replace />} />
                <Route path="dashboard/map" element={<Navigate to="/dashboard?section=live_map" replace />} />

                {/* Shared Accessible Commuter Pages */}
                <Route path="map" element={<LiveTrafficMap />} />
                <Route path="routes" element={<RouteIntelligence />} />
                <Route path="assistant" element={<TrafficAssistant />} />
                <Route path="privacy" element={<PrivacyCenter />} />
                <Route path="settings" element={<Settings />} />

                {/* Protected Admin/Authority Only Pages */}
                <Route
                  path="prediction"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "authority"]}>
                      <TrafficPrediction />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="federated"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "authority"]}>
                      <FederatedLearningLab />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="optimizer"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "authority"]}>
                      <CommunicationOptimizer />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="digital-twin"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "authority"]}>
                      <TrafficDigitalTwin />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="incidents"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "authority"]}>
                      <IncidentDetection />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="analytics"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "authority"]}>
                      <AnalyticsReports />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-All */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;

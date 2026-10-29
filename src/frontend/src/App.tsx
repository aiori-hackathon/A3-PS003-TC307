import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { DashboardRedirect } from "./components/auth/DashboardRedirect";
import { AppLayout } from "./layouts/AppLayout";

// Auth Pages
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";

// Dashboards & Portals
import { CitizenDashboard } from "./pages/CitizenDashboard";
import { OverviewDashboard } from "./pages/OverviewDashboard";

// Shared Pages
import { LiveTrafficMap } from "./pages/LiveTrafficMap";
import { RouteIntelligence } from "./pages/RouteIntelligence";
import { TrafficAssistant } from "./pages/TrafficAssistant";
import { PrivacyCenter } from "./pages/PrivacyCenter";
import { Settings } from "./pages/Settings";

// Admin / Authority Management Pages
import { TrafficPrediction } from "./pages/TrafficPrediction";
import { FederatedLearningLab } from "./pages/FederatedLearningLab";
import { CommunicationOptimizer } from "./pages/CommunicationOptimizer";
import { TrafficDigitalTwin } from "./pages/TrafficDigitalTwin";
import { IncidentDetection } from "./pages/IncidentDetection";
import { AnalyticsReports } from "./pages/AnalyticsReports";

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
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

                {/* Admin Municipal Overview Dashboard (Protected for Admin/Authority only) */}
                <Route
                  path="dashboard"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "authority"]}>
                      <OverviewDashboard />
                    </ProtectedRoute>
                  }
                />

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
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;

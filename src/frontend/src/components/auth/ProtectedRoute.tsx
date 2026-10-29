import React from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Radio } from "lucide-react";

interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/30 flex items-center justify-center animate-pulse">
            <Radio className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        </div>
        <p className="text-sm font-semibold tracking-wide text-slate-300">
          Authenticating TrafficFL Session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Enforce role-based authorization if allowedRoles are specified
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = (user.role || "citizen").toLowerCase();
    const isAllowed = allowedRoles.some(
      (role) => role.toLowerCase() === userRole || (userRole === "admin" && role === "authority") || (userRole === "authority" && role === "admin")
    );

    if (!isAllowed) {
      // If user lacks permission:
      // Citizens are routed to their friendly citizen dashboard
      if (userRole === "citizen") {
        return <Navigate to="/citizen" replace />;
      }
      // Admins/authorities are routed to the municipal overview dashboard
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};

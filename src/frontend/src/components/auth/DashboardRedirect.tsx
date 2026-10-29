import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export const DashboardRedirect: React.FC = () => {
  const { user } = useAuth();
  const role = (user?.role || "citizen").toLowerCase();

  if (role === "citizen") {
    return <Navigate to="/citizen" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

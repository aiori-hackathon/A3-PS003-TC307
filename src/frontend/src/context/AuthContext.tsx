import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../services/api";
import { User, AuthTokenResponse } from "../types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (fullName: string, email: string, password: string, confirmPassword?: string) => Promise<void>;
  demoLogin: (role?: "authority" | "citizen") => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("trafficfl_token");
  });
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("trafficfl_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore authenticated session after refresh
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem("trafficfl_token");
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await api.getMe();
        setUser(currentUser);
        localStorage.setItem("trafficfl_user", JSON.stringify(currentUser));
      } catch (err) {
        console.warn("Session restore failed, clearing token:", err);
        localStorage.removeItem("trafficfl_token");
        localStorage.removeItem("trafficfl_user");
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleAuthSuccess = (authRes: AuthTokenResponse) => {
    setToken(authRes.access_token);
    setUser(authRes.user);
    localStorage.setItem("trafficfl_token", authRes.access_token);
    localStorage.setItem("trafficfl_user", JSON.stringify(authRes.user));
  };

  const isOfflineDemoEnabled = import.meta.env.VITE_ENABLE_OFFLINE_DEMO_LOGIN === "true";

  const login = async (email: string, password: string, rememberMe = false) => {
    setIsLoading(true);
    try {
      const authRes = await api.login(email, password, rememberMe);
      handleAuthSuccess(authRes);
    } catch (err: any) {
      // Offline fallback only when explicitly enabled via VITE_ENABLE_OFFLINE_DEMO_LOGIN
      if (isOfflineDemoEnabled) {
        const normalizedEmail = email.trim().toLowerCase();
        if (
          (normalizedEmail === "admin@trafficfl.gov.in" && (password === "TrafficFL@2026" || password === "admin" || password === "12345678")) ||
          (normalizedEmail.includes("admin") && password.length >= 5)
        ) {
          console.warn("Using offline evaluation fallback for Admin (local demo mode)");
          handleAuthSuccess({
            access_token: "offline_demo_admin_jwt_token",
            token_type: "bearer",
            user: {
              id: "usr_demo_admin",
              full_name: "Municipal Traffic Director (Demo)",
              email: "admin@trafficfl.gov.in",
              role: "admin",
              is_active: true,
              is_demo: true,
              created_at: new Date().toISOString(),
            },
          });
          return;
        } else if (
          (normalizedEmail === "citizen@trafficflow.ai" && (password === "Citizen@2026" || password === "citizen" || password === "12345678")) ||
          (normalizedEmail.includes("citizen") && password.length >= 5)
        ) {
          console.warn("Using offline evaluation fallback for Citizen (local demo mode)");
          handleAuthSuccess({
            access_token: "offline_demo_citizen_jwt_token",
            token_type: "bearer",
            user: {
              id: "usr_demo_citizen",
              full_name: "Smart City Resident",
              email: "citizen@trafficflow.ai",
              role: "citizen",
              is_active: true,
              is_demo: true,
              created_at: new Date().toISOString(),
            },
          });
          return;
        }
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (fullName: string, email: string, password: string, confirmPassword?: string) => {
    setIsLoading(true);
    try {
      const authRes = await api.register(fullName, email, password, confirmPassword);
      handleAuthSuccess(authRes);
    } catch (err: any) {
      if (isOfflineDemoEnabled && (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError"))) {
        console.warn("Using offline registration fallback (local demo mode)");
        handleAuthSuccess({
          access_token: "offline_new_citizen_token",
          token_type: "bearer",
          user: {
            id: `usr_${Date.now().toString(36)}`,
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            role: "citizen",
            is_active: true,
            is_demo: false,
            created_at: new Date().toISOString(),
          },
        });
        return;
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const demoLogin = async (role: "authority" | "citizen" = "authority") => {
    setIsLoading(true);
    try {
      const authRes = await api.demoLogin(role);
      handleAuthSuccess(authRes);
    } catch (err: any) {
      if (isOfflineDemoEnabled) {
        console.warn("Backend demo login failed, using resilient offline session (local demo mode):", err);
        const isAuth = role === "authority";
        handleAuthSuccess({
          access_token: isAuth ? "offline_demo_admin_jwt_token" : "offline_demo_citizen_jwt_token",
          token_type: "bearer",
          user: {
            id: isAuth ? "usr_demo_admin" : "usr_demo_citizen",
            full_name: isAuth ? "Municipal Traffic Director (Demo)" : "Smart City Resident",
            email: isAuth ? "admin@trafficfl.gov.in" : "citizen@trafficflow.ai",
            role: isAuth ? "admin" : "citizen",
            is_active: true,
            is_demo: true,
            created_at: new Date().toISOString(),
          },
        });
        return;
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout().catch(() => {});
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem("trafficfl_token");
      localStorage.removeItem("trafficfl_user");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        demoLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

import React, { useState, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/layout/Sidebar";
import { Navbar } from "../components/layout/Navbar";
import { FloatingChatbot } from "../components/chatbot/FloatingChatbot";
import { LoadingFallback } from "../components/common/LoadingFallback";

export const AppLayout: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090A0D] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 relative overflow-x-clip">
      {/* Ambient obsidian radial depth (dark mode only) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 hidden dark:block"
        style={{
          background:
            "radial-gradient(circle at 22% 18%, rgba(30, 48, 84, 0.22), transparent 46%), radial-gradient(circle at 82% 85%, rgba(20, 32, 58, 0.16), transparent 44%)",
        }}
      />

      {/* Sidebar */}
      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Top Navbar */}
      <Navbar
        onMenuClick={() => setMobileOpen(true)}
        isCollapsed={isCollapsed}
      />

      {/* Main Content Area */}
      <main
        className={`relative z-10 flex-1 p-4 sm:p-6 lg:p-8 transition-all duration-300
          ${isCollapsed ? "lg:ml-20" : "lg:ml-64"}
        `}
      >
        <div className="max-w-7xl mx-auto space-y-6">
          <Suspense fallback={<LoadingFallback variant="page" label="Loading module..." />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Floating TrafficBot Assistant */}
      <FloatingChatbot />
    </div>
  );
};

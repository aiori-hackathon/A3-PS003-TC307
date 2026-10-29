import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/layout/Sidebar";
import { Navbar } from "../components/layout/Navbar";
import { FloatingChatbot } from "../components/chatbot/FloatingChatbot";

export const AppLayout: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
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
        className={`flex-1 p-4 sm:p-6 lg:p-8 transition-all duration-300
          ${isCollapsed ? "lg:ml-20" : "lg:ml-64"}
        `}
      >
        <div className="max-w-7xl mx-auto space-y-6">
          <Outlet />
        </div>
      </main>

      {/* Floating TrafficBot Assistant */}
      <FloatingChatbot />
    </div>
  );
};

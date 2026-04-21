import React, { lazy, Suspense, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Shell from "./components/layout/Shell";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

const CashFlowPage = lazy(() => import("./modules/cashflow/CashFlowPage"));
const CalendarPage = lazy(() => import("./modules/calendar/CalendarPage"));
const FitnessPage  = lazy(() => import("./modules/fitness/FitnessPage"));
const FilesPage    = lazy(() => import("./modules/files/FilesPage"));
const SettingsPage = lazy(() => import("./modules/settings/SettingsPage"));

function PageLoader() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100%", color: "rgba(255,255,255,0.25)",
      fontFamily: "var(--font)", fontSize: 13, letterSpacing: "0.5px",
    }}>
      <span style={{ animation: "breathe 1.4s ease-in-out infinite" }}>···</span>
    </div>
  );
}

export default function App() {
  const [dailyData, setDailyData] = useState({});

  const handleCashFlowData = useCallback((d) => {
    setDailyData(prev => ({ ...prev, ...d }));
  }, []);

  return (
    <BrowserRouter>
      <Shell dailyData={dailyData}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={
              <ErrorBoundary><CashFlowPage onDataReady={handleCashFlowData}/></ErrorBoundary>
            }/>
            <Route path="/cashflow" element={
              <ErrorBoundary><CashFlowPage onDataReady={handleCashFlowData}/></ErrorBoundary>
            }/>
            <Route path="/calendar" element={
              <ErrorBoundary><CalendarPage/></ErrorBoundary>
            }/>
            <Route path="/fitness" element={
              <ErrorBoundary><FitnessPage/></ErrorBoundary>
            }/>
            <Route path="/files" element={
              <ErrorBoundary><FilesPage/></ErrorBoundary>
            }/>
            <Route path="/settings" element={
              <ErrorBoundary><SettingsPage/></ErrorBoundary>
            }/>
          </Routes>
        </Suspense>
      </Shell>
    </BrowserRouter>
  );
}

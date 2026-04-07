import React, { useState, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Shell from "./components/layout/Shell";
import CashFlowPage  from "./modules/cashflow/CashFlowPage";
import CalendarPage  from "./modules/calendar/CalendarPage";
import FitnessPage   from "./modules/fitness/FitnessPage";
import FilesPage     from "./modules/files/FilesPage";
import SettingsPage  from "./modules/settings/SettingsPage";
import "./index.css";

export default function App() {
  const [dailyData, setDailyData] = useState({});

  const handleCashFlowData = useCallback((d) => {
    setDailyData(prev => ({ ...prev, ...d }));
  }, []);

  return (
    <BrowserRouter>
      <Shell dailyData={dailyData}>
        <Routes>
          <Route path="/"         element={<CashFlowPage onDataReady={handleCashFlowData}/>}/>
          <Route path="/cashflow" element={<CashFlowPage onDataReady={handleCashFlowData}/>}/>
          <Route path="/calendar" element={<CalendarPage/>}/>
          <Route path="/fitness"  element={<FitnessPage/>}/>
          <Route path="/files"    element={<FilesPage/>}/>
          <Route path="/settings" element={<SettingsPage/>}/>
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}

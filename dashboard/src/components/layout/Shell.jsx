import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import CommandPanel from "./CommandPanel";
import BottomNav from "./BottomNav";

const BG_MAP = {
  "/":         "bg-cashflow",
  "/cashflow": "bg-cashflow",
  "/calendar": "bg-calendar",
  "/fitness":  "bg-fitness",
  "/files":    "bg-files",
};

export default function Shell({ children, dailyData }) {
  const location = useLocation();
  const [bgClass, setBgClass] = useState("bg-cashflow");

  useEffect(() => {
    const key = Object.keys(BG_MAP).find(k =>
      location.pathname === k || location.pathname.startsWith(k + "/")
    );
    setBgClass(BG_MAP[key] || "bg-cashflow");
  }, [location.pathname]);

  return (
    <>
      <style>{`
        html, body, #root {
          width: 100%; max-width: 100vw;
          overflow-x: hidden;
        }
        .jarvis-shell {
          width: 100vw; max-width: 100vw;
          height: 100dvh;
          display: grid;
          grid-template-columns: var(--sidebar-w) 1fr var(--command-w);
          grid-template-rows: 1fr auto;
          grid-template-areas:
            "sidebar main command"
            "nav     nav  nav";
          gap: var(--col-gap);
          padding: var(--pad);
          padding-bottom: 0;
          position: relative;
          overflow: hidden;
          transition: background 0.6s ease;
          box-sizing: border-box;
        }
        .jarvis-sidebar {
          grid-area: sidebar;
          overflow-y: auto; overflow-x: hidden;
          min-height: 0; min-width: 0;
        }
        .jarvis-main {
          grid-area: main;
          overflow-y: auto; overflow-x: hidden;
          min-height: 0; min-width: 0;
          display: flex; flex-direction: column;
        }
        .jarvis-command {
          grid-area: command;
          overflow-y: auto; overflow-x: hidden;
          min-height: 0; min-width: 0;
        }
        .jarvis-nav {
          grid-area: nav;
          display: flex; justify-content: center;
          padding-bottom: 8px; flex-shrink: 0;
          overflow: hidden;
        }
        @media (max-width: 768px) {
          .jarvis-shell {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr auto;
            grid-template-areas:
              "main"
              "nav";
            padding: 12px 12px 0;
          }
          .jarvis-sidebar  { display: none !important; }
          .jarvis-command  { display: none !important; }
          .jarvis-main     { padding-bottom: 4px; }
        }
      `}</style>

      <div className={`jarvis-shell ${bgClass}`}>
        <div className="jarvis-sidebar"><Sidebar dailyData={dailyData} /></div>
        <main className="jarvis-main">{children}</main>
        <div className="jarvis-command"><CommandPanel /></div>
        <div className="jarvis-nav"><BottomNav /></div>
      </div>
    </>
  );
}

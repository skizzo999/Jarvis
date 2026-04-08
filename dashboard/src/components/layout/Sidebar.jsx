import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const API_URL = "https://api.matteolizzo.it";

const ROTATION = ["A","C","B","riposo"];
const BASE_DATE = new Date("2026-04-07T00:00:00");

function getDayLabel() {
  const labels = { A:"Giorno A", B:"Giorno B", C:"Giorno C", riposo:"Riposo" };
  const diff = Math.floor((Date.now() - BASE_DATE.getTime()) / 86400000);
  const key = ROTATION[((diff % ROTATION.length) + ROTATION.length) % ROTATION.length];
  return labels[key] || "—";
}

function getNextEvent(events) {
  if (!events || events.length === 0) return null;
  const now = new Date();
  const upcoming = events
    .map(e => ({ ...e, dt: new Date(e.start || e.dt || e.dtstart) }))
    .filter(e => !isNaN(e.dt) && e.dt >= now)
    .sort((a, b) => a.dt - b.dt);
  if (!upcoming.length) return null;
  const e = upcoming[0];
  const day = e.dt.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
  const time = e.dt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return `${e.title || e.summary} — ${day} ${time}`;
}

export default function Sidebar({ dailyData }) {
  const [serverStatus, setServerStatus] = useState({ online: false, ram: null, battery: null });
  const [nextEvent, setNextEvent] = useState("—");
  const location = useLocation();

  useEffect(() => {
    const fetchServer = async () => {
      try {
        const r = await fetch(`${API_URL}/server/status`);
        if (r.ok) setServerStatus({ online: true, ...(await r.json()) });
      } catch { setServerStatus(s => ({ ...s, online: false })); }
    };
    fetchServer();
    const id = setInterval(fetchServer, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const r = await fetch(`${API_URL}/events/list`);
        if (r.ok) {
          const data = await r.json();
          const label = getNextEvent(data);
          setNextEvent(label || "Nessun evento");
        }
      } catch { setNextEvent("—"); }
    };
    fetchEvents();
  }, []);

  const s = (label, val) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
      <span style={{ fontSize:12, color:"var(--muted)", fontFamily:"var(--font)" }}>{label}</span>
      <span style={{ fontSize:12, fontWeight:600, color:"var(--text)", fontFamily:"var(--font)" }}>{val}</span>
    </div>
  );

  const bar = (val, color) => (
    <div style={{ height:3, borderRadius:3, background:"rgba(255,255,255,0.1)", margin:"4px 0 10px", overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${val}%`, background:color, borderRadius:3, transition:"width 0.5s ease" }}/>
    </div>
  );

  return (
    <aside style={{ display:"flex", flexDirection:"column", gap:12, position:"relative", zIndex:1 }}>

      {/* Server status */}
      <div className="glass" style={{ padding:"20px 18px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <div style={{
            width:7, height:7, borderRadius:"50%",
            background: serverStatus.online ? "var(--green)" : "var(--red)",
            boxShadow: serverStatus.online ? "0 0 8px rgba(52,211,153,0.7)" : "none",
            animation: serverStatus.online ? "breathe 2.5s ease-in-out infinite" : "none",
          }}/>
          <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.8px", textTransform:"uppercase", color:"var(--muted)", fontFamily:"var(--font)" }}>
            {serverStatus.online ? "Server Online" : "Server Offline"}
          </span>
        </div>
        {serverStatus.ram != null && (<>{s("RAM", `${serverStatus.ram}%`)}{bar(serverStatus.ram, "var(--blue)")}</>)}
        {serverStatus.battery != null && (<>{s("Batteria", `${serverStatus.battery}%`)}{bar(serverStatus.battery, serverStatus.battery > 20 ? "var(--green)" : "var(--red)")}</>)}
        {s("CPU", serverStatus.cpu != null ? `${serverStatus.cpu}%` : "—")}
        {serverStatus.cpu != null && bar(serverStatus.cpu, "var(--purple)")}
      </div>

      {/* Riepilogo giornaliero */}
      <div className="glass" style={{ padding:"20px 18px", flex:1 }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.8px", textTransform:"uppercase", color:"var(--muted)", marginBottom:14, fontFamily:"var(--font)" }}>
          Oggi
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {[
            { icon:"💰", label:"Saldo", val: dailyData?.saldo != null ? `€${Number(dailyData.saldo).toLocaleString("it-IT",{minimumFractionDigits:0})}` : "—" },
            { icon:"📅", label:"Prossimo", val: nextEvent },
            { icon:"💪", label:"Allenamento", val: getDayLabel() },
          ].map(({icon, label, val}) => (
            <div key={label} style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
              <span style={{ fontSize:15, marginTop:1 }}>{icon}</span>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--font)" }}>{label}</div>
                <div style={{ fontSize:12, fontWeight:600, color:"var(--text)", fontFamily:"var(--font)", marginTop:1, wordBreak:"break-word", lineHeight:1.4 }}>{val}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

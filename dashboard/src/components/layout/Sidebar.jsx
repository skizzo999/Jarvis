import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const API_URL = "https://api.matteolizzo.it";

const WORKOUT_ROTATION = ["A","C","B","riposo","A","C","B"];

function getDayLabel() {
  const labels = { A:"Giorno A", B:"Giorno B", C:"Giorno C", riposo:"Riposo" };
  const start = new Date("2026-04-07");
  const today = new Date();
  const diff = Math.floor((today - start) / 86400000);
  const idx = ((diff % WORKOUT_ROTATION.length) + WORKOUT_ROTATION.length) % WORKOUT_ROTATION.length;
  return labels[WORKOUT_ROTATION[idx]] || "—";
}

export default function Sidebar({ dailyData }) {
  const [serverStatus, setServerStatus] = useState({ online: false, ram: null, battery: null });
  const location = useLocation();

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const r = await fetch(`${API_URL}/server/status`);
        if (r.ok) setServerStatus({ online: true, ...(await r.json()) });
      } catch { setServerStatus(s => ({ ...s, online: false })); }
    };
    fetch_();
    const id = setInterval(fetch_, 30000);
    return () => clearInterval(id);
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

        {serverStatus.ram != null && (
          <>
            {s("RAM", `${serverStatus.ram}%`)}
            {bar(serverStatus.ram, "var(--blue)")}
          </>
        )}
        {serverStatus.battery != null && (
          <>
            {s("Batteria", `${serverStatus.battery}%`)}
            {bar(serverStatus.battery, serverStatus.battery > 20 ? "var(--green)" : "var(--red)")}
          </>
        )}
        {s("CPU", serverStatus.cpu != null ? `${serverStatus.cpu}%` : "—")}
        {serverStatus.cpu != null && bar(serverStatus.cpu, "var(--purple)")}
      </div>

      {/* Riepilogo giornaliero */}
      <div className="glass" style={{ padding:"20px 18px", flex:1 }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.8px", textTransform:"uppercase", color:"var(--muted)", marginBottom:14, fontFamily:"var(--font)" }}>
          Oggi
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[
            { icon:"💰", label:"Saldo", val: dailyData?.saldo != null ? `€${Number(dailyData.saldo).toLocaleString("it-IT",{minimumFractionDigits:0})}` : "—" },
            { icon:"📅", label:"Prossimo", val: dailyData?.nextEvent || "—" },
            { icon:"💪", label:"Allenamento", val: getDayLabel() },
          ].map(({icon, label, val}) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:15 }}>{icon}</span>
              <div>
                <div style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--font)" }}>{label}</div>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", fontFamily:"var(--font)", marginTop:1 }}>{val}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

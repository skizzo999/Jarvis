import React, { useState, useEffect } from "react";

const API_URL = "/api";

export default function CalendarPage() {
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showPast, setShowPast]   = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/events/list`);
      const d = await r.json();
      setEvents(d.sort((a,b) => new Date(a.start) - new Date(b.start)));
    } catch { setError("Errore caricamento eventi"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const on = () => load();
    window.addEventListener("jarvis:event.created", on);
    window.addEventListener("jarvis:event.deleted", on);
    window.addEventListener("jarvis:reminder.created", on);
    return () => {
      window.removeEventListener("jarvis:event.created", on);
      window.removeEventListener("jarvis:event.deleted", on);
      window.removeEventListener("jarvis:reminder.created", on);
    };
  }, []);

  const deleteEvent = async (uid) => {
    try {
      await fetch(`${API_URL}/events/${uid}`, { method:"DELETE" });
      setEvents(ev => ev.filter(e => e.uid !== uid));
    } catch { alert("Errore eliminazione"); }
  };

  const today = new Date().toISOString().slice(0,10);
  const now   = new Date();

  const visibleEvents = events.filter(ev => {
    if (showPast) return true;
    // Mostra eventi di oggi e futuri
    const evDate = ev.start?.slice(0,10) || "9999";
    return evDate >= today;
  });

  const pastCount = events.filter(ev => {
    const evDate = ev.start?.slice(0,10) || "9999";
    return evDate < today;
  }).length;

  const grouped = visibleEvents.reduce((acc, ev) => {
    const date = ev.start?.slice(0,10) || "senza data";
    if (!acc[date]) acc[date] = [];
    acc[date].push(ev);
    return acc;
  }, {});

  const fmtDate = (d) => {
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("it-IT", { weekday:"long", day:"numeric", month:"long" });
  };

  const fmtTime = (dt) => {
    if (!dt) return "";
    const d = new Date(dt);
    return d.toLocaleTimeString("it-IT", { hour:"2-digit", minute:"2-digit" });
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, height:"100%", minHeight:0 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"var(--font-serif)", fontStyle:"italic", fontSize:22, color:"var(--text)" }}>
            Calen<span style={{ color:"var(--calendar-accent)" }}>dario</span>
          </div>
          <div style={{ fontSize:10, color:"var(--muted)", marginTop:2 }}>
            {visibleEvents.length} eventi{showPast ? " totali" : " in arrivo"}
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button
            onClick={() => setShowPast(p => !p)}
            style={{
              background: showPast ? "rgba(99,179,237,0.15)" : "var(--glass-bg)",
              border: showPast ? "1px solid rgba(99,179,237,0.4)" : "1px solid var(--glass-border)",
              borderRadius:10, padding:"6px 14px",
              color: showPast ? "var(--calendar-accent)" : "var(--muted)",
              fontSize:11, fontFamily:"var(--font)", cursor:"pointer",
              transition:"all 0.2s",
            }}
          >
            {showPast ? "◀ Solo futuri" : pastCount > 0 ? `⏮ Passati (${pastCount})` : "⏮ Passati"}
          </button>
          <button onClick={load} style={{ background:"var(--glass-bg)", border:"1px solid var(--glass-border)", borderRadius:10, padding:"6px 14px", color:"var(--muted)", fontSize:11, fontFamily:"var(--font)", cursor:"pointer" }}>
            ↻ Aggiorna
          </button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:16 }}>
        {loading && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"var(--muted)", fontSize:13, fontFamily:"var(--font)" }}>
            Caricamento...
          </div>
        )}
        {error && (
          <div style={{ color:"var(--red)", fontSize:13, fontFamily:"var(--font)", padding:16 }}>{error}</div>
        )}
        {!loading && !error && visibleEvents.length === 0 && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:8 }}>
            <span style={{ fontSize:32 }}>📅</span>
            <span style={{ fontSize:13, color:"var(--muted)", fontFamily:"var(--font)" }}>Nessun evento in programma</span>
          </div>
        )}
        {Object.entries(grouped).map(([date, evs]) => {
          const isPast = date < today;
          return (
            <div key={date} style={{ opacity: isPast ? 0.5 : 1, transition:"opacity 0.2s" }}>
              <div style={{ fontSize:11, fontWeight:700, color: date===today ? "var(--calendar-accent)" : isPast ? "var(--muted)" : "var(--muted)", fontFamily:"var(--font)", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:8 }}>
                {date===today ? "🔵 Oggi — " : isPast ? "◷ " : ""}{fmtDate(date)}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {evs.map(ev => (
                  <div key={ev.uid} className="glass" style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px" }}>
                    <div style={{ width:3, height:36, borderRadius:3, background: isPast ? "var(--muted)" : "var(--calendar-accent)", flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", fontFamily:"var(--font)" }}>{ev.title}</div>
                      {ev.start && (
                        <div style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--font)", marginTop:2 }}>
                          {fmtTime(ev.start)}{ev.end ? ` → ${fmtTime(ev.end)}` : ""}
                          {ev.description ? ` · ${ev.description}` : ""}
                        </div>
                      )}
                    </div>
                    <button onClick={() => deleteEvent(ev.uid)} title="Elimina" style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:8, padding:"4px 10px", color:"var(--red)", fontSize:11, cursor:"pointer", fontFamily:"var(--font)", flexShrink:0 }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";

const API_URL = "/api";

const ACCENT = "var(--settings-accent, #f472b6)";

function Section({ title, children }) {
  return (
    <div className="glass" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", fontFamily: "var(--font)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: accent ? ACCENT : "var(--text)", fontFamily: "var(--font)" }}>
        {value}
      </span>
    </div>
  );
}

function StatusDot({ ok }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: ok ? "#34d399" : "#f87171",
      boxShadow: ok ? "0 0 6px #34d399" : "0 0 6px #f87171",
      marginRight: 6,
    }} />
  );
}

export default function SettingsPage() {
  const [health, setHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const r = await fetch(`${API_URL}/health`);
      const d = await r.json();
      setHealth(d);
    } catch {
      setHealth({ status: "error", checks: {} });
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => { void fetchHealth(); }, []);

  const FITNESS_TARGETS = [
    { label: "Calorie target", value: "2330 kcal" },
    { label: "Proteine", value: "160 g" },
    { label: "Carboidrati", value: "265 g" },
    { label: "Grassi", value: "70 g" },
    { label: "Peso target", value: "77 kg" },
  ];

  const SCHEDA_INFO = [
    { day: "Giorno A", muscles: "Petto + Schiena" },
    { day: "Giorno B", muscles: "Spalle + Bicipiti + Tricipiti" },
    { day: "Giorno C", muscles: "Gambe + Core" },
    { day: "Riposo", muscles: "—" },
  ];

  const SCHEDULER_INFO = [
    { label: "Briefing mattutino", value: "07:00" },
    { label: "Recap serale", value: "23:00" },
    { label: "Check promemoria", value: "ogni minuto" },
    { label: "Timezone", value: "Europe/Rome" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0, overflowY: "auto" }}>

      {/* Header */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, color: "var(--text)" }}>
          Impo<span style={{ color: ACCENT }}>stazioni</span>
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, fontFamily: "var(--font)" }}>
          Configurazione attuale del sistema
        </div>
      </div>

      {/* Stato sistema */}
      <Section title="Stato sistema">
        {loadingHealth ? (
          <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font)" }}>Verifica...</div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font)" }}>Backend</span>
              <span style={{ fontSize: 12, fontFamily: "var(--font)" }}>
                <StatusDot ok={health?.status === "ok"} />
                <span style={{ color: health?.status === "ok" ? "#34d399" : "#f87171", fontWeight: 600 }}>
                  {health?.status === "ok" ? "Online" : health?.status === "degraded" ? "Degradato" : "Offline"}
                </span>
              </span>
            </div>
            {health?.checks && Object.entries(health.checks).map(([k, v]) => (
              <Row key={k} label={`  ↳ ${k}`} value={v === "ok" ? "✓" : v} accent={v !== "ok"} />
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font)" }}> </span>
              <button
                onClick={() => void fetchHealth()}
                style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, padding: "4px 12px", color: "var(--muted)",
                  fontSize: 10, cursor: "pointer", fontFamily: "var(--font)",
                }}
              >
                ↻ Aggiorna
              </button>
            </div>
          </>
        )}
        <Row label="Versione API" value="2.0" />
        <Row label="Porta backend" value="8000" />
      </Section>

      {/* Scheduler */}
      <Section title="Scheduler automatico">
        {SCHEDULER_INFO.map(({ label, value }) => (
          <Row key={label} label={label} value={value} />
        ))}
      </Section>

      {/* Fitness targets */}
      <Section title="Target fitness">
        {FITNESS_TARGETS.map(({ label, value }) => (
          <Row key={label} label={label} value={value} />
        ))}
      </Section>

      {/* Scheda allenamento */}
      <Section title="Rotazione scheda">
        <Row label="Data inizio ciclo" value="07/04/2026" />
        <Row label="Rotazione" value="A → C → B → Riposo" />
        <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 6 }}>
          {SCHEDA_INFO.map(({ day, muscles }) => (
            <div key={day} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", fontFamily: "var(--font)" }}>{day}</span>
              <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font)" }}>{muscles}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Storage */}
      <Section title="Storage">
        <Row label="Percorso" value="/home/matteo/Jarvis/storage" />
        <Row label="Timeout classificazione" value="5 secondi" />
      </Section>

      {/* Info */}
      <Section title="Informazioni">
        <Row label="Modello AI" value="Claude Haiku 4.5" />
        <Row label="Calendario" value="Radicale CalDAV" />
        <Row label="Database" value="SQLite" />
        <Row label="Orchestratore" value="n8n (porta 5678)" />
      </Section>

    </div>
  );
}

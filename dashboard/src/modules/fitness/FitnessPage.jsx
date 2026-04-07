import React, { useState, useEffect } from "react";
import RingProgress from "../../components/ui/RingProgress";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const API_URL = "https://api.matteolizzo.it";

// ── Dati scheda allenamento ──────────────────────────────────────────────────
const SCHEDA = {
  A: {
    label: "Giorno A — Petto / Tricipiti / Spalle",
    color: "#818cf8",
    exercises: [
      "Panca piana",
      "Panca inclinata manubri",
      "Croci cavi",
      "French press",
      "Pushdown cavo",
      "Lento avanti manubri",
      "Alzate laterali",
    ],
  },
  B: {
    label: "Giorno B — Schiena / Bicipiti",
    color: "#34d399",
    exercises: [
      "Trazioni",
      "Lat machine",
      "Rematore bilanciere",
      "Rematore manubrio",
      "Curl bilanciere",
      "Curl martello",
      "Facepull",
    ],
  },
  C: {
    label: "Giorno C — Gambe / Glutei",
    color: "#fbbf24",
    exercises: [
      "Squat",
      "Leg press",
      "Affondi",
      "Leg curl",
      "Leg extension",
      "Calf raises",
      "Hip thrust",
    ],
  },
};

const ROTATION = ["A", "C", "B", "riposo"];
const BASE_DATE = new Date("2026-04-07T00:00:00");

function getTodayWorkout() {
  const delta = Math.floor((Date.now() - BASE_DATE.getTime()) / 86400000);
  if (delta < 0) return "riposo";
  return ROTATION[delta % 4];
}

// ── Componente accordion singolo giorno ──────────────────────────────────────
function WorkoutCard({ dayKey, lastWeights, isToday }) {
  const [open, setOpen] = useState(isToday);
  const day = SCHEDA[dayKey];
  if (!day) return null;

  return (
    <div className="glass" style={{ overflow: "hidden" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "14px 16px",
          background: "none", border: "none", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: day.color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", fontFamily: "var(--font)" }}>
            {day.label}
          </span>
          {isToday && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.6px",
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 6, padding: "2px 7px", color: day.color,
              fontFamily: "var(--font)", textTransform: "uppercase",
            }}>oggi</span>
          )}
        </div>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          {day.exercises.map(ex => {
            const key = ex.toLowerCase();
            const last = lastWeights[key];
            return (
              <div key={ex} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <span style={{ fontSize: 12, color: "var(--text)", fontFamily: "var(--font)" }}>{ex}</span>
                {last ? (
                  <span style={{ fontSize: 11, color: day.color, fontFamily: "var(--font)", fontWeight: 600 }}>
                    {last.weight_kg}kg × {last.reps ?? "?"} × {last.sets ?? "?"}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font)" }}>—</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Barra macro ──────────────────────────────────────────────────────────────
function MacroBar({ label, current, target, color }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font)" }}>{label}</span>
        <span style={{ fontSize: 11, color: "var(--text)", fontFamily: "var(--font)" }}>
          {current}g <span style={{ color: "var(--muted)" }}>/ {target}g</span>
        </span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: color, borderRadius: 10,
          transition: "width 0.6s ease",
          boxShadow: `0 0 8px ${color}80`,
        }} />
      </div>
    </div>
  );
}

// ── Pagina principale ────────────────────────────────────────────────────────
export default function FitnessPage() {
  const [lastWeights, setLastWeights] = useState({});
  const [weightHistory, setWeightHistory] = useState([]);
  const todayWorkout = getTodayWorkout();

  useEffect(() => {
    // Carica ultimi pesi
    fetch(`${API_URL}/fitness/last`)
      .then(r => r.json())
      .then(data => {
        const map = {};
        data.forEach(d => { map[d.exercise.toLowerCase()] = d; });
        setLastWeights(map);
      })
      .catch(() => {});

    // Placeholder dati peso corporeo
    setWeightHistory([
      { date: "01/03", kg: 79.2 },
      { date: "08/03", kg: 78.8 },
      { date: "15/03", kg: 78.5 },
      { date: "22/03", kg: 78.1 },
      { date: "29/03", kg: 78.0 },
      { date: "05/04", kg: 77.8 },
    ]);
  }, []);

  // Macro placeholder (0 finché non c'è il tracker cibo)
  const macros = { kcal: 0, proteine: 0, carbo: 0, grassi: 0 };
  const targets = { kcal: 2330, proteine: 160, carbo: 265, grassi: 70 };

  const rings = [
    { pct: Math.round((macros.kcal / targets.kcal) * 100), color: "#34d399", label: "Kcal" },
    { pct: Math.round((macros.proteine / targets.proteine) * 100), color: "#60a5fa", label: "Proteine" },
    { pct: Math.round((macros.carbo / targets.carbo) * 100), color: "#fbbf24", label: "Carbo" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0, overflowY: "auto" }}>

      {/* Header */}
      <div>
        <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, color: "var(--text)" }}>
          Fit<span style={{ color: "var(--fitness-accent)" }}>ness</span>
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
          {todayWorkout === "riposo"
            ? "Oggi: giorno di riposo"
            : `Oggi: Giorno ${todayWorkout} — ${SCHEDA[todayWorkout]?.label.split("—")[1]?.trim()}`}
        </div>
      </div>

      {/* Anelli macro + macro bar */}
      <div className="glass" style={{ padding: 16, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <RingProgress rings={rings} size={100} />
        <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 10 }}>
          <MacroBar label="Proteine" current={macros.proteine} target={targets.proteine} color="#60a5fa" />
          <MacroBar label="Carboidrati" current={macros.carbo} target={targets.carbo} color="#fbbf24" />
          <MacroBar label="Grassi" current={macros.grassi} target={targets.grassi} color="#f87171" />
          <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font)", marginTop: 2 }}>
            Tracker cibo disponibile con Modulo 3
          </div>
        </div>
      </div>

      {/* Schede allenamento */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {["A", "C", "B"].map(day => (
          <WorkoutCard
            key={day}
            dayKey={day}
            lastWeights={lastWeights}
            isToday={todayWorkout === day}
          />
        ))}
        {todayWorkout === "riposo" && (
          <div className="glass" style={{ padding: "12px 16px", fontSize: 12, color: "var(--muted)", fontFamily: "var(--font)", textAlign: "center" }}>
            💤 Oggi è previsto riposo — buon recupero!
          </div>
        )}
      </div>

      {/* Grafico peso corporeo */}
      <div className="glass" style={{ padding: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12, fontFamily: "var(--font)" }}>
          Peso corporeo
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={weightHistory}>
            <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={["auto", "auto"]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={{ background: "rgba(10,10,30,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: "rgba(255,255,255,0.5)" }}
              itemStyle={{ color: "#34d399" }}
            />
            <Line type="monotone" dataKey="kg" stroke="#34d399" strokeWidth={2} dot={{ fill: "#34d399", r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

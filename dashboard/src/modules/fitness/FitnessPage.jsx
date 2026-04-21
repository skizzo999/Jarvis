import React, { useState, useEffect } from "react";
import RingProgress from "../../components/ui/RingProgress";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const API_URL = "/api";

const SCHEDA = {
  A: {
    label: "Giorno A — Petto + Schiena",
    color: "#818cf8",
    exercises: [
      { nome: "Panca piana con bilanciere",   serie: 4, rip: 8,    rec: "2 min",  dbKey: "panca piana con bilanciere" },
      { nome: "Rematore con bilanciere",      serie: 4, rip: 8,    rec: "2 min",  dbKey: "rematore con bilanciere" },
      { nome: "Panca inclinata manubri",      serie: 3, rip: 10,   rec: "90 sec", dbKey: "panca inclinata manubri" },
      { nome: "Lat machine presa larga",      serie: 3, rip: 10,   rec: "90 sec", dbKey: "lat machine presa larga" },
      { nome: "Croci ai cavi (Cable Fly)",    serie: 3, rip: 12,   rec: "60 sec", dbKey: "croci ai cavi" },
      { nome: "Pulley basso (Seated Row)",    serie: 3, rip: 12,   rec: "60 sec", dbKey: "pulley basso" },
    ],
  },
  B: {
    label: "Giorno B — Spalle + Bicipiti + Tricipiti",
    color: "#34d399",
    exercises: [
      { nome: "Lento avanti con bilanciere",  serie: 4, rip: 8,    rec: "2 min",  dbKey: "lento avanti con bilanciere" },
      { nome: "Alzate laterali manubri",      serie: 3, rip: 12,   rec: "60 sec", dbKey: "alzate laterali manubri" },
      { nome: "Curl bilanciere",              serie: 3, rip: 10,   rec: "90 sec", dbKey: "curl bilanciere" },
      { nome: "Push down ai cavi (corda)",    serie: 3, rip: 10,   rec: "90 sec", dbKey: "push down ai cavi" },
      { nome: "Curl manubri Hammer",          serie: 3, rip: 12,   rec: "60 sec", dbKey: "curl manubri hammer" },
      { nome: "French press / Skull Crusher", serie: 3, rip: 12,   rec: "60 sec", dbKey: "french press" },
    ],
  },
  C: {
    label: "Giorno C — Gambe + Core",
    color: "#fbbf24",
    exercises: [
      { nome: "Squat con bilanciere",         serie: 4, rip: 8,    rec: "2 min",  dbKey: "squat con bilanciere" },
      { nome: "Leg Press",                    serie: 3, rip: 10,   rec: "90 sec", dbKey: "leg press" },
      { nome: "Leg Curl (femorali)",          serie: 3, rip: 12,   rec: "60 sec", dbKey: "leg curl" },
      { nome: "Leg Extension (quadricipiti)", serie: 3, rip: 12,   rec: "60 sec", dbKey: "leg extension" },
      { nome: "Calf raises",                  serie: 4, rip: 15,   rec: "60 sec", dbKey: "calf raises" },
      { nome: "Plank",                        serie: 3, rip: "45s", rec: "60 sec", dbKey: "plank" },
      { nome: "Crunch / Ab Wheel",            serie: 3, rip: 15,   rec: "60 sec", dbKey: "crunch" },
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

function WorkoutCard({ dayKey, lastWeights, isToday }) {
  const [open, setOpen] = useState(isToday);
  const day = SCHEDA[dayKey];
  if (!day) return null;

  return (
    <div className="glass" style={{ overflow:"hidden" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 16px", background:"none", border:"none", cursor:"pointer",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:day.color, flexShrink:0 }}/>
          <span style={{ fontSize:13, fontWeight:600, color:"var(--text)", fontFamily:"var(--font)" }}>{day.label}</span>
          {isToday && (
            <span style={{
              fontSize:9, fontWeight:700, letterSpacing:"0.6px",
              background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)",
              borderRadius:6, padding:"2px 7px", color:day.color,
              fontFamily:"var(--font)", textTransform:"uppercase",
            }}>oggi</span>
          )}
        </div>
        <span style={{ color:"var(--muted)", fontSize:12 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding:"0 16px 14px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 60px 70px", gap:6, marginBottom:6, padding:"0 4px" }}>
            {["Esercizio","Ser×Rip","Rec","Ultimo"].map(h => (
              <span key={h} style={{ fontSize:9, color:"var(--muted)", fontFamily:"var(--font)", textTransform:"uppercase", letterSpacing:"0.5px" }}>{h}</span>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {day.exercises.map(ex => {
              const last = lastWeights[ex.dbKey];
              return (
                <div key={ex.nome} style={{
                  display:"grid", gridTemplateColumns:"1fr 70px 60px 70px", gap:6, alignItems:"center",
                  padding:"8px 12px", background:"rgba(255,255,255,0.05)",
                  borderRadius:10, border:"1px solid rgba(255,255,255,0.06)",
                }}>
                  <span style={{ fontSize:11, color:"var(--text)", fontFamily:"var(--font)" }}>{ex.nome}</span>
                  <span style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--font)" }}>{ex.serie}×{ex.rip}</span>
                  <span style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--font)" }}>{ex.rec}</span>
                  <span style={{ fontSize:11, color: last ? day.color : "var(--muted)", fontFamily:"var(--font)", fontWeight: last ? 600 : 400 }}>
                    {last ? `${last.weight_kg}kg` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MacroBar({ label, current, target, color }) {
  const pct = Math.min(100, target > 0 ? Math.round((current / target) * 100) : 0);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <span style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--font)" }}>{label}</span>
        <span style={{ fontSize:11, color:"var(--text)", fontFamily:"var(--font)" }}>
          {current}<span style={{ color:"var(--muted)" }}>/{target}</span>
        </span>
      </div>
      <div style={{ height:5, background:"rgba(255,255,255,0.06)", borderRadius:10, overflow:"hidden" }}>
        <div style={{
          height:"100%", width:`${pct}%`, background:color, borderRadius:10,
          transition:"width 0.6s ease", boxShadow:`0 0 8px ${color}80`,
        }}/>
      </div>
    </div>
  );
}

const ALL_EXERCISES = Object.values(SCHEDA).flatMap(d => d.exercises);

export default function FitnessPage() {
  const [lastWeights, setLastWeights]       = useState({});
  const [weightHistory, setWeightHistory]   = useState([]);
  const [macros, setMacros]                 = useState({ kcal:0, protein:0, carbs:0, fat:0 });
  const [selectedEx, setSelectedEx]         = useState(ALL_EXERCISES[0].dbKey);
  const [exHistory, setExHistory]           = useState([]);
  const todayWorkout = getTodayWorkout();
  const targets = { kcal:2330, protein:160, carbs:265, fat:70 };

  const fetchFitness = React.useCallback(() => {
    fetch(`${API_URL}/fitness/last`)
      .then(r => r.json())
      .then(data => {
        const map = {};
        data.forEach(d => { map[d.exercise.toLowerCase()] = d; });
        setLastWeights(map);
      }).catch(() => {});

    fetch(`${API_URL}/fitness/weight/history?limit=20`)
      .then(r => r.json())
      .then(setWeightHistory)
      .catch(() => {});

    fetch(`${API_URL}/fitness/meals/today`)
      .then(r => r.json())
      .then(data => setMacros(data.totals || { kcal:0, protein:0, carbs:0, fat:0 }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchFitness();
    const on = () => fetchFitness();
    window.addEventListener("jarvis:fitness.workout", on);
    window.addEventListener("jarvis:fitness.weight", on);
    window.addEventListener("jarvis:fitness.meal", on);
    window.addEventListener("jarvis:record.deleted", on);
    return () => {
      window.removeEventListener("jarvis:fitness.workout", on);
      window.removeEventListener("jarvis:fitness.weight", on);
      window.removeEventListener("jarvis:fitness.meal", on);
      window.removeEventListener("jarvis:record.deleted", on);
    };
  }, [fetchFitness]);

  useEffect(() => {
    fetch(`${API_URL}/fitness/history/${encodeURIComponent(selectedEx)}?limit=20`)
      .then(r => r.json())
      .then(rows => setExHistory(rows.map(r => ({
        date: r.logged_at?.slice(5, 10),
        kg:   r.weight_kg,
      }))))
      .catch(() => setExHistory([]));
  }, [selectedEx]);

  const rings = [
    { pct: Math.round((macros.kcal / targets.kcal) * 100),     color:"#34d399", label:"Kcal" },
    { pct: Math.round((macros.protein / targets.protein) * 100), color:"#60a5fa", label:"Prot" },
    { pct: Math.round((macros.carbs / targets.carbs) * 100),    color:"#fbbf24", label:"Carbo" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14, height:"100%", minHeight:0, overflowY:"auto" }}>

      <div>
        <div style={{ fontFamily:"var(--font-serif)", fontStyle:"italic", fontSize:22, color:"var(--text)" }}>
          Fit<span style={{ color:"var(--fitness-accent)" }}>ness</span>
        </div>
        <div style={{ fontSize:10, color:"var(--muted)", marginTop:2 }}>
          {todayWorkout === "riposo" ? "Oggi: giorno di riposo" : `Oggi: ${SCHEDA[todayWorkout]?.label}`}
        </div>
      </div>

      {/* Macro tracker */}
      <div className="glass" style={{ padding:16, display:"flex", gap:20, alignItems:"center", flexWrap:"wrap" }}>
        <RingProgress rings={rings} size={100}/>
        <div style={{ flex:1, minWidth:160, display:"flex", flexDirection:"column", gap:10 }}>
          <MacroBar label="Kcal"     current={Math.round(macros.kcal)}    target={targets.kcal}    color="#34d399"/>
          <MacroBar label="Proteine" current={Math.round(macros.protein)} target={targets.protein} color="#60a5fa"/>
          <MacroBar label="Carbo"    current={Math.round(macros.carbs)}   target={targets.carbs}   color="#fbbf24"/>
          <MacroBar label="Grassi"   current={Math.round(macros.fat)}     target={targets.fat}     color="#f87171"/>
        </div>
      </div>

      {/* Schede */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {["A","C","B"].map(day => (
          <WorkoutCard key={day} dayKey={day} lastWeights={lastWeights} isToday={todayWorkout===day}/>
        ))}
        {todayWorkout === "riposo" && (
          <div className="glass" style={{ padding:"12px 16px", fontSize:12, color:"var(--muted)", fontFamily:"var(--font)", textAlign:"center" }}>
            💤 Oggi è previsto riposo — buon recupero!
          </div>
        )}
      </div>

      {/* Grafico progresso esercizio */}
      <div className="glass" style={{ padding:16 }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.8px", textTransform:"uppercase", color:"var(--muted)", marginBottom:10, fontFamily:"var(--font)" }}>
          Progresso esercizio
        </div>
        <select
          value={selectedEx}
          onChange={e => setSelectedEx(e.target.value)}
          style={{
            width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:10, padding:"7px 10px", color:"var(--text)",
            fontSize:12, fontFamily:"var(--font)", outline:"none", marginBottom:12,
            appearance:"none",
          }}
        >
          {ALL_EXERCISES.map(ex => (
            <option key={ex.dbKey} value={ex.dbKey} style={{ background:"#0d0d1a" }}>{ex.nome}</option>
          ))}
        </select>
        {exHistory.length > 1 ? (
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={exHistory}>
              <XAxis dataKey="date" tick={{ fill:"rgba(255,255,255,0.3)", fontSize:10 }} axisLine={false} tickLine={false}/>
              <YAxis domain={["auto","auto"]} tick={{ fill:"rgba(255,255,255,0.3)", fontSize:10 }} axisLine={false} tickLine={false} width={32}/>
              <Tooltip contentStyle={{ background:"rgba(10,10,30,0.9)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, fontSize:12 }}
                labelStyle={{ color:"rgba(255,255,255,0.5)" }} itemStyle={{ color:"#818cf8" }}
                formatter={v => [`${v} kg`]}/>
              <Line type="monotone" dataKey="kg" stroke="#818cf8" strokeWidth={2} dot={{ fill:"#818cf8", r:3 }} activeDot={{ r:5 }}/>
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign:"center", fontSize:12, color:"var(--muted)", fontFamily:"var(--font)", padding:"16px 0" }}>
            Nessun dato per questo esercizio
          </div>
        )}
      </div>

      {/* Grafico peso corporeo */}
      <div className="glass" style={{ padding:16 }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.8px", textTransform:"uppercase", color:"var(--muted)", marginBottom:12, fontFamily:"var(--font)" }}>
          Peso corporeo
        </div>
        {weightHistory.length > 1 ? (
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={weightHistory}>
              <XAxis dataKey="date" tick={{ fill:"rgba(255,255,255,0.3)", fontSize:10 }} axisLine={false} tickLine={false}/>
              <YAxis domain={["auto","auto"]} tick={{ fill:"rgba(255,255,255,0.3)", fontSize:10 }} axisLine={false} tickLine={false} width={32}/>
              <Tooltip contentStyle={{ background:"rgba(10,10,30,0.9)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, fontSize:12 }}
                labelStyle={{ color:"rgba(255,255,255,0.5)" }} itemStyle={{ color:"#34d399" }}/>
              <Line type="monotone" dataKey="kg" stroke="#34d399" strokeWidth={2} dot={{ fill:"#34d399", r:3 }} activeDot={{ r:5 }}/>
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign:"center", fontSize:12, color:"var(--muted)", fontFamily:"var(--font)", padding:"20px 0" }}>
            Pesati 2-3 volte a settimana per vedere il grafico
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const API_URL = "https://api.matteolizzo.it";
const PIE_COLORS = ["#818cf8","#34d399","#f87171","#fbbf24","#60a5fa","#a78bfa"];
const fmt = v => Number(v||0).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2});

const AreaTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background:"rgba(10,10,20,0.9)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 12px" }}>
      <div style={{ fontSize:10, color:"var(--muted)", marginBottom:3 }}>{d.created_at?.slice(0,10)}</div>
      <div style={{ fontSize:15, fontWeight:700, color: d.direction==="+" ? "var(--green)" : "var(--red)" }}>
        {d.direction==="+" ? "+" : "−"}€{Number(d.amount).toFixed(2)}
      </div>
      {d.category && <div style={{ fontSize:10, color:"var(--muted)", marginTop:2 }}>{d.category}</div>}
    </div>
  );
};

export default function CashFlowPage({ onDataReady }) {
  const [transactions, setTransactions] = useState([]);
  const [report, setReport]   = useState({ saldo:0, entrate:0, uscite:0, transazioni:0 });
  const [period, setPeriod]   = useState("month");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const fetchData = useCallback(async () => {
    setSyncing(true);
    try {
      const [t, r] = await Promise.all([
        axios.get(`${API_URL}/transactions`),
        axios.get(`${API_URL}/transactions/report?period=${period}`),
      ]);
      setTransactions(t.data);
      setReport(r.data);
      setLastSync(new Date());
      if (onDataReady) onDataReady({ saldo: r.data.saldo });
    } catch(e) { console.error(e); }
    finally { setSyncing(false); }
  }, [period, onDataReady]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const chartData = useMemo(() => {
    let running = 0;
    return [...transactions].reverse().map(t => {
      running += t.direction==="+" ? Number(t.amount) : -Number(t.amount);
      return { ...t, balance: parseFloat(running.toFixed(2)) };
    });
  }, [transactions]);

  const categoryData = useMemo(() => {
    const cats = {};
    transactions.forEach(t => {
      if (t.direction==="-" && t.category) cats[t.category] = (cats[t.category]||0) + Number(t.amount);
    });
    return Object.entries(cats)
      .map(([name,value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .sort((a,b)=>b.value-a.value).slice(0,6);
  }, [transactions]);

  const periods = ["today","week","month"];
  const periodLabel = { today:"Oggi", week:"Settimana", month:"Mese" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, height:"100%", minHeight:0 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"var(--font-serif)", fontStyle:"italic", fontSize:22, color:"var(--text)" }}>
            Cash <span style={{ color:"var(--cashflow-accent)" }}>Flow</span>
          </div>
          <div style={{ fontSize:10, color:"var(--muted)", marginTop:2 }}>
            {lastSync ? `Aggiornato ${lastSync.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"})}` : "Caricamento..."}
          </div>
        </div>
        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
          {periods.map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              background: period===p ? "rgba(129,140,248,0.18)" : "var(--glass-bg)",
              border: period===p ? "1px solid rgba(129,140,248,0.35)" : "1px solid var(--glass-border)",
              borderRadius:20, padding:"6px 14px", cursor:"pointer",
              color: period===p ? "var(--text)" : "var(--muted)",
              fontSize:11, fontWeight:600, fontFamily:"var(--font)", transition:"all 0.2s",
            }}>{periodLabel[p]}</button>
          ))}
          <div style={{ width:6, height:6, borderRadius:"50%", marginLeft:6,
            background: syncing ? "var(--amber)" : "var(--green)",
            boxShadow: syncing ? "0 0 8px rgba(251,191,36,0.7)" : "0 0 8px rgba(52,211,153,0.7)",
            animation: syncing ? "spinGlow 0.8s linear infinite" : "breathe 2.5s ease-in-out infinite"
          }}/>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, flexShrink:0 }}>
        {[
          { label:"Saldo",   val:`€${fmt(report.saldo)}`,    color: report.saldo>=0?"var(--green)":"var(--red)" },
          { label:"Entrate", val:`+€${fmt(report.entrate)}`, color:"var(--green)" },
          { label:"Uscite",  val:`-€${fmt(report.uscite)}`,  color:"var(--red)" },
        ].map(k => (
          <div key={k.label} className="glass" style={{ padding:"14px 16px" }}>
            <div style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--font)", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:18, fontWeight:700, color:k.color, fontFamily:"var(--font)" }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 200px", gap:10, flex:1, minHeight:0 }}>
        <div className="glass" style={{ padding:"16px", minHeight:0 }}>
          <div style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--font)", marginBottom:10 }}>Andamento saldo</div>
          <ResponsiveContainer width="100%" height="85%">
            <AreaChart data={chartData} margin={{ top:5, right:5, bottom:0, left:0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#818cf8" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="created_at" tick={false} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip content={<AreaTooltip/>}/>
              <Area type="monotone" dataKey="balance" stroke="#818cf8" strokeWidth={2} fill="url(#grad)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="glass" style={{ padding:"16px", display:"flex", flexDirection:"column" }}>
          <div style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--font)", marginBottom:8 }}>Categorie</div>
          {categoryData.length > 0 ? (
            <>
              <PieChart width={160} height={110}>
                <Pie data={categoryData} cx={80} cy={55} innerRadius={32} outerRadius={50} dataKey="value" strokeWidth={0}>
                  {categoryData.map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                </Pie>
              </PieChart>
              <div style={{ flex:1, overflowY:"auto" }}>
                {categoryData.map((c,i) => (
                  <div key={c.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background:PIE_COLORS[i%PIE_COLORS.length] }}/>
                      <span style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--font)" }}>{c.name}</span>
                    </div>
                    <span style={{ fontSize:10, fontWeight:600, color:"var(--text)", fontFamily:"var(--font)" }}>€{fmt(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:12, color:"var(--muted)", fontFamily:"var(--font)" }}>Nessun dato</span>
            </div>
          )}
        </div>
      </div>

      {/* Transazioni recenti */}
      <div className="glass" style={{ flexShrink:0, maxHeight:170, overflowY:"auto" }}>
        <div style={{ padding:"10px 16px 6px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--font)", textTransform:"uppercase", letterSpacing:"0.6px" }}>Recenti</span>
          <span style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--font)" }}>{report.transazioni} transazioni</span>
        </div>
        {transactions.slice(0,8).map(t => (
          <div key={t.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"7px 16px", borderTop:"1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
              background: t.direction==="+" ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
              border: `1px solid ${t.direction==="+" ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
              fontSize:11, flexShrink:0
            }}>{t.direction==="+" ? "↑" : "↓"}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"var(--text)", fontFamily:"var(--font)" }}>{t.category||"—"}</div>
              <div style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--font)" }}>{t.created_at?.slice(0,10)}</div>
            </div>
            <div style={{ fontSize:13, fontWeight:700, color: t.direction==="+" ? "var(--green)" : "var(--red)", flexShrink:0 }}>
              {t.direction==="+" ? "+" : "−"}€{Number(t.amount).toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

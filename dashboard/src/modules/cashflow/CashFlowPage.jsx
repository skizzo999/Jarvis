import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";

const API_URL = "/api";
const fmt = v => Number(v||0).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2});
const ACCOUNT_COLOR = { cash:"#34d399", revolut:"#818cf8" };
const ACCOUNT_ICON  = { cash:"💵", revolut:"💳" };

const EMPTY_FORM = { amount:"", direction:"-", category:"", account:"cash", note:"" };

export default function CashFlowPage({ onDataReady }) {
  const [transactions, setTransactions] = useState([]);
  const [report, setReport]   = useState({ saldo:0, saldo_cash:0, saldo_revolut:0, entrate:0, uscite:0 });
  const [period, setPeriod]   = useState("month");
  const [syncing, setSyncing] = useState(false);
  const [accountFilter, setAccountFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);

  const fetchData = useCallback(async () => {
    setSyncing(true);
    try {
      const [t, r] = await Promise.all([
        axios.get(`${API_URL}/transactions`),
        axios.get(`${API_URL}/transactions/report?period=${period}`),
      ]);
      setTransactions(t.data);
      setReport(r.data);
      if (onDataReady) onDataReady({ saldo: r.data.saldo });
    } catch(e) { console.error(e); }
    finally { setSyncing(false); }
  }, [period, onDataReady]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const filtered = useMemo(() =>
    accountFilter === "all" ? transactions : transactions.filter(t => t.account === accountFilter),
    [transactions, accountFilter]
  );

  const submitForm = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/transactions`, {
        amount,
        direction: form.direction,
        category:  form.category || "manuale",
        account:   form.account,
        note:      form.note,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await fetchData();
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  const periods = ["today","week","month"];
  const periodLabel = { today:"Oggi", week:"7gg", month:"Mese" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, padding:"8px 4px", height:"100%", minHeight:0 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ fontFamily:"var(--font-serif)", fontStyle:"italic", fontSize:32, color:"var(--text)", lineHeight:1, letterSpacing:"-0.5px" }}>
          Cash <span style={{ color:"var(--cashflow-accent)" }}>Flow</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          {periods.map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              background: period===p ? "rgba(255,255,255,0.08)" : "transparent",
              border: period===p ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
              borderRadius:20, padding:"5px 14px", cursor:"pointer",
              color: period===p ? "var(--text)" : "var(--muted)",
              fontSize:11, fontFamily:"var(--font)", transition:"all 0.2s",
            }}>{periodLabel[p]}</button>
          ))}
          <div style={{
            width:5, height:5, borderRadius:"50%", marginLeft:6,
            background: syncing ? "var(--amber)" : "var(--green)",
            boxShadow: syncing ? "0 0 6px rgba(251,191,36,0.9)" : "0 0 6px rgba(52,211,153,0.9)",
          }}/>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, flexShrink:0 }}>
        {[
          { label:"Cash",    val:`€${fmt(report.saldo_cash)}`,    color: report.saldo_cash>=0?"var(--green)":"var(--red)",    acc:"cash" },
          { label:"Revolut", val:`€${fmt(report.saldo_revolut)}`, color: report.saldo_revolut>=0?"var(--green)":"var(--red)", acc:"revolut" },
          { label:"Uscite",  val:`−€${fmt(report.uscite)}`,       color:"var(--red)",                                         acc:null },
        ].map(k => (
          <div key={k.label}
            onClick={() => k.acc && setAccountFilter(accountFilter===k.acc ? "all" : k.acc)}
            style={{
              padding:"14px 16px",
              background: accountFilter===k.acc && k.acc ? `${ACCOUNT_COLOR[k.acc]}14` : "rgba(255,255,255,0.04)",
              border: accountFilter===k.acc && k.acc ? `1px solid ${ACCOUNT_COLOR[k.acc]}40` : "1px solid rgba(255,255,255,0.06)",
              borderRadius:14, cursor: k.acc ? "pointer" : "default",
              transition:"all 0.2s", backdropFilter:"blur(8px)",
            }}>
            <div style={{ fontSize:9, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"1px", marginBottom:8, fontFamily:"var(--font)" }}>
              {k.acc ? ACCOUNT_ICON[k.acc] : "↓"} {k.label}
            </div>
            <div style={{ fontSize:22, fontWeight:700, color:k.color, fontFamily:"var(--font)", letterSpacing:"-0.5px" }}>
              {k.val}
            </div>
          </div>
        ))}
      </div>

      {/* Aggiungi transazione */}
      <div style={{ flexShrink:0 }}>
        <button onClick={() => setShowForm(v => !v)} style={{
          background:"transparent", border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:20, padding:"5px 14px", cursor:"pointer",
          color:"var(--muted)", fontSize:11, fontFamily:"var(--font)", transition:"all 0.2s",
          display:"flex", alignItems:"center", gap:5,
        }}>
          <span style={{ fontSize:14, lineHeight:1 }}>{showForm ? "−" : "+"}</span> Aggiungi
        </button>

        {showForm && (
          <div style={{
            marginTop:10, padding:"14px", background:"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.08)", borderRadius:14,
            display:"flex", flexDirection:"column", gap:10,
          }}>
            {/* Row 1: direzione + importo */}
            <div style={{ display:"flex", gap:8 }}>
              {["+","-"].map(d => (
                <button key={d} onClick={() => setForm(f=>({...f,direction:d}))} style={{
                  background: form.direction===d ? (d==="+" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)") : "rgba(255,255,255,0.04)",
                  border: `1px solid ${form.direction===d ? (d==="+" ? "rgba(52,211,153,0.4)" : "rgba(248,113,113,0.4)") : "rgba(255,255,255,0.08)"}`,
                  borderRadius:10, padding:"6px 16px", cursor:"pointer",
                  color: form.direction===d ? (d==="+" ? "var(--green)" : "var(--red)") : "var(--muted)",
                  fontSize:16, fontWeight:700, fontFamily:"var(--font)",
                }}>{d}</button>
              ))}
              <input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(f=>({...f,amount:e.target.value}))}
                onKeyDown={e => e.key==="Enter" && submitForm()}
                style={{
                  flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:10, padding:"6px 10px", color:"var(--text)",
                  fontSize:14, fontFamily:"var(--font)", outline:"none",
                }}
              />
            </div>
            {/* Row 2: categoria + account */}
            <div style={{ display:"flex", gap:8 }}>
              <input
                placeholder="Categoria"
                value={form.category}
                onChange={e => setForm(f=>({...f,category:e.target.value}))}
                style={{
                  flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:10, padding:"6px 10px", color:"var(--text)",
                  fontSize:12, fontFamily:"var(--font)", outline:"none",
                }}
              />
              {["cash","revolut"].map(a => (
                <button key={a} onClick={() => setForm(f=>({...f,account:a}))} style={{
                  background: form.account===a ? `${ACCOUNT_COLOR[a]}18` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${form.account===a ? `${ACCOUNT_COLOR[a]}50` : "rgba(255,255,255,0.08)"}`,
                  borderRadius:10, padding:"6px 12px", cursor:"pointer",
                  color: form.account===a ? ACCOUNT_COLOR[a] : "var(--muted)",
                  fontSize:12, fontFamily:"var(--font)",
                }}>{ACCOUNT_ICON[a]} {a}</button>
              ))}
            </div>
            {/* Row 3: nota + salva */}
            <div style={{ display:"flex", gap:8 }}>
              <input
                placeholder="Nota (opzionale)"
                value={form.note}
                onChange={e => setForm(f=>({...f,note:e.target.value}))}
                onKeyDown={e => e.key==="Enter" && submitForm()}
                style={{
                  flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:10, padding:"6px 10px", color:"var(--text)",
                  fontSize:12, fontFamily:"var(--font)", outline:"none",
                }}
              />
              <button onClick={submitForm} disabled={saving || !form.amount} style={{
                background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.14)",
                borderRadius:10, padding:"6px 16px", cursor:"pointer",
                color:"var(--text)", fontSize:12, fontFamily:"var(--font)",
                opacity: (saving || !form.amount) ? 0.4 : 1, transition:"all 0.2s",
              }}>
                {saving ? "…" : "Salva"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Separatore */}
      <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <div style={{ display:"flex", gap:14 }}>
          {["all","cash","revolut"].map(a => (
            <button key={a} onClick={() => setAccountFilter(a)} style={{
              background:"transparent", border:"none", padding:"2px 0",
              cursor:"pointer", color: accountFilter===a ? "var(--text)" : "var(--muted)",
              fontSize:11, fontFamily:"var(--font)",
              borderBottom: accountFilter===a ? "1px solid rgba(255,255,255,0.4)" : "1px solid transparent",
              transition:"all 0.2s",
            }}>
              {a==="all" ? "Tutti" : a==="cash" ? "💵 Cash" : "💳 Revolut"}
            </button>
          ))}
        </div>
        <div style={{ flex:1, height:"1px", background:"rgba(255,255,255,0.06)" }}/>
        <span style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--font)" }}>{filtered.length} mov.</span>
      </div>

      {/* Lista transazioni — minimalista, nessun bordo pesante */}
      <div style={{ flex:1, minHeight:0, overflowY:"auto" }}>
        {filtered.length === 0 ? (
          <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:13, color:"var(--muted)", fontFamily:"var(--font)" }}>Nessuna transazione</span>
          </div>
        ) : filtered.map((t, i) => (
          <div key={t.id} style={{
            display:"flex", alignItems:"center", gap:12, padding:"12px 4px",
            borderBottom: i < filtered.length-1 ? "1px solid rgba(255,255,255,0.04)" : "none",
          }}>
            <div style={{
              width:7, height:7, borderRadius:"50%", flexShrink:0,
              background: t.direction==="+" ? "var(--green)" : "var(--red)",
              boxShadow: t.direction==="+" ? "0 0 6px rgba(52,211,153,0.6)" : "0 0 6px rgba(248,113,113,0.5)",
            }}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, color:"var(--text)", fontFamily:"var(--font)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {t.note || t.category || "—"}
              </div>
              <div style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--font)", marginTop:1 }}>
                {t.created_at?.slice(0,10)}
                {t.account && t.account !== "cash" && (
                  <span style={{ marginLeft:6, color:ACCOUNT_COLOR[t.account], opacity:0.8 }}>
                    {ACCOUNT_ICON[t.account]}
                  </span>
                )}
              </div>
            </div>
            <div style={{ fontSize:14, fontWeight:600, fontFamily:"var(--font)", flexShrink:0, color: t.direction==="+" ? "var(--green)" : "var(--text)" }}>
              {t.direction==="+" ? "+" : "−"}€{Number(t.amount).toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

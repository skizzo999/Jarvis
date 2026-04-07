import React, { useState, useRef, useEffect } from 'react';

const API_URL = "https://api.matteolizzo.it";
const POSTIT_KEY = "jarvis_postit";

export default function CommandPanel() {
  const [cmd, setCmd]           = useState('');
  const [log, setLog]           = useState([]);
  const [sending, setSending]   = useState(false);
  const [postit, setPostit]     = useState(() => localStorage.getItem(POSTIT_KEY) || '');
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const send = async () => {
    if (!cmd.trim() || sending) return;
    const text = cmd.trim();
    setCmd('');
    setSending(true);
    setLog(l => [...l, { type:'out', text }]);
    try {
      const r = await fetch(`${API_URL}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const d = await r.json();
      setLog(l => [...l, { type:'in', text: d.reply || d.message || 'OK' }]);
    } catch {
      setLog(l => [...l, { type:'err', text: 'Errore di connessione' }]);
    } finally { setSending(false); }
  };

  const savePostit = (v) => {
    setPostit(v);
    localStorage.setItem(POSTIT_KEY, v);
  };

  return (
    <aside style={{ display:"flex", flexDirection:"column", gap:12, position:"relative", zIndex:1 }}>

      {/* Comando Jarvis */}
      <div className="glass" style={{ padding:"16px 16px 12px", display:"flex", flexDirection:"column", gap:0 }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.8px", textTransform:"uppercase", color:"var(--muted)", marginBottom:10, fontFamily:"var(--font)" }}>
          Jarvis
        </div>

        {/* log messaggi */}
        <div ref={logRef} style={{
          height:160, overflowY:"auto", display:"flex", flexDirection:"column",
          gap:5, marginBottom:10,
        }}>
          {log.length === 0 && (
            <div style={{ fontSize:12, color:"var(--muted)", fontFamily:"var(--font)", fontStyle:"italic" }}>
              Scrivi un comando...
            </div>
          )}
          {log.map((l, i) => (
            <div key={i} style={{
              fontSize:12, fontFamily:"var(--font)", lineHeight:1.5,
              color: l.type === 'in' ? 'var(--text)' : l.type === 'err' ? 'var(--red)' : 'var(--muted)',
              textAlign: l.type === 'out' ? 'right' : 'left',
              animation: 'slideUp 0.2s ease both',
            }}>
              {l.type === 'out' ? '→ ' : l.type === 'err' ? '✗ ' : '← '}{l.text}
            </div>
          ))}
        </div>

        {/* input */}
        <div style={{ display:"flex", gap:6 }}>
          <input
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder=">> Scrivi a Jarvis..."
            style={{
              flex:1, background:"rgba(255,255,255,0.05)",
              border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:10, padding:"8px 12px",
              color:"var(--text)", fontSize:12, fontFamily:"var(--font)",
              outline:"none",
            }}
          />
          <button onClick={send} disabled={sending} style={{
            background:"rgba(255,255,255,0.08)",
            border:"1px solid rgba(255,255,255,0.14)",
            borderRadius:10, padding:"8px 12px",
            color:"var(--text)", cursor:"pointer", fontSize:12,
            fontFamily:"var(--font)", transition:"all 0.2s",
            opacity: sending ? 0.5 : 1,
          }}>
            {sending ? "…" : "▶"}
          </button>
        </div>
      </div>

      {/* Post-it */}
      <div className="glass" style={{ padding:"16px", flex:1, display:"flex", flexDirection:"column" }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.8px", textTransform:"uppercase", color:"var(--muted)", marginBottom:10, fontFamily:"var(--font)" }}>
          Note
        </div>
        <textarea
          value={postit}
          onChange={e => savePostit(e.target.value)}
          placeholder="Scrivi qui le tue note..."
          style={{
            flex:1, background:"transparent", border:"none", outline:"none",
            color:"var(--text)", fontSize:13, fontFamily:"var(--font)",
            lineHeight:1.6, resize:"none", minHeight:120,
          }}
        />
      </div>
    </aside>
  );
}

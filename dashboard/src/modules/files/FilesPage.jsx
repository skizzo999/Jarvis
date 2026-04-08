import React, { useState, useEffect } from "react";

const API_URL = "https://api.matteolizzo.it";

const ANALYZABLE = new Set(["txt","md","py","js","jsx","ts","tsx","json","csv","html","css","yaml","yml","sh","log","sql","pdf"]);

function FileIcon({ name }) {
  const ext = name.split(".").pop().toLowerCase();
  const icons = { pdf:"📄", jpg:"🖼️", jpeg:"🖼️", png:"🖼️", py:"🐍", js:"📜", jsx:"📜", ts:"📜", txt:"📝", md:"📝", zip:"🗜️", mp4:"🎬", mp3:"🎵" };
  return <span style={{ fontSize:14 }}>{icons[ext] || "📎"}</span>;
}

export default function FilesPage() {
  const [tree, setTree]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [openFolders, setOpen]    = useState({});
  const [sending, setSending]     = useState(null);
  // analyzer state
  const [activeFile, setActiveFile] = useState(null);   // { path, name }
  const [question, setQuestion]     = useState("");
  const [analyzing, setAnalyzing]   = useState(false);
  const [result, setResult]         = useState(null);   // { answer, chars_analyzed }

  useEffect(() => {
    fetch(`${API_URL}/storage/files`)
      .then(r => r.json())
      .then(d => { setTree(d); setLoading(false); })
      .catch(() => { setTree([]); setLoading(false); });
  }, []);

  const toggleFolder = path => setOpen(o => ({ ...o, [path]: !o[path] }));

  const sendTelegram = async path => {
    setSending(path);
    try {
      const r = await fetch(`${API_URL}/storage/send-telegram`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ path }),
      });
      if (!r.ok) alert("Errore invio");
    } catch { alert("Errore di connessione"); }
    finally { setSending(null); }
  };

  const openAnalyzer = file => {
    setActiveFile(file);
    setQuestion("");
    setResult(null);
    // auto-analisi al click
    runAnalysis(file.path, null);
  };

  const runAnalysis = async (path, q) => {
    setAnalyzing(true);
    setResult(null);
    try {
      const r = await fetch(`${API_URL}/storage/analyze`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ path, question: q || null }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Errore analisi");
      setResult(data);
    } catch(e) {
      setResult({ answer: `⚠️ ${e.message}`, chars_analyzed: 0 });
    } finally { setAnalyzing(false); }
  };

  const askQuestion = () => {
    if (!activeFile || !question.trim()) return;
    runAnalysis(activeFile.path, question.trim());
  };

  const canAnalyze = name => ANALYZABLE.has(name.split(".").pop().toLowerCase());

  const renderItem = (item, depth=0) => {
    const pad = depth * 16;
    if (item.type === "folder") {
      const isOpen = openFolders[item.path];
      return (
        <div key={item.path}>
          <div onClick={() => toggleFolder(item.path)}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 16px", paddingLeft:16+pad,
              cursor:"pointer", borderBottom:"1px solid rgba(255,255,255,0.04)", transition:"background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.03)"}
            onMouseLeave={e => e.currentTarget.style.background="transparent"}>
            <span style={{ fontSize:14 }}>{isOpen ? "📂" : "📁"}</span>
            <span style={{ fontSize:12, fontWeight:600, color:"var(--text)", fontFamily:"var(--font)", flex:1 }}>{item.name}</span>
            <span style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--font)" }}>{item.children?.length} elementi</span>
            <span style={{ fontSize:10, color:"var(--muted)", transform:isOpen?"rotate(180deg)":"none", transition:"transform 0.2s", display:"inline-block" }}>▼</span>
          </div>
          {isOpen && item.children?.map(c => renderItem(c, depth+1))}
        </div>
      );
    }
    const analyzable = canAnalyze(item.name);
    return (
      <div key={item.path} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 16px", paddingLeft:16+pad, borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
        <FileIcon name={item.name}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:500, color:"var(--text)", fontFamily:"var(--font)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
          <div style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--font)" }}>{item.size}</div>
        </div>
        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
          {analyzable && (
            <button onClick={() => openAnalyzer(item)}
              style={{ background:"rgba(167,139,250,0.10)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:8, padding:"4px 10px", color:"#a78bfa", fontSize:10, cursor:"pointer", fontFamily:"var(--font)" }}>
              🔍 AI
            </button>
          )}
          <button onClick={() => window.open(`${API_URL}/storage/download?path=${encodeURIComponent(item.path)}`, "_blank")}
            style={{ background:"rgba(96,165,250,0.10)", border:"1px solid rgba(96,165,250,0.2)", borderRadius:8, padding:"4px 10px", color:"var(--blue)", fontSize:10, cursor:"pointer", fontFamily:"var(--font)" }}>
            ⬇
          </button>
          <button onClick={() => sendTelegram(item.path)} disabled={sending===item.path}
            style={{ background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:8, padding:"4px 10px", color:"var(--green)", fontSize:10, cursor:"pointer", fontFamily:"var(--font)", opacity:sending===item.path?0.5:1 }}>
            {sending===item.path ? "…" : "✈"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, height:"100%", minHeight:0 }}>

      {/* Header */}
      <div style={{ flexShrink:0 }}>
        <div style={{ fontFamily:"var(--font-serif)", fontStyle:"italic", fontSize:26, color:"var(--text)", lineHeight:1 }}>
          File <span style={{ color:"var(--files-accent)" }}>Storage</span>
        </div>
        <div style={{ fontSize:10, color:"var(--muted)", marginTop:4, fontFamily:"var(--font)" }}>
          /home/jarvis/storage
        </div>
      </div>

      {/* Body — file tree + analyzer panel */}
      <div style={{ flex:1, minHeight:0, display:"flex", gap:12 }}>

        {/* File tree */}
        <div className="glass" style={{ flex:1, overflowY:"auto", minWidth:0 }}>
          {loading && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:120, color:"var(--muted)", fontSize:13, fontFamily:"var(--font)" }}>Caricamento...</div>
          )}
          {!loading && tree.length === 0 && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:160, gap:10 }}>
              <span style={{ fontSize:36 }}>📁</span>
              <span style={{ fontSize:13, color:"var(--muted)", fontFamily:"var(--font)" }}>Nessun file in storage</span>
              <span style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--font)", opacity:0.6 }}>/home/jarvis/storage/</span>
            </div>
          )}
          {tree.map(item => renderItem(item))}
        </div>

        {/* Analyzer panel — appare quando un file è selezionato */}
        {activeFile && (
          <div className="glass" style={{ width:340, display:"flex", flexDirection:"column", gap:0, flexShrink:0, overflow:"hidden" }}>
            {/* Header panel */}
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 14px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
              <FileIcon name={activeFile.name}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--text)", fontFamily:"var(--font)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {activeFile.name}
                </div>
                <div style={{ fontSize:9, color:"#a78bfa", fontFamily:"var(--font)", marginTop:1 }}>Analisi AI</div>
              </div>
              <button onClick={() => setActiveFile(null)} style={{ background:"transparent", border:"none", color:"var(--muted)", fontSize:16, cursor:"pointer", padding:"2px 4px", lineHeight:1 }}>✕</button>
            </div>

            {/* Risposta */}
            <div style={{ flex:1, overflowY:"auto", padding:"14px" }}>
              {analyzing && (
                <div style={{ display:"flex", alignItems:"center", gap:10, color:"var(--muted)", fontSize:12, fontFamily:"var(--font)" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:"#a78bfa", animation:"breathe 1s ease-in-out infinite" }}/>
                  Analisi in corso...
                </div>
              )}
              {!analyzing && result && (
                <div style={{ fontSize:12, color:"var(--text)", fontFamily:"var(--font)", lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
                  {result.answer}
                  {result.chars_analyzed > 0 && (
                    <div style={{ marginTop:12, fontSize:9, color:"var(--muted)", borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:8 }}>
                      {result.chars_analyzed.toLocaleString()} caratteri analizzati
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input domanda */}
            <div style={{ padding:"10px 12px", borderTop:"1px solid rgba(255,255,255,0.06)", flexShrink:0, display:"flex", gap:8 }}>
              <input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key==="Enter" && !e.shiftKey && askQuestion()}
                placeholder="Fai una domanda..."
                style={{
                  flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:8, padding:"7px 10px", color:"var(--text)", fontSize:11,
                  fontFamily:"var(--font)", outline:"none",
                }}
              />
              <button onClick={askQuestion} disabled={analyzing || !question.trim()}
                style={{ background:"rgba(167,139,250,0.15)", border:"1px solid rgba(167,139,250,0.3)", borderRadius:8,
                  padding:"6px 12px", color:"#a78bfa", fontSize:11, cursor:"pointer", fontFamily:"var(--font)",
                  opacity: (analyzing || !question.trim()) ? 0.4 : 1 }}>
                ↵
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";

const API_URL = "/api";

const ANALYZABLE  = new Set(["txt","md","py","js","jsx","ts","tsx","json","csv","html","css","yaml","yml","sh","log","sql","pdf"]);
const TEXT_PREV   = new Set(["txt","md","py","js","jsx","ts","tsx","json","csv","html","css","yaml","yml","sh","log","sql"]);
const IMAGE_PREV  = new Set(["jpg","jpeg","png","gif","webp","svg"]);
const FOLDERS     = ["inbox","scuola/informatica","scuola/sistemi","scuola/tpsi","scuola/gpoi","scuola/italiano","scuola/storia","scuola/inglese","personale"];

function ext(name) { return name.split(".").pop().toLowerCase(); }

function FileIcon({ name }) {
  const e = ext(name);
  const icons = { pdf:"📄", jpg:"🖼️", jpeg:"🖼️", png:"🖼️", webp:"🖼️", svg:"🖼️", gif:"🖼️", py:"🐍", js:"📜", jsx:"📜", ts:"📜", txt:"📝", md:"📝", zip:"🗜️", mp4:"🎬", mp3:"🎵" };
  return <span style={{ fontSize:14 }}>{icons[e] || "📎"}</span>;
}

export default function FilesPage() {
  const [tree, setTree]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [openFolders, setOpen]    = useState({});
  const [sending, setSending]     = useState(null);

  // panel: null | { mode:"ai"|"preview", file:{path,name} }
  const [panel, setPanel]         = useState(null);

  // AI state
  const [question, setQuestion]   = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult]   = useState(null);

  // Preview state
  const [previewContent, setPreviewContent] = useState(null); // string | null
  const [previewLoading, setPreviewLoading] = useState(false);

  // Upload state
  const [uploadFolder, setUploadFolder] = useState("inbox");
  const [uploading, setUploading]       = useState(false);
  const [uploadMsg, setUploadMsg]       = useState(null); // { ok, text }
  const fileInputRef = useRef(null);

  const refreshTree = () => {
    fetch(`${API_URL}/storage/files`)
      .then(r => r.json())
      .then(d => { setTree(d); setLoading(false); })
      .catch(() => { setTree([]); setLoading(false); });
  };

  useEffect(() => { refreshTree(); }, []);

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

  // ── AI ─────────────────────────────────────────────────────────────────────
  const openAI = file => {
    setPanel({ mode:"ai", file });
    setQuestion(""); setAiResult(null);
    runAnalysis(file.path, null);
  };

  const runAnalysis = async (path, q) => {
    setAnalyzing(true); setAiResult(null);
    try {
      const r = await fetch(`${API_URL}/storage/analyze`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ path, question: q || null }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Errore analisi");
      setAiResult(data);
    } catch(e) {
      setAiResult({ answer:`⚠️ ${e.message}`, chars_analyzed:0 });
    } finally { setAnalyzing(false); }
  };

  // ── Preview ────────────────────────────────────────────────────────────────
  const openPreview = async file => {
    setPanel({ mode:"preview", file });
    const e = ext(file.name);
    if (IMAGE_PREV.has(e)) { setPreviewContent("image"); return; }
    if (!TEXT_PREV.has(e)) { setPreviewContent(null); return; }
    setPreviewLoading(true); setPreviewContent(null);
    try {
      const r = await fetch(`${API_URL}/storage/download?path=${encodeURIComponent(file.path)}`);
      const text = await r.text();
      setPreviewContent(text.slice(0, 8000));
    } catch { setPreviewContent("⚠️ Impossibile caricare il file"); }
    finally { setPreviewLoading(false); }
  };

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleFileChange = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", uploadFolder);
      const r = await fetch(`${API_URL}/storage/upload-web`, { method:"POST", body:fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Errore upload");
      setUploadMsg({ ok:true, text:`✓ ${data.filename} salvato in /${data.folder} (${data.size_kb} KB)` });
      refreshTree();
    } catch(e) {
      setUploadMsg({ ok:false, text:`✗ ${e.message}` });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const canAnalyze  = name => ANALYZABLE.has(ext(name));
  const canPreview  = name => TEXT_PREV.has(ext(name)) || IMAGE_PREV.has(ext(name));

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
    return (
      <div key={item.path} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 16px", paddingLeft:16+pad, borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
        <FileIcon name={item.name}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:500, color:"var(--text)", fontFamily:"var(--font)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
          <div style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--font)" }}>{item.size}</div>
        </div>
        <div style={{ display:"flex", gap:5, flexShrink:0 }}>
          {canPreview(item.name) && (
            <button onClick={() => openPreview(item)}
              style={{ background: panel?.file?.path===item.path && panel.mode==="preview" ? "rgba(251,191,36,0.2)" : "rgba(251,191,36,0.08)",
                border:"1px solid rgba(251,191,36,0.25)", borderRadius:8, padding:"4px 9px",
                color:"#fbbf24", fontSize:10, cursor:"pointer", fontFamily:"var(--font)" }}>
              👁
            </button>
          )}
          {canAnalyze(item.name) && (
            <button onClick={() => openAI(item)}
              style={{ background: panel?.file?.path===item.path && panel.mode==="ai" ? "rgba(167,139,250,0.2)" : "rgba(167,139,250,0.10)",
                border:"1px solid rgba(167,139,250,0.25)", borderRadius:8, padding:"4px 9px",
                color:"#a78bfa", fontSize:10, cursor:"pointer", fontFamily:"var(--font)" }}>
              AI
            </button>
          )}
          <button onClick={() => window.open(`${API_URL}/storage/download?path=${encodeURIComponent(item.path)}`, "_blank")}
            style={{ background:"rgba(96,165,250,0.10)", border:"1px solid rgba(96,165,250,0.2)", borderRadius:8, padding:"4px 9px", color:"var(--blue)", fontSize:10, cursor:"pointer", fontFamily:"var(--font)" }}>
            ⬇
          </button>
          <button onClick={() => sendTelegram(item.path)} disabled={sending===item.path}
            style={{ background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:8, padding:"4px 9px", color:"var(--green)", fontSize:10, cursor:"pointer", fontFamily:"var(--font)", opacity:sending===item.path?0.5:1 }}>
            {sending===item.path ? "…" : "✈"}
          </button>
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, height:"100%", minHeight:0 }}>

      {/* Header */}
      <div style={{ flexShrink:0, display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontFamily:"var(--font-serif)", fontStyle:"italic", fontSize:26, color:"var(--text)", lineHeight:1 }}>
            File <span style={{ color:"var(--files-accent)" }}>Storage</span>
          </div>
          <div style={{ fontSize:10, color:"var(--muted)", marginTop:4, fontFamily:"var(--font)" }}>
            /home/matteo/Jarvis/storage
          </div>
        </div>

        {/* Upload area */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5 }}>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <select
              value={uploadFolder}
              onChange={e => setUploadFolder(e.target.value)}
              style={{
                background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
                borderRadius:8, padding:"5px 8px", color:"var(--muted)",
                fontSize:10, fontFamily:"var(--font)", outline:"none",
              }}
            >
              {FOLDERS.map(f => <option key={f} value={f} style={{ background:"#0d0d1a" }}>{f}</option>)}
            </select>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                background:"rgba(52,211,153,0.10)", border:"1px solid rgba(52,211,153,0.25)",
                borderRadius:10, padding:"6px 14px", cursor:"pointer",
                color:"var(--green)", fontSize:11, fontFamily:"var(--font)",
                opacity: uploading ? 0.5 : 1, transition:"all 0.2s",
                display:"flex", alignItems:"center", gap:5,
              }}>
              {uploading ? "…" : "⬆ Carica"}
            </button>
            <input ref={fileInputRef} type="file" style={{ display:"none" }} onChange={handleFileChange}/>
          </div>
          {uploadMsg && (
            <div style={{ fontSize:10, fontFamily:"var(--font)", color: uploadMsg.ok ? "var(--green)" : "var(--red)" }}>
              {uploadMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
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
            </div>
          )}
          {tree.map(item => renderItem(item))}
        </div>

        {/* Side panel — AI o Preview */}
        {panel && (
          <div className="glass" style={{ width:340, display:"flex", flexDirection:"column", gap:0, flexShrink:0, overflow:"hidden" }}>

            {/* Panel header con tab */}
            <div style={{ display:"flex", alignItems:"center", gap:0, borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", flex:1, minWidth:0 }}>
                <FileIcon name={panel.file.name}/>
                <span style={{ fontSize:11, fontWeight:600, color:"var(--text)", fontFamily:"var(--font)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {panel.file.name}
                </span>
              </div>
              {/* tabs */}
              <div style={{ display:"flex", gap:0, flexShrink:0 }}>
                {canPreview(panel.file.name) && (
                  <button onClick={() => openPreview(panel.file)} style={{
                    background: panel.mode==="preview" ? "rgba(251,191,36,0.12)" : "transparent",
                    border:"none", borderBottom: panel.mode==="preview" ? "2px solid #fbbf24" : "2px solid transparent",
                    padding:"10px 12px", cursor:"pointer", color: panel.mode==="preview" ? "#fbbf24" : "var(--muted)",
                    fontSize:11, fontFamily:"var(--font)", transition:"all 0.2s",
                  }}>👁 Anteprima</button>
                )}
                {canAnalyze(panel.file.name) && (
                  <button onClick={() => openAI(panel.file)} style={{
                    background: panel.mode==="ai" ? "rgba(167,139,250,0.12)" : "transparent",
                    border:"none", borderBottom: panel.mode==="ai" ? "2px solid #a78bfa" : "2px solid transparent",
                    padding:"10px 12px", cursor:"pointer", color: panel.mode==="ai" ? "#a78bfa" : "var(--muted)",
                    fontSize:11, fontFamily:"var(--font)", transition:"all 0.2s",
                  }}>🔍 AI</button>
                )}
              </div>
              <button onClick={() => setPanel(null)} style={{ background:"transparent", border:"none", color:"var(--muted)", fontSize:16, cursor:"pointer", padding:"10px 12px", lineHeight:1 }}>✕</button>
            </div>

            {/* Preview content */}
            {panel.mode === "preview" && (
              <div style={{ flex:1, overflowY:"auto", padding:"14px" }}>
                {previewLoading && (
                  <div style={{ color:"var(--muted)", fontSize:12, fontFamily:"var(--font)" }}>Caricamento...</div>
                )}
                {!previewLoading && previewContent === "image" && (
                  <img
                    src={`${API_URL}/storage/download?path=${encodeURIComponent(panel.file.path)}`}
                    alt={panel.file.name}
                    style={{ maxWidth:"100%", borderRadius:8, display:"block" }}
                  />
                )}
                {!previewLoading && previewContent && previewContent !== "image" && (
                  <pre style={{
                    fontSize:11, color:"var(--text)", fontFamily:"'Courier New', monospace",
                    lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-all", margin:0,
                    background:"rgba(255,255,255,0.03)", borderRadius:8, padding:10,
                  }}>
                    {previewContent}
                  </pre>
                )}
                {!previewLoading && !previewContent && (
                  <div style={{ fontSize:12, color:"var(--muted)", fontFamily:"var(--font)", textAlign:"center", paddingTop:20 }}>
                    Anteprima non disponibile per questo formato
                  </div>
                )}
              </div>
            )}

            {/* AI content */}
            {panel.mode === "ai" && (
              <>
                <div style={{ flex:1, overflowY:"auto", padding:"14px" }}>
                  {analyzing && (
                    <div style={{ display:"flex", alignItems:"center", gap:10, color:"var(--muted)", fontSize:12, fontFamily:"var(--font)" }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:"#a78bfa", animation:"breathe 1s ease-in-out infinite" }}/>
                      Analisi in corso...
                    </div>
                  )}
                  {!analyzing && aiResult && (
                    <div style={{ fontSize:12, color:"var(--text)", fontFamily:"var(--font)", lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
                      {aiResult.answer}
                      {aiResult.chars_analyzed > 0 && (
                        <div style={{ marginTop:12, fontSize:9, color:"var(--muted)", borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:8 }}>
                          {aiResult.chars_analyzed.toLocaleString()} caratteri analizzati
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ padding:"10px 12px", borderTop:"1px solid rgba(255,255,255,0.06)", flexShrink:0, display:"flex", gap:8 }}>
                  <input
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => e.key==="Enter" && !e.shiftKey && question.trim() && runAnalysis(panel.file.path, question.trim())}
                    placeholder="Fai una domanda..."
                    style={{
                      flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
                      borderRadius:8, padding:"7px 10px", color:"var(--text)", fontSize:11,
                      fontFamily:"var(--font)", outline:"none",
                    }}
                  />
                  <button onClick={() => question.trim() && runAnalysis(panel.file.path, question.trim())} disabled={analyzing || !question.trim()}
                    style={{ background:"rgba(167,139,250,0.15)", border:"1px solid rgba(167,139,250,0.3)", borderRadius:8,
                      padding:"6px 12px", color:"#a78bfa", fontSize:11, cursor:"pointer", fontFamily:"var(--font)",
                      opacity:(analyzing || !question.trim()) ? 0.4 : 1 }}>
                    ↵
                  </button>
                </div>
              </>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

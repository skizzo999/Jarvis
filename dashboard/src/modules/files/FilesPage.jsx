import React, { useState, useEffect, useRef } from "react";

const API_URL = "/api";

const ANALYZABLE  = new Set(["txt","md","py","js","jsx","ts","tsx","json","csv","html","css","yaml","yml","sh","log","sql","pdf"]);
const TEXT_PREV   = new Set(["txt","md","py","js","jsx","ts","tsx","json","csv","html","css","yaml","yml","sh","log","sql","env","toml","ini","xml"]);
const IMAGE_PREV  = new Set(["jpg","jpeg","png","gif","webp","svg","bmp","ico"]);
const PDF_PREV    = new Set(["pdf"]);
const VIDEO_PREV  = new Set(["mp4","webm","mov","m4v","ogv"]);
const AUDIO_PREV  = new Set(["mp3","wav","ogg","m4a","aac","flac"]);
const FOLDERS     = ["inbox","scuola/informatica","scuola/sistemi","scuola/tpsi","scuola/gpoi","scuola/italiano","scuola/storia","scuola/inglese","personale"];

function ext(name) { return name.split(".").pop().toLowerCase(); }

function previewKind(name) {
  const e = ext(name);
  if (e === "md")        return "markdown";
  if (IMAGE_PREV.has(e)) return "image";
  if (PDF_PREV.has(e))   return "pdf";
  if (VIDEO_PREV.has(e)) return "video";
  if (AUDIO_PREV.has(e)) return "audio";
  if (TEXT_PREV.has(e))  return "text";
  return "unsupported";
}

function FileIcon({ name }) {
  const e = ext(name);
  const icons = { pdf:"📄", jpg:"🖼️", jpeg:"🖼️", png:"🖼️", webp:"🖼️", svg:"🖼️", gif:"🖼️", py:"🐍", js:"📜", jsx:"📜", ts:"📜", txt:"📝", md:"📝", zip:"🗜️", mp4:"🎬", mp3:"🎵" };
  return <span style={{ fontSize:14 }}>{icons[e] || "📎"}</span>;
}

// ── Markdown renderer (custom, zero deps) ────────────────────────────────────
// Supporta: # ## ### headings, ---, liste -/*/1., blockquote >
//           **bold**, *italic*, ==highlight==, ++underline++, ~~strike~~, `code`
function parseInline(text) {
  const tokens = [];
  const re = /(`[^`\n]+?`|\*\*[^*\n]+?\*\*|==[^=\n]+?==|\+\+[^+\n]+?\+\+|~~[^~\n]+?~~|(?<!\*)\*(?!\*)[^*\n]+?\*(?!\*)|(?<![a-z0-9])_[^_\n]+?_(?![a-z0-9]))/gi;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push(text.slice(last, m.index));
    const s = m[0];
    if (s.startsWith("`"))        tokens.push({ t:"code",      c: s.slice(1,-1) });
    else if (s.startsWith("**"))  tokens.push({ t:"bold",      c: s.slice(2,-2) });
    else if (s.startsWith("=="))  tokens.push({ t:"highlight", c: s.slice(2,-2) });
    else if (s.startsWith("++"))  tokens.push({ t:"underline", c: s.slice(2,-2) });
    else if (s.startsWith("~~"))  tokens.push({ t:"strike",    c: s.slice(2,-2) });
    else if (s.startsWith("*"))   tokens.push({ t:"italic",    c: s.slice(1,-1) });
    else                          tokens.push({ t:"italic",    c: s.slice(1,-1) });
    last = m.index + s.length;
  }
  if (last < text.length) tokens.push(text.slice(last));
  return tokens;
}

function renderTokens(tokens, keyPrefix="") {
  return tokens.map((tk, i) => {
    const k = `${keyPrefix}${i}`;
    if (typeof tk === "string") return <React.Fragment key={k}>{tk}</React.Fragment>;
    const { t, c } = tk;
    switch (t) {
      case "bold":      return <strong key={k} style={{ color:"#fff", fontWeight:700 }}>{c}</strong>;
      case "italic":    return <em key={k} style={{ color:"rgba(255,255,255,0.78)" }}>{c}</em>;
      case "highlight": return <mark key={k} style={{ background:"rgba(251,191,36,0.22)", color:"#fde68a", padding:"1px 5px", borderRadius:4, fontWeight:600 }}>{c}</mark>;
      case "underline": return <span key={k} style={{ color:"#60a5fa", borderBottom:"1.5px solid rgba(96,165,250,0.55)", paddingBottom:1, fontWeight:500 }}>{c}</span>;
      case "strike":    return <del key={k} style={{ color:"rgba(248,113,113,0.65)" }}>{c}</del>;
      case "code":      return <code key={k} style={{ fontFamily:"'JetBrains Mono','Courier New',monospace", background:"rgba(129,140,248,0.16)", color:"#a5b4fc", padding:"1px 6px", borderRadius:4, fontSize:"0.9em" }}>{c}</code>;
      default: return null;
    }
  });
}

function Markdown({ children }) {
  const text = children || "";
  const lines = text.split("\n");
  const blocks = [];
  const isListLine   = l => /^[-*]\s+/.test(l) || /^\d+\.\s+/.test(l);
  const isHeading    = l => /^#{1,6}\s+/.test(l);
  const isHr         = l => /^(-{3,}|\*{3,})\s*$/.test(l);
  const isQuote      = l => l.startsWith(">");
  const isTableRow   = l => /^\s*\|.*\|\s*$/.test(l);
  const isTableSep   = l => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
  const parseRow     = l => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { blocks.push({ kind:"h", level:h[1].length, text:h[2] }); i++; continue; }
    if (isHr(line)) { blocks.push({ kind:"hr" }); i++; continue; }
    // Table (header + separator + body rows)
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = parseRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      blocks.push({ kind:"table", header, rows });
      continue;
    }
    if (isListLine(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && lines[i].trim() && isListLine(lines[i])) {
        items.push(lines[i].replace(/^([-*]|\d+\.)\s+/, ""));
        i++;
      }
      blocks.push({ kind:"list", ordered, items });
      continue;
    }
    if (isQuote(line)) {
      const qs = [];
      while (i < lines.length && isQuote(lines[i])) { qs.push(lines[i].replace(/^>\s?/, "")); i++; }
      blocks.push({ kind:"quote", text: qs.join(" ") });
      continue;
    }
    // paragraph: aggrega righe consecutive non-speciali
    const para = [line]; i++;
    while (i < lines.length && lines[i].trim()
      && !isHeading(lines[i]) && !isListLine(lines[i]) && !isHr(lines[i])
      && !isQuote(lines[i]) && !isTableRow(lines[i])) {
      para.push(lines[i]); i++;
    }
    blocks.push({ kind:"p", text: para.join(" ") });
  }

  return (
    <div style={{ fontFamily:"var(--font)", color:"var(--text)", fontSize:12, lineHeight:1.6 }}>
      {blocks.map((b, idx) => {
        if (b.kind === "h") {
          const styles = {
            1: { fontSize:17,   color:"var(--files-accent)", borderBottom:"1px solid rgba(251,191,36,0.25)", paddingBottom:4 },
            2: { fontSize:14,   color:"#a5b4fc" },
            3: { fontSize:12.5, color:"#60a5fa" },
            4: { fontSize:12,   color:"#34d399" },
            5: { fontSize:11.5, color:"rgba(255,255,255,0.75)", textTransform:"uppercase", letterSpacing:"0.5px" },
            6: { fontSize:11,   color:"rgba(255,255,255,0.55)", textTransform:"uppercase", letterSpacing:"0.5px" },
          }[b.level];
          const Tag = `h${b.level}`;
          return (
            <Tag key={idx} style={{ margin:"14px 0 6px", fontWeight:700, ...styles }}>
              {renderTokens(parseInline(b.text), `b${idx}-`)}
            </Tag>
          );
        }
        if (b.kind === "table") {
          return (
            <div key={idx} style={{ overflow:"auto", margin:"10px 0" }}>
              <table style={{ borderCollapse:"collapse", fontSize:11, width:"100%", minWidth:"max-content" }}>
                <thead>
                  <tr>
                    {b.header.map((h, hi) => (
                      <th key={hi} style={{
                        padding:"7px 10px", textAlign:"left", whiteSpace:"nowrap",
                        borderBottom:"2px solid rgba(251,191,36,0.4)",
                        color:"var(--files-accent)", fontWeight:700, fontSize:10.5,
                        background:"rgba(251,191,36,0.06)",
                      }}>
                        {renderTokens(parseInline(h), `b${idx}-h${hi}-`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, ri) => (
                    <tr key={ri} style={{ background: ri % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                      {r.map((c, ci) => (
                        <td key={ci} style={{
                          padding:"6px 10px", verticalAlign:"top",
                          borderBottom:"1px solid rgba(255,255,255,0.05)",
                          color:"var(--text)",
                        }}>
                          {renderTokens(parseInline(c), `b${idx}-r${ri}-c${ci}-`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (b.kind === "hr") {
          return <hr key={idx} style={{ border:"none", borderTop:"1px dashed rgba(255,255,255,0.12)", margin:"12px 0" }}/>;
        }
        if (b.kind === "list") {
          const Tag = b.ordered ? "ol" : "ul";
          return (
            <Tag key={idx} style={{ margin:"4px 0 8px", paddingLeft:22 }}>
              {b.items.map((it, ii) => (
                <li key={ii} style={{ margin:"3px 0", lineHeight:1.55 }}>
                  {renderTokens(parseInline(it), `b${idx}-i${ii}-`)}
                </li>
              ))}
            </Tag>
          );
        }
        if (b.kind === "quote") {
          return (
            <blockquote key={idx} style={{
              margin:"8px 0", padding:"4px 10px",
              borderLeft:"3px solid var(--files-accent)",
              color:"rgba(255,255,255,0.7)", fontStyle:"italic",
              background:"rgba(251,191,36,0.04)", borderRadius:"0 6px 6px 0",
            }}>
              {renderTokens(parseInline(b.text), `b${idx}-`)}
            </blockquote>
          );
        }
        return (
          <p key={idx} style={{ margin:"6px 0" }}>
            {renderTokens(parseInline(b.text), `b${idx}-`)}
          </p>
        );
      })}
    </div>
  );
}

export default function FilesPage() {
  const [tree, setTree]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [openFolders, setOpen]    = useState({});
  const [sending, setSending]     = useState(null);

  // panel: null | { file:{path,name} }  — side panel AI
  const [panel, setPanel]         = useState(null);

  // AI state
  const [question, setQuestion]   = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult]   = useState(null);

  // Preview modal state: null | { file, kind, text?, loading? }
  const [previewModal, setPreviewModal] = useState(null);

  // Upload state
  const [uploadFolder, setUploadFolder] = useState("inbox");
  const [uploading, setUploading]       = useState(false);
  const [uploadMsg, setUploadMsg]       = useState(null); // { ok, text }
  const fileInputRef = useRef(null);

  // Move/Delete modals: null | { action:"move"|"delete", file, dest? }
  const [modal, setModal]       = useState(null);
  const [actionBusy, setBusy]   = useState(false);

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
    setPanel({ file });
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
    const kind = previewKind(file.name);
    const needsFetch = kind === "text" || kind === "markdown";
    if (!needsFetch) {
      setPreviewModal({ file, kind });
      return;
    }
    setPreviewModal({ file, kind, loading: true });
    try {
      const r = await fetch(`${API_URL}/storage/download?path=${encodeURIComponent(file.path)}`);
      const text = await r.text();
      setPreviewModal({ file, kind, text: text.slice(0, 20000) });
    } catch {
      setPreviewModal({ file, kind, text: "⚠️ Impossibile caricare il file" });
    }
  };

  // ── Move / Delete ─────────────────────────────────────────────────────────
  const confirmMove = async () => {
    if (!modal?.file || !modal.dest) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/storage/move`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ path: modal.file.path, dest_folder: modal.dest }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Errore spostamento");
      if (panel?.file?.path === modal.file.path) setPanel(null);
      setModal(null);
      refreshTree();
    } catch(e) { alert(e.message); }
    finally { setBusy(false); }
  };

  const confirmDelete = async () => {
    if (!modal?.file) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/storage/delete`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ path: modal.file.path }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Errore eliminazione");
      if (panel?.file?.path === modal.file.path) setPanel(null);
      setModal(null);
      refreshTree();
    } catch(e) { alert(e.message); }
    finally { setBusy(false); }
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
  const canPreview  = name => previewKind(name) !== "unsupported";

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
              style={{ background:"rgba(251,191,36,0.08)",
                border:"1px solid rgba(251,191,36,0.25)", borderRadius:8, padding:"4px 9px",
                color:"#fbbf24", fontSize:10, cursor:"pointer", fontFamily:"var(--font)" }}>
              👁
            </button>
          )}
          {canAnalyze(item.name) && (
            <button onClick={() => openAI(item)}
              style={{ background: panel?.file?.path===item.path ? "rgba(167,139,250,0.2)" : "rgba(167,139,250,0.10)",
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
          <button onClick={() => setModal({ action:"move", file:item, dest:FOLDERS[0] })}
            title="Sposta"
            style={{ background:"rgba(251,146,60,0.08)", border:"1px solid rgba(251,146,60,0.25)", borderRadius:8, padding:"4px 9px", color:"#fb923c", fontSize:10, cursor:"pointer", fontFamily:"var(--font)" }}>
            ↔
          </button>
          <button onClick={() => setModal({ action:"delete", file:item })}
            title="Elimina"
            style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.25)", borderRadius:8, padding:"4px 9px", color:"#f87171", fontSize:10, cursor:"pointer", fontFamily:"var(--font)" }}>
            🗑
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

      {/* Body — tree a tutta larghezza */}
      <div className="glass" style={{ flex:1, minHeight:0, overflowY:"auto" }}>
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

      {/* Modale Move / Delete */}
      {modal && (
        <div
          onClick={() => !actionBusy && setModal(null)}
          style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", backdropFilter:"blur(6px)",
            display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            className="glass"
            style={{ maxWidth:380, width:"100%", padding:20, display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ fontSize:14, fontWeight:600, color:"var(--text)", fontFamily:"var(--font)" }}>
              {modal.action === "move" ? "Sposta file" : "Elimina file"}
            </div>
            <div style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--font)", wordBreak:"break-all" }}>
              {modal.file.path}
            </div>

            {modal.action === "move" && (
              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                <label style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--font)" }}>Cartella di destinazione</label>
                <select
                  value={modal.dest}
                  onChange={e => setModal({ ...modal, dest: e.target.value })}
                  style={{
                    background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
                    borderRadius:8, padding:"7px 10px", color:"var(--text)",
                    fontSize:11, fontFamily:"var(--font)", outline:"none",
                  }}>
                  {FOLDERS.map(f => <option key={f} value={f} style={{ background:"#0d0d1a" }}>{f}</option>)}
                </select>
              </div>
            )}

            {modal.action === "delete" && (
              <div style={{ fontSize:12, color:"var(--text)", fontFamily:"var(--font)", lineHeight:1.5 }}>
                Sei sicuro di voler eliminare <strong>{modal.file.name}</strong>? L'operazione è irreversibile.
              </div>
            )}

            <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:4 }}>
              <button
                onClick={() => setModal(null)}
                disabled={actionBusy}
                style={{
                  background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
                  borderRadius:8, padding:"6px 14px", color:"var(--muted)",
                  fontSize:11, cursor:"pointer", fontFamily:"var(--font)",
                }}>
                Annulla
              </button>
              <button
                onClick={modal.action === "move" ? confirmMove : confirmDelete}
                disabled={actionBusy || (modal.action === "move" && !modal.dest)}
                style={{
                  background: modal.action === "delete" ? "rgba(248,113,113,0.18)" : "rgba(251,146,60,0.18)",
                  border: `1px solid ${modal.action === "delete" ? "rgba(248,113,113,0.4)" : "rgba(251,146,60,0.4)"}`,
                  borderRadius:8, padding:"6px 14px",
                  color: modal.action === "delete" ? "#f87171" : "#fb923c",
                  fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"var(--font)",
                  opacity: actionBusy ? 0.5 : 1,
                }}>
                {actionBusy ? "…" : (modal.action === "move" ? "Sposta" : "Elimina")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Anteprima */}
      {previewModal && (() => {
        const { file, kind, text, loading: pLoading } = previewModal;
        const url = `${API_URL}/storage/download?path=${encodeURIComponent(file.path)}&inline=1`;
        return (
          <div
            onClick={() => setPreviewModal(null)}
            style={{
              position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)",
              display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20,
            }}>
            <div
              onClick={e => e.stopPropagation()}
              className="glass"
              style={{
                width:"min(1100px, 95vw)", height:"min(800px, 90vh)",
                display:"flex", flexDirection:"column", overflow:"hidden",
              }}>
              {/* header */}
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
                <FileIcon name={file.name}/>
                <span style={{ flex:1, fontSize:12, fontWeight:600, color:"var(--text)", fontFamily:"var(--font)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {file.name}
                </span>
                <button onClick={() => window.open(`${API_URL}/storage/download?path=${encodeURIComponent(file.path)}`, "_blank")}
                  style={{ background:"rgba(96,165,250,0.10)", border:"1px solid rgba(96,165,250,0.25)", borderRadius:8, padding:"4px 10px", color:"var(--blue)", fontSize:11, cursor:"pointer", fontFamily:"var(--font)" }}>
                  ⬇ Scarica
                </button>
                <button onClick={() => setPreviewModal(null)}
                  style={{ background:"transparent", border:"none", color:"var(--muted)", fontSize:18, cursor:"pointer", padding:"0 8px", lineHeight:1 }}>
                  ✕
                </button>
              </div>
              {/* body */}
              <div style={{
                flex:1, minHeight:0, overflow: kind === "pdf" ? "hidden" : "auto",
                display:"flex", alignItems: (kind==="image"||kind==="audio"||kind==="unsupported") ? "center" : "stretch",
                justifyContent:"center", padding: kind === "pdf" ? 0 : 16, background: kind === "pdf" ? "#2a2a2a" : "transparent",
              }}>
                {pLoading && (
                  <div style={{ color:"var(--muted)", fontSize:13, fontFamily:"var(--font)" }}>Caricamento...</div>
                )}
                {!pLoading && kind === "image" && (
                  <img src={url} alt={file.name}
                    style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain", borderRadius:8 }}/>
                )}
                {!pLoading && kind === "pdf" && (
                  <iframe src={url} title={file.name}
                    style={{ flex:1, border:"none", width:"100%", height:"100%", background:"#fff" }}/>
                )}
                {!pLoading && kind === "video" && (
                  <video src={url} controls autoPlay
                    style={{ maxWidth:"100%", maxHeight:"100%", borderRadius:8 }}/>
                )}
                {!pLoading && kind === "audio" && (
                  <audio src={url} controls autoPlay
                    style={{ width:"80%" }}/>
                )}
                {!pLoading && kind === "text" && (
                  <pre style={{
                    fontSize:12, color:"var(--text)", fontFamily:"'Courier New', monospace",
                    lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-all", margin:0,
                    background:"rgba(255,255,255,0.03)", borderRadius:8, padding:16,
                    width:"100%", alignSelf:"flex-start",
                  }}>{text}</pre>
                )}
                {!pLoading && kind === "markdown" && (
                  <div style={{
                    width:"100%", alignSelf:"flex-start", padding:"4px 8px",
                    maxWidth:900, margin:"0 auto",
                  }}>
                    <Markdown>{text}</Markdown>
                  </div>
                )}
                {!pLoading && kind === "unsupported" && (
                  <div style={{ fontSize:13, color:"var(--muted)", fontFamily:"var(--font)", textAlign:"center" }}>
                    Anteprima non disponibile per questo formato.<br/>Usa ⬇ Scarica per aprirlo.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modale AI */}
      {panel && (
        <div
          onClick={() => setPanel(null)}
          style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)",
            display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            className="glass"
            style={{
              width:"min(900px, 95vw)", height:"min(780px, 90vh)",
              display:"flex", flexDirection:"column", overflow:"hidden",
            }}>
            {/* header */}
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
              <div style={{
                width:26, height:26, borderRadius:8,
                background:"rgba(167,139,250,0.15)", border:"1px solid rgba(167,139,250,0.3)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:11, fontWeight:700, color:"#a78bfa", fontFamily:"var(--font)",
              }}>AI</div>
              <FileIcon name={panel.file.name}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"var(--text)", fontFamily:"var(--font)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {panel.file.name}
                </div>
                <div style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--font)" }}>
                  Analisi documentale
                </div>
              </div>
              <button onClick={() => setPanel(null)}
                style={{ background:"transparent", border:"none", color:"var(--muted)", fontSize:18, cursor:"pointer", padding:"0 8px", lineHeight:1 }}>
                ✕
              </button>
            </div>

            {/* content */}
            <div style={{ flex:1, minHeight:0, overflowY:"auto", padding:"18px 24px" }}>
              {analyzing && (
                <div style={{ display:"flex", alignItems:"center", gap:10, color:"var(--muted)", fontSize:13, fontFamily:"var(--font)" }}>
                  <div style={{ width:9, height:9, borderRadius:"50%", background:"#a78bfa", animation:"breathe 1s ease-in-out infinite" }}/>
                  Analisi in corso...
                </div>
              )}
              {!analyzing && aiResult && (
                <div style={{ wordBreak:"break-word", maxWidth:780, margin:"0 auto" }}>
                  <Markdown>{aiResult.answer}</Markdown>
                  {aiResult.chars_analyzed > 0 && (
                    <div style={{ marginTop:16, fontSize:10, color:"var(--muted)", borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:10, fontFamily:"var(--font)" }}>
                      {aiResult.chars_analyzed.toLocaleString()} caratteri analizzati
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* input */}
            <div style={{ padding:"12px 16px", borderTop:"1px solid rgba(255,255,255,0.06)", flexShrink:0, display:"flex", gap:10 }}>
              <input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key==="Enter" && !e.shiftKey && question.trim() && runAnalysis(panel.file.path, question.trim())}
                placeholder="Fai una domanda specifica su questo documento..."
                style={{
                  flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
                  borderRadius:9, padding:"9px 13px", color:"var(--text)", fontSize:12,
                  fontFamily:"var(--font)", outline:"none",
                }}
              />
              <button onClick={() => question.trim() && runAnalysis(panel.file.path, question.trim())}
                disabled={analyzing || !question.trim()}
                style={{
                  background:"rgba(167,139,250,0.15)", border:"1px solid rgba(167,139,250,0.35)",
                  borderRadius:9, padding:"8px 18px", color:"#a78bfa",
                  fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"var(--font)",
                  opacity:(analyzing || !question.trim()) ? 0.4 : 1,
                }}>
                Invia
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

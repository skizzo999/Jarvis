import React, { useState, useEffect } from "react";

const API_URL = "https://api.matteolizzo.it";

function FileIcon({ name }) {
  const ext = name.split(".").pop().toLowerCase();
  const icons = { pdf:"📄", jpg:"🖼️", jpeg:"🖼️", png:"🖼️", py:"🐍", js:"📜", jsx:"📜", ts:"📜", txt:"📝", md:"📝", zip:"🗜️", mp4:"🎬", mp3:"🎵" };
  return <span style={{ fontSize:14 }}>{icons[ext] || "📎"}</span>;
}

export default function FilesPage() {
  const [tree, setTree]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [openFolders, setOpen]  = useState({});
  const [sending, setSending]   = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API_URL}/storage/files`);
        setTree(await r.json());
      } catch { setTree([]); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const toggleFolder = (path) => setOpen(o => ({ ...o, [path]: !o[path] }));

  const sendTelegram = async (path) => {
    setSending(path);
    try {
      const r = await fetch(`${API_URL}/storage/send-telegram`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ path }),
      });
      if (r.ok) alert("File inviato su Telegram!");
      else alert("Errore invio");
    } catch { alert("Errore di connessione"); }
    finally { setSending(null); }
  };

  const downloadFile = (path) => {
    window.open(`${API_URL}/storage/download?path=${encodeURIComponent(path)}`, "_blank");
  };

  const renderItem = (item, depth=0) => {
    const pad = depth * 16;
    if (item.type === "folder") {
      const isOpen = openFolders[item.path];
      return (
        <div key={item.path}>
          <div onClick={() => toggleFolder(item.path)} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 16px", paddingLeft: 16+pad, cursor:"pointer", borderBottom:"1px solid rgba(255,255,255,0.04)", transition:"background 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.03)"}
            onMouseLeave={e => e.currentTarget.style.background="transparent"}
          >
            <span style={{ fontSize:14 }}>{isOpen ? "📂" : "📁"}</span>
            <span style={{ fontSize:12, fontWeight:600, color:"var(--text)", fontFamily:"var(--font)", flex:1 }}>{item.name}</span>
            <span style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--font)" }}>{item.children?.length} elementi</span>
            <span style={{ fontSize:10, color:"var(--muted)", transform: isOpen?"rotate(180deg)":"rotate(0deg)", transition:"transform 0.2s", display:"inline-block" }}>▼</span>
          </div>
          {isOpen && item.children?.map(child => renderItem(child, depth+1))}
        </div>
      );
    }
    return (
      <div key={item.path} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 16px", paddingLeft: 16+pad, borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
        <FileIcon name={item.name}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:500, color:"var(--text)", fontFamily:"var(--font)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
          <div style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--font)" }}>{item.size}</div>
        </div>
        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
          <button onClick={() => downloadFile(item.path)} title="Scarica" style={{ background:"rgba(96,165,250,0.10)", border:"1px solid rgba(96,165,250,0.2)", borderRadius:8, padding:"4px 10px", color:"var(--blue)", fontSize:10, cursor:"pointer", fontFamily:"var(--font)" }}>
            ⬇ Download
          </button>
          <button onClick={() => sendTelegram(item.path)} disabled={sending===item.path} title="Invia su Telegram" style={{ background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:8, padding:"4px 10px", color:"var(--green)", fontSize:10, cursor:"pointer", fontFamily:"var(--font)", opacity: sending===item.path?0.5:1 }}>
            {sending===item.path ? "…" : "✈ Telegram"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, height:"100%", minHeight:0 }}>
      <div style={{ flexShrink:0 }}>
        <div style={{ fontFamily:"var(--font-serif)", fontStyle:"italic", fontSize:22, color:"var(--text)" }}>
          File <span style={{ color:"var(--files-accent)" }}>Storage</span>
        </div>
        <div style={{ fontSize:10, color:"var(--muted)", marginTop:2 }}>
          /home/jarvis/storage
        </div>
      </div>
      <div className="glass" style={{ flex:1, overflowY:"auto" }}>
        {loading && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:120, color:"var(--muted)", fontSize:13, fontFamily:"var(--font)" }}>
            Caricamento...
          </div>
        )}
        {!loading && tree.length === 0 && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:120, gap:8 }}>
            <span style={{ fontSize:32 }}>📁</span>
            <span style={{ fontSize:13, color:"var(--muted)", fontFamily:"var(--font)" }}>Nessun file trovato</span>
          </div>
        )}
        {tree.map(item => renderItem(item))}
      </div>
    </div>
  );
}

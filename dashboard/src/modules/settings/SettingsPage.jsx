import React from "react";

export default function SettingsPage() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, height:"100%", minHeight:0 }}>
      <div>
        <div style={{ fontFamily:"var(--font-serif)", fontStyle:"italic", fontSize:22, color:"var(--text)" }}>
          Impo<span style={{ color:"var(--settings-accent)" }}>stazioni</span>
        </div>
        <div style={{ fontSize:10, color:"var(--muted)", marginTop:2 }}>In arrivo</div>
      </div>
      <div className="glass" style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>⚙️</div>
          <div style={{ fontSize:14, color:"var(--muted)", fontFamily:"var(--font)" }}>Impostazioni disponibili con i prossimi moduli</div>
        </div>
      </div>
    </div>
  );
}

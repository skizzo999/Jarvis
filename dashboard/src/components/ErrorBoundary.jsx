import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[Jarvis ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="glass" style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 14, height: "100%", padding: 32, textAlign: "center",
      }}>
        <span style={{ fontSize: 36 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", fontFamily: "var(--font)", marginBottom: 6 }}>
            Errore nel modulo
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font)", maxWidth: 280 }}>
            {this.state.error?.message || "Qualcosa è andato storto."}
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 10, padding: "8px 20px", color: "var(--text)",
            fontSize: 12, fontFamily: "var(--font)", cursor: "pointer",
          }}
        >
          ↺ Riprova
        </button>
      </div>
    );
  }
}

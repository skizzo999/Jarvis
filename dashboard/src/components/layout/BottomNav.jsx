import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const MODULES = [
  { id: 'cashflow',  label: 'Cash Flow', icon: '💰', path: '/' },
  { id: 'calendar',  label: 'Calendario', icon: '📅', path: '/calendar' },
  { id: 'fitness',   label: 'Fitness',    icon: '💪', path: '/fitness' },
  { id: 'files',     label: 'File',       icon: '📁', path: '/files' },
  { id: 'settings',  label: 'Settings',   icon: '⚙️',  path: '/settings' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const active = (path) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/cashflow';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <style>{`
        .jnav {
          position: relative; z-index: 10;
          display: flex; align-items: center; justify-content: center;
          gap: 4px; padding: 8px 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          backdrop-filter: blur(40px);
          border-radius: 40px;
          width: fit-content; max-width: calc(100vw - 24px);
          margin: 0 auto;
        }
        .jnav-btn {
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          border-radius: 14px;
          padding: 8px 18px; cursor: pointer;
          transition: all 0.2s ease;
          flex: 1; min-width: 0;
        }
        .jnav-icon { font-size: 18px; line-height: 1; }
        .jnav-label {
          font-size: 10px; font-weight: 600; letter-spacing: 0.4px;
          font-family: var(--font); text-transform: uppercase;
          transition: color 0.2s; white-space: nowrap;
        }
        @media (max-width: 600px) {
          .jnav { gap: 2px; padding: 6px 8px; }
          .jnav-btn { padding: 8px 12px; }
          .jnav-label { display: none; }
          .jnav-icon { font-size: 22px; }
        }
      `}</style>
      <nav className="jnav">
        {MODULES.map(m => (
          <button
            key={m.id}
            onClick={() => navigate(m.path)}
            className="jnav-btn"
            style={{
              background: active(m.path) ? 'rgba(255,255,255,0.10)' : 'none',
              border: active(m.path) ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
            }}
          >
            <span className="jnav-icon">{m.icon}</span>
            <span className="jnav-label" style={{
              color: active(m.path) ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
            }}>{m.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

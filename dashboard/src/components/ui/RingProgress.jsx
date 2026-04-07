import React from "react";

export default function RingProgress({ rings, size = 120 }) {
  const cx = size / 2;
  const gap = 10;
  const strokeW = 8;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      {rings.map((ring, i) => {
        const r = cx - strokeW / 2 - i * (strokeW + gap);
        const circ = 2 * Math.PI * r;
        const dash = (ring.pct / 100) * circ;
        return (
          <g key={i}>
            <circle cx={cx} cy={cx} r={r}
              fill="none" stroke="rgba(255,255,255,0.07)"
              strokeWidth={strokeW} />
            <circle cx={cx} cy={cx} r={r}
              fill="none" stroke={ring.color}
              strokeWidth={strokeW}
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${ring.color})`, transition: "stroke-dasharray 0.8s ease" }}
            />
          </g>
        );
      })}
    </svg>
  );
}

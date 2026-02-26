"use client";

import { useState } from "react";

interface ProtractorProps {
  onClose?: () => void;
}

function snap5(value: number): number {
  return Math.round(value / 5) * 5;
}

export default function Protractor({ onClose }: ProtractorProps) {
  const [angle, setAngle] = useState(45);
  const [fullCircle, setFullCircle] = useState(false);

  const maxAngle = fullCircle ? 360 : 180;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Protractor</h3>
        <button type="button" aria-label="Close protractor" className="rounded border border-slate-600 px-2 py-1 text-xs" onClick={() => onClose?.()}>Close</button>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <button type="button" aria-label="Toggle full circle mode" className="rounded border border-slate-600 px-2 py-1" onClick={() => setFullCircle((v) => !v)}>
          {fullCircle ? "360°" : "180°"}
        </button>
        <label>
          Angle
          <input aria-label="Angle slider" type="range" min={0} max={maxAngle} step={1} value={angle} onChange={(e) => setAngle(snap5(Number(e.target.value)))} />
        </label>
        <span>{angle}°</span>
      </div>

      <svg
        aria-label="Interactive protractor"
        viewBox="0 0 260 160"
        className="w-full rounded bg-slate-900"
        onMouseMove={(e) => {
          if (e.buttons !== 1) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + (fullCircle ? rect.height / 2 : rect.height - 12);
          const dx = e.clientX - cx;
          const dy = cy - e.clientY;
          const radians = Math.atan2(dy, dx);
          let deg = (radians * 180) / Math.PI;
          if (deg < 0) deg += 360;
          const next = snap5(fullCircle ? deg : Math.min(180, Math.max(0, deg)));
          setAngle(next);
        }}
      >
        <path d="M20 140 A110 110 0 0 1 240 140" fill="none" stroke="#e2e8f0" strokeWidth="2" />
        {fullCircle && <circle cx="130" cy="80" r="60" fill="none" stroke="#64748b" strokeDasharray="3 3" />}
        <line x1="130" y1={fullCircle ? "80" : "140"} x2={130 + 100 * Math.cos((Math.PI * angle) / 180)} y2={(fullCircle ? 80 : 140) - 100 * Math.sin((Math.PI * angle) / 180)} stroke="#22d3ee" strokeWidth="2" />
        <text x="130" y="20" textAnchor="middle" fill="#cbd5e1" fontSize="12">{angle}°</text>
      </svg>
    </div>
  );
}

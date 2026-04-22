"use client";

import { useState } from "react";

interface CoordinateGridProps {
  onClose?: () => void;
}

type Point = { id: string; x: number; y: number; label: string };

const LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export default function CoordinateGrid({ onClose }: CoordinateGridProps) {
  const [range, setRange] = useState(10);
  const [points, setPoints] = useState<Point[]>([]);
  const [connect, setConnect] = useState(true);
  const [inputX, setInputX] = useState("0");
  const [inputY, setInputY] = useState("0");

  const toCanvas = (v: number) => 160 + (v / range) * 130;
  const fromCanvas = (v: number) => Math.round((((v - 160) / 130) * range) * 10) / 10;

  const addPoint = (x: number, y: number) => {
    setPoints((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        x,
        y,
        label: LABELS[prev.length % LABELS.length],
      },
    ]);
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Coordinate Grid</h3>
        <button type="button" aria-label="Close coordinate grid" className="rounded border border-[var(--ll-border)] px-2 py-1 text-xs" onClick={() => onClose?.()}>Close</button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label>
          Range
          <input aria-label="Grid range" type="number" className="ml-1 w-16 rounded bg-[var(--ll-bg)] p-1" value={range} onChange={(e) => setRange(Math.max(2, Number(e.target.value || 10)))} />
        </label>
        <label>
          X
          <input aria-label="Manual X coordinate" type="number" className="ml-1 w-16 rounded bg-[var(--ll-bg)] p-1" value={inputX} onChange={(e) => setInputX(e.target.value)} />
        </label>
        <label>
          Y
          <input aria-label="Manual Y coordinate" type="number" className="ml-1 w-16 rounded bg-[var(--ll-bg)] p-1" value={inputY} onChange={(e) => setInputY(e.target.value)} />
        </label>
        <button type="button" aria-label="Add manual point" className="rounded border border-[var(--ll-border)] px-2 py-1" onClick={() => addPoint(Number(inputX), Number(inputY))}>Plot</button>
        <button type="button" aria-label="Toggle connect points" className="rounded border border-[var(--ll-border)] px-2 py-1" onClick={() => setConnect((v) => !v)}>{connect ? "Lines ON" : "Lines OFF"}</button>
        <button type="button" aria-label="Clear points" className="rounded border border-rose-600 px-2 py-1" onClick={() => setPoints([])}>Clear</button>
      </div>

      <svg
        aria-label="Coordinate grid"
        viewBox="0 0 320 320"
        className="w-full rounded bg-[var(--ll-bg)]"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = fromCanvas(e.clientX - rect.left);
          const y = -fromCanvas(e.clientY - rect.top);
          addPoint(x, y);
        }}
      >
        {Array.from({ length: range * 2 + 1 }).map((_, i) => {
          const value = -range + i;
          const c = toCanvas(value);
          return (
            <g key={i}>
              <line x1={c} y1="30" x2={c} y2="290" stroke="#334155" strokeWidth="1" />
              <line x1="30" y1={c} x2="290" y2={c} stroke="#334155" strokeWidth="1" />
            </g>
          );
        })}
        <line x1="160" y1="30" x2="160" y2="290" stroke="#e2e8f0" strokeWidth="2" />
        <line x1="30" y1="160" x2="290" y2="160" stroke="#e2e8f0" strokeWidth="2" />

        {connect && points.length > 1 && (
          <polyline fill="none" stroke="#38bdf8" strokeWidth="2" points={points.map((point) => `${toCanvas(point.x)},${toCanvas(-point.y)}`).join(" ")} />
        )}

        {points.map((point) => (
          <g key={point.id}>
            <circle cx={toCanvas(point.x)} cy={toCanvas(-point.y)} r="4" fill="#34d399" />
            <text x={toCanvas(point.x) + 6} y={toCanvas(-point.y) - 6} fontSize="10" fill="#f8fafc">{point.label}</text>
          </g>
        ))}

        <text x="246" y="48" fill="#cbd5e1" fontSize="10">I</text>
        <text x="68" y="48" fill="#cbd5e1" fontSize="10">II</text>
        <text x="68" y="276" fill="#cbd5e1" fontSize="10">III</text>
        <text x="246" y="276" fill="#cbd5e1" fontSize="10">IV</text>
      </svg>
    </div>
  );
}

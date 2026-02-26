"use client";

import { useRef, useState } from "react";

interface NumberLineProps {
  onClose?: () => void;
}

export default function NumberLine({ onClose }: NumberLineProps) {
  const [min, setMin] = useState(-10);
  const [max, setMax] = useState(10);
  const [value, setValue] = useState(0);
  const [decimalMode, setDecimalMode] = useState(false);
  const lineRef = useRef<SVGLineElement | null>(null);

  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const toX = (v: number) => 20 + ((v - min) / (max - min || 1)) * 280;
  const fromClientX = (clientX: number) => {
    const rect = lineRef.current?.ownerSVGElement?.getBoundingClientRect();
    if (!rect) return value;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left - 20) / 280));
    const raw = min + ratio * (max - min);
    return clamp(decimalMode ? raw : Math.round(raw));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Number Line</h3>
        <button type="button" aria-label="Close number line" className="rounded border border-slate-600 px-2 py-1 text-xs" onClick={() => onClose?.()}>Close</button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <label>
          Min
          <input aria-label="Minimum value" type="number" className="ml-1 w-16 rounded bg-slate-900 p-1" value={min} onChange={(e) => setMin(Number(e.target.value || -10))} />
        </label>
        <label>
          Max
          <input aria-label="Maximum value" type="number" className="ml-1 w-16 rounded bg-slate-900 p-1" value={max} onChange={(e) => setMax(Number(e.target.value || 10))} />
        </label>
        <button type="button" aria-label="Toggle decimal mode" className="rounded border border-slate-600 px-2" onClick={() => setDecimalMode((v) => !v)}>
          {decimalMode ? "Decimal" : "Integer"}
        </button>
        <button type="button" aria-label="Zoom in" className="rounded border border-slate-600 px-2" onClick={() => { setMin((v) => v + 1); setMax((v) => v - 1); }}>
          Zoom +
        </button>
        <button type="button" aria-label="Zoom out" className="rounded border border-slate-600 px-2" onClick={() => { setMin((v) => v - 1); setMax((v) => v + 1); }}>
          Zoom -
        </button>
      </div>

      <svg
        aria-label="Interactive number line"
        viewBox="0 0 320 90"
        className="w-full rounded bg-slate-900"
        onClick={(e) => setValue(fromClientX(e.clientX))}
        onMouseMove={(e) => {
          if (e.buttons !== 1) return;
          setValue(fromClientX(e.clientX));
        }}
      >
        <line ref={lineRef} x1="20" y1="45" x2="300" y2="45" stroke="#e2e8f0" strokeWidth="2" />
        {Array.from({ length: 11 }).map((_, i) => {
          const x = 20 + i * 28;
          const tickVal = min + ((max - min) / 10) * i;
          return (
            <g key={i}>
              <line x1={x} y1="38" x2={x} y2="52" stroke="#94a3b8" />
              <text x={x} y="68" textAnchor="middle" fill="#cbd5e1" fontSize="9">
                {decimalMode ? tickVal.toFixed(1) : Math.round(tickVal)}
              </text>
            </g>
          );
        })}
        <circle cx={toX(value)} cy="45" r="7" fill="#34d399" />
      </svg>

      <p className="text-sm">Marker value: {decimalMode ? value.toFixed(2) : Math.round(value)}</p>
    </div>
  );
}

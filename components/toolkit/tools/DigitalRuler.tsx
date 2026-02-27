"use client";

import { useState } from "react";

interface DigitalRulerProps {
  onClose?: () => void;
}

export default function DigitalRuler({ onClose }: DigitalRulerProps) {
  const [lengthCm, setLengthCm] = useState(15);
  const [vertical, setVertical] = useState(false);

  const pxPerCm = 20;
  const longSide = Math.max(100, lengthCm * pxPerCm);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Digital Ruler</h3>
        <button type="button" aria-label="Close digital ruler" className="rounded border border-slate-600 px-2 py-1 text-xs" onClick={() => onClose?.()}>Close</button>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <button type="button" aria-label="Toggle ruler orientation" className="rounded border border-slate-600 px-2 py-1" onClick={() => setVertical((v) => !v)}>
          {vertical ? "Vertical" : "Horizontal"}
        </button>
        <label>
          Length: {lengthCm.toFixed(1)} cm
          <input aria-label="Ruler length" type="range" min={1} max={30} step={0.1} value={lengthCm} onChange={(e) => setLengthCm(Number(e.target.value))} />
        </label>
      </div>

      <div
        className="relative inline-flex rounded border border-slate-700 bg-amber-100 text-slate-900"
        style={vertical ? { width: 56, height: longSide } : { width: longSide, height: 56 }}
      >
        <svg aria-label="Ruler markings" width="100%" height="100%" viewBox={vertical ? `0 0 56 ${longSide}` : `0 0 ${longSide} 56`}>
          {Array.from({ length: Math.floor(lengthCm * 10) + 1 }).map((_, i) => {
            const isCm = i % 10 === 0;
            const isFive = i % 50 === 0;
            const pos = i * (pxPerCm / 10);
            if (vertical) {
              return (
                <g key={i}>
                  <line x1="56" y1={pos} x2={isCm ? 18 : 40} y2={pos} stroke="#111827" strokeWidth="1" />
                  {isCm && <text x="4" y={pos + 4} fontSize="8">{i / 10}</text>}
                  {isFive && <circle cx="10" cy={pos} r="1.5" fill="#ef4444" />}
                </g>
              );
            }
            return (
              <g key={i}>
                <line x1={pos} y1="56" x2={pos} y2={isCm ? 18 : 40} stroke="#111827" strokeWidth="1" />
                {isCm && <text x={pos + 1} y="10" fontSize="8">{i / 10}</text>}
                {isFive && <circle cx={pos} cy="12" r="1.5" fill="#ef4444" />}
              </g>
            );
          })}
        </svg>
        <div
          aria-label="Drag handle for ruler resize"
          role="slider"
          aria-valuemin={1}
          aria-valuemax={30}
          aria-valuenow={Number(lengthCm.toFixed(1))}
          aria-orientation={vertical ? "vertical" : "horizontal"}
          tabIndex={0}
          className="absolute h-4 w-4 rounded-full bg-sky-600"
          style={vertical ? { left: 20, bottom: -8 } : { right: -8, top: 20 }}
          onMouseDown={(e) => {
            e.preventDefault();
            const start = lengthCm;
            const startPoint = vertical ? e.clientY : e.clientX;
            const move = (event: MouseEvent) => {
              const delta = (vertical ? startPoint - event.clientY : event.clientX - startPoint) / pxPerCm;
              setLengthCm(Math.max(1, Math.min(30, start + delta)));
            };
            const stop = () => {
              window.removeEventListener("mousemove", move);
              window.removeEventListener("mouseup", stop);
            };
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", stop);
          }}
        />
      </div>

      <p className="text-sm">Measured length: {lengthCm.toFixed(1)} cm</p>
    </div>
  );
}

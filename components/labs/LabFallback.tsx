"use client";

import { useEffect, useRef } from "react";

function flattenState(state: unknown): Array<[string, string]> {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return [["state", String(state ?? "not available")]];
  }

  return Object.entries(state as Record<string, unknown>).map(([key, value]) => [
    key,
    typeof value === "number" ? value.toFixed(2) : String(value),
  ]);
}

export default function LabFallback({
  labId,
  state,
}: {
  labId: string;
  state: unknown;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const values = flattenState(state);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#020617";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#34d399";
    context.lineWidth = 2;
    context.strokeRect(18, 18, width - 36, height - 36);

    values.slice(0, 5).forEach(([key, value], index) => {
      const numeric = Number(value);
      const magnitude = Number.isFinite(numeric) ? Math.min(1, Math.abs(numeric) / 100) : 0.35;
      const x = 34;
      const y = 52 + index * 34;
      context.fillStyle = "#1e293b";
      context.fillRect(x, y, width - 68, 16);
      context.fillStyle = "#38bdf8";
      context.fillRect(x, y, Math.max(16, (width - 68) * magnitude), 16);
      context.fillStyle = "#e2e8f0";
      context.font = "12px sans-serif";
      context.fillText(`${key}: ${value}`, x, y - 8);
    });
  }, [values]);

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-950 p-4 text-slate-50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            2D fallback
          </p>
          <h3 className="mt-1 text-base font-semibold">Lab view: {labId}</h3>
        </div>
        <span className="rounded-full border border-cyan-400/40 px-3 py-1 text-xs text-cyan-100">
          WebGL unavailable
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={560}
        height={240}
        className="mt-4 h-48 w-full rounded-xl border border-slate-800 bg-slate-950"
        aria-label="Two dimensional lab visualization"
      />
      <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {values.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-slate-900 px-3 py-2">
            <dt className="text-slate-400">{key}</dt>
            <dd className="font-medium text-slate-100">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

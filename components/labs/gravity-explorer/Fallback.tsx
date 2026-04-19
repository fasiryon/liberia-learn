"use client";

import { useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, SeparatorHorizontal } from "lucide-react";
import type { GravityLabAction } from "@/lib/labs/gravity-explorer/actions";
import type { GravityLabState } from "@/lib/labs/gravity-explorer/state";

export default function GravityFallback({
  state,
  onAction,
}: {
  state: GravityLabState;
  onAction: (action: GravityLabAction) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const width = canvas.width;
    const height = canvas.height;
    const groundY = height - 42;
    const objectY = groundY - (state.height / 100) * (groundY - 24);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#08111f";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#22d3ee";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(24, groundY);
    context.lineTo(width - 24, groundY);
    context.stroke();

    context.fillStyle = "#f97316";
    context.beginPath();
    context.arc(width / 2, objectY, 14, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#1e293b";
    context.fillRect(28, 28, 18, groundY - 28);
    context.fillStyle = "#38bdf8";
    context.fillRect(28, objectY, 18, groundY - objectY);

    context.fillStyle = "#e2e8f0";
    context.font = "14px sans-serif";
    context.fillText(`Height ${state.height.toFixed(2)} m`, 58, 52);
    context.fillText(`Velocity ${state.velocity.toFixed(2)} m/s`, 58, 76);
    context.fillText(`Time ${state.time.toFixed(2)} s`, 58, 100);
  }, [state]);

  useEffect(() => {
    if (state.paused) {
      lastFrameRef.current = null;
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const tick = (timestamp: number) => {
      const previous = lastFrameRef.current ?? timestamp;
      lastFrameRef.current = timestamp;
      const dt = Math.min(1, Math.max(0.01, (timestamp - previous) / 1000));
      onAction({ type: "STEP", dt });
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = null;
      lastFrameRef.current = null;
    };
  }, [onAction, state.paused]);

  return (
    <section className="bg-slate-950 p-3 sm:p-4">
      <canvas
        ref={canvasRef}
        width={520}
        height={300}
        className="h-auto w-full rounded-2xl border border-slate-800 bg-slate-950"
        aria-label="Gravity Explorer fallback simulation"
      />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onAction(state.paused ? { type: "PLAY" } : { type: "PAUSE" })}
          className="ll-interactive inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[var(--ll-accent)] px-3 py-2 text-sm font-semibold text-slate-950"
        >
          {state.paused
            ? <><Play className="h-4 w-4" strokeWidth={1.5} />Play</>
            : <><Pause className="h-4 w-4" strokeWidth={1.5} />Pause</>}
        </button>
        <button
          type="button"
          onClick={() => onAction({ type: "STEP", dt: 0.1 })}
          className="ll-interactive inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--ll-border)] px-3 py-2 text-sm font-semibold text-[var(--ll-text)]"
        >
          <SeparatorHorizontal className="h-4 w-4" strokeWidth={1.5} />
          Step
        </button>
        <button
          type="button"
          onClick={() => onAction({ type: "RESET" })}
          className="ll-interactive inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--ll-border)] px-3 py-2 text-sm font-semibold text-[var(--ll-text)]"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
          Reset
        </button>
      </div>
    </section>
  );
}

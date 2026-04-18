"use client";

import { useEffect, useRef } from "react";
import type { WaveMotionAction } from "@/lib/labs/wave-motion/actions";
import type { WaveMotionState } from "@/lib/labs/wave-motion/state";

export default function WaveMotionFallback({
  state,
  onAction,
}: {
  state: WaveMotionState;
  onAction: (action: WaveMotionAction) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#22d3ee";
    context.lineWidth = 3;
    context.beginPath();
    for (let x = 0; x <= canvas.width; x += 4) {
      const y = canvas.height / 2 - Math.sin(x / 34) * state.amplitude * 14;
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }, [state.amplitude]);

  return (
    <section className="bg-slate-950 p-4 text-slate-100">
      <canvas ref={canvasRef} width={640} height={220} className="h-auto w-full rounded-2xl border border-slate-800" />
      <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm leading-7">
        <p>Frequency: {state.frequency.toFixed(1)} Hz</p>
        <p>Amplitude: {state.amplitude.toFixed(1)} m</p>
        <p>Wave Speed: {state.waveSpeed.toFixed(1)} m/s</p>
        <p>Wavelength: {state.wavelength.toFixed(1)} m</p>
        <p>Wave Type: {state.waveType}</p>
      </div>
      <button
        type="button"
        onClick={() => onAction({ type: "SET_WAVE_TYPE", value: state.waveType === "transverse" ? "longitudinal" : "transverse" })}
        className="mt-3 min-h-11 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
      >
        {state.waveType === "transverse" ? "Longitudinal" : "Transverse"}
      </button>
    </section>
  );
}

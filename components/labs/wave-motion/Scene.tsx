"use client";

import { useEffect, useRef } from "react";
import type { WaveMotionAction } from "@/lib/labs/wave-motion/actions";
import type { WaveMotionState } from "@/lib/labs/wave-motion/state";

type Props = {
  state: WaveMotionState;
  onAction: (action: WaveMotionAction) => void;
};

const WIDTH = 760;
const HEIGHT = 420;
const CENTER_Y = 190;
const PIXELS_PER_METER = 42;

function waveY(state: WaveMotionState, x: number) {
  const meters = x / PIXELS_PER_METER;
  const displacement =
    state.amplitude *
    Math.sin(2 * Math.PI * (meters / state.wavelength - state.frequency * state.time));
  return CENTER_Y - displacement * 24;
}

function drawArrow(
  context: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
) {
  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();
  const angle = Math.atan2(toY - fromY, toX - fromX);
  for (const direction of [-1, 1]) {
    context.beginPath();
    context.moveTo(toX, toY);
    context.lineTo(
      toX - 10 * Math.cos(angle - direction * 0.45),
      toY - 10 * Math.sin(angle - direction * 0.45)
    );
    context.stroke();
  }
}

function drawTransverse(context: CanvasRenderingContext2D, state: WaveMotionState) {
  context.strokeStyle = "#22d3ee";
  context.lineWidth = 4;
  context.beginPath();
  for (let x = 0; x <= WIDTH; x += 2) {
    const y = waveY(state, x);
    if (x === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();

  for (let x = 30; x < WIDTH; x += 30) {
    context.fillStyle = "#f8fafc";
    context.beginPath();
    context.arc(x, waveY(state, x), 5, 0, Math.PI * 2);
    context.fill();
  }

  const wavelengthPx = Math.min(260, state.wavelength * PIXELS_PER_METER);
  context.strokeStyle = "#fde68a";
  context.lineWidth = 2;
  drawArrow(context, 120, 80, 120 + wavelengthPx, 80);
  drawArrow(context, 120 + wavelengthPx, 80, 120, 80);
  context.fillStyle = "#fde68a";
  context.font = "14px sans-serif";
  context.fillText(`lambda = ${state.wavelength.toFixed(1)} m`, 145, 66);

  const ampPx = state.amplitude * 24;
  drawArrow(context, 88, CENTER_Y, 88, CENTER_Y - ampPx);
  drawArrow(context, 88, CENTER_Y - ampPx, 88, CENTER_Y);
  context.fillText(`A = ${state.amplitude.toFixed(1)} m`, 28, CENTER_Y - ampPx - 8);
}

function drawLongitudinal(context: CanvasRenderingContext2D, state: WaveMotionState) {
  context.strokeStyle = "rgba(148, 163, 184, 0.5)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(25, CENTER_Y);
  context.lineTo(WIDTH - 25, CENTER_Y);
  context.stroke();

  for (let baseX = 28; baseX < WIDTH - 28; baseX += 14) {
    const meters = baseX / PIXELS_PER_METER;
    const phase = 2 * Math.PI * (meters / state.wavelength - state.frequency * state.time);
    const offset = state.amplitude * Math.sin(phase) * 20;
    const compression = (Math.cos(phase) + 1) / 2;
    const shade = Math.round(170 - compression * 95);
    context.fillStyle = `rgb(${shade}, ${Math.round(230 - compression * 70)}, 255)`;
    context.beginPath();
    context.arc(baseX + offset, CENTER_Y, 5 + compression * 2, 0, Math.PI * 2);
    context.fill();
  }
}

function drawWave(canvas: HTMLCanvasElement, state: WaveMotionState) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const background = context.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, "#061221");
  background.addColorStop(1, "#111827");
  context.fillStyle = background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.strokeStyle = "rgba(148, 163, 184, 0.35)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, CENTER_Y);
  context.lineTo(WIDTH, CENTER_Y);
  context.stroke();

  if (state.waveType === "transverse") drawTransverse(context, state);
  else drawLongitudinal(context, state);

  context.fillStyle = "rgba(2, 6, 23, 0.78)";
  context.fillRect(18, HEIGHT - 52, 635, 34);
  context.fillStyle = "#e0f2fe";
  context.font = "15px sans-serif";
  context.fillText(
    `Frequency: ${state.frequency.toFixed(1)} Hz | Wavelength: ${state.wavelength.toFixed(1)} m | Wave Speed: ${state.waveSpeed.toFixed(1)} m/s | ${state.waveType}`,
    30,
    HEIGHT - 30
  );
}

export default function WaveMotionScene({ state, onAction }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    drawWave(canvasRef.current, state);
  }, [state]);

  useEffect(() => {
    if (state.paused) {
      lastFrameRef.current = null;
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      return;
    }

    const tick = (timestamp: number) => {
      const previous = lastFrameRef.current ?? timestamp;
      lastFrameRef.current = timestamp;
      const dt = Math.min(0.1, Math.max(0.001, (timestamp - previous) / 1000));
      onAction({ type: "STEP", dt });
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      lastFrameRef.current = null;
    };
  }, [onAction, state.paused]);

  return (
    <div className="bg-slate-950 p-3 sm:p-4">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="h-auto w-full rounded-2xl border border-slate-800 bg-slate-950"
        aria-label="Wave Motion Lab canvas simulation"
      />
      <div className="mt-3 grid gap-3">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onAction({ type: "SET_WAVE_TYPE", value: state.waveType === "transverse" ? "longitudinal" : "transverse" })}
            className="min-h-11 rounded-xl bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950"
          >
            {state.waveType === "transverse" ? "Longitudinal" : "Transverse"}
          </button>
          <button
            type="button"
            onClick={() => onAction(state.paused ? { type: "PLAY" } : { type: "PAUSE" })}
            className="min-h-11 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100"
          >
            {state.paused ? "Play" : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => onAction({ type: "RESET" })}
            className="min-h-11 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100"
          >
            Reset
          </button>
        </div>
        <label className="text-sm text-slate-100">
          Frequency {state.frequency.toFixed(1)} Hz
          <input className="mt-2 w-full accent-cyan-300" type="range" min="0.1" max="10" step="0.1" value={state.frequency} onChange={(event) => onAction({ type: "SET_FREQUENCY", value: Number(event.target.value) })} />
        </label>
        <label className="text-sm text-slate-100">
          Amplitude {state.amplitude.toFixed(1)} m
          <input className="mt-2 w-full accent-cyan-300" type="range" min="0.1" max="5" step="0.1" value={state.amplitude} onChange={(event) => onAction({ type: "SET_AMPLITUDE", value: Number(event.target.value) })} />
        </label>
        <label className="text-sm text-slate-100">
          Speed {state.waveSpeed.toFixed(1)} m/s
          <input className="mt-2 w-full accent-cyan-300" type="range" min="1" max="20" step="0.1" value={state.waveSpeed} onChange={(event) => onAction({ type: "SET_WAVE_SPEED", value: Number(event.target.value) })} />
        </label>
      </div>
    </div>
  );
}

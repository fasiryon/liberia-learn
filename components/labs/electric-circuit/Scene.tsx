"use client";

import { useEffect, useRef } from "react";
import type { ElectricCircuitAction } from "@/lib/labs/electric-circuit/actions";
import type { ElectricCircuitState } from "@/lib/labs/electric-circuit/state";

type Props = {
  state: ElectricCircuitState;
  onAction: (action: ElectricCircuitAction) => void;
};

const WIDTH = 760;
const HEIGHT = 420;

function drawResistor(context: CanvasRenderingContext2D, x: number, y: number, label: string) {
  context.strokeStyle = "#fbbf24";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(x - 42, y);
  for (let index = 0; index < 6; index += 1) {
    context.lineTo(x - 28 + index * 14, y + (index % 2 === 0 ? -14 : 14));
  }
  context.lineTo(x + 42, y);
  context.stroke();
  context.fillStyle = "#fde68a";
  context.font = "14px sans-serif";
  context.fillText(label, x - 24, y - 24);
}

function drawElectron(context: CanvasRenderingContext2D, x: number, y: number) {
  context.fillStyle = "#67e8f9";
  context.beginPath();
  context.arc(x, y, 5, 0, Math.PI * 2);
  context.fill();
}

function pointOnRectangle(progress: number) {
  const left = 110;
  const right = 650;
  const top = 92;
  const bottom = 290;
  const p = ((progress % 1) + 1) % 1;
  if (p < 0.25) return { x: left + (right - left) * (p / 0.25), y: top };
  if (p < 0.5) return { x: right, y: top + (bottom - top) * ((p - 0.25) / 0.25) };
  if (p < 0.75) return { x: right - (right - left) * ((p - 0.5) / 0.25), y: bottom };
  return { x: left, y: bottom - (bottom - top) * ((p - 0.75) / 0.25) };
}

function drawCircuit(canvas: HTMLCanvasElement, state: ElectricCircuitState, flow: number) {
  const context = canvas.getContext("2d");
  if (!context) return;

  context.clearRect(0, 0, WIDTH, HEIGHT);
  const background = context.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, "#061221");
  background.addColorStop(1, "#0f172a");
  context.fillStyle = background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.strokeStyle = "#94a3b8";
  context.lineWidth = 5;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(110, 92);
  context.lineTo(650, 92);
  context.lineTo(650, 290);
  context.lineTo(110, 290);
  context.lineTo(110, 92);
  context.stroke();

  context.fillStyle = "#e2e8f0";
  context.fillRect(80, 152, 12, 86);
  context.fillRect(124, 174, 8, 44);
  context.fillStyle = "#f8fafc";
  context.font = "15px sans-serif";
  context.fillText("+", 78, 145);
  context.fillText("-", 124, 238);
  context.fillText(`${state.voltage.toFixed(1)} V`, 72, 265);

  if (state.circuitType === "series") {
    drawResistor(context, 300, 92, `R1 ${Math.round(state.resistance1)} ohms`);
    drawResistor(context, 465, 92, `R2 ${Math.round(state.resistance2)} ohms`);
  } else {
    context.strokeStyle = "#94a3b8";
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(230, 92);
    context.lineTo(230, 150);
    context.lineTo(515, 150);
    context.lineTo(515, 92);
    context.moveTo(230, 92);
    context.lineTo(230, 235);
    context.lineTo(515, 235);
    context.lineTo(515, 92);
    context.stroke();
    drawResistor(context, 372, 150, `R1 ${Math.round(state.resistance1)} ohms`);
    drawResistor(context, 372, 235, `R2 ${Math.round(state.resistance2)} ohms`);
  }

  const brightness = Math.min(1, state.power / 6);
  context.save();
  context.shadowColor = `rgba(250, 204, 21, ${0.35 + brightness * 0.55})`;
  context.shadowBlur = 10 + brightness * 42;
  context.fillStyle = `rgba(250, ${Math.round(180 + brightness * 65)}, 70, ${0.45 + brightness * 0.55})`;
  context.beginPath();
  context.arc(650, 190, 30, 0, Math.PI * 2);
  context.fill();
  context.restore();
  context.strokeStyle = "#fef3c7";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(650, 190, 30, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = "#fef3c7";
  context.font = "14px sans-serif";
  context.fillText("Bulb", 635, 236);

  const speed = Math.max(0.005, Math.min(0.08, state.current * 0.9));
  for (let index = 0; index < 12; index += 1) {
    const point = pointOnRectangle(flow * speed + index / 12);
    drawElectron(context, point.x, point.y);
  }

  context.fillStyle = "rgba(2, 6, 23, 0.78)";
  context.fillRect(18, HEIGHT - 48, 610, 32);
  context.fillStyle = "#e0f2fe";
  context.font = "15px sans-serif";
  context.fillText(
    `Current: ${state.current.toFixed(2)} A | Power: ${state.power.toFixed(2)} W | Total Resistance: ${state.totalResistance.toFixed(0)} ohms`,
    30,
    HEIGHT - 27
  );
}

export default function ElectricCircuitScene({ state, onAction }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    drawCircuit(canvasRef.current, state, frameRef.current);
  }, [state]);

  useEffect(() => {
    const tick = () => {
      frameRef.current += 1;
      if (canvasRef.current) drawCircuit(canvasRef.current, state, frameRef.current);
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, [state]);

  return (
    <div className="bg-[var(--ll-bg)] p-3 sm:p-4">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="h-auto w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]"
        aria-label="Electric Circuit Builder canvas simulation"
      />
      <div className="mt-3 grid gap-3">
        <button
          type="button"
          onClick={() => onAction({ type: "SET_CIRCUIT_TYPE", value: state.circuitType === "series" ? "parallel" : "series" })}
          className="min-h-11 rounded-xl bg-[var(--ll-silver-soft)] px-3 py-2 text-sm font-semibold text-[var(--ll-text-faint)]"
        >
          {state.circuitType === "series" ? "Switch to Parallel" : "Switch to Series"}
        </button>
        <label className="text-sm text-[var(--ll-text)]">
          Voltage {state.voltage.toFixed(1)} V
          <input className="mt-2 w-full accent-cyan-300" type="range" min="0" max="24" step="0.1" value={state.voltage} onChange={(event) => onAction({ type: "SET_VOLTAGE", value: Number(event.target.value) })} />
        </label>
        <label className="text-sm text-[var(--ll-text)]">
          R1 {Math.round(state.resistance1)} ohms
          <input className="mt-2 w-full accent-cyan-300" type="range" min="1" max="1000" step="1" value={state.resistance1} onChange={(event) => onAction({ type: "SET_RESISTANCE1", value: Number(event.target.value) })} />
        </label>
        <label className="text-sm text-[var(--ll-text)]">
          R2 {Math.round(state.resistance2)} ohms
          <input className="mt-2 w-full accent-cyan-300" type="range" min="1" max="1000" step="1" value={state.resistance2} onChange={(event) => onAction({ type: "SET_RESISTANCE2", value: Number(event.target.value) })} />
        </label>
      </div>
    </div>
  );
}

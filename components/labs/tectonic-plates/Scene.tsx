"use client";

import { useEffect, useRef, useState } from "react";
import type { TectonicPlatesAction } from "@/lib/labs/tectonic-plates/actions";
import type { TectonicEvent, TectonicPlatesState } from "@/lib/labs/tectonic-plates/state";

type Props = {
  state: TectonicPlatesState;
  onAction: (action: TectonicPlatesAction) => void;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number };
type EventLogEntry = { time: number; event: TectonicEvent; pressure: number };

const WIDTH = 760;
const HEIGHT = 480;
const SURFACE_Y = 96;
const BOUNDARY_X = 380;

function riskColor(risk: TectonicPlatesState["earthquakeRisk"]) {
  if (risk === "critical") return "#ef4444";
  if (risk === "high") return "#f97316";
  if (risk === "medium") return "#facc15";
  return "#22c55e";
}

function drawLayers(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, reverse = false) {
  const gradient = context.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, "#78716c");
  gradient.addColorStop(0.45, "#57534e");
  gradient.addColorStop(1, "#292524");
  context.fillStyle = gradient;
  context.fillRect(x, y, width, height);
  for (let index = 0; index < 6; index += 1) {
    context.strokeStyle = index % 2 === 0 ? "#a8a29e" : "#44403c";
    context.lineWidth = 2;
    const ly = y + 28 + index * 34;
    context.beginPath();
    context.moveTo(x, ly);
    context.bezierCurveTo(x + width * 0.3, ly + (reverse ? -8 : 8), x + width * 0.7, ly + (reverse ? 8 : -8), x + width, ly);
    context.stroke();
  }
}

function drawSurface(context: CanvasRenderingContext2D, state: TectonicPlatesState) {
  context.fillStyle = state.boundaryType === "divergent" ? "#0369a1" : "#854d0e";
  context.fillRect(0, 0, WIDTH, SURFACE_Y);
  if (state.boundaryType === "divergent") {
    context.strokeStyle = "#7dd3fc";
    for (let index = 0; index < 12; index += 1) {
      context.beginPath();
      context.arc(40 + index * 65, 46 + Math.sin(index) * 8, 16, 0, Math.PI);
      context.stroke();
    }
  } else {
    context.fillStyle = "#14532d";
    for (let index = 0; index < 9; index += 1) {
      const x = 38 + index * 78;
      context.beginPath();
      context.moveTo(x, 40);
      context.lineTo(x - 14, 76);
      context.lineTo(x + 14, 76);
      context.closePath();
      context.fill();
    }
  }
}

function drawBoundary(context: CanvasRenderingContext2D, state: TectonicPlatesState, particles: Particle[]) {
  drawSurface(context, state);
  context.save();

  if (state.boundaryType === "convergent") {
    drawLayers(context, 0, SURFACE_Y, BOUNDARY_X + 34, HEIGHT - SURFACE_Y, false);
    drawLayers(context, BOUNDARY_X - 24, SURFACE_Y - 8, WIDTH - BOUNDARY_X + 24, HEIGHT - SURFACE_Y + 8, true);
    context.fillStyle = "#78350f";
    context.beginPath();
    context.moveTo(445, SURFACE_Y);
    context.lineTo(476, 50);
    context.lineTo(508, SURFACE_Y);
    context.lineTo(545, 42);
    context.lineTo(588, SURFACE_Y);
    context.closePath();
    context.fill();
    context.strokeStyle = "#292524";
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(350, SURFACE_Y + 30);
    context.quadraticCurveTo(430, 220, 560, 390);
    context.stroke();
    context.fillStyle = "#ef4444";
    context.beginPath();
    context.arc(492, 260, 10, 0, Math.PI * 2);
    context.fill();
  } else if (state.boundaryType === "divergent") {
    drawLayers(context, 0, SURFACE_Y, BOUNDARY_X - 42, HEIGHT - SURFACE_Y, false);
    drawLayers(context, BOUNDARY_X + 42, SURFACE_Y, WIDTH - BOUNDARY_X - 42, HEIGHT - SURFACE_Y, true);
    context.fillStyle = "#f97316";
    context.beginPath();
    context.moveTo(BOUNDARY_X - 38, HEIGHT);
    context.lineTo(BOUNDARY_X - 12, SURFACE_Y);
    context.lineTo(BOUNDARY_X + 12, SURFACE_Y);
    context.lineTo(BOUNDARY_X + 38, HEIGHT);
    context.closePath();
    context.fill();
    for (let index = 0; index < 6; index += 1) {
      context.strokeStyle = index % 2 ? "#44403c" : "#a8a29e";
      context.beginPath();
      context.moveTo(BOUNDARY_X - 45 - index * 34, SURFACE_Y + 60);
      context.lineTo(BOUNDARY_X - 95 - index * 34, HEIGHT);
      context.moveTo(BOUNDARY_X + 45 + index * 34, SURFACE_Y + 60);
      context.lineTo(BOUNDARY_X + 95 + index * 34, HEIGHT);
      context.stroke();
    }
  } else {
    drawLayers(context, 0, SURFACE_Y, BOUNDARY_X - 4, HEIGHT - SURFACE_Y, false);
    drawLayers(context, BOUNDARY_X + 4, SURFACE_Y, WIDTH - BOUNDARY_X - 4, HEIGHT - SURFACE_Y, true);
    context.strokeStyle = "#f8fafc";
    context.lineWidth = 4;
    context.beginPath();
    for (let y = SURFACE_Y; y < HEIGHT; y += 28) {
      context.lineTo(BOUNDARY_X + (y % 56 === 0 ? -12 : 12), y);
    }
    context.stroke();
  }

  const intensity = state.pressure / 100;
  context.shadowColor = intensity > 0.85 ? "#ef4444" : "#facc15";
  context.shadowBlur = 40 * intensity;
  context.fillStyle = `rgba(239, 68, 68, ${0.16 + intensity * 0.55})`;
  context.fillRect(BOUNDARY_X - 18, SURFACE_Y, 36, HEIGHT - SURFACE_Y);
  context.restore();

  context.fillStyle = "#e2e8f0";
  context.font = "14px sans-serif";
  context.fillText("Pressure at boundary", BOUNDARY_X - 62, SURFACE_Y + 24);

  if (state.lastEvent === "earthquake" && state.eventTimer > 0) {
    context.strokeStyle = "rgba(255,255,255,0.7)";
    for (let ring = 0; ring < 4; ring += 1) {
      context.beginPath();
      context.arc(BOUNDARY_X, 260, (60 - state.eventTimer + ring * 22) * 2, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = "#ffffff";
    context.font = "bold 34px sans-serif";
    context.fillText("EARTHQUAKE", 252, 76);
  }

  if (state.lastEvent === "eruption" && state.eventTimer > 0) {
    particles.forEach((particle) => {
      context.fillStyle = `rgba(249, 115, 22, ${particle.life / 60})`;
      context.beginPath();
      context.arc(particle.x, particle.y, 4, 0, Math.PI * 2);
      context.fill();
    });
    context.fillStyle = "#ffffff";
    context.font = "bold 34px sans-serif";
    context.fillText("ERUPTION", 294, 76);
  }
}

function drawScene(canvas: HTMLCanvasElement, state: TectonicPlatesState, particles: Particle[]) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const shake = state.lastEvent === "earthquake" && state.eventTimer > 0 ? 4 : 0;
  const offsetX = shake ? (Math.random() - 0.5) * shake : 0;
  const offsetY = shake ? (Math.random() - 0.5) * shake : 0;
  context.clearRect(0, 0, WIDTH, HEIGHT);
  context.save();
  context.translate(offsetX, offsetY);
  context.fillStyle = "#0f172a";
  context.fillRect(-8, -8, WIDTH + 16, HEIGHT + 16);
  drawBoundary(context, state, particles);
  context.restore();
}

export default function TectonicPlatesScene({ state, onAction }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const previousEventRef = useRef<TectonicEvent>("none");

  useEffect(() => {
    if (state.lastEvent !== "none" && state.lastEvent !== previousEventRef.current) {
      setEventLog((current) => [{ time: state.time, event: state.lastEvent, pressure: state.pressure }, ...current].slice(0, 5));
      particlesRef.current = Array.from({ length: 50 }, () => ({
        x: state.boundaryType === "divergent" ? BOUNDARY_X : 505,
        y: state.boundaryType === "divergent" ? SURFACE_Y + 20 : 72,
        vx: -2 + Math.random() * 4,
        vy: -4 - Math.random() * 5,
        life: 60,
      }));
    }
    previousEventRef.current = state.lastEvent;
  }, [state.boundaryType, state.lastEvent, state.pressure, state.time]);

  useEffect(() => {
    let frame = 0;
    let animation = 0;
    const tick = () => {
      frame += 1;
      particlesRef.current.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.16;
        particle.life -= 1;
      });
      particlesRef.current = particlesRef.current.filter((particle) => particle.life > 0);
      if (!state.paused && frame % 6 === 0) onAction({ type: "STEP" });
      if (canvasRef.current) drawScene(canvasRef.current, state, particlesRef.current);
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [onAction, state]);

  return (
    <div className="space-y-4 p-4">
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]" />
      <div className="grid gap-2 text-sm text-[var(--ll-text)] sm:grid-cols-2 lg:grid-cols-3">
        <span>Plate 1: {state.plate1Speed.toFixed(1)} cm/yr</span>
        <span>Plate 2: {state.plate2Speed.toFixed(1)} cm/yr</span>
        <span>Boundary: {state.boundaryType}</span>
        <span>Pressure: {state.pressure.toFixed(1)}</span>
        <span style={{ color: riskColor(state.earthquakeRisk) }}>Risk: {state.earthquakeRisk.toUpperCase()}</span>
        <span>Last Event: {state.lastEvent}</span>
      </div>
      <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-3 text-sm text-[var(--ll-text)]">
        <p className="font-semibold text-[var(--ll-text)]">Event Log</p>
        {eventLog.length === 0 ? <p className="mt-2 text-[var(--ll-text-muted)]">No events yet.</p> : null}
        {eventLog.map((entry, index) => (
          <p key={`${entry.time}-${entry.event}-${index}`} className="mt-1">
            T={entry.time.toFixed(1)} {entry.event === "earthquake" ? "Earthquake" : "Eruption"} (pressure reset to {entry.pressure.toFixed(0)})
          </p>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(["convergent", "divergent", "transform"] as const).map((boundary) => (
          <button
            key={boundary}
            type="button"
            onClick={() => onAction({ type: "SET_BOUNDARY_TYPE", value: boundary })}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${state.boundaryType === boundary ? "bg-[var(--ll-silver-soft)] text-[var(--ll-text-faint)]" : "border border-[var(--ll-border)] text-[var(--ll-text)]"}`}
          >
            {boundary[0].toUpperCase() + boundary.slice(1)}
          </button>
        ))}
        <button type="button" onClick={() => onAction({ type: "TRIGGER_EARTHQUAKE" })} className="min-h-11 rounded-full border border-[var(--ll-border)] px-4 text-sm text-[var(--ll-text)]">
          Trigger Earthquake
        </button>
        <button type="button" onClick={() => onAction({ type: "TRIGGER_ERUPTION" })} className="min-h-11 rounded-full border border-[var(--ll-border)] px-4 text-sm text-[var(--ll-text)]">
          Trigger Eruption
        </button>
        <button type="button" onClick={() => onAction({ type: state.paused ? "PLAY" : "PAUSE" })} className="min-h-11 rounded-full border border-[var(--ll-border)] px-4 text-sm text-[var(--ll-text)]">
          {state.paused ? "Play" : "Pause"}
        </button>
        <button type="button" onClick={() => onAction({ type: "RESET" })} className="min-h-11 rounded-full border border-[var(--ll-border)] px-4 text-sm text-[var(--ll-text)]">
          Reset
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["Plate 1 Speed", "SET_PLATE1_SPEED", state.plate1Speed],
          ["Plate 2 Speed", "SET_PLATE2_SPEED", state.plate2Speed],
        ].map(([label, type, value]) => (
          <label key={String(type)} className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-3 text-sm text-[var(--ll-text)]">
            <span className="flex justify-between">{label}<strong>{Number(value).toFixed(1)} cm/yr</strong></span>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={Number(value)}
              onChange={(event) => onAction({ type: type as any, value: Number(event.target.value) })}
              className="mt-3 w-full accent-cyan-300"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

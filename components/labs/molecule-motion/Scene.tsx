"use client";

import { useEffect, useRef } from "react";
import type { MoleculeMotionAction } from "@/lib/labs/molecule-motion/actions";
import type { MoleculeMotionState } from "@/lib/labs/molecule-motion/state";

type MoleculeSceneProps = {
  state: MoleculeMotionState;
  onAction: (action: MoleculeMotionAction) => void;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  anchorX: number;
  anchorY: number;
};

const CANVAS_WIDTH = 760;
const CANVAS_HEIGHT = 420;
const BOX = { x: 44, y: 52, width: 570, height: 300 };

function phaseColor(phase: MoleculeMotionState["phase"]) {
  if (phase === "solid") return "#1d4ed8";
  if (phase === "liquid") return "#14b8a6";
  return "#f97316";
}

function particleSpeed(state: MoleculeMotionState) {
  const phaseScale = state.phase === "solid" ? 0.1 : state.phase === "liquid" ? 0.42 : 1;
  return Math.sqrt(Math.max(0, state.temperature)) * 0.5 * phaseScale;
}

function makeParticle(state: MoleculeMotionState): Particle {
  const speed = particleSpeed(state);
  const angle = Math.random() * Math.PI * 2;
  const x = BOX.x + 12 + Math.random() * (BOX.width - 24);
  const y = BOX.y + 12 + Math.random() * (BOX.height - 24);
  return {
    x,
    y,
    anchorX: x,
    anchorY: y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
}

function syncParticles(particles: Particle[], state: MoleculeMotionState) {
  while (particles.length < state.particleCount) {
    particles.push(makeParticle(state));
  }
  if (particles.length > state.particleCount) {
    particles.splice(state.particleCount);
  }

  const speed = particleSpeed(state);
  particles.forEach((particle) => {
    const angle = Math.atan2(particle.vy || 1, particle.vx || 1);
    particle.vx = Math.cos(angle) * speed;
    particle.vy = Math.sin(angle) * speed;
  });
}

function drawScene(
  canvas: HTMLCanvasElement,
  state: MoleculeMotionState,
  particles: Particle[],
  flash: number
) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const background = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  background.addColorStop(0, "#07111f");
  background.addColorStop(1, "#111827");
  context.fillStyle = background;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  context.fillStyle = "rgba(15, 23, 42, 0.82)";
  context.fillRect(BOX.x, BOX.y, BOX.width, BOX.height);
  context.strokeStyle = flash > 0 ? `rgba(251, 191, 36, ${flash})` : "#67e8f9";
  context.lineWidth = flash > 0 ? 5 : 2;
  context.strokeRect(BOX.x, BOX.y, BOX.width, BOX.height);

  context.fillStyle = phaseColor(state.phase);
  particles.forEach((particle) => {
    context.beginPath();
    context.arc(particle.x, particle.y, state.phase === "gas" ? 4 : 5, 0, Math.PI * 2);
    context.fill();
  });

  context.fillStyle = "#e0f2fe";
  context.font = "bold 24px sans-serif";
  context.fillText(state.phase.toUpperCase(), BOX.x, 34);
  context.font = "15px sans-serif";
  context.fillText(`Pressure: ${state.pressure.toFixed(2)}`, BOX.x + 170, 34);
  context.fillText(`Phase: ${state.phase}`, BOX.x + 320, 34);

  const gaugeX = 660;
  const gaugeY = 64;
  const gaugeHeight = 276;
  context.fillStyle = "rgba(15, 23, 42, 0.9)";
  context.fillRect(gaugeX, gaugeY, 34, gaugeHeight);
  context.strokeStyle = "#334155";
  context.strokeRect(gaugeX, gaugeY, 34, gaugeHeight);
  const fillHeight = (Math.max(0, Math.min(1000, state.temperature)) / 1000) * gaugeHeight;
  context.fillStyle = phaseColor(state.phase);
  context.fillRect(gaugeX, gaugeY + gaugeHeight - fillHeight, 34, fillHeight);
  context.fillStyle = "#e2e8f0";
  context.font = "13px sans-serif";
  context.fillText(`${state.temperature.toFixed(0)} K`, gaugeX - 12, gaugeY + gaugeHeight + 26);

  context.fillStyle = "rgba(2, 6, 23, 0.74)";
  context.fillRect(18, CANVAS_HEIGHT - 45, 455, 30);
  context.fillStyle = "#e0f2fe";
  context.font = "15px sans-serif";
  context.fillText(
    `Particles: ${state.particleCount} | Temperature: ${state.temperature.toFixed(0)} K | Time: ${state.time.toFixed(2)} s`,
    30,
    CANVAS_HEIGHT - 24
  );
}

export default function MoleculeMotionScene({ state, onAction }: MoleculeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const previousTemperatureRef = useRef(state.temperature);
  const previousPhaseRef = useRef(state.phase);
  const flashRef = useRef(0);

  useEffect(() => {
    const tempDelta = Math.abs(previousTemperatureRef.current - state.temperature);
    syncParticles(particlesRef.current, state);
    if (tempDelta > 50) {
      particlesRef.current = Array.from({ length: state.particleCount }, () => makeParticle(state));
    }
    if (previousPhaseRef.current !== state.phase) {
      flashRef.current = 1;
    }
    previousTemperatureRef.current = state.temperature;
    previousPhaseRef.current = state.phase;
    if (canvasRef.current) {
      drawScene(canvasRef.current, state, particlesRef.current, flashRef.current);
      flashRef.current = Math.max(0, flashRef.current - 0.16);
    }
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
      const dt = Math.min(1, Math.max(0.001, (timestamp - previous) / 1000));

      particlesRef.current.forEach((particle) => {
        if (state.phase === "solid") {
          particle.x = particle.anchorX + Math.sin(timestamp / 90 + particle.anchorX) * 2;
          particle.y = particle.anchorY + Math.cos(timestamp / 90 + particle.anchorY) * 2;
          return;
        }

        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        if (particle.x < BOX.x + 6 || particle.x > BOX.x + BOX.width - 6) {
          particle.vx *= -1;
          particle.x = Math.max(BOX.x + 6, Math.min(BOX.x + BOX.width - 6, particle.x));
        }
        if (particle.y < BOX.y + 6 || particle.y > BOX.y + BOX.height - 6) {
          particle.vy *= -1;
          particle.y = Math.max(BOX.y + 6, Math.min(BOX.y + BOX.height - 6, particle.y));
        }
      });

      if (canvasRef.current) {
        drawScene(canvasRef.current, state, particlesRef.current, flashRef.current);
        flashRef.current = Math.max(0, flashRef.current - 0.08);
      }
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
  }, [onAction, state]);

  return (
    <div className="bg-[var(--ll-bg)] p-3 sm:p-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="h-auto w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]"
        aria-label="Molecule Motion particle simulation"
      />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onAction(state.paused ? { type: "PLAY" } : { type: "PAUSE" })}
          className="min-h-11 rounded-xl bg-[var(--ll-silver-soft)] px-3 py-2 text-sm font-semibold text-[var(--ll-text-faint)]"
        >
          {state.paused ? "Play" : "Pause"}
        </button>
        <button
          type="button"
          onClick={() => onAction({ type: "STEP", dt: 0.1 })}
          className="min-h-11 rounded-xl border border-[var(--ll-border)] px-3 py-2 text-sm font-semibold text-[var(--ll-text)]"
        >
          Step
        </button>
        <button
          type="button"
          onClick={() => onAction({ type: "RESET" })}
          className="min-h-11 rounded-xl border border-[var(--ll-border)] px-3 py-2 text-sm font-semibold text-[var(--ll-text)]"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import type { EcosystemBalanceAction } from "@/lib/labs/ecosystem-balance/actions";
import type { EcosystemBalanceState } from "@/lib/labs/ecosystem-balance/state";

type Props = {
  state: EcosystemBalanceState;
  onAction: (action: EcosystemBalanceAction) => void;
};

type Agent = { x: number; y: number; vx: number; vy: number };

const WIDTH = 760;
const HEIGHT = 460;
const TERRAIN_HEIGHT = 300;
const GRAPH_TOP = 326;
const GRAPH_HEIGHT = 106;

function randomAgent(speed: number): Agent {
  const angle = Math.random() * Math.PI * 2;
  return {
    x: 30 + Math.random() * (WIDTH - 60),
    y: 30 + Math.random() * (TERRAIN_HEIGHT - 60),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
}

function syncAgents(agents: Agent[], targetCount: number, speed: number) {
  while (agents.length < targetCount) agents.push(randomAgent(speed));
  if (agents.length > targetCount) agents.splice(targetCount);
}

function moveAgents(agents: Agent[], speed: number) {
  for (const agent of agents) {
    agent.x += agent.vx;
    agent.y += agent.vy;
    if (agent.x < 18 || agent.x > WIDTH - 18) agent.vx *= -1;
    if (agent.y < 18 || agent.y > TERRAIN_HEIGHT - 18) agent.vy *= -1;
    if (Math.random() < 0.02) {
      const angle = Math.random() * Math.PI * 2;
      agent.vx = Math.cos(angle) * speed;
      agent.vy = Math.sin(angle) * speed;
    }
    agent.x = Math.max(18, Math.min(WIDTH - 18, agent.x));
    agent.y = Math.max(18, Math.min(TERRAIN_HEIGHT - 18, agent.y));
  }
}

function drawGraph(context: CanvasRenderingContext2D, state: EcosystemBalanceState) {
  context.fillStyle = "#020617";
  context.fillRect(0, TERRAIN_HEIGHT, WIDTH, HEIGHT - TERRAIN_HEIGHT);
  context.strokeStyle = "#334155";
  context.lineWidth = 1;
  context.strokeRect(42, GRAPH_TOP, WIDTH - 84, GRAPH_HEIGHT);

  const history = state.history.length
    ? state.history
    : [{ plants: state.plantCount, herbivores: state.herbivoreCount, carnivores: state.carnivoreCount }];
  const maxValue = Math.max(10, ...history.flatMap((entry) => [entry.plants, entry.herbivores, entry.carnivores]));

  function plot(key: "plants" | "herbivores" | "carnivores", color: string) {
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.beginPath();
    history.forEach((entry, index) => {
      const x = 42 + (index / Math.max(1, history.length - 1)) * (WIDTH - 84);
      const y = GRAPH_TOP + GRAPH_HEIGHT - (entry[key] / maxValue) * GRAPH_HEIGHT;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }

  plot("plants", "#22c55e");
  plot("herbivores", "#facc15");
  plot("carnivores", "#ef4444");

  context.fillStyle = "#e2e8f0";
  context.font = "13px sans-serif";
  context.fillText("Population history", 42, GRAPH_TOP - 10);
  context.fillStyle = "#22c55e";
  context.fillText("Plants", 560, GRAPH_TOP - 10);
  context.fillStyle = "#facc15";
  context.fillText("Herbivores", 610, GRAPH_TOP - 10);
  context.fillStyle = "#ef4444";
  context.fillText("Carnivores", 690, GRAPH_TOP - 10);
}

function drawScene(canvas: HTMLCanvasElement, state: EcosystemBalanceState, herbivores: Agent[], carnivores: Agent[]) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const terrain = context.createLinearGradient(0, 0, 0, TERRAIN_HEIGHT);
  terrain.addColorStop(0, "#166534");
  terrain.addColorStop(1, "#14532d");
  context.fillStyle = terrain;
  context.fillRect(0, 0, WIDTH, TERRAIN_HEIGHT);

  if (state.droughtActive) {
    context.fillStyle = "rgba(120, 72, 24, 0.48)";
    context.fillRect(0, 0, WIDTH, TERRAIN_HEIGHT);
  }

  const visiblePlants = Math.min(100, Math.round(state.plantCount / 10));
  context.fillStyle = "#86efac";
  for (let index = 0; index < visiblePlants; index += 1) {
    const x = 18 + ((index * 73) % (WIDTH - 36));
    const y = 18 + ((index * 47) % (TERRAIN_HEIGHT - 36));
    context.beginPath();
    context.arc(x, y, 3, 0, Math.PI * 2);
    context.fill();
  }

  syncAgents(herbivores, Math.min(100, Math.round(state.herbivoreCount / 5)), 0.45);
  syncAgents(carnivores, Math.min(200, Math.round(state.carnivoreCount)), 0.9);
  moveAgents(herbivores, 0.45);
  moveAgents(carnivores, 0.9);

  context.fillStyle = "#fde047";
  for (const agent of herbivores) {
    context.beginPath();
    context.arc(agent.x, agent.y, 6, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "#ef4444";
  for (const agent of carnivores) {
    context.beginPath();
    context.arc(agent.x, agent.y, 8, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "rgba(2, 6, 23, 0.78)";
  context.fillRect(18, 18, state.droughtActive ? 560 : 460, 52);
  context.fillStyle = "#e0f2fe";
  context.font = "15px sans-serif";
  context.fillText(
    `Plants: ${Math.round(state.plantCount)} | Herbivores: ${Math.round(state.herbivoreCount)} | Carnivores: ${Math.round(state.carnivoreCount)}`,
    30,
    48
  );
  if (state.droughtActive) {
    context.fillStyle = "#fbbf24";
    context.fillText("DROUGHT ACTIVE", 470, 48);
  }

  drawGraph(context, state);
}

export default function EcosystemBalanceScene({ state, onAction }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastStepRef = useRef<number | null>(null);
  const herbivoresRef = useRef<Agent[]>([]);
  const carnivoresRef = useRef<Agent[]>([]);

  useEffect(() => {
    if (canvasRef.current) {
      drawScene(canvasRef.current, state, herbivoresRef.current, carnivoresRef.current);
    }
  }, [state]);

  useEffect(() => {
    const tick = (timestamp: number) => {
      if (canvasRef.current) {
        drawScene(canvasRef.current, state, herbivoresRef.current, carnivoresRef.current);
      }
      if (!state.paused) {
        const previous = lastStepRef.current ?? timestamp;
        if (timestamp - previous >= 80) {
          onAction({ type: "STEP" });
          lastStepRef.current = timestamp;
        }
      } else {
        lastStepRef.current = null;
      }
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    };
  }, [onAction, state]);

  return (
    <div className="bg-[var(--ll-bg)] p-3 sm:p-4">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="h-auto w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]"
        aria-label="Ecosystem Balance population simulation"
      />
      <div className="mt-3 grid gap-3">
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => onAction(state.paused ? { type: "PLAY" } : { type: "PAUSE" })} className="min-h-11 rounded-xl bg-[var(--ll-silver-soft)] px-3 py-2 text-sm font-semibold text-[var(--ll-text-faint)]">
            {state.paused ? "Play" : "Pause"}
          </button>
          <button type="button" onClick={() => onAction(state.droughtActive ? { type: "REMOVE_DROUGHT" } : { type: "ADD_DROUGHT" })} className="min-h-11 rounded-xl border border-[var(--ll-border)] px-3 py-2 text-sm font-semibold text-[var(--ll-text)]">
            {state.droughtActive ? "Remove Drought" : "Add Drought"}
          </button>
          <button type="button" onClick={() => onAction({ type: "RESET" })} className="min-h-11 rounded-xl border border-[var(--ll-border)] px-3 py-2 text-sm font-semibold text-[var(--ll-text)]">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

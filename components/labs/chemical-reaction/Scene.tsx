"use client";

import { useEffect, useRef } from "react";
import type { ChemicalReactionAction } from "@/lib/labs/chemical-reaction/actions";
import type { ChemicalReactionState } from "@/lib/labs/chemical-reaction/state";

type Props = {
  state: ChemicalReactionState;
  onAction: (action: ChemicalReactionAction) => void;
};

type Molecule = { x: number; y: number; vx: number; vy: number; kind: "A" | "B" | "C" };
type Flash = { x: number; y: number; life: number };

const WIDTH = 760;
const HEIGHT = 500;
const VESSEL = { x: 210, y: 66, width: 300, height: 270 };

function syncMolecules(molecules: Molecule[], state: ChemicalReactionState) {
  const targets = {
    A: Math.min(20, Math.floor(state.reactantA / 5)),
    B: Math.min(20, Math.floor(state.reactantB / 5)),
    C: Math.min(20, Math.floor(state.productC / 5)),
  };
  (["A", "B", "C"] as const).forEach((kind) => {
    const current = molecules.filter((molecule) => molecule.kind === kind).length;
    for (let index = current; index < targets[kind]; index += 1) {
      molecules.push({
        kind,
        x: VESSEL.x + 38 + Math.random() * (VESSEL.width - 76),
        y: VESSEL.y + 72 + Math.random() * (VESSEL.height - 96),
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
      });
    }
    let remove = Math.max(0, current - targets[kind]);
    for (let index = molecules.length - 1; index >= 0 && remove > 0; index -= 1) {
      if (molecules[index].kind === kind) {
        molecules.splice(index, 1);
        remove -= 1;
      }
    }
  });
}

function moveMolecules(molecules: Molecule[]) {
  molecules.forEach((molecule) => {
    molecule.vx += (Math.random() - 0.5) * 0.08;
    molecule.vy += (Math.random() - 0.5) * 0.08;
    molecule.vx = Math.max(-1.1, Math.min(1.1, molecule.vx));
    molecule.vy = Math.max(-1.1, Math.min(1.1, molecule.vy));
    molecule.x += molecule.vx;
    molecule.y += molecule.vy;
    const left = VESSEL.x + 28;
    const right = VESSEL.x + VESSEL.width - 28;
    const top = VESSEL.y + 58;
    const bottom = VESSEL.y + VESSEL.height - 22;
    if (molecule.x < left || molecule.x > right) molecule.vx *= -1;
    if (molecule.y < top || molecule.y > bottom) molecule.vy *= -1;
    molecule.x = Math.max(left, Math.min(right, molecule.x));
    molecule.y = Math.max(top, Math.min(bottom, molecule.y));
  });
}

function drawVessel(context: CanvasRenderingContext2D, state: ChemicalReactionState) {
  const active = state.reactionStarted;
  context.save();
  context.beginPath();
  context.moveTo(VESSEL.x + 110, VESSEL.y);
  context.lineTo(VESSEL.x + 110, VESSEL.y + 62);
  context.quadraticCurveTo(VESSEL.x + 20, VESSEL.y + 98, VESSEL.x + 32, VESSEL.y + 250);
  context.quadraticCurveTo(VESSEL.x + VESSEL.width / 2, VESSEL.y + 292, VESSEL.x + VESSEL.width - 32, VESSEL.y + 250);
  context.quadraticCurveTo(VESSEL.x + VESSEL.width - 20, VESSEL.y + 98, VESSEL.x + 190, VESSEL.y + 62);
  context.lineTo(VESSEL.x + 190, VESSEL.y);
  context.closePath();

  if (!active) {
    context.fillStyle = "rgba(148, 163, 184, 0.22)";
  } else if (state.energyType === "exothermic") {
    context.shadowColor = "rgba(249, 115, 22, 0.85)";
    context.shadowBlur = 28;
    context.fillStyle = "rgba(248, 113, 113, 0.34)";
  } else {
    context.setLineDash([10, 7]);
    context.fillStyle = "rgba(219, 234, 254, 0.32)";
    context.shadowColor = "rgba(147, 197, 253, 0.75)";
    context.shadowBlur = 22;
  }
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = state.energyType === "endothermic" && active ? "#bfdbfe" : "#e2e8f0";
  context.stroke();
  context.restore();
}

function drawScene(
  canvas: HTMLCanvasElement,
  state: ChemicalReactionState,
  molecules: Molecule[],
  flashes: Flash[]
) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, WIDTH, HEIGHT);
  const background = context.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, "#07111f");
  background.addColorStop(1, "#111827");
  context.fillStyle = background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  drawVessel(context, state);

  if (state.catalyst) {
    context.fillStyle = "#facc15";
    for (let index = 0; index < 8; index += 1) {
      const x = VESSEL.x + 60 + ((index * 29) % 190);
      const y = VESSEL.y + 100 + ((index * 41) % 140);
      context.beginPath();
      context.moveTo(x, y - 7);
      context.lineTo(x + 7, y);
      context.lineTo(x, y + 7);
      context.lineTo(x - 7, y);
      context.closePath();
      context.fill();
    }
  }

  molecules.forEach((molecule) => {
    context.beginPath();
    context.fillStyle = molecule.kind === "A" ? "#60a5fa" : molecule.kind === "B" ? "#f87171" : "#c084fc";
    context.arc(molecule.x, molecule.y, molecule.kind === "C" ? 7 : 6, 0, Math.PI * 2);
    context.fill();
  });

  flashes.forEach((flash) => {
    context.save();
    context.globalAlpha = flash.life / 5;
    context.fillStyle = "#ffffff";
    context.shadowColor = "#ffffff";
    context.shadowBlur = 18;
    context.beginPath();
    context.arc(flash.x, flash.y, 18 - flash.life * 1.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });

  const gaugeX = 590;
  const gaugeY = 80;
  const gaugeH = 240;
  const fillH = Math.max(0, Math.min(gaugeH, (state.temperature / 500) * gaugeH));
  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 4;
  context.strokeRect(gaugeX, gaugeY, 28, gaugeH);
  const hot = state.temperature / 500;
  context.fillStyle = hot > 0.5 ? "#f97316" : "#38bdf8";
  context.fillRect(gaugeX + 4, gaugeY + gaugeH - fillH + 4, 20, Math.max(0, fillH - 8));
  context.fillStyle = "#e2e8f0";
  context.font = "13px sans-serif";
  context.fillText("Temperature", gaugeX - 28, gaugeY - 16);
  context.fillText(`${state.temperature.toFixed(0)} C`, gaugeX - 6, gaugeY + gaugeH + 26);
}

export default function ChemicalReactionScene({ state, onAction }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const moleculesRef = useRef<Molecule[]>([]);
  const flashesRef = useRef<Flash[]>([]);

  useEffect(() => {
    let frame = 0;
    let animation = 0;
    const tick = () => {
      frame += 1;
      syncMolecules(moleculesRef.current, state);
      moveMolecules(moleculesRef.current);
      if (state.reactionStarted && !state.paused && frame % 6 === 0) {
        onAction({ type: "STEP" });
      }
      if (state.reactionStarted && state.reactionRate > 0.1 && Math.random() < 0.16) {
        flashesRef.current.push({
          x: VESSEL.x + 48 + Math.random() * (VESSEL.width - 96),
          y: VESSEL.y + 82 + Math.random() * (VESSEL.height - 112),
          life: 5,
        });
      }
      flashesRef.current.forEach((flash) => {
        flash.life -= 1;
      });
      flashesRef.current = flashesRef.current.filter((flash) => flash.life > 0);
      if (canvasRef.current) drawScene(canvasRef.current, state, moleculesRef.current, flashesRef.current);
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [onAction, state]);

  return (
    <div className="space-y-4 p-4">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="w-full rounded-lg border border-slate-800 bg-slate-950"
      />
      <div className="grid gap-2 text-sm text-slate-100 sm:grid-cols-2 lg:grid-cols-4">
        <span>Reactant A: {state.reactantA.toFixed(1)} mol</span>
        <span>Reactant B: {state.reactantB.toFixed(1)} mol</span>
        <span>Product C: {state.productC.toFixed(1)} mol</span>
        <span>Temperature: {state.temperature.toFixed(0)} C</span>
        <span>Reaction Rate: {state.reactionRate.toFixed(3)}</span>
        <span>Catalyst: {state.catalyst ? "Active" : "None"}</span>
        <span>Energy Type: {state.energyType === "exothermic" ? "Exothermic" : "Endothermic"}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={state.reactionStarted}
          onClick={() => onAction({ type: "START_REACTION" })}
          className="min-h-11 rounded-full bg-cyan-300 px-4 text-sm font-semibold text-slate-950 disabled:bg-slate-700 disabled:text-slate-400"
        >
          Start Reaction
        </button>
        <button
          type="button"
          onClick={() => onAction({ type: state.catalyst ? "REMOVE_CATALYST" : "ADD_CATALYST" })}
          className="min-h-11 rounded-full border border-slate-700 px-4 text-sm text-slate-100"
        >
          {state.catalyst ? "Remove Catalyst" : "Add Catalyst"}
        </button>
        <button
          type="button"
          onClick={() =>
            onAction({
              type: "SET_ENERGY_TYPE",
              value: state.energyType === "exothermic" ? "endothermic" : "exothermic",
            })
          }
          className="min-h-11 rounded-full border border-slate-700 px-4 text-sm text-slate-100"
        >
          {state.energyType === "exothermic" ? "Exothermic" : "Endothermic"}
        </button>
        <button
          type="button"
          onClick={() => onAction({ type: "RESET" })}
          className="min-h-11 rounded-full border border-slate-700 px-4 text-sm text-slate-100"
        >
          Reset
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["Reactant A", "reactantA", 0, 100, state.reactantA],
          ["Reactant B", "reactantB", 0, 100, state.reactantB],
          ["Temperature", "temperature", 0, 500, state.temperature],
        ].map(([label, key, min, max, value]) => (
          <label key={String(key)} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-100">
            <span className="flex justify-between">
              {label}
              <strong>{Number(value).toFixed(0)}</strong>
            </span>
            <input
              type="range"
              min={Number(min)}
              max={Number(max)}
              value={Number(value)}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (key === "reactantA") onAction({ type: "SET_REACTANT_A", value: next });
                if (key === "reactantB") onAction({ type: "SET_REACTANT_B", value: next });
                if (key === "temperature") onAction({ type: "SET_TEMPERATURE", value: next });
              }}
              className="mt-3 w-full accent-cyan-300"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

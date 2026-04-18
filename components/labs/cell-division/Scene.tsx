"use client";

import { useEffect, useRef } from "react";
import type { CellDivisionAction } from "@/lib/labs/cell-division/actions";
import type { CellDivisionState } from "@/lib/labs/cell-division/state";

type Props = {
  state: CellDivisionState;
  onAction: (action: CellDivisionAction) => void;
};

const WIDTH = 760;
const HEIGHT = 420;
const CENTER_X = WIDTH / 2;
const CENTER_Y = 190;

const stageLabels: Record<CellDivisionState["stage"], string> = {
  interphase: "Interphase - Cell prepares to divide",
  prophase: "Prophase - Chromosomes condense",
  metaphase: "Metaphase - Chromosomes line up",
  anaphase: "Anaphase - Chromosomes separate",
  telophase: "Telophase - Two nuclei form",
  cytokinesis: "Cytokinesis - Cell splits into two",
};

function drawCellMembrane(context: CanvasRenderingContext2D, x = CENTER_X, y = CENTER_Y, rx = 170, ry = 120) {
  context.strokeStyle = "#67e8f9";
  context.lineWidth = 5;
  context.beginPath();
  context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  context.stroke();
}

function drawNucleus(context: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha = 1) {
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = "rgba(59, 130, 246, 0.18)";
  context.strokeStyle = "#93c5fd";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawChromosome(context: CanvasRenderingContext2D, x: number, y: number, size = 22, color = "#f472b6") {
  context.strokeStyle = color;
  context.lineWidth = 6;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(x - size / 2, y - size);
  context.lineTo(x + size / 2, y + size);
  context.moveTo(x + size / 2, y - size);
  context.lineTo(x - size / 2, y + size);
  context.stroke();
}

function drawLooseDna(context: CanvasRenderingContext2D) {
  context.strokeStyle = "#c084fc";
  context.lineWidth = 3;
  for (let line = 0; line < 5; line += 1) {
    context.beginPath();
    for (let step = 0; step < 80; step += 1) {
      const x = CENTER_X - 70 + step * 1.8;
      const y = CENTER_Y - 40 + line * 18 + Math.sin(step / 5 + line) * 8;
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
}

function drawSpindle(context: CanvasRenderingContext2D, targets: Array<{ x: number; y: number }>) {
  context.strokeStyle = "rgba(125, 211, 252, 0.6)";
  context.lineWidth = 2;
  const poles = [
    { x: CENTER_X - 150, y: CENTER_Y },
    { x: CENTER_X + 150, y: CENTER_Y },
  ];
  for (const target of targets) {
    for (const pole of poles) {
      context.beginPath();
      context.moveTo(pole.x, pole.y);
      context.lineTo(target.x, target.y);
      context.stroke();
    }
  }
  context.fillStyle = "#bae6fd";
  for (const pole of poles) {
    context.beginPath();
    context.arc(pole.x, pole.y, 7, 0, Math.PI * 2);
    context.fill();
  }
}

function drawScene(canvas: HTMLCanvasElement, state: CellDivisionState) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const background = context.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, "#052e2b");
  background.addColorStop(1, "#0f172a");
  context.fillStyle = background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  const chromosomePositions = Array.from({ length: 8 }, (_, index) => ({
    x: CENTER_X - 84 + (index % 4) * 56,
    y: CENTER_Y - 35 + Math.floor(index / 4) * 70,
  }));

  if (state.stage === "interphase") {
    drawCellMembrane(context);
    drawNucleus(context, CENTER_X, CENTER_Y, 72);
    drawLooseDna(context);
  }

  if (state.stage === "prophase") {
    drawCellMembrane(context);
    drawNucleus(context, CENTER_X, CENTER_Y, 76, 0.35);
    chromosomePositions.forEach((point) => drawChromosome(context, point.x, point.y));
  }

  if (state.stage === "metaphase") {
    drawCellMembrane(context);
    const targets = Array.from({ length: 8 }, (_, index) => ({
      x: CENTER_X,
      y: CENTER_Y - 84 + index * 24,
    }));
    drawSpindle(context, targets);
    targets.forEach((point) => drawChromosome(context, point.x, point.y, 18));
  }

  if (state.stage === "anaphase") {
    drawCellMembrane(context, CENTER_X, CENTER_Y, 205, 105);
    const leftTargets = Array.from({ length: 4 }, (_, index) => ({
      x: CENTER_X - 92 - index * 12,
      y: CENTER_Y - 48 + index * 32,
    }));
    const rightTargets = Array.from({ length: 4 }, (_, index) => ({
      x: CENTER_X + 92 + index * 12,
      y: CENTER_Y - 48 + index * 32,
    }));
    drawSpindle(context, [...leftTargets, ...rightTargets]);
    leftTargets.forEach((point) => drawChromosome(context, point.x, point.y, 16, "#fda4af"));
    rightTargets.forEach((point) => drawChromosome(context, point.x, point.y, 16, "#fda4af"));
  }

  if (state.stage === "telophase") {
    context.strokeStyle = "#67e8f9";
    context.lineWidth = 5;
    context.beginPath();
    context.ellipse(CENTER_X - 86, CENTER_Y, 118, 108, 0, Math.PI * 0.5, Math.PI * 1.5);
    context.ellipse(CENTER_X + 86, CENTER_Y, 118, 108, 0, Math.PI * 1.5, Math.PI * 0.5);
    context.stroke();
    drawNucleus(context, CENTER_X - 90, CENTER_Y, 55);
    drawNucleus(context, CENTER_X + 90, CENTER_Y, 55);
    chromosomePositions.slice(0, 4).forEach((point, index) => drawChromosome(context, CENTER_X - 110 + index * 15, point.y, 12, "#c084fc"));
    chromosomePositions.slice(4).forEach((point, index) => drawChromosome(context, CENTER_X + 70 + index * 15, point.y, 12, "#c084fc"));
  }

  if (state.stage === "cytokinesis") {
    drawCellMembrane(context, CENTER_X - 120, CENTER_Y, 100, 88);
    drawCellMembrane(context, CENTER_X + 120, CENTER_Y, 100, 88);
    drawNucleus(context, CENTER_X - 120, CENTER_Y, 42);
    drawNucleus(context, CENTER_X + 120, CENTER_Y, 42);
  }

  context.fillStyle = "#f8fafc";
  context.font = "bold 24px sans-serif";
  context.fillText(state.stage.toUpperCase(), 30, 42);
  context.font = "16px sans-serif";
  context.fillText(stageLabels[state.stage], 30, 70);
  context.fillStyle = "rgba(2, 6, 23, 0.78)";
  context.fillRect(18, HEIGHT - 76, 560, 52);
  context.fillStyle = "#e0f2fe";
  context.font = "15px sans-serif";
  context.fillText(
    `Chromosomes: ${state.chromosomeCount} | Cells: ${state.cellCount} | Progress: ${state.progress.toFixed(0)}%`,
    30,
    HEIGHT - 48
  );
  context.fillStyle = "#1e293b";
  context.fillRect(30, HEIGHT - 34, 300, 10);
  context.fillStyle = "#22d3ee";
  context.fillRect(30, HEIGHT - 34, 300 * Math.min(1, state.progress / 100), 10);
}

export default function CellDivisionScene({ state, onAction }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (canvasRef.current) drawScene(canvasRef.current, state);
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
      const dt = Math.min(0.5, Math.max(0.001, (timestamp - previous) / 1000));
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
        aria-label="Cell Division Explorer mitosis canvas simulation"
      />
      <div className="mt-3 grid gap-3">
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => onAction({ type: "ADVANCE_STAGE" })} className="min-h-11 rounded-xl bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950">
            Next Stage
          </button>
          <button type="button" onClick={() => onAction(state.paused ? { type: "PLAY" } : { type: "PAUSE" })} className="min-h-11 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100">
            {state.paused ? "Play" : "Pause"}
          </button>
          <button type="button" onClick={() => onAction({ type: "RESET" })} className="min-h-11 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100">
            Reset
          </button>
        </div>
        <label className="text-sm text-slate-100">
          Speed {state.speed.toFixed(1)}
          <input className="mt-2 w-full accent-cyan-300" type="range" min="1" max="5" step="0.1" value={state.speed} onChange={(event) => onAction({ type: "SET_SPEED", value: Number(event.target.value) })} />
        </label>
      </div>
    </div>
  );
}

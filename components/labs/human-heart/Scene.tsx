"use client";

import { useEffect, useRef } from "react";
import type { HumanHeartAction } from "@/lib/labs/human-heart/actions";
import type { HumanHeartState } from "@/lib/labs/human-heart/state";

type HeartSceneProps = {
  state: HumanHeartState;
  onAction: (action: HumanHeartAction) => void;
};

const CANVAS_WIDTH = 760;
const CANVAS_HEIGHT = 420;

function oxygenColor(oxygenLevel: number) {
  if (oxygenLevel > 90) return "#22c55e";
  if (oxygenLevel >= 70) return "#facc15";
  return "#ef4444";
}

function exerciseLabel(level: number) {
  if (level === 1) return "Light";
  if (level === 2) return "Moderate";
  if (level >= 3) return "Intense";
  return "Rest";
}

function drawChamber(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  pulse: number
) {
  const expand = 1 + pulse * 0.07;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  context.save();
  context.translate(centerX, centerY);
  context.scale(expand, expand);
  context.translate(-centerX, -centerY);
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(x + width * 0.5, y);
  context.bezierCurveTo(x + width, y + height * 0.1, x + width * 0.9, y + height, x + width * 0.52, y + height);
  context.bezierCurveTo(x + width * 0.08, y + height, x, y + height * 0.1, x + width * 0.5, y);
  context.fill();
  context.restore();
}

function drawScene(canvas: HTMLCanvasElement, state: HumanHeartState, pulse: number) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const background = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  background.addColorStop(0, "#090f1c");
  background.addColorStop(1, "#111827");
  context.fillStyle = background;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  context.fillStyle = "rgba(15, 23, 42, 0.82)";
  context.fillRect(40, 36, 500, 330);
  context.strokeStyle = "#334155";
  context.lineWidth = 2;
  context.strokeRect(40, 36, 500, 330);

  drawChamber(context, 132, 74, 128, 118, "#ef4444", pulse);
  drawChamber(context, 318, 74, 128, 118, "#312e81", pulse * 0.88);
  drawChamber(context, 112, 206, 156, 132, "#dc2626", pulse);
  drawChamber(context, 312, 206, 156, 132, "#1e1b4b", pulse * 0.88);

  context.fillStyle = "#e0f2fe";
  context.font = "13px sans-serif";
  context.fillText("Left atrium", 154, 92);
  context.fillText("Right atrium", 336, 92);
  context.fillText("Left ventricle", 138, 232);
  context.fillText("Right ventricle", 334, 232);

  if (state.blockage) {
    context.fillStyle = "rgba(15, 23, 42, 0.78)";
    context.beginPath();
    context.arc(210, 280, 32, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#facc15";
    context.font = "bold 16px sans-serif";
    context.fillText("Blockage", 190, 322);
  }

  context.fillStyle = "rgba(2, 6, 23, 0.76)";
  context.fillRect(560, 42, 166, 306);
  context.fillStyle = "#f8fafc";
  context.font = "bold 42px sans-serif";
  context.fillText(`${Math.round(state.heartRate)}`, 586, 112);
  context.font = "bold 18px sans-serif";
  context.fillText("BPM", 666, 112);

  context.fillStyle = "#cbd5e1";
  context.font = "15px sans-serif";
  context.fillText(`${state.cardiacOutput.toFixed(1)} L/min`, 586, 148);
  context.fillText(exerciseLabel(state.exerciseLevel), 586, 178);

  const gaugeX = 642;
  const gaugeY = 250;
  context.strokeStyle = "#334155";
  context.lineWidth = 12;
  context.beginPath();
  context.arc(gaugeX, gaugeY, 48, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = oxygenColor(state.oxygenLevel);
  context.beginPath();
  context.arc(
    gaugeX,
    gaugeY,
    48,
    -Math.PI / 2,
    -Math.PI / 2 + Math.PI * 2 * (Math.max(0, Math.min(100, state.oxygenLevel)) / 100)
  );
  context.stroke();
  context.fillStyle = "#f8fafc";
  context.font = "bold 21px sans-serif";
  context.fillText(`${Math.round(state.oxygenLevel)}%`, gaugeX - 25, gaugeY + 7);
  context.font = "13px sans-serif";
  context.fillText("Oxygen", gaugeX - 24, gaugeY + 72);

  if (state.blockage) {
    context.fillStyle = "#facc15";
    context.font = "bold 15px sans-serif";
    context.fillText("Warning: Blockage", 586, 214);
  }

  context.fillStyle = "rgba(2, 6, 23, 0.74)";
  context.fillRect(18, CANVAS_HEIGHT - 45, 445, 30);
  context.fillStyle = "#e0f2fe";
  context.font = "15px sans-serif";
  context.fillText(
    `Oxygen: ${state.oxygenLevel.toFixed(0)}% | Stroke volume: ${state.strokeVolume.toFixed(0)} mL | Time: ${state.time.toFixed(2)} s`,
    30,
    CANVAS_HEIGHT - 24
  );
}

export default function HumanHeartScene({ state, onAction }: HeartSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const beatStartRef = useRef<number | null>(null);
  const lastStepRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    drawScene(canvasRef.current, state, 0.15);
  }, [state]);

  useEffect(() => {
    const tick = (timestamp: number) => {
      const interval = 60000 / Math.max(20, state.heartRate);
      const beatStart = beatStartRef.current ?? timestamp;
      const elapsed = (timestamp - beatStart) % interval;
      if (timestamp - beatStart >= interval) {
        beatStartRef.current = timestamp;
      }
      const phase = elapsed / interval;
      const pulse = phase < 0.22 ? Math.sin((phase / 0.22) * Math.PI) : 0;

      if (canvasRef.current) {
        drawScene(canvasRef.current, state, pulse);
      }

      if (!state.paused) {
        const previous = lastStepRef.current ?? timestamp;
        lastStepRef.current = timestamp;
        const dt = Math.min(1, Math.max(0.001, (timestamp - previous) / 1000));
        onAction({ type: "STEP", dt });
      } else {
        lastStepRef.current = null;
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = null;
      beatStartRef.current = null;
      lastStepRef.current = null;
    };
  }, [onAction, state]);

  return (
    <div className="bg-[var(--ll-bg)] p-3 sm:p-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="h-auto w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]"
        aria-label="Human Heart Simulator circulatory system animation"
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
          onClick={() => onAction(state.blockage ? { type: "CLEAR_BLOCKAGE" } : { type: "SIMULATE_BLOCKAGE" })}
          className="min-h-11 rounded-xl border border-[var(--ll-border)] px-3 py-2 text-sm font-semibold text-[var(--ll-text)]"
        >
          {state.blockage ? "Clear" : "Blockage"}
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

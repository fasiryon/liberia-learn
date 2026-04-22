"use client";

import { useEffect, useRef } from "react";
import type { PendulumLabAction } from "@/lib/labs/pendulum-lab/actions";
import type { PendulumLabState } from "@/lib/labs/pendulum-lab/state";

type PendulumSceneProps = {
  state: PendulumLabState;
  onAction: (action: PendulumLabAction) => void;
};

const CANVAS_WIDTH = 760;
const CANVAS_HEIGHT = 420;
const PIVOT_Y = 54;
const BOB_RADIUS = 18;

function rodColor(angularVelocity: number) {
  const ratio = Math.min(1, Math.abs(angularVelocity) / 6);
  const red = Math.round(56 + ratio * 220);
  const green = Math.round(189 - ratio * 84);
  const blue = Math.round(230 - ratio * 170);
  return `rgb(${red}, ${green}, ${blue})`;
}

function bobPosition(state: PendulumLabState) {
  const pivotX = CANVAS_WIDTH / 2;
  const angleRad = state.angle * (Math.PI / 180);
  const maxRodLength = CANVAS_HEIGHT - PIVOT_Y - 72;
  const rodLength = Math.min(maxRodLength, Math.max(72, state.length * 80));
  return {
    pivotX,
    pivotY: PIVOT_Y,
    rodLength,
    bobX: pivotX + Math.sin(angleRad) * rodLength,
    bobY: PIVOT_Y + Math.cos(angleRad) * rodLength,
  };
}

function drawScene(
  canvas: HTMLCanvasElement,
  state: PendulumLabState,
  trail: Array<{ x: number; y: number }>
) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const background = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  background.addColorStop(0, "#061221");
  background.addColorStop(0.58, "#0f2543");
  background.addColorStop(1, "#111827");
  context.fillStyle = background;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const { pivotX, pivotY, bobX, bobY } = bobPosition(state);

  context.strokeStyle = "rgba(148, 163, 184, 0.28)";
  context.lineWidth = 1;
  context.beginPath();
  context.arc(pivotX, pivotY, 260, Math.PI * 0.42, Math.PI * 0.58);
  context.stroke();

  trail.forEach((point, index) => {
    const opacity = ((index + 1) / trail.length) * 0.28;
    context.fillStyle = `rgba(125, 211, 252, ${opacity})`;
    context.beginPath();
    context.arc(point.x, point.y, BOB_RADIUS * 0.62, 0, Math.PI * 2);
    context.fill();
  });

  context.globalAlpha = state.paused ? 0.7 : 1;
  context.strokeStyle = rodColor(state.angularVelocity);
  context.lineWidth = 5;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(pivotX, pivotY);
  context.lineTo(bobX, bobY);
  context.stroke();

  context.fillStyle = "#f8fafc";
  context.beginPath();
  context.arc(pivotX, pivotY, 9, 0, Math.PI * 2);
  context.fill();

  const bob = context.createRadialGradient(bobX - 7, bobY - 8, 3, bobX, bobY, BOB_RADIUS);
  bob.addColorStop(0, "#ffffff");
  bob.addColorStop(0.24, rodColor(state.angularVelocity));
  bob.addColorStop(1, "#0f172a");
  context.fillStyle = bob;
  context.beginPath();
  context.arc(bobX, bobY, BOB_RADIUS, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  const period = 2 * Math.PI * Math.sqrt(state.length / 9.81);
  context.fillStyle = "rgba(2, 6, 23, 0.74)";
  context.fillRect(18, CANVAS_HEIGHT - 45, 430, 30);
  context.fillStyle = "#e0f2fe";
  context.font = "15px sans-serif";
  context.fillText(
    `Length: ${state.length.toFixed(1)} m | Angle: ${state.angle.toFixed(1)} deg | Period: ${period.toFixed(2)} s`,
    30,
    CANVAS_HEIGHT - 24
  );
}

export default function PendulumScene({ state, onAction }: PendulumSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const trailRef = useRef<Array<{ x: number; y: number }>>([]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const position = bobPosition(state);
    trailRef.current = [
      ...trailRef.current,
      { x: position.bobX, y: position.bobY },
    ].slice(-12);
    drawScene(canvasRef.current, state, trailRef.current);
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
      const dt = Math.min(0.5, Math.max(0.001, (timestamp - previous) / 1000));
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
    <div className="bg-[var(--ll-bg)] p-3 sm:p-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="h-auto w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]"
        aria-label="Pendulum Lab swinging pendulum simulation"
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
          onClick={() => onAction({ type: "STEP", dt: 0.05 })}
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

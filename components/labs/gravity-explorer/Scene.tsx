"use client";

import { useEffect, useRef } from "react";
import type { GravityLabAction } from "@/lib/labs/gravity-explorer/actions";
import type { GravityLabState } from "@/lib/labs/gravity-explorer/state";

type GravitySceneProps = {
  state: GravityLabState;
  onAction: (action: GravityLabAction) => void;
};

const CANVAS_WIDTH = 760;
const CANVAS_HEIGHT = 420;
const GROUND_HEIGHT = 64;
const OBJECT_RADIUS = 18;

function velocityColor(velocity: number) {
  const ratio = Math.min(1, Math.max(0, velocity / 45));
  const blue = Math.round(230 - ratio * 160);
  const red = Math.round(56 + ratio * 220);
  const green = Math.round(189 - ratio * 84);
  return `rgb(${red}, ${green}, ${blue})`;
}

function objectYForHeight(height: number) {
  return (
    CANVAS_HEIGHT -
    GROUND_HEIGHT -
    (Math.max(0, Math.min(100, height)) / 100) *
      (CANVAS_HEIGHT - GROUND_HEIGHT - OBJECT_RADIUS)
  );
}

function drawScene(
  canvas: HTMLCanvasElement,
  state: GravityLabState,
  trail: Array<{ x: number; y: number }>,
  flash: number
) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const sky = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  sky.addColorStop(0, "#07142f");
  sky.addColorStop(0.58, "#0f2b4f");
  sky.addColorStop(1, "#172554");
  context.fillStyle = sky;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  context.fillStyle = "#0f172a";
  context.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);
  context.strokeStyle = flash > 0 ? `rgba(251, 191, 36, ${flash})` : "#34d399";
  context.lineWidth = flash > 0 ? 5 : 2;
  context.beginPath();
  context.moveTo(0, CANVAS_HEIGHT - GROUND_HEIGHT);
  context.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_HEIGHT);
  context.stroke();

  const x = CANVAS_WIDTH / 2;
  const y = objectYForHeight(state.height);

  trail.forEach((point, index) => {
    const opacity = ((index + 1) / trail.length) * 0.28;
    context.fillStyle = `rgba(125, 211, 252, ${opacity})`;
    context.beginPath();
    context.arc(point.x, point.y, OBJECT_RADIUS * 0.7, 0, Math.PI * 2);
    context.fill();
  });

  context.globalAlpha = state.paused ? 0.7 : 1;
  const sphere = context.createRadialGradient(
    x - 7,
    y - 9,
    3,
    x,
    y,
    OBJECT_RADIUS
  );
  sphere.addColorStop(0, "#ffffff");
  sphere.addColorStop(0.22, velocityColor(state.velocity));
  sphere.addColorStop(1, "#0f172a");
  context.fillStyle = sphere;
  context.beginPath();
  context.arc(x, y, OBJECT_RADIUS, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  context.fillStyle = "rgba(2, 6, 23, 0.74)";
  context.fillRect(18, CANVAS_HEIGHT - 45, 420, 30);
  context.fillStyle = "#e0f2fe";
  context.font = "15px sans-serif";
  context.fillText(
    `Height: ${state.height.toFixed(2)} m | Velocity: ${state.velocity.toFixed(2)} m/s | Time: ${state.time.toFixed(2)} s`,
    30,
    CANVAS_HEIGHT - 24
  );
}

export default function GravityScene({ state, onAction }: GravitySceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const trailRef = useRef<Array<{ x: number; y: number }>>([]);
  const previousHeightRef = useRef(state.height);
  const flashRef = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    const y = objectYForHeight(state.height);
    trailRef.current = [...trailRef.current, { x: CANVAS_WIDTH / 2, y }].slice(-8);
    if (previousHeightRef.current > 0 && state.height === 0) {
      flashRef.current = 1;
    }
    previousHeightRef.current = state.height;
    drawScene(canvasRef.current, state, trailRef.current, flashRef.current);
    flashRef.current = Math.max(0, flashRef.current - 0.18);
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
      const dt = Math.min(1, Math.max(0.01, (timestamp - previous) / 1000));
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
        aria-label="Gravity Explorer falling object simulation"
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

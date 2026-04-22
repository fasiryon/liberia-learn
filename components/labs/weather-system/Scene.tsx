"use client";

import { useEffect, useRef } from "react";
import type { WeatherSystemAction } from "@/lib/labs/weather-system/actions";
import type { WeatherSystemState } from "@/lib/labs/weather-system/state";

type Props = {
  state: WeatherSystemState;
  onAction: (action: WeatherSystemAction) => void;
};

type Drop = { x: number; y: number; speed: number; drift: number };
type Cloud = { x: number; y: number; scale: number };

const WIDTH = 760;
const HEIGHT = 500;
const TERRAIN_Y = 350;

function syncClouds(clouds: Cloud[], count: number) {
  while (clouds.length < count) {
    clouds.push({
      x: Math.random() * WIDTH,
      y: 42 + Math.random() * 105,
      scale: 0.75 + Math.random() * 0.75,
    });
  }
  clouds.splice(count);
}

function syncDrops(drops: Drop[], count: number) {
  while (drops.length < count) {
    drops.push({
      x: Math.random() * WIDTH,
      y: Math.random() * TERRAIN_Y,
      speed: 2 + Math.random() * 5,
      drift: -0.6 + Math.random() * 1.2,
    });
  }
  drops.splice(count);
}

function skyStops(state: WeatherSystemState): [string, string] {
  if (state.precipitation === "storm") return ["#1e1b4b", "#475569"];
  if (state.temperature < 5) return ["#64748b", "#bae6fd"];
  if (state.temperature > 35 && state.cloudCover < 40) return ["#0284c7", "#7dd3fc"];
  return ["#0ea5e9", "#bae6fd"];
}

function drawCloud(context: CanvasRenderingContext2D, cloud: Cloud, state: WeatherSystemState) {
  const grey = Math.round(170 - state.cloudCover * 0.6);
  context.fillStyle = `rgba(${grey}, ${grey + 10}, ${grey + 20}, 0.86)`;
  context.beginPath();
  context.ellipse(cloud.x, cloud.y, 36 * cloud.scale, 18 * cloud.scale, 0, 0, Math.PI * 2);
  context.ellipse(cloud.x + 28 * cloud.scale, cloud.y + 2, 32 * cloud.scale, 17 * cloud.scale, 0, 0, Math.PI * 2);
  context.ellipse(cloud.x - 28 * cloud.scale, cloud.y + 4, 28 * cloud.scale, 15 * cloud.scale, 0, 0, Math.PI * 2);
  context.ellipse(cloud.x + 4, cloud.y - 14 * cloud.scale, 28 * cloud.scale, 20 * cloud.scale, 0, 0, Math.PI * 2);
  context.fill();
}

function drawLandscape(context: CanvasRenderingContext2D, state: WeatherSystemState) {
  context.fillStyle = state.precipitation === "snow" ? "#e2e8f0" : "#166534";
  context.beginPath();
  context.moveTo(0, HEIGHT);
  context.lineTo(0, TERRAIN_Y + 56);
  context.quadraticCurveTo(130, TERRAIN_Y + 4, 280, TERRAIN_Y + 52);
  context.quadraticCurveTo(455, TERRAIN_Y + 102, 650, TERRAIN_Y + 28);
  context.lineTo(WIDTH, TERRAIN_Y + 46);
  context.lineTo(WIDTH, HEIGHT);
  context.closePath();
  context.fill();

  if (state.precipitation !== "storm") {
    for (let index = 0; index < 9; index += 1) {
      const x = 40 + index * 78;
      const y = TERRAIN_Y + 58 + Math.sin(index) * 12;
      context.fillStyle = "#7c2d12";
      context.fillRect(x, y + 24, 7, 34);
      context.fillStyle = "#14532d";
      context.beginPath();
      context.moveTo(x + 3, y);
      context.lineTo(x - 18, y + 36);
      context.lineTo(x + 24, y + 36);
      context.closePath();
      context.fill();
    }
  }
}

function drawScene(
  canvas: HTMLCanvasElement,
  state: WeatherSystemState,
  clouds: Cloud[],
  drops: Drop[],
  frame: number
) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const [top, bottom] = skyStops(state);
  const sky = context.createLinearGradient(0, 0, 0, TERRAIN_Y);
  sky.addColorStop(0, top);
  sky.addColorStop(1, bottom);
  context.fillStyle = sky;
  context.fillRect(0, 0, WIDTH, TERRAIN_Y);
  if (state.cloudCover > 45) {
    context.fillStyle = `rgba(71, 85, 105, ${Math.min(0.55, state.cloudCover / 180)})`;
    context.fillRect(0, 0, WIDTH, TERRAIN_Y);
  }

  clouds.forEach((cloud) => drawCloud(context, cloud, state));

  if (state.precipitation === "rain" || state.precipitation === "storm") {
    context.strokeStyle = "rgba(100, 150, 255, 0.6)";
    context.lineWidth = state.precipitation === "storm" ? 2 : 1.3;
    drops.forEach((drop) => {
      context.beginPath();
      context.moveTo(drop.x, drop.y);
      context.lineTo(drop.x - (state.precipitation === "storm" ? 12 : 7), drop.y + 26);
      context.stroke();
    });
  }

  if (state.precipitation === "snow") {
    context.fillStyle = "rgba(255, 255, 255, 0.88)";
    drops.forEach((drop) => {
      context.beginPath();
      context.arc(drop.x, drop.y, 2.5, 0, Math.PI * 2);
      context.fill();
    });
    context.fillStyle = "rgba(255, 255, 255, 0.55)";
    context.fillRect(0, TERRAIN_Y + 130, WIDTH, 15);
  }

  if (state.precipitation === "storm" && frame % 95 < 6) {
    context.strokeStyle = "#fff";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(390, 90);
    context.lineTo(360, 155);
    context.lineTo(385, 150);
    context.lineTo(340, 250);
    context.stroke();
    context.fillStyle = "rgba(255, 255, 255, 0.14)";
    context.fillRect(0, 0, WIDTH, HEIGHT);
  }

  drawLandscape(context, state);

  const arrowLength = 24 + (state.windSpeed / 150) * 110;
  context.strokeStyle = "#f8fafc";
  context.fillStyle = "#f8fafc";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(WIDTH - 175, 42);
  context.lineTo(WIDTH - 175 + arrowLength, 42);
  context.stroke();
  context.beginPath();
  context.moveTo(WIDTH - 175 + arrowLength, 42);
  context.lineTo(WIDTH - 185 + arrowLength, 34);
  context.lineTo(WIDTH - 185 + arrowLength, 50);
  context.closePath();
  context.fill();
  context.font = "13px sans-serif";
  context.fillText(`${state.windSpeed.toFixed(0)} km/h`, WIDTH - 168, 66);
}

export default function WeatherSystemScene({ state, onAction }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cloudsRef = useRef<Cloud[]>([]);
  const dropsRef = useRef<Drop[]>([]);

  useEffect(() => {
    let frame = 0;
    let animation = 0;
    const tick = () => {
      frame += 1;
      syncClouds(cloudsRef.current, Math.floor(state.cloudCover / 20));
      const dropCount = state.precipitation === "storm" ? 100 : state.precipitation === "rain" ? 50 : state.precipitation === "snow" ? 30 : 0;
      syncDrops(dropsRef.current, dropCount);
      cloudsRef.current.forEach((cloud) => {
        cloud.x -= 0.25 + state.windSpeed / 260;
        if (cloud.x < -80) cloud.x = WIDTH + 80;
      });
      dropsRef.current.forEach((drop) => {
        drop.y += state.precipitation === "snow" ? drop.speed * 0.35 : drop.speed;
        drop.x += state.precipitation === "snow" ? drop.drift : -1.5;
        if (drop.y > TERRAIN_Y + 120) {
          drop.y = -10;
          drop.x = Math.random() * WIDTH;
        }
      });
      if (!state.paused && frame % 6 === 0) onAction({ type: "STEP" });
      if (canvasRef.current) drawScene(canvasRef.current, state, cloudsRef.current, dropsRef.current, frame);
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [onAction, state]);

  return (
    <div className="space-y-4 p-4">
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]" />
      <div className="grid gap-2 text-sm text-[var(--ll-text)] sm:grid-cols-2 lg:grid-cols-3">
        <span>Temperature: {state.temperature.toFixed(0)} C</span>
        <span>Humidity: {state.humidity.toFixed(0)}%</span>
        <span>Pressure: {state.pressure.toFixed(0)} hPa</span>
        <span>Wind: {state.windSpeed.toFixed(0)} km/h</span>
        <span>Cloud Cover: {state.cloudCover.toFixed(0)}%</span>
        <span>Precipitation: {state.precipitation}</span>
        <span>Season: {state.season === "wet" ? "Wet" : "Dry"}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onAction({ type: state.season === "wet" ? "SET_SEASON" : "SET_SEASON", value: state.season === "wet" ? "dry" : "wet" })} className="min-h-11 rounded-full bg-[var(--ll-silver-soft)] px-4 text-sm font-semibold text-[var(--ll-text-faint)]">
          {state.season === "wet" ? "Dry Season" : "Wet Season"}
        </button>
        <button type="button" onClick={() => onAction({ type: "SIMULATE_STORM" })} className="min-h-11 rounded-full border border-[var(--ll-border)] px-4 text-sm text-[var(--ll-text)]">
          Simulate Storm
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
          ["Temperature", "SET_TEMPERATURE", -20, 50, state.temperature],
          ["Humidity", "SET_HUMIDITY", 0, 100, state.humidity],
          ["Pressure", "SET_PRESSURE", 950, 1050, state.pressure],
          ["Wind Speed", "SET_WIND_SPEED", 0, 150, state.windSpeed],
        ].map(([label, type, min, max, value]) => (
          <label key={String(type)} className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-3 text-sm text-[var(--ll-text)]">
            <span className="flex justify-between">{label}<strong>{Number(value).toFixed(0)}</strong></span>
            <input
              type="range"
              min={Number(min)}
              max={Number(max)}
              value={Number(value)}
              onChange={(event) => onAction({ type: type as any, value: Number(event.target.value) })}
              className="mt-3 w-full accent-cyan-300"
            />
          </label>
        ))}
      </div>
      <p className="rounded-lg border border-emerald-500/20 bg-[var(--ll-yellow)]/10 p-3 text-sm leading-6 text-[var(--ll-yellow)]">
        Liberia has a wet season (May-October) and dry season (November-April). The wet season brings heavy rainfall especially in Monrovia, one of the world&apos;s wettest capitals.
      </p>
    </div>
  );
}

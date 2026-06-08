"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, CloudRain } from "lucide-react";

type Particle = { x: number; y: number; vy: number; type: "vapor" | "rain" };

export default function WaterCycleLabPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const cloudDensityRef = useRef(0);
  const groundwaterRef = useRef(30);

  const [paused, setPaused] = useState(false);
  const [temperature, setTemperature] = useState(22);
  const [cloudDensity, setCloudDensity] = useState(0);
  const [groundwater, setGroundwater] = useState(30);
  const [phase, setPhase] = useState<"evaporation" | "condensation" | "precipitation">("evaporation");

  const pausedRef = useRef(paused);
  const tempRef = useRef(temperature);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { tempRef.current = temperature; }, [temperature]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const OCEAN_X = 0;
    const OCEAN_W = W * 0.35;
    const GROUND_Y = H * 0.72;
    const CLOUD_Y = H * 0.18;

    let lastTime = 0;

    const draw = (ts: number) => {
      const dt = Math.min(0.05, (ts - lastTime) / 1000);
      lastTime = ts;

      if (!pausedRef.current) {
        const evapRate = Math.max(0, (tempRef.current - 10) / 40) * 0.6;

        // Spawn vapor particles
        if (Math.random() < evapRate && particlesRef.current.length < 120) {
          particlesRef.current.push({
            x: OCEAN_X + Math.random() * OCEAN_W,
            y: GROUND_Y - 10,
            vy: -(0.3 + Math.random() * 0.5),
            type: "vapor",
          });
        }

        // Move particles
        particlesRef.current = particlesRef.current.filter((p) => {
          p.y += p.vy;
          if (p.type === "vapor") {
            // Reach cloud zone → add to cloud density
            if (p.y < CLOUD_Y + 40) {
              cloudDensityRef.current = Math.min(100, cloudDensityRef.current + 0.4);
              setCloudDensity(Math.round(cloudDensityRef.current));
              return false;
            }
            return p.y > -10;
          } else {
            // Rain falling
            if (p.y > GROUND_Y) {
              groundwaterRef.current = Math.min(100, groundwaterRef.current + 0.15);
              setGroundwater(Math.round(groundwaterRef.current));
              return false;
            }
            return true;
          }
        });

        // Auto-precipitate when cloud is dense
        if (cloudDensityRef.current > 70 && Math.random() < 0.15) {
          const rainX = W * 0.15 + Math.random() * W * 0.7;
          particlesRef.current.push({ x: rainX, y: CLOUD_Y + 30, vy: 2 + Math.random(), type: "rain" });
          cloudDensityRef.current = Math.max(0, cloudDensityRef.current - 0.12);
          setCloudDensity(Math.round(cloudDensityRef.current));
        }

        // Update phase label
        if (cloudDensityRef.current > 65) setPhase("precipitation");
        else if (cloudDensityRef.current > 20) setPhase("condensation");
        else setPhase("evaporation");

        // Groundwater slowly evaporates
        groundwaterRef.current = Math.max(0, groundwaterRef.current - 0.005);
        setGroundwater(Math.round(groundwaterRef.current));
      }

      // ── Draw ──
      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      skyGrad.addColorStop(0, "#0c1a2e");
      skyGrad.addColorStop(1, "#1e3a5f");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, GROUND_Y);

      // Ground
      ctx.fillStyle = "#2d4a1e";
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

      // Groundwater indicator
      const gwHeight = (groundwaterRef.current / 100) * (H - GROUND_Y) * 0.6;
      ctx.fillStyle = "rgba(30,120,200,0.35)";
      ctx.fillRect(0, H - gwHeight, W, gwHeight);

      // Ocean
      const oceanGrad = ctx.createLinearGradient(OCEAN_X, GROUND_Y - 60, OCEAN_X, GROUND_Y);
      oceanGrad.addColorStop(0, "rgba(30,80,200,0.9)");
      oceanGrad.addColorStop(1, "rgba(10,40,120,0.9)");
      ctx.fillStyle = oceanGrad;
      ctx.beginPath();
      ctx.roundRect(OCEAN_X, GROUND_Y - 55, OCEAN_W, 55, [0, 12, 0, 0]);
      ctx.fill();

      // Sun (only if warm enough)
      if (tempRef.current > 15) {
        const alpha = Math.min(1, (tempRef.current - 15) / 25);
        ctx.fillStyle = `rgba(255,200,50,${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(W - 60, 50, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,220,80,${alpha * 0.4})`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(W - 60, 50, 36, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Cloud
      const cAlpha = Math.min(1, cloudDensityRef.current / 60);
      ctx.fillStyle = `rgba(${cloudDensityRef.current > 60 ? "80,80,100" : "200,220,240"},${cAlpha})`;
      const cx = W * 0.5, cy = CLOUD_Y;
      const cw = 80 + cloudDensityRef.current * 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - cw * 0.35, cy + 6, cw * 0.55, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + cw * 0.32, cy + 8, cw * 0.45, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Particles
      for (const p of particlesRef.current) {
        if (p.type === "vapor") {
          ctx.fillStyle = "rgba(120,200,255,0.65)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = "rgba(80,160,255,0.8)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x, p.y + 10);
          ctx.stroke();
        }
      }

      // Labels
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "12px sans-serif";
      ctx.fillText("Ocean", 12, GROUND_Y - 62);
      ctx.fillText("Cloud", cx - 18, CLOUD_Y - 28);
      ctx.fillStyle = "rgba(120,220,255,0.85)";
      ctx.fillText(`☁ ${Math.round(cloudDensityRef.current)}%`, cx - 14, CLOUD_Y + 42);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  function triggerRain() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    for (let i = 0; i < 40; i++) {
      particlesRef.current.push({
        x: canvas.width * 0.1 + Math.random() * canvas.width * 0.8,
        y: canvas.height * 0.25,
        vy: 2 + Math.random() * 1.5,
        type: "rain",
      });
    }
    cloudDensityRef.current = Math.max(0, cloudDensityRef.current - 25);
    setCloudDensity(Math.round(cloudDensityRef.current));
  }

  function reset() {
    particlesRef.current = [];
    cloudDensityRef.current = 0;
    groundwaterRef.current = 30;
    setCloudDensity(0);
    setGroundwater(30);
    setTemperature(22);
    setPhase("evaporation");
  }

  const phaseColor = { evaporation: "text-orange-400", condensation: "text-sky-400", precipitation: "text-blue-400" }[phase];
  const phaseLabel = { evaporation: "Evaporation", condensation: "Condensation", precipitation: "Precipitation" }[phase];

  return (
    <section className="space-y-4 p-2 sm:p-3">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold uppercase tracking-wide ${phaseColor}`}>
          Phase: {phaseLabel}
        </span>
        <div className="flex gap-2 text-xs text-[var(--ll-text-faint)]">
          <span>Cloud {cloudDensity}%</span>
          <span>·</span>
          <span>Groundwater {groundwater}%</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={560}
        height={320}
        className="h-auto w-full rounded-xl border border-[var(--ll-border)]"
        aria-label="Water Cycle Simulation"
      />

      <div className="grid gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-faint)]">
            Temperature: {temperature}°C
          </span>
          <input
            type="range" min={0} max={50} value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full accent-orange-400"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--ll-accent)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)]"
          >
            {paused ? <><Play className="h-4 w-4" />Play</> : <><Pause className="h-4 w-4" />Pause</>}
          </button>
          <button
            type="button"
            onClick={triggerRain}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)]"
          >
            <CloudRain className="h-4 w-4" />Trigger Rain
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)]"
          >
            <RotateCcw className="h-4 w-4" />Reset
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--ll-text-faint)]">
        Increase temperature to accelerate evaporation. Watch vapor rise, form clouds, and fall as rain that replenishes groundwater.
      </p>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";

export default function EarthquakeWavesLabPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [magnitude, setMagnitude] = useState(6);
  const [waveType, setWaveType] = useState<"both" | "P" | "S">("both");
  const pausedRef = useRef(false);
  const magRef = useRef(magnitude);
  const typeRef = useRef(waveType);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { magRef.current = magnitude; }, [magnitude]);
  useEffect(() => { typeRef.current = waveType; }, [waveType]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    const draw = () => {
      if (!pausedRef.current) timeRef.current += 0.02;
      const t = timeRef.current;
      const amp = magRef.current * 3;
      const epicX = W * 0.22, epicY = H * 0.32;

      ctx.clearRect(0, 0, W, H);

      // Earth cross-section layers
      const layers = [
        { y: 0, h: H * 0.5, color: "#1e3a5f", label: "Crust / Upper Mantle" },
        { y: H * 0.5, h: H * 0.22, color: "#7c2d12", label: "Lower Mantle" },
        { y: H * 0.72, h: H * 0.16, color: "#92400e", label: "Outer Core (liquid)" },
        { y: H * 0.88, h: H * 0.12, color: "#b45309", label: "Inner Core (solid)" },
      ];
      layers.forEach(({ y, h, color }) => {
        ctx.fillStyle = color;
        ctx.fillRect(0, y, W, h);
      });

      // Layer labels
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "10px sans-serif";
      layers.forEach(({ y, h, label }) => ctx.fillText(label, 8, y + h / 2 + 4));

      // Surface line
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, H * 0.5);
      ctx.lineTo(W, H * 0.5);
      ctx.stroke();

      const pSpeed = 0.9, sSpeed = 0.52;

      // P-waves (concentric expanding circles, fast)
      if (typeRef.current !== "S") {
        for (let r = 0; r < 5; r++) {
          const pr = ((t * pSpeed * 55 + r * 40) % 260) + 10;
          const alpha = Math.max(0, 0.7 - pr / 280) * (amp / 18);
          ctx.strokeStyle = `rgba(250,210,50,${alpha})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(epicX, epicY, pr, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // S-waves (shear — drawn as sinusoidal bands)
      if (typeRef.current !== "P") {
        for (let r = 0; r < 4; r++) {
          const sr = ((t * sSpeed * 55 + r * 52) % 260) + 10;
          const alpha = Math.max(0, 0.65 - sr / 270) * (amp / 18);
          ctx.strokeStyle = `rgba(100,200,255,${alpha})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.arc(epicX, epicY, sr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Surface wave along top
      const surfAmp = amp * 0.7;
      ctx.strokeStyle = "rgba(200,100,50,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < W; x++) {
        const dist = Math.abs(x - epicX);
        const decay = Math.exp(-dist / 180);
        const phase = dist * 0.08 - t * 3;
        const y = H * 0.5 - Math.sin(phase) * surfAmp * decay;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Seismograph readout (right panel)
      const sgX = W * 0.6, sgW = W * 0.37, sgH = 60, sgY = 20;
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(sgX, sgY, sgW, sgH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(sgX, sgY, sgW, sgH);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let px = 0; px < sgW; px++) {
        const pt = t - (sgW - px) * 0.04;
        const wave = Math.sin(pt * 8) * amp * 0.4 * Math.exp(-Math.max(0, 4 - pt) * 0.5);
        const py = sgY + sgH / 2 - wave;
        px === 0 ? ctx.moveTo(sgX + px, py) : ctx.lineTo(sgX + px, py);
      }
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "9px sans-serif";
      ctx.fillText("Seismograph", sgX + 4, sgY + 9);

      // Epicentre marker
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(epicX, epicY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "11px sans-serif";
      ctx.fillText("★ Epicentre", epicX + 10, epicY - 4);

      // Legend
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "rgba(250,210,50,0.85)"; ctx.fillText("P-wave (primary)", W * 0.63, H - 32);
      ctx.fillStyle = "rgba(100,200,255,0.85)"; ctx.fillText("S-wave (secondary)", W * 0.63, H - 18);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  function reset() { timeRef.current = 0; setPaused(false); }

  return (
    <section className="space-y-4 p-2 sm:p-3">
      <canvas ref={canvasRef} width={560} height={320}
        className="h-auto w-full rounded-xl border border-[var(--ll-border)]"
        aria-label="Earthquake Waves Simulation" />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-faint)]">
            Magnitude: {magnitude} (Richter)
          </span>
          <input type="range" min={2} max={9} value={magnitude}
            onChange={(e) => setMagnitude(Number(e.target.value))} className="w-full accent-red-500" />
        </label>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-faint)]">Wave type</span>
          <div className="flex gap-2">
            {(["both", "P", "S"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setWaveType(t)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold ${waveType === t ? "bg-[var(--ll-accent)] text-[var(--ll-text-faint)]" : "border border-[var(--ll-border)] text-[var(--ll-text)]"}`}>
                {t === "both" ? "Both" : `${t}-waves`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setPaused((p) => !p)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--ll-accent)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)]">
          {paused ? <><Play className="h-4 w-4" />Play</> : <><Pause className="h-4 w-4" />Pause</>}
        </button>
        <button type="button" onClick={reset}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)]">
          <RotateCcw className="h-4 w-4" />Reset
        </button>
      </div>

      <p className="text-xs text-[var(--ll-text-faint)]">
        P-waves are compressional (travel through solid and liquid); S-waves are shear (solids only &mdash; that&apos;s how we know Earth&apos;s outer core is liquid). Seismograph shows ground movement at a monitoring station.
      </p>
    </section>
  );
}

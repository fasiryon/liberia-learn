"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

type Machine = "lever" | "pulley" | "inclined-plane";

export default function SimpleMachinesLabPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [machine, setMachine] = useState<Machine>("lever");
  const [fulcrum, setFulcrum] = useState(50);
  const [load, setLoad] = useState(60);
  const [effort, setEffort] = useState(50);
  const [angle, setAngle] = useState(30);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#08111f";
    ctx.fillRect(0, 0, W, H);

    if (machine === "lever") drawLever(ctx, W, H);
    else if (machine === "pulley") drawPulley(ctx, W, H);
    else drawInclinedPlane(ctx, W, H);
  }, [machine, fulcrum, load, effort, angle]);

  function drawLever(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const beamY = H * 0.55;
    const fulcrumX = (fulcrum / 100) * W;
    const loadX = W * 0.12;
    const effortX = W * 0.88;
    const loadArm = fulcrumX - loadX;
    const effortArm = effortX - fulcrumX;
    const MA = effortArm / loadArm;
    const effortNeeded = load / MA;

    // Beam tilt based on balance
    const tilt = Math.atan2((load - effortNeeded) * 0.02, 1) * 0.3;

    ctx.save();
    ctx.translate(fulcrumX, beamY);
    ctx.rotate(tilt);

    // Beam
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-(fulcrumX), 0);
    ctx.lineTo(W - fulcrumX, 0);
    ctx.stroke();

    // Load
    ctx.fillStyle = "#f97316";
    const lx = -(fulcrumX) + (W * 0.12);
    ctx.fillRect(lx - 18, -20 - load * 0.5, 36, load * 0.5 + 6);
    ctx.fillStyle = "white";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${load}N`, lx, -load * 0.25 - 20);

    // Effort arrow
    const ex = (W * 0.88) - fulcrumX;
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ex, -effortNeeded * 0.4 - 15);
    ctx.lineTo(ex, -8);
    ctx.stroke();
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.moveTo(ex - 6, -8);
    ctx.lineTo(ex + 6, -8);
    ctx.lineTo(ex, 4);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.fillText(`${effortNeeded.toFixed(1)}N`, ex, -effortNeeded * 0.4 - 22);

    ctx.restore();

    // Fulcrum triangle
    ctx.fillStyle = "#475569";
    ctx.beginPath();
    ctx.moveTo(fulcrumX, beamY + 3);
    ctx.lineTo(fulcrumX - 18, beamY + 34);
    ctx.lineTo(fulcrumX + 18, beamY + 34);
    ctx.closePath();
    ctx.fill();

    // Info
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Mechanical Advantage: ${MA.toFixed(2)}×`, 16, H - 44);
    ctx.fillText(`Load arm: ${loadArm.toFixed(0)}px  |  Effort arm: ${effortArm.toFixed(0)}px`, 16, H - 24);
    ctx.fillStyle = MA > 1 ? "#4ade80" : "#f87171";
    ctx.fillText(MA > 1 ? "✓ Effort reduced by lever" : "× More effort than load", W * 0.62, H - 32);
  }

  function drawPulley(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const pulleys = Math.max(1, Math.min(4, Math.round(effort / 25)));
    const MA = pulleys;
    const effortNeeded = load / MA;
    const cx = W * 0.5;

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;

    // Fixed pulley
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, 50, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.arc(cx, 50, 7, 0, Math.PI * 2);
    ctx.fill();

    // Moveable pulley
    const movY = 50 + 120;
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, movY, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.arc(cx, movY, 7, 0, Math.PI * 2);
    ctx.fill();

    // Ropes
    for (let i = 0; i < pulleys; i++) {
      const rx = cx - 15 + (i * 10);
      ctx.strokeStyle = "rgba(148,163,184,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx, 50);
      ctx.lineTo(rx, movY);
      ctx.stroke();
    }

    // Load weight
    ctx.fillStyle = "#f97316";
    ctx.fillRect(cx - 28, movY + 22, 56, 38);
    ctx.fillStyle = "white";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${load}N`, cx, movY + 46);

    // Effort
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + 40, 80);
    ctx.lineTo(cx + 40, 80 + 60);
    ctx.stroke();
    ctx.fillStyle = "#22d3ee";
    ctx.font = "13px sans-serif";
    ctx.fillText(`${effortNeeded.toFixed(1)}N`, cx + 55, 115);

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(`Pulleys: ${pulleys}  |  MA: ${MA}×  |  Effort needed: ${effortNeeded.toFixed(1)}N`, cx, H - 20);
  }

  function drawInclinedPlane(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const rad = (angle * Math.PI) / 180;
    const planeL = W * 0.7;
    const baseX = W * 0.1;
    const baseY = H * 0.78;
    const topX = baseX + planeL * Math.cos(rad);
    const topY = baseY - planeL * Math.sin(rad);
    const MA = 1 / Math.sin(rad);
    const frictionForce = load * Math.sin(rad);
    const effortNeeded = frictionForce;

    // Plane surface
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(topX, topY);
    ctx.lineTo(topX, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Block on plane
    const blockT = 0.55;
    const bx = baseX + planeL * blockT * Math.cos(rad);
    const by = baseY - planeL * blockT * Math.sin(rad);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(-rad);
    ctx.fillStyle = "#f97316";
    ctx.fillRect(-18, -28, 36, 28);
    ctx.fillStyle = "white";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${load}N`, 0, -10);
    ctx.restore();

    // Effort arrow along slope
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    const arrowX = bx + 30 * Math.cos(rad);
    const arrowY = by - 30 * Math.sin(rad);
    ctx.beginPath();
    ctx.moveTo(bx, by - 14);
    ctx.lineTo(arrowX, arrowY - 14);
    ctx.stroke();
    ctx.fillStyle = "#22d3ee";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${effortNeeded.toFixed(1)}N`, arrowX + 5, arrowY - 10);

    // Angle arc
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(baseX, baseY, 40, -rad, 0);
    ctx.stroke();
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`${angle}°`, baseX + 44, baseY - 14);

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Mechanical Advantage: ${MA.toFixed(2)}×  |  Effort: ${effortNeeded.toFixed(1)}N`, 14, H - 14);
  }

  return (
    <section className="space-y-4 p-2 sm:p-3">
      <div className="flex gap-2">
        {(["lever", "pulley", "inclined-plane"] as Machine[]).map((m) => (
          <button key={m} type="button"
            onClick={() => setMachine(m)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${machine === m ? "bg-[var(--ll-accent)] text-[var(--ll-text-faint)]" : "border border-[var(--ll-border)] text-[var(--ll-text)]"}`}>
            {m.replace("-", " ")}
          </button>
        ))}
      </div>

      <canvas ref={canvasRef} width={560} height={300}
        className="h-auto w-full rounded-xl border border-[var(--ll-border)]"
        aria-label="Simple Machines Simulation" />

      <div className="grid gap-3 sm:grid-cols-2">
        {machine === "lever" && (<>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-faint)]">Fulcrum position: {fulcrum}%</span>
            <input type="range" min={15} max={85} value={fulcrum} onChange={(e) => setFulcrum(Number(e.target.value))} className="w-full accent-sky-400" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-faint)]">Load: {load}N</span>
            <input type="range" min={10} max={120} value={load} onChange={(e) => setLoad(Number(e.target.value))} className="w-full accent-orange-400" />
          </label>
        </>)}
        {machine === "pulley" && (<>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-faint)]">Number of pulleys: {Math.round(effort / 25)}</span>
            <input type="range" min={25} max={100} step={25} value={effort} onChange={(e) => setEffort(Number(e.target.value))} className="w-full accent-cyan-400" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-faint)]">Load: {load}N</span>
            <input type="range" min={10} max={120} value={load} onChange={(e) => setLoad(Number(e.target.value))} className="w-full accent-orange-400" />
          </label>
        </>)}
        {machine === "inclined-plane" && (<>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-faint)]">Slope angle: {angle}°</span>
            <input type="range" min={5} max={75} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-full accent-yellow-400" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-faint)]">Load: {load}N</span>
            <input type="range" min={10} max={120} value={load} onChange={(e) => setLoad(Number(e.target.value))} className="w-full accent-orange-400" />
          </label>
        </>)}
      </div>

      <button type="button"
        onClick={() => { setFulcrum(50); setLoad(60); setEffort(50); setAngle(30); }}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)]">
        <RotateCcw className="h-4 w-4" />Reset
      </button>

      <p className="text-xs text-[var(--ll-text-faint)]">
        Simple machines trade distance for force. Adjust the controls to see how mechanical advantage changes the effort required to move a load.
      </p>
    </section>
  );
}

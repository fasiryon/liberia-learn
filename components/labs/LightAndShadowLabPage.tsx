"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

export default function LightAndShadowLabPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [lightX, setLightX] = useState(15);
  const [lightY, setLightY] = useState(25);
  const [objectSize, setObjectSize] = useState(40);
  const [reflective, setReflective] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#08111f";
    ctx.fillRect(0, 0, W, H);

    // Ground line
    const groundY = H * 0.78;
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();

    // Light source position
    const lx = (lightX / 100) * W;
    const ly = (lightY / 100) * groundY;

    // Object (cylinder / circle)
    const objX = W * 0.55;
    const objY = groundY - objectSize;
    const objR = objectSize * 0.5;

    // Shadow projection
    const dx = objX - lx;
    const dy = objY - ly;
    const shadowScale = groundY / (groundY - ly);
    const shadowCx = lx + dx * shadowScale;
    const shadowRx = Math.abs(objR * shadowScale * (1 + Math.abs(dx) / W * 0.6));

    const shadowGrad = ctx.createRadialGradient(shadowCx, groundY, 0, shadowCx, groundY, shadowRx);
    shadowGrad.addColorStop(0, "rgba(0,0,0,0.7)");
    shadowGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(shadowCx, groundY, shadowRx, shadowRx * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Light rays (fan from source to object edges)
    ctx.strokeStyle = "rgba(255,220,80,0.15)";
    ctx.lineWidth = 1;
    const tangents = [objX - objR, objX + objR];
    for (const tx of tangents) {
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(tx, objY);
      ctx.stroke();
    }

    // Umbra rays to ground
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    for (const tx of tangents) {
      const ex = lx + (tx - lx) * (groundY - ly) / (objY - ly);
      ctx.beginPath();
      ctx.moveTo(tx, objY);
      ctx.lineTo(ex, groundY);
      ctx.stroke();
    }

    // Object
    const objGrad = ctx.createRadialGradient(objX - objR * 0.3, objY - objR * 0.3, 0, objX, objY, objR);
    objGrad.addColorStop(0, reflective ? "#94d2ff" : "#f97316");
    objGrad.addColorStop(1, reflective ? "#1e5a8a" : "#7c2d12");
    ctx.fillStyle = objGrad;
    ctx.beginPath();
    ctx.arc(objX, objY, objR, 0, Math.PI * 2);
    ctx.fill();

    if (reflective) {
      // Specular highlight
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.arc(objX - objR * 0.3, objY - objR * 0.3, objR * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Light source glow
    const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 30);
    lg.addColorStop(0, "rgba(255,240,100,0.9)");
    lg.addColorStop(0.4, "rgba(255,200,50,0.5)");
    lg.addColorStop(1, "rgba(255,180,0,0)");
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(lx, ly, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fffde7";
    ctx.beginPath();
    ctx.arc(lx, ly, 6, 0, Math.PI * 2);
    ctx.fill();

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "12px sans-serif";
    ctx.fillText("Light Source", lx + 10, ly - 8);
    ctx.fillText("Object", objX + objR + 6, objY);
    ctx.fillText("Shadow", shadowCx - 24, groundY + 14);

    // Angle measurement
    const angle = Math.atan2(objY - ly, objX - lx) * (180 / Math.PI);
    ctx.fillStyle = "rgba(120,220,255,0.7)";
    ctx.fillText(`Angle: ${Math.abs(angle).toFixed(1)}°`, 10, H - 12);
    ctx.fillText(`Shadow width: ${(shadowRx * 2).toFixed(0)}px`, 140, H - 12);
  }, [lightX, lightY, objectSize, reflective]);

  return (
    <section className="space-y-4 p-2 sm:p-3">
      <canvas
        ref={canvasRef}
        width={560}
        height={300}
        className="h-auto w-full rounded-xl border border-[var(--ll-border)]"
        aria-label="Light and Shadow Simulation"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-faint)]">
            Light X: {lightX}%
          </span>
          <input type="range" min={5} max={90} value={lightX}
            onChange={(e) => setLightX(Number(e.target.value))} className="w-full accent-yellow-400" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-faint)]">
            Light Height: {100 - lightY}%
          </span>
          <input type="range" min={5} max={65} value={lightY}
            onChange={(e) => setLightY(Number(e.target.value))} className="w-full accent-yellow-400" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-faint)]">
            Object Size: {objectSize}px
          </span>
          <input type="range" min={15} max={70} value={objectSize}
            onChange={(e) => setObjectSize(Number(e.target.value))} className="w-full accent-orange-400" />
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={reflective} onChange={(e) => setReflective(e.target.checked)}
            className="h-4 w-4 accent-sky-400" />
          <span className="text-sm text-[var(--ll-text)]">Reflective surface (specular highlight)</span>
        </label>
      </div>

      <div className="flex gap-2">
        <button type="button"
          onClick={() => { setLightX(15); setLightY(25); setObjectSize(40); setReflective(false); }}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)]">
          <RotateCcw className="h-4 w-4" />Reset
        </button>
      </div>

      <p className="text-xs text-[var(--ll-text-faint)]">
        Move the light source to see how shadow size and direction change. Notice: higher light = shorter shadow. Larger object = wider shadow.
      </p>
    </section>
  );
}

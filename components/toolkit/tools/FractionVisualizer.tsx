"use client";

import { useMemo, useState } from "react";

interface FractionVisualizerProps {
  onClose?: () => void;
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

export default function FractionVisualizer({ onClose }: FractionVisualizerProps) {
  const [aNum, setANum] = useState(1);
  const [aDen, setADen] = useState(2);
  const [bNum, setBNum] = useState(1);
  const [bDen, setBDen] = useState(3);

  const safeA = useMemo(() => ({ num: aNum, den: aDen === 0 ? 1 : aDen }), [aDen, aNum]);
  const safeB = useMemo(() => ({ num: bNum, den: bDen === 0 ? 1 : bDen }), [bDen, bNum]);

  const aDecimal = safeA.num / safeA.den;
  const bDecimal = safeB.num / safeB.den;

  const aSimplified = (() => {
    const d = gcd(safeA.num, safeA.den);
    return `${safeA.num / d}/${safeA.den / d}`;
  })();
  const bSimplified = (() => {
    const d = gcd(safeB.num, safeB.den);
    return `${safeB.num / d}/${safeB.den / d}`;
  })();

  const barWidth = 260;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Fraction Visualizer</h3>
        <button type="button" aria-label="Close fraction visualizer" className="rounded border border-slate-600 px-2 py-1" onClick={() => onClose?.()}>
          Close
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span>A numerator</span>
          <input aria-label="Fraction A numerator" type="number" className="w-full rounded bg-slate-900 p-2" value={aNum} onChange={(e) => setANum(Number(e.target.value || 0))} />
        </label>
        <label className="space-y-1">
          <span>A denominator</span>
          <input aria-label="Fraction A denominator" type="number" className="w-full rounded bg-slate-900 p-2" value={aDen} onChange={(e) => setADen(Number(e.target.value || 1))} />
        </label>
        <label className="space-y-1">
          <span>B numerator</span>
          <input aria-label="Fraction B numerator" type="number" className="w-full rounded bg-slate-900 p-2" value={bNum} onChange={(e) => setBNum(Number(e.target.value || 0))} />
        </label>
        <label className="space-y-1">
          <span>B denominator</span>
          <input aria-label="Fraction B denominator" type="number" className="w-full rounded bg-slate-900 p-2" value={bDen} onChange={(e) => setBDen(Number(e.target.value || 1))} />
        </label>
      </div>

      <svg aria-label="Fraction bar comparison" width="100%" height="90" viewBox={`0 0 ${barWidth} 90`} className="rounded bg-slate-900">
        <rect x="8" y="14" width={barWidth - 16} height="20" fill="#1e293b" />
        <rect x="8" y="14" width={Math.max(0, Math.min(barWidth - 16, (barWidth - 16) * aDecimal))} height="20" fill="#34d399" />
        <rect x="8" y="52" width={barWidth - 16} height="20" fill="#1e293b" />
        <rect x="8" y="52" width={Math.max(0, Math.min(barWidth - 16, (barWidth - 16) * bDecimal))} height="20" fill="#38bdf8" />
      </svg>

      <div className="grid grid-cols-2 gap-3 rounded bg-slate-900 p-3">
        <p>A: {safeA.num}/{safeA.den} = {aDecimal.toFixed(4)} · simplified {aSimplified}</p>
        <p>B: {safeB.num}/{safeB.den} = {bDecimal.toFixed(4)} · simplified {bSimplified}</p>
      </div>
    </div>
  );
}

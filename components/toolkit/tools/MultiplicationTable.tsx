"use client";

import { useMemo, useState } from "react";

interface MultiplicationTableProps {
  onClose?: () => void;
}

export default function MultiplicationTable({ onClose }: MultiplicationTableProps) {
  const [max, setMax] = useState(12);
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);

  const cells = useMemo(() => Array.from({ length: max }, (_, r) => Array.from({ length: max }, (_, c) => ({ row: r + 1, col: c + 1 }))), [max]);

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Multiplication Table</h3>
        <button type="button" aria-label="Close multiplication table" className="rounded border border-slate-600 px-2 py-1" onClick={() => onClose?.()}>Close</button>
      </div>

      <div className="flex gap-2">
        <button type="button" aria-label="Set table to 1 through 5" className="rounded border border-slate-600 px-2 py-1" onClick={() => setMax(5)}>Grade 1-3</button>
        <button type="button" aria-label="Set table to 1 through 12" className="rounded border border-slate-600 px-2 py-1" onClick={() => setMax(12)}>Grade 4-6</button>
      </div>

      <div role="grid" aria-label="Multiplication grid" className="max-h-[45vh] overflow-auto rounded border border-slate-700">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border border-slate-700 p-1">×</th>
              {Array.from({ length: max }, (_, i) => <th key={i + 1} className="border border-slate-700 p-1">{i + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            {cells.map((row) => (
              <tr key={row[0].row}>
                <th className="border border-slate-700 p-1">{row[0].row}</th>
                {row.map((cell) => {
                  const highlighted = hover && (hover.row === cell.row || hover.col === cell.col);
                  const selectedCell = selected?.row === cell.row && selected?.col === cell.col;
                  return (
                    <td key={`${cell.row}-${cell.col}`} className={`border border-slate-700 p-1 text-center ${selectedCell ? "bg-emerald-600 text-slate-950" : highlighted ? "bg-slate-800" : ""}`}>
                      <button
                        type="button"
                        aria-label={`Product ${cell.row} times ${cell.col}`}
                        className="w-full"
                        onFocus={() => setHover(cell)}
                        onMouseEnter={() => setHover(cell)}
                        onMouseLeave={() => setHover(null)}
                        onBlur={() => setHover(null)}
                        onClick={() => setSelected(cell)}
                        onKeyDown={(e) => {
                          if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
                          e.preventDefault();
                          const nextRow = e.key === "ArrowUp" ? Math.max(1, cell.row - 1) : e.key === "ArrowDown" ? Math.min(max, cell.row + 1) : cell.row;
                          const nextCol = e.key === "ArrowLeft" ? Math.max(1, cell.col - 1) : e.key === "ArrowRight" ? Math.min(max, cell.col + 1) : cell.col;
                          const next = document.getElementById(`mul-${nextRow}-${nextCol}`) as HTMLButtonElement | null;
                          next?.focus();
                        }}
                        id={`mul-${cell.row}-${cell.col}`}
                      >
                        {cell.row * cell.col}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

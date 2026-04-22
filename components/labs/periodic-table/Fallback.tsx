"use client";

import { useMemo, useState } from "react";
import type { PeriodicTableAction } from "@/lib/labs/periodic-table/actions";
import { ELEMENTS, getElementBySymbol } from "@/lib/labs/periodic-table/data";
import type { PeriodicTableState } from "@/lib/labs/periodic-table/state";

export default function PeriodicTableFallback({
  state,
  onAction,
}: {
  state: PeriodicTableState;
  onAction: (action: PeriodicTableAction) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ELEMENTS.filter(
      (element) => !q || element.name.toLowerCase().includes(q) || element.symbol.toLowerCase().includes(q)
    ).slice(0, 40);
  }, [query]);
  const selected = state.selectedElement ? getElementBySymbol(state.selectedElement) : null;

  return (
    <div className="space-y-4 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] p-4 text-[var(--ll-text)]">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or symbol"
        className="min-h-11 w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 text-sm"
      />
      {selected ? (
        <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] p-3 text-sm">
          <h3 className="text-lg font-semibold">{selected.name} ({selected.symbol})</h3>
          <p>Atomic number: {selected.atomicNumber}</p>
          <p>Atomic mass: {selected.atomicMass}</p>
          <p>Category: {selected.category}</p>
          <p>Group: {selected.group ?? "f-block"}, Period: {selected.period}</p>
          <p>Electronegativity: {selected.electronegativity ?? "n/a"}</p>
          <p>Melting point: {selected.meltingPoint ?? "n/a"} C</p>
          <p>Boiling point: {selected.boilingPoint ?? "n/a"} C</p>
          <p>Electron configuration: {selected.electronConfig}</p>
        </div>
      ) : null}
      <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--ll-border)]">
        <table className="w-full text-left text-sm">
          <tbody>
            {matches.map((element) => (
              <tr key={element.symbol} className="border-b border-[var(--ll-border)]">
                <td className="p-2">{element.atomicNumber}</td>
                <td className="p-2 font-semibold">{element.symbol}</td>
                <td className="p-2">{element.name}</td>
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => onAction({ type: "SELECT_ELEMENT", symbol: element.symbol })}
                    className="min-h-9 rounded-full bg-[var(--ll-silver-soft)] px-3 text-xs font-semibold text-[var(--ll-text-faint)]"
                  >
                    Select
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

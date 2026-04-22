"use client";

import { useMemo, useState } from "react";

interface UnitConverterProps {
  onClose?: () => void;
}

type Category = "Length" | "Mass" | "Volume" | "Temperature" | "Time" | "Area";

type Unit = { label: string; toBase: (v: number) => number; fromBase: (v: number) => number };

const unitsByCategory: Record<Category, Unit[]> = {
  Length: [
    { label: "meter", toBase: (v) => v, fromBase: (v) => v },
    { label: "kilometer", toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
    { label: "foot", toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
    { label: "mile", toBase: (v) => v * 1609.34, fromBase: (v) => v / 1609.34 },
  ],
  Mass: [
    { label: "kilogram", toBase: (v) => v, fromBase: (v) => v },
    { label: "gram", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    { label: "pound", toBase: (v) => v * 0.453592, fromBase: (v) => v / 0.453592 },
  ],
  Volume: [
    { label: "liter", toBase: (v) => v, fromBase: (v) => v },
    { label: "milliliter", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    { label: "gallon", toBase: (v) => v * 3.78541, fromBase: (v) => v / 3.78541 },
  ],
  Temperature: [
    { label: "celsius", toBase: (v) => v, fromBase: (v) => v },
    { label: "fahrenheit", toBase: (v) => (v - 32) * (5 / 9), fromBase: (v) => v * (9 / 5) + 32 },
    { label: "kelvin", toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
  ],
  Time: [
    { label: "second", toBase: (v) => v, fromBase: (v) => v },
    { label: "minute", toBase: (v) => v * 60, fromBase: (v) => v / 60 },
    { label: "hour", toBase: (v) => v * 3600, fromBase: (v) => v / 3600 },
  ],
  Area: [
    { label: "square meter", toBase: (v) => v, fromBase: (v) => v },
    { label: "square kilometer", toBase: (v) => v * 1_000_000, fromBase: (v) => v / 1_000_000 },
    { label: "square foot", toBase: (v) => v * 0.092903, fromBase: (v) => v / 0.092903 },
  ],
};

function round(v: number): number {
  return Math.round(v * 1e8) / 1e8;
}

export default function UnitConverter({ onClose }: UnitConverterProps) {
  const [category, setCategory] = useState<Category>("Length");
  const [leftUnit, setLeftUnit] = useState(0);
  const [rightUnit, setRightUnit] = useState(2);
  const [leftValue, setLeftValue] = useState("1");
  const [rightValue, setRightValue] = useState("3.28084");

  const units = useMemo(() => unitsByCategory[category], [category]);

  const syncFromLeft = (value: string) => {
    setLeftValue(value);
    const numeric = Number(value || 0);
    const base = units[leftUnit].toBase(numeric);
    const converted = units[rightUnit].fromBase(base);
    setRightValue(String(round(converted)));
  };

  const syncFromRight = (value: string) => {
    setRightValue(value);
    const numeric = Number(value || 0);
    const base = units[rightUnit].toBase(numeric);
    const converted = units[leftUnit].fromBase(base);
    setLeftValue(String(round(converted)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Unit Converter</h3>
        <button type="button" aria-label="Close unit converter" className="rounded border border-[var(--ll-border)] px-2 py-1 text-xs" onClick={() => onClose?.()}>Close</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(unitsByCategory) as Category[]).map((nextCategory) => (
          <button
            key={nextCategory}
            type="button"
            aria-label={`Select ${nextCategory} conversions`}
            className={`rounded border px-2 py-1 text-xs ${category === nextCategory ? "border-emerald-400" : "border-[var(--ll-border)]"}`}
            onClick={() => {
              setCategory(nextCategory);
              setLeftUnit(0);
              setRightUnit(1);
              setLeftValue("1");
              setRightValue("1");
            }}
          >
            {nextCategory}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2 rounded bg-[var(--ll-bg)] p-3">
          <select aria-label="From unit" className="w-full rounded bg-[var(--ll-surface)] p-2" value={leftUnit} onChange={(e) => setLeftUnit(Number(e.target.value))}>
            {units.map((unit, idx) => <option key={unit.label} value={idx}>{unit.label}</option>)}
          </select>
          <input aria-label="From value" type="number" className="w-full rounded bg-[var(--ll-surface)] p-2" value={leftValue} onChange={(e) => syncFromLeft(e.target.value)} />
        </div>

        <div className="space-y-2 rounded bg-[var(--ll-bg)] p-3">
          <select aria-label="To unit" className="w-full rounded bg-[var(--ll-surface)] p-2" value={rightUnit} onChange={(e) => setRightUnit(Number(e.target.value))}>
            {units.map((unit, idx) => <option key={unit.label} value={idx}>{unit.label}</option>)}
          </select>
          <input aria-label="To value" type="number" className="w-full rounded bg-[var(--ll-surface)] p-2" value={rightValue} onChange={(e) => syncFromRight(e.target.value)} />
        </div>
      </div>

      <p className="text-xs text-[var(--ll-text-muted)]">Metric-first defaults are used for classroom context in Liberia.</p>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import type { PeriodicTableAction } from "@/lib/labs/periodic-table/actions";
import {
  ELEMENT_CATEGORIES,
  ELEMENTS,
  getElementBySymbol,
  type PeriodicElement,
} from "@/lib/labs/periodic-table/data";
import type { PeriodicTableState } from "@/lib/labs/periodic-table/state";

type Props = {
  state: PeriodicTableState;
  onAction: (action: PeriodicTableAction) => void;
};

const WIDTH = 980;
const HEIGHT = 620;
const TILE = 42;
const GAP = 4;
const ORIGIN_X = 28;
const ORIGIN_Y = 32;

const CATEGORY_COLORS: Record<string, string> = {
  alkali_metal: "#ff6b6b",
  alkaline_earth_metal: "#ffa94d",
  transition_metal: "#ffd43b",
  post_transition_metal: "#a9e34b",
  metalloid: "#69db7c",
  nonmetal: "#38d9a9",
  halogen: "#4dabf7",
  noble_gas: "#da77f2",
  lanthanide: "#f783ac",
  actinide: "#e599f7",
};

const CATEGORY_LABELS: Record<string, string> = {
  alkali_metal: "Alkali metals",
  alkaline_earth_metal: "Alkaline earth metals",
  transition_metal: "Transition metals",
  post_transition_metal: "Post-transition metals",
  metalloid: "Metalloids",
  nonmetal: "Nonmetals",
  halogen: "Halogens",
  noble_gas: "Noble gases",
  lanthanide: "Lanthanides",
  actinide: "Actinides",
};

function positionFor(element: PeriodicElement) {
  if (element.category === "lanthanide") {
    return { col: element.atomicNumber - 57 + 3, row: 8 };
  }
  if (element.category === "actinide") {
    return { col: element.atomicNumber - 89 + 3, row: 9 };
  }
  return { col: element.group ?? 1, row: element.period };
}

function tileRect(element: PeriodicElement) {
  const { col, row } = positionFor(element);
  return {
    x: ORIGIN_X + (col - 1) * (TILE + GAP),
    y: ORIGIN_Y + (row - 1) * (TILE + GAP),
    width: TILE,
    height: TILE,
  };
}

function drawTable(context: CanvasRenderingContext2D, state: PeriodicTableState) {
  context.fillStyle = "#07111f";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.font = "12px sans-serif";
  context.fillStyle = "#cbd5e1";
  context.fillText("Periodic Table", 28, 20);

  ELEMENTS.forEach((element) => {
    const rect = tileRect(element);
    const selected = state.selectedElement === element.symbol;
    const dim = state.highlightCategory && state.highlightCategory !== element.category;
    context.save();
    context.globalAlpha = dim ? 0.3 : 1;
    context.fillStyle = CATEGORY_COLORS[element.category];
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    if (selected) {
      context.lineWidth = 4;
      context.strokeStyle = "#ffffff";
      context.strokeRect(rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4);
    } else {
      context.lineWidth = 1;
      context.strokeStyle = "rgba(15, 23, 42, 0.8)";
      context.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
    context.fillStyle = "#0f172a";
    context.font = "9px sans-serif";
    context.fillText(String(element.atomicNumber), rect.x + 3, rect.y + 9);
    context.font = "bold 16px sans-serif";
    context.textAlign = "center";
    context.fillText(element.symbol, rect.x + rect.width / 2, rect.y + 27);
    context.font = "7px sans-serif";
    context.fillText(String(element.atomicMass).slice(0, 6), rect.x + rect.width / 2, rect.y + 38);
    context.textAlign = "left";
    context.restore();
  });

  context.fillStyle = "#94a3b8";
  context.font = "11px sans-serif";
  context.fillText("Lanthanides", ORIGIN_X, ORIGIN_Y + 7 * (TILE + GAP) + 28);
  context.fillText("Actinides", ORIGIN_X, ORIGIN_Y + 8 * (TILE + GAP) + 28);
}

function drawBohr(context: CanvasRenderingContext2D, state: PeriodicTableState, tick: number) {
  context.fillStyle = "#07111f";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const element = state.selectedElement ? getElementBySymbol(state.selectedElement) : undefined;
  if (!element) {
    context.fillStyle = "#e2e8f0";
    context.font = "22px sans-serif";
    context.fillText("Select an element from the table to view its Bohr model", 220, 270);
    return;
  }

  const cx = 420;
  const cy = 270;
  context.fillStyle = "#f8fafc";
  context.font = "bold 28px sans-serif";
  context.fillText(`${element.name} (${element.symbol})`, 36, 48);
  context.font = "15px sans-serif";
  context.fillText(`Atomic number ${element.atomicNumber}`, 36, 75);
  context.fillText(element.electronConfig, 36, 102);

  element.shells.forEach((electrons, shellIndex) => {
    const radius = 54 + shellIndex * 36;
    context.strokeStyle = "rgba(148, 163, 184, 0.65)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.stroke();
    for (let index = 0; index < electrons; index += 1) {
      const angle = (Math.PI * 2 * index) / electrons + tick * (0.01 + shellIndex * 0.004);
      context.fillStyle = "#38bdf8";
      context.beginPath();
      context.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 4, 0, Math.PI * 2);
      context.fill();
    }
  });

  context.fillStyle = "#f43f5e";
  context.beginPath();
  context.arc(cx, cy, 38, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.font = "bold 14px sans-serif";
  context.fillText(`${element.atomicNumber} p+`, cx, cy + 4);
  context.textAlign = "left";
}

function drawProperties(context: CanvasRenderingContext2D, state: PeriodicTableState) {
  context.fillStyle = "#07111f";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const property = state.highlightProperty ?? "electronegativity";
  const values = ELEMENTS.map((element) => element[property]).filter((value): value is number => typeof value === "number");
  const max = Math.max(...values, 1);
  const chart = { x: 42, y: 70, width: 860, height: 330 };

  context.fillStyle = "#e2e8f0";
  context.font = "bold 20px sans-serif";
  context.fillText(property === "electronegativity" ? "Electronegativity" : property === "meltingPoint" ? "Melting Point (C)" : "Boiling Point (C)", chart.x, 36);
  context.strokeStyle = "#334155";
  context.strokeRect(chart.x, chart.y, chart.width, chart.height);

  const barWidth = chart.width / ELEMENTS.length;
  ELEMENTS.forEach((element, index) => {
    const value = element[property];
    const barH = typeof value === "number" ? (value / max) * (chart.height - 18) : 0;
    const x = chart.x + index * barWidth;
    const y = chart.y + chart.height - barH;
    context.fillStyle = state.selectedElement === element.symbol ? "#ffffff" : CATEGORY_COLORS[element.category];
    context.fillRect(x, y, Math.max(2, barWidth - 1), barH);
  });

  const selected = state.selectedElement ? getElementBySymbol(state.selectedElement) : null;
  if (selected) {
    const value = selected[property];
    context.fillStyle = "#e2e8f0";
    context.font = "16px sans-serif";
    context.fillText(
      `${selected.name}: ${value == null ? "not available" : value.toFixed(2)}`,
      chart.x,
      chart.y + chart.height + 36
    );
  }
}

function drawPanel(context: CanvasRenderingContext2D, state: PeriodicTableState) {
  const x = 720;
  const y = 48;
  context.fillStyle = "rgba(15, 23, 42, 0.92)";
  context.fillRect(x, y, 230, 300);
  context.strokeStyle = "#334155";
  context.strokeRect(x, y, 230, 300);
  context.fillStyle = "#e2e8f0";
  context.font = "bold 16px sans-serif";
  context.fillText("Element Details", x + 14, y + 28);
  const element = state.selectedElement ? getElementBySymbol(state.selectedElement) : undefined;
  context.font = "12px sans-serif";
  if (!element) {
    context.fillText("No element selected.", x + 14, y + 58);
    return;
  }
  const lines = [
    `${element.name} (${element.symbol})`,
    `Atomic Number: ${element.atomicNumber}`,
    `Atomic Mass: ${element.atomicMass}`,
    `Category: ${element.category}`,
    `Group: ${element.group ?? "f-block"}`,
    `Period: ${element.period}`,
    `EN: ${element.electronegativity ?? "n/a"}`,
    `Melt: ${element.meltingPoint ?? "n/a"} C`,
    `Boil: ${element.boilingPoint ?? "n/a"} C`,
    `Config: ${element.electronConfig}`,
  ];
  lines.forEach((line, index) => context.fillText(line, x + 14, y + 58 + index * 22));
}

function draw(canvas: HTMLCanvasElement, state: PeriodicTableState, tick: number) {
  const context = canvas.getContext("2d");
  if (!context) return;
  if (state.viewMode === "bohr") drawBohr(context, state, tick);
  else if (state.viewMode === "properties") drawProperties(context, state);
  else drawTable(context, state);
  drawPanel(context, state);
}

export default function PeriodicTableScene({ state, onAction }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tickRef = useRef(0);

  useEffect(() => {
    let animation = 0;
    const render = () => {
      tickRef.current += 1;
      if (canvasRef.current) draw(canvasRef.current, state, tickRef.current);
      animation = requestAnimationFrame(render);
    };
    animation = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animation);
  }, [state]);

  function selectFromCanvas(event: React.MouseEvent<HTMLCanvasElement>) {
    if (state.viewMode !== "table") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    const hit = ELEMENTS.find((element) => {
      const tile = tileRect(element);
      return x >= tile.x && x <= tile.x + tile.width && y >= tile.y && y <= tile.y + tile.height;
    });
    if (hit) onAction({ type: "SELECT_ELEMENT", symbol: hit.symbol });
  }

  return (
    <div className="space-y-4 p-4">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        onClick={selectFromCanvas}
        className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]"
      />
      <div className="flex flex-wrap gap-2">
        {(["table", "bohr", "properties"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onAction({ type: "SET_VIEW_MODE", value: mode })}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
              state.viewMode === mode ? "bg-[var(--ll-silver-soft)] text-[var(--ll-text-faint)]" : "border border-[var(--ll-border)] text-[var(--ll-text)]"
            }`}
          >
            {mode[0].toUpperCase() + mode.slice(1)}
          </button>
        ))}
        <select
          value={state.highlightCategory ?? ""}
          onChange={(event) => {
            if (event.target.value) onAction({ type: "HIGHLIGHT_CATEGORY", category: event.target.value });
          }}
          className="min-h-11 rounded-full border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 text-sm text-[var(--ll-text)]"
        >
          <option value="">Highlight category</option>
          {ELEMENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
        {(["electronegativity", "meltingPoint", "boilingPoint"] as const).map((property) => (
          <button
            key={property}
            type="button"
            onClick={() => onAction({ type: "HIGHLIGHT_PROPERTY", property })}
            className="min-h-11 rounded-full border border-[var(--ll-border)] px-4 text-sm text-[var(--ll-text)]"
          >
            {property === "electronegativity" ? "Electronegativity" : property === "meltingPoint" ? "Melting Point" : "Boiling Point"}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onAction({ type: "CLEAR_SELECTION" })}
          className="min-h-11 rounded-full border border-[var(--ll-border)] px-4 text-sm text-[var(--ll-text)]"
        >
          Clear selection
        </button>
      </div>
    </div>
  );
}

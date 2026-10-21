"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Check, ChevronRight, Lightbulb, Minus, Plus } from "lucide-react";
import { InlineText } from "@/components/experience/LessonText";
import { MathExpression } from "@/components/experience/MathText";
import { compare, diagnoseComparison, diagnoseShading, equivalent, gcd, type Fraction, type Relation } from "@/lib/learner-experience/teaching/models/fractions";
import { describeShape, formatMeasure, shapeArea, shapePerimeter, triangleSides, type ShapeSpec, type ShapeView } from "@/lib/learner-experience/teaching/models/geometry";
import { areaModel, diagnosePartial, placeValueParts, repeatedAddition } from "@/lib/learner-experience/teaching/models/multiplication";
import { diagnoseNumeric, type Diagnosis } from "@/lib/learner-experience/teaching/models/numericResponse";
import type { BlockOf } from "@/lib/learner-experience/teaching/registry";
import { BlockFrame, Feedback, useReportDone, type BlockDone } from "./shared";

const VIEW_LABEL: Record<ShapeView, string> = { GRID: "Unit squares", AREA: "Area (inside)", PERIMETER: "Perimeter (edge)", HEIGHT: "Height" };
const unitSquared = (unit: string) => `${unit}²`;

// ── Geometry ───────────────────────────────────────────────────────────────

/**
 * A labelled shape drawn to scale. Views: countable unit squares, the shaded inside (area), the traced edge
 * (perimeter) and a triangle's perpendicular height with its right-angle mark. `reveal` controls whether the
 * area and perimeter are stated (never inside a problem the learner must solve).
 */
export function ShapeDiagram({ shape, views, reveal, label }: { shape: ShapeSpec; views: readonly ShapeView[]; reveal: boolean; label?: string }) {
  const on = (view: ShapeView) => views.includes(view);
  const u = shape.unit;
  const m = 44;
  let width = 0, height = 0, minX = 0;
  if (shape.kind === "RECTANGLE") { width = shape.length; height = shape.width; }
  else if (shape.kind === "TRIANGLE") { minX = Math.min(0, shape.apexOffset); width = Math.max(shape.base, shape.apexOffset) - minX; height = shape.height; }
  else { width = Math.max(...shape.rects.map((rect) => rect.x + rect.w)); height = Math.max(...shape.rects.map((rect) => rect.y + rect.h)); }
  const s = Math.min(420 / width, 260 / height);
  const W = width * s + 2 * m, H = height * s + 2 * m;
  const X = (x: number) => m + (x - minX) * s, Y = (y: number) => m + y * s;
  const cells = shape.kind === "COMPOSITE" ? shape.rects.reduce((sum, rect) => sum + rect.w * rect.h, 0) : width * height;
  const drawGrid = on("GRID") && Number.isInteger(width) && Number.isInteger(height) && cells <= 600;
  const description = reveal ? describeShape(shape) : describeShape(shape).split(/\. Area|\. It covers/)[0] + ".";
  let outline = "", gridPaths = "";
  const labels: { x: number; y: number; text: string; anchor?: "start" | "middle" | "end" }[] = [];
  if (shape.kind === "RECTANGLE") {
    outline = `M${X(0)},${Y(0)} H${X(width)} V${Y(height)} H${X(0)} Z`;
    labels.push({ x: X(width / 2), y: Y(0) - 12, text: `${formatMeasure(shape.length)} ${u}` }, { x: X(0) - 10, y: Y(height / 2) + 5, text: `${formatMeasure(shape.width)} ${u}`, anchor: "end" });
    if (drawGrid) for (let i = 1; i < width; i++) gridPaths += `M${X(i)},${Y(0)} V${Y(height)} `;
    if (drawGrid) for (let j = 1; j < height; j++) gridPaths += `M${X(0)},${Y(j)} H${X(width)} `;
  } else if (shape.kind === "TRIANGLE") {
    outline = `M${X(0)},${Y(height)} L${X(shape.base)},${Y(height)} L${X(shape.apexOffset)},${Y(0)} Z`;
    labels.push({ x: X(shape.base / 2), y: Y(height) + 26, text: `b = ${formatMeasure(shape.base)} ${u}` });
    if (shape.sideLabels) {
      labels.push({ x: (X(0) + X(shape.apexOffset)) / 2 - 10, y: (Y(height) + Y(0)) / 2, text: `${formatMeasure(shape.sideLabels[0])} ${u}`, anchor: "end" });
      labels.push({ x: (X(shape.base) + X(shape.apexOffset)) / 2 + 10, y: (Y(height) + Y(0)) / 2, text: `${formatMeasure(shape.sideLabels[1])} ${u}`, anchor: "start" });
    }
    if (drawGrid) {
      for (let i = Math.ceil(minX) + 1; i < minX + width; i++) gridPaths += `M${X(i)},${Y(0)} V${Y(height)} `;
      for (let j = 1; j < height; j++) gridPaths += `M${X(minX)},${Y(j)} H${X(minX + width)} `;
    }
  } else {
    const cellsSet = new Set(shape.rects.flatMap((rect) => Array.from({ length: rect.w * rect.h }, (_, index) => `${rect.x + (index % rect.w)},${rect.y + Math.floor(index / rect.w)}`)));
    const has = (x: number, y: number) => cellsSet.has(`${x},${y}`);
    // Boundary edges merged into straight runs, each labelled with its length on the outside.
    const runs: { x1: number; y1: number; x2: number; y2: number; outX: number; outY: number }[] = [];
    for (const cell of cellsSet) {
      const [x, y] = cell.split(",").map(Number);
      if (!has(x, y - 1)) runs.push({ x1: x, y1: y, x2: x + 1, y2: y, outX: 0, outY: -1 });
      if (!has(x, y + 1)) runs.push({ x1: x, y1: y + 1, x2: x + 1, y2: y + 1, outX: 0, outY: 1 });
      if (!has(x - 1, y)) runs.push({ x1: x, y1: y, x2: x, y2: y + 1, outX: -1, outY: 0 });
      if (!has(x + 1, y)) runs.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1, outX: 1, outY: 0 });
    }
    const merged: typeof runs = [];
    for (const run of runs.sort((a, b) => a.outY - b.outY || a.outX - b.outX || a.y1 - b.y1 || a.x1 - b.x1)) {
      const last = merged[merged.length - 1];
      if (last && last.outX === run.outX && last.outY === run.outY && ((run.outY !== 0 && last.y1 === run.y1 && last.x2 === run.x1) || (run.outX !== 0 && last.x1 === run.x1 && last.y2 === run.y1))) { last.x2 = run.x2; last.y2 = run.y2; continue; }
      merged.push({ ...run });
    }
    outline = merged.map((run) => `M${X(run.x1)},${Y(run.y1)} L${X(run.x2)},${Y(run.y2)}`).join(" ");
    for (const run of merged) {
      const length = Math.abs(run.x2 - run.x1) + Math.abs(run.y2 - run.y1);
      labels.push({ x: (X(run.x1) + X(run.x2)) / 2 + run.outX * 12, y: (Y(run.y1) + Y(run.y2)) / 2 + run.outY * 14 + (run.outY === 0 ? 5 : run.outY < 0 ? 0 : 6), text: `${length} ${u}`, anchor: run.outX < 0 ? "end" : run.outX > 0 ? "start" : "middle" });
    }
    if (drawGrid) for (const rect of shape.rects) {
      for (let i = 1; i < rect.w; i++) gridPaths += `M${X(rect.x + i)},${Y(rect.y)} V${Y(rect.y + rect.h)} `;
      for (let j = 1; j < rect.h; j++) gridPaths += `M${X(rect.x)},${Y(rect.y + j)} H${X(rect.x + rect.w)} `;
    }
  }
  const fill = shape.kind === "COMPOSITE" ? shape.rects.map((rect) => `M${X(rect.x)},${Y(rect.y)} h${rect.w * s} v${rect.h * s} h${-rect.w * s} Z`).join(" ") : outline;
  const sides = shape.kind === "TRIANGLE" ? triangleSides(shape) : null;
  return <figure className="ll5-shape" data-shape={shape.kind} data-views={views.join(" ")}>
    <svg viewBox={`0 0 ${Math.round(W)} ${Math.round(H)}`} role="img" aria-label={label ?? description}>
      {shape.kind === "TRIANGLE" && on("GRID") && <rect x={X(minX)} y={Y(0)} width={width * s} height={height * s} className="ll5-shape-frame" />}
      <path d={fill} className="ll5-shape-body" data-on={on("AREA") ? "" : undefined} />
      {gridPaths && <path d={gridPaths} className="ll5-shape-grid" />}
      <path d={outline} className="ll5-shape-edge" data-on={on("PERIMETER") ? "" : undefined} />
      {shape.kind === "TRIANGLE" && on("HEIGHT") && <g className="ll5-shape-height">
        <line x1={X(shape.apexOffset)} y1={Y(0)} x2={X(shape.apexOffset)} y2={Y(height)} />
        {(shape.apexOffset < 0 || shape.apexOffset > shape.base) && <line x1={X(Math.min(0, shape.apexOffset))} y1={Y(height)} x2={X(Math.max(shape.base, shape.apexOffset))} y2={Y(height)} className="ll5-shape-extend" />}
        <path d={`M${X(shape.apexOffset)},${Y(height) - 12} h${12} v12`} className="ll5-shape-right" />
        <text x={X(shape.apexOffset) + 8} y={(Y(0) + Y(height)) / 2} textAnchor="start" className="ll5-shape-label">h = {formatMeasure(shape.height)} {u}</text>
      </g>}
      {labels.map((label, index) => <text key={index} x={label.x} y={label.y} textAnchor={label.anchor ?? "middle"} className="ll5-shape-label">{label.text}</text>)}
    </svg>
    {sides && shape.kind === "TRIANGLE" && !shape.sideLabels && on("PERIMETER") && <figcaption className="ll3-small ll3-muted">The slanted sides are not whole numbers here, so this triangle&apos;s perimeter is not asked for.</figcaption>}
  </figure>;
}

function ShapeReadout({ shape }: { shape: ShapeSpec }) {
  const area = shapeArea(shape), perimeter = shapePerimeter(shape);
  const u = shape.unit;
  const areaTex = shape.kind === "RECTANGLE" ? `A = ${formatMeasure(shape.length)} \\times ${formatMeasure(shape.width)} = ${formatMeasure(area)}\\ \\text{${u}}^2`
    : shape.kind === "TRIANGLE" ? `A = \\frac{1}{2} \\times ${formatMeasure(shape.base)} \\times ${formatMeasure(shape.height)} = ${formatMeasure(area)}\\ \\text{${u}}^2`
    : `A = ${shape.rects.map((rect) => `${rect.w} \\times ${rect.h}`).join(" + ")} = ${area}\\ \\text{${u}}^2`;
  const perimeterTex = perimeter === null ? null : shape.kind === "RECTANGLE" ? `P = 2(${formatMeasure(shape.length)} + ${formatMeasure(shape.width)}) = ${formatMeasure(perimeter)}\\ \\text{${u}}` : shape.kind === "TRIANGLE" && shape.sideLabels ? `P = ${formatMeasure(shape.base)} + ${formatMeasure(shape.sideLabels[0])} + ${formatMeasure(shape.sideLabels[1])} = ${formatMeasure(perimeter)}\\ \\text{${u}}` : `P = ${perimeter}\\ \\text{${u}}`;
  return <dl className="ll5-readout" aria-live="polite">
    <div data-kind="area"><dt>Area</dt><dd><MathExpression tex={areaTex} /></dd></div>
    {perimeterTex && <div data-kind="perimeter"><dt>Perimeter</dt><dd><MathExpression tex={perimeterTex} /></dd></div>}
  </dl>;
}

export function ShapeModelBlock({ block }: { block: BlockOf<"SHAPE_MODEL"> }) {
  const [views, setViews] = useState<ShapeView[]>([...block.views]);
  const [size, setSize] = useState(block.shape.kind === "RECTANGLE" ? { length: block.shape.length, width: block.shape.width } : null);
  const shape: ShapeSpec = block.shape.kind === "RECTANGLE" && size ? { ...block.shape, ...size } : (block.shape as ShapeSpec);
  const available: ShapeView[] = shape.kind === "TRIANGLE" ? ["HEIGHT", "GRID", "AREA", "PERIMETER"] : ["GRID", "AREA", "PERIMETER"];
  const toggle = (view: ShapeView) => setViews((current) => (current.includes(view) ? current.filter((candidate) => candidate !== view) : [...current, view]));
  const id = useId();
  return <figure className="ll3-figure ll5-figure" data-shape-model={block.id}>
    <ShapeDiagram shape={shape} views={views} reveal />
    {block.explore && <div className="ll4-row" role="group" aria-label="Show on the diagram">{available.map((view) => <button key={view} type="button" className="ll3-btn ll5-toggle" aria-pressed={views.includes(view)} onClick={() => toggle(view)}>{VIEW_LABEL[view]}</button>)}</div>}
    {block.adjustable && size && <div className="ll5-sliders">
      {(["length", "width"] as const).map((key) => <label key={key} htmlFor={`${id}-${key}`} className="ll5-slider">
        <span>{key === "length" ? "Length" : "Width"}: <strong>{size[key]} {shape.unit}</strong></span>
        <input id={`${id}-${key}`} type="range" min={block.adjustable!.min} max={block.adjustable!.max} step={1} value={size[key]} onChange={(event) => setSize((current) => current && { ...current, [key]: Number(event.target.value) })} />
      </label>)}
    </div>}
    {block.explore && <ShapeReadout shape={shape} />}
    <figcaption><InlineText text={block.caption} /></figcaption>
  </figure>;
}

export function WorkedSolutionBlock({ block, onDone }: { block: BlockOf<"WORKED_SOLUTION">; onDone: BlockDone }) {
  const [shown, setShown] = useState(0);
  const total = block.steps.length;
  useReportDone(block.id, shown >= total, onDone);
  const latest = shown > 0 ? block.steps[shown - 1] : null;
  return <BlockFrame label={`Worked solution · ${shown} of ${total} steps shown`} className="ll5-worked" data={{ "data-worked-solution": block.id }}>
    <div className="ll5-problem"><InlineText text={block.problem} /></div>
    <div className="ll5-worked-body" data-has-shape={block.shape ? "" : undefined}>
      {block.shape && <ShapeDiagram shape={block.shape as ShapeSpec} views={latest?.views ?? []} reveal={false} />}
      <div>
        {shown > 0 && <ol className="ll3-steps ll5-steps">{block.steps.slice(0, shown).map((step, index) => <li key={index} data-latest={index === shown - 1 ? "" : undefined}><span>
          <InlineText text={step.text} />{step.tex && <span className="ll5-step-math"><MathExpression tex={step.tex} display /></span>}
        </span></li>)}</ol>}
        <div aria-live="polite" className="sr-only">{latest ? `Step ${shown} shown.` : ""}</div>
        {shown < total
          ? <button type="button" className="ll3-btn" data-primary="" onClick={() => setShown((current) => current + 1)}>{shown === 0 ? "Start the solution" : `Show step ${shown + 1} of ${total}`} <ChevronRight size={18} aria-hidden="true" /></button>
          : <p className="flex items-center gap-2 font-semibold text-[var(--ll-success)]"><Check size={18} aria-hidden="true" /> All steps shown</p>}
      </div>
    </div>
  </BlockFrame>;
}

const UNIT_CHOICES = (base: string) => base ? [base, unitSquared(base), ...(base === "m" ? ["cm", "cm²"] : base === "cm" ? ["m", "m²"] : [])] : [];

export function NumericResponseBlock({ block, onDone }: { block: BlockOf<"NUMERIC_RESPONSE">; onDone: BlockDone }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [units, setUnits] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, Diagnosis> | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [hintsShown, setHintsShown] = useState(0);
  const id = useId();
  const shape = block.shape as ShapeSpec | undefined;
  const allRight = results !== null && block.parts.every((part) => results[part.id]?.result === "right");
  // The solution appears only after a submitted attempt: when it is right, or after two full attempts.
  const solutionOpen = allRight || attempts >= 2;
  useReportDone(block.id, allRight || solutionOpen, onDone);
  const check = () => {
    const next = Object.fromEntries(block.parts.map((part) => [part.id, diagnoseNumeric(part, values[part.id] ?? "", units[part.id] ?? "", shape)]));
    setResults(next);
    if (block.parts.every((part) => next[part.id].result !== "pending")) setAttempts((current) => current + 1);
  };
  return <BlockFrame label={block.mode === "GUIDED" ? "Solve with help" : "Solve on your own"} className="ll5-numeric" data={{ "data-numeric-response": block.id, "data-mode": block.mode }}>
    <div className="ll5-problem"><InlineText text={block.prompt} /></div>
    <div className="ll5-numeric-body" data-has-shape={shape ? "" : undefined}>
      {shape && <ShapeDiagram shape={shape} views={[]} reveal={false} />}
      <div className="ll5-answers">
        {block.parts.map((part) => {
          const diagnosis = results?.[part.id];
          const unitOptions = part.unit.kind === "NONE" ? [] : UNIT_CHOICES(part.unit.base);
          return <div key={part.id} className="ll5-answer" data-result={diagnosis?.result}>
            <label htmlFor={`${id}-${part.id}`} className="ll5-answer-label"><InlineText text={part.label} /></label>
            <div className="ll5-answer-row">
              <input id={`${id}-${part.id}`} className="ll5-input" inputMode={part.quantity === "OTHER" ? "text" : "decimal"} autoComplete="off" value={values[part.id] ?? ""} disabled={diagnosis?.result === "right"}
                onChange={(event) => setValues((current) => ({ ...current, [part.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") check(); }}
                aria-describedby={diagnosis ? `${id}-${part.id}-fb` : undefined} placeholder={part.quantity === "OTHER" ? "e.g. 3/4" : "Number"} />
              {unitOptions.length > 0 && <select aria-label={`Unit for ${part.label.replace(/\$[^$]*\$/g, "").trim()}`} className="ll5-select" value={units[part.id] ?? ""} disabled={diagnosis?.result === "right"} onChange={(event) => setUnits((current) => ({ ...current, [part.id]: event.target.value }))}>
                <option value="">Unit…</option>{unitOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </select>}
            </div>
            <div id={`${id}-${part.id}-fb`}>{diagnosis && diagnosis.code !== "EMPTY" && <Feedback result={diagnosis.result}>{diagnosis.result === "right" ? "" : <InlineText text={diagnosis.text} />}</Feedback>}</div>
          </div>;
        })}
        <div className="ll4-row">
          <button type="button" className="ll3-btn" data-primary="" onClick={check} disabled={allRight}>Check {block.parts.length > 1 ? "answers" : "answer"}</button>
          {block.mode === "GUIDED" && hintsShown < block.hints.length && !allRight && <button type="button" className="ll4-link-btn" onClick={() => setHintsShown((current) => current + 1)}><Lightbulb size={16} aria-hidden="true" className="mr-1 inline" />{hintsShown === 0 ? "Show a hint" : "Another hint"}</button>}
        </div>
        {block.hints.slice(0, hintsShown).map((hint, index) => <p key={index} className="ll4-hint"><Lightbulb size={16} aria-hidden="true" /> <InlineText text={hint} /></p>)}
        {solutionOpen && <div className="ll5-solution" role="region" aria-label="Solution">
          <p className="ll5-block-label">{allRight ? "How it works" : "Solution"}</p>
          <ol className="ll5-solution-steps">{block.afterAttempt.map((line, index) => <li key={index}><InlineText text={line} /></li>)}</ol>
        </div>}
        {!solutionOpen && block.mode === "INDEPENDENT" && <p className="ll3-small ll3-muted">The solution appears after you check your answer.</p>}
      </div>
    </div>
  </BlockFrame>;
}

export function MistakeAnalysisBlock({ block, onDone }: { block: BlockOf<"MISTAKE_ANALYSIS">; onDone: BlockDone }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const right = chosen === block.formativeKey.expectedOptionId;
  useReportDone(block.id, right, onDone);
  const name = useId();
  const picked = block.options.find((option) => option.id === chosen);
  return <BlockFrame label="Find the mistake" className="ll5-mistake" data={{ "data-mistake-analysis": block.id }}>
    <div className="ll5-problem"><InlineText text={block.problem} /></div>
    <div className="ll5-student-work" aria-label={`${block.attempt.name}'s work`} role="group">
      <p className="ll5-student-name">{block.attempt.name}&apos;s work</p>
      {block.attempt.steps.map((step, index) => <p key={index}><InlineText text={step} /></p>)}
    </div>
    <fieldset className="ll4-question">
      <legend className="ll4-question-prompt"><InlineText text={block.question} /></legend>
      <div className="ll4-options">{block.options.map((option) => <label key={option.id} className="ll3-choice" data-selected={chosen === option.id ? "" : undefined} data-verdict={chosen === option.id ? (right ? "right" : "retry") : undefined}>
        <input type="radio" name={name} checked={chosen === option.id} onChange={() => setChosen(option.id)} />
        <span><InlineText text={option.text} /></span>
      </label>)}</div>
    </fieldset>
    {picked && <Feedback result={right ? "right" : "retry"}><InlineText text={picked.feedback} />{!right && " Try another answer."}</Feedback>}
    {right && <div className="ll5-solution"><p className="ll5-block-label">The correct working</p><ol className="ll5-solution-steps">{block.correction.map((line, index) => <li key={index}><InlineText text={line} /></li>)}</ol></div>}
  </BlockFrame>;
}

// ── Fractions ──────────────────────────────────────────────────────────────

function FractionBar({ parts, shaded, onToggle, label }: { parts: number; shaded: ReadonlySet<number>; onToggle?: (index: number) => void; label: string }) {
  return <div className="ll5-fbar" role={onToggle ? "group" : "img"} aria-label={label}>
    {Array.from({ length: parts }, (_, index) => onToggle
      ? <button key={index} type="button" className="ll5-fpart" aria-pressed={shaded.has(index)} aria-label={`Part ${index + 1} of ${parts}${shaded.has(index) ? ", shaded" : ""}`} onClick={() => onToggle(index)} />
      : <span key={index} className="ll5-fpart" data-shaded={shaded.has(index) ? "" : undefined} />)}
  </div>;
}

function sector(index: number, parts: number, r = 90, c = 100) {
  if (parts === 1) return `M${c},${c - r} A${r},${r} 0 1,1 ${c - 0.01},${c - r} Z`;
  const a0 = (index / parts) * 2 * Math.PI - Math.PI / 2, a1 = ((index + 1) / parts) * 2 * Math.PI - Math.PI / 2;
  return `M${c},${c} L${c + r * Math.cos(a0)},${c + r * Math.sin(a0)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0},1 ${c + r * Math.cos(a1)},${c + r * Math.sin(a1)} Z`;
}

function FractionCircle({ parts, shaded, onToggle, label }: { parts: number; shaded: ReadonlySet<number>; onToggle?: (index: number) => void; label: string }) {
  return <svg viewBox="0 0 200 200" className="ll5-fcircle" role={onToggle ? "group" : "img"} aria-label={label}>
    {Array.from({ length: parts }, (_, index) => <path key={index} d={sector(index, parts)} className="ll5-fsector" data-shaded={shaded.has(index) ? "" : undefined}
      {...(onToggle ? { role: "button", tabIndex: 0, "aria-pressed": shaded.has(index), "aria-label": `Part ${index + 1} of ${parts}`, onClick: () => onToggle(index), onKeyDown: (event: KeyboardEvent<SVGPathElement>) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onToggle(index); } } } : {})} />)}
  </svg>;
}

export function FractionModelBlock({ block, onDone }: { block: BlockOf<"FRACTION_MODEL">; onDone: BlockDone }) {
  const interactive = block.interaction !== "NONE";
  const [parts, setParts] = useState(block.parts);
  const [shaded, setShaded] = useState<Set<number>>(() => new Set(Array.from({ length: block.shaded }, (_, index) => index)));
  const [checked, setChecked] = useState<ReturnType<typeof diagnoseShading> | null>(null);
  const target = block.target as Fraction | undefined;
  const done = checked?.kind === "MATCH" || checked?.kind === "EQUIVALENT";
  useReportDone(block.id, done, onDone);
  const toggle = (index: number) => { setChecked(null); setShaded((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; }); };
  const repartition = (next: number) => { setParts(next); setChecked(null); setShaded((current) => new Set([...current].filter((index) => index < next))); };
  const label = `${block.representation === "BAR" ? "Bar" : "Circle"} in ${parts} equal parts, ${shaded.size} shaded`;
  const Model = block.representation === "BAR" ? FractionBar : FractionCircle;
  const feedback = !checked || !target ? null : checked.kind === "MATCH" ? `Your model shows $\\frac{${target.numerator}}{${target.denominator}}$.`
    : checked.kind === "EQUIVALENT" ? `$\\frac{${shaded.size}}{${parts}}$ is equivalent to $\\frac{${target.numerator}}{${target.denominator}}$: the same amount in smaller parts.`
    : checked.kind === "COUNTED_UNSHADED" ? `You shaded the part that is left over. Shade the amount itself: $\\frac{${target.numerator}}{${target.denominator}}$.`
    : checked.kind === "WRONG_WHOLE" ? `You shaded ${target.numerator} parts, but the whole is cut into ${parts}. For $\\frac{${target.numerator}}{${target.denominator}}$ the parts must be ${target.denominator}ths, or an equivalent number of smaller parts.`
    : `Your model shows $\\frac{${shaded.size}}{${parts}}$. Count the equal parts and how many are shaded.`;
  return <figure className="ll3-figure ll5-figure" data-fraction-model={block.id}>
    {target && <p className="ll5-block-title">Show <MathExpression tex={`\\frac{${target.numerator}}{${target.denominator}}`} /></p>}
    <Model parts={parts} shaded={shaded} onToggle={interactive ? toggle : undefined} label={label} />
    <div className="ll5-fraction-readout" aria-live="polite">
      <MathExpression tex={`\\frac{${shaded.size}}{${parts}}`} display />
      <span>{shaded.size} of {parts} equal parts {shaded.size === 1 ? "is" : "are"} shaded{shaded.size === parts && parts > 0 ? ": one whole" : ""}</span>
    </div>
    {interactive && <div className="ll4-row">
      <button type="button" className="ll3-btn" onClick={() => repartition(Math.max(1, parts - 1))} disabled={parts <= 1}><Minus size={16} aria-hidden="true" /> Fewer parts</button>
      <button type="button" className="ll3-btn" onClick={() => repartition(Math.min(12, parts + 1))} disabled={parts >= 12}><Plus size={16} aria-hidden="true" /> More parts</button>
      {block.interaction === "SHADE_TARGET" && <button type="button" className="ll3-btn" data-primary="" onClick={() => target && setChecked(diagnoseShading(target, parts, shaded.size))}>Check my model</button>}
    </div>}
    {feedback && <Feedback result={done ? "right" : "retry"}><InlineText text={feedback} /></Feedback>}
    <figcaption><InlineText text={block.caption} /></figcaption>
  </figure>;
}

export function FractionEquivalenceBlock({ block }: { block: BlockOf<"FRACTION_EQUIVALENCE"> }) {
  const [factor, setFactor] = useState(1);
  const base = block.base;
  const parts = base.denominator * factor, shadedCount = base.numerator * factor;
  return <figure className="ll3-figure ll5-figure" data-fraction-equivalence={block.id}>
    <FractionBar parts={base.denominator} shaded={new Set(Array.from({ length: base.numerator }, (_, index) => index))} label={`${base.numerator} of ${base.denominator} parts shaded`} />
    <FractionBar parts={parts} shaded={new Set(Array.from({ length: shadedCount }, (_, index) => index))} label={`${shadedCount} of ${parts} parts shaded`} />
    <div className="ll4-row" role="group" aria-label="Split every part">
      {[1, ...block.factors].map((candidate) => <button key={candidate} type="button" className="ll3-btn ll5-toggle" aria-pressed={factor === candidate} onClick={() => setFactor(candidate)}>{candidate === 1 ? "No split" : `Split each part into ${candidate}`}</button>)}
    </div>
    <div className="ll5-fraction-readout" aria-live="polite"><MathExpression tex={factor === 1 ? `\\frac{${base.numerator}}{${base.denominator}}` : `\\frac{${base.numerator}}{${base.denominator}} = \\frac{${base.numerator} \\times ${factor}}{${base.denominator} \\times ${factor}} = \\frac{${shadedCount}}{${parts}}`} display /></div>
    <figcaption><InlineText text={block.caption} /></figcaption>
  </figure>;
}

export function FractionNumberLineBlock({ block, onDone }: { block: BlockOf<"FRACTION_NUMBER_LINE">; onDone: BlockDone }) {
  const ticks = block.denominator * block.wholes;
  const [at, setAt] = useState(0);
  const [checked, setChecked] = useState<number | null>(null);
  const key = block.formativeKey;
  const right = checked !== null && equivalent({ numerator: checked, denominator: block.denominator }, key);
  useReportDone(block.id, right, onDone);
  const id = useId();
  const x = (index: number) => 24 + (index / ticks) * 552;
  const feedback = checked === null ? null : right ? `Yes: ${checked} jumps of $\\frac{1}{${block.denominator}}$ from 0 is $\\frac{${key.numerator}}{${key.denominator}}$.`
    : key.numerator > key.denominator && checked <= block.denominator ? `A fraction can be more than 1. $\\frac{${key.numerator}}{${key.denominator}}$ is past 1 on the line.`
    : `You placed the point at $\\frac{${checked}}{${block.denominator}}$. Count jumps of $\\frac{1}{${block.denominator}}$ from 0.`;
  return <BlockFrame label="Number line" title={block.prompt} className="ll5-numberline" data={{ "data-number-line": block.id }}>
    <svg viewBox="0 0 600 90" role="img" aria-label={`Number line from 0 to ${block.wholes} in steps of one ${block.denominator === 2 ? "half" : `${block.denominator}th`}. The point is at ${at} of ${block.denominator}.`}>
      <line x1={x(0)} y1={40} x2={x(ticks)} y2={40} className="ll5-nl-axis" />
      {Array.from({ length: ticks + 1 }, (_, index) => <g key={index}>
        <line x1={x(index)} y1={index % block.denominator === 0 ? 26 : 32} x2={x(index)} y2={index % block.denominator === 0 ? 54 : 48} className="ll5-nl-tick" />
        {index % block.denominator === 0 && <text x={x(index)} y={78} textAnchor="middle" className="ll5-shape-label">{index / block.denominator}</text>}
      </g>)}
      <circle cx={x(at)} cy={40} r={11} className="ll5-nl-point" />
    </svg>
    <label htmlFor={id} className="ll5-slider"><span>Point at: <MathExpression tex={`\\frac{${at}}{${block.denominator}}`} /></span>
      <input id={id} type="range" min={0} max={ticks} step={1} value={at} onChange={(event) => { setAt(Number(event.target.value)); setChecked(null); }} disabled={right} />
    </label>
    <div className="ll4-row"><button type="button" className="ll3-btn" data-primary="" onClick={() => setChecked(at)} disabled={right}>Check the point</button></div>
    {feedback && <Feedback result={right ? "right" : "retry"}><InlineText text={feedback} /></Feedback>}
  </BlockFrame>;
}

export function FractionCompareBlock({ block, onDone }: { block: BlockOf<"FRACTION_COMPARE">; onDone: BlockDone }) {
  const [chosen, setChosen] = useState<Relation | null>(null);
  const a = block.a as Fraction, b = block.b as Fraction;
  const diagnosis = chosen ? diagnoseComparison(a, b, chosen) : null;
  useReportDone(block.id, Boolean(diagnosis?.correct), onDone);
  const common = (a.denominator * b.denominator) / gcd(a.denominator, b.denominator);
  const tex = (value: Fraction) => `\\frac{${value.numerator}}{${value.denominator}}`;
  const explanation = `With a common denominator of ${common}: $${tex(a)} = \\frac{${a.numerator * (common / a.denominator)}}{${common}}$ and $${tex(b)} = \\frac{${b.numerator * (common / b.denominator)}}{${common}}$, so $${tex(a)} ${compare(a, b) === "=" ? "=" : compare(a, b)} ${tex(b)}$.`;
  const feedback = !diagnosis ? null : diagnosis.correct ? explanation
    : diagnosis.misconception === "LARGER_DENOMINATOR_IS_LARGER" ? "A bigger denominator means the whole is cut into more parts, so each part is smaller. Look at the bars."
    : diagnosis.misconception === "COMPARED_NUMERATORS_ONLY" ? "The parts are different sizes, so comparing only the numerators does not work. Give both fractions the same denominator, or compare the bars."
    : "Compare the shaded lengths of the two bars: they are the same size of whole.";
  const bar = (value: Fraction) => <FractionBar parts={value.denominator} shaded={new Set(Array.from({ length: Math.min(value.numerator, value.denominator) }, (_, index) => index))} label={`${value.numerator} of ${value.denominator} parts shaded`} />;
  return <BlockFrame label="Compare" title={block.prompt} className="ll5-compare" data={{ "data-fraction-compare": block.id }}>
    <div className="ll5-compare-rows">
      <div><MathExpression tex={tex(a)} />{bar(a)}</div>
      <div><MathExpression tex={tex(b)} />{bar(b)}</div>
    </div>
    <div className="ll4-row" role="group" aria-label="Choose the sign">
      <MathExpression tex={tex(a)} />
      {(["<", "=", ">"] as const).map((relation) => <button key={relation} type="button" className="ll3-btn ll5-sign" aria-pressed={chosen === relation} aria-label={relation === "<" ? "is less than" : relation === "=" ? "is equal to" : "is greater than"} onClick={() => setChosen(relation)} disabled={Boolean(diagnosis?.correct)}>{relation}</button>)}
      <MathExpression tex={tex(b)} />
    </div>
    {feedback && <Feedback result={diagnosis!.correct ? "right" : "retry"}><InlineText text={feedback} /></Feedback>}
  </BlockFrame>;
}

// ── Multiplication ─────────────────────────────────────────────────────────

export function ArrayModelBlock({ block }: { block: BlockOf<"ARRAY_MODEL"> }) {
  const [rows, setRows] = useState(block.rows);
  const [columns, setColumns] = useState(block.columns);
  const [view, setView] = useState<(typeof block.views)[number]>(block.views[0]);
  const id = useId();
  const product = rows * columns;
  const group = block.context?.group ?? "groups", item = block.context?.item ?? "dots";
  return <figure className="ll3-figure ll5-figure" data-array-model={block.id}>
    {block.views.length > 1 && <div className="ll4-row" role="group" aria-label="Show as">{block.views.map((candidate) => <button key={candidate} type="button" className="ll3-btn ll5-toggle" aria-pressed={view === candidate} onClick={() => setView(candidate)}>{candidate === "GROUPS" ? "Equal groups" : candidate === "ARRAY" ? "Array" : "Area grid"}</button>)}</div>}
    <div className={`ll5-array ll5-array-${view.toLowerCase()}`} role="img" aria-label={`${rows} ${view === "GROUPS" ? group : "rows"} of ${columns} ${view === "GRID" ? "squares" : item}: ${product} in all.`} style={{ ["--cols" as string]: columns }}>
      {Array.from({ length: rows }, (_, row) => <div key={row} className="ll5-array-row">{Array.from({ length: columns }, (_, column) => <span key={column} className="ll5-array-cell" />)}</div>)}
    </div>
    <div className="ll5-fraction-readout" aria-live="polite"><MathExpression tex={`${rows} \\times ${columns} = ${repeatedAddition(rows, columns)} = ${product}`} display /></div>
    {block.adjustable && <div className="ll5-sliders">
      <label htmlFor={`${id}-r`} className="ll5-slider"><span>{view === "GROUPS" ? "Groups" : "Rows"}: <strong>{rows}</strong></span><input id={`${id}-r`} type="range" min={1} max={10} value={rows} onChange={(event) => setRows(Number(event.target.value))} /></label>
      <label htmlFor={`${id}-c`} className="ll5-slider"><span>{view === "GROUPS" ? "In each group" : "Columns"}: <strong>{columns}</strong></span><input id={`${id}-c`} type="range" min={1} max={10} value={columns} onChange={(event) => setColumns(Number(event.target.value))} /></label>
    </div>}
    <figcaption><InlineText text={block.caption} /></figcaption>
  </figure>;
}

export function AreaModelBlock({ block, onDone }: { block: BlockOf<"AREA_MODEL">; onDone: BlockDone }) {
  const rowParts = block.splitB ?? [block.factorB];
  const columnParts = block.splitA ?? placeValueParts(block.factorA);
  const model = useMemo(() => areaModel(rowParts, columnParts), [rowParts, columnParts]);
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [total, setTotal] = useState("");
  const [checked, setChecked] = useState(false);
  const fill = block.mode === "FILL";
  const cellValue = (r: number, c: number) => { const raw = entries[`${r}-${c}`]; return raw && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : null; };
  const cellResults = rowParts.map((row, r) => columnParts.map((column, c) => diagnosePartial(row, column, cellValue(r, c))));
  const cellsRight = cellResults.flat().every((result) => result.kind === "CORRECT");
  const totalRight = Number(total.trim()) === model.total;
  const done = fill && checked && cellsRight && totalRight;
  useReportDone(block.id, done, onDone);
  const id = useId();
  const widths = columnParts.map((part) => Math.max(18, (part / block.factorA) * 100));
  const firstProblem = cellResults.flat().find((result) => result.kind !== "CORRECT");
  return <BlockFrame label={fill ? "Area model: fill it in" : "Area model"} title={block.prompt} className="ll5-areamodel" data={{ "data-area-model": block.id }}>
    <div className="ll5-am" role="group" aria-label={`${block.factorA} split into ${columnParts.join(" + ")}, by ${block.factorB}${rowParts.length > 1 ? ` split into ${rowParts.join(" + ")}` : ""}`}>
      <div className="ll5-am-top" style={{ gridTemplateColumns: widths.map((width) => `${width}fr`).join(" ") }}>{columnParts.map((part, c) => <span key={c}>{part}</span>)}</div>
      {rowParts.map((row, r) => <div key={r} className="ll5-am-row">
        <span className="ll5-am-side">{row}</span>
        <div className="ll5-am-cells" style={{ gridTemplateColumns: widths.map((width) => `${width}fr`).join(" ") }}>
          {columnParts.map((column, c) => <div key={c} className="ll5-am-cell" data-result={fill && checked ? (cellResults[r][c].kind === "CORRECT" ? "right" : "retry") : undefined}>
            {fill
              ? <><label htmlFor={`${id}-${r}-${c}`} className="ll5-am-q"><MathExpression tex={`${row} \\times ${column}`} /></label>
                <input id={`${id}-${r}-${c}`} className="ll5-input ll5-am-input" inputMode="numeric" autoComplete="off" value={entries[`${r}-${c}`] ?? ""} onChange={(event) => { setChecked(false); setEntries((current) => ({ ...current, [`${r}-${c}`]: event.target.value })); }} /></>
              : <><span className="ll5-am-q"><MathExpression tex={`${row} \\times ${column}`} /></span><strong>{model.cells[r][c]}</strong></>}
          </div>)}
        </div>
      </div>)}
    </div>
    {fill
      ? <div className="ll5-answer">
        <label htmlFor={`${id}-total`} className="ll5-answer-label">Total: add the parts, <MathExpression tex={`${block.factorA} \\times ${block.factorB} =`} /></label>
        <div className="ll5-answer-row"><input id={`${id}-total`} className="ll5-input" inputMode="numeric" autoComplete="off" value={total} onChange={(event) => { setChecked(false); setTotal(event.target.value); }} />
          <button type="button" className="ll3-btn" data-primary="" onClick={() => setChecked(true)} disabled={done}>Check</button></div>
        {checked && <Feedback result={done ? "right" : "retry"}>{done ? <InlineText text={`$${model.cells.flat().join(" + ")} = ${model.total}$.`} />
          : firstProblem?.kind === "PLACE_VALUE_DROPPED" ? "One part has lost its place value: a 20 is 2 tens, so 20 × 4 is 80, not 8."
          : firstProblem?.kind === "ADDED_INSTEAD" ? "One part was added. Each part of the rectangle is length times width: multiply."
          : firstProblem?.kind === "EMPTY" ? "Fill in every part of the rectangle first."
          : firstProblem ? "Check the marked part: multiply its two edge numbers."
          : "Every part is right. Now add all the parts for the total."}</Feedback>}
      </div>
      : <div className="ll5-fraction-readout"><MathExpression tex={`${block.factorA} \\times ${block.factorB} = ${model.cells.flat().join(" + ")} = ${model.total}`} display /></div>}
  </BlockFrame>;
}


"use client";

/**
 * GRAPH_BUILDER (teaching-blocks/1.2.0), grades 3-12. Plots the MEASUREMENT_TABLE named by `sourceBlockId`, read
 * from the same activity (ActivityScope), so the learner graphs their own measurements without retyping them.
 * The learner picks the kind of graph and the axes; feedback compares that with the block's axis rule. The picture
 * has a text summary and a points list for screen readers. Formative only: nothing is scored, saved or recorded.
 */
import "./stem.css";
import { useEffect, useMemo, useState } from "react";
import { useSnapshot } from "./ActivityScope";
import { checkAxes, graphPoints, graphSummary, KIND_LABEL, niceScale, validateGraphBuilder, type GraphBuilderData, type GraphKind, type GraphPoint } from "@/lib/learner-experience/stem/graphBuilder";

type Props = { block: GraphBuilderData; onDone?: (blockId: string, done: boolean) => void };
const W = 360, H = 240, PAD = { left: 52, right: 12, top: 12, bottom: 44 };

export function GraphBuilderBlock({ block, onDone }: Props) {
  const data = useMemo(() => validateGraphBuilder(block), [block]);
  const snapshot = useSnapshot(data.sourceBlockId);
  const source = snapshot?.kind === "MEASUREMENT_TABLE" ? snapshot : undefined;
  const [kind, setKind] = useState<GraphKind | null>(data.allowedKinds.length === 1 ? data.allowedKinds[0] : null);
  const [x, setX] = useState(""), [y, setY] = useState("");
  const id = `gb-${data.id}`;
  const columns = source?.columns ?? [];
  const axes = checkAxes(data, columns, x, y);
  const points = source && axes.state === "CORRECT" ? graphPoints(source.rows, x, y) : [];
  const done = kind !== null && axes.state === "CORRECT" && points.length >= 2;
  useEffect(() => { onDone?.(data.id, done); }, [data.id, done, onDone]);
  const colX = columns.find((c) => c.id === x), colY = columns.find((c) => c.id === y);

  return (
    <section className="ll8-block ll8-graph" aria-labelledby={`${id}-title`} data-block-type="GRAPH_BUILDER" data-graph-source={data.sourceBlockId}>
      <h3 id={`${id}-title`} className="ll8-title">Make a graph</h3>
      <p>{data.prompt}</p>
      {!source ? <p className="ll8-feedback" data-graph-waiting>This graph uses the measurement table in this activity. Fill in the table first; your numbers appear here.</p> : <>
        <p className="ll8-muted">Data: {source.title} ({source.origin === "ILLUSTRATIVE" ? "illustrative numbers, not real measurements" : "your own measurements"}).</p>
        {data.allowedKinds.length > 1 && <fieldset className="ll8-checks"><legend className="ll8-label">Kind of graph</legend>
          {data.allowedKinds.map((k) => <label key={k} className="ll8-check"><input type="radio" name={`${id}-kind`} checked={kind === k} onChange={() => setKind(k)} /> {KIND_LABEL[k]}</label>)}
        </fieldset>}
        <div className="ll8-axes">
          <label className="ll8-field"><span>Along the bottom (x-axis)</span>
            <select value={x} onChange={(e) => setX(e.target.value)}><option value="">Choose…</option>{columns.map((c) => <option key={c.id} value={c.id}>{c.label}{c.unit ? ` (${c.unit})` : ""}</option>)}</select></label>
          <label className="ll8-field"><span>Up the side (y-axis)</span>
            <select value={y} onChange={(e) => setY(e.target.value)}><option value="">Choose…</option>{columns.map((c) => <option key={c.id} value={c.id}>{c.label}{c.unit ? ` (${c.unit})` : ""}</option>)}</select></label>
        </div>
        <p role="status" className={axes.state === "CORRECT" || axes.state === "INCOMPLETE" ? "ll8-muted" : "ll8-feedback"} data-axis-check={axes.state}>{axes.message}</p>
        {kind && axes.state === "CORRECT" && colX && colY && (points.length < 2
          ? <p className="ll8-feedback" data-graph-needs-points>Enter at least two complete trials in the table to draw the graph.</p>
          : <Chart kind={kind} points={points} zero={data.axisRules.zeroBaselineRequired} xLabel={`${colX.label}${colX.unit ? ` (${colX.unit})` : ""}`} yLabel={`${colY.label}${colY.unit ? ` (${colY.unit})` : ""}`}
              summary={graphSummary(kind, points, colX, colY)} />)}
      </>}
      <p className="ll8-muted">Your graph stays on this screen only. It is not saved or sent.</p>
    </section>
  );
}

function Chart({ kind, points, zero, xLabel, yLabel, summary }: { kind: GraphKind; points: readonly GraphPoint[]; zero: boolean; xLabel: string; yLabel: string; summary: string }) {
  const ys = niceScale(points.map((p) => p.y), zero);
  const plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
  const py = (v: number) => PAD.top + plotH - ((v - ys.min) / (ys.max - ys.min)) * plotH;
  // Bars are categories in trial order; line and scatter use a numeric x-axis.
  const xs = kind === "BAR" ? null : niceScale(points.map((p) => p.x), false);
  const px = (p: GraphPoint, i: number) => (xs ? PAD.left + ((p.x - xs.min) / (xs.max - xs.min)) * plotW : PAD.left + (plotW / points.length) * (i + 0.5));
  const ordered = kind === "LINE" ? [...points].sort((a, b) => a.x - b.x) : points;
  const band = plotW / points.length;
  return <figure className="ll8-chart" data-graph-kind={kind}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
      {ys.ticks.map((t) => <g key={t}><line x1={PAD.left} x2={W - PAD.right} y1={py(t)} y2={py(t)} className="ll8-grid-line" /><text x={PAD.left - 6} y={py(t) + 4} textAnchor="end" className="ll8-tick">{t}</text></g>)}
      {xs && xs.ticks.map((t) => <text key={t} x={PAD.left + ((t - xs.min) / (xs.max - xs.min)) * plotW} y={H - PAD.bottom + 16} textAnchor="middle" className="ll8-tick">{t}</text>)}
      <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} className="ll8-axis" />
      <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} className="ll8-axis" />
      {kind === "BAR" && points.map((p, i) => { const base = py(Math.max(ys.min, 0)), top = py(p.y);
        return <g key={p.trial}><rect x={PAD.left + band * i + band * 0.15} width={band * 0.7} y={Math.min(base, top)} height={Math.abs(base - top)} className="ll8-bar" />
          <text x={px(p, i)} y={H - PAD.bottom + 16} textAnchor="middle" className="ll8-tick">{p.x}</text></g>; })}
      {kind === "LINE" && <polyline points={ordered.map((p, i) => `${px(p, i)},${py(p.y)}`).join(" ")} className="ll8-line" />}
      {kind !== "BAR" && ordered.map((p, i) => <circle key={p.trial} cx={px(p, i)} cy={py(p.y)} r={5} className="ll8-dot" />)}
      <text x={PAD.left + plotW / 2} y={H - 6} textAnchor="middle" className="ll8-axis-label">{xLabel}</text>
      <text transform={`translate(14 ${PAD.top + plotH / 2}) rotate(-90)`} textAnchor="middle" className="ll8-axis-label">{yLabel}</text>
    </svg>
    <figcaption className="ll8-muted">{summary}{zero ? " The side axis starts at 0." : ""}</figcaption>
    <details><summary>Points as a list</summary><ul>{points.map((p) => <li key={p.trial}>Trial {p.trial}: {p.x}, {p.y}</li>)}</ul></details>
  </figure>;
}

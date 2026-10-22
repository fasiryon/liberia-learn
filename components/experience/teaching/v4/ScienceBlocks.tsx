"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Minus, Pause, Play, Plus } from "lucide-react";
import { InlineText } from "@/components/experience/LessonText";
import { STATE_LABEL, particleBehaviour, seededRandom } from "@/lib/learner-experience/teaching/models/matter";
import type { BlockOf } from "@/lib/learner-experience/teaching/registry";
import { BlockFrame, Feedback, useReportDone, type BlockDone } from "./shared";

const COUNT = 24, BOX_W = 320, BOX_H = 220, R = 9;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);
  return reduced;
}

/** Target positions for a state: a lattice for a solid, a packed pool for a liquid, spread out for a gas. */
function homes(state: "SOLID" | "LIQUID" | "GAS", seed: number) {
  const random = seededRandom(seed);
  if (state === "SOLID") return Array.from({ length: COUNT }, (_, index) => ({ x: 70 + (index % 6) * 2.15 * R + 2 * R, y: BOX_H - 24 - Math.floor(index / 6) * 2.15 * R }));
  if (state === "LIQUID") return Array.from({ length: COUNT }, (_, index) => ({ x: 22 + (index % 8) * 2.45 * R + random() * 5 + (Math.floor(index / 8) % 2) * R, y: BOX_H - 18 - Math.floor(index / 8) * 2.2 * R - random() * 4 }));
  return Array.from({ length: COUNT }, () => ({ x: 20 + random() * (BOX_W - 40), y: 20 + random() * (BOX_H - 40) }));
}

/**
 * Particle model of water. Spacing and motion follow `particleBehaviour`; positions are seeded so a given
 * temperature always draws the same starting picture. With reduced motion, or when paused, it is a still
 * picture and the state is described in words.
 */
export function ParticleSimulation({ temperature, label }: { temperature: number; label?: string }) {
  const behaviour = particleBehaviour(temperature);
  const reduced = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const target = useMemo(() => homes(behaviour.state, 7), [behaviour.state]);
  const [points, setPoints] = useState(() => target.map((point) => ({ ...point, vx: 0, vy: 0 })));
  const frame = useRef<number | null>(null);
  const speed = useRef(behaviour.speed);
  speed.current = behaviour.speed;
  useEffect(() => {
    const random = seededRandom(11);
    setPoints((current) => target.map((home, index) => ({ x: current[index]?.x ?? home.x, y: current[index]?.y ?? home.y, vx: (random() - 0.5) * 2, vy: (random() - 0.5) * 2 })));
  }, [target]);
  useEffect(() => {
    if (reduced || paused) { setPoints(target.map((point) => ({ ...point, vx: 0, vy: 0 }))); return; }
    let t = 0;
    const step = () => {
      t += 1;
      setPoints((current) => current.map((point, index) => {
        const home = target[index];
        const s = speed.current;
        if (behaviour.state === "SOLID") return { ...point, x: home.x + Math.sin(t * 0.35 * (1 + s) + index) * 1.6 * s * 2, y: home.y + Math.cos(t * 0.31 * (1 + s) + index * 1.7) * 1.6 * s * 2 };
        let { x, y, vx, vy } = point;
        if (behaviour.state === "LIQUID") { vx += (home.x - x) * 0.01 + Math.sin(t * 0.05 + index) * 0.08 * s; vy += (home.y - y) * 0.02; vx *= 0.9; vy *= 0.9; }
        x += vx * s * 2.2; y += vy * s * 2.2;
        if (x < R + 4 || x > BOX_W - R - 4) { vx = -vx; x = Math.min(BOX_W - R - 4, Math.max(R + 4, x)); }
        if (y < R + 4 || y > BOX_H - R - 4) { vy = -vy; y = Math.min(BOX_H - R - 4, Math.max(R + 4, y)); }
        return { x, y, vx, vy };
      }));
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [reduced, paused, target, behaviour.state]);
  const still = reduced || paused;
  return <div className="ll5-particles" data-state={behaviour.state}>
    <svg viewBox={`0 0 ${BOX_W} ${BOX_H}`} role="img" aria-label={label ?? `Water at ${temperature} °C is a ${behaviour.state.toLowerCase()}: particles are ${behaviour.arrangement} and ${behaviour.motion}.`}>
      <rect x={2} y={2} width={BOX_W - 4} height={BOX_H - 4} rx={10} className="ll5-particle-box" />
      {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={R} className="ll5-particle" />)}
      {still && behaviour.state !== "SOLID" && points.slice(0, 6).map((point, index) => <line key={`a${index}`} x1={point.x} y1={point.y} x2={point.x + (index % 2 ? 1 : -1) * 14 * behaviour.speed} y2={point.y - 10 * behaviour.speed} className="ll5-particle-arrow" />)}
    </svg>
    {!reduced && <button type="button" className="ll3-btn ll5-pause" onClick={() => setPaused((current) => !current)} aria-pressed={paused}>{paused ? <><Play size={16} aria-hidden="true" /> Play motion</> : <><Pause size={16} aria-hidden="true" /> Pause motion</>}</button>}
  </div>;
}

function StateFacts({ temperature }: { temperature: number }) {
  const behaviour = particleBehaviour(temperature);
  return <dl className="ll5-readout ll5-state-facts" aria-live="polite">
    <div><dt>State</dt><dd>{STATE_LABEL[behaviour.state]}</dd></div>
    <div><dt>Particles</dt><dd>{behaviour.arrangement}; they {behaviour.motion}</dd></div>
    <div><dt>Shape</dt><dd>{behaviour.shape}</dd></div>
    <div><dt>Volume</dt><dd>{behaviour.volume}</dd></div>
  </dl>;
}

export function ParticleModelBlock({ block }: { block: BlockOf<"PARTICLE_MODEL"> }) {
  const [temperature, setTemperature] = useState(block.startC);
  const id = useId();
  const set = (value: number) => setTemperature(Math.max(block.minC, Math.min(block.maxC, value)));
  return <figure className="ll3-figure ll5-figure" data-particle-model={block.id}>
    <div className="ll5-particle-layout">
      <ParticleSimulation temperature={temperature} />
      <div className="ll5-particle-controls">
        <label htmlFor={id} className="ll5-slider ll5-thermo"><span>Temperature: <strong>{temperature} °C</strong></span>
          <input id={id} type="range" min={block.minC} max={block.maxC} step={1} value={temperature} onChange={(event) => set(Number(event.target.value))} />
        </label>
        <div className="ll4-row">
          <button type="button" className="ll3-btn" onClick={() => set(temperature - 10)} disabled={temperature <= block.minC}><Minus size={16} aria-hidden="true" /> Cooler</button>
          <button type="button" className="ll3-btn" onClick={() => set(temperature + 10)} disabled={temperature >= block.maxC}><Plus size={16} aria-hidden="true" /> Warmer</button>
        </div>
        <StateFacts temperature={temperature} />
      </div>
    </div>
    <figcaption><InlineText text={block.caption} /> Pure water at sea level: it melts at 0 °C and boils at 100 °C.</figcaption>
  </figure>;
}

export function PredictObserveBlock({ block, onDone }: { block: BlockOf<"PREDICT_OBSERVE">; onDone: BlockDone }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [temperature, setTemperature] = useState(block.simulation.startC);
  const [ran, setRan] = useState(false);
  const [explanation, setExplanation] = useState("");
  const name = useId();
  const reduced = usePrefersReducedMotion();
  const explained = explanation.trim().length >= block.explainMinChars;
  useReportDone(block.id, ran && explained, onDone);
  const run = () => {
    if (reduced) { setTemperature(block.simulation.endC); setRan(true); return; }
    const start = block.simulation.startC, end = block.simulation.endC, began = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - began) / 4000);
      setTemperature(Math.round(start + (end - start) * progress));
      if (progress < 1) requestAnimationFrame(tick); else setRan(true);
    };
    requestAnimationFrame(tick);
  };
  const picked = block.options.find((option) => option.id === choice);
  return <BlockFrame label="Predict · observe · explain" title={block.prompt} className="ll5-poe" data={{ "data-predict-observe": block.id, "data-stage": !locked ? "predict" : !ran ? "observe" : "explain" }}>
    <fieldset className="ll4-question" disabled={locked}>
      <legend className="ll5-block-label">1. Your prediction</legend>
      <div className="ll4-options">{block.options.map((option) => <label key={option.id} className="ll3-choice" data-selected={choice === option.id ? "" : undefined}>
        <input type="radio" name={name} checked={choice === option.id} onChange={() => setChoice(option.id)} /><span><InlineText text={option.text} /></span>
      </label>)}</div>
    </fieldset>
    {!locked && <div className="ll4-row"><button type="button" className="ll3-btn" data-primary="" disabled={!choice} onClick={() => setLocked(true)}>Lock in my prediction</button></div>}
    {locked && <div className="ll5-poe-run">
      <p className="ll5-block-label">2. The experiment</p>
      <ParticleSimulation temperature={temperature} />
      <p className="ll3-small" aria-live="polite">Temperature: <strong>{temperature} °C</strong> · {STATE_LABEL[particleBehaviour(temperature).state]}</p>
      {!ran && <button type="button" className="ll3-btn" data-primary="" onClick={run}><Play size={16} aria-hidden="true" /> Run the experiment</button>}
    </div>}
    {ran && <>
      <div className="ll5-solution"><p className="ll5-block-label">What happened</p><p><InlineText text={block.observation} /></p></div>
      {picked && <Feedback result={picked.id === block.formativeKey.expectedOptionId ? "right" : "retry"}><InlineText text={picked.feedback} /></Feedback>}
      <label htmlFor={`${name}-explain`} className="ll5-answer-label">3. <InlineText text={block.explainPrompt} /></label>
      <textarea id={`${name}-explain`} className="ll5-textarea" rows={3} value={explanation} onChange={(event) => setExplanation(event.target.value)} />
      <p className="ll3-small ll3-muted">{explained ? "Thank you. Your explanation stays on this device." : `Write at least ${block.explainMinChars - explanation.trim().length} more characters.`}</p>
    </>}
  </BlockFrame>;
}

export function DataPlotBlock({ block }: { block: BlockOf<"DATA_PLOT"> }) {
  const xs = block.series.map((point) => point.x), ys = block.series.map((point) => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const span = Math.max(...ys) - Math.min(...ys) || 1;
  // A "nice" step (1, 2 or 5 × 10^k) giving about six gridlines.
  const raw = span / 6, magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= raw) ?? 10 * magnitude;
  const minY = Math.floor(Math.min(...ys) / step) * step, maxY = Math.ceil(Math.max(...ys) / step) * step;
  const W = 600, H = 300, L = 56, B = 44, T = 16, Rm = 16;
  const X = (x: number) => L + ((x - minX) / (maxX - minX || 1)) * (W - L - Rm);
  const Y = (y: number) => T + (1 - (y - minY) / (maxY - minY || 1)) * (H - T - B);
  const yTicks = Array.from({ length: Math.round((maxY - minY) / step) + 1 }, (_, index) => minY + index * step);
  const unit = (value: number, u: string) => `${value}${u ? ` ${u}` : ""}`;
  return <figure className="ll3-figure ll5-figure ll5-plot" data-data-plot={block.id}>
    <p className="ll5-block-title">{block.title}</p>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${block.title}: line graph of ${block.y.label} against ${block.x.label}. The readings are in the table below.`}>
      {yTicks.map((tick) => <g key={tick}><line x1={L} x2={W - Rm} y1={Y(tick)} y2={Y(tick)} className="ll5-plot-grid" /><text x={L - 8} y={Y(tick) + 5} textAnchor="end" className="ll5-plot-tick">{tick}</text></g>)}
      {xs.map((x) => <text key={x} x={X(x)} y={H - B + 20} textAnchor="middle" className="ll5-plot-tick">{x}</text>)}
      <line x1={L} x2={L} y1={T} y2={H - B} className="ll5-plot-axis" /><line x1={L} x2={W - Rm} y1={H - B} y2={H - B} className="ll5-plot-axis" />
      <polyline points={block.series.map((point) => `${X(point.x)},${Y(point.y)}`).join(" ")} className="ll5-plot-line" />
      {block.series.map((point, index) => <circle key={index} cx={X(point.x)} cy={Y(point.y)} r={4.5} className="ll5-plot-point"><title>{`${unit(point.x, block.x.unit)}: ${unit(point.y, block.y.unit)}`}</title></circle>)}
      <text x={(L + W - Rm) / 2} y={H - 4} textAnchor="middle" className="ll5-plot-label">{block.x.label}{block.x.unit ? ` (${block.x.unit})` : ""}</text>
      <text x={14} y={(T + H - B) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(T + H - B) / 2})`} className="ll5-plot-label">{block.y.label}{block.y.unit ? ` (${block.y.unit})` : ""}</text>
    </svg>
    <details className="ll5-plot-table">
      <summary>Table of readings</summary>
      <div className="ll3-table-wrap" role="region" aria-label={`${block.title} readings`} tabIndex={0}><table className="ll3-table"><thead><tr><th scope="col">{block.x.label}{block.x.unit ? ` (${block.x.unit})` : ""}</th><th scope="col">{block.y.label}{block.y.unit ? ` (${block.y.unit})` : ""}</th></tr></thead>
        <tbody>{block.series.map((point, index) => <tr key={index}><td>{point.x}</td><td>{point.y}</td></tr>)}</tbody></table></div>
    </details>
    <figcaption><InlineText text={block.caption} /> {block.data.kind === "ILLUSTRATIVE" && <em>{block.data.note}</em>}</figcaption>
  </figure>;
}

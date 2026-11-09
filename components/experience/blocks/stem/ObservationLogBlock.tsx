"use client";

/**
 * OBSERVATION_LOG (teaching-blocks/1.2.0), K-2. The learner records what they saw in a hands-on investigation, up to
 * `maxEntries`, in one of the block's response modes: telling the teacher (who writes it here), writing, or drawing.
 * Drawing has an on-paper alternative, so pointer-only input never blocks a learner. Feedback is NONE by registry:
 * entries are acknowledged, never judged. Memory only: nothing is scored, saved or recorded.
 */
import "./stem.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import { BLOCK_SCHEMAS_1_2 } from "@/lib/learner-experience/teaching/registry-1.2";

export type ObservationLogData = z.infer<typeof BLOCK_SCHEMAS_1_2.OBSERVATION_LOG>;
type Mode = ObservationLogData["responseModes"][number];
type Entry = Readonly<{ mode: Mode; values: Readonly<Record<string, string>>; drew: boolean; onPaper: boolean }>;
const MODE_LABEL: Record<Mode, string> = { ORAL_WITH_SCRIBE: "Tell my teacher", TEXT: "Write it", DRAWING: "Draw it" };

export function validateObservationLog(block: unknown): ObservationLogData {
  const parsed = BLOCK_SCHEMAS_1_2.OBSERVATION_LOG.safeParse(block);
  if (!parsed.success) throw Error(`observation_log_invalid:${parsed.error.issues[0]?.message ?? "schema"}`);
  if (new Set(parsed.data.fields.map((f) => f.id)).size !== parsed.data.fields.length) throw Error("observation_log_invalid:duplicate_field");
  return parsed.data;
}

/** An entry counts once something is recorded: any written field, a drawing, or a drawing on paper. */
export const entryRecorded = (e: Entry) => (e.mode === "DRAWING" ? e.drew || e.onPaper : Object.values(e.values).some((v) => v.trim().length > 0));

export function ObservationLogBlock({ block, onDone }: { block: ObservationLogData; onDone?: (blockId: string, done: boolean) => void }) {
  const data = useMemo(() => validateObservationLog(block), [block]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [mode, setMode] = useState<Mode>(data.responseModes[0]);
  const [announce, setAnnounce] = useState("");
  const id = `ol-${data.id}`;
  const recorded = entries.filter(entryRecorded).length;
  useEffect(() => { onDone?.(data.id, recorded > 0); }, [data.id, recorded, onDone]);
  const patch = (i: number, p: Partial<Entry>) => setEntries((all) => all.map((e, j) => (j === i ? { ...e, ...p } : e)));
  const add = () => { setEntries((all) => [...all, { mode, values: {}, drew: false, onPaper: false }]); setAnnounce(`Observation ${entries.length + 1} added.`); };

  return (
    <section className="ll8-block ll8-observe" aria-labelledby={`${id}-title`} data-block-type="OBSERVATION_LOG">
      <h3 id={`${id}-title`} className="ll8-title">What did you see?</h3>
      <p>{data.prompt}</p>
      {data.responseModes.length > 1 && <fieldset className="ll8-checks ll8-modes"><legend className="ll8-label">How will you record it?</legend>
        {data.responseModes.map((m) => <label key={m} className="ll8-check"><input type="radio" name={`${id}-mode`} checked={mode === m} onChange={() => setMode(m)} /> {MODE_LABEL[m]}</label>)}
      </fieldset>}
      <ol className="ll8-entries">{entries.map((e, i) => <li key={i} data-entry-mode={e.mode} data-entry-recorded={entryRecorded(e) ? "" : undefined}>
        <h4 className="ll8-label">Observation {i + 1} · {MODE_LABEL[e.mode]}</h4>
        {e.mode === "DRAWING" ? <>
          <DrawingPad label={`Drawing for observation ${i + 1}`} onDrew={() => patch(i, { drew: true })} />
          <label className="ll8-check"><input type="checkbox" checked={e.onPaper} onChange={(ev) => patch(i, { onPaper: ev.target.checked })} /> I drew it on paper instead</label>
        </> : data.fields.map((f) => <label key={f.id} className="ll8-field"><span>{f.label}{e.mode === "ORAL_WITH_SCRIBE" ? " (your teacher writes what you say)" : ""}</span>
          <textarea rows={2} value={e.values[f.id] ?? ""} onChange={(ev) => patch(i, { values: { ...e.values, [f.id]: ev.target.value } })} /></label>)}
        {entryRecorded(e) && <p className="ll8-muted" role="status">Recorded. Thank you.</p>}
      </li>)}</ol>
      {entries.length < data.maxEntries
        ? <button type="button" className="ll3-btn" data-primary="" onClick={add}>{entries.length ? "Add another observation" : "Add an observation"}</button>
        : <p className="ll8-muted">That is all {data.maxEntries} observations for this activity.</p>}
      <p className="ll8-muted">Your observations stay on this screen only. They are not saved or sent.</p>
      <p className="ll8-sr" aria-live="polite">{announce}</p>
    </section>
  );
}

/** A plain finger/mouse drawing pad. Pixels live in the canvas only and vanish with the page. */
function DrawingPad({ label, onDrew }: { label: string; onDrew: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null), drawing = useRef(false);
  const at = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 320, ((e.clientY - r.top) / r.height) * 200] as const; };
  const ctx = () => canvas.current?.getContext("2d") ?? null;
  return <div className="ll8-pad">
    <canvas ref={canvas} width={320} height={200} role="img" aria-label={`${label}. Draw with your finger, or tick "I drew it on paper instead".`}
      onPointerDown={(e) => { const c = ctx(); if (!c) return; e.currentTarget.setPointerCapture?.(e.pointerId); drawing.current = true; const [x, y] = at(e); c.lineWidth = 4; c.lineCap = "round"; c.strokeStyle = getComputedStyle(e.currentTarget).color || "#222"; c.beginPath(); c.moveTo(x, y); }}
      onPointerMove={(e) => { const c = ctx(); if (!drawing.current || !c) return; const [x, y] = at(e); c.lineTo(x, y); c.stroke(); onDrew(); }}
      onPointerUp={() => { drawing.current = false; }} onPointerLeave={() => { drawing.current = false; }} />
    <button type="button" className="ll3-btn" onClick={() => { const c = ctx(); c?.clearRect(0, 0, 320, 200); }}>Clear drawing</button>
  </div>;
}

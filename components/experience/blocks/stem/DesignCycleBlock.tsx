"use client";

/**
 * DESIGN_CYCLE (teaching-blocks/1.2.0), K-12 engineering and science. The brief, criteria and constraints stay in view;
 * each design goes Plan -> Stay safe -> Test -> Check and improve, and the next stage opens only when the one before it
 * is done (every safety rule ticked before any test). Results are the learner's own measurements, judged against each
 * criterion with the gap stated; later designs show whether each result moved closer to the target. A plan or a change
 * can be written or shown/told to the teacher, so a learner who cannot type is not blocked. While maxIterations allows,
 * another design can be tested even after one meets every criterion, so two designs can be compared (P6-COMPARE-01);
 * the feedback always describes the design just tested.
 * With a `measurement` link (teaching-blocks/1.3.0 candidate), each fully tested design becomes a row of that table in the
 * same ActivityScope, so designs can be compared (and graphed) side by side. Formative only: everything stays in memory
 * and is not scored, saved or recorded.
 */
import "./stem.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePublishSnapshot, useSnapshot } from "./ActivityScope";
import { canTestAnotherDesign, criterionGoal, cycleStatus, designFeed, designFeedback, emptyIteration, evaluate, improvementReady, judge, linkedColumns, linkedEntryProblem, STAGE_LABEL, STAGES, stageReady, trend, validateDesignCycle,
  type DesignCycleData, type Iteration, type Stage } from "@/lib/learner-experience/stem/designCycle";

type Props = { block: DesignCycleData; onDone?: (blockId: string, done: boolean) => void };
const TREND_TEXT = { CLOSER: "closer to the target than last time", FURTHER: "further from the target than last time", SAME: "the same as last time" } as const;

export function DesignCycleBlock({ block, onDone }: Props) {
  const data = useMemo(() => validateDesignCycle(block), [block]);
  const [iterations, setIterations] = useState<Iteration[]>(() => [emptyIteration(data)]);
  const [stage, setStage] = useState<Stage>("PLAN");
  const [announce, setAnnounce] = useState("");
  const stageHeading = useRef<HTMLHeadingElement>(null);
  const id = `dc-${data.id}`;
  const n = iterations.length, current = iterations[n - 1];
  // A linked criterion's result must obey its table column before it is evaluated (T1-P6-FEED-01).
  const columns = linkedColumns(data, useSnapshot(data.measurement?.tableId ?? ""));
  const evaluated = iterations.map((it) => evaluate(data, it, columns));
  const finished = evaluated.filter((r): r is NonNullable<typeof r> => r !== null);
  const status = cycleStatus(data, finished);
  const currentResults = evaluated[n - 1];
  const previousResults = n > 1 ? evaluated[n - 2] : null;
  const done = status !== "IN_PROGRESS";
  // Capacity, not success, decides whether another design can follow; a met design still offers a comparison.
  const more = canTestAnotherDesign(data, n);
  const currentMetAll = currentResults?.every((r) => r.met) ?? false;
  useEffect(() => { onDone?.(data.id, done); }, [data.id, done, onDone]);
  usePublishSnapshot(data.id, designFeed(data, evaluated));

  const update = (patch: Partial<Iteration>) => setIterations((all) => [...all.slice(0, -1), { ...all[all.length - 1], ...patch }]);
  const go = (next: Stage) => { setStage(next); setAnnounce(`Design ${n}: ${STAGE_LABEL[next]}.`); window.requestAnimationFrame(() => stageHeading.current?.focus()); };
  const nextDesign = () => {
    setIterations((all) => [...all, { ...emptyIteration(data), plan: all[all.length - 1].plan }]);
    setStage("PLAN"); setAnnounce(`Design ${n + 1}: Plan. Your last plan is copied so you can change it.`);
    window.requestAnimationFrame(() => stageHeading.current?.focus());
  };

  return (
    <section className="ll8-block ll8-design" aria-labelledby={`${id}-title`} data-block-type="DESIGN_CYCLE" data-design-iteration={n} data-design-status={status}>
      <h3 id={`${id}-title`} className="ll8-title">Design challenge</h3>
      <p>{data.brief}</p>
      <div className="ll8-design-brief">
        <div><h4 className="ll8-label">Your design must</h4>
          <ul>{data.criteria.map((c) => <li key={c.id}>{c.description} <span className="ll8-muted">· {c.measure}: {criterionGoal(c)}</span></li>)}</ul></div>
        <div><h4 className="ll8-label">Limits</h4><ul>{data.constraints.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
      </div>

      <ol className="ll8-stages" aria-label={`Design ${n} of up to ${data.maxIterations}`}>
        {STAGES.map((s, i) => { const ready = stageReady(data, current, s, columns);
          return <li key={s}><button type="button" className="ll8-stage" aria-current={s === stage ? "step" : undefined} disabled={!ready} onClick={() => go(s)} data-stage={s}>
            <span aria-hidden="true">{i + 1}</span> {STAGE_LABEL[s]}{!ready ? <span className="ll8-sr"> (finish the step before)</span> : null}</button></li>; })}
      </ol>

      <div className="ll8-stagebody" data-stage-body={stage}>
        <h4 ref={stageHeading} tabIndex={-1} className="ll8-label">Design {n}: {STAGE_LABEL[stage]}</h4>
        {stage === "PLAN" && <>
          <label className="ll8-field"><span>Describe your design. What will you build, and why should it meet the criteria?</span>
            <textarea rows={4} value={current.plan} onChange={(e) => update({ plan: e.target.value })} /></label>
          <label className="ll8-check"><input type="checkbox" checked={current.shownToTeacher} onChange={(e) => update({ shownToTeacher: e.target.checked })} /> I drew my design or explained it to my teacher instead</label>
          <button type="button" className="ll3-btn" data-primary="" disabled={!stageReady(data, current, "SAFETY")} onClick={() => go("SAFETY")}>Next: stay safe</button>
        </>}
        {stage === "SAFETY" && <>
          <p className="ll8-muted">Tick each rule when you and your group are ready to follow it.</p>
          <fieldset className="ll8-checks"><legend className="ll8-sr">Safety rules</legend>
            {data.safety.map((rule, i) => <label key={i} className="ll8-check"><input type="checkbox" checked={current.safety[i]} onChange={(e) => update({ safety: current.safety.map((v, j) => (j === i ? e.target.checked : v)) })} /> {rule}</label>)}
          </fieldset>
          <button type="button" className="ll3-btn" data-primary="" disabled={!stageReady(data, current, "TEST")} onClick={() => go("TEST")}>Next: test</button>
        </>}
        {stage === "TEST" && <>
          <h5 className="ll8-label">Test plan</h5>
          <ol className="ll8-testplan">{data.testPlan.map((step, i) => <li key={i}>{step}</li>)}</ol>
          <p className="ll8-muted">Write what you measured. Use your real result, even if it does not meet the target.</p>
          {data.criteria.map((c) => { const raw = current.results[c.id] ?? "", r = judge(c, raw), problem = linkedEntryProblem(c.id, raw, columns);
            const message = raw.trim() === "" ? null : !r ? "Type a number, for example 12 or 12.5." : problem;
            return <label key={c.id} className="ll8-field"><span>{c.measure}{c.unit ? ` (${c.unit})` : ""}</span>
              <input className="ll8-cellinput" inputMode="decimal" autoComplete="off" value={raw} aria-invalid={message ? true : undefined}
                onChange={(e) => update({ results: { ...current.results, [c.id]: e.target.value } })} />
              {message && <span className="ll8-cellerror">{message}</span>}</label>; })}
          <button type="button" className="ll3-btn" data-primary="" disabled={!stageReady(data, current, "EVALUATE", columns)} onClick={() => go("EVALUATE")}>Next: check the results</button>
        </>}
        {stage === "EVALUATE" && currentResults && <>
          <ul className="ll8-results">{currentResults.map((r) => { const c = data.criteria.find((x) => x.id === r.criterionId)!, t = trend(r, previousResults?.find((p) => p.criterionId === r.criterionId));
            return <li key={r.criterionId} data-met={r.met ? "" : undefined}><strong>{c.description}.</strong> {r.message}{t ? ` That is ${TREND_TEXT[t]}.` : ""}</li>; })}</ul>
          <p role="status" className="ll8-feedback" data-design-feedback={status}>{designFeedback(data, evaluated)}</p>
          {data.measurement && <p className="ll8-muted" data-design-recorded="">Design {n}&apos;s results are now row {n} of the measurement table, next to your other designs.</p>}
          {(more || !currentMetAll) && <>
            <label className="ll8-field"><span>{more ? "What will you change for the next design, and why?" : "What would you change next, and why?"}</span>
              <textarea rows={3} value={current.improvement} onChange={(e) => update({ improvement: e.target.value })} /></label>
            <label className="ll8-check"><input type="checkbox" checked={current.improvementTold} onChange={(e) => update({ improvementTold: e.target.checked })} /> I told my teacher my change instead</label>
          </>}
          {more && <button type="button" className="ll3-btn" data-primary="" disabled={!improvementReady(current)} onClick={nextDesign} data-design-next>Test design {n + 1}</button>}
        </>}
      </div>

      {n > 1 && <details className="ll8-history"><summary>Earlier designs ({n - 1})</summary>
        <ol>{evaluated.slice(0, -1).map((res, i) => <li key={i}>Design {i + 1}: {res ? `${res.filter((r) => r.met).length} of ${res.length} criteria met.` : "not tested."}{iterations[i].improvement.trim() ? ` Change: ${iterations[i].improvement.trim()}` : ""}</li>)}</ol>
      </details>}
      <p className="ll8-muted">Your plans and results stay on this screen only. They are not saved or sent.</p>
      <p className="ll8-sr" aria-live="polite">{announce}</p>
    </section>
  );
}

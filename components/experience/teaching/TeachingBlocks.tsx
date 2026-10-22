"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronRight, Lightbulb, RotateCcw, Undo2 } from "lucide-react";
import { InlineText } from "@/components/experience/LessonText";
import { NumberBuilder, PlaceValueChart } from "@/components/experience/demo/PlaceValueTools";
import { PLACES, formatNumber, type PlaceId } from "@/lib/learner-experience/demo/placeValue";
import { checkSequence, checkSort, diagnosePlacement, digitCardsFor, moveItem, placementFeedback } from "@/lib/learner-experience/teaching/checks";
import type { TeachingBlock } from "@/lib/learner-experience/teaching/contract";
import { MathExpression } from "@/components/experience/MathText";
import { AreaModelBlock, ArrayModelBlock, FractionCompareBlock, FractionEquivalenceBlock, FractionModelBlock, FractionNumberLineBlock, MistakeAnalysisBlock, NumericResponseBlock, ShapeModelBlock, WorkedSolutionBlock } from "./v4/MathBlocks";
import { DataPlotBlock, ParticleModelBlock, PredictObserveBlock } from "./v4/ScienceBlocks";
import { MapExplorerBlock, ReadingPassageBlock, SentenceBuilderBlock, SourceEvidenceBlock, WritingOrganizerBlock } from "./v4/HumanitiesLanguageBlocks";

/**
 * Reusable visual learning blocks (Student Experience V3 P1). Each block is keyboard, touch and
 * screen-reader operable, states selection in text (never colour alone), keeps its state on this page only
 * and works offline. Interactive blocks report `onDone(id, done)` so the player can gate Continue; they
 * never score, save, send or mark anything.
 */
export type BlockDone = (blockId: string, done: boolean) => void;

const placeIndex = (place?: PlaceId) => (place ? PLACES.findIndex((candidate) => candidate.id === place) : null);

export function TeachingBlockView({ block, onDone }: { block: TeachingBlock; onDone: BlockDone }) {
  switch (block.type) {
    case "GROUPED_NUMBER": return <GroupedNumber value={block.value} caption={block.caption} />;
    case "PLACE_VALUE_CHART": return <figure className="ll3-figure ll4-figure"><PlaceValueChart value={block.value} highlight={placeIndex(block.highlight)} caption={`Place-value chart for ${formatNumber(block.value)}`} /><figcaption><InlineText text={block.caption} /></figcaption></figure>;
    case "TEN_TIMES": return <TenTimes digit={block.digit} caption={block.caption} />;
    case "NUMBER_BUILDER": return <BuilderBlock start={block.start} presets={block.presets} task={block.task} />;
    case "DIGIT_CARDS": return <DigitCards id={block.id} target={block.target} prompt={block.prompt} onDone={onDone} />;
    case "STEP_REVEAL": return <StepReveal block={block} onDone={onDone} />;
    case "CHOICE_CHECK": return <ChoiceCheck block={block} onDone={onDone} />;
    case "PROCESS_CYCLE": return <ProcessCycle block={block} />;
    case "SORT": return <SortBoard block={block} onDone={onDone} />;
    case "SEQUENCE": return <SequenceLine block={block} onDone={onDone} />;
    case "CALLOUT": return <aside className="ll4-callout" data-tone={block.tone}>
      <p className="ll4-callout-title">{block.tone === "MISTAKE" ? <AlertTriangle size={18} aria-hidden="true" /> : <Lightbulb size={18} aria-hidden="true" />} {block.title}</p>
      <p><InlineText text={block.text} /></p>
    </aside>;
    // Interactive Learning V4 blocks (one registry for every subject).
    case "CHECK": return <ChoiceCheck block={{ type: "CHOICE_CHECK", id: block.id, items: block.items.map((item) => {
      const correctIndex = item.options.findIndex((option) => option.id === item.formativeKey.expectedOptionId);
      return { id: item.id, prompt: item.prompt, options: item.options.map((option) => option.text), correctIndex, feedback: { correct: item.options[correctIndex].feedback, incorrect: "Look again." }, optionFeedback: item.options.map((option) => option.feedback), hint: item.hint };
    }) }} onDone={onDone} />;
    case "EQUATION": return <figure className="ll5-equation"><MathExpression tex={block.tex} display />{block.caption && <figcaption><InlineText text={block.caption} /></figcaption>}</figure>;
    case "WORKED_SOLUTION": return <WorkedSolutionBlock block={block} onDone={onDone} />;
    case "NUMERIC_RESPONSE": return <NumericResponseBlock block={block} onDone={onDone} />;
    case "MISTAKE_ANALYSIS": return <MistakeAnalysisBlock block={block} onDone={onDone} />;
    case "SHAPE_MODEL": return <ShapeModelBlock block={block} />;
    case "FRACTION_MODEL": return <FractionModelBlock block={block} onDone={onDone} />;
    case "FRACTION_EQUIVALENCE": return <FractionEquivalenceBlock block={block} />;
    case "FRACTION_NUMBER_LINE": return <FractionNumberLineBlock block={block} onDone={onDone} />;
    case "FRACTION_COMPARE": return <FractionCompareBlock block={block} onDone={onDone} />;
    case "ARRAY_MODEL": return <ArrayModelBlock block={block} />;
    case "AREA_MODEL": return <AreaModelBlock block={block} onDone={onDone} />;
    case "PARTICLE_MODEL": return <ParticleModelBlock block={block} />;
    case "PREDICT_OBSERVE": return <PredictObserveBlock block={block} onDone={onDone} />;
    case "DATA_PLOT": return <DataPlotBlock block={block} />;
    case "MAP_EXPLORER": return <MapExplorerBlock block={block} onDone={onDone} />;
    case "SOURCE_EVIDENCE": return <SourceEvidenceBlock block={block} onDone={onDone} />;
    case "READING_PASSAGE": return <ReadingPassageBlock block={block} />;
    case "SENTENCE_BUILDER": return <SentenceBuilderBlock block={block} onDone={onDone} />;
    case "WRITING_ORGANIZER": return <WritingOrganizerBlock block={block} onDone={onDone} />;
  }
}

export function GroupedNumber({ value, caption }: { value: number; caption: string }) {
  const text = formatNumber(value);
  const groups = text.split(",");
  const names = ["ones", "thousands", "millions"].slice(0, groups.length).reverse();
  return <figure className="ll3-figure ll4-figure">
    <p className="ll3-support-label">One number, {groups.length} groups</p>
    <p className="sr-only">{text}: {groups.map((group, index) => `${group} ${names[index]}`).join(", ")}.</p>
    <div className="ll4-groups" aria-hidden="true">{groups.map((group, index) => <div key={index} data-group={names[index]}><span>{group}</span><span>{names[index]}</span></div>)}</div>
    <figcaption><InlineText text={caption} /></figcaption>
  </figure>;
}

/** The same digit moved one place left at a time; every move multiplies its value by ten. */
export function TenTimes({ digit, caption }: { digit: number; caption: string }) {
  const [shift, setShift] = useState(0);
  const max = PLACES.length - 1;
  const rows = Array.from({ length: shift + 1 }, (_, step) => ({ place: PLACES[max - step], value: digit * PLACES[max - step].value }));
  return <figure className="ll3-figure ll4-figure ll4-tentimes">
    <p className="ll3-support-label">Ten times more, each place</p>
    <ol className="ll4-tentimes-rows" aria-label={caption}>
      {rows.map((row, index) => <li key={row.place.id} data-current={index === shift ? "" : undefined}>
        <span className="ll4-tentimes-place">{row.place.name}</span>
        <span className="ll4-tentimes-value">{formatNumber(row.value)}</span>
        {index > 0 && <span className="ll4-tentimes-times" aria-label="ten times the place before">×10</span>}
      </li>)}
    </ol>
    <p className="sr-only" aria-live="polite">The {digit} is in the {rows[shift].place.name} place. It is worth {formatNumber(rows[shift].value)}.</p>
    <div className="ll4-row">
      <button type="button" className="ll3-btn" data-primary="" onClick={() => setShift((current) => Math.min(max, current + 1))} disabled={shift === max}>Move the {digit} one place left <ChevronRight size={18} aria-hidden="true" /></button>
      <button type="button" className="ll3-btn" onClick={() => setShift(0)} disabled={shift === 0}><RotateCcw size={16} aria-hidden="true" /> Start again</button>
    </div>
    <figcaption><InlineText text={caption} /></figcaption>
  </figure>;
}

function BuilderBlock({ start, presets, task }: { start: number; presets: readonly number[]; task?: string }) {
  const [value, setValue] = useState(start);
  return <div className="ll4-builder">
    <figure className="ll3-figure ll4-figure"><PlaceValueChart value={value} caption={`Place-value chart for ${formatNumber(value)}`} /><figcaption>The chart shows the value of every digit in the number you build.</figcaption></figure>
    <NumberBuilder value={value} onChange={setValue} presets={presets} />
    {task && <div className="ll3-task"><p className="ll3-task-label">Try this</p><p className="text-lg"><InlineText text={task} /></p></div>}
    <p className="ll3-small ll3-muted">Exploring is not marked. Your number stays only on this page.</p>
  </div>;
}

/** Whole-number digit cards: choose a card, then the place it belongs in. Feedback names the misconception. */
export function DigitCards({ id, target, prompt, onDone }: { id: string; target: number; prompt: string; onDone: BlockDone }) {
  const cards = useMemo(() => digitCardsFor(target), [target]);
  const [slots, setSlots] = useState<(number | null)[]>(() => PLACES.map(() => null)); // card index per place
  const [selected, setSelected] = useState<number | null>(null);
  const used = new Set(slots.filter((slot): slot is number => slot !== null));
  const placedDigits = slots.map((slot) => (slot === null ? null : cards[slot]));
  const diagnosis = diagnosePlacement(target, placedDigits);
  const feedback = placementFeedback(target, diagnosis);
  useEffect(() => { onDone(id, diagnosis.kind === "CORRECT"); }, [id, diagnosis.kind, onDone]);
  const place = (slotIndex: number) => {
    if (slots[slotIndex] !== null) { setSlots((current) => current.map((slot, index) => (index === slotIndex ? null : slot))); return; }
    if (selected === null) return;
    setSlots((current) => current.map((slot, index) => (index === slotIndex ? selected : slot)));
    setSelected(null);
  };
  const promptId = useId();
  return <div className="ll4-cards" data-digit-cards={id} aria-describedby={promptId}>
    <p id={promptId} className="sr-only">{prompt} Choose a digit card, then choose a place. Choose a filled place to take its card back.</p>
    <div role="group" aria-label="Digit cards" className="ll4-card-tray">
      {cards.map((digit, index) => <button key={index} type="button" className="ll4-digit-card" aria-pressed={selected === index} disabled={used.has(index)} onClick={() => setSelected((current) => (current === index ? null : index))}
        aria-label={used.has(index) ? `Card ${digit}, already placed` : `Card ${digit}${selected === index ? ", chosen" : ""}`}>{digit}</button>)}
    </div>
    <div role="group" aria-label="Places, millions to ones" className="ll4-slots">
      {PLACES.map((candidate, index) => {
        const digit = placedDigits[index];
        return <button key={candidate.id} type="button" className="ll4-slot" data-filled={digit !== null ? "" : undefined} data-group={candidate.group} onClick={() => place(index)} disabled={digit === null && selected === null}
          aria-label={digit === null ? `${candidate.name} place, empty${selected !== null ? `. Place card ${cards[selected]} here` : ""}` : `${candidate.name} place holds ${digit}. Take it back`}>
          <span className="ll4-slot-name" aria-hidden="true">{candidate.name}</span>
          <span className="ll4-slot-digit" aria-hidden="true">{digit ?? ""}</span>
        </button>;
      })}
    </div>
    <p className="ll4-cards-status" aria-hidden="true">{selected !== null ? `Card ${cards[selected]} chosen: now choose its place.` : diagnosis.kind === "INCOMPLETE" ? "Choose a card." : ""}</p>
    <p role="status" className={diagnosis.kind === "INCOMPLETE" ? "ll3-small ll3-muted" : "ll3-feedback"} data-result={feedback.result === "pending" ? undefined : feedback.result}>
      {feedback.result === "right" ? <><strong>Correct.</strong> {feedback.text}</> : feedback.result === "retry" ? <><strong>Not yet.</strong> {feedback.text} Choose a place to take its card back.</> : feedback.text}
    </p>
    <div className="ll4-row"><button type="button" className="ll3-btn" onClick={() => { setSlots(PLACES.map(() => null)); setSelected(null); }}><RotateCcw size={16} aria-hidden="true" /> Clear the places</button></div>
  </div>;
}

/** Worked example: authored steps one at a time; the chart follows the step that is being explained. */
export function StepReveal({ block, onDone }: { block: Extract<TeachingBlock, { type: "STEP_REVEAL" }>; onDone: BlockDone }) {
  const [shown, setShown] = useState(0);
  const total = block.steps.length;
  useEffect(() => { onDone(block.id, shown >= total); }, [block.id, shown, total, onDone]);
  const latest = shown > 0 ? block.steps[shown - 1] : null;
  return <div className="ll4-steps" data-step-reveal={block.id}>
    {block.chartValue !== undefined && <figure className="ll3-figure ll4-figure"><PlaceValueChart value={block.chartValue} highlight={placeIndex(latest?.highlight)} caption={`Place-value chart for ${formatNumber(block.chartValue)}`} />
      <figcaption>{latest?.highlight ? `The ${PLACES[placeIndex(latest.highlight)!].name} place is marked.` : "Show the steps to follow the example in the chart."}</figcaption></figure>}
    <div className="ll3-example">
      <p className="ll3-example-label"><Lightbulb size={18} aria-hidden="true" /> Step by step · {shown} of {total} shown</p>
      <p className="text-lg font-semibold"><InlineText text={block.question} /></p>
      {shown > 0 && <ol className="ll3-steps">{block.steps.slice(0, shown).map((step, index) => <li key={index} data-latest={index === shown - 1 ? "" : undefined}><span><InlineText text={step.text} /></span></li>)}</ol>}
      <div aria-live="polite" className="sr-only">{latest ? `Step ${shown}: ${latest.text.replace(/\*\*/g, "")}` : ""}</div>
      {shown < total
        ? <div className="ll4-row"><button type="button" className="ll3-btn" data-primary="" onClick={() => setShown((current) => current + 1)}>Show step {shown + 1} of {total}</button></div>
        : <p className="flex items-center gap-2 font-semibold text-[var(--ll-success)]"><Check size={18} aria-hidden="true" /> All steps shown</p>}
    </div>
  </div>;
}

/** Formative questions: instant on-device feedback per option, an optional authored hint, retry allowed. */
export function ChoiceCheck({ block, onDone }: { block: Extract<TeachingBlock, { type: "CHOICE_CHECK" }>; onDone: BlockDone }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [hints, setHints] = useState<Record<string, boolean>>({});
  const answeredAll = block.items.every((item) => answers[item.id] !== undefined);
  useEffect(() => { onDone(block.id, answeredAll); }, [block.id, answeredAll, onDone]);
  return <div className="ll4-checks" data-choice-check={block.id}>
    {block.items.map((item, itemIndex) => {
      const chosen = answers[item.id];
      const answered = chosen !== undefined;
      const right = chosen === item.correctIndex;
      return <fieldset key={item.id} className="ll3-panel ll4-question" data-practice={item.id}>
        <legend className="sr-only">Question {itemIndex + 1}: <InlineText text={item.prompt} /></legend>
        <p aria-hidden="true" className="ll4-question-prompt"><span className="ll4-question-num">{itemIndex + 1}</span><span><InlineText text={item.prompt} /></span></p>
        <div className="ll4-options">{item.options.map((option, optionIndex) => <label key={option} className="ll3-choice" data-selected={chosen === optionIndex ? "" : undefined} data-verdict={chosen === optionIndex ? (right ? "right" : "retry") : undefined}>
          <input type="radio" name={`${block.id}-${item.id}`} checked={chosen === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [item.id]: optionIndex }))} />
          <span className="ll4-option-letter" aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span>
          <span><InlineText text={option} /></span>
        </label>)}</div>
        {item.hint && !answered && (hints[item.id]
          ? <p className="ll4-hint"><Lightbulb size={16} aria-hidden="true" /> <InlineText text={item.hint} /></p>
          : <div><button type="button" className="ll4-link-btn" onClick={() => setHints((current) => ({ ...current, [item.id]: true }))}>Show a hint</button></div>)}
        <p role="status" className={answered ? "ll3-feedback" : "sr-only"} data-result={answered ? (right ? "right" : "retry") : undefined}>
          {!answered ? "" : right ? <><strong>Correct.</strong> <InlineText text={item.optionFeedback?.[chosen] ?? item.feedback.correct} /></> : <><strong>Not yet.</strong> <InlineText text={item.optionFeedback?.[chosen] ?? item.feedback.incorrect} /> Try another answer.</>}
        </p>
      </fieldset>;
    })}
    <p className="ll3-small ll3-muted">Checked on this device. Answers are not sent, saved or marked.</p>
  </div>;
}

/** A cycle diagram: stages placed round a loop with arrows; each stage is a button that opens its explanation. */
export function ProcessCycle({ block }: { block: Extract<TeachingBlock, { type: "PROCESS_CYCLE" }> }) {
  const [current, setCurrent] = useState(0);
  const [visited, setVisited] = useState<Set<string>>(() => new Set([block.stages[0].id]));
  const choose = (index: number) => { setCurrent(index); setVisited((set) => new Set(set).add(block.stages[index].id)); };
  const count = block.stages.length;
  const stage = block.stages[current];
  const panelId = useId();
  // Positions round the loop (clockwise from the top), in percent of the square diagram.
  const at = (index: number) => { const angle = (-90 + (360 / count) * index) * (Math.PI / 180); return { x: 50 + 38 * Math.cos(angle), y: 50 + 38 * Math.sin(angle) }; };
  return <figure className="ll3-figure ll4-figure ll4-cycle" data-process-cycle={block.id}>
    <p className="ll3-support-label">{block.title} · {visited.size} of {count} stages opened</p>
    <div className="ll4-cycle-stage">
      <div className="ll4-cycle-ring">
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <defs><marker id={`${block.id}-arrow`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" /></marker></defs>
          {block.stages.map((_, index) => {
            const from = at(index), to = at((index + 1) % count);
            const mid = { x: 50 + 46 * Math.cos(((-90 + (360 / count) * (index + 0.5)) * Math.PI) / 180), y: 50 + 46 * Math.sin(((-90 + (360 / count) * (index + 0.5)) * Math.PI) / 180) };
            return <path key={index} d={`M${from.x},${from.y} Q${mid.x},${mid.y} ${to.x},${to.y}`} fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2.5 2" markerEnd={`url(#${block.id}-arrow)`} className="ll4-cycle-arrow" pathLength={100} />;
          })}
        </svg>
        <ol className="ll4-cycle-nodes" aria-label={`${block.title}, ${count} stages in order`}>
          {block.stages.map((candidate, index) => {
            const point = at(index);
            return <li key={candidate.id} style={{ left: `${point.x}%`, top: `${point.y}%` }}>
              <button type="button" className="ll4-cycle-node" aria-pressed={index === current} aria-controls={panelId} data-visited={visited.has(candidate.id) ? "" : undefined} onClick={() => choose(index)}>
                <span className="ll4-cycle-num" aria-hidden="true">{index + 1}</span>{candidate.label}{visited.has(candidate.id) && index !== current && <span className="sr-only"> (opened)</span>}
              </button>
            </li>;
          })}
        </ol>
      </div>
      <div id={panelId} className="ll4-cycle-detail" aria-live="polite">
        <p className="ll4-cycle-detail-kind">Stage {current + 1} of {count}</p>
        <p className="ll4-cycle-detail-title">{stage.label}</p>
        <p><InlineText text={stage.detail} /></p>
        <button type="button" className="ll3-btn" data-primary="" onClick={() => choose((current + 1) % count)}>Next stage: {block.stages[(current + 1) % count].label} <ChevronRight size={18} aria-hidden="true" /></button>
      </div>
    </div>
  </figure>;
}

/** Sort words (or any cards) into groups: choose a card, then a group. Wrong placements explain themselves. */
export function SortBoard({ block, onDone }: { block: Extract<TeachingBlock, { type: "SORT" }>; onDone: BlockDone }) {
  const [placed, setPlaced] = useState<Record<string, string | undefined>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const result = checkSort(block.cards, placed);
  useEffect(() => { onDone(block.id, result.allCorrect); }, [block.id, result.allCorrect, onDone]);
  const tray = block.cards.filter((card) => !placed[card.id]);
  const selectedCard = block.cards.find((card) => card.id === selected) ?? null;
  const [said, setSaid] = useState("");
  const put = (group: string) => {
    if (!selectedCard) return;
    setPlaced((current) => ({ ...current, [selectedCard.id]: group }));
    const label = block.groups.find((candidate) => candidate.id === group)?.label.toLowerCase() ?? group;
    setSaid(group === selectedCard.group ? `Correct. ${selectedCard.why}` : `Not yet. “${selectedCard.text}” is not a ${label} here. Choose it to take it back.`);
    setSelected(null);
  };
  return <div className="ll4-sort" data-sort={block.id}>
    <p className="ll4-sort-sentence"><InlineText text={block.prompt} /></p>
    <div role="group" aria-label="Words to sort" className="ll4-card-tray">
      {tray.length === 0 ? <p className="ll3-small ll3-muted">All words are placed.</p> : tray.map((card) => <button key={card.id} type="button" className="ll4-word-card" aria-pressed={selected === card.id} onClick={() => setSelected((current) => (current === card.id ? null : card.id))}>{card.text}</button>)}
    </div>
    <div className="ll4-bins">
      {block.groups.map((group) => <section key={group.id} className="ll4-bin" aria-label={group.label}>
        <button type="button" className="ll3-btn ll4-bin-target" disabled={!selectedCard} onClick={() => put(group.id)}>{selectedCard ? `Put “${selectedCard.text}” in ${group.label}` : group.label}</button>
        <ul className="ll4-bin-items">{block.cards.filter((card) => placed[card.id] === group.id).map((card) => {
          const right = card.group === group.id;
          return <li key={card.id}><button type="button" className="ll4-word-card" data-verdict={right ? "right" : "retry"} onClick={() => setPlaced((current) => ({ ...current, [card.id]: undefined }))}
            aria-label={`${card.text}: ${right ? "correct" : "not yet"}. Take it back`}>{right ? <Check size={16} aria-hidden="true" /> : <Undo2 size={16} aria-hidden="true" />}{card.text}</button></li>;
        })}</ul>
      </section>)}
    </div>
    <p role="status" className={said ? "ll3-feedback" : "sr-only"} data-result={said ? (said.startsWith("Correct") ? "right" : "retry") : undefined}>{said ? <><strong>{said.split(".")[0]}.</strong>{said.slice(said.indexOf(".") + 1)}</> : ""}</p>
    {result.allCorrect && <p className="ll3-feedback" data-result="right"><strong>All sorted.</strong> Every word is in the group that matches its job.</p>}
  </div>;
}

/** Ordering with Move up / Move down (no drag needed), then a timeline once the order is right. */
export function SequenceLine({ block, onDone }: { block: Extract<TeachingBlock, { type: "SEQUENCE" }>; onDone: BlockDone }) {
  const authored = block.events.map((event) => event.id);
  const [order, setOrder] = useState<string[]>(() => { const start = [...authored].reverse(); if (start.length > 2) [start[0], start[1]] = [start[1], start[0]]; return start; });
  const [checked, setChecked] = useState<ReturnType<typeof checkSequence> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const correct = checked?.correct ?? false;
  useEffect(() => { onDone(block.id, correct); }, [block.id, correct, onDone]);
  const byId = Object.fromEntries(block.events.map((event) => [event.id, event]));
  const move = (index: number, delta: -1 | 1) => { setOrder((current) => moveItem(current, index, delta)); setChecked(null); };
  const years = block.events.map((event) => Number(event.marker));
  const numeric = years.every(Number.isFinite);
  const positions = timelinePositions(numeric ? years : block.events.map((_, index) => index));
  return <div className="ll4-sequence" data-sequence={block.id}>
    {!correct && <>
      <ol className="ll4-order" aria-label={block.prompt}>
        {order.map((id, index) => <li key={id} data-wrong={checked && checked.firstWrong === index ? "" : undefined}>
          <span className="ll4-order-pos" aria-hidden="true">{index + 1}</span>
          <span className="ll4-order-text"><span className="ll4-order-marker">{byId[id].marker}</span> {byId[id].label}</span>
          <span className="ll4-order-moves">
            <button type="button" className="ll4-icon-btn" aria-label={`Move “${byId[id].label}” up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={18} aria-hidden="true" /></button>
            <button type="button" className="ll4-icon-btn" aria-label={`Move “${byId[id].label}” down`} disabled={index === order.length - 1} onClick={() => move(index, 1)}><ArrowDown size={18} aria-hidden="true" /></button>
          </span>
        </li>)}
      </ol>
      <div className="ll4-row"><button type="button" className="ll3-btn" data-primary="" onClick={() => setChecked(checkSequence(authored, order))}>Check the order</button></div>
    </>}
    <p role="status" className={checked ? "ll3-feedback" : "sr-only"} data-result={checked ? (correct ? "right" : "retry") : undefined}>
      {!checked ? "" : correct ? <><strong>Correct.</strong> The events are in time order, earliest first.</> : <><strong>Not yet.</strong> {checked.inPlace} of {authored.length} are in the right place. Look again at position {checked.firstWrong + 1}: compare its year with the one above it.</>}
    </p>
    {correct && <figure className="ll3-figure ll4-figure ll4-timeline-figure">
      <p className="ll3-support-label">Timeline</p>
      <ol className="ll4-timeline" aria-label="Timeline, earliest first">
        {block.events.map((event, index) => <li key={event.id} style={{ ["--at" as string]: `${positions[index]}%` }}>
          <button type="button" className="ll4-timeline-dot" aria-pressed={selected === event.id} onClick={() => setSelected((current) => (current === event.id ? null : event.id))}><span className="ll4-timeline-year">{event.marker}</span><span className="ll4-timeline-label">{event.label}</span></button>
        </li>)}
      </ol>
      <p className="ll4-timeline-detail" aria-live="polite">{selected ? <InlineText text={byId[selected].detail} /> : "Choose an event on the timeline to read more."}</p>
    </figure>}
  </div>;
}

/**
 * Timeline positions (0–100%) roughly to scale, so gaps still show how much time passed, but never closer
 * than `minGap` so labels do not overlap.
 */
export function timelinePositions(values: readonly number[], minGap = 22): number[] {
  if (values.length < 2) return values.map(() => 0);
  const low = Math.min(...values), span = Math.max(...values) - low || 1;
  const spaced: number[] = [];
  values.forEach((value, index) => { const scaled = ((value - low) / span) * 100; spaced.push(index === 0 ? scaled : Math.max(scaled, spaced[index - 1] + minGap)); });
  const last = spaced[spaced.length - 1];
  return last > 100 ? spaced.map((position) => (position / last) * 100) : spaced;
}

"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { BookOpen, Compass, RotateCcw, Undo2 } from "lucide-react";
import { InlineText } from "@/components/experience/LessonText";
import { ReadAloud } from "@/components/experience/teaching/ReadAloud";
import { LIBERIA_COUNTIES, NEIGHBOUR_LABEL, REGION_LABEL, countyById, directionBetween, type County } from "@/lib/learner-experience/teaching/models/liberiaCounties";
import type { BlockOf } from "@/lib/learner-experience/teaching/registry";
import { BlockFrame, Feedback, readDraft, useBlockLesson, useReportDone, writeDraft, type BlockDone } from "./shared";

// ── Map explorer ───────────────────────────────────────────────────────────

// Tile labels with soft hyphens (\u00ad) so long names break only between syllables on narrow tiles.
const SHORT: Record<string, string> = { "grand-cape-mount": "G. Cape Mount", "grand-bassa": "G. Bassa", "grand-gedeh": "G. Gedeh", "grand-kru": "G. Kru", "river-cess": "River Cess", "river-gee": "River Gee", montserrado: "Mont\u00adser\u00adrado", gbarpolu: "Gbar\u00adpolu", margibi: "Mar\u00adgibi", maryland: "Mary\u00adland", nimba: "Nimba" };

function CountyDetail({ county }: { county: County }) {
  return <div className="ll5-county-detail" aria-live="polite">
    <p className="ll5-block-title">{county.name} County</p>
    <dl className="ll5-readout">
      <div><dt>Capital</dt><dd>{county.capital}</dd></div>
      <div><dt>Part of Liberia</dt><dd>{REGION_LABEL[county.region]}</dd></div>
      {county.borders.length > 0 && <div><dt>Borders</dt><dd>{county.borders.map((border) => NEIGHBOUR_LABEL[border]).join(", ")}</dd></div>}
    </dl>
    {county.note && !county.note.includes("reviewCheck") && <p className="ll3-small">{county.note}</p>}
  </div>;
}

export function MapExplorerBlock({ block, onDone }: { block: BlockOf<"MAP_EXPLORER">; onDone: BlockDone }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<string | null>(null);
  const tiles = useRef<Record<string, HTMLButtonElement | null>>({});
  const task = block.task;
  const right = Boolean(task && checked === task.formativeKey.regionId);
  useReportDone(block.id, right, onDone);
  const county = selected ? countyById(selected) : null;
  const move = (event: KeyboardEvent<HTMLButtonElement>, from: County) => {
    const deltas: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    // The nearest county in that direction (tiles are sparse, so search a cone, not one cell).
    const candidates = LIBERIA_COUNTIES.filter((other) => other !== from && (delta[0] ? Math.sign(other.tile.col - from.tile.col) === delta[0] : Math.sign(other.tile.row - from.tile.row) === delta[1]));
    const next = candidates.sort((a, b) => (Math.abs(a.tile.col - from.tile.col) + Math.abs(a.tile.row - from.tile.row) * (delta[0] ? 2 : 0.5) + (delta[0] ? 0 : Math.abs(a.tile.col - from.tile.col))) - (Math.abs(b.tile.col - from.tile.col) + Math.abs(b.tile.row - from.tile.row) * (delta[0] ? 2 : 0.5) + (delta[0] ? 0 : Math.abs(b.tile.col - from.tile.col))))[0];
    if (next) tiles.current[next.id]?.focus();
  };
  const chosen = checked ? countyById(checked) : null;
  const target = task ? countyById(task.formativeKey.regionId) : null;
  const feedback = !task || !chosen ? null : right ? task.success : `You chose ${chosen.name} (capital ${chosen.capital}). The county you need is ${directionBetween(chosen.id, target!.id) ?? "near"} of ${chosen.name} on the map.`;
  return <BlockFrame label={task ? "Map task" : "Map explorer"} title={task?.prompt} className="ll5-map" data={{ "data-map-explorer": block.id }}>
    <div className="ll5-map-layout">
      <div className="ll5-map-frame">
        <p className="ll5-map-edge" data-edge="north"><Compass size={14} aria-hidden="true" /> North: Guinea</p>
        <p className="ll5-map-edge" data-edge="west">West: Sierra Leone</p>
        <p className="ll5-map-edge" data-edge="east">East: Côte d&apos;Ivoire</p>
        <div className="ll5-map-grid" role="group" aria-label="Schematic map of Liberia's 15 counties. Each square is one county placed near its real position; borders and distances are not shown.">
          {LIBERIA_COUNTIES.map((candidate) => <button key={candidate.id} ref={(node) => { tiles.current[candidate.id] = node; }} type="button" className="ll5-county" style={{ gridColumn: candidate.tile.col + 1, gridRow: candidate.tile.row + 1 }}
            aria-pressed={selected === candidate.id} data-coast={candidate.coast ? "" : undefined} data-result={checked === candidate.id ? (right ? "right" : "retry") : undefined}
            aria-label={`${candidate.name} County${task ? "" : `, capital ${candidate.capital}`}`} onKeyDown={(event) => move(event, candidate)}
            onClick={() => { setSelected(candidate.id); if (!right) setChecked(null); }}>
            <span>{SHORT[candidate.id] ?? candidate.name}</span>
          </button>)}
        </div>
        <p className="ll5-map-edge" data-edge="south">South-west: Atlantic Ocean (coast)</p>
      </div>
      <div className="ll5-map-side">
        {county ? <CountyDetail county={county} /> : <p className="ll3-muted">Choose a county on the map.</p>}
        {task && <div className="ll4-row"><button type="button" className="ll3-btn" data-primary="" disabled={!selected || right} onClick={() => setChecked(selected)}>{selected ? `Answer: ${countyById(selected)!.name}` : "Choose a county"}</button></div>}
        {feedback && <Feedback result={right ? "right" : "retry"}>{feedback}</Feedback>}
      </div>
    </div>
    <details className="ll5-plot-table"><summary>All counties as a list</summary>
      <ul className="ll5-county-list">{LIBERIA_COUNTIES.map((candidate) => <li key={candidate.id}><button type="button" className="ll4-link-btn" onClick={() => { setSelected(candidate.id); if (!right) setChecked(null); }}>{candidate.name}</button>{task ? "" : ` — ${candidate.capital}`}</li>)}</ul>
    </details>
    <p className="ll3-small ll3-muted">Schematic map: one square per county, placed near its real position. It does not show borders, sizes or distances.</p>
  </BlockFrame>;
}

// ── Source evidence ────────────────────────────────────────────────────────

export function SourceEvidenceBlock({ block, onDone }: { block: BlockOf<"SOURCE_EVIDENCE">; onDone: BlockDone }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);
  const wrong = block.sentences.filter((sentence) => picked.has(sentence.id) && !sentence.supports);
  const goodCount = block.sentences.filter((sentence) => picked.has(sentence.id) && sentence.supports).length;
  const right = checked && wrong.length === 0 && goodCount >= block.minSelect;
  useReportDone(block.id, right, onDone);
  const toggle = (id: string) => { setChecked(false); setPicked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  return <BlockFrame label="Find the evidence" title={block.question} className="ll5-evidence" data={{ "data-source-evidence": block.id }}>
    <div className="ll5-source">
      <p className="ll5-source-title"><BookOpen size={16} aria-hidden="true" /> {block.source.title}</p>
      <div role="group" aria-label={`Sentences from ${block.source.title}. Select the ones that answer the question.`} className="ll5-sentences">
        {block.sentences.map((sentence) => <button key={sentence.id} type="button" className="ll5-sentence" aria-pressed={picked.has(sentence.id)}
          data-result={checked && picked.has(sentence.id) ? (sentence.supports ? "right" : "retry") : undefined} onClick={() => toggle(sentence.id)}>
          <InlineText text={sentence.text} />
        </button>)}
      </div>
      <p className="ll3-small ll3-muted">Source: {block.source.origin.attribution} ({block.source.origin.license}).</p>
    </div>
    <div className="ll4-row"><button type="button" className="ll3-btn" data-primary="" disabled={picked.size === 0 || right} onClick={() => setChecked(true)}>Check my evidence</button>
      <span className="ll3-small ll3-muted">{picked.size} selected · choose at least {block.minSelect}</span></div>
    {checked && <div className="ll5-evidence-feedback">
      <Feedback result={right ? "right" : "retry"}>{right ? "Every sentence you chose supports the answer." : wrong.length ? `${wrong.length} of your sentences ${wrong.length === 1 ? "does" : "do"} not answer the question.` : `Find ${block.minSelect - goodCount} more ${block.minSelect - goodCount === 1 ? "sentence" : "sentences"} that answer the question.`}</Feedback>
      <ul className="ll5-reasons">{block.sentences.filter((sentence) => picked.has(sentence.id)).map((sentence) => <li key={sentence.id} data-result={sentence.supports ? "right" : "retry"}><strong>{sentence.supports ? "Supports:" : "Does not:"}</strong> <InlineText text={sentence.why} /></li>)}</ul>
    </div>}
  </BlockFrame>;
}

// ── Reading ────────────────────────────────────────────────────────────────

/** A paragraph whose glossary words (first use of each) open their meaning in place. */
function GlossedParagraph({ text, glossary }: { text: string; glossary: BlockOf<"READING_PASSAGE">["glossary"] }) {
  const [open, setOpen] = useState<string | null>(null);
  const pieces: ({ text: string } | { term: string; word: string; meaning: string })[] = [];
  const used = new Set<string>();
  let rest = text;
  for (;;) {
    const remaining = glossary.filter((entry) => !used.has(entry.term.toLowerCase()));
    if (!remaining.length) break;
    const pattern = new RegExp(`\\b(${remaining.map((entry) => entry.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");
    const match = pattern.exec(rest);
    if (!match) break;
    const entry = remaining.find((candidate) => candidate.term.toLowerCase() === match[1].toLowerCase())!;
    used.add(entry.term.toLowerCase());
    pieces.push({ text: rest.slice(0, match.index) }, { term: entry.term, word: match[1], meaning: entry.meaning });
    rest = rest.slice(match.index + match[1].length);
  }
  pieces.push({ text: rest });
  return <p>{pieces.map((piece, index) => "term" in piece
    ? <span key={index}><button type="button" className="ll5-gloss" aria-expanded={open === piece.term} onClick={() => setOpen((current) => (current === piece.term ? null : piece.term))}>{piece.word}</button>
      {open === piece.term && <span className="ll5-gloss-meaning" role="note"> ({piece.meaning}) </span>}</span>
    : <InlineText key={index} text={piece.text} />)}</p>;
}

export function ReadingPassageBlock({ block }: { block: BlockOf<"READING_PASSAGE"> }) {
  return <article className="ll5-passage" data-reading-passage={block.id} aria-labelledby={`${block.id}-title`}>
    <header className="ll5-passage-head">
      <h2 id={`${block.id}-title`} className="ll5-passage-title">{block.title}</h2>
      <ReadAloud text={`${block.title}. ${block.paragraphs.join(" ")}`} sceneId={block.id} />
    </header>
    <div className="ll5-passage-body">{block.paragraphs.map((paragraph, index) => <GlossedParagraph key={index} text={paragraph} glossary={block.glossary} />)}</div>
    {block.glossary.length > 0 && <p className="ll3-small ll3-muted">Words with a dotted underline open their meaning in this story.</p>}
    <p className="ll3-small ll3-muted">{block.origin.attribution}.</p>
  </article>;
}

// ── Sentence builder ───────────────────────────────────────────────────────

export function SentenceBuilderBlock({ block, onDone }: { block: BlockOf<"SENTENCE_BUILDER">; onDone: BlockDone }) {
  const [line, setLine] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const words = line.map((index) => block.tiles[index]);
  const right = checked && block.formativeKey.orders.some((order) => order.join(" ") === words.join(" "));
  useReportDone(block.id, right, onDone);
  const firstOrder = block.formativeKey.orders[0];
  const feedback = !checked ? null : right ? `"${words.join(" ")}."` : words.length < block.tiles.length ? "Use every tile in your sentence."
    : words[0] !== firstOrder[0] && /^[A-Z]/.test(firstOrder[0]) ? `A sentence starts with a capital letter. Which tile begins with one?` : block.hint ?? "Not yet. Start with who did what, then give the reason.";
  return <BlockFrame label="Build the sentence" title={block.prompt} className="ll5-builder" data={{ "data-sentence-builder": block.id }}>
    <div className="ll5-sentence-line" aria-live="polite" aria-label="Your sentence">
      {line.length === 0 ? <span className="ll3-muted">Choose tiles below in order.</span> : line.map((index, position) => <button key={`${index}-${position}`} type="button" className="ll4-word-card" disabled={right} aria-label={`${block.tiles[index]}, remove`} onClick={() => { setChecked(false); setLine((current) => current.filter((_, at) => at !== position)); }}>{block.tiles[index]}</button>)}
    </div>
    <div className="ll5-tile-bank" role="group" aria-label="Word tiles">
      {block.tiles.map((tile, index) => <button key={index} type="button" className="ll4-word-card" disabled={line.includes(index) || right} onClick={() => { setChecked(false); setLine((current) => [...current, index]); }}>{tile}</button>)}
    </div>
    <div className="ll4-row">
      <button type="button" className="ll3-btn" data-primary="" disabled={line.length === 0 || right} onClick={() => setChecked(true)}>Check my sentence</button>
      <button type="button" className="ll3-btn" disabled={line.length === 0 || right} onClick={() => { setChecked(false); setLine((current) => current.slice(0, -1)); }}><Undo2 size={16} aria-hidden="true" /> Undo</button>
      <button type="button" className="ll3-btn" disabled={line.length === 0 || right} onClick={() => { setChecked(false); setLine([]); }}><RotateCcw size={16} aria-hidden="true" /> Clear</button>
    </div>
    {feedback && <Feedback result={right ? "right" : "retry"}>{feedback}</Feedback>}
  </BlockFrame>;
}

// ── Writing organizer ──────────────────────────────────────────────────────

const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
const normalize = (text: string) => text.toLowerCase().replace(/[“”"‘’'.,;:!?()]/g, " ").replace(/\s+/g, " ").trim();

/** Deterministic composition feedback: never a grade, only what a reviser should look at next. */
export function compositionFeedback(field: { id: string; label: string; minWords: number }, text: string, source: string | null): string[] {
  const notes: string[] = [];
  const count = wordCount(text);
  if (count < field.minWords) notes.push(`${field.label}: write at least ${field.minWords - count} more ${field.minWords - count === 1 ? "word" : "words"}.`);
  if (/evidence/i.test(field.id) && source) {
    const quoted = /["“][^"”]{8,}["”]/.exec(text);
    if (!quoted) notes.push("Evidence: put the words you take from the text inside quotation marks.");
    else {
      const words = normalize(quoted[0]).split(" ");
      const haystack = ` ${normalize(source)} `;
      let found = false;
      for (let start = 0; start + 4 <= words.length && !found; start++) if (haystack.includes(` ${words.slice(start, start + 4).join(" ")} `)) found = true;
      notes.push(found ? "Evidence: your quotation matches the text. Good." : "Evidence: your quotation does not match the text exactly. Copy the words as they appear.");
    }
  }
  if (/explan|reason/i.test(field.id) && count >= 3 && !/\b(because|this shows|shows|this means|means|so|proves|therefore)\b/i.test(text)) notes.push(`${field.label}: link it to the claim, for example with "This shows…" or "because…".`);
  return notes;
}

export function WritingOrganizerBlock({ block, onDone }: { block: BlockOf<"WRITING_ORGANIZER">; onDone: BlockDone }) {
  const storageKey = `ll-v4-writing:${block.id}`;
  const [values, setValues] = useState<Record<string, string>>({});
  const [ticks, setTicks] = useState<Set<number>>(new Set());
  const [reviewed, setReviewed] = useState(false);
  const { sources } = useBlockLesson();
  const id = useId();
  useEffect(() => { setValues(readDraft(storageKey)); }, [storageKey]);
  const update = (fieldId: string, text: string) => setValues((current) => { const next = { ...current, [fieldId]: text }; writeDraft(storageKey, next); return next; });
  const source = block.sourceBlockId ? sources[block.sourceBlockId] ?? null : null;
  const notes = useMemo(() => block.fields.flatMap((field) => compositionFeedback(field, values[field.id] ?? "", source)), [block.fields, values, source]);
  const complete = block.fields.every((field) => wordCount(values[field.id] ?? "") >= field.minWords);
  const done = complete && ticks.size === block.checklist.length;
  useReportDone(block.id, done, onDone);
  return <BlockFrame label="Write and revise" title={block.prompt} className="ll5-organizer" data={{ "data-writing-organizer": block.id }}>
    <div className="ll5-organizer-fields">
      {block.fields.map((field) => <div key={field.id} className="ll5-organizer-field">
        <label htmlFor={`${id}-${field.id}`} className="ll5-answer-label">{field.label}</label>
        <p className="ll3-small ll3-muted" id={`${id}-${field.id}-help`}>{field.guidance}</p>
        <textarea id={`${id}-${field.id}`} className="ll5-textarea" rows={3} aria-describedby={`${id}-${field.id}-help`} value={values[field.id] ?? ""} onChange={(event) => update(field.id, event.target.value)} />
        <p className="ll3-small ll3-muted">{wordCount(values[field.id] ?? "")} of at least {field.minWords} words</p>
      </div>)}
    </div>
    <div className="ll4-row"><button type="button" className="ll3-btn" data-primary="" onClick={() => setReviewed(true)}>Check my draft</button></div>
    {reviewed && <div className="ll5-solution" role="status">
      <p className="ll5-block-label">Notes for revising</p>
      {notes.length ? <ul className="ll5-reasons">{notes.map((note, index) => <li key={index}>{note}</li>)}</ul> : <p>Every part is there. Now check your work against the list below.</p>}
    </div>}
    <fieldset className="ll5-checklist"><legend className="ll5-block-label">Before you finish, check</legend>
      {block.checklist.map((item, index) => <label key={index} className="ll5-check"><input type="checkbox" checked={ticks.has(index)} onChange={() => setTicks((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; })} /> <span>{item}</span></label>)}
    </fieldset>
    <p className="ll3-small ll3-muted">Your writing stays in this browser tab. It is not sent, saved or marked.</p>
  </BlockFrame>;
}

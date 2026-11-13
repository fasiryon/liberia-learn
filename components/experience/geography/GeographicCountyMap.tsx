"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Compass } from "lucide-react";
import geography from "@/lib/learner-experience/geography/liberia-adm1-2021.json";
import { compassBetween, countyIn, describeCounty, geographyTextAlternative, stepToward, type GeoCounty, type GeoMapData } from "@/lib/learner-experience/geography/liberiaCountyMap";
import type { GeoSceneAttachment, GeoTask } from "@/lib/learner-experience/geography/draft6Binding";
import { Feedback } from "@/components/experience/teaching/v4/shared";

/**
 * The real Liberia county map (`liberia-geographic-map/1.0.0`): coordinate-derived outlines from the pinned factory
 * asset, explored by pointer or keyboard (arrow keys move by compass direction). Each task's feedback comes from
 * the geometry: position, coast and shared boundaries. Formative only: nothing is sent, stored or scored.
 */
const DATA = geography as unknown as GeoMapData;
const KEYS: Record<string, "north" | "south" | "east" | "west"> = { ArrowUp: "north", ArrowDown: "south", ArrowRight: "east", ArrowLeft: "west" };

type Result = { result: "right" | "retry"; text: string };

function bounds(data: GeoMapData) {
  let minX = data.ocean.at[0], minY = data.north.label[1] - 20, maxX = data.north.label[0] + 30, maxY = data.ocean.at[1] + 10;
  for (const county of data.counties) for (const m of county.path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)) {
    const x = Number(m[1]), y = Number(m[2]);
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return [Math.floor(minX - 16), Math.floor(minY - 8), Math.ceil(maxX - minX + 32), Math.ceil(maxY - minY + 16)] as const;
}

const nameList = (names: readonly string[]) => names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;

function taskPrompt(task: GeoTask, outline: boolean) {
  switch (task.kind) {
    case "LOCATE": return `Select ${countyIn(DATA, task.countyId)!.name} on the ${outline ? "outline" : "map"}${outline ? ", using only its shape and position" : ""}.`;
    case "FARTHEST": return `Which lies farthest ${task.direction}: ${nameList(task.options.map((id) => countyIn(DATA, id)!.name))}?`;
    case "COAST": return `Does ${countyIn(DATA, task.countyId)!.name} touch the Atlantic coast?`;
    case "NEIGHBOUR": return `Select a county that shares a boundary with ${countyIn(DATA, task.countyId)!.name}.`;
  }
}

/** Feedback derived from the map: where the chosen area lies relative to the one asked for, never a bare "wrong". */
function judge(task: GeoTask, answer: string, outline: boolean): Result {
  const call = (c: GeoCounty) => (outline ? `area ${c.number}` : c.name);
  switch (task.kind) {
    case "LOCATE": {
      const target = countyIn(DATA, task.countyId)!, chosen = countyIn(DATA, answer)!;
      if (chosen.id === target.id) return { result: "right", text: `${outline ? `Area ${chosen.number} is ${target.name}. ` : ""}${describeCounty(DATA, target)}` };
      return { result: "retry", text: `You chose ${call(chosen)}. ${target.name} lies ${compassBetween(chosen.centroid, target.centroid)} of it${target.coastal ? ", on the coast" : ", inland"}. Try again.` };
    }
    case "FARTHEST": {
      const options = task.options.map((id) => countyIn(DATA, id)!);
      const sorted = [...options].sort((a, b) => (task.direction === "north" ? a.centroid[1] - b.centroid[1] : b.centroid[1] - a.centroid[1]));
      const best = sorted[0], chosen = countyIn(DATA, answer)!;
      const positions = options.map((c) => `${c.name} lies in ${c.region} Liberia`).join("; ");
      return chosen.id === best.id
        ? { result: "right", text: `${best.name} lies farthest ${task.direction}. With north at the top of the map: ${positions}.` }
        : { result: "retry", text: `${chosen.name} is not the farthest ${task.direction}. ${best.name} lies ${compassBetween(chosen.centroid, best.centroid)} of ${chosen.name}. Use the north arrow: north is the top of the map.` };
    }
    case "COAST": {
      const county = countyIn(DATA, task.countyId)!, said = answer === "yes";
      return said === county.coastal
        ? { result: "right", text: county.coastal ? `Part of ${county.name}'s outline is the Atlantic shore, in ${county.region} Liberia.` : `${county.name} is inland. Every edge of it borders another county or a neighbouring country.` }
        : { result: "retry", text: county.coastal ? `Look again at ${county.name}'s south-western edge: it meets the Atlantic Ocean, not another county.` : `Follow ${county.name}'s outline: it touches other counties or a neighbouring country, not the ocean.` };
    }
    case "NEIGHBOUR": {
      const county = countyIn(DATA, task.countyId)!, chosen = countyIn(DATA, answer)!;
      if (county.neighbours.includes(chosen.id)) return { result: "right", text: `${chosen.name} shares a boundary with ${county.name}. ${county.name}'s neighbours on this map: ${nameList(county.neighbours.map((id) => countyIn(DATA, id)!.name)).replace(/ or /, " and ")}.` };
      if (chosen.id === county.id) return { result: "retry", text: `That is ${county.name} itself. Choose a county whose outline touches it.` };
      return { result: "retry", text: `${chosen.name} lies ${compassBetween(county.centroid, chosen.centroid)} of ${county.name} but their outlines do not meet. Choose an area that touches ${county.name}.` };
    }
  }
}

export function GeographicCountyMap({ attachment }: { attachment: GeoSceneAttachment }) {
  const outline = attachment.variant === "OUTLINE_TASK";
  const viewBox = useMemo(() => bounds(DATA), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusId, setFocusId] = useState(DATA.counties[0].id);
  const [taskIndex, setTaskIndex] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [announce, setAnnounce] = useState("");
  const [labelSize, setLabelSize] = useState(17);
  const frame = useRef<HTMLDivElement | null>(null);
  const areas = useRef<Record<string, SVGPathElement | null>>({});
  const task = attachment.tasks[taskIndex] ?? null;
  const done = attachment.tasks.length > 0 && taskIndex >= attachment.tasks.length;
  const county = selected ? countyIn(DATA, selected) ?? null : null;
  const label = (c: GeoCounty) => (outline ? `Area ${c.number}` : `${c.name}, area ${c.number}`);

  // Keep the printed numbers at least 13 CSS px at any width or zoom: the map scales down, the labels do not shrink with it.
  useEffect(() => {
    const node = frame.current;
    if (!node || typeof ResizeObserver !== "function") return;
    const sync = () => { const scale = node.getBoundingClientRect().width / viewBox[2]; if (scale > 0) setLabelSize(Math.max(17, 13 / scale)); };
    const observer = new ResizeObserver(sync);
    observer.observe(node); sync();
    return () => observer.disconnect();
  }, [viewBox]);

  const choose = (id: string) => {
    setSelected(id); setFocusId(id);
    const c = countyIn(DATA, id)!;
    setAnnounce(`${label(c)} selected. ${describeCounty(DATA, c, { names: !outline })}`);
    if (result?.result === "retry") setResult(null);
  };
  const onKey = (event: KeyboardEvent<SVGPathElement>, from: GeoCounty) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(from.id); return; }
    const direction = KEYS[event.key];
    if (!direction) return;
    event.preventDefault();
    const next = stepToward(DATA, from, direction);
    if (!next) { setAnnounce(`No county further ${direction} of ${outline ? `area ${from.number}` : from.name}${direction === "west" || direction === "south" ? "; the coast or border is that way" : "; the border is that way"}.`); return; }
    setFocusId(next.id);
    areas.current[next.id]?.focus();
    setAnnounce(`Moved ${direction} to ${label(next)}. ${describeCounty(DATA, next, { names: !outline })}`);
  };
  const answer = (value: string) => { if (task) setResult(judge(task, value, outline)); };
  const next = () => { setResult(null); setSelected(null); setTaskIndex((i) => i + 1); };
  const picksArea = task && (task.kind === "LOCATE" || task.kind === "NEIGHBOUR");

  return <section className="ll5-block ll6-geo" data-geo-map={attachment.variant} data-geo-asset={attachment.sha256}>
    <p className="ll5-block-label">{outline ? "Outline map task" : "Liberia county map"}</p>
    <p className="ll5-block-title">{outline ? "Identify county areas from their outlines. Numbers label areas; names are hidden." : "Explore Liberia's fifteen counties. Choose an area to see where it lies and which counties it borders."}</p>
    <div className="ll6-geo-layout">
      <div ref={frame} className="ll6-geo-frame">
        <svg viewBox={viewBox.join(" ")} className="ll6-geo-svg" role="group" aria-label={`${outline ? "Outline" : "Map"} of Liberia's fifteen county areas, north up. Use Tab to reach the map, arrow keys to move north, south, east or west between areas, and Enter to choose one.`}>
          <path d={DATA.north.arrow} className="ll6-geo-north" aria-hidden="true" />
          <text x={DATA.north.label[0]} y={DATA.north.label[1]} className="ll6-geo-north-label" fontSize={labelSize * 1.1} aria-hidden="true">N</text>
          <text x={DATA.ocean.at[0]} y={DATA.ocean.at[1]} className="ll6-geo-ocean" fontSize={labelSize} aria-hidden="true">Atlantic Ocean</text>
          {DATA.counties.map((c) => {
            const isNeighbour = county?.neighbours.includes(c.id);
            return <path key={c.id} ref={(node) => { areas.current[c.id] = node; }} d={c.path} fillRule="evenodd" className="ll6-geo-area"
              role="button" tabIndex={c.id === focusId ? 0 : -1} aria-label={label(c)} aria-pressed={selected === c.id}
              data-selected={selected === c.id ? "" : undefined} data-neighbour={isNeighbour ? "" : undefined} data-county={c.id}
              onClick={() => choose(c.id)} onKeyDown={(event) => onKey(event, c)} onFocus={() => setFocusId(c.id)} />;
          })}
          {DATA.counties.map((c) => <text key={`n-${c.id}`} x={c.label[0]} y={c.label[1]} textAnchor="middle" dominantBaseline="middle" className="ll6-geo-number" fontSize={labelSize} aria-hidden="true">{c.number}</text>)}
        </svg>
        <label className="ll6-geo-pick">
          <span>Or choose {outline ? "an area number" : "a county"} from a list</span>
          <select value={selected ?? ""} onChange={(event) => event.target.value && choose(event.target.value)}>
            <option value="">Choose…</option>
            {(outline ? DATA.counties : [...DATA.counties].sort((a, b) => a.name.localeCompare(b.name))).map((c) => <option key={c.id} value={c.id}>{outline ? `Area ${c.number}` : c.name}</option>)}
          </select>
        </label>
        <p className="ll6-geo-legend"><Compass size={14} aria-hidden="true" /> North is up. Highlighted areas share a boundary with the one you chose. No roads, distances or capital points are shown.</p>
      </div>
      <div className="ll6-geo-side">
        <p className="ll6-geo-detail" data-geo-detail>
          {county ? describeCounty(DATA, county, { names: !outline }) : "Choose an area on the map, or Tab to the map and use the arrow keys."}
          {county && !outline && <><br /><span className="ll3-small">Administrative capital (a name, not a point on this map): {county.capital}.</span></>}
        </p>
        {task && <div className="ll6-geo-task" data-geo-task={task.id}>
          <p className="ll3-small ll3-muted">Task {taskIndex + 1} of {attachment.tasks.length}</p>
          <p className="font-semibold">{taskPrompt(task, outline)}</p>
          {picksArea && <button type="button" className="ll3-btn" data-primary="" disabled={!selected || result?.result === "right"} onClick={() => selected && answer(selected)}>
            {selected ? `Check ${outline ? `area ${countyIn(DATA, selected)!.number}` : countyIn(DATA, selected)!.name}` : "Choose an area first"}</button>}
          {task.kind === "FARTHEST" && <div className="ll4-row" role="group" aria-label="Choose one">{task.options.map((id) => <button key={id} type="button" className="ll3-btn" disabled={result?.result === "right"} onClick={() => answer(id)}>{countyIn(DATA, id)!.name}</button>)}</div>}
          {task.kind === "COAST" && <div className="ll4-row" role="group" aria-label="Choose one"><button type="button" className="ll3-btn" disabled={result?.result === "right"} onClick={() => answer("yes")}>Yes, it touches the coast</button><button type="button" className="ll3-btn" disabled={result?.result === "right"} onClick={() => answer("no")}>No, it is inland</button></div>}
          {result && <Feedback result={result.result}>{result.text}</Feedback>}
          {result?.result === "right" && <button type="button" className="ll3-btn" onClick={next}>{taskIndex + 1 < attachment.tasks.length ? "Next map task" : "Finish map tasks"}</button>}
        </div>}
        {done && <p className="ll3-small" data-geo-tasks-done>Map tasks finished. This practice is for learning only; it is not marked or recorded.</p>}
        <p className="sr-only" aria-live="polite">{announce}</p>
      </div>
    </div>
    <details className="ll6-geo-text">
      <summary>Map as text (also works offline and on paper)</summary>
      <p>{geographyTextAlternative(DATA, { names: !outline })}</p>
    </details>
    <p className="ll6-geo-credit" data-geo-attribution>
      Boundaries: {DATA.source.producer}, {DATA.source.dataset}, represented year {DATA.source.representedYear} (upstream {DATA.source.upstreamCommit}). Licence <a href={DATA.source.licenseUrl} rel="license noreferrer" target="_blank">{DATA.source.license}</a>. Changes: {DATA.source.changes} {DATA.source.endorsement}
    </p>
  </section>;
}

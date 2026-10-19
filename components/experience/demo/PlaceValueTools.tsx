"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { PLACES, digitsOf, expandedForm, formatNumber, fromDigits, wordForm } from "@/lib/learner-experience/demo/placeValue";

const GROUPS = [{ name: "Millions", span: 1 }, { name: "Thousands", span: 3 }, { name: "Ones", span: 3 }];

/**
 * Place-value chart: a real table (wide) or a labelled list (narrow), switched by the space the stage
 * actually has. `highlight` marks one place by outline and text, never by colour alone.
 */
export function PlaceValueChart({ value, highlight = null, caption }: { value: number; highlight?: number | null; caption: string }) {
  const digits = digitsOf(value);
  return <div className="ll3-pv">
    <table className="ll3-pv-table">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>{GROUPS.map((group) => <th key={group.name} colSpan={group.span} scope="colgroup" className="ll3-pv-group">{group.name}</th>)}</tr>
        <tr>{PLACES.map((place, index) => <th key={place.id} scope="col" data-highlight={highlight === index ? "" : undefined}>{place.name}</th>)}</tr>
      </thead>
      <tbody>
        <tr>{digits.map((digit, index) => <td key={PLACES[index].id} className="ll3-pv-digit" data-highlight={highlight === index ? "" : undefined}>{digit}{highlight === index && <span className="sr-only"> (this digit)</span>}</td>)}</tr>
        <tr>{digits.map((digit, index) => <td key={PLACES[index].id} className="ll3-pv-value" data-highlight={highlight === index ? "" : undefined}>{formatNumber(digit * PLACES[index].value)}</td>)}</tr>
      </tbody>
    </table>
    <ul className="ll3-pv-list" aria-label={caption}>
      {digits.map((digit, index) => <li key={PLACES[index].id} data-highlight={highlight === index ? "" : undefined}>
        <span className="ll3-pv-list-place">{PLACES[index].name}</span>
        <span className="ll3-pv-list-digit">{digit}</span>
        <span className="ll3-pv-list-value">= {formatNumber(digit * PLACES[index].value)}{highlight === index ? " · this digit" : ""}</span>
      </li>)}
    </ul>
  </div>;
}

/** Interactive number breakdown: change any place with buttons (touch, mouse, keyboard). */
export function NumberBuilder({ value, onChange, presets = [2_350_480, 4_205_316, 1_742_009] }: { value: number; onChange: (next: number) => void; presets?: readonly number[] }) {
  const digits = digitsOf(value);
  const set = (index: number, delta: number) => {
    const next = [...digits];
    next[index] = (next[index] + delta + 10) % 10;
    onChange(fromDigits(next));
  };
  return <div className="ll3-builder">
    <div className="ll3-builder-places" role="group" aria-label="Build a number, one place at a time">
      {PLACES.map((place, index) => <div key={place.id} className="ll3-builder-place">
        <span className="ll3-builder-name" id={`builder-${place.id}`}>{place.name}</span>
        <button type="button" className="ll3-builder-step" aria-label={`Add one to the ${place.name} digit, now ${digits[index]}`} onClick={() => set(index, 1)}><Plus size={20} aria-hidden="true" /></button>
        <span className="ll3-builder-digit" aria-hidden="true">{digits[index]}</span>
        <button type="button" className="ll3-builder-step" aria-label={`Take one from the ${place.name} digit, now ${digits[index]}`} onClick={() => set(index, -1)}><Minus size={20} aria-hidden="true" /></button>
      </div>)}
    </div>
    <div className="ll3-builder-out" aria-live="polite">
      <p className="ll3-builder-number">{formatNumber(value)}</p>
      <dl className="ll3-builder-forms">
        <div><dt>Expanded form</dt><dd>{expandedForm(value)}</dd></div>
        <div><dt>In words</dt><dd>{wordForm(value)}</dd></div>
      </dl>
    </div>
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => <button key={preset} type="button" className="ll3-btn" onClick={() => onChange(preset)} aria-pressed={value === preset}>Show {formatNumber(preset)}</button>)}
      <button type="button" className="ll3-btn" onClick={() => onChange(0)}><RotateCcw size={16} aria-hidden="true" /> Reset</button>
    </div>
  </div>;
}

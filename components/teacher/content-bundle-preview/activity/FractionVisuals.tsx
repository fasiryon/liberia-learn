/**
 * Fraction pictures for activity experiences: strips (parts of a whole) and sets of objects
 * (parts of a set). Inline SVG and CSS only, so they render offline and print. Marked and shaded
 * parts carry a hatch or a tick as well as colour, so meaning never depends on colour alone.
 */
import { useId } from "react";
import type { FractionVisual, SetObject } from "@/lib/content-bundle/v1/activityExperience";
import { nounFor } from "@/lib/content-bundle/preview/fractionFeedback";

function ObjectIcon({ object }: { object: SetObject }) {
  if (object === "MANGO") {
    return (
      <svg viewBox="0 0 40 40" className="cbx-obj-svg" aria-hidden="true" focusable="false">
        <path d="M20 9c8 0 13 7 12 15-1 7-7 11-13 10-7-1-11-7-10-14 1-7 5-11 11-11z" className="cbx-mango" />
        <path d="M21 9c1-3 4-5 8-5-1 4-4 6-8 5z" className="cbx-leaf" />
      </svg>
    );
  }
  if (object === "STONE") {
    return (
      <svg viewBox="0 0 40 40" className="cbx-obj-svg" aria-hidden="true" focusable="false">
        <path d="M8 24c-1-6 4-12 11-13 8-1 14 3 14 10 0 6-5 10-12 10-7 0-12-2-13-7z" className="cbx-stone" />
        <path d="M14 18c3-2 7-3 10-2" className="cbx-stone-line" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 40" className="cbx-obj-svg" aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="15" className="cbx-cap" />
      <circle cx="20" cy="20" r="10" className="cbx-cap-inner" />
    </svg>
  );
}

/** Index layout shared by pictures, pickers and feedback: group g holds indices g*size .. g*size+size-1. */
export function groupIndices(objects: number, groups: number | null): number[][] {
  if (!groups) return [Array.from({ length: objects }, (_, i) => i)];
  const size = objects / groups;
  return Array.from({ length: groups }, (_, g) => Array.from({ length: size }, (_, k) => g * size + k));
}

export function SetObjectView({ object, marked }: { object: SetObject; marked: boolean }) {
  return (
    <span className={`cbx-obj${marked ? " cbx-obj-marked" : ""}`}>
      <ObjectIcon object={object} />
      {marked ? <span className="cbx-tick" aria-hidden="true">✓</span> : null}
    </span>
  );
}

export function FractionPicture({ visual, size = "md" }: { visual: FractionVisual; size?: "sm" | "md" }) {
  const hatchId = `cbx-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (visual.kind === "STRIP") {
    const widths = visual.widths ?? Array.from({ length: visual.parts }, () => 1);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = 0;
    return (
      <svg role="img" aria-label={visual.label} viewBox="0 0 320 56" className={`cbx-strip cbx-strip-${size}`} preserveAspectRatio="none">
        <defs>
          <pattern id={hatchId} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" className="cbx-shade-fill" />
            <line x1="0" y1="0" x2="0" y2="8" className="cbx-hatch-line" />
          </pattern>
        </defs>
        {widths.map((w, i) => {
          const width = (w / total) * 316;
          const rect = <rect key={i} x={2 + x} y={2} width={width} height={52} className={visual.shaded.includes(i) ? "cbx-part cbx-part-shaded" : "cbx-part"} fill={visual.shaded.includes(i) ? `url(#${hatchId})` : undefined} />;
          x += width;
          return rect;
        })}
      </svg>
    );
  }
  const groups = groupIndices(visual.objects, visual.groups);
  return (
    <div role="img" aria-label={visual.label} className={`cbx-set cbx-set-${size}`}>
      {groups.map((group, g) => (
        <span key={g} className={visual.groups ? "cbx-group" : "cbx-loose"} aria-hidden="true">
          {group.map((i) => <SetObjectView key={i} object={visual.object} marked={visual.marked.includes(i)} />)}
        </span>
      ))}
    </div>
  );
}

/** Tappable strip: each part is a toggle button. Widths follow the strip, height stays touch-sized. */
export function StripPicker({ parts, selected, onToggle, label }: { parts: number; selected: readonly number[]; onToggle: (index: number) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="cbx-strip-picker">
      {Array.from({ length: parts }, (_, i) => (
        <button key={i} type="button" className="cbx-strip-part" aria-pressed={selected.includes(i)} aria-label={`Part ${i + 1} of ${parts}`} onClick={() => onToggle(i)}>
          <span aria-hidden="true">{selected.includes(i) ? "✓" : ""}</span>
        </button>
      ))}
    </div>
  );
}

/** Tappable set: each object is a toggle button, arranged in the drawn equal groups when there are any. */
export function SetPicker({ objects, object, groups, selected, onToggle, label }: { objects: number; object: SetObject; groups: number | null; selected: readonly number[]; onToggle: (index: number) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="cbx-set cbx-set-md">
      {groupIndices(objects, groups).map((group, g) => (
        <span key={g} className={groups ? "cbx-group" : "cbx-loose"}>
          {group.map((i) => (
            <button key={i} type="button" className="cbx-obj-btn" aria-pressed={selected.includes(i)} aria-label={`${nounFor(object, 1)} ${i + 1} of ${objects}${groups ? `, group ${g + 1}` : ""}`} onClick={() => onToggle(i)}>
              <SetObjectView object={object} marked={selected.includes(i)} />
            </button>
          ))}
        </span>
      ))}
    </div>
  );
}

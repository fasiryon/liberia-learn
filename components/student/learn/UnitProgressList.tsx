import { InteractiveButton } from "@/components/ui/InteractiveButton";
import { subjectName, type ActiveUnit } from "./learnPresentation";

/** Server-ordered unit rows. Completion counts finished lessons, not mastery. */
export function UnitProgressList({ units, stale = false }: { units: ActiveUnit[]; stale?: boolean }) {
  return <ul className="pdv2-plan-list">{units.map((unit) => {
    const pct = Math.max(0, Math.min(100, Math.round(unit.completionPct)));
    return <li key={unit.unitId}>
      <div>
        <p className="pdv2-meta">{subjectName(unit.subject)}</p>
        <p className="pdv2-row-title">{unit.unitName}</p>
        <p>{unit.completedCount} of {unit.totalCount} lessons completed{stale ? " · Last loaded" : ""}</p>
        <div className="pdv2-meter" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      </div>
      <InteractiveButton href={`/student/units/${encodeURIComponent(unit.unitId)}`} aria-label={`Open unit: ${unit.unitName}`}>Open →</InteractiveButton>
    </li>;
  })}</ul>;
}

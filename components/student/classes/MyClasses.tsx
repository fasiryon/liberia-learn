import { InteractiveButton } from "@/components/ui/InteractiveButton";
import { classMeta, classTarget, dayLabel, nextClassLabel, type ClassSummary, type MyClasses } from "./classesPresentation";

/** One enrolled class: only fields the server returned; a missing value is stated, never guessed. */
export function ClassCard({ row, today, stale = false }: { row: ClassSummary; today: string; stale?: boolean }) {
  return <li className="pdv2-class-card">
    <div className="pdv2-class-card-head">
      <div>
        <p className="pdv2-meta">{classMeta(row)}{stale ? " · Last loaded" : ""}</p>
        <h3 className="pdv2-row-title">{row.name}</h3>
        <p className="pdv2-meta">{row.teacherName ? `Teacher: ${row.teacherName}` : "Teacher not listed"}{row.schoolName ? ` · ${row.schoolName}` : ""}</p>
      </div>
      {classTarget(row.href) && <InteractiveButton href={row.href} aria-label={`Open class: ${row.name}`}>Open →</InteractiveButton>}
    </div>
    <dl className="pdv2-class-facts">
      <div><dt>Current unit</dt><dd>{row.currentUnit ? row.currentUnit.title : "None scheduled"}</dd></div>
      <div><dt>Next class</dt><dd>{row.nextClass ? nextClassLabel(row.nextClass, today) : row.timetableConfigured ? "None this week" : "Timetable not set up"}</dd></div>
      <div><dt>Next work</dt><dd>{row.nextWork ? `${dayLabel(row.nextWork.date, today)} · ${row.nextWork.title}` : "Nothing scheduled"}</dd></div>
      <div><dt>Open assignments</dt><dd>{row.openAssignmentCount}</dd></div>
    </dl>
  </li>;
}

export function MyClassesView({ model, today }: { model: (MyClasses & { today?: string }) | "unavailable" | "restricted"; today: string }) {
  return <main className="pdv2-today pdv2-learn" aria-labelledby="classes-heading">
    <header className="pdv2-topbar">
      <div><InteractiveButton href="/student/learn">← Back to Learn</InteractiveButton><p className="pdv2-eyebrow pdv2-learn-crumb">Learn · My classes</p><h1 id="classes-heading">My classes</h1>
        {typeof model === "object" && model.classes.length > 0 && <p className="pdv2-meta">{model.classes.length} class{model.classes.length === 1 ? "" : "es"} you are enrolled in</p>}</div>
      <div className="pdv2-top-actions"><InteractiveButton href="/student/schedule">Class schedule →</InteractiveButton><InteractiveButton href="/student/lessons">Lesson library →</InteractiveButton></div>
    </header>
    <div className="pdv2-plan">
      {model === "restricted" && <p className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">Restricted</span> Your classes are not available for this account. Ask your teacher if you think they should be.</p>}
      {model === "unavailable" && <p role="status" className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">Unavailable</span> Your classes could not load. This does not mean you have none. Try again.</p>}
      {typeof model === "object" && model.classes.length === 0 && <p className="pdv2-learn-empty">You are not enrolled in a class yet. Your teacher or school adds you to classes. Lessons are still in the Lesson library.</p>}
      {typeof model === "object" && model.classes.length > 0 && <ul className="pdv2-class-grid">{model.classes.map((row) => <ClassCard key={row.classId} row={row} today={today} />)}</ul>}
    </div>
  </main>;
}

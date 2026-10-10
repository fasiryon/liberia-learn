import Link from "next/link";
import { InteractiveButton } from "@/components/ui/InteractiveButton";
import type { ClassDetailReadModel } from "@/lib/student/classes.server";
import { classMeta, classTarget, dayLabel, nextClassLabel } from "./classesPresentation";

const STATUS: Record<string, string> = { open: "Open", overdue: "Overdue", submitted: "Turned in" };

function dueText(dueAt: string | null) {
  if (!dueAt || !Number.isFinite(Date.parse(dueAt))) return "No due date provided";
  return `Due ${new Date(dueAt).toLocaleString("en-LR", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
}

/** Server-decided open/unavailable state for one row; a row without a learner target is never linked. */
function RowLink({ href, locked, label, name }: { href: string | null; locked: boolean; label: string; name: string }) {
  if (!locked && classTarget(href)) return <InteractiveButton href={href} aria-label={`${label}: ${name}`}>Open →</InteractiveButton>;
  return <span className="pdv2-learn-locked">{locked ? "Locked" : "Unavailable"}</span>;
}

/** Class detail for an enrolled learner. The page is only rendered after the server confirmed enrollment. */
export function ClassDetailView({ model }: { model: ClassDetailReadModel }) {
  const { class: cls, today } = model;
  const open = model.assignedWork.filter((row) => row.status !== "submitted");
  const done = model.assignedWork.filter((row) => row.status === "submitted");
  return <main className="pdv2-today pdv2-learn" aria-labelledby="class-heading">
    <header className="pdv2-topbar">
      <div><InteractiveButton href="/student/classes">← My classes</InteractiveButton><p className="pdv2-eyebrow pdv2-learn-crumb">Learn · My classes</p>
        <h1 id="class-heading">{cls.name}</h1>
        <p className="pdv2-meta">{classMeta(cls)} · {cls.teacherName ? `Teacher: ${cls.teacherName}` : "Teacher not listed"}{cls.schoolName ? ` · ${cls.schoolName}` : ""}</p></div>
      <div className="pdv2-top-actions"><InteractiveButton href="/student/schedule">Class schedule →</InteractiveButton></div>
    </header>

    <dl className="pdv2-class-facts pdv2-class-summary">
      <div><dt>Current unit</dt><dd>{model.currentUnit ? <Link href={model.currentUnit.href}>{model.currentUnit.title}</Link> : "None scheduled"}</dd></div>
      <div><dt>Next class</dt><dd>{model.nextClass ? nextClassLabel(model.nextClass, today) : model.schedule.configured ? "None this week" : "Timetable not set up"}</dd></div>
      <div><dt>Next work</dt><dd>{model.nextWork ? `${dayLabel(model.nextWork.date, today)} · ${model.nextWork.title}` : "Nothing scheduled"}</dd></div>
      <div><dt>Scheduled lessons done</dt><dd>{model.progress.scheduledToDate ? `${model.progress.completed} of ${model.progress.scheduledToDate}` : "None scheduled yet"}</dd></div>
    </dl>

    <div className="pdv2-learn-grid">
      <div className="pdv2-plan">
        <section aria-labelledby="class-work-heading">
          <p className="pdv2-eyebrow">Required</p><h2 id="class-work-heading">Assigned work</h2>
          {open.length === 0 ? <p className="pdv2-learn-empty">No open assignments in this class.</p>
            : <ul className="pdv2-plan-list">{open.map((row) => <li key={row.id}>
              <div><p className={row.status === "overdue" ? "pdv2-due" : "pdv2-meta"}>{STATUS[row.status]} · {dueText(row.dueAt)}</p><p className="pdv2-row-title">{row.title}</p>{row.reason && <p className="pdv2-meta">{row.reason}</p>}</div>
              <RowLink href={row.href} locked={row.locked} label="Open assignment" name={row.title} />
            </li>)}</ul>}
          {done.length > 0 && <details><summary>Turned in ({done.length})</summary><ul className="pdv2-plan-list">{done.map((row) => <li key={row.id}>
            <div><p className="pdv2-meta">Turned in · {dueText(row.dueAt)}</p><p className="pdv2-row-title">{row.title}</p></div>
            <RowLink href={row.href} locked={row.locked} label="Open assignment" name={row.title} />
          </li>)}</ul></details>}
        </section>

        <section aria-labelledby="class-lessons-heading">
          <p className="pdv2-eyebrow">This class</p><h2 id="class-lessons-heading">Class lessons</h2>
          <p className="pdv2-meta">Lessons your teacher scheduled or assigned in this class.</p>
          {model.lessons.length === 0 ? <p className="pdv2-learn-empty">Your teacher has not scheduled lessons in this class yet.</p>
            : <ul className="pdv2-plan-list">{model.lessons.map((row) => <li key={row.contentId}>
              <div><p className="pdv2-meta">{row.scheduledDate ? dayLabel(row.scheduledDate, today) : "Assigned"}{row.status === "completed" ? " · Completed" : ""}</p><p className="pdv2-row-title">{row.title}</p></div>
              <RowLink href={row.href} locked={row.locked} label="Open lesson" name={row.title} />
            </li>)}</ul>}
        </section>
      </div>

      <div className="pdv2-context-column">
        <section aria-labelledby="class-schedule-heading">
          <p className="pdv2-eyebrow">Timetable</p><h2 id="class-schedule-heading">Schedule</h2>
          {!model.schedule.configured ? <p className="pdv2-learn-empty">Your school has not set up a timetable for this class yet.</p>
            : <ul className="pdv2-period-list">{model.schedule.slots.map((slot) => <li key={slot.id}>
              <span className="pdv2-period-time">{slot.dayName}</span>
              <div><p className="pdv2-row-title">{slot.periodLabel}</p><p className="pdv2-meta">{slot.timeRange ?? "Time not set"}{slot.room ? ` · Room ${slot.room}` : ""}</p></div>
            </li>)}</ul>}
          <InteractiveButton href="/student/schedule">Full schedule →</InteractiveButton>
        </section>
        <section aria-labelledby="class-resources-heading">
          <p className="pdv2-eyebrow">Resources</p><h2 id="class-resources-heading">Books and resources</h2>
          {model.resources.length === 0 ? <p className="pdv2-learn-empty">No class resources have been shared yet.</p>
            : <ul className="pdv2-plan-list">{model.resources.map((row) => <li key={row.contentId}>
              <div><p className="pdv2-row-title">{row.title}</p></div>
              <RowLink href={row.href} locked={row.locked} label="Open resource" name={row.title} />
            </li>)}</ul>}
          <div className="pdv2-support-actions"><InteractiveButton href="/student/textbooks">Textbooks →</InteractiveButton></div>
        </section>
        <section aria-labelledby="class-progress-heading">
          <p className="pdv2-eyebrow">Progress</p><h2 id="class-progress-heading">Your progress</h2>
          <p>Completion counts scheduled lessons you finished. It does not measure mastery.</p>
          <div className="pdv2-support-actions"><InteractiveButton href="/student/progress">View progress →</InteractiveButton>{model.currentUnit && <InteractiveButton href={model.currentUnit.href}>Unit progress →</InteractiveButton>}</div>
        </section>
      </div>
    </div>
  </main>;
}

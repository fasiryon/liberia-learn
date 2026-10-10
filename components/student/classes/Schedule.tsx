import Link from "next/link";
import { InteractiveButton } from "@/components/ui/InteractiveButton";
import type { ScheduleDay, ScheduleReadModel } from "@/lib/student/classes.server";
import { classTarget, PERIOD_STATE_LABEL, subjectLabel } from "./classesPresentation";

const shortDate = (date: string, weekday: boolean) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-LR", { ...(weekday ? { weekday: "short" as const } : {}), day: "numeric", month: "short", timeZone: "UTC" });

function Links({ links }: { links: ScheduleDay["periods"][number]["links"] }) {
  const safe = links.filter((link) => classTarget(link.href));
  if (!safe.length) return null;
  return <div className="pdv2-period-links">{safe.map((link) => <InteractiveButton key={link.href} href={link.href} aria-label={`Open ${link.kind}: ${link.title}`}>{link.kind === "assignment" ? "Assignment" : "Lesson"}: {link.title} →</InteractiveButton>)}</div>;
}

function Day({ day, today, compact }: { day: ScheduleDay; today: string; compact: boolean }) {
  const empty = !day.periods.length && !day.otherWork.length;
  return <section className="pdv2-schedule-day" aria-labelledby={`day-${day.date}`} data-today={day.isToday || undefined}>
    <h2 id={`day-${day.date}`}>{day.isToday ? "Today" : day.dayName} <span className="pdv2-meta">{shortDate(day.date, day.isToday)}</span></h2>
    {empty && <p className="pdv2-learn-empty">No classes are on the timetable today.</p>}
    {day.periods.length > 0 && <ol className="pdv2-period-list">{day.periods.map((period) => <li key={period.id} data-state={period.state}>
      <span className="pdv2-period-time">{period.timeRange ?? "Time not set"}</span>
      <div>
        <p className="pdv2-meta">{period.periodLabel}{period.room ? ` · Room ${period.room}` : ""}</p>
        <p className="pdv2-row-title"><Link href={`/student/classes/${encodeURIComponent(period.classId)}`}>{period.className}</Link></p>
        <p className="pdv2-meta">{subjectLabel(period.subject)}{period.teacherName ? ` · ${period.teacherName}` : ""}</p>
        {period.plannedTitle && <p className="pdv2-meta">Planned: {period.plannedTitle}</p>}
        {!compact && <Links links={period.links} />}
      </div>
      <span className={`pdv2-period-state pdv2-period-${period.state}`}>{PERIOD_STATE_LABEL[period.state]}</span>
    </li>)}</ol>}
    {day.otherWork.length > 0 && <>
      <h3 className="pdv2-subhead">{day.periods.length ? "Other scheduled work" : "Scheduled work"}</h3>
      <ul className="pdv2-period-list">{day.otherWork.map((row) => <li key={row.scheduledWorkId} data-state={row.state}>
        <span className="pdv2-period-time">{row.timeRange ?? (row.periodNumber ? `Period ${row.periodNumber}` : "Time not set")}</span>
        <div><p className="pdv2-row-title">{row.className}</p><p className="pdv2-meta">{subjectLabel(row.subject)}{row.status === "completed" ? " · Completed" : ""}</p>{!compact && <Links links={row.links} />}</div>
        <span className={`pdv2-period-state pdv2-period-${row.state}`}>{PERIOD_STATE_LABEL[row.state]}</span>
      </li>)}</ul>
    </>}
  </section>;
}

/**
 * Class schedule from the school's weekly timetable plus dated scheduled work.
 * A week is shown only from real timetable rows; nothing is padded or invented.
 */
export function ScheduleView({ model, view }: { model: ScheduleReadModel | "unavailable"; view: "today" | "week" }) {
  const ready = typeof model === "object" && model.availability === "current" ? model : null;
  const todayDay = ready?.days.find((day) => day.isToday);
  const weekHasMore = !!ready && ready.days.some((day) => !day.isToday);
  return <main className="pdv2-today pdv2-learn" aria-labelledby="schedule-heading">
    <header className="pdv2-topbar">
      <div><p className="pdv2-eyebrow">Today · School day</p><h1 id="schedule-heading">Class schedule</h1>
        {ready && <p className="pdv2-meta">{new Date(`${ready.today}T00:00:00Z`).toLocaleDateString("en-LR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} · School time ({ready.timeZone})</p>}</div>
      <div className="pdv2-top-actions">
        <nav aria-label="Schedule view" className="pdv2-segmented">
          <Link href="/student/schedule" aria-current={view === "today" ? "page" : undefined}>Today</Link>
          <Link href="/student/schedule?view=week" aria-current={view === "week" ? "page" : undefined}>Week</Link>
        </nav>
        <InteractiveButton href="/student/classes">My classes →</InteractiveButton>
      </div>
    </header>
    {model === "unavailable" && <p role="status" className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">Unavailable</span> Your schedule could not load. This does not mean you have no classes. Try again.</p>}
    {typeof model === "object" && model.availability === "restricted" && <p className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">Restricted</span> A schedule is not available for this account.</p>}
    {ready && !ready.enrolled && <p className="pdv2-learn-empty">You are not enrolled in a class yet, so there is no schedule to show. Your teacher or school adds you to classes.</p>}
    {ready && ready.enrolled && !ready.timetableConfigured && <p className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">Not set up</span> Your school has not set up a class timetable yet. Lessons your teachers scheduled for a date still appear below.</p>}
    {ready && ready.enrolled && (view === "today"
      ? todayDay && <div className="pdv2-plan"><Day day={todayDay} today={ready.today} compact={false} />
        {weekHasMore && <InteractiveButton href="/student/schedule?view=week">See this week →</InteractiveButton>}</div>
      : <div className="pdv2-week">{ready.days.map((day) => <div key={day.date} className="pdv2-plan"><Day day={day} today={ready.today} compact /></div>)}</div>)}
  </main>;
}

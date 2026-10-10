"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { InteractiveButton } from "@/components/ui/InteractiveButton";
import { useStudentIdentity } from "@/components/student/StudentShellV2";
import { WAEC_MIN_GRADE } from "@/lib/waec/eligibility";
import { GovernedActivity } from "./GovernedActivity";
import { useLearnRead, useOnline } from "./useLearnRead";
import { classMeta, classTarget, nextClassLabel, validMyClasses, type MyClasses } from "@/components/student/classes/classesPresentation";
import { ageBand, dueLabel, learnPlaces, learnTarget, subjectName, validDiscovery, type LearnDiscovery, type LearnRead, type SectionAvailability } from "./learnPresentation";

type View = "loading" | "rows" | "empty" | "unavailable" | "restricted" | "signed-out";

/** Combines the request state with the server's own section availability. */
function sectionView(read: LearnRead<LearnDiscovery>, availability: SectionAvailability | undefined): View {
  if (read.state === "loading") return "loading";
  if (read.state === "restricted" || read.state === "signed-out") return read.state;
  if (!read.data || !availability) return "unavailable";
  return availability === "current" ? "rows" : availability;
}

/**
 * Loading/failed/restricted/empty copy for one section. Never presents a
 * failure as empty, and an empty answer is only stated as current while the
 * snapshot is current: after a failed refresh or while offline it is history.
 */
function SectionState({ view, read, what, empty, reason, unknown }: { view: View; read: LearnRead<LearnDiscovery>; what: string; empty: ReactNode; reason?: string; unknown: boolean }) {
  if (view === "loading") return <p role="status" className="pdv2-meta">Loading {what}…</p>;
  if (view === "restricted" || view === "signed-out") return <p className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">{view === "restricted" ? "Restricted" : "Signed out"}</span> {read.error}</p>;
  if (view === "unavailable") return <p role="status" className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">Unavailable</span> {reason ?? `Your ${what} could not load. This does not mean you have none.`}</p>;
  if (unknown && view === "empty") return <StaleNotice>When last checked, you had no {what}. Your current {what} could not be checked, so this may have changed.</StaleNotice>;
  if (unknown) return <StaleNotice>Your {what} could not be checked just now. These are from the last check and may have changed.</StaleNotice>;
  if (view === "empty") return <p className="pdv2-learn-empty">{empty}</p>;
  return null;
}

function StaleNotice({ children }: { children: ReactNode }) {
  return <p role="status" className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">Last checked earlier</span> {children}</p>;
}

/** Server-decided open/unavailable state; the server's reason is shown as given. */
function RowAction({ item, label, name }: { item: { state: "open" | "unavailable"; locked: boolean; href: string | null; reason?: string }; label: string; name: string }) {
  if (item.state === "open" && !item.locked && learnTarget(item.href)) return <InteractiveButton href={item.href} aria-label={`${label}: ${name}`}>Open →</InteractiveButton>;
  return <span className="pdv2-learn-locked">{item.locked ? "Locked" : "Unavailable"}</span>;
}

/** The learner's enrolled classes from the server; never derived from lesson subjects. */
function MyClassesSection({ limit }: { limit: number }) {
  const online = useOnline();
  const [read] = useLearnRead<MyClasses>("/api/student/classes", validMyClasses);
  const model = read.data;
  const unknown = read.stale || (!online && model != null);
  return <section aria-labelledby="my-classes-heading">
    <p className="pdv2-eyebrow">My classes</p>
    <h2 id="my-classes-heading">My classes</h2>
    {read.state === "loading" && <p role="status" className="pdv2-meta">Loading your classes…</p>}
    {(read.state === "restricted" || read.state === "signed-out") && <p className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">{read.state === "restricted" ? "Restricted" : "Signed out"}</span> {read.error}</p>}
    {read.state === "error" && !model && <p role="status" className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">Unavailable</span> Your classes could not load. This does not mean you have none.</p>}
    {unknown && <StaleNotice>Your classes could not be checked just now. These are from the last check and may have changed.</StaleNotice>}
    {model && model.classes.length === 0 && !unknown && <p className="pdv2-learn-empty">You are not enrolled in a class yet. Your teacher or school adds you to classes.</p>}
    {model && model.classes.length > 0 && <ul className="pdv2-plan-list">{model.classes.slice(0, limit).map((row) => <li key={row.classId}>
      <div><p className="pdv2-meta">{classMeta(row)}{row.teacherName ? ` · ${row.teacherName}` : ""}{unknown ? " · Last loaded" : ""}</p><p className="pdv2-row-title">{row.name}</p>
        <p className="pdv2-meta">{row.nextClass && model.today ? `Next: ${nextClassLabel(row.nextClass, model.today)}` : row.timetableConfigured ? "No class periods left this week" : "Timetable not set up"} · {row.openAssignmentCount} open assignment{row.openAssignmentCount === 1 ? "" : "s"}</p></div>
      {classTarget(row.href) && <InteractiveButton href={row.href} aria-label={`Open class: ${row.name}`}>Open →</InteractiveButton>}
    </li>)}</ul>}
    <div className="pdv2-support-actions">
      <InteractiveButton href="/student/classes">All my classes →</InteractiveButton>
      <InteractiveButton href="/student/schedule">Class schedule →</InteractiveButton>
    </div>
  </section>;
}

export function LearnV2() {
  const identity = useStudentIdentity();
  const young = ageBand(identity.grade) === "young";
  const limit = young ? 3 : 5;
  const online = useOnline();
  const [read, reload] = useLearnRead<LearnDiscovery>("/api/student/learn", validDiscovery);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await reload(); } finally { setRefreshing(false); }
  }, [reload]);
  useEffect(() => {
    const reconnect = () => void refresh();
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [refresh]);

  const model = read.data;
  // Current status is unknown after a failed refresh or while offline; retained rows are history.
  const unknown = read.stale || (!online && read.data != null);
  const stale = unknown ? " · Last loaded" : "";
  const unitsView = model?.activeUnits.eligibility === "not_enrolled" && (read.state === "ready" || read.stale) ? "not-enrolled" : sectionView(read, model?.activeUnits.eligibility === "unavailable" ? "unavailable" : model?.activeUnits.availability);
  const lessonsView = sectionView(read, model?.lessons.availability);
  const workView = sectionView(read, model?.assignedWork.availability);
  const checksView = sectionView(read, model?.checks.availability);
  const resourcesView = sectionView(read, model?.resources.availability);
  const completion = new Map((model?.subjectCompletion ?? []).map((row) => [row.subject, row]));
  const places = learnPlaces(identity.grade, WAEC_MIN_GRADE);
  const destinations = (model?.resources.destinations ?? []).filter((row) => learnTarget(row.href));

  return <main className="pdv2-today pdv2-learn" aria-labelledby="learn-heading">
    <header className="pdv2-topbar">
      <div><p className="pdv2-eyebrow">Learn</p><h1 id="learn-heading">{young ? "Let's learn" : "Your learning"}</h1></div>
      <div className="pdv2-top-actions">
        {online ? <span className="pdv2-status">Connected</span> : <p role="status" className="pdv2-offline-note"><span className="pdv2-badge pdv2-badge-warn">Offline</span> Lists show what was last loaded</p>}
        <InteractiveButton onClick={() => void refresh()} disabled={refreshing} aria-busy={refreshing}>{refreshing ? "Checking…" : "Refresh"}</InteractiveButton>
      </div>
    </header>

    <GovernedActivity />

    <div className="pdv2-learn-grid">
      <div className="pdv2-plan pdv2-learn-path">
        <section aria-labelledby="current-heading">
          <p className="pdv2-eyebrow">Current learning</p>
          <h2 id="current-heading">Units this week</h2>
          {unitsView === "not-enrolled"
            ? unknown ? <StaleNotice>When last checked, you were not enrolled in a class. Your current classes could not be checked, so this may have changed.</StaleNotice>
              : <p className="pdv2-learn-empty">You are not enrolled in a class yet, so no units are shown. Ask your teacher.</p>
            : <SectionState unknown={unknown} view={unitsView} read={read} what="units" empty="No units are scheduled for your classes this week." />}
          {unitsView === "rows" && model && <ul className="pdv2-plan-list">{model.activeUnits.items.slice(0, limit).map((unit) => {
            const done = completion.get(unit.subject);
            return <li key={unit.unitId}>
              <div><p className="pdv2-meta">{subjectName(unit.subject)}{done && done.total > 0 ? ` · ${done.completed} of ${done.total} scheduled lessons completed` : ""}{stale}</p><p className="pdv2-row-title">{unit.title}</p>{unit.reason && <p>{unit.reason}</p>}</div>
              <RowAction item={unit} label="Open unit" name={unit.title} />
            </li>;
          })}</ul>}
        </section>

        <MyClassesSection limit={limit} />

        <section aria-labelledby="library-heading" className="pdv2-learn-library">
          <p className="pdv2-eyebrow">Browse</p>
          <h2 id="library-heading">Lesson library</h2>
          <p className="pdv2-meta">{lessonsView === "rows" && model ? `${model.lessons.total} published lesson${model.lessons.total === 1 ? "" : "s"} for your grade, by subject. Not all are assigned to your classes.${stale}` : "Published lessons for your grade, by subject."}</p>
          {(lessonsView === "unavailable" || lessonsView === "restricted" || lessonsView === "signed-out") && <SectionState unknown={unknown} view={lessonsView} read={read} what="lessons" empty="" />}
          <InteractiveButton href="/student/lessons">{young ? "Browse lessons" : "Browse the lesson library"} →</InteractiveButton>
        </section>
      </div>

      <div className="pdv2-context-column">
        <section aria-labelledby="assigned-heading">
          <p className="pdv2-eyebrow">Required</p>
          <h2 id="assigned-heading">Assigned work</h2>
          <SectionState unknown={unknown} view={workView} read={read} what="assignments" empty="No assignments right now." />
          {workView === "rows" && model && <ul className="pdv2-plan-list">{model.assignedWork.items.slice(0, limit).map((item) => <li key={item.id}>
            <div><p className="pdv2-meta">{subjectName(item.subject)}</p><p className="pdv2-row-title">{item.title}</p><p>{dueLabel(item.dueAt)}{stale}</p>{item.reason && <p>{item.reason}</p>}</div>
            <RowAction item={item} label="Open assignment" name={item.title} />
          </li>)}</ul>}
          <div className="pdv2-support-actions"><InteractiveButton href="/student/assignments">All assignments →</InteractiveButton></div>
        </section>

        <section aria-labelledby="checks-heading">
          <p className="pdv2-eyebrow">Checks</p>
          <h2 id="checks-heading">Checks</h2>
          <SectionState unknown={unknown} view={checksView} read={read} what="checks" reason={model?.checks.reason} empty="No checks are open for you right now." />
          {checksView === "rows" && model && <ul className="pdv2-plan-list">{model.checks.items.slice(0, limit).map((check) => <li key={check.id}>
            <div><p className="pdv2-meta">{subjectName(check.subject)}{stale}</p><p className="pdv2-row-title">{check.title}</p>{check.reason && <p>{check.reason}</p>}</div>
            <RowAction item={check} label="Open check" name={check.title} />
          </li>)}</ul>}
          <div className="pdv2-support-actions"><InteractiveButton href="/student/exams">All checks →</InteractiveButton></div>
        </section>

        <section aria-labelledby="resources-heading">
          <p className="pdv2-eyebrow">Resources</p>
          <h2 id="resources-heading">Books and resources</h2>
          <h3 className="pdv2-subhead">Readings</h3>
          <SectionState unknown={unknown} view={resourcesView} read={read} what="readings" empty="No readings are published for your grade and classes yet." />
          {resourcesView === "rows" && model && <ul className="pdv2-plan-list">{model.resources.items.slice(0, limit).map((item) => <li key={item.id}>
            <div><p className="pdv2-meta">{subjectName(item.subject)}{stale}</p><p className="pdv2-row-title">{item.title}</p>{item.reason && <p>{item.reason}</p>}</div>
            <RowAction item={item} label="Open reading" name={item.title} />
          </li>)}</ul>}
          {destinations.length > 0 && <div className="pdv2-support-actions">{destinations.map((row) => <InteractiveButton key={row.href} href={row.href}>{row.title} →</InteractiveButton>)}</div>}
          <h3 className="pdv2-subhead">More in Learn</h3>
          <div className="pdv2-support-actions">{places.map((place) => <InteractiveButton key={place.id} href={place.href}>{place.label} →</InteractiveButton>)}</div>
        </section>
      </div>
    </div>
  </main>;
}

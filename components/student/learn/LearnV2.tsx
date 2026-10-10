"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { InteractiveButton } from "@/components/ui/InteractiveButton";
import { useStudentIdentity } from "@/components/student/StudentShellV2";
import { WAEC_MIN_GRADE } from "@/lib/waec/eligibility";
import { GovernedActivity } from "./GovernedActivity";
import { useLearnRead, useOnline } from "./useLearnRead";
import { ageBand, dueLabel, learnPlaces, learnTarget, subjectName, validDiscovery, type LearnDiscovery, type LearnRead, type SectionAvailability } from "./learnPresentation";

type View = "loading" | "rows" | "empty" | "unavailable" | "restricted" | "signed-out";

/** Combines the request state with the server's own section availability. */
function sectionView(read: LearnRead<LearnDiscovery>, availability: SectionAvailability | undefined): View {
  if (read.state === "loading") return "loading";
  if (read.state === "restricted" || read.state === "signed-out") return read.state;
  if (!read.data || !availability) return "unavailable";
  return availability === "current" ? "rows" : availability;
}

/** Loading/failed/restricted/empty copy for one section. Never presents a failure as empty. */
function SectionState({ view, read, what, empty, reason }: { view: View; read: LearnRead<LearnDiscovery>; what: string; empty: ReactNode; reason?: string }) {
  if (view === "loading") return <p role="status" className="pdv2-meta">Loading {what}…</p>;
  if (view === "restricted" || view === "signed-out") return <p className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">{view === "restricted" ? "Restricted" : "Signed out"}</span> {read.error}</p>;
  if (view === "unavailable") return <p role="status" className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">Unavailable</span> {reason ?? `Your ${what} could not load. This does not mean you have none.`}</p>;
  if (view === "empty") return <p className="pdv2-learn-empty">{empty}</p>;
  return read.stale ? <p role="status" className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">Last loaded</span> Your {what} could not refresh. These may have changed.</p> : null;
}

/** Server-decided open/unavailable state; the server's reason is shown as given. */
function RowAction({ item, label, name }: { item: { state: "open" | "unavailable"; locked: boolean; href: string | null; reason?: string }; label: string; name: string }) {
  if (item.state === "open" && !item.locked && learnTarget(item.href)) return <InteractiveButton href={item.href} aria-label={`${label}: ${name}`}>Open →</InteractiveButton>;
  return <span className="pdv2-learn-locked">{item.locked ? "Locked" : "Unavailable"}</span>;
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
  const stale = read.stale ? " · Last loaded" : "";
  const unitsView = model?.activeUnits.eligibility === "not_enrolled" && read.state === "ready" ? "not-enrolled" : sectionView(read, model?.activeUnits.eligibility === "unavailable" ? "unavailable" : model?.activeUnits.availability);
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
      <section className="pdv2-plan pdv2-learn-path" aria-labelledby="path-heading">
        <p className="pdv2-eyebrow">Explore</p>
        <h2 id="path-heading">Your learning path</h2>

        <h3 className="pdv2-subhead">Subjects</h3>
        {model && read.state !== "loading" && model.subjects.length > 0
          ? <ul className="pdv2-learn-subjects">{model.subjects.map((row) => {
            const done = completion.get(row.subject);
            return <li key={row.subject}><span className="pdv2-row-title">{subjectName(row.label)}</span>
              {done && done.total > 0 && <span className="pdv2-meta">{done.completed} of {done.total} scheduled lessons completed{stale}</span>}</li>;
          })}</ul>
          : <SectionState view={sectionView(read, model ? (model.subjects.length ? "current" : model.availability === "unavailable" ? "unavailable" : "empty") : undefined)} read={read} what="subjects"
            empty="You are not in a class with subjects yet. Ask your teacher." />}

        <h3 className="pdv2-subhead">Units this week</h3>
        {unitsView === "not-enrolled"
          ? <p className="pdv2-learn-empty">You are not enrolled in a class yet, so no units are shown. Ask your teacher.</p>
          : <SectionState view={unitsView} read={read} what="units" empty="No units are scheduled for your class this week." />}
        {unitsView === "rows" && model && <ul className="pdv2-plan-list">{model.activeUnits.items.slice(0, limit).map((unit) => <li key={unit.unitId}>
          <div><p className="pdv2-meta">{subjectName(unit.subject)}{stale}</p><p className="pdv2-row-title">{unit.title}</p>{unit.reason && <p>{unit.reason}</p>}</div>
          <RowAction item={unit} label="Open unit" name={unit.title} />
        </li>)}</ul>}

        <h3 className="pdv2-subhead">Lessons</h3>
        <SectionState view={lessonsView} read={read} what="lessons" empty="No lessons are published for your grade and classes yet. Your teacher can still assign work." />
        {lessonsView === "rows" && model && <>
          <ul className="pdv2-plan-list">{model.lessons.items.slice(0, limit).map((lesson) => <li key={lesson.contentId}>
            <div><p className="pdv2-meta">{subjectName(lesson.subject)} · Grade {lesson.grade}{stale}</p><p className="pdv2-row-title">{lesson.title}</p>{lesson.reason && <p>{lesson.reason}</p>}</div>
            <RowAction item={lesson} label="Open lesson" name={lesson.title} />
          </li>)}</ul>
          <p className="pdv2-meta">{model.lessons.total} lesson{model.lessons.total === 1 ? "" : "s"} available to you.</p>
        </>}
        <InteractiveButton href="/student/lessons">{young ? "All lessons" : "Browse all lessons"} →</InteractiveButton>
      </section>

      <div className="pdv2-context-column">
        <section aria-labelledby="assigned-heading">
          <p className="pdv2-eyebrow">Required</p>
          <h2 id="assigned-heading">Assigned work</h2>
          <h3 className="pdv2-subhead">Assignments</h3>
          <SectionState view={workView} read={read} what="assignments" empty="No assignments right now." />
          {workView === "rows" && model && <ul className="pdv2-plan-list">{model.assignedWork.items.slice(0, limit).map((item) => <li key={item.id}>
            <div><p className="pdv2-meta">{subjectName(item.subject)}</p><p className="pdv2-row-title">{item.title}</p><p>{dueLabel(item.dueAt)}{stale}</p>{item.reason && <p>{item.reason}</p>}</div>
            <RowAction item={item} label="Open assignment" name={item.title} />
          </li>)}</ul>}
          <h3 className="pdv2-subhead">Checks</h3>
          <SectionState view={checksView} read={read} what="checks" reason={model?.checks.reason} empty="No checks are open for you right now." />
          {checksView === "rows" && model && <ul className="pdv2-plan-list">{model.checks.items.slice(0, limit).map((check) => <li key={check.id}>
            <div><p className="pdv2-meta">{subjectName(check.subject)}{stale}</p><p className="pdv2-row-title">{check.title}</p>{check.reason && <p>{check.reason}</p>}</div>
            <RowAction item={check} label="Open check" name={check.title} />
          </li>)}</ul>}
          <div className="pdv2-support-actions">
            <InteractiveButton href="/student/assignments">All assignments →</InteractiveButton>
            <InteractiveButton href="/student/exams">All checks →</InteractiveButton>
          </div>
        </section>

        <section aria-labelledby="resources-heading">
          <p className="pdv2-eyebrow">Resources</p>
          <h2 id="resources-heading">Books and resources</h2>
          <h3 className="pdv2-subhead">Readings</h3>
          <SectionState view={resourcesView} read={read} what="readings" empty="No readings are published for your grade and classes yet." />
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

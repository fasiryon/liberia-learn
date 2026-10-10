"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { InteractiveButton } from "@/components/ui/InteractiveButton";
import { useStudentIdentity } from "@/components/student/StudentShellV2";
import { dueText } from "@/lib/learner-experience/todayPresentation";
import { WAEC_MIN_GRADE } from "@/lib/waec/eligibility";
import { GovernedActivity } from "./GovernedActivity";
import { UnitProgressList } from "./UnitProgressList";
import { useLearnRead, useOnline } from "./useLearnRead";
import {
  ageBand, catalogConfirmed, learnResources, openAssignments, subjectName,
  validActiveUnits, validAssignments, validCatalog,
  type ActiveUnit, type CatalogPage, type LearnRead,
} from "./learnPresentation";
import type { AssignedWork } from "@/lib/learner-experience/todayPresentation";

/** Loading/failed/restricted copy for one list. Never presents a failure as empty. */
function ListState<T>({ read, what, empty, isEmpty }: { read: LearnRead<T>; what: string; empty: ReactNode; isEmpty: boolean }) {
  if (read.state === "loading") return <p role="status" className="pdv2-meta">Loading {what}…</p>;
  if (read.state === "restricted" || read.state === "signed-out") return <p className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">{read.state === "restricted" ? "Restricted" : "Signed out"}</span> {read.error}</p>;
  if (read.state === "error") return <p role="status" className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">{read.stale ? "Last loaded" : "Unavailable"}</span> {read.stale ? `Your ${what} could not refresh. These may have changed.` : `Your ${what} could not load. This does not mean you have none.`}</p>;
  return isEmpty ? <p className="pdv2-learn-empty">{empty}</p> : null;
}

export function LearnV2() {
  const identity = useStudentIdentity();
  const young = ageBand(identity.grade) === "young";
  const limit = young ? 3 : 5;
  const online = useOnline();
  const [units, reloadUnits] = useLearnRead<ActiveUnit[]>("/api/student/units/active", validActiveUnits);
  const [catalog, reloadCatalog] = useLearnRead<CatalogPage>("/api/student/lessons", validCatalog);
  const [assigned, reloadAssigned] = useLearnRead<{ assignments: AssignedWork[] }>("/api/student/assignments", validAssignments);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([reloadUnits(), reloadCatalog(), reloadAssigned()]); } finally { setRefreshing(false); }
  }, [reloadUnits, reloadCatalog, reloadAssigned]);
  useEffect(() => {
    const reconnect = () => void refresh();
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [refresh]);

  const unitRows = units.data ?? [];
  const catalogPage = catalog.data;
  const catalogKnown = catalog.state === "ready" && catalogPage != null && catalogConfirmed(catalogPage);
  const lessons = catalogPage?.items ?? [];
  const subjects = (catalogKnown ? catalogPage.subjectCompletion ?? [] : []).filter((row) => row.total > 0);
  const work = openAssignments(assigned.data?.assignments ?? []);
  const resources = learnResources(identity.grade, WAEC_MIN_GRADE);
  const usableResources = identity.grade == null ? resources.filter((resource) => !resource.needsGrade) : resources;

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

        <h3 className="pdv2-subhead">Units in progress</h3>
        <ListState read={units} what="units" isEmpty={units.state === "ready" && unitRows.length === 0}
          empty="No units are scheduled for your class this week." />
        {unitRows.length > 0 && <UnitProgressList units={unitRows.slice(0, limit)} stale={units.state !== "ready"} />}

        {subjects.length > 0 && <>
          <h3 className="pdv2-subhead">Subjects</h3>
          <ul className="pdv2-learn-subjects">{subjects.map((row) => <li key={row.subject}>
            <span className="pdv2-row-title">{subjectName(row.subject)}</span>
            <span className="pdv2-meta">{row.completed} of {row.total} scheduled lessons completed</span>
          </li>)}</ul>
        </>}

        <h3 className="pdv2-subhead">Lessons</h3>
        {catalog.state === "ready" && catalogPage && !catalogConfirmed(catalogPage)
          ? <p role="status" className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">Not confirmed</span> Your lesson list could not be confirmed right now. Try Refresh.</p>
          : <ListState read={catalog} what="lessons" isEmpty={catalogKnown && lessons.length === 0} empty="No lessons are published for your grade yet. Your teacher can still assign work." />}
        {lessons.length > 0 && (catalogKnown || catalog.stale) && <ul className="pdv2-plan-list">{lessons.slice(0, limit).map((lesson) => <li key={lesson.contentId}>
          <div><p className="pdv2-meta">{subjectName(lesson.subject)} · Grade {lesson.grade}</p><p className="pdv2-row-title">{lesson.displayTitle}</p>{catalog.stale && <p className="pdv2-meta">Last loaded</p>}</div>
          <InteractiveButton href={`/student/lesson/${encodeURIComponent(lesson.contentId)}`} aria-label={`Open lesson: ${lesson.displayTitle}`}>Open →</InteractiveButton>
        </li>)}</ul>}
        <InteractiveButton href="/student/lessons">{young ? "All lessons" : "Browse all lessons"} →</InteractiveButton>
      </section>

      <div className="pdv2-context-column">
        <section aria-labelledby="assigned-heading">
          <p className="pdv2-eyebrow">Required</p>
          <h2 id="assigned-heading">Assigned work</h2>
          <ListState read={assigned} what="assignments" isEmpty={assigned.state === "ready" && work.length === 0}
            empty="No open assignments right now." />
          {work.length > 0 && <ul className="pdv2-plan-list">{work.slice(0, limit).map((item) => <li key={item.id}>
            <div><p className="pdv2-meta">{subjectName(item.subject)}</p><p className="pdv2-row-title">{item.title}</p>
              <p className={item.isOverdue ? "pdv2-due" : ""}>{dueText(item)}{assigned.state !== "ready" ? " · Last loaded" : ""}</p></div>
            <InteractiveButton href={`/student/assignments/${encodeURIComponent(item.id)}`} aria-label={`Open assignment: ${item.title}`}>Open →</InteractiveButton>
          </li>)}</ul>}
          {work.length > limit && <p className="pdv2-meta">{work.length - limit} more open assignment{work.length - limit === 1 ? "" : "s"}.</p>}
          <div className="pdv2-support-actions">
            <InteractiveButton href="/student/assignments">All assignments →</InteractiveButton>
            <InteractiveButton href="/student/exams">Exams and checks →</InteractiveButton>
          </div>
        </section>

        <section aria-labelledby="resources-heading">
          <p className="pdv2-eyebrow">Resources</p>
          <h2 id="resources-heading">Books and resources</h2>
          {identity.grade == null && <p className="pdv2-learn-empty">Your grade is not set yet, so grade resources can&apos;t be listed. Ask your teacher to finish your placement.</p>}
          <ul className="pdv2-plan-list">{usableResources.map((resource) => <li key={resource.id}>
            <div><p className="pdv2-row-title">{resource.label}</p>{!young && <p className="pdv2-meta">{resource.description}</p>}</div>
            <InteractiveButton href={resource.href} aria-label={`Open ${resource.label}`}>Open →</InteractiveButton>
          </li>)}</ul>
        </section>
      </div>
    </div>
  </main>;
}

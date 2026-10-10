"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InteractiveButton } from "@/components/ui/InteractiveButton";
import { useStudentIdentity } from "@/components/student/StudentShellV2";
import { isLessonCached } from "@/lib/lesson-offline-cache";
import { useOnline } from "./useLearnRead";
import { ageBand, catalogConfirmed, groupBySubject, readError, subjectName, validCatalog, type CatalogLesson, type CatalogPage } from "./learnPresentation";

/** Shows only a verified, learner-partitioned offline copy; never guesses. */
function SavedOffline({ contentId }: { contentId: string }) {
  const identity = useStudentIdentity();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let live = true;
    if (!identity.userId || !identity.schoolId) return;
    void isLessonCached(contentId, { userId: identity.userId, schoolId: identity.schoolId }).then((value) => { if (live) setSaved(value); }).catch(() => undefined);
    return () => { live = false; };
  }, [contentId, identity.userId, identity.schoolId]);
  return saved ? <p className="pdv2-meta">✓ Saved on this device</p> : null;
}

type State = { kind: "loading" } | { kind: "ready"; confirmed: boolean } | { kind: "error"; message: string; restricted?: boolean };

/** Lesson catalog for the learner's grade, server-ordered and paged as the endpoint returns it. */
export function LessonCatalog() {
  const identity = useStudentIdentity();
  const young = ageBand(identity.grade) === "young";
  const online = useOnline();
  const [lessons, setLessons] = useState<CatalogLesson[]>([]);
  const [page, setPage] = useState<CatalogPage | null>(null);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [moreError, setMoreError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstNew = useRef<string | null>(null);

  const load = useCallback(async (pageNumber: number) => {
    setBusy(true); setMoreError(null);
    if (pageNumber === 1) setState({ kind: "loading" });
    try {
      const response = await fetch(`/api/student/lessons?page=${pageNumber}`, { cache: "no-store" });
      if (!response.ok) {
        const failure = readError(response.status);
        if (pageNumber > 1) setMoreError(failure.error ?? "More lessons could not load.");
        else setState({ kind: "error", message: failure.error ?? "Lessons could not load.", restricted: failure.state === "restricted" || failure.state === "signed-out" });
        return;
      }
      const data: unknown = await response.json();
      if (!validCatalog(data)) throw new Error("malformed");
      setPage(data);
      if (pageNumber === 1) { setLessons(data.items); setState({ kind: "ready", confirmed: catalogConfirmed(data) }); }
      else {
        firstNew.current = data.items[0]?.contentId ?? null;
        setLessons((previous) => [...previous, ...data.items.filter((item) => !previous.some((row) => row.contentId === item.contentId))]);
      }
    } catch {
      if (pageNumber > 1) setMoreError("More lessons could not load. Try again.");
      else setState({ kind: "error", message: "Your lessons could not load. This does not mean there are none." });
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(1); }, [load]);
  useEffect(() => {
    if (!firstNew.current) return;
    document.getElementById(`lesson-${firstNew.current}`)?.focus();
    firstNew.current = null;
  }, [lessons]);

  const groups = groupBySubject(lessons);
  const hasMore = page != null && page.page < page.totalPages;

  return <main className="pdv2-today pdv2-learn" aria-labelledby="lessons-heading">
    <header className="pdv2-topbar">
      <div><InteractiveButton href="/student/learn">← Back to Learn</InteractiveButton><p className="pdv2-eyebrow pdv2-learn-crumb">Learn · Lessons</p><h1 id="lessons-heading">{young ? "Lessons" : "Lessons for your grade"}</h1></div>
      <div className="pdv2-top-actions">{online ? <span className="pdv2-status">Connected</span> : <p role="status" className="pdv2-offline-note"><span className="pdv2-badge pdv2-badge-warn">Offline</span> Saved lessons are in Offline lessons</p>}</div>
    </header>
    <div className="pdv2-plan" aria-busy={state.kind === "loading"}>
      {state.kind === "loading" && <p role="status">Loading lessons…</p>}
      {state.kind === "error" && <div role="status" className="pdv2-learn-notice"><p><span className="pdv2-badge pdv2-badge-warn">{state.restricted ? "Restricted" : "Unavailable"}</span> {state.message}</p>
        {!state.restricted && <InteractiveButton primary onClick={() => void load(1)} disabled={busy}>{busy ? "Checking…" : "Try again"}</InteractiveButton>}</div>}
      {state.kind === "ready" && !state.confirmed && <div role="status" className="pdv2-learn-notice"><p><span className="pdv2-badge pdv2-badge-warn">Not confirmed</span> Your lesson list could not be confirmed right now.</p><InteractiveButton primary onClick={() => void load(1)} disabled={busy}>{busy ? "Checking…" : "Try again"}</InteractiveButton></div>}
      {state.kind === "ready" && state.confirmed && lessons.length === 0 && <p className="pdv2-learn-empty">No lessons are published for your grade yet. Your teacher can still assign work, and your assignments are on Learn.</p>}
      {groups.map((group) => <section key={group.subject} className="pdv2-learn-group" aria-labelledby={`subject-${group.subject}`}>
        <h2 id={`subject-${group.subject}`}>{subjectName(group.subject)}</h2>
        <ul className="pdv2-plan-list">{group.items.map((lesson) => <li key={lesson.contentId}>
          <div><p className="pdv2-row-title">{lesson.displayTitle}</p><p className="pdv2-meta">Grade {lesson.grade}</p><SavedOffline contentId={lesson.contentId} /></div>
          <InteractiveButton id={`lesson-${lesson.contentId}`} href={`/student/lesson/${encodeURIComponent(lesson.contentId)}`} aria-label={`Open lesson: ${lesson.displayTitle}`}>Open →</InteractiveButton>
        </li>)}</ul>
      </section>)}
      {moreError && <p role="status" className="pdv2-error">{moreError}</p>}
      {state.kind === "ready" && hasMore && <InteractiveButton onClick={() => void load(page!.page + 1)} disabled={busy} aria-busy={busy}>{busy ? "Loading…" : "Show more lessons"}</InteractiveButton>}
    </div>
  </main>;
}

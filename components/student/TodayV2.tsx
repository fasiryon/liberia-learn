"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InteractiveButton } from "@/components/ui/InteractiveButton";
import { useStudentIdentity } from "./StudentShellV2";
import { nextActionDisplay, studentTarget, dueText, type AssignedWork, type GovernedAction, type ReadState, type TodayData } from "@/lib/learner-experience/todayPresentation";
import { isLessonCached } from "@/lib/lesson-offline-cache";
import { getQueue, subscribeToQueueChanges } from "@/lib/offline-queue";
import { useVisibleInterval } from "@/lib/hooks/useVisibleInterval";
import { LiveSessionBanner } from "@/components/LiveSessionBanner";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { NotificationBell } from "@/components/NotificationBell";

function useRead<T>(url: string, valid: (data: any) => boolean) {
  const [value, setValue] = useState<ReadState<T>>({ state: "loading", data: null });
  const current = useRef<AbortController | null>(null);
  const validator = useRef(valid); validator.current = valid;
  const load = useCallback(async () => {
    current.current?.abort();
    const controller = new AbortController(); current.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in again to load your work." : response.status === 403 || response.status === 404 || response.status === 409 ? "This activity is unavailable or has changed. Refresh or ask your teacher." : "The service could not load your work. Try again.");
      const data: unknown = await response.json();
      if (!validator.current(data)) throw new Error("Some learning information is unavailable. Try again.");
      if (current.current === controller) setValue({ state: "ready", data: data as T });
    } catch (cause) {
      if (current.current === controller) setValue((previous) => ({ state: "error", data: previous.data, error: cause instanceof Error && cause.name !== "AbortError" ? cause.message : "The connection took too long. Try again." }));
    } finally { clearTimeout(timeout); }
  }, [url]);
  useEffect(() => { return () => { current.current?.abort(); current.current = null; }; }, [load]);
  return [value, load] as const;
}

function ResourceState({ contentId, href }: { contentId: string; href: string }) {
  const identity = useStudentIdentity();
  const [state, setState] = useState("Availability unknown");
  useEffect(() => {
    let live = true;
    if (!identity.userId || !identity.schoolId) return;
    const check = () => { setState("Checking offline availability…"); void isLessonCached(contentId, { userId: identity.userId, schoolId: identity.schoolId }).then((saved) => {
      if (live) setState(saved && href.startsWith("/student/lesson/") ? "Saved lesson available offline" : "Online required · not verified locally");
    }).catch(() => { if (live) setState("Offline availability could not be checked"); }); };
    check(); window.addEventListener("focus", check); const timer = setInterval(check, 30000);
    return () => { live = false; clearInterval(timer); window.removeEventListener("focus", check); };
  }, [contentId, href, identity.userId, identity.schoolId]);
  return <span className="pdv2-status">{state}</span>;
}

export function TodayV2() {
  const identity = useStudentIdentity();
  const [today, reloadToday] = useRead<TodayData>("/api/student/today", validToday);
  const [governed, reloadGoverned] = useRead<GovernedAction>("/api/student/learning-authority/next-action", (d) => d && typeof d.available === "boolean" && (!d.available || (typeof d.decisionId === "string" && typeof d.action?.reason === "string" && (!d.conceptLabel || typeof d.conceptLabel === "string") && ["DIAGNOSTIC", "PRACTICE"].includes(d.action.kind))));
  const [assignments, reloadAssignments] = useRead<{ assignments: AssignedWork[] }>("/api/student/assignments", (d) => d && Array.isArray(d.assignments) && d.assignments.every((row: any) => row && typeof row.id === "string" && typeof row.title === "string" && typeof row.subject === "string"));
  const [teacherLessons, reloadTeachers] = useRead<{ lessons: Array<{ id: string; title: string | null; subject: string; lessonHref: string }> }>("/api/student/teacher-lessons", (d) => d && Array.isArray(d.lessons) && d.lessons.every((row: any) => row && typeof row.id === "string" && nullableText(row.title) && typeof row.subject === "string" && studentTarget(row.lessonHref)));
  const [offline, setOffline] = useState(false);
  const [queue, setQueue] = useState("Offline save status unknown");
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const young = identity.grade != null && identity.grade >= 1 && identity.grade <= 3;
  const refresh = useCallback(async () => {
    setRefreshing(true); await Promise.all([reloadToday(), reloadGoverned(), reloadAssignments(), reloadTeachers()]); setRefreshing(false);
  }, [reloadToday, reloadGoverned, reloadAssignments, reloadTeachers]);
  useVisibleInterval(refresh, 60000);
  useEffect(() => { if (!navigator.onLine) void refresh(); }, [refresh]);
  useEffect(() => {
    const online = () => { setOffline(false); };
    const disconnected = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", online); window.addEventListener("offline", disconnected);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", disconnected); };
  }, [refresh]);
  useEffect(() => {
    let live = true;
    async function readQueue() {
      if (!identity.userId || !identity.schoolId) return;
      try {
        const entries = await getQueue({ userId: identity.userId, schoolId: identity.schoolId });
        const pending = entries.filter((entry) => entry.status === "pending" || entry.status === "sending").length;
        const attention = entries.some((entry) => entry.status === "failed" || entry.status === "conflict" || entry.syncState === "AUTH_REQUIRED");
        if (live) setQueue(attention ? "Saved work needs attention · open sync status" : pending ? `${pending} saved on this device · waiting for server confirmation` : "No pending work found on this device");
      } catch { if (live) setQueue("Save status unavailable · check sync status"); }
    }
    void readQueue(); const unsubscribe = subscribeToQueueChanges(() => void readQueue());
    return () => { live = false; unsubscribe(); };
  }, [identity.userId, identity.schoolId]);
  const action = nextActionDisplay(governed, today);
  const planCurrent = today.state === "ready" && today.data?.availability === "current";
  const assignedCurrent = assignments.state === "ready";
  const work = (assignments.data?.assignments ?? []).filter((item) => !item.submission?.turnedInAt);
  const lessons = [...(today.data?.items ?? []), ...(today.data?.catchUpItems ?? [])].filter((item, index, all) => item.status !== "completed" && all.findIndex((other) => other.id === item.id) === index);
  const limit = young ? 3 : 5;
  const dueWork = work.filter((item) => item.isOverdue || item.dueAt && Date.parse(item.dueAt) <= Date.now() + 86400000);
  const rows = [...dueWork, ...work.filter((item) => !dueWork.includes(item))];
  const title = action.state === "ready" ? action.title : action.state === "loading" ? "Finding your next step…" : action.state === "empty" ? "Choose your next step" : "Your next step is unavailable";
  return <main className="pdv2-today" aria-labelledby="today-heading">
    <header className="pdv2-topbar"><div><p className="pdv2-eyebrow">{new Date().toLocaleDateString("en-LR", { weekday: "long", day: "numeric", month: "long" })}</p><h1 id="today-heading">Today, {identity.name.split(" ")[0]}</h1></div>
      <div className="pdv2-top-actions"><span className="pdv2-status" role="status">{offline ? "Offline · current state unknown" : "Connected"}</span><NotificationBell tactile /><InteractiveButton href="/student/messages">Messages →</InteractiveButton></div></header>
    <section className="pdv2-hero" aria-labelledby="next-heading" aria-busy={action.state === "loading"}>
      <div><p className="pdv2-eyebrow">Your next step</p><h2 id="next-heading">{title}</h2>
        <p>{action.state === "ready" ? action.reason : action.state === "loading" ? "Checking your authorized learning activity and school plan." : action.message}</p>
        {action.state === "ready" && <p className="pdv2-meta">{offline ? "Last loaded activity · reconnect to check" : "Online required"}</p>}
        <div className="pdv2-hero-actions">{action.state === "ready" ? offline ? <InteractiveButton primary disabled>Reconnect to continue</InteractiveButton> : <InteractiveButton primary href={action.href}>{young ? "Continue" : action.label} →</InteractiveButton> : action.state === "empty" ? <InteractiveButton primary href="/student/lessons">Explore lessons →</InteractiveButton> : action.state !== "loading" ? <InteractiveButton primary onClick={() => void refresh()} disabled={refreshing}>{refreshing ? "Checking…" : "Try again"}</InteractiveButton> : <p role="status">Loading learning action…</p>}
          <InteractiveButton href="/student/ai-tutor">Get help →</InteractiveButton></div><p className="pdv2-meta">AI help needs a connection.</p>
      </div>
      <div className="pdv2-hero-context"><p className="pdv2-eyebrow">Help for your learning</p><p>Open your activity for the learning question and its permitted tools.</p><p className="pdv2-meta">AI help needs a connection. Your teacher can help when an activity is unavailable.</p></div>
    </section>
    {dueWork[0] && <div className="pdv2-critical-due"><InteractiveButton href={`/student/assignments/${encodeURIComponent(dueWork[0].id)}`} aria-label={`Open due work: ${dueWork[0].title}`}><span>{dueWork[0].isOverdue ? "Overdue" : "Due soon"}: {dueWork[0].title}{!assignedCurrent ? " · Last loaded" : ""}</span><span aria-hidden="true">→</span></InteractiveButton></div>}
    <div className="pdv2-content-grid">
      <section className="pdv2-plan" aria-labelledby="plan-heading"><div className="pdv2-section-header"><div><p className="pdv2-eyebrow">Assigned and scheduled</p><h2 id="plan-heading">Your learning plan</h2></div><InteractiveButton onClick={() => void refresh()} disabled={refreshing} aria-busy={refreshing}>{refreshing ? "Checking…" : "Refresh"}</InteractiveButton></div>
        {assignments.state === "loading" ? <p role="status">Loading assigned work…</p> : !assignedCurrent ? <p role="status" className="pdv2-error">Assigned work could not refresh. Last loaded items may have changed; try again.</p> : rows.length === 0 ? <p>No open assignments were returned. Scheduled lessons appear below.</p> : null}
        <ul className="pdv2-plan-list">{(expanded ? rows : rows.slice(0, limit)).map((item) => <li key={item.id}><div><p className="pdv2-meta">{item.subject.replaceAll("_", " ")}</p><h3>{item.title}</h3><p className={item.isOverdue ? "pdv2-due" : ""}>{dueText(item)}{!assignedCurrent ? " · Last loaded" : ""}</p></div><InteractiveButton href={`/student/assignments/${encodeURIComponent(item.id)}`} aria-label={`Open assignment: ${item.title}`}>Open →</InteractiveButton></li>)}</ul>
        {rows.length > limit && <InteractiveButton onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? "Show fewer" : `Show all ${rows.length} assignments`}</InteractiveButton>}
        <InteractiveButton href="/student/assignments">All assignments →</InteractiveButton>
        {today.state === "loading" ? <p role="status">Loading school plan…</p> : !planCurrent ? <p className="pdv2-error" role="status">{today.data?.availability === "stale" ? "Last known school plan · current status unknown." : "School plan could not load. This does not mean there is no work."}</p> : lessons.length === 0 ? <p>No unfinished scheduled lessons were returned.</p> : null}
        <ul className="pdv2-plan-list">{lessons.slice(0, expanded ? undefined : limit).map((item) => <li key={item.id}><div><p className="pdv2-meta">{item.subject.replaceAll("_", " ")}</p><h3>{item.title}</h3><p>{item.status === "in_progress" ? "In progress" : "Scheduled lesson"}{!planCurrent ? " · Last loaded" : ""}</p><ResourceState contentId={item.contentId} href={item.lessonHref} /></div>{studentTarget(item.lessonHref) ? <InteractiveButton href={item.lessonHref} aria-label={`Open lesson: ${item.title}`}>Open →</InteractiveButton> : <span className="pdv2-error">Target unavailable</span>}</li>)}</ul>
        {lessons.length > limit && !expanded && <InteractiveButton onClick={() => setExpanded(true)}>Show more lessons</InteractiveButton>}
        <details><summary>School timetable</summary>{planCurrent && today.data?.schoolDay ? <><p>{today.data.schoolDay.note}</p><ul className="pdv2-plan-list">{today.data.schoolDay.items.map((item) => <li key={item.id}><div><h3>{item.title ?? item.subject?.replaceAll("_", " ") ?? "Class period"}</h3><p>{item.timeRange ?? "Time not provided"} · {item.status}</p></div>{studentTarget(item.primaryAction.href) && <InteractiveButton href={item.primaryAction.href}>{item.primaryAction.label} →</InteractiveButton>}</li>)}</ul></> : <p>Current timetable unavailable.</p>}</details>
      </section>
      <div className="pdv2-context-column"><section aria-labelledby="progress-heading"><p className="pdv2-eyebrow">Progress</p><h2 id="progress-heading">Work you finished</h2>
        {planCurrent && typeof today.data?.completedCount === "number" ? <p className="pdv2-completion">{today.data.completedCount} scheduled lesson{today.data.completedCount === 1 ? "" : "s"} completed today</p> : <p>Current completion information is unavailable.</p>}
        <p>Completion records work you finished. It does not measure mastery; learning evidence is shown in Progress.</p><InteractiveButton href="/student/progress">View progress →</InteractiveButton></section>
        <section aria-labelledby="support-heading"><p className="pdv2-eyebrow">Support and offline</p><h2 id="support-heading">Help is here</h2><p role="status">{queue}</p><p>Downloads are usable only when verified on this device.</p><div className="pdv2-support-actions"><InteractiveButton href="/student/offline-lessons">Offline lessons →</InteractiveButton><InteractiveButton href="/student/offline-status">Sync status →</InteractiveButton></div></section>
      </div>
    </div>
    <details className="pdv2-secondary"><summary>School updates</summary><AnnouncementBanner /></details>
    <details className="pdv2-secondary"><summary>From your teachers</summary>{teacherLessons.state !== "ready" && <p role="status">{teacherLessons.state === "loading" ? "Loading teacher lessons…" : "Teacher lessons could not load. Try Refresh."}</p>}<ul className="pdv2-plan-list">{teacherLessons.data?.lessons.map((lesson) => <li key={lesson.id}><div><h3>{lesson.title ?? "Teacher lesson"}</h3><p>{lesson.subject.replaceAll("_", " ")}{teacherLessons.state === "error" ? " · Last loaded" : ""}</p></div><InteractiveButton href={lesson.lessonHref}>Open →</InteractiveButton></li>)}</ul>{teacherLessons.state === "ready" && teacherLessons.data?.lessons.length === 0 && <p>No teacher lessons were returned.</p>}</details>
    <details className="pdv2-secondary"><summary>Live classes and calendar</summary><p>Live classes require a connection.</p><LiveSessionBanner /><InteractiveButton href="/student/events">Open calendar →</InteractiveButton></details>
  </main>;
}

function validLesson(row: any): boolean {
  return !!row && typeof row.id === "string" && typeof row.title === "string" && typeof row.subject === "string" && typeof row.lessonHref === "string" && typeof row.contentId === "string" && ["not_started", "in_progress", "completed"].includes(row.status);
}
const nullableText = (value: unknown) => value == null || typeof value === "string";
function validToday(d: any): boolean {
  return !!d && ["current", "stale", "unavailable"].includes(d.availability) &&
    Array.isArray(d.items) && d.items.every(validLesson) &&
    (!d.catchUpItems || Array.isArray(d.catchUpItems) && d.catchUpItems.every(validLesson)) &&
    (d.completedCount == null || Number.isInteger(d.completedCount) && d.completedCount >= 0) &&
    (!d.todayFocus || typeof d.todayFocus.primaryHref === "string" && typeof d.todayFocus.primaryLabel === "string" && typeof d.todayFocus.currentOrNext === "string") &&
    (!d.schoolDay || nullableText(d.schoolDay.note) && Array.isArray(d.schoolDay.items) && d.schoolDay.items.every((row: any) => row && typeof row.id === "string" && nullableText(row.subject) && nullableText(row.title) && nullableText(row.timeRange) && typeof row.status === "string" && row.primaryAction && typeof row.primaryAction.href === "string" && typeof row.primaryAction.label === "string"));
}

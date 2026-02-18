"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { addToQueue, isOnline } from "@/lib/offline-queue";

type LessonData = {
  id: string;
  title: string;
  subject: string;
  grade: number;
  contentType: string;
  body: any;
  objectives: string[];
  activities: string[];
  labs: any[];
  durationMins: number;
  status: string;
  completedAt: string | null;
  startedAt: string | null;
};

export default function ScheduledWorkPage() {
  const params = useParams();
  const scheduledWorkId = params.scheduledWorkId as string;
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/student/work/${scheduledWorkId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setLesson(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [scheduledWorkId]);

  const [offline, setOffline] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);

  useEffect(() => {
    setOffline(!isOnline());
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, []);

  async function handleComplete() {
    setCompleting(true);
    try {
      if (!isOnline()) {
        await addToQueue(scheduledWorkId, new Date().toISOString());
        setSavedOffline(true);
        setLesson((prev) => prev ? { ...prev, status: "completed", completedAt: new Date().toISOString() } : prev);
      } else {
        const res = await fetch(`/api/student/work/${scheduledWorkId}/complete`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        setLesson((prev) => prev ? { ...prev, status: "completed", completedAt: data.completedAt } : prev);
      }
    } catch (err: any) {
      // Fallback to offline queue if network fails
      await addToQueue(scheduledWorkId, new Date().toISOString());
      setSavedOffline(true);
      setLesson((prev) => prev ? { ...prev, status: "completed", completedAt: new Date().toISOString() } : prev);
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-slate-800 animate-pulse" />
        <div className="h-64 rounded-2xl bg-slate-800/50 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-slate-900/70 p-8 text-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!lesson) return null;

  const bodyContent = typeof lesson.body === "string" ? lesson.body : JSON.stringify(lesson.body, null, 2);

  return (
    <div className="space-y-6 max-w-3xl">
      {offline && (
        <div className="rounded-xl bg-amber-500/20 border border-amber-500/30 px-4 py-2 text-sm text-amber-300">
          You are offline. Lesson content is cached. Completions will sync when you reconnect.
        </div>
      )}
      {savedOffline && (
        <div className="rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 text-sm text-emerald-300">
          Saved offline — will sync when connected
        </div>
      )}
      <div>
        <a href="/student/today" className="text-xs text-emerald-400 hover:underline">&larr; Back to Today&apos;s Work</a>
        <h1 className="text-2xl font-bold mt-2">{lesson.title}</h1>
        <p className="text-sm text-slate-400">{lesson.subject} &middot; Grade {lesson.grade} &middot; {lesson.durationMins} min</p>
      </div>

      {lesson.objectives.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-sm font-semibold text-emerald-400 mb-2">Learning Objectives</h2>
          <ul className="space-y-1">
            {lesson.objectives.map((obj, i) => (
              <li key={i} className="text-sm text-slate-300 flex gap-2">
                <span className="text-emerald-500">&#10003;</span>
                {typeof obj === "string" ? obj : JSON.stringify(obj)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Lesson Content</h2>
        <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{bodyContent}</div>
      </section>

      {lesson.activities.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-sm font-semibold text-amber-400 mb-2">Activities</h2>
          <ul className="space-y-1">
            {lesson.activities.map((act, i) => (
              <li key={i} className="text-sm text-slate-300">{i + 1}. {typeof act === "string" ? act : JSON.stringify(act)}</li>
            ))}
          </ul>
        </section>
      )}

      {lesson.labs.length > 0 && (
        <section className="rounded-2xl border border-violet-500/20 bg-slate-900/70 p-5">
          <h2 className="text-sm font-semibold text-violet-400 mb-2">Lab Activities</h2>
          {lesson.labs.map((lab, i) => (
            <div key={i} className="mt-2 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-sm font-medium text-slate-200">{lab.title || `Lab ${i + 1}`}</p>
              <p className="text-xs text-slate-400 mt-1">{lab.description || JSON.stringify(lab)}</p>
            </div>
          ))}
        </section>
      )}

      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        {lesson.status === "completed" ? (
          <div className="text-center">
            <p className="text-emerald-400 font-semibold">Lesson Completed</p>
            <p className="text-xs text-slate-500 mt-1">
              Completed {new Date(lesson.completedAt!).toLocaleString()}
            </p>
          </div>
        ) : (
          <button
            onClick={handleComplete}
            disabled={completing}
            className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
          >
            {completing ? "Saving..." : "Mark Complete"}
          </button>
        )}
      </div>
    </div>
  );
}

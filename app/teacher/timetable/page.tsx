"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, BookOpen, X } from "lucide-react";
import { SkeletonCard } from "@/components/ui/Skeleton";

type Period = {
  id: string;
  classId: string;
  className: string | null;
  periodLabel: string;
  subject: string;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
  assignment: {
    id: string;
    title: string;
    contentId: string | null;
    instructions: string | null;
  } | null;
};

type AssignForm = {
  slotId: string;
  periodLabel: string;
  title: string;
  curriculumContentId: string;
  instructions: string;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function todayName() {
  return WEEKDAYS[new Date().getDay()];
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function to12Hour(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr ?? "00"} ${ampm}`;
}

function timeRange(period: Period): string {
  if (period.startTime && period.endTime) {
    return `${to12Hour(period.startTime)} – ${to12Hour(period.endTime)}`;
  }
  if (period.startTime) return to12Hour(period.startTime);
  return "";
}

export default function TeacherTimetablePage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState<AssignForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/timetable/today");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load timetable.");
      setPeriods(data.periods ?? []);
    } catch (err: any) {
      setError(err.message ?? "Failed to load timetable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openAssign(period: Period) {
    setAssignForm({
      slotId: period.id,
      periodLabel: period.periodLabel,
      title: period.assignment?.title ?? "",
      curriculumContentId: period.assignment?.contentId ?? "",
      instructions: period.assignment?.instructions ?? "",
    });
    setSaveError(null);
  }

  function closeAssign() {
    setAssignForm(null);
    setSaveError(null);
  }

  async function handleAssign(event: React.FormEvent) {
    event.preventDefault();
    if (!assignForm) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/teacher/timetable/${assignForm.slotId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedDate: todayISO(),
          title: assignForm.title,
          curriculumContentId: assignForm.curriculumContentId || null,
          instructions: assignForm.instructions || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save assignment.");
      closeAssign();
      await load();
    } catch (err: any) {
      setSaveError(err.message ?? "Failed to save assignment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(slotId: string) {
    if (!confirm("Remove this lesson assignment?")) return;
    try {
      const res = await fetch(
        `/api/teacher/timetable/${slotId}/assign?assignedDate=${todayISO()}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to remove assignment.");
      await load();
    } catch {
      setError("Failed to remove assignment.");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#06b6d422,_transparent_60%)]" />
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <header>
          <Link
            href="/teacher/dashboard"
            className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold">My Timetable</h1>
          <p className="text-sm text-[var(--ll-text-muted)]">
            {todayName()},{" "}
            {new Date().toLocaleDateString("en-LR", {
              month: "long",
              day: "numeric",
            })}{" "}
            — assign lessons to each period for today.
          </p>
        </header>

        {error ? (
          <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : periods.length === 0 ? (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-6 text-center">
            <Clock className="mx-auto h-8 w-8 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
            <p className="mt-3 text-sm text-[var(--ll-text-muted)]">
              No timetable periods found for today. Ask your school admin to set up your
              timetable in the Admin Console.
            </p>
            <Link
              href="/admin/timetable"
              className="mt-4 inline-block text-xs text-[var(--ll-yellow)] hover:underline"
            >
              Admin: Set up timetable →
            </Link>
          </section>
        ) : (
          <div className="space-y-3">
            {periods.map((period) => (
              <section
                key={period.id}
                className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--ll-text-faint)]">
                        {timeRange(period) || period.periodLabel}
                      </span>
                      {timeRange(period) ? (
                        <span className="rounded-full bg-[var(--ll-surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--ll-text-faint)]">
                          {period.periodLabel}
                        </span>
                      ) : null}
                      {period.room ? (
                        <span className="text-xs text-[var(--ll-text-faint)]">
                          · {period.room}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[var(--ll-text)]">
                      {period.subject.replace(/_/g, " ")}
                      {period.className ? (
                        <span className="ml-2 font-normal text-[var(--ll-text-muted)]">
                          — {period.className}
                        </span>
                      ) : null}
                    </p>
                    {period.assignment ? (
                      <div className="mt-2 flex items-start gap-2">
                        <BookOpen
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ll-accent)]"
                          strokeWidth={1.5}
                        />
                        <p className="text-sm text-[var(--ll-text)]">
                          {period.assignment.title}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-[var(--ll-text-faint)]">
                        No lesson assigned for today
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openAssign(period)}
                      className="rounded-lg border border-[var(--ll-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-text)] hover:border-[var(--ll-border-strong)]"
                    >
                      {period.assignment ? "Change" : "Assign Lesson"}
                    </button>
                    {period.assignment ? (
                      <button
                        type="button"
                        onClick={() => handleRemove(period.id)}
                        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:border-red-500/60"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Assign lesson panel */}
        {assignForm ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
            <div className="w-full max-w-md rounded-t-2xl border border-[var(--ll-border)] bg-[var(--ll-bg)] p-6 sm:rounded-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Assign Lesson — {assignForm.periodLabel}
                </h2>
                <button
                  type="button"
                  onClick={closeAssign}
                  className="rounded-full p-1 hover:bg-[var(--ll-surface)]"
                >
                  <X className="h-5 w-5 text-[var(--ll-text-muted)]" strokeWidth={1.5} />
                </button>
              </div>
              <form onSubmit={handleAssign} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs text-[var(--ll-text-muted)]">
                    Lesson Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={assignForm.title}
                    onChange={(e) =>
                      setAssignForm((f) => f && { ...f, title: e.target.value })
                    }
                    placeholder="e.g. Algebra: Quadratic Equations"
                    required
                    className="mt-1 min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--ll-text-muted)]">
                    Content ID (optional — paste from lesson library)
                  </label>
                  <input
                    value={assignForm.curriculumContentId}
                    onChange={(e) =>
                      setAssignForm((f) => f && { ...f, curriculumContentId: e.target.value })
                    }
                    placeholder="content-abc123"
                    className="mt-1 min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--ll-text-muted)]">
                    Instructions (optional)
                  </label>
                  <textarea
                    value={assignForm.instructions}
                    onChange={(e) =>
                      setAssignForm((f) => f && { ...f, instructions: e.target.value })
                    }
                    rows={3}
                    placeholder="Any notes for students..."
                    className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm"
                  />
                </div>
                {saveError ? (
                  <p className="text-sm text-red-300">{saveError}</p>
                ) : null}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-xl bg-[var(--ll-yellow)] px-4 py-3 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save Assignment"}
                  </button>
                  <button
                    type="button"
                    onClick={closeAssign}
                    className="rounded-xl border border-[var(--ll-border)] px-4 py-3 text-sm font-semibold text-[var(--ll-text)]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

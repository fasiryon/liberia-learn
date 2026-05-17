"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LessonEditor } from "@/components/editor/LessonEditor";

type TeacherClass = { id: string; name: string; subject: string };
type TeacherLesson = { id: string; contentId: string; title: string | null };

export default function CustomAssignmentCreatePage() {
  const router = useRouter();
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [lessons, setLessons] = useState<TeacherLesson[]>([]);
  const [form, setForm] = useState({
    classId: "",
    title: "",
    dueAt: "",
    points: 100,
    contentId: "",
  });
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/teacher/dashboard")
      .then((r) => r.json())
      .then((data) => setClasses(data.classes ?? []))
      .catch(() => null);

    fetch("/api/teacher/lessons/mine")
      .then((r) => r.json())
      .then((data) =>
        setLessons(
          (data.lessons ?? []).filter(
            (l: any) => l.status === "approved" || l.editReviewStatus === "APPROVED"
          )
        )
      )
      .catch(() => null);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.classId) { setError("Please select a class."); return; }
    if (!form.title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        classId: form.classId,
        title: form.title.trim(),
        description: instructions || "",
        points: form.points,
        generationMethod: "manual",
        ...(form.dueAt ? { dueAt: form.dueAt } : {}),
        ...(form.contentId ? { contentId: form.contentId } : {}),
      };
      const res = await fetch("/api/teacher/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create assignment");
      router.push("/teacher/assignments");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <Link href="/teacher/assignments" className="text-sm text-[var(--ll-yellow)]">
            Back to assignments
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Create Custom Assignment</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Custom assignments go live immediately — no admin review required.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-xs text-[var(--ll-text-muted)]">Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Chapter 4 Review"
                  className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--ll-text-muted)]">Class *</label>
                <select
                  required
                  value={form.classId}
                  onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-[var(--ll-text-muted)]">Due date</label>
                <input
                  type="date"
                  value={form.dueAt}
                  onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--ll-text-muted)]">Max score</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={form.points}
                  onChange={(e) => setForm((f) => ({ ...f, points: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm md:w-32"
                />
              </div>

              {lessons.length > 0 && (
                <div>
                  <label className="block text-xs text-[var(--ll-text-muted)]">Attach to lesson (optional)</label>
                  <select
                    value={form.contentId}
                    onChange={(e) => setForm((f) => ({ ...f, contentId: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
                  >
                    <option value="">No lesson</option>
                    {lessons.map((l) => (
                      <option key={l.contentId} value={l.contentId}>
                        {l.title ?? l.contentId}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs text-[var(--ll-text-muted)]">Instructions</label>
              <div className="mt-1">
                <LessonEditor
                  onChange={setInstructions}
                  placeholder="Write assignment instructions here..."
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !form.title.trim() || !form.classId}
              className="rounded-xl bg-[var(--ll-yellow-soft)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Assignment"}
            </button>
            <Link
              href="/teacher/assignments"
              className="rounded-xl border border-[var(--ll-border)] px-5 py-3 text-sm"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

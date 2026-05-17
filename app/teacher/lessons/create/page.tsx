"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LessonEditor } from "@/components/editor/LessonEditor";

const SUBJECTS = ["SCIENCE", "MATH", "LITERACY", "SOCIAL_STUDIES"] as const;
const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

export default function LessonCreatePage() {
  const router = useRouter();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    classId: "",
    title: "",
    subject: "MATH" as (typeof SUBJECTS)[number],
    grade: 1,
    submitForReview: true,
  });
  const [bodyHtml, setBodyHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/teacher/dashboard")
      .then((r) => r.json())
      .then((data) => setClasses(data.classes ?? []))
      .catch(() => null);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bodyHtml.trim() || bodyHtml === "<p></p>") {
      setError("Lesson body is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: form.classId,
          title: form.title.trim(),
          content: bodyHtml,
          assessmentQuestions: ["Review question 1"],
          estimatedMinutes: 45,
          status: "draft",
          source: "TEACHER",
          editReviewStatus: form.submitForReview ? "PENDING" : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create lesson");
      router.push("/teacher/curriculum");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <Link href="/teacher/curriculum" className="text-sm text-[var(--ll-yellow)]">
            Back to curriculum
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Create Lesson</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Write a lesson from scratch. It will enter the admin review queue before going live.
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
                  placeholder="e.g. Introduction to Fractions"
                  className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--ll-text-muted)]">Subject</label>
                <select
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value as any }))}
                  className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-[var(--ll-text-muted)]">Grade</label>
                <select
                  value={form.grade}
                  onChange={(e) => setForm((f) => ({ ...f, grade: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>Grade {g}</option>
                  ))}
                </select>
              </div>

              {classes.length > 0 && (
                <div>
                  <label className="block text-xs text-[var(--ll-text-muted)]">Class (optional)</label>
                  <select
                    value={form.classId}
                    onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
                  >
                    <option value="">No class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs text-[var(--ll-text-muted)]">Lesson body *</label>
              <div className="mt-1">
                <LessonEditor onChange={setBodyHtml} />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.submitForReview}
                onChange={(e) => setForm((f) => ({ ...f, submitForReview: e.target.checked }))}
                className="rounded"
              />
              Submit for admin review after saving
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="rounded-xl bg-[var(--ll-yellow-soft)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Create Lesson"}
            </button>
            <Link
              href="/teacher/curriculum"
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TeacherAssignmentCreateFormProps = {
  classes: Array<{
    id: string;
    name: string;
    subject: string;
  }>;
  initialValues: {
    classId: string;
    title: string;
    description: string;
    dueAt: string;
    points: string;
    contentId: string;
    scheduledWorkId: string;
    generationMethod: string;
    moeStandardCodes: string;
  };
};

export default function TeacherAssignmentCreateForm({
  classes,
  initialValues,
}: TeacherAssignmentCreateFormProps) {
  const router = useRouter();
  const [classId, setClassId] = useState(initialValues.classId);
  const [title, setTitle] = useState(initialValues.title);
  const [description, setDescription] = useState(initialValues.description);
  const [dueAt, setDueAt] = useState(initialValues.dueAt);
  const [points, setPoints] = useState(initialValues.points);
  const [contentId, setContentId] = useState(initialValues.contentId);
  const [scheduledWorkId, setScheduledWorkId] = useState(initialValues.scheduledWorkId);
  const [generationMethod, setGenerationMethod] = useState(initialValues.generationMethod);
  const [moeStandardCodes, setMoeStandardCodes] = useState(initialValues.moeStandardCodes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/teacher/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          title,
          description,
          dueAt: dueAt || undefined,
          points: Number(points),
          contentId: contentId || undefined,
          scheduledWorkId: scheduledWorkId || undefined,
          generationMethod,
          moeStandardCodes: moeStandardCodes
            .split(",")
            .map((code) => code.trim())
            .filter(Boolean),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to create assignment.");
      }

      router.push(`/teacher/assignments?created=1&assignmentId=${payload.assignment.id}`);
      router.refresh();
    } catch (submitError: any) {
      setError(submitError?.message ?? "Failed to create assignment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <section className="grid gap-6 rounded-3xl border border-white/10 bg-slate-900/70 p-6 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="text-slate-200">Class</span>
          <select
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            className="min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
            required
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} ({cls.subject.replace(/_/g, " ")})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-slate-200">Points</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={points}
            onChange={(event) => setPoints(event.target.value)}
            className="min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
            required
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="text-slate-200">Title</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
            placeholder="Fractions exit ticket"
            required
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="text-slate-200">Instructions</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-40 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
            placeholder="Explain the task, expected format, and any success criteria."
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-slate-200">Due date</span>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className="min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-slate-200">Generation method</span>
          <select
            value={generationMethod}
            onChange={(event) => setGenerationMethod(event.target.value)}
            className="min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
          >
            <option value="manual">Manual</option>
            <option value="ai_generated">AI generated</option>
            <option value="suggested">Suggested</option>
          </select>
        </label>
      </section>

      <section className="grid gap-6 rounded-3xl border border-white/10 bg-slate-900/70 p-6 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="text-slate-200">Scheduled work ID</span>
          <input
            type="text"
            value={scheduledWorkId}
            onChange={(event) => setScheduledWorkId(event.target.value)}
            className="min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
            placeholder="Optional lesson schedule reference"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-slate-200">Curriculum content ID</span>
          <input
            type="text"
            value={contentId}
            onChange={(event) => setContentId(event.target.value)}
            className="min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
            placeholder="Optional curriculum content reference"
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="text-slate-200">MOE standard codes</span>
          <input
            type="text"
            value={moeStandardCodes}
            onChange={(event) => setMoeStandardCodes(event.target.value)}
            className="min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
            placeholder="Optional comma-separated alignment codes"
          />
        </label>

        <p className="text-sm text-slate-400 md:col-span-2">
          These optional linkage fields keep assignment creation compatible with lesson-linked
          suggestions and AI-generated drafts, but the assignment itself can now be created
          directly from this page.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-400 px-5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Creating..." : "Create Assignment"}
        </button>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </form>
  );
}

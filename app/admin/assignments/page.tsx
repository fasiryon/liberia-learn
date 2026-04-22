"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/admin/AdminNav";

type TeacherRef = { id: string; name: string };
type ClassRef = { id: string; name: string; subject: string };
type AssignmentRow = {
  id: string;
  teacherId: string;
  classId: string;
  subject: string;
  isPrimary: boolean;
  teacher: TeacherRef | null;
  class: ClassRef | null;
};

const SUBJECTS = [
  "MATH",
  "SCIENCE",
  "COMPUTER_SCIENCE",
  "ENGINEERING",
  "LITERACY",
  "CIVICS",
  "ARTS",
  "PE",
  "CAREER",
];

const emptyForm = {
  teacherId: "",
  classId: "",
  subject: "",
  isPrimary: true,
};

export default function AdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRef[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/assignments", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load assignments.");
      setAssignments(data.assignments ?? []);
      setTeachers(data.teachers ?? []);
      setClasses(data.classes ?? []);
    } catch (err: any) {
      setError(err.message ?? "Unable to load assignments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === form.classId) ?? null,
    [classes, form.classId]
  );

  useEffect(() => {
    if (!selectedClass) return;
    setForm((current) =>
      current.subject ? current : { ...current, subject: selectedClass.subject }
    );
  }, [selectedClass]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = editingId
        ? { assignmentId: editingId, ...form }
        : form;
      const res = await fetch("/api/admin/assignments", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to save assignment.");
      await load();
      resetForm();
    } catch (err: any) {
      setError(err.message ?? "Unable to save assignment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this teacher assignment?")) return;
    const res = await fetch("/api/admin/assignments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId: id }),
    });
    if (!res.ok) {
      setError("Unable to delete assignment.");
      return;
    }
    setAssignments((current) => current.filter((item) => item.id !== id));
  }

  function handleEdit(item: AssignmentRow) {
    setEditingId(item.id);
    setForm({
      teacherId: item.teacherId,
      classId: item.classId,
      subject: item.subject,
      isPrimary: item.isPrimary,
    });
    setError(null);
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#10b98122,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <header>
          <Link href="/admin" className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            Back to Admin Console
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Teacher Assignments</h1>
          <p className="text-sm text-[var(--ll-text-muted)]">
            Control which teacher owns each class and subject workflow.
          </p>
        </header>

        <AdminNav />

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <h2 className="text-lg font-semibold">
            {editingId ? "Update assignment" : "Create assignment"}
          </h2>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs text-[var(--ll-text-muted)]">Teacher</label>
              <select
                value={form.teacherId}
                onChange={(event) => setForm((current) => ({ ...current, teacherId: event.target.value }))}
                className="mt-1 min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm"
                required
              >
                <option value="">Select teacher...</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--ll-text-muted)]">Class</label>
              <select
                value={form.classId}
                onChange={(event) => setForm((current) => ({ ...current, classId: event.target.value }))}
                className="mt-1 min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm"
                required
              >
                <option value="">Select class...</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--ll-text-muted)]">Subject</label>
              <select
                value={form.subject}
                onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                className="mt-1 min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm"
                required
              >
                <option value="">Select subject...</option>
                {SUBJECTS.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]">
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isPrimary: event.target.checked }))
                }
              />
              Primary assignment for this class and subject
            </label>
            <div className="md:col-span-2 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[var(--ll-yellow)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-60"
              >
                {saving ? "Saving..." : editingId ? "Save Assignment" : "Create Assignment"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-[var(--ll-border)] px-5 py-3 text-sm font-semibold text-[var(--ll-text)]"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-xl bg-[var(--ll-surface)]/60" />
              ))}
            </div>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-[var(--ll-text-muted)]">No teacher assignments created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--ll-border)] text-left text-xs text-[var(--ll-text-faint)]">
                    <th className="px-4 py-3">Teacher</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Primary</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 text-[var(--ll-text)]">
                      <td className="px-4 py-3">{item.teacher?.name ?? "-"}</td>
                      <td className="px-4 py-3">{item.class?.name ?? "-"}</td>
                      <td className="px-4 py-3">{item.subject.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3">{item.isPrimary ? "Yes" : "No"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-[11px] font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="rounded-full border border-red-500/30 px-3 py-1 text-[11px] font-semibold text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

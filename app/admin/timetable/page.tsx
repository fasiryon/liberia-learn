"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/admin/AdminNav";

type TeacherRef = { id: string; name: string };
type ClassRef = { id: string; name: string; subject: string };
type TimetableRow = {
  id: string;
  classId: string;
  teacherId: string;
  subject: string;
  dayOfWeek: string;
  periodLabel: string;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
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

const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

const emptyForm = {
  classId: "",
  teacherId: "",
  subject: "",
  dayOfWeek: "MONDAY",
  periodLabel: "",
  startTime: "",
  endTime: "",
  room: "",
};

export default function AdminTimetablePage() {
  const [timetable, setTimetable] = useState<TimetableRow[]>([]);
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
      const res = await fetch("/api/admin/timetable", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load timetable.");
      setTimetable(data.timetable ?? []);
      setTeachers(data.teachers ?? []);
      setClasses(data.classes ?? []);
    } catch (err: any) {
      setError(err.message ?? "Unable to load timetable.");
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
        ? { timetableId: editingId, ...form }
        : form;
      const res = await fetch("/api/admin/timetable", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          startTime: form.startTime || null,
          endTime: form.endTime || null,
          room: form.room || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to save timetable entry.");
      await load();
      resetForm();
    } catch (err: any) {
      setError(err.message ?? "Unable to save timetable entry.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this timetable entry?")) return;
    const res = await fetch("/api/admin/timetable", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timetableId: id }),
    });
    if (!res.ok) {
      setError("Unable to delete timetable entry.");
      return;
    }
    setTimetable((current) => current.filter((item) => item.id !== id));
  }

  function handleEdit(item: TimetableRow) {
    setEditingId(item.id);
    setForm({
      classId: item.classId,
      teacherId: item.teacherId,
      subject: item.subject,
      dayOfWeek: item.dayOfWeek,
      periodLabel: item.periodLabel,
      startTime: item.startTime ?? "",
      endTime: item.endTime ?? "",
      room: item.room ?? "",
    });
    setError(null);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#06b6d422,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <header>
          <Link href="/admin" className="text-xs text-emerald-300 hover:text-emerald-200">
            Back to Admin Console
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Timetable Builder</h1>
          <p className="text-sm text-slate-400">
            Build the fixed weekly schedule teachers use to run daily operations.
          </p>
        </header>

        <AdminNav />

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold">
            {editingId ? "Update timetable entry" : "Create timetable entry"}
          </h2>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-xs text-slate-400">Class</label>
              <select
                value={form.classId}
                onChange={(event) => setForm((current) => ({ ...current, classId: event.target.value }))}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
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
              <label className="text-xs text-slate-400">Teacher</label>
              <select
                value={form.teacherId}
                onChange={(event) => setForm((current) => ({ ...current, teacherId: event.target.value }))}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
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
              <label className="text-xs text-slate-400">Subject</label>
              <select
                value={form.subject}
                onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
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
            <div>
              <label className="text-xs text-slate-400">Day</label>
              <select
                value={form.dayOfWeek}
                onChange={(event) => setForm((current) => ({ ...current, dayOfWeek: event.target.value }))}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                required
              >
                {WEEKDAYS.map((day) => (
                  <option key={day} value={day}>
                    {day.charAt(0) + day.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Period Label</label>
              <input
                value={form.periodLabel}
                onChange={(event) => setForm((current) => ({ ...current, periodLabel: event.target.value }))}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                placeholder="Period 1"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Room</label>
              <input
                value={form.room}
                onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                placeholder="Science Lab"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Start Time</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">End Time</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
              />
            </div>
            <div className="md:col-span-3 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {saving ? "Saving..." : editingId ? "Save Timetable Entry" : "Create Timetable Entry"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-800/60" />
              ))}
            </div>
          ) : timetable.length === 0 ? (
            <p className="text-sm text-slate-400">No timetable entries created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                    <th className="px-4 py-3">Day</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Teacher</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {timetable.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 text-slate-200">
                      <td className="px-4 py-3">{item.dayOfWeek}</td>
                      <td className="px-4 py-3">{item.periodLabel}</td>
                      <td className="px-4 py-3">{item.class?.name ?? "-"}</td>
                      <td className="px-4 py-3">{item.teacher?.name ?? "-"}</td>
                      <td className="px-4 py-3">
                        {[item.startTime, item.endTime].filter(Boolean).join(" - ") || "-"}
                      </td>
                      <td className="px-4 py-3">{item.room ?? "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="rounded-full border border-slate-700 px-3 py-1 text-[11px] font-semibold"
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

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ScheduleItem = {
  id: string;
  classId: string;
  className: string;
  contentId: string;
  title: string;
  subject: string;
  scheduledDate: string;
  completedCount: number;
  totalStudents: number;
  isDelivered?: boolean;
  deliveredAt?: string | null;
};

type ClassInfo = { id: string; name: string; subject?: string | null };
type TimetableItem = {
  id: string;
  classId: string;
  teacherId: string;
  subject: string;
  dayOfWeek: string;
  periodLabel: string;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
  class: { id: string; name: string; subject: string } | null;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
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

const DURATIONS = [
  { label: "30 min", minutes: 30 },
  { label: "45 min", minutes: 45 },
  { label: "60 min", minutes: 60 },
  { label: "90 min", minutes: 90 },
];

function toDateOnly(dateStr: string) {
  return new Date(dateStr).toISOString().slice(0, 10);
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toTimeString().slice(0, 5);
}

export default function TeacherSchedulePage() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [timetable, setTimetable] = useState<TimetableItem[]>([]);
  const [weekStart, setWeekStart] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    classId: "",
    subject: "",
    grade: 1,
    topic: "",
    date: "",
    startTime: "",
    duration: 45,
    notes: "",
  });
  const [publishedClassName, setPublishedClassName] = useState<string | null>(
    null
  );
  const [publishSuccess, setPublishSuccess] = useState(false);

  function loadSchedule(weekOf?: string) {
    setLoading(true);
    const url = weekOf ? `/api/teacher/schedule?weekOf=${weekOf}` : "/api/teacher/schedule";
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setClasses(d.classes || []);
        setTimetable(d.timetable || []);
        setWeekStart(d.weekStart || "");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSchedule();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPublishedClassName(params.get("className"));
    setPublishSuccess(params.get("published") === "1");
  }, []);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === form.classId) ?? null,
    [classes, form.classId]
  );

  useEffect(() => {
    if (selectedClass?.subject) {
      setForm((f) => ({ ...f, subject: selectedClass.subject as string }));
    }
  }, [selectedClass]);

  function getWeekDates(): Date[] {
    if (!weekStart) return [];
    const monday = new Date(weekStart);
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() + i);
      return d;
    });
  }

  function prevWeek() {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() - 7);
    loadSchedule(d.toISOString().slice(0, 10));
  }

  function nextWeek() {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + 7);
    loadSchedule(d.toISOString().slice(0, 10));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/teacher/schedule?id=${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleDeliver(id: string) {
    const ok = confirm("Mark this lesson as delivered?");
    if (!ok) return;
    const res = await fetch(`/api/teacher/schedule/${id}/deliver`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      setError("Unable to mark delivered. Please try again.");
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isDelivered: true, deliveredAt: new Date().toISOString() } : i))
    );
  }

  function isPast(dateStr: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    return date < today;
  }

  const conflictWarning = useMemo(() => {
    if (!form.classId || !form.date || !form.startTime) return null;
    const targetDate = form.date;
    const hasConflict = items.some((i) => {
      if (i.classId !== form.classId) return false;
      const itemDate = toDateOnly(i.scheduledDate);
      if (itemDate !== targetDate) return false;
      if (!i.scheduledDate) return false;
      return true;
    });
    return hasConflict
      ? `This class already has a lesson scheduled on ${targetDate}.`
      : null;
  }, [form.classId, form.date, form.startTime, items]);

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.classId || !form.subject || !form.topic || !form.date || !form.startTime) {
      setError("Please fill all required fields.");
      return;
    }
    if (isPast(form.date)) {
      setError("Date cannot be in the past.");
      return;
    }

    setSaving(true);
    try {
      const generateRes = await fetch("/api/admin/curriculum/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: Number(form.grade),
          subject: form.subject,
          topic: form.topic.trim(),
          mode: "lesson",
        }),
      });
      const generateData = await generateRes.json();
      if (!generateRes.ok || !generateData.contentId) {
        throw new Error(generateData.error || "Lesson generation failed");
      }

      const endTime = addMinutes(form.startTime, Number(form.duration));
      const scheduleRes = await fetch("/api/teacher/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: generateData.contentId,
          classId: form.classId,
          scheduledDate: form.date,
          startTime: form.startTime,
          endTime,
          deliveryNotes: form.notes || undefined,
        }),
      });
      const scheduleData = await scheduleRes.json();
      if (!scheduleRes.ok) {
        throw new Error(scheduleData.error || "Scheduling failed");
      }
      setShowForm(false);
      setForm({
        classId: "",
        subject: "",
        grade: 1,
        topic: "",
        date: "",
        startTime: "",
        duration: 45,
        notes: "",
      });
      loadSchedule();
    } catch (err: any) {
      setError(err.message || "Scheduling failed");
    } finally {
      setSaving(false);
    }
  }

  const weekDates = getWeekDates();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Weekly Schedule</h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage lessons scheduled for your classes
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/teacher/create-lesson"
              className="rounded-xl border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10"
            >
              Create with AI
            </Link>
            <button onClick={prevWeek} className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">&larr; Prev</button>
            <button onClick={() => loadSchedule()} className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">This Week</button>
            <button onClick={nextWeek} className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">Next &rarr;</button>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              {showForm ? "Close" : "Schedule Lesson"}
            </button>
          </div>
        </div>

        {publishSuccess && publishedClassName && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Lesson published to {publishedClassName}.
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSchedule} className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 space-y-4">
            <h2 className="text-lg font-semibold">Schedule Lesson</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs text-slate-400">Class *</label>
                <select
                  value={form.classId}
                  onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  required
                >
                  <option value="">Select class...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400">Subject *</label>
                <select
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  required
                >
                  <option value="">Select subject...</option>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                {selectedClass?.subject && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Class subject: {selectedClass.subject}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-400">Grade *</label>
                <select
                  value={form.grade}
                  onChange={(e) => setForm((f) => ({ ...f, grade: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                    <option key={g} value={g}>
                      Grade {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400">Topic / Lesson Title *</label>
                <input
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  placeholder="Fractions and Mixed Numbers"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400">Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400">Start Time *</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400">Duration *</label>
                <select
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                >
                  {DURATIONS.map((d) => (
                    <option key={d.minutes} value={d.minutes}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  rows={2}
                />
              </div>
            </div>
            {conflictWarning && (
              <p className="text-xs text-amber-300">{conflictWarning}</p>
            )}
            {error && <p className="text-xs text-red-300">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {saving ? "Scheduling..." : "Schedule Lesson"}
            </button>
          </form>
        )}

        {loading ? (
          <div className="h-60 rounded-2xl bg-slate-800/50 animate-pulse" />
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-200">Weekly Timetable</h2>
                  <p className="text-xs text-slate-500">Fixed class sessions and ownership for daily operations.</p>
                </div>
              </div>
              {timetable.length === 0 ? (
                <p className="text-sm text-slate-400">No timetable entries assigned yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                  {DAY_LABELS.map((label, index) => {
                    const dayKey = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"][index];
                    const dayItems = timetable.filter((item) => item.dayOfWeek === dayKey);
                    return (
                      <div key={dayKey} className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                        <p className="mb-2 text-xs font-semibold text-slate-400">{label}</p>
                        {dayItems.length === 0 ? (
                          <p className="text-[10px] text-slate-600">No timetable slots</p>
                        ) : (
                          <div className="space-y-2">
                            {dayItems.map((item) => (
                              <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                                <p className="text-xs font-semibold text-slate-100">{item.class?.name ?? "Class"}</p>
                                <p className="text-[11px] text-slate-400">{item.periodLabel}</p>
                                <p className="mt-1 text-[11px] text-emerald-300">
                                  {[item.startTime, item.endTime].filter(Boolean).join(" - ") || "Time TBD"}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  {item.subject.replace(/_/g, " ")}{item.room ? ` - ${item.room}` : ""}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {items.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 text-center text-sm text-slate-400">
                No lessons scheduled yet. Schedule your first lesson.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                {weekDates.map((date, di) => {
                  const dateStr = date.toISOString().slice(0, 10);
                  const dayItems = items.filter(
                    (i) => new Date(i.scheduledDate).toISOString().slice(0, 10) === dateStr
                  );
                  const isToday = dateStr === new Date().toISOString().slice(0, 10);

                  return (
                    <div key={di} className={`rounded-2xl border ${isToday ? "border-emerald-500/30" : "border-white/10"} bg-slate-900/70 p-3`}>
                      <p className={`text-xs font-semibold mb-2 ${isToday ? "text-emerald-400" : "text-slate-400"}`}>
                        {DAY_LABELS[di]} {date.getUTCDate()}
                      </p>
                      {dayItems.length === 0 ? (
                        <p className="text-[10px] text-slate-600">No lessons</p>
                      ) : (
                        <div className="space-y-2">
                          {dayItems.map((item) => {
                            const pct = item.totalStudents > 0 ? Math.round((item.completedCount / item.totalStudents) * 100) : 0;
                            const scheduledDateStr = toDateOnly(item.scheduledDate);
                            const past = isPast(scheduledDateStr);
                            const delivered = item.isDelivered;
                            const statusLabel = delivered
                              ? "Delivered"
                              : past
                              ? "Not Delivered"
                              : "Scheduled";
                            const statusColor = delivered
                              ? "bg-emerald-500/20 text-emerald-300"
                              : past
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-blue-500/20 text-blue-300";
                            return (
                              <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                                <p className="text-[11px] font-medium text-slate-200 truncate">{item.title}</p>
                                <p className="text-[9px] text-slate-500">{item.className}</p>
                                <div className="mt-1 flex items-center justify-between">
                                  <span className="text-[9px] text-emerald-400">{pct}% done</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[9px] ${statusColor}`}>
                                    {statusLabel}
                                  </span>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  {!delivered && (
                                    <button
                                      onClick={() => handleDeliver(item.id)}
                                      className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] text-emerald-300 hover:bg-emerald-500/30"
                                    >
                                      Mark Delivered
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDelete(item.id)}
                                    className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] text-red-300 hover:bg-red-500/20"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

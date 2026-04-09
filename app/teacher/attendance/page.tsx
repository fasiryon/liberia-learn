"use client";

import { useEffect, useMemo, useState } from "react";
import { TeacherNav } from "@/components/teacher/TeacherNav";

type ClassInfo = {
  id: string;
  name: string;
  subject: string;
};

type StudentInfo = {
  studentId: string;
  name: string;
  currentGrade: number | null;
};

type AttendanceRecord = {
  studentId: string;
  status: StatusType;
  notes: string | null;
};

type StatusType = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const STATUS_OPTIONS: StatusType[] = ["PRESENT", "LATE", "EXCUSED", "ABSENT"];

const STATUS_STYLES: Record<StatusType, string> = {
  PRESENT: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30",
  LATE: "bg-amber-500/20 text-amber-200 border-amber-500/30",
  EXCUSED: "bg-sky-500/20 text-sky-200 border-sky-500/30",
  ABSENT: "bg-red-500/20 text-red-200 border-red-500/30",
};

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function TeacherAttendancePage() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(formatDate(new Date()));
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [statuses, setStatuses] = useState<Record<string, StatusType>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(selectedClassId?: string, selectedDate?: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedClassId) params.set("classId", selectedClassId);
      if (selectedDate) params.set("date", selectedDate);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/teacher/attendance${suffix}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load attendance.");

      const nextClasses = data.classes ?? [];
      setClasses(nextClasses);
      if (!selectedClassId && nextClasses.length > 0) {
        setClassId(nextClasses[0].id);
        setDate(selectedDate ?? formatDate(new Date()));
        return;
      }

      const roster = data.roster ?? [];
      const attendance = data.attendance ?? [];
      const nextStatuses: Record<string, StatusType> = {};
      const nextNotes: Record<string, string> = {};

      for (const student of roster) {
        const record = attendance.find((item: AttendanceRecord) => item.studentId === student.studentId);
        nextStatuses[student.studentId] = record?.status ?? "ABSENT";
        nextNotes[student.studentId] = record?.notes ?? "";
      }

      setStudents(roster);
      setStatuses(nextStatuses);
      setNotes(nextNotes);
      setSaved(false);
    } catch (err: any) {
      setError(err.message ?? "Unable to load attendance.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!classId) return;
    void load(classId, date);
  }, [classId, date]);

  const counts = useMemo(
    () => ({
      present: Object.values(statuses).filter((status) => status === "PRESENT").length,
      late: Object.values(statuses).filter((status) => status === "LATE").length,
      excused: Object.values(statuses).filter((status) => status === "EXCUSED").length,
      absent: Object.values(statuses).filter((status) => status === "ABSENT").length,
    }),
    [statuses]
  );

  function markAll(status: StatusType) {
    setStatuses((current) =>
      Object.fromEntries(Object.keys(current).map((studentId) => [studentId, status]))
    );
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const records = students.map((student) => ({
        studentId: student.studentId,
        status: statuses[student.studentId] ?? "ABSENT",
        notes: notes[student.studentId]?.trim() || null,
      }));

      const res = await fetch("/api/teacher/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          date,
          records,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to save attendance.");
      setSaved(true);
    } catch (err: any) {
      setError(err.message ?? "Unable to save attendance.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Daily Attendance</h1>
          <p className="mt-1 text-sm text-slate-400">
            Mark the live class roster for the current day without leaving the teacher console.
          </p>
        </header>

        <TeacherNav />

        <section className="grid gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 md:grid-cols-[1fr,220px,auto]">
          <div>
            <label className="text-xs text-slate-400">Class</label>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
            >
              <option value="">Select class...</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.subject.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Date</label>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void load(classId, date)}
            className="self-end rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Refresh
          </button>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-300">{counts.present}</p>
            <p className="text-xs text-slate-300">Present</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-center">
            <p className="text-2xl font-bold text-amber-300">{counts.late}</p>
            <p className="text-xs text-slate-300">Late</p>
          </div>
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 text-center">
            <p className="text-2xl font-bold text-sky-300">{counts.excused}</p>
            <p className="text-xs text-slate-300">Excused</p>
          </div>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-center">
            <p className="text-2xl font-bold text-red-300">{counts.absent}</p>
            <p className="text-xs text-slate-300">Absent</p>
          </div>
        </section>

        <section className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => markAll(status)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold ${STATUS_STYLES[status]}`}
            >
              Mark All {status.toLowerCase()}
            </button>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
          {saved ? <p className="mb-4 text-sm text-emerald-300">Attendance saved.</p> : null}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-800/60" />
              ))}
            </div>
          ) : !classId ? (
            <p className="text-sm text-slate-400">Select a class to load the roster.</p>
          ) : students.length === 0 ? (
            <p className="text-sm text-slate-400">This class has no enrolled students yet.</p>
          ) : (
            <div className="space-y-3">
              {students.map((student) => (
                <div
                  key={student.studentId}
                  className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[1.2fr,1fr,1.2fr]"
                >
                  <div>
                    <p className="font-semibold text-slate-100">{student.name}</p>
                    <p className="text-xs text-slate-500">
                      Grade {student.currentGrade ?? "-"}
                    </p>
                  </div>
                  <select
                    value={statuses[student.studentId] ?? "ABSENT"}
                    onChange={(event) =>
                      setStatuses((current) => ({
                        ...current,
                        [student.studentId]: event.target.value as StatusType,
                      }))
                    }
                    className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <input
                    value={notes[student.studentId] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [student.studentId]: event.target.value,
                      }))
                    }
                    placeholder="Optional note"
                    className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={save}
          disabled={saving || students.length === 0 || !classId}
          className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Attendance"}
        </button>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

type StatusType = "PRESENT" | "ABSENT" | "LATE";

interface ClassInfo {
  id: string;
  name: string;
}

interface StudentInfo {
  studentId: string;
  name: string;
}

const STATUS_CYCLE: StatusType[] = ["PRESENT", "LATE", "ABSENT"];
const STATUS_COLORS: Record<StatusType, string> = {
  PRESENT: "bg-emerald-600 hover:bg-emerald-700",
  LATE: "bg-amber-600 hover:bg-amber-700",
  ABSENT: "bg-red-600 hover:bg-red-700",
};

export default function AttendancePage() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [statuses, setStatuses] = useState<Record<string, StatusType>>({});
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((data) => setClasses(data.classes ?? data ?? []))
      .catch(() => {});
  }, []);

  async function startSession() {
    if (!classId) return;
    setSaved(false);

    const now = new Date();
    const end = new Date(now.getTime() + 45 * 60 * 1000);

    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId,
        startsAt: now.toISOString(),
        endsAt: end.toISOString(),
      }),
    });

    const data = await res.json();
    setMeetingId(data.meeting?.id ?? null);

    const sRes = await fetch(`/api/class/${classId}/students`);
    const sData = await sRes.json();
    const studentList: StudentInfo[] = (sData.students ?? sData ?? []).map(
      (s: any) => ({
        studentId: s.studentId ?? s.id,
        name: s.name ?? s.user?.name ?? "Student",
      })
    );
    setStudents(studentList);

    const defaultStatuses: Record<string, StatusType> = {};
    for (const s of studentList) {
      defaultStatuses[s.studentId] = "ABSENT";
    }
    setStatuses(defaultStatuses);
  }

  function toggle(studentId: string) {
    setStatuses((prev) => {
      const current = prev[studentId] ?? "ABSENT";
      const idx = STATUS_CYCLE.indexOf(current);
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
      return { ...prev, [studentId]: next };
    });
  }

  function markAll(status: StatusType) {
    setStatuses((prev) => {
      const next: Record<string, StatusType> = {};
      for (const key of Object.keys(prev)) {
        next[key] = status;
      }
      return next;
    });
  }

  async function save() {
    if (!meetingId) return;
    setSaving(true);
    setSaved(false);

    const records = Object.entries(statuses).map(([studentId, status]) => ({
      studentId,
      status,
    }));

    await fetch(`/api/attendance/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records }),
    });

    setSaving(false);
    setSaved(true);
  }

  const counts = {
    present: Object.values(statuses).filter((s) => s === "PRESENT").length,
    late: Object.values(statuses).filter((s) => s === "LATE").length,
    absent: Object.values(statuses).filter((s) => s === "ABSENT").length,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-emerald-400 mb-6">
        Attendance
      </h1>

      {!meetingId ? (
        <div className="space-y-4">
          <label className="block text-sm text-slate-300">Select Class</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white"
          >
            <option value="">-- Choose a class --</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={startSession}
            disabled={!classId}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-lg py-3"
          >
            Start Attendance Session
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats bar */}
          <div className="flex gap-3 text-sm">
            <span className="bg-emerald-800 px-3 py-1 rounded-full">
              Present: {counts.present}
            </span>
            <span className="bg-amber-800 px-3 py-1 rounded-full">
              Late: {counts.late}
            </span>
            <span className="bg-red-800 px-3 py-1 rounded-full">
              Absent: {counts.absent}
            </span>
          </div>

          {/* Quick mark-all buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => markAll("PRESENT")}
              className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white text-sm py-2 rounded-lg"
            >
              All Present
            </button>
            <button
              onClick={() => markAll("LATE")}
              className="flex-1 bg-amber-700 hover:bg-amber-800 text-white text-sm py-2 rounded-lg"
            >
              All Late
            </button>
            <button
              onClick={() => markAll("ABSENT")}
              className="flex-1 bg-red-700 hover:bg-red-800 text-white text-sm py-2 rounded-lg"
            >
              All Absent
            </button>
          </div>

          {/* Student list */}
          <div className="space-y-2">
            {students.map((s) => {
              const status = statuses[s.studentId] ?? "ABSENT";
              return (
                <button
                  key={s.studentId}
                  onClick={() => toggle(s.studentId)}
                  className={`w-full flex justify-between items-center px-4 py-3 rounded-lg text-white font-medium transition-colors ${STATUS_COLORS[status]}`}
                >
                  <span>{s.name}</span>
                  <span className="text-sm opacity-80">{status}</span>
                </button>
              );
            })}
          </div>

          {/* Save button */}
          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg py-3 mt-4"
          >
            {saving ? "Saving..." : saved ? "Saved!" : "Save Attendance"}
          </button>
        </div>
      )}
    </div>
  );
}


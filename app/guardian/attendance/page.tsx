"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { GuardianNav } from "@/components/guardian/GuardianNav";

type Child = { studentId: string; studentName: string };
type AttendanceRecord = { id: string; date: string; status: string; classId: string };

const STATUS_COLORS: Record<string, string> = {
  PRESENT: "bg-emerald-500",
  ABSENT: "bg-red-500",
  LATE: "bg-amber-500",
  EXCUSED: "bg-sky-500",
};

const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

function getMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  // 0=Sun, convert to Mon-first (0=Mon...6=Sun)
  const day = new Date(year, month - 1, 1).getDay();
  return (day + 6) % 7;
}

function toMonthString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function calcAbsentStreak(records: AttendanceRecord[], year: number, month: number): number {
  const days = getDaysInMonth(year, month);
  let streak = 0;
  let maxStreak = 0;
  for (let d = 1; d <= days; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const rec = records.find((r) => r.date.startsWith(dateStr));
    if (rec?.status === "ABSENT") {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else if (rec) {
      streak = 0;
    }
  }
  return maxStreak;
}

export default function GuardianAttendancePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [selectedChildName, setSelectedChildName] = useState<string>("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/guardian/students", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list: Child[] = (d.students ?? []).map((s: { studentId: string; name: string | null }) => ({
          studentId: s.studentId,
          studentName: s.name ?? "Child",
        }));
        setChildren(list);
        if (list.length > 0) {
          setSelectedChildId(list[0].studentId);
          setSelectedChildName(list[0].studentName);
        }
      })
      .catch(() => null);
  }, []);

  const loadRecords = useCallback(async (studentId: string, y: number, m: number) => {
    if (!studentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/guardian/attendance?studentId=${studentId}&month=${toMonthString(y, m)}`);
      if (res.ok) setRecords(await res.json());
      else setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedChildId) loadRecords(selectedChildId, year, month);
  }, [selectedChildId, year, month, loadRecords]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const days = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOfMonth(year, month);
  const recMap = new Map(records.map((r) => [r.date.slice(0, 10), r.status]));

  const present = records.filter((r) => r.status === "PRESENT").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const late = records.filter((r) => r.status === "LATE").length;
  const excused = records.filter((r) => r.status === "EXCUSED").length;
  const total = present + absent + late + excused;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  const streak = calcAbsentStreak(records, year, month);

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-6">
        <Link href="/guardian/dashboard" className="text-xs text-[var(--ll-yellow)]">&larr; Back to dashboard</Link>
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">Attendance</h1>
        <GuardianNav />

        {children.length > 1 && (
          <div className="ll-section p-4">
            <label className="block text-xs font-medium text-[var(--ll-text-faint)] mb-1">Select Child</label>
            <select
              value={selectedChildId}
              onChange={(e) => {
                setSelectedChildId(e.target.value);
                setSelectedChildName(children.find(c => c.studentId === e.target.value)?.studentName ?? "");
              }}
              className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] px-3 py-2 text-sm text-[var(--ll-text)]"
            >
              {children.map((c) => (
                <option key={c.studentId} value={c.studentId}>{c.studentName}</option>
              ))}
            </select>
          </div>
        )}

        {streak >= 3 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <strong>{selectedChildName || "Your child"}</strong> has been absent {streak} days in a row. Contact the school.
          </div>
        )}

        <div className="ll-section p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <button type="button" onClick={prevMonth} className="rounded-lg border border-[var(--ll-border)] px-3 py-1.5 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">
              &larr;
            </button>
            <span className="text-base font-semibold text-[var(--ll-text)]">{getMonthLabel(year, month)}</span>
            <button type="button" onClick={nextMonth} className="rounded-lg border border-[var(--ll-border)] px-3 py-1.5 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">
              &rarr;
            </button>
          </div>

          {loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 text-center">
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
                  <div key={d} className="text-[10px] font-semibold uppercase text-[var(--ll-text-faint)] py-1">{d}</div>
                ))}
                {Array.from({ length: firstDayOffset }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: days }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const status = recMap.get(dateStr);
                  return (
                    <div key={day} className="relative flex flex-col items-center justify-center rounded-lg bg-[var(--ll-surface-muted)] p-1.5 min-h-[44px]">
                      <span className="text-xs text-[var(--ll-text-muted)]">{day}</span>
                      {status && (
                        <span className={`mt-1 h-2 w-2 rounded-full ${STATUS_COLORS[status] ?? "bg-gray-400"}`} title={STATUS_LABELS[status]} />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-4 pt-2 border-t border-[var(--ll-border)] text-sm">
                <span className="text-[var(--ll-text)]">Present: <strong className="text-emerald-400">{present}</strong></span>
                <span className="text-[var(--ll-text)]">Absent: <strong className="text-red-400">{absent}</strong></span>
                <span className="text-[var(--ll-text)]">Late: <strong className="text-amber-400">{late}</strong></span>
                <span className="text-[var(--ll-text)]">Excused: <strong className="text-sky-400">{excused}</strong></span>
                <span className="text-[var(--ll-text)]">Rate: <strong className={rate >= 80 ? "text-emerald-400" : rate >= 60 ? "text-amber-400" : "text-red-400"}>{rate}%</strong></span>
              </div>

              <div className="flex flex-wrap gap-3">
                {Object.entries(STATUS_COLORS).map(([s, color]) => (
                  <div key={s} className="flex items-center gap-1.5 text-xs text-[var(--ll-text-muted)]">
                    <span className={`h-2 w-2 rounded-full ${color}`} />
                    {STATUS_LABELS[s]}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

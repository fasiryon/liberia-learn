"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type StudentRow = {
  studentId: string;
  userId: string;
  name: string;
  className: string;
  lessonsCompletedThisWeek: number;
  lastActive: string | null;
  status: "active" | "at-risk" | "inactive";
};

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  active: {
    label: "Active",
    cls: "border border-[var(--ll-yellow)]/30 bg-[var(--ll-yellow)]/10 text-[var(--ll-yellow)]",
  },
  "at-risk": {
    label: "At Risk",
    cls: "border border-orange-500/30 bg-orange-500/10 text-orange-400",
  },
  inactive: {
    label: "Inactive",
    cls: "border border-red-500/30 bg-red-500/10 text-red-400",
  },
};

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/teacher/students")
      .then((r) => r.json())
      .then((d) => setStudents(d.students || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.className.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const activeCount = students.filter((s) => s.status === "active").length;
  const atRiskCount = students.filter((s) => s.status === "at-risk").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">My Students</h1>
        <p className="text-sm text-[var(--ll-text-muted)] mt-1">
          Monitor student progress across your classes
        </p>
      </div>

      {/* Summary strip */}
      {!loading && students.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-1 text-xs text-[var(--ll-text-muted)]">
            {students.length} student{students.length === 1 ? "" : "s"}
          </span>
          {activeCount > 0 && (
            <span className="rounded-full border border-[var(--ll-yellow)]/30 bg-[var(--ll-yellow)]/10 px-3 py-1 text-xs text-[var(--ll-yellow)]">
              {activeCount} active
            </span>
          )}
          {atRiskCount > 0 && (
            <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs text-orange-400">
              {atRiskCount} at risk
            </span>
          )}
        </div>
      )}

      {/* Search */}
      {!loading && students.length > 0 && (
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or class…"
          className="w-full max-w-sm rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-3 py-2 text-sm text-[var(--ll-text)] placeholder:text-[var(--ll-text-faint)] outline-none focus:border-[var(--ll-yellow)]/50"
        />
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-[var(--ll-surface)]/50 animate-pulse" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8 text-center">
          <div className="mx-auto h-20 w-20 rounded-xl border border-dashed border-[var(--ll-border)] bg-[var(--ll-bg)]/70" />
          <p className="mt-4 text-[var(--ll-text)]">
            Your class roster is empty. Ask your school admin to enroll students in your class.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--ll-text-faint)]">No students match your search.</p>
      ) : (
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--ll-border)] text-xs text-[var(--ll-text-muted)]">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Class</th>
                <th className="px-4 py-3 text-center">This Week</th>
                <th className="px-4 py-3 text-left">Last Active</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const style = STATUS_STYLE[s.status];
                const accentBorder =
                  s.status === "at-risk"
                    ? "border-l-2 border-l-orange-500/50"
                    : s.status === "inactive"
                    ? "border-l-2 border-l-red-500/50"
                    : "";
                return (
                  <tr
                    key={`${s.studentId}-${s.className}`}
                    className={`border-b border-[var(--ll-border)]/50 hover:bg-[var(--ll-surface)]/40 transition-colors ${accentBorder}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/teacher/students/${s.studentId}`}
                        className="font-medium text-[var(--ll-text)] hover:text-[var(--ll-yellow)]"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--ll-text-muted)]">{s.className}</td>
                    <td className="px-4 py-3 text-center text-[var(--ll-text)]">
                      {s.lessonsCompletedThisWeek}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--ll-text-faint)]">
                      {s.lastActive ? new Date(s.lastActive).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${style.cls}`}>
                        {style.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

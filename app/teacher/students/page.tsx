"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const PAGE_SIZE = 15;

type StudentRow = {
  studentId: string;
  userId: string;
  name: string;
  className: string;
  classId?: string;
  lessonsCompletedThisWeek: number;
  lastActive: string | null;
  status: "active" | "at-risk" | "inactive";
};

type GroupedStudent = {
  studentId: string;
  userId: string;
  name: string;
  classes: string[];
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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    fetch("/api/teacher/students")
      .then((r) => r.json())
      .then((d) => setStudents(d.students || []))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo<GroupedStudent[]>(() => {
    const map = new Map<string, GroupedStudent>();
    for (const s of students) {
      const existing = map.get(s.studentId);
      if (existing) {
        if (!existing.classes.includes(s.className)) {
          existing.classes.push(s.className);
        }
      } else {
        map.set(s.studentId, {
          studentId: s.studentId,
          userId: s.userId,
          name: s.name,
          classes: [s.className],
          lessonsCompletedThisWeek: s.lessonsCompletedThisWeek,
          lastActive: s.lastActive,
          status: s.status,
        });
      }
    }
    return Array.from(map.values());
  }, [students]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return grouped;
    return grouped.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.classes.some((c) => c.toLowerCase().includes(q))
    );
  }, [grouped, searchQuery]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const activeCount = grouped.filter((s) => s.status === "active").length;
  const atRiskCount = grouped.filter((s) => s.status === "at-risk").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">My Students</h1>
        <p className="text-sm text-[var(--ll-text-muted)] mt-1">
          Monitor student progress across your classes
        </p>
      </div>

      {/* Summary strip */}
      {!loading && grouped.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-1 text-xs text-[var(--ll-text-muted)]">
            {grouped.length} student{grouped.length === 1 ? "" : "s"}
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
      {!loading && grouped.length > 0 && (
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
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
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8 text-center">
          <div className="mx-auto h-20 w-20 rounded-xl border border-dashed border-[var(--ll-border)] bg-[var(--ll-bg)]/70" />
          <p className="mt-4 text-[var(--ll-text)]">
            Your class roster is empty. Ask your school admin to enroll students in your class.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--ll-text-faint)]">No students match your search.</p>
      ) : (
        <div className="space-y-2">
          {filtered.length > PAGE_SIZE && (
            <p className="text-xs text-[var(--ll-text-faint)]">
              Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} students
            </p>
          )}
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
                {visible.map((s) => {
                  const style = STATUS_STYLE[s.status];
                  const accentBorder =
                    s.status === "at-risk"
                      ? "border-l-2 border-l-orange-500/50"
                      : s.status === "inactive"
                      ? "border-l-2 border-l-red-500/50"
                      : "";
                  return (
                    <tr
                      key={s.studentId}
                      className={`border-b border-[var(--ll-border)]/50 hover:bg-[var(--ll-surface)]/40 transition-colors ${accentBorder}`}
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/teacher/students/${s.studentId}`}
                          className="font-medium text-[var(--ll-text)] hover:text-[var(--ll-yellow)] transition-colors"
                        >
                          {s.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {s.classes.map((cls) => (
                            <span
                              key={cls}
                              className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-2 py-0.5 text-[10px] text-[var(--ll-text-muted)]"
                            >
                              {cls}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center text-[var(--ll-text)]">
                        {s.lessonsCompletedThisWeek}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--ll-text-faint)]">
                        {s.lastActive ? new Date(s.lastActive).toLocaleDateString() : "Never"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
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
          {hasMore && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="mt-1 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-surface-muted)] transition-colors"
            >
              Load more ({filtered.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

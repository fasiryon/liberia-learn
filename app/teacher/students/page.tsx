"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TeacherDashboardBackLink } from "@/app/teacher/TeacherDashboardBackLink";

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

type ClassGroup = {
  className: string;
  students: StudentRow[];
};

type FlatStudent = {
  studentId: string;
  userId: string;
  name: string;
  classes: string[];
  lessonsCompletedThisWeek: number;
  lastActive: string | null;
  status: "active" | "at-risk" | "inactive";
};

const DAY_MS = 24 * 60 * 60 * 1000;

type ComputedStatus = "active" | "away" | "inactive" | "never-active" | "at-risk";

function computeStatus(
  apiStatus: "active" | "at-risk" | "inactive",
  lastActive: string | null
): ComputedStatus {
  if (apiStatus === "at-risk") return "at-risk";
  if (!lastActive) return "never-active";
  const age = Date.now() - new Date(lastActive).getTime();
  if (age < 7 * DAY_MS) return "active";
  if (age < 30 * DAY_MS) return "away";
  return "inactive";
}

const STATUS_STYLE: Record<ComputedStatus, { label: string; cls: string }> = {
  active: {
    label: "Active",
    cls: "border border-[var(--ll-yellow)]/30 bg-[var(--ll-yellow)]/10 text-[var(--ll-yellow)]",
  },
  away: {
    label: "Away",
    cls: "border border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  "at-risk": {
    label: "At Risk",
    cls: "border border-orange-500/30 bg-orange-500/10 text-orange-400",
  },
  inactive: {
    label: "Inactive",
    cls: "border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] text-[var(--ll-text-faint)]",
  },
  "never-active": {
    label: "Never Active",
    cls: "border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] text-[var(--ll-text-faint)]",
  },
};

function StudentCompactRow({ s }: { s: StudentRow | FlatStudent }) {
  const cs = computeStatus(s.status, s.lastActive);
  const style = STATUS_STYLE[cs];
  return (
    <div
      className="flex max-w-full items-center justify-between gap-3 rounded-lg border border-[var(--ll-border)] px-4 py-2.5 transition-colors hover:border-[var(--ll-border-strong)]"
    >
      <Link
        href={`/teacher/students/${s.studentId}`}
        className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ll-text)] transition-colors hover:text-[var(--ll-yellow)]"
      >
        {s.name}
      </Link>

      <div className="flex flex-shrink-0 items-center gap-4 text-xs text-[var(--ll-text-faint)]">
        <span className="hidden sm:block">
          {s.lastActive ? new Date(s.lastActive).toLocaleDateString() : "Never"}
        </span>
        <span className="font-medium text-[var(--ll-text)]">
          {s.lessonsCompletedThisWeek ?? 0}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.cls}`}>
          {style.label}
        </span>
      </div>
    </div>
  );
}

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [groupVisible, setGroupVisible] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    fetch("/api/teacher/students")
      .then((r) => r.json())
      .then((d) => setStudents(d.students || []))
      .finally(() => setLoading(false));
  }, []);

  // Deduplicated students for summary stats
  const flatStudents = useMemo<FlatStudent[]>(() => {
    const map = new Map<string, FlatStudent>();
    for (const s of students) {
      const existing = map.get(s.studentId);
      if (existing) {
        if (!existing.classes.includes(s.className)) existing.classes.push(s.className);
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

  // Group by class, sorted by student count desc
  const classGroups = useMemo<ClassGroup[]>(() => {
    const map = new Map<string, Map<string, StudentRow>>();
    for (const s of students) {
      if (!map.has(s.className)) map.set(s.className, new Map());
      if (!map.get(s.className)!.has(s.studentId)) {
        map.get(s.className)!.set(s.studentId, s);
      }
    }
    return Array.from(map.entries())
      .map(([className, studentMap]) => ({
        className,
        students: Array.from(studentMap.values()),
      }))
      .sort((a, b) => b.students.length - a.students.length);
  }, [students]);

  // Always expand the first class group on load
  useEffect(() => {
    if (classGroups.length > 0 && expanded.size === 0) {
      setExpanded(new Set([classGroups[0].className]));
    }
  }, [classGroups.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search: flat filtered list
  const searchResults = useMemo<FlatStudent[]>(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return flatStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.classes.some((c) => c.toLowerCase().includes(q))
    );
  }, [flatStudents, searchQuery]);

  function toggleClass(className: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(className)) next.delete(className);
      else next.add(className);
      return next;
    });
  }

  function getGroupVisible(className: string) {
    return groupVisible.get(className) ?? PAGE_SIZE;
  }

  function loadMoreGroup(className: string, total: number) {
    setGroupVisible((prev) => {
      const next = new Map(prev);
      next.set(className, Math.min((prev.get(className) ?? PAGE_SIZE) + PAGE_SIZE, total));
      return next;
    });
  }

  const totalStudents = flatStudents.length;
  const activeCount = flatStudents.filter(
    (s) => computeStatus(s.status, s.lastActive) === "active"
  ).length;
  const awayCount = flatStudents.filter(
    (s) => computeStatus(s.status, s.lastActive) === "away"
  ).length;
  const atRiskCount = flatStudents.filter((s) => s.status === "at-risk").length;
  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="ll-dashboard-shell px-4 py-5">
    <div className="ll-page-enter mx-auto max-w-5xl space-y-5">
      <TeacherDashboardBackLink />
      <div>
        <h1 className="text-2xl font-bold">My Students</h1>
        <p className="text-sm text-[var(--ll-text-muted)] mt-1">
          Monitor student progress across your classes
        </p>
      </div>

      {/* Summary strip */}
      {!loading && totalStudents > 0 && (
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-1 text-xs text-[var(--ll-text-muted)]">
            {totalStudents} student{totalStudents === 1 ? "" : "s"}
          </span>
          {activeCount > 0 && (
            <span className="rounded-full border border-[var(--ll-yellow)]/30 bg-[var(--ll-yellow)]/10 px-3 py-1 text-xs text-[var(--ll-yellow)]">
              {activeCount} active
            </span>
          )}
          {awayCount > 0 && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
              {awayCount} away
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
      {!loading && totalStudents > 0 && (
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
      ) : totalStudents === 0 ? (
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8 text-center">
          <div className="mx-auto h-20 w-20 rounded-xl border border-dashed border-[var(--ll-border)] bg-[var(--ll-bg)]/70" />
          <p className="mt-4 text-[var(--ll-text)]">
            Your class roster is empty. Ask your school admin to enroll students in your class.
          </p>
        </div>
      ) : isSearching ? (
        /* Flat search results */
        searchResults.length === 0 ? (
          <p className="text-sm text-[var(--ll-text-faint)]">No students match your search.</p>
        ) : (
          <div className="w-full max-w-full overflow-hidden rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-2">
            <div className="space-y-2">
              {searchResults.map((s) => (
                <StudentCompactRow key={s.studentId} s={s} />
              ))}
            </div>
          </div>
        )
      ) : (
        /* Grouped by class */
        <div className="w-full max-w-full space-y-3 overflow-hidden">
          {classGroups.map((group) => {
            const isOpen = expanded.has(group.className);
            const visible = getGroupVisible(group.className);
            const shown = group.students.slice(0, visible);
            const hasMore = group.students.length > visible;
            return (
              <div
                key={group.className}
                className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 overflow-hidden"
              >
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => toggleClass(group.className)}
                  className="flex w-full items-center justify-between px-4 py-3 hover:bg-[var(--ll-surface)]/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs transition-transform ${isOpen ? "rotate-90" : ""}`}
                    >
                      ▶
                    </span>
                    <span className="font-semibold text-sm text-[var(--ll-text)]">
                      {group.className}
                    </span>
                    <span className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-2 py-0.5 text-[10px] text-[var(--ll-text-muted)]">
                      {group.students.length} student{group.students.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {group.students.filter((s) => s.status === "at-risk").length > 0 && (
                      <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-400">
                        {group.students.filter((s) => s.status === "at-risk").length} at risk
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded table */}
                {isOpen && (
                  <>
                    <div className="w-full max-w-full overflow-hidden border-t border-[var(--ll-border)] p-2">
                      <div className="space-y-2">
                        {shown.map((s) => (
                          <StudentCompactRow key={s.studentId} s={s} />
                        ))}
                      </div>
                    </div>
                    {hasMore && (
                      <div className="px-4 py-2 border-t border-[var(--ll-border)]">
                        <button
                          type="button"
                          onClick={() => loadMoreGroup(group.className, group.students.length)}
                          className="text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] transition-colors"
                        >
                          Load more ({group.students.length - visible} remaining)
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
}

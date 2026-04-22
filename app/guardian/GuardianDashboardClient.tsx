"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GuardianNav } from "@/components/guardian/GuardianNav";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { placementReviewStatusLabels, placementReviewStatusStyles } from "@/lib/placement";
import { guardianWelcomeStorageKey } from "@/app/guardian/GuardianWelcomeGate";

type GuardianSummary = {
  studentId: string;
  name: string | null;
  currentGrade: number | null;
  relation: string | null;
  lastHomework: {
    title: string;
    aiScore: number | null;
    teacherScore: number | null;
    aiReviewed: boolean;
  } | null;
  placement: {
    band: string;
    levelLabel: string;
  } | null;
  lessonViewsThisWeek: number;
};

type DashboardChild = {
  studentId: string;
  studentName: string;
  grade: number | null;
  school: string | null;
  className: string | null;
  placementHistory: Array<{
    id: string;
    createdAt: string;
    estimatedGrade: number;
    teacherGrade: number | null;
    teacherDecision: string | null;
    levelLabel: string;
    status: "pending" | "confirmed" | "overridden";
    summary: string;
  }>;
  recentGrades: Array<{ subject: string; assignmentTitle: string; score: number; maxScore: number; date: string }>;
  upcomingAssignments: Array<{ subject: string; title: string; dueAt: string; type: string }>;
  attendance: { presentDays: number; absentDays: number; attendanceRate: number };
  masteryProfile: Array<{ subject: string; strandKey: string; masteryLevel: number; trend: "up" | "down" | "stable" }>;
  interventionAlerts: Array<{ subject: string; strandKey: string; alertType: string; createdAt: string }>;
  todayActivity: {
    lessonsCompleted: number;
    assignmentsSubmitted: number;
    gradesReceived: number;
    placementUpdates: number;
    dailySummary: string[];
  };
};

function scoreDisplay(hw: GuardianSummary["lastHomework"]) {
  if (!hw) return "No submissions yet";
  if (hw.teacherScore !== null) return `${hw.teacherScore}%`;
  if (hw.aiReviewed && hw.aiScore !== null) return `${Math.round(hw.aiScore)}% (AI)`;
  return "Pending review";
}

export default function GuardianDashboardClient() {
  const router = useRouter();
  const [summaries, setSummaries] = useState<GuardianSummary[]>([]);
  const [dashboardChildren, setDashboardChildren] = useState<DashboardChild[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(guardianWelcomeStorageKey, "true");
    }
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch("/api/guardian/students", { cache: "no-store" }),
      fetch("/api/guardian/dashboard", { cache: "no-store" }),
    ])
      .then(async ([studentsRes, dashboardRes]) => {
        if (studentsRes.status === 401 || studentsRes.status === 403) {
          router.push("/login");
          return null;
        }

        const studentsData = await studentsRes.json();
        const dashboardData = await dashboardRes.json();
        if (!studentsRes.ok) throw new Error(studentsData.error ?? "Failed to load students");
        if (!dashboardRes.ok) {
          if (
            dashboardRes.status === 403 &&
            typeof dashboardData?.error === "string" &&
            dashboardData.error.includes("No linked students")
          ) {
            return {
              students: studentsData.students ?? [],
              children: [],
              unreadMessages: 0,
            };
          }
          throw new Error(dashboardData.error ?? "Failed to load dashboard");
        }

        return {
          students: studentsData.students ?? [],
          children: dashboardData.children ?? [],
          unreadMessages: dashboardData.unreadMessages ?? 0,
        };
      })
      .then((data) => {
        if (!active || !data) return;
        setSummaries(data.students);
        setDashboardChildren(data.children);
        setUnreadMessages(data.unreadMessages);
        const firstId = data.children[0]?.studentId ?? data.students[0]?.studentId ?? "";
        setSelectedChildId((current) => current || firstId);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  const selectedSummary = useMemo(
    () => summaries.find((student) => student.studentId === selectedChildId) ?? summaries[0] ?? null,
    [selectedChildId, summaries]
  );
  const selectedDashboardChild = useMemo(
    () =>
      dashboardChildren.find((child) => child.studentId === selectedChildId) ??
      dashboardChildren[0] ??
      null,
    [dashboardChildren, selectedChildId]
  );

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-6xl space-y-5">
        <DashboardTopBar
          roleLabel="Guardian"
          roleBadgeBg="bg-[var(--ll-pink-soft)] border-purple-500/20"
          roleAccent="text-[var(--ll-text-muted)]"
          userName={selectedDashboardChild?.studentName ? `Viewing: ${selectedDashboardChild.studentName}` : undefined}
        />

        <div>
          <h1 className="text-2xl font-semibold text-[var(--ll-text)]">Good morning.</h1>
          <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
            Monitor your child&apos;s learning progress and stay connected with their teacher.
          </p>
        </div>

        <GuardianNav />

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}
          </div>
        ) : error ? (
          <div className="ll-notice ll-notice-error">
            {error}
          </div>
        ) : !selectedSummary || !selectedDashboardChild ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 text-center text-sm text-slate-400">
            <div className="mx-auto h-20 w-20 rounded-3xl border border-dashed border-slate-700 bg-slate-950/70" />
            <p className="mt-4 text-slate-300">
              No students linked to your account yet. Contact your child&apos;s school to get connected.
            </p>
          </div>
        ) : (
          <>
            {dashboardChildren.length > 1 ? (
              <section className="ll-section p-4">
                <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">Child selector</label>
                <select
                  value={selectedDashboardChild.studentId}
                  onChange={(event) => setSelectedChildId(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3 text-sm text-[var(--ll-text)]"
                >
                  {dashboardChildren.map((child) => (
                    <option key={child.studentId} value={child.studentId}>
                      {child.studentName} {child.grade ? `(Grade ${child.grade})` : ""}
                    </option>
                  ))}
                </select>
              </section>
            ) : null}

            <section className="ll-section p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                    Child overview
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[var(--ll-text)]">
                    {selectedDashboardChild.studentName}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
                    {selectedSummary.relation ? `${selectedSummary.relation} · ` : ""}
                    {selectedDashboardChild.className ?? "Class not assigned"}
                    {selectedDashboardChild.school ? ` · ${selectedDashboardChild.school}` : ""}
                  </p>
                </div>
                <Link
                  href="/guardian/messages"
                  className="ll-command ll-focus text-sm font-semibold text-[var(--ll-text)]"
                >
                  Message teacher
                </Link>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">Weekly summary</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-[var(--ll-surface)] p-4">
                      <p className="text-xs text-[var(--ll-text-faint)]">Attendance</p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--ll-text)]">
                        {Math.round(selectedDashboardChild.attendance.attendanceRate * 100)}%
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--ll-surface)] p-4">
                      <p className="text-xs text-[var(--ll-text-faint)]">Lessons this week</p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--ll-text)]">
                        {selectedSummary.lessonViewsThisWeek}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--ll-surface)] p-4">
                      <p className="text-xs text-[var(--ll-text-faint)]">Progress trajectory</p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--ll-text)]">
                        {selectedDashboardChild.masteryProfile.some((item) => item.trend === "up")
                          ? "Improving"
                          : selectedDashboardChild.masteryProfile.some((item) => item.trend === "down")
                            ? "Needs support"
                            : "Stable"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-xl bg-[var(--ll-surface-muted)] p-4">
                  <p className="text-xs text-[var(--ll-text-faint)]">Last homework</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--ll-text)]">
                    {selectedSummary.lastHomework?.title ?? "No submissions yet"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                    Score: {scoreDisplay(selectedSummary.lastHomework)}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--ll-surface-muted)] p-4">
                  <p className="text-xs text-[var(--ll-text-faint)]">Attendance</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--ll-text)]">
                    {Math.round(selectedDashboardChild.attendance.attendanceRate * 100)}%
                  </p>
                  <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                    {selectedDashboardChild.attendance.presentDays} present · {selectedDashboardChild.attendance.absentDays} absent
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--ll-surface-muted)] p-4">
                  <p className="text-xs text-[var(--ll-text-faint)]">Placement</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--ll-text)]">
                    {selectedSummary.placement?.band?.replace("_", "-") ?? "Not assessed"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                    {selectedSummary.placement?.levelLabel ?? "Placement result pending"}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--ll-surface-muted)] p-4">
                  <p className="text-xs text-[var(--ll-text-faint)]">Messages</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--ll-text)]">
                    Stay connected with teachers
                  </p>
                  <Link
                    href="/guardian/messages"
                    className="ll-touch-target mt-3 inline-flex items-center rounded-lg bg-[var(--ll-accent)] px-4 py-2 text-xs font-semibold text-[var(--ll-text-faint)]"
                  >
                    Open Messages
                  </Link>
                </div>
                </div>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="ll-section p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--ll-text)]">Mastery Profile</h3>
                    <p className="text-sm leading-6 text-[var(--ll-text-muted)]">Subject progress and trend over time.</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {selectedDashboardChild.masteryProfile.length === 0 ? (
                    <p className="text-sm text-[var(--ll-text-faint)]">Your child has not started any lessons yet.</p>
                  ) : (
                    selectedDashboardChild.masteryProfile.map((item) => {
                      const percent = Math.max(0, Math.min(100, Math.round(item.masteryLevel * 100)));
                      const trendSymbol =
                        item.trend === "up" ? "↑" : item.trend === "down" ? "↓" : "→";
                      return (
                        <div key={`${item.subject}-${item.strandKey}`} className="rounded-xl bg-[var(--ll-surface-muted)] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-[var(--ll-text)]">
                                {item.subject.replace(/_/g, " ")}
                              </p>
                              <p className="text-xs text-[var(--ll-text-faint)]">{item.strandKey.replace(/_/g, " ")}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-[var(--ll-accent)]">
                                {Math.round(item.masteryLevel * 5)} / 5
                              </p>
                              <p className="text-xs text-[var(--ll-text-faint)]">{trendSymbol} {item.trend}</p>
                            </div>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-[var(--ll-surface)]">
                            <div className="h-2 rounded-full bg-[var(--ll-accent)]" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <div className="ll-section p-4">
                  <h3 className="text-base font-semibold text-[var(--ll-text)]">Today&apos;s Activity</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
                    {selectedDashboardChild.studentName}&apos;s activity today.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-[var(--ll-surface-muted)] p-4">
                      <p className="text-xs text-[var(--ll-text-faint)]">Lessons</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--ll-text)]">
                        {selectedDashboardChild.todayActivity.lessonsCompleted}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--ll-surface-muted)] p-4">
                      <p className="text-xs text-[var(--ll-text-faint)]">Assignments</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--ll-text)]">
                        {selectedDashboardChild.todayActivity.assignmentsSubmitted}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--ll-surface-muted)] p-4">
                      <p className="text-xs text-[var(--ll-text-faint)]">Grades</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--ll-text)]">
                        {selectedDashboardChild.todayActivity.gradesReceived}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--ll-surface-muted)] p-4">
                      <p className="text-xs text-[var(--ll-text-faint)]">Placement</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--ll-text)]">
                        {selectedDashboardChild.todayActivity.placementUpdates}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedDashboardChild.todayActivity.dailySummary.length === 0 ? (
                      <p className="text-sm text-[var(--ll-text-faint)]">No activity recorded yet today.</p>
                    ) : (
                      selectedDashboardChild.todayActivity.dailySummary.map((summary) => (
                        <div key={summary} className="rounded-xl bg-[var(--ll-surface-muted)] p-4 text-sm text-[var(--ll-text-muted)]">
                          {summary}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="ll-section p-4">
                  <h3 className="text-base font-semibold text-[var(--ll-text)]">Areas Needing Extra Support</h3>
                  <div className="mt-4 space-y-3">
                    {selectedDashboardChild.interventionAlerts.length === 0 ? (
                      <p className="text-sm text-[var(--ll-text-faint)]">No active alerts. Your child is on track!</p>
                    ) : (
                      selectedDashboardChild.interventionAlerts.map((alert) => (
                        <div key={`${alert.subject}-${alert.strandKey}-${alert.createdAt}`} className="rounded-xl bg-[var(--ll-surface-muted)] p-4">
                          <p className="text-sm font-semibold text-[var(--ll-text)]">
                            {alert.subject.replace(/_/g, " ")}
                          </p>
                          <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                            {alert.strandKey.replace(/_/g, " ")} · {alert.alertType.replace(/_/g, " ")}
                          </p>
                          <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                            Since {new Date(alert.createdAt).toLocaleDateString("en-LR")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="ll-section p-4">
                  <h3 className="text-base font-semibold text-[var(--ll-text)]">Upcoming Work</h3>
                  <div className="mt-4 space-y-3">
                    {selectedDashboardChild.upcomingAssignments.length === 0 ? (
                      <p className="text-sm text-[var(--ll-text-faint)]">No upcoming assignments right now.</p>
                    ) : (
                      selectedDashboardChild.upcomingAssignments.slice(0, 4).map((assignment) => (
                        <div key={`${assignment.title}-${assignment.dueAt}`} className="rounded-xl bg-[var(--ll-surface-muted)] p-4">
                          <p className="text-sm font-semibold text-[var(--ll-text)]">{assignment.title}</p>
                          <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                            {assignment.subject.replace(/_/g, " ")} · due {new Date(assignment.dueAt).toLocaleDateString("en-LR")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="ll-section p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-[var(--ll-text)]">Placement History</h3>
                      <p className="text-sm leading-6 text-[var(--ll-text-muted)]">
                        Child placement history with AI recommendations and teacher confirmations.
                      </p>
                    </div>
                    <Link
                      href={`/guardian/student/${selectedDashboardChild.studentId}`}
                      className="rounded-lg border border-[var(--ll-border)] px-3 py-1.5 text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
                    >
                      View child profile
                    </Link>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedDashboardChild.placementHistory.length === 0 ? (
                      <p className="text-sm text-[var(--ll-text-faint)]">No placement history yet.</p>
                    ) : (
                      selectedDashboardChild.placementHistory.map((placement) => (
                        <div key={placement.id} className="rounded-xl bg-[var(--ll-surface-muted)] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[var(--ll-text)]">{placement.summary}</p>
                            <span
                              className={`rounded-full border px-3 py-1 text-[11px] font-medium ${placementReviewStatusStyles[placement.status]}`}
                            >
                              {placementReviewStatusLabels[placement.status]}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-[var(--ll-text-faint)]">
                            {placement.levelLabel} · {new Date(placement.createdAt).toLocaleDateString("en-LR")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

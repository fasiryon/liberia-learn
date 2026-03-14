"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DemoHintGroup } from "@/lib/demoHints";
import { DemoHints } from "@/components/DemoHints";
import { GuardianNav } from "@/components/guardian/GuardianNav";
import { placementReviewStatusLabels, placementReviewStatusStyles } from "@/lib/placement";

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

type GuardianDashboardClientProps = {
  showDemoHints: boolean;
  demoGroup: DemoHintGroup | null;
};

function scoreDisplay(hw: GuardianSummary["lastHomework"]) {
  if (!hw) return "No submissions yet";
  if (hw.teacherScore !== null) return `${hw.teacherScore}%`;
  if (hw.aiReviewed && hw.aiScore !== null) return `${Math.round(hw.aiScore)}% (AI)`;
  return "Pending review";
}

export default function GuardianDashboardClient({
  showDemoHints,
  demoGroup,
}: GuardianDashboardClientProps) {
  const router = useRouter();
  const [summaries, setSummaries] = useState<GuardianSummary[]>([]);
  const [dashboardChildren, setDashboardChildren] = useState<DashboardChild[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        if (!dashboardRes.ok) throw new Error(dashboardData.error ?? "Failed to load dashboard");

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
    <main className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Guardian Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Monitor your child&apos;s learning progress and stay connected with their teacher.
          </p>
        </div>

        {showDemoHints && demoGroup ? <DemoHints title="Guardian Demo Login" groups={[demoGroup]} /> : null}

        <GuardianNav />

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-2xl border border-white/10 bg-slate-900/70"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : !selectedSummary || !selectedDashboardChild ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 text-center text-sm text-slate-400">
            No students linked to your account yet. Contact your school admin.
          </div>
        ) : (
          <>
            {dashboardChildren.length > 1 ? (
              <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <label className="block text-xs text-slate-400">Child selector</label>
                <select
                  value={selectedDashboardChild.studentId}
                  onChange={(event) => setSelectedChildId(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                >
                  {dashboardChildren.map((child) => (
                    <option key={child.studentId} value={child.studentId}>
                      {child.studentName} {child.grade ? `(Grade ${child.grade})` : ""}
                    </option>
                  ))}
                </select>
              </section>
            ) : null}

            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-50">
                    {selectedDashboardChild.studentName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {selectedSummary.relation ? `${selectedSummary.relation} · ` : ""}
                    {selectedDashboardChild.className ?? "Class not assigned"}
                    {selectedDashboardChild.school ? ` · ${selectedDashboardChild.school}` : ""}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-right">
                  <p className="text-xs text-emerald-200">Unread messages</p>
                  <p className="text-2xl font-bold text-emerald-300">{unreadMessages}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-xs text-slate-500">Last homework</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">
                    {selectedSummary.lastHomework?.title ?? "No submissions yet"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Score: {scoreDisplay(selectedSummary.lastHomework)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-xs text-slate-500">Attendance</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">
                    {Math.round(selectedDashboardChild.attendance.attendanceRate * 100)}%
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {selectedDashboardChild.attendance.presentDays} present · {selectedDashboardChild.attendance.absentDays} absent
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-xs text-slate-500">Placement</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">
                    {selectedSummary.placement?.band?.replace("_", "-") ?? "Not assessed"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {selectedSummary.placement?.levelLabel ?? "Placement result pending"}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-xs text-slate-500">Messages</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">
                    Stay connected with teachers
                  </p>
                  <Link
                    href="/guardian/messages"
                    className="mt-3 inline-flex rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
                  >
                    Open Messages
                  </Link>
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-50">Mastery Profile</h3>
                    <p className="text-sm text-slate-400">Subject progress and trend over time.</p>
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  {selectedDashboardChild.masteryProfile.length === 0 ? (
                    <p className="text-sm text-slate-400">No mastery data yet.</p>
                  ) : (
                    selectedDashboardChild.masteryProfile.map((item) => {
                      const percent = Math.max(0, Math.min(100, Math.round(item.masteryLevel * 100)));
                      const trendSymbol =
                        item.trend === "up" ? "↑" : item.trend === "down" ? "↓" : "→";
                      return (
                        <div key={`${item.subject}-${item.strandKey}`} className="rounded-2xl bg-slate-950/70 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-100">
                                {item.subject.replace(/_/g, " ")}
                              </p>
                              <p className="text-xs text-slate-500">{item.strandKey.replace(/_/g, " ")}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-emerald-300">
                                {Math.round(item.masteryLevel * 5)} / 5
                              </p>
                              <p className="text-xs text-slate-400">{trendSymbol} {item.trend}</p>
                            </div>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-slate-800">
                            <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                  <h3 className="text-lg font-semibold text-slate-50">Today&apos;s Activity</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {selectedDashboardChild.studentName}&apos;s activity today.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl bg-slate-950/70 p-4">
                      <p className="text-xs text-slate-500">Lessons</p>
                      <p className="mt-2 text-xl font-semibold text-slate-100">
                        {selectedDashboardChild.todayActivity.lessonsCompleted}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/70 p-4">
                      <p className="text-xs text-slate-500">Assignments</p>
                      <p className="mt-2 text-xl font-semibold text-slate-100">
                        {selectedDashboardChild.todayActivity.assignmentsSubmitted}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/70 p-4">
                      <p className="text-xs text-slate-500">Grades</p>
                      <p className="mt-2 text-xl font-semibold text-slate-100">
                        {selectedDashboardChild.todayActivity.gradesReceived}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/70 p-4">
                      <p className="text-xs text-slate-500">Placement</p>
                      <p className="mt-2 text-xl font-semibold text-slate-100">
                        {selectedDashboardChild.todayActivity.placementUpdates}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedDashboardChild.todayActivity.dailySummary.length === 0 ? (
                      <p className="text-sm text-slate-400">No activity recorded yet today.</p>
                    ) : (
                      selectedDashboardChild.todayActivity.dailySummary.map((summary) => (
                        <div key={summary} className="rounded-2xl bg-slate-950/70 p-4 text-sm text-slate-200">
                          {summary}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                  <h3 className="text-lg font-semibold text-slate-50">Areas Needing Extra Support</h3>
                  <div className="mt-4 space-y-3">
                    {selectedDashboardChild.interventionAlerts.length === 0 ? (
                      <p className="text-sm text-slate-400">No active alerts. Your child is on track!</p>
                    ) : (
                      selectedDashboardChild.interventionAlerts.map((alert) => (
                        <div key={`${alert.subject}-${alert.strandKey}-${alert.createdAt}`} className="rounded-2xl bg-slate-950/70 p-4">
                          <p className="text-sm font-semibold text-slate-100">
                            {alert.subject.replace(/_/g, " ")}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {alert.strandKey.replace(/_/g, " ")} · {alert.alertType.replace(/_/g, " ")}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Since {new Date(alert.createdAt).toLocaleDateString("en-LR")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                  <h3 className="text-lg font-semibold text-slate-50">Upcoming Work</h3>
                  <div className="mt-4 space-y-3">
                    {selectedDashboardChild.upcomingAssignments.length === 0 ? (
                      <p className="text-sm text-slate-400">No upcoming assignments right now.</p>
                    ) : (
                      selectedDashboardChild.upcomingAssignments.slice(0, 4).map((assignment) => (
                        <div key={`${assignment.title}-${assignment.dueAt}`} className="rounded-2xl bg-slate-950/70 p-4">
                          <p className="text-sm font-semibold text-slate-100">{assignment.title}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {assignment.subject.replace(/_/g, " ")} · due {new Date(assignment.dueAt).toLocaleDateString("en-LR")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-50">Placement History</h3>
                      <p className="text-sm text-slate-400">
                        Child placement history with AI recommendations and teacher confirmations.
                      </p>
                    </div>
                    <Link
                      href={`/guardian/student/${selectedDashboardChild.studentId}`}
                      className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-slate-100"
                    >
                      View child profile
                    </Link>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedDashboardChild.placementHistory.length === 0 ? (
                      <p className="text-sm text-slate-400">No placement history yet.</p>
                    ) : (
                      selectedDashboardChild.placementHistory.map((placement) => (
                        <div key={placement.id} className="rounded-2xl bg-slate-950/70 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-100">{placement.summary}</p>
                            <span
                              className={`rounded-full border px-3 py-1 text-[11px] font-medium ${placementReviewStatusStyles[placement.status]}`}
                            >
                              {placementReviewStatusLabels[placement.status]}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-400">
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

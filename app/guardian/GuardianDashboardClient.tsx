"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, MessageCircle, BarChart3 } from "lucide-react";
import { GuardianNav } from "@/components/guardian/GuardianNav";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EventCalendar } from "@/components/EventCalendar";
import { placementReviewStatusLabels, placementReviewStatusStyles } from "@/lib/placement";
import { guardianWelcomeStorageKey } from "@/app/guardian/GuardianWelcomeGate";
import { getGuardianGreeting } from "@/lib/student/greetings";
import { RoleQuickStartCards } from "@/components/onboarding/RoleQuickStartCards";

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
  const [reportCardCount, setReportCardCount] = useState(0);
  const [nextEvent, setNextEvent] = useState<{ title: string; eventDate: string } | null>(null);
  const [upcomingAssignmentsCount, setUpcomingAssignmentsCount] = useState(0);

  useEffect(() => {
    fetch("/api/guardian/report-cards", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setReportCardCount((d.reportCards ?? []).length))
      .catch(() => null);
  }, []);

  useEffect(() => {
    fetch("/api/events?limit=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const events = Array.isArray(d) ? d : d.events ?? [];
        setNextEvent(events[0] ?? null);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!selectedChildId) return;
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 86400000);
    fetch(`/api/guardian/assignments?studentId=${encodeURIComponent(selectedChildId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const count = (d.assignments ?? []).filter(
          (a: any) => a.status === "upcoming" && a.dueAt && new Date(a.dueAt) < in7Days
        ).length;
        setUpcomingAssignmentsCount(count);
      })
      .catch(() => null);
  }, [selectedChildId]);

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

        {(() => {
          const greeting = getGuardianGreeting({
            childName: selectedDashboardChild?.studentName ?? null,
          });
          return (
            <div>
              <h1 className="text-2xl font-semibold text-[var(--ll-text)]">{greeting.headline}</h1>
              <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">{greeting.subtext}</p>
            </div>
          );
        })()}

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
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 text-center text-sm text-slate-400">
              <div className="mx-auto h-20 w-20 rounded-3xl border border-dashed border-slate-700 bg-slate-950/70" />
              <p className="mt-4 text-slate-300">
                No students linked to your account yet. Contact your child&apos;s school to get connected.
              </p>
            </div>
            <RoleQuickStartCards
              heading="While you wait — here's how guardians use LiberiaLearn"
              cards={[
                {
                  title: "View child's progress",
                  description: "Once linked, see grades, attendance, and mastery.",
                  href: "/guardian/progress",
                  Icon: BarChart3,
                },
                {
                  title: "Message the teacher",
                  description: "Send a note to your child's class teacher.",
                  href: "/guardian/messages",
                  Icon: MessageCircle,
                },
                {
                  title: "Browse lessons",
                  description: "See what your child is learning this term.",
                  href: "/guardian/lessons",
                  Icon: BookOpen,
                },
              ]}
            />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Link href="/guardian/attendance" className="ll-section p-4 hover:bg-[var(--ll-surface-muted)] transition block">
                <p className="text-xs text-[var(--ll-text-faint)] uppercase tracking-wide">Attendance Rate</p>
                <p className={`mt-1 text-2xl font-bold ${
                  selectedDashboardChild.attendance.attendanceRate >= 0.8
                    ? "text-emerald-400"
                    : selectedDashboardChild.attendance.attendanceRate >= 0.6
                    ? "text-amber-400"
                    : "text-red-400"
                }`}>
                  {Math.round(selectedDashboardChild.attendance.attendanceRate * 100)}%
                </p>
                <p className="text-xs text-[var(--ll-text-faint)]">
                  {selectedDashboardChild.attendance.presentDays} present · {selectedDashboardChild.attendance.absentDays} absent
                </p>
              </Link>

              <Link href="/guardian/grades" className="ll-section p-4 hover:bg-[var(--ll-surface-muted)] transition block">
                <p className="text-xs text-[var(--ll-text-faint)] uppercase tracking-wide">Latest Grade</p>
                {selectedDashboardChild.recentGrades.length > 0 ? (
                  <>
                    <p className="mt-1 text-base font-semibold text-[var(--ll-text)]">
                      {selectedDashboardChild.recentGrades[0].subject.replace(/_/g, " ")}
                    </p>
                    <p className="text-2xl font-bold text-[var(--ll-yellow)]">
                      {selectedDashboardChild.recentGrades[0].score}/{selectedDashboardChild.recentGrades[0].maxScore}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-[var(--ll-text-muted)]">No grades yet</p>
                )}
              </Link>

              <Link href="/guardian/events" className="ll-section p-4 hover:bg-[var(--ll-surface-muted)] transition block">
                <p className="text-xs text-[var(--ll-text-faint)] uppercase tracking-wide">Upcoming Event</p>
                {nextEvent ? (
                  <>
                    <p className="mt-1 text-base font-semibold text-[var(--ll-text)]">{nextEvent.title}</p>
                    <p className="text-xs text-[var(--ll-text-faint)]">{new Date(nextEvent.eventDate).toLocaleDateString("en-LR")}</p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-[var(--ll-text-muted)]">No upcoming events</p>
                )}
              </Link>

              <Link href="/guardian/messages" className="ll-section p-4 hover:bg-[var(--ll-surface-muted)] transition block">
                <p className="text-xs text-[var(--ll-text-faint)] uppercase tracking-wide">Unread Messages</p>
                <p className={`mt-1 text-2xl font-bold ${unreadMessages > 0 ? "text-[var(--ll-yellow)]" : "text-[var(--ll-text-muted)]"}`}>
                  {unreadMessages}
                </p>
                <p className="text-xs text-[var(--ll-text-faint)]">{unreadMessages > 0 ? "from teachers" : "all caught up"}</p>
              </Link>

              <Link href="/guardian/report-cards" className="ll-section p-4 hover:bg-[var(--ll-surface-muted)] transition block">
                <p className="text-xs text-[var(--ll-text-faint)] uppercase tracking-wide">Report Card</p>
                {reportCardCount > 0 ? (
                  <>
                    <p className="mt-1 text-base font-semibold text-emerald-400">Available</p>
                    <p className="text-xs text-[var(--ll-text-faint)]">{reportCardCount} published</p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-[var(--ll-text-muted)]">None published yet</p>
                )}
              </Link>

              <Link href="/guardian/assignments" className="ll-section p-4 hover:bg-[var(--ll-surface-muted)] transition block">
                <p className="text-xs text-[var(--ll-text-faint)] uppercase tracking-wide">Assignments Due</p>
                <p className={`mt-1 text-2xl font-bold ${upcomingAssignmentsCount > 0 ? "text-amber-400" : "text-[var(--ll-text-muted)]"}`}>
                  {upcomingAssignmentsCount}
                </p>
                <p className="text-xs text-[var(--ll-text-faint)]">in the next 7 days</p>
              </Link>
            </section>

            {reportCardCount > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-[var(--ll-yellow)]/20 bg-[var(--ll-yellow-soft)] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--ll-text)]">Report Card Available</p>
                  <p className="text-xs text-[var(--ll-text-muted)] mt-0.5">
                    {reportCardCount} published report card{reportCardCount !== 1 ? "s" : ""} ready to view.
                  </p>
                </div>
                <Link
                  href="/guardian/report-cards"
                  className="shrink-0 min-h-9 rounded-full bg-[var(--ll-yellow)] px-4 text-xs font-semibold text-[var(--ll-text-faint)] inline-flex items-center"
                >
                  View
                </Link>
              </div>
            )}

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

              <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">Weekly summary</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl bg-[var(--ll-surface)] p-3">
                      <p className="text-xs text-[var(--ll-text-faint)]">Attendance</p>
                      <p className="mt-1 text-xl font-semibold text-[var(--ll-text)]">
                        {Math.round(selectedDashboardChild.attendance.attendanceRate * 100)}%
                      </p>
                      <p className="text-[10px] text-[var(--ll-text-faint)]">
                        {selectedDashboardChild.attendance.presentDays}p · {selectedDashboardChild.attendance.absentDays}a
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--ll-surface)] p-3">
                      <p className="text-xs text-[var(--ll-text-faint)]">Lessons this week</p>
                      <p className="mt-1 text-xl font-semibold text-[var(--ll-text)]">
                        {selectedSummary.lessonViewsThisWeek}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--ll-surface)] p-3">
                      <p className="text-xs text-[var(--ll-text-faint)]">Progress trajectory</p>
                      <p className="mt-1 text-xl font-semibold text-[var(--ll-text)]">
                        {selectedDashboardChild.masteryProfile.some((item) => item.trend === "up")
                          ? "Improving"
                          : selectedDashboardChild.masteryProfile.some((item) => item.trend === "down")
                            ? "Needs support"
                            : "Stable"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
                  <p className="text-xs text-[var(--ll-text-faint)]">Last homework</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--ll-text)]">
                    {selectedSummary.lastHomework?.title ?? "No submissions yet"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                    Score: {scoreDisplay(selectedSummary.lastHomework)}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
                  <p className="text-xs text-[var(--ll-text-faint)]">Placement</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--ll-text)]">
                    {selectedSummary.placement?.band?.replace("_", "-") ?? "Not assessed"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                    {selectedSummary.placement?.levelLabel ?? "Placement result pending"}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
                  <p className="text-xs text-[var(--ll-text-faint)]">Messages</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--ll-text)]">
                    Stay connected with teachers
                  </p>
                  <Link
                    href="/guardian/messages"
                    className="ll-touch-target mt-2 inline-flex items-center rounded-lg bg-[var(--ll-accent)] px-4 py-1.5 text-xs font-semibold text-[var(--ll-text-faint)]"
                  >
                    Open Messages
                  </Link>
                </div>
                </div>
              </div>
            </section>

            <section className="ll-section p-4">
              <EventCalendar role="GUARDIAN" compact />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
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
                        <div key={`${item.subject}-${item.strandKey}`} className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
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
                          <div className="mt-2 h-1.5 rounded-full bg-[var(--ll-surface)]">
                            <div className="h-1.5 rounded-full bg-[var(--ll-accent)]" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="ll-section p-4">
                  <h3 className="text-base font-semibold text-[var(--ll-text)]">Today&apos;s Activity</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
                    {selectedDashboardChild.studentName}&apos;s activity today.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <div className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
                      <p className="text-xs text-[var(--ll-text-faint)]">Lessons</p>
                      <p className="mt-1 text-xl font-semibold text-[var(--ll-text)]">
                        {selectedDashboardChild.todayActivity.lessonsCompleted}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
                      <p className="text-xs text-[var(--ll-text-faint)]">Assignments</p>
                      <p className="mt-1 text-xl font-semibold text-[var(--ll-text)]">
                        {selectedDashboardChild.todayActivity.assignmentsSubmitted}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
                      <p className="text-xs text-[var(--ll-text-faint)]">Grades</p>
                      <p className="mt-1 text-xl font-semibold text-[var(--ll-text)]">
                        {selectedDashboardChild.todayActivity.gradesReceived}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
                      <p className="text-xs text-[var(--ll-text-faint)]">Placement</p>
                      <p className="mt-1 text-xl font-semibold text-[var(--ll-text)]">
                        {selectedDashboardChild.todayActivity.placementUpdates}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {selectedDashboardChild.todayActivity.dailySummary.length === 0 ? (
                      <p className="text-sm text-[var(--ll-text-faint)]">No activity recorded yet today.</p>
                    ) : (
                      selectedDashboardChild.todayActivity.dailySummary.map((summary) => (
                        <div key={summary} className="rounded-xl bg-[var(--ll-surface-muted)] p-3 text-sm text-[var(--ll-text-muted)]">
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
                        <div key={`${alert.subject}-${alert.strandKey}-${alert.createdAt}`} className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
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
                        <div key={`${assignment.title}-${assignment.dueAt}`} className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
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
                        <div key={placement.id} className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
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

import type { ReactNode } from "react";
import Link from "next/link";

function formatEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    lesson_view: "Lesson opened",
    LESSON_MODE_CHANGED: "Lesson mode changed",
    LESSON_COMPLETED: "Lesson completed",
    QUIZ_SUBMITTED: "Quiz submitted",
    "guardian dashboard viewed": "Guardian viewed dashboard",
    ASSIGNMENT_CREATED: "Assignment created",
    ASSIGNMENT_SUBMITTED: "Assignment submitted",
    STUDENT_LOGGED_IN: "Student signed in",
    TEACHER_LOGGED_IN: "Teacher signed in",
    INTERVENTION_RESOLVED: "Intervention resolved",
    "action.student.resolved": "Student action resolved",
  };
  return (
    labels[eventType] ??
    eventType
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase())
  );
}

type ActivityEvent = {
  id: string;
  action: string;
  createdAt: Date;
};

function deduplicateEvents(events: ActivityEvent[]): Array<ActivityEvent & { count: number }> {
  const result: Array<ActivityEvent & { count: number }> = [];

  for (const event of events) {
    const label = formatEventLabel(event.action);
    const last = result[result.length - 1];

    if (last && formatEventLabel(last.action) === label) {
      last.count += 1;
    } else {
      result.push({ ...event, count: 1 });
    }
  }

  return result;
}
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AlertTriangle, Building2, BookOpen, Bell, BarChart2, Settings } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AttachDemoSchoolButton } from "./AttachDemoSchoolButton";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { EventCalendar } from "@/components/EventCalendar";

export const dynamic = "force-dynamic";

const TRAINING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER === "true";


export default async function AdminConsolePage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  let schoolId = user.schoolId as string | null;
  if (!schoolId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { schoolId: true },
    });
    schoolId = dbUser?.schoolId ?? null;
  }

  if (!schoolId) {
    return (
      <main className="ll-dashboard-shell">
        <div className="mx-auto max-w-2xl px-4 py-5 space-y-5">
          <DashboardTopBar
            roleLabel="Admin"
            roleBadgeBg="bg-[var(--ll-yellow-soft)] border-amber-400/20"
            roleAccent="text-[var(--ll-text-muted)]"
            userName={user.name ?? user.email ?? undefined}
          />
          <div className="text-center space-y-5">
          <h1 className="text-2xl font-semibold text-[var(--ll-text)]">No School Assigned</h1>
          <p className="text-sm leading-6 text-[var(--ll-text-muted)]">
            Your admin account ({user.email}) does not have a school attached yet.
            Attach to the demo school to explore the platform, or log out and use the
            primary demo admin account.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <AttachDemoSchoolButton />
          </div>

          <div className="pt-5 border-t border-[var(--ll-border)] flex flex-wrap justify-center gap-2">
            <Link href="/admin/students" className="rounded-lg border border-[var(--ll-border)] px-4 py-2 text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] hover:border-[var(--ll-border-strong)]">Students</Link>
            <Link href="/admin/curriculum" className="rounded-lg border border-[var(--ll-border)] px-4 py-2 text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] hover:border-[var(--ll-border-strong)]">Curriculum</Link>
            <Link href="/admin/analytics" className="rounded-lg border border-[var(--ll-border)] px-4 py-2 text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] hover:border-[var(--ll-border-strong)]">Analytics</Link>
          </div>
          </div>
        </div>
      </main>
    );
  }

  const [school, studentCount, teacherCount] =
    await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
      prisma.user.count({ where: { schoolId, role: "STUDENT" } }),
      prisma.user.count({ where: { schoolId, role: "TEACHER" } }),
    ]);

  const schoolName = school?.name ?? "Your School";
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  let lessonsDeliveredThisMonth = 0;
  let attendanceRate30d = 0;
  let classPerformance: Array<{
    id: string;
    name: string;
    teacher: string;
    students: number;
    avgMastery: number;
    attendance: number;
    lessons: number;
  }> = [];
  let atRiskStudents: Array<{
    studentId: string;
    name: string;
    grade: number | null;
    className: string | null;
    subject: string;
    alertType: string;
  }> = [];
  let atRiskTotal = 0;
  let recentActivity: ActivityEvent[] = [];

  try {
    const classes = await prisma.class.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        subject: true,
        Teacher: { select: { name: true, email: true } },
        enrollments: {
          select: {
            studentId: true,
            Student: {
              select: {
                id: true,
                currentGrade: true,
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
        scheduledWork: {
          where: { isDelivered: true, scheduledDate: { gte: monthStart } },
          select: { id: true },
        },
      },
    });

    const classIds = classes.map((cls) => cls.id);
    const studentIds = classes.flatMap((cls) => cls.enrollments.map((enrollment) => enrollment.studentId));

    const [attendanceRows, masteryRows, riskRows, deliveredCount, activityRows] = await Promise.all([
      classIds.length > 0
        ? prisma.attendanceRecord.findMany({
            where: {
              studentId: { in: studentIds },
              markedAt: { gte: thirtyDaysAgo },
              Meeting: { classId: { in: classIds } },
            },
            select: {
              studentId: true,
              status: true,
              Meeting: { select: { classId: true } },
            },
          })
        : Promise.resolve([]),
      studentIds.length > 0
        ? prisma.studentMasteryProfile.findMany({
            where: { studentId: { in: studentIds } },
            select: { studentId: true, currentScore: true },
          })
        : Promise.resolve([]),
      studentIds.length > 0
        ? prisma.studentMasteryProfile.findMany({
            where: {
              studentId: { in: studentIds },
              OR: [
                { masteryState: "DECAYING" },
                { proficiencyState: "BELOW_PROFICIENT" },
              ],
            },
            select: {
              studentId: true,
              subject: true,
              masteryState: true,
              proficiencyState: true,
            },
          })
        : Promise.resolve([]),
      prisma.scheduledWork.count({
        where: {
          class: { schoolId },
          isDelivered: true,
          scheduledDate: { gte: monthStart },
        },
      }),
      prisma.auditLog.findMany({
        where: { schoolId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, action: true, createdAt: true },
      }),
    ]);

    lessonsDeliveredThisMonth = deliveredCount;
    recentActivity = activityRows;

    const attendanceByClass = new Map<string, { present: number; total: number }>();
    for (const row of attendanceRows) {
      const current = attendanceByClass.get(row.Meeting.classId) ?? { present: 0, total: 0 };
      current.total += 1;
      if (row.status === "PRESENT" || row.status === "LATE") current.present += 1;
      attendanceByClass.set(row.Meeting.classId, current);
    }

    const attendanceTotals = Array.from(attendanceByClass.values()).reduce(
      (acc, item) => {
        acc.present += item.present;
        acc.total += item.total;
        return acc;
      },
      { present: 0, total: 0 }
    );
    attendanceRate30d =
      attendanceTotals.total > 0
        ? Math.round((attendanceTotals.present / attendanceTotals.total) * 100)
        : 0;

    const masteryByStudent = new Map<string, { sum: number; count: number }>();
    for (const row of masteryRows) {
      const current = masteryByStudent.get(row.studentId) ?? { sum: 0, count: 0 };
      current.sum += row.currentScore;
      current.count += 1;
      masteryByStudent.set(row.studentId, current);
    }

    classPerformance = classes.map((cls) => {
      const classAttendance = attendanceByClass.get(cls.id) ?? { present: 0, total: 0 };
      const masteryScores = cls.enrollments
        .map((enrollment) => masteryByStudent.get(enrollment.studentId))
        .filter(Boolean) as Array<{ sum: number; count: number }>;

      const avgMastery =
        masteryScores.length === 0
          ? 0
          : Math.round(
              (masteryScores.reduce((sum, item) => sum + item.sum / Math.max(item.count, 1), 0) /
                masteryScores.length) *
                100
            );

      const attendance =
        classAttendance.total > 0
          ? Math.round((classAttendance.present / classAttendance.total) * 100)
          : 0;

      return {
        id: cls.id,
        name: cls.name,
        teacher: cls.Teacher?.name ?? cls.Teacher?.email ?? "Unassigned",
        students: cls.enrollments.length,
        avgMastery,
        attendance,
        lessons: cls.scheduledWork.length,
      };
    });

    const seenRisk = new Set<string>();
    atRiskStudents = [];
    for (const row of riskRows) {
      if (seenRisk.has(row.studentId)) continue;
      const classEntry = classes.find((cls) =>
        cls.enrollments.some((enrollment) => enrollment.studentId === row.studentId)
      );
      const student = classEntry?.enrollments.find((enrollment) => enrollment.studentId === row.studentId)?.Student;
      if (!student) continue;
      seenRisk.add(row.studentId);
      atRiskStudents.push({
        studentId: row.studentId,
        name: student.user.name ?? student.user.email ?? "Student",
        grade: student.currentGrade ?? null,
        className: classEntry?.name ?? null,
        subject: String(row.subject),
        alertType:
          row.masteryState === "DECAYING" ? "declining_mastery" : "below_proficient",
      });
    }
    atRiskTotal = atRiskStudents.length;
    atRiskStudents = atRiskStudents.slice(0, 10);
  } catch {
    classPerformance = [];
    atRiskStudents = [];
    recentActivity = [];
  }

  let schoolDetail: { onboardingStep: number } | null = null;
  let onboardingRecord: { completed: boolean } | null = null;
  try {
    [schoolDetail, onboardingRecord] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId }, select: { onboardingStep: true } }),
      prisma.schoolOnboarding.findUnique({ where: { schoolId }, select: { completed: true } }),
    ]);
  } catch {
    // SchoolOnboarding table may not exist yet in this environment
  }
  const onboardingIncomplete =
    !onboardingRecord?.completed &&
    (teacherCount < 2 || !schoolDetail?.onboardingStep || schoolDetail.onboardingStep < 5);

  const stats = [
    { label: "Total Students", value: studentCount },
    { label: "Total Teachers", value: teacherCount },
    { label: "Lessons This Month", value: lessonsDeliveredThisMonth },
    { label: "Attendance (30d)", value: `${attendanceRate30d}%` },
  ];

  const navGroups: Array<{ label: string; icon: ReactNode; links: { label: string; href: string }[] }> = [
    {
      label: "School Operations",
      icon: <Building2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />,
      links: [
        { label: "Students", href: "/admin/students" },
        { label: "Teachers", href: "/admin/teachers" },
        { label: "Classes", href: "/admin/classes" },
        { label: "Enrollments", href: "/admin/enrollment" },
        { label: "Teacher Assignments", href: "/admin/assignments" },
        { label: "Academic Years", href: "/admin/academic-year" },
        { label: "Timetable", href: "/admin/timetable" },
        { label: "Placements", href: "/admin/placements" },
        { label: "Events Calendar", href: "/admin/events" },
        { label: "Documents", href: "/admin/documents" },
      ],
    },
    {
      label: "Curriculum",
      icon: <BookOpen className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />,
      links: [
        { label: "Curriculum / AI Factory", href: "/admin/curriculum" },
        { label: "Curriculum Units", href: "/admin/curriculum/units" },
        { label: "Content Review", href: "/admin/content-review" },
        { label: "Homework", href: "/admin/homework" },
        { label: "Exams", href: "/admin/exams" },
      ],
    },
    {
      label: "Communications",
      icon: <Bell className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />,
      links: [
        { label: "Notifications", href: "/admin/notifications" },
        { label: "Guardian Links", href: "/admin/guardian-link" },
        { label: "Onboarding", href: "/admin/onboarding" },
        { label: "MOE Submissions", href: "/admin/moe-submissions" },
      ],
    },
    {
      label: "Analytics & Compliance",
      icon: <BarChart2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />,
      links: [
        { label: "Analytics", href: "/admin/analytics" },
        { label: "AI Costs", href: "/admin/ai-costs" },
        { label: "Reports", href: "/admin/reports" },
        { label: "Audit Log", href: "/admin/audit" },
        { label: "Compliance", href: "/admin/compliance" },
        { label: "Data Downloads", href: "/admin/governance/exports" },
        { label: "Pilot Score", href: "/admin/pilot-score" },
        ...(TRAINING_ENABLED ? [{ label: "Training Adoption", href: "/admin/training/adoption" }] : []),
      ],
    },
    {
      label: "Settings",
      icon: <Settings className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />,
      links: [
        { label: "School Branding", href: "/admin/school-branding" },
        { label: "School Settings", href: "/admin/school-settings" },
        { label: "Canva Integration", href: "/admin/settings/canva" },
        { label: "Schools", href: "/admin/schools" },
        { label: "Seed Demo Data", href: "/admin/seed" },
      ],
    },
  ];
  const deduplicatedRecentActivity = deduplicateEvents(recentActivity);

  return (
    <main className="ll-dashboard-shell">
      <div className="ll-page-enter mx-auto max-w-6xl px-4 py-5 space-y-5">
        <DashboardTopBar
          roleLabel="Admin"
          roleBadgeBg="bg-[var(--ll-yellow-soft)] border-amber-400/20"
          roleAccent="text-[var(--ll-text-muted)]"
          userName={user.name ?? user.email ?? undefined}
          subtitle={schoolName}
        />

        <div>
          <h1 className="text-2xl font-semibold text-[var(--ll-text)]">Good morning. Here&apos;s your school today.</h1>
          <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">{schoolName}</p>
        </div>

        {onboardingIncomplete && (
          <Link
            href="/admin/onboarding"
            className="ll-command ll-focus border-[var(--ll-warning)] bg-[rgba(250,204,21,0.08)]"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--ll-warning)]" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-semibold text-[var(--ll-warning)]">Complete School Onboarding</p>
              <p className="text-xs text-[var(--ll-text-faint)]">
                Finish the 5-step setup wizard to improve your Pilot Readiness Score.
              </p>
            </div>
          </Link>
        )}

        {/* KPI cards */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="ll-kpi">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)] mb-1">{s.label}</p>
              <p className="text-2xl font-semibold text-[var(--ll-text)]">{s.value}</p>
            </div>
          ))}
        </section>

        <section className="ll-section p-4">
          <EventCalendar role="ADMIN" compact />
        </section>

        <section className="ll-section p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--ll-text)]">Class Performance</h2>
            <span className="text-xs text-[var(--ll-text-faint)]">{classPerformance.length} classes</span>
          </div>
          {classPerformance.length === 0 ? (
            <div className="ll-section p-6 text-center">
              <p className="text-sm leading-6 text-[var(--ll-text-muted)]">No students imported yet.</p>
              <Link href="/admin/students/import" className="ll-command ll-focus mt-3 inline-flex text-sm font-semibold text-[var(--ll-text)]">Import students</Link>
            </div>
          ) : (
            <div className="ll-scroll-table">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--ll-border)] text-left text-xs text-[var(--ll-text-faint)]">
                    <th className="px-3 py-2">Class</th>
                    <th className="px-3 py-2">Teacher</th>
                    <th className="px-3 py-2">Students</th>
                    <th className="px-3 py-2">Avg Mastery</th>
                    <th className="px-3 py-2">Attendance</th>
                    <th className="px-3 py-2">Lessons</th>
                  </tr>
                </thead>
                <tbody>
                  {classPerformance.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--ll-border)]/60 text-[var(--ll-text-muted)]">
                      <td className="px-3 py-2.5">{row.name}</td>
                      <td className="px-3 py-2.5">{row.teacher}</td>
                      <td className="px-3 py-2.5">{row.students}</td>
                      <td className="px-3 py-2.5">{row.avgMastery}%</td>
                      <td className="px-3 py-2.5">{row.attendance}%</td>
                      <td className="px-3 py-2.5">{row.lessons}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Grouped navigation sections */}
        <section className="space-y-4">
          {navGroups.map((group) => (
            <div key={group.label} className="ll-section p-4">
              <p className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                {group.icon}
                {group.label}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="ll-command ll-focus text-sm font-medium text-[var(--ll-text)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--ll-text)]">Students Needing Attention</h2>
                <p className="text-xs text-[var(--ll-text-faint)]">Active intervention signals across the school.</p>
              </div>
            </div>
            {atRiskStudents.length === 0 ? (
              <p className="text-sm text-[var(--ll-text-faint)]">No at-risk alerts. Great work!</p>
            ) : (
              <div className="space-y-2">
                {atRiskStudents.slice(0, 5).map((student) => (
                  <div
                    key={student.studentId}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[var(--ll-border)] hover:border-[var(--ll-border-strong)] transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--ll-text)]">{student.name}</p>
                      <p className="text-xs text-[var(--ll-text-faint)]">
                        Grade {student.grade ?? "-"} · {student.className ?? "Unassigned"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-[var(--ll-yellow)]">{student.subject}</p>
                      <p className="text-xs text-[var(--ll-text-faint)]">{student.alertType.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {atRiskTotal > 5 && (
              <a
                href="/admin/students?filter=at-risk"
                className="block text-center text-xs text-[var(--ll-yellow)] mt-3 hover:opacity-80"
              >
                View all {atRiskTotal} students →
              </a>
            )}
          </div>

          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-base font-semibold text-[var(--ll-text)]">Recent Activity</h2>
            <div className="mt-3 space-y-3">
              {deduplicatedRecentActivity.length === 0 ? (
                <p className="text-sm text-[var(--ll-text-faint)]">No recent activity.</p>
              ) : (
                deduplicatedRecentActivity.slice(0, 5).map((entry) => {
                  const label = formatEventLabel(entry.action);
                  const displayLabel = entry.count > 1 ? `${entry.count} ${label}` : label;

                  return (
                  <div key={entry.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2">
                    <p className="text-sm font-semibold text-[var(--ll-text)]">{displayLabel}</p>
                    <p className="text-xs text-[var(--ll-text-faint)]">
                      {entry.createdAt.toLocaleString("en-LR", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  );
                })
              )}
            </div>
            {deduplicatedRecentActivity.length > 0 && (
              <Link
                href="/admin/audit"
                className="block text-center text-xs text-[var(--ll-yellow)] mt-3 hover:opacity-80"
              >
                View full audit log →
              </Link>
            )}
          </div>
        </section>

      </div>
    </main>
  );
}

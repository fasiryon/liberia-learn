import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AttachDemoSchoolButton } from "./AttachDemoSchoolButton";
import { DashboardTopBar } from "@/components/DashboardTopBar";

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
            roleBadgeBg="bg-amber-400/10 border-amber-400/20"
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
  let recentActivity: Array<{ id: string; action: string; createdAt: Date }> = [];

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
        take: 5,
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

  const schoolDetail = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { onboardingStep: true },
  });
  const onboardingIncomplete = !schoolDetail?.onboardingStep || schoolDetail.onboardingStep < 5;

  const stats = [
    { label: "Total Students", value: studentCount },
    { label: "Total Teachers", value: teacherCount },
    { label: "Lessons This Month", value: lessonsDeliveredThisMonth },
    { label: "Attendance (30d)", value: `${attendanceRate30d}%` },
  ];

  const navGroups = [
    {
      label: "School Operations",
      links: [
        { label: "Students", href: "/admin/students" },
        { label: "Teachers", href: "/admin/teachers" },
        { label: "Classes", href: "/admin/classes" },
        { label: "Enrollments", href: "/admin/enrollment" },
        { label: "Teacher Assignments", href: "/admin/assignments" },
        { label: "Academic Years", href: "/admin/academic-year" },
        { label: "Timetable", href: "/admin/timetable" },
        { label: "Placements", href: "/admin/placements" },
      ],
    },
    {
      label: "Curriculum",
      links: [
        { label: "Curriculum / AI Factory", href: "/admin/curriculum" },
        { label: "Curriculum Units", href: "/admin/curriculum/units" },
        { label: "Homework", href: "/admin/homework" },
        { label: "Exams", href: "/admin/exams" },
      ],
    },
    {
      label: "Communications",
      links: [
        { label: "Notifications", href: "/admin/notifications" },
        { label: "Guardian Links", href: "/admin/guardian-link" },
        { label: "Onboarding", href: "/admin/onboarding" },
      ],
    },
    {
      label: "Analytics & Compliance",
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
      links: [
        { label: "School Branding", href: "/admin/school-branding" },
        { label: "School Settings", href: "/admin/school-settings" },
        { label: "Schools", href: "/admin/schools" },
        { label: "Seed Demo Data", href: "/admin/seed" },
      ],
    },
  ];

  return (
    <main className="ll-dashboard-shell">
      <div className="mx-auto max-w-6xl px-4 py-5 space-y-5">
        <DashboardTopBar
          roleLabel="Admin"
          roleBadgeBg="bg-amber-400/10 border-amber-400/20"
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
            <span className="text-2xl">&#9888;</span>
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
            <div className="overflow-x-auto">
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
                      <td className="px-3 py-3">{row.name}</td>
                      <td className="px-3 py-3">{row.teacher}</td>
                      <td className="px-3 py-3">{row.students}</td>
                      <td className="px-3 py-3">{row.avgMastery}%</td>
                      <td className="px-3 py-3">{row.attendance}%</td>
                      <td className="px-3 py-3">{row.lessons}</td>
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
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
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
              {atRiskTotal > 10 ? (
                <Link href="/admin/students" className="text-xs font-semibold text-[var(--ll-accent)] hover:opacity-80">
                  View All
                </Link>
              ) : null}
            </div>
            {atRiskStudents.length === 0 ? (
              <p className="text-sm text-[var(--ll-text-faint)]">No at-risk alerts. Great work!</p>
            ) : (
              <div className="space-y-2">
                {atRiskStudents.map((student) => (
                  <div key={student.studentId} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--ll-text)]">{student.name}</p>
                        <p className="text-xs text-[var(--ll-text-faint)]">
                          Grade {student.grade ?? "-"} · {student.className ?? "Unassigned"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-[var(--ll-warning)]">{student.subject}</p>
                        <p className="text-[11px] text-[var(--ll-text-faint)]">{student.alertType.replace(/_/g, " ")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-base font-semibold text-[var(--ll-text)]">Recent Activity</h2>
            <div className="mt-3 space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-[var(--ll-text-faint)]">No recent activity.</p>
              ) : (
                recentActivity.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3">
                    <p className="text-sm font-semibold text-[var(--ll-text)]">{entry.action.replace(/\./g, " ")}</p>
                    <p className="text-xs text-[var(--ll-text-faint)]">
                      {entry.createdAt.toLocaleString("en-LR", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}

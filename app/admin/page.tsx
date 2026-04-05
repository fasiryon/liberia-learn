import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AttachDemoSchoolButton } from "./AttachDemoSchoolButton";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

const TRAINING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER === "true";

const BASE_NAV_LINKS = [
  { label: "Curriculum / AI Factory", href: "/admin/curriculum" },
  { label: "Curriculum Units", href: "/admin/curriculum/units" },
  { label: "Homework", href: "/admin/homework" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "AI Costs", href: "/admin/ai-costs" },
  { label: "Guardian Links", href: "/admin/guardian-link" },
  { label: "Classes", href: "/admin/classes" },
  { label: "Students", href: "/admin/students" },
  { label: "Teachers", href: "/admin/teachers" },
  { label: "School Branding", href: "/admin/school-branding" },
  { label: "School Settings", href: "/admin/school-settings" },
  { label: "Reports", href: "/admin/reports" },
  { label: "Notifications", href: "/admin/notifications" },
  { label: "Pilot Score", href: "/admin/pilot-score" },
  { label: "Onboarding", href: "/admin/onboarding" },
  { label: "Audit Log", href: "/admin/audit" },
  { label: "Compliance", href: "/admin/compliance" },
  { label: "Data Downloads", href: "/admin/governance/exports" },
  { label: "Seed Demo Data", href: "/admin/seed" },
  { label: "Schools", href: "/admin/schools" },
];

// Training Adoption link only appears when ENABLE_TRAINING_CENTER is true
const NAV_LINKS = TRAINING_ENABLED
  ? [...BASE_NAV_LINKS, { label: "Training Adoption", href: "/admin/training/adoption" }]
  : BASE_NAV_LINKS;

export default async function AdminConsolePage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  // Session JWT may have stale null schoolId. Check DB as fallback.
  let schoolId = user.schoolId as string | null;
  if (!schoolId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { schoolId: true },
    });
    schoolId = dbUser?.schoolId ?? null;
  }

  // ---- No schoolId: show helpful CTA instead of dead-end ----
  if (!schoolId) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
        <div className="mx-auto max-w-2xl px-4 py-12 text-center space-y-6">
          <p className="text-xs uppercase tracking-wide text-emerald-300">
            LIBERIALEARN - ADMIN
          </p>
          <h1 className="text-2xl font-bold">No School Assigned</h1>
          <p className="text-sm text-slate-400">
            Your admin account ({user.email}) does not have a school attached yet.
            Attach to the demo school to explore the platform, or log out and use the
            primary demo admin account.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <AttachDemoSchoolButton />
            <Link
              href="/api/auth/signout"
              className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold hover:bg-slate-900"
            >
              Log out (use admin@cha.edu.lr)
            </Link>
          </div>

          {/* Still show nav links even without schoolId */}
          <div className="pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-500 mb-3">Or navigate directly:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-slate-50 hover:border-slate-500"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ---- Normal admin console with schoolId ----
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

  // Check onboarding status
  const schoolDetail = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { onboardingStep: true },
  });
  const onboardingIncomplete = !schoolDetail?.onboardingStep || schoolDetail.onboardingStep < 5;

  const stats = [
    { label: "Total Students", value: studentCount, color: "text-emerald-300" },
    { label: "Total Teachers", value: teacherCount, color: "text-blue-300" },
    { label: "Lessons Delivered This Month", value: lessonsDeliveredThisMonth, color: "text-amber-300" },
    { label: "School Attendance Rate (30d)", value: `${attendanceRate30d}%`, color: "text-purple-300" },
  ];

  const actions = [
    { label: "Curriculum / AI Factory", href: "/admin/curriculum", bg: "bg-emerald-500" },
    { label: "Curriculum Units", href: "/admin/curriculum/units", bg: "bg-teal-500" },
    { label: "Seed Demo Data", href: "/admin/seed", bg: "bg-blue-500" },
    { label: "Homework", href: "/admin/homework", bg: "bg-purple-500" },
    { label: "AI Costs", href: "/admin/ai-costs", bg: "bg-teal-500" },
    { label: "Guardian Links", href: "/admin/guardian-link", bg: "bg-amber-500" },
    { label: "Analytics", href: "/admin/analytics", bg: "bg-cyan-500" },
    { label: "Classes", href: "/admin/classes", bg: "bg-rose-500" },
    { label: "Students", href: "/admin/students", bg: "bg-emerald-600" },
    { label: "Teachers", href: "/admin/teachers", bg: "bg-sky-500" },
    { label: "School Branding", href: "/admin/school-branding", bg: "bg-pink-500" },
    { label: "School Settings", href: "/admin/school-settings", bg: "bg-indigo-500" },
    ...(TRAINING_ENABLED
      ? [{ label: "Training Adoption", href: "/admin/training/adoption", bg: "bg-teal-500" }]
      : []),
    { label: "Compliance", href: "/admin/compliance", bg: "bg-orange-500" },
    { label: "Data Downloads", href: "/admin/governance/exports", bg: "bg-fuchsia-600" },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-300 mb-1">
              LIBERIALEARN - ADMIN
            </p>
            <h1 className="text-2xl md:text-3xl font-bold">
              Admin Console{" "}
              <span className="text-slate-400 font-normal">
                &mdash; {schoolName}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-slate-700 px-4 py-2 text-xs md:text-sm hover:bg-slate-900"
            >
              Home
            </Link>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-full bg-red-500 px-4 py-2 text-xs md:text-sm font-semibold text-slate-950 hover:bg-red-400"
              >
                Log out
              </button>
            </form>
          </div>
        </header>

        {/* Onboarding banner */}
        {onboardingIncomplete && (
          <Link
            href="/admin/onboarding"
            className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 hover:bg-amber-500/20 transition-colors"
          >
            <span className="text-2xl">&#9888;</span>
            <div>
              <p className="text-sm font-semibold text-amber-300">Complete School Onboarding</p>
              <p className="text-xs text-amber-400/70">
                Finish the 5-step setup wizard to improve your Pilot Readiness Score.
              </p>
            </div>
          </Link>
        )}

        <AdminNav />

        {/* Stats cards */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
            >
              <p className="text-xs text-slate-400 mb-1">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </section>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Class Performance</h2>
            <span className="text-xs text-slate-500">{classPerformance.length} classes</span>
          </div>
          {classPerformance.length === 0 ? (
            <p className="text-sm text-slate-400">No classes yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
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
                    <tr key={row.id} className="border-b border-slate-800/60 text-slate-200">
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

        <section className="mb-8 grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Students Needing Attention</h2>
                <p className="text-xs text-slate-500">Active intervention signals across the school.</p>
              </div>
              {atRiskTotal > 10 ? (
                <Link href="/admin/students" className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">
                  View All
                </Link>
              ) : null}
            </div>
            {atRiskStudents.length === 0 ? (
              <p className="text-sm text-slate-400">No at-risk alerts. Great work!</p>
            ) : (
              <div className="space-y-2">
                {atRiskStudents.map((student) => (
                  <div key={student.studentId} className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{student.name}</p>
                        <p className="text-xs text-slate-500">
                          Grade {student.grade ?? "-"} · {student.className ?? "Unassigned"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-amber-300">{student.subject}</p>
                        <p className="text-[11px] text-slate-400">{student.alertType.replace(/_/g, " ")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <div className="mt-4 space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-slate-400">No recent activity.</p>
              ) : (
                recentActivity.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-100">{entry.action.replace(/\./g, " ")}</p>
                    <p className="text-xs text-slate-500">
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

        {/* Quick actions */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="flex min-h-[120px] flex-col items-start justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-4 transition-colors hover:bg-slate-800/80"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${a.bg} text-sm font-bold text-slate-950`}
                >
                  {a.label[0]}
                </div>
                <span className="text-sm font-semibold leading-snug">{a.label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

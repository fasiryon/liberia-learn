import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPilotReadinessReport } from "@/lib/readiness/readinessService";

export const dynamic = "force-dynamic";

export default async function AdminSchoolDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  if (!user.isPlatformAdmin && user.schoolId !== params.id) {
    redirect("/admin/schools");
  }

  const school = await prisma.school.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      county: true,
      timezone: true,
      classes: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          subject: true,
        },
      },
    },
  });

  if (!school) {
    notFound();
  }

  const [studentCount, teacherCount, readiness] = await Promise.all([
    prisma.user.count({ where: { schoolId: school.id, role: "STUDENT" } }),
    prisma.user.count({ where: { schoolId: school.id, role: "TEACHER" } }),
    getPilotReadinessReport(school.id),
  ]);

  const stats = [
    { label: "Students", value: studentCount },
    { label: "Teachers", value: teacherCount },
    { label: "Classes", value: school.classes.length },
    { label: "Pilot readiness score", value: `${readiness.readinessScore}/100` },
  ];

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
          <div>
            <Link
              href="/admin/schools"
              className="text-xs font-semibold text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]"
            >
              Back to schools
            </Link>
            <h1 className="mt-3 text-3xl font-bold">{school.name}</h1>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
              {school.county ?? "County not set"} · {school.timezone}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/students"
              className="rounded-full border border-[var(--ll-border)] px-4 py-2 text-xs text-[var(--ll-text)] hover:bg-[var(--ll-surface)]"
            >
              Manage students
            </Link>
            <Link
              href="/admin/teachers"
              className="rounded-full border border-[var(--ll-border)] px-4 py-2 text-xs text-[var(--ll-text)] hover:bg-[var(--ll-surface)]"
            >
              Manage teachers
            </Link>
            <Link
              href="/admin/school-settings"
              className="rounded-full border border-[var(--ll-border)] px-4 py-2 text-xs text-[var(--ll-text)] hover:bg-[var(--ll-surface)]"
            >
              School settings
            </Link>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5"
            >
              <p className="text-xs text-[var(--ll-text-muted)]">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold text-[var(--ll-yellow)]">{stat.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Classes</h2>
              <span className="text-xs text-[var(--ll-text-faint)]">{school.classes.length} total</span>
            </div>
            {school.classes.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--ll-text-muted)]">No classes created yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {school.classes.map((classroom) => (
                  <div
                    key={classroom.id}
                    className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-4 py-3"
                  >
                    <p className="font-semibold text-[var(--ll-text)]">{classroom.name}</p>
                    <p className="text-xs text-[var(--ll-text-muted)]">{String(classroom.subject).replace(/_/g, " ")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <h2 className="text-lg font-semibold">Readiness snapshot</h2>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
              Current level: <span className="capitalize text-[var(--ll-text)]">{readiness.readinessLevel.replace(/_/g, " ")}</span>
            </p>

            <div className="mt-4 space-y-3">
              {readiness.sections.map((section) => (
                <div key={section.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--ll-text)]">{section.title}</p>
                    <span className="text-xs text-[var(--ll-yellow)]">{section.score}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

import { prisma } from "@/lib/db";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMoePortalUser } from "@/lib/moeAccess";

export const dynamic = "force-dynamic";

export default async function PlatformDashboard() {
  let user = null;
  try {
    user = await requireMoePortalUser();
  } catch (err: any) {
    if (err?.status === 404) notFound();
    redirect("/login");
  }

  if (user.role === "DISTRICT_ADMIN") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">District Portal</h1>
          <p className="text-sm text-[var(--ll-text-muted)] mt-1">
            District insights are being prepared. Contact LiberiaLearn support
            for early access.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 text-sm text-[var(--ll-text-muted)]">
          Your district dashboard will appear here once it is enabled.
        </div>
      </div>
    );
  }

  const [schoolCount, userCount, studentCount, teacherCount, curriculumCount] =
    await Promise.all([
      prisma.school.count(),
      prisma.user.count(),
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({ where: { role: "TEACHER" } }),
      prisma.curriculumContent.count(),
    ]);

  const recentSchools = await prisma.school.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      county: true,
      createdAt: true,
      _count: { select: { users: true, classes: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const [allUnits, textbookAuditLogs] = await Promise.all([
    prisma.curriculumUnit.findMany({
      select: {
        subject: true,
        grade: true,
      },
      orderBy: [{ subject: "asc" }, { grade: "asc" }],
    }),
    prisma.auditLog.findMany({
      where: { action: "admin.textbook.generated" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        createdAt: true,
        details: true,
      },
    }),
  ]);

  const textbookLastGenerated = new Map<string, string>();
  for (const entry of textbookAuditLogs) {
    const details = (entry.details as any) ?? {};
    const key =
      typeof details.subject === "string" && typeof details.gradeLevel === "number"
        ? `${details.subject}|${details.gradeLevel}`
        : null;
    if (!key || textbookLastGenerated.has(key)) {
      continue;
    }
    textbookLastGenerated.set(key, entry.createdAt.toLocaleDateString("en-LR"));
  }

  const unitGroups = Array.from(
    allUnits.reduce(
      (accumulator, unit) => {
        const key = `${unit.subject}|${unit.grade}`;
        const current = accumulator.get(key) ?? {
          subject: unit.subject,
          grade: unit.grade,
          count: 0,
        };
        current.count += 1;
        accumulator.set(key, current);
        return accumulator;
      },
      new Map<string, { subject: string; grade: number; count: number }>()
    ).values()
  )
    .filter((group) => group.count >= 2)
    .sort((left, right) =>
      left.subject === right.subject
        ? left.grade - right.grade
        : left.subject.localeCompare(right.subject)
    );

  const stats = [
    { label: "Schools", value: schoolCount, color: "bg-violet-500/20 text-violet-300" },
    { label: "Total Users", value: userCount, color: "bg-[var(--ll-silver-soft)] text-[var(--ll-silver)]" },
    { label: "Students", value: studentCount, color: "bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)]" },
    { label: "Teachers", value: teacherCount, color: "bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)]" },
    { label: "Curriculum Items", value: curriculumCount, color: "bg-[var(--ll-silver-soft)] text-[var(--ll-silver)]" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Platform Dashboard</h1>
        <p className="text-sm text-[var(--ll-text-muted)] mt-1">
          Cross-school overview for MOE platform administrators.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4"
          >
            <p className="text-xs text-[var(--ll-text-muted)]">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.color.split(" ")[1]}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent schools */}
      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Schools</h2>
          <Link
            href="/platform/schools"
            className="text-xs text-violet-300 hover:text-violet-200"
          >
            Manage All Schools
          </Link>
        </div>

        {recentSchools.length === 0 ? (
          <p className="text-sm text-[var(--ll-text-muted)]">No schools yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ll-border)] text-left text-xs text-[var(--ll-text-faint)]">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">County</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Users</th>
                  <th className="pb-2 pr-4">Classes</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentSchools.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-[var(--ll-border)]/50 text-[var(--ll-text)]"
                  >
                    <td className="py-2 pr-4 font-medium text-[var(--ll-text)]">
                      {s.name}
                    </td>
                    <td className="py-2 pr-4">{s.county ?? "--"}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          s.status === "ACTIVE"
                            ? "bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)]"
                            : s.status === "PENDING"
                            ? "bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)]"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{s._count.users}</td>
                    <td className="py-2 pr-4">{s._count.classes}</td>
                    <td className="py-2 text-xs text-[var(--ll-text-faint)]">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Textbooks</h2>
            <p className="text-sm text-[var(--ll-text-muted)] mt-1">
              Subject and grade combinations with enough assembled units to compile a textbook.
            </p>
          </div>
        </div>

        {unitGroups.length === 0 ? (
          <p className="text-sm text-[var(--ll-text-muted)]">No textbooks available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ll-border)] text-left text-xs text-[var(--ll-text-faint)]">
                  <th className="pb-2 pr-4">Subject</th>
                  <th className="pb-2 pr-4">Grade</th>
                  <th className="pb-2 pr-4">Units</th>
                  <th className="pb-2 pr-4">Last Generated</th>
                  <th className="pb-2">Download</th>
                </tr>
              </thead>
              <tbody>
                {unitGroups.map((group) => {
                  const key = `${group.subject}|${group.grade}`;
                  return (
                    <tr key={key} className="border-b border-[var(--ll-border)]/50 text-[var(--ll-text)]">
                      <td className="py-2 pr-4 font-medium text-[var(--ll-text)]">
                        {group.subject.replace(/_/g, " ")}
                      </td>
                      <td className="py-2 pr-4">{group.grade}</td>
                      <td className="py-2 pr-4">{group.count}</td>
                      <td className="py-2 pr-4">
                        {textbookLastGenerated.get(key) ?? "Not yet generated"}
                      </td>
                      <td className="py-2">
                        <Link
                          href={`/api/admin/curriculum/textbook?subject=${encodeURIComponent(
                            group.subject
                          )}&gradeLevel=${group.grade}`}
                          className="text-xs font-semibold text-[var(--ll-silver)] hover:text-[var(--ll-silver)]"
                        >
                          Download
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

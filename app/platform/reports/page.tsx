import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PlatformReportsPage() {
  const user = await requirePlatformAdmin().catch(() => null);
  if (!user) redirect("/login");

  const [schoolCount, studentCount, teacherCount, curriculumCount] =
    await Promise.all([
      prisma.school.count(),
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({ where: { role: "TEACHER" } }),
      prisma.curriculumContent.count(),
    ]);

  // Per-county aggregates
  const schools = await prisma.school.findMany({
    select: {
      county: true,
      _count: { select: { users: true, classes: true } },
    },
  });

  const countyMap = new Map<string, { schools: number; users: number; classes: number }>();
  for (const s of schools) {
    const county = s.county ?? "Unassigned";
    const existing = countyMap.get(county) ?? { schools: 0, users: 0, classes: 0 };
    existing.schools += 1;
    existing.users += s._count.users;
    existing.classes += s._count.classes;
    countyMap.set(county, existing);
  }

  const countyStats = Array.from(countyMap.entries())
    .map(([county, stats]) => ({ county, ...stats }))
    .sort((a, b) => b.users - a.users);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">MOE Reports</h1>
        <p className="text-sm text-slate-400 mt-1">
          Aggregate statistics for Ministry of Education reporting.
        </p>
      </div>

      {/* National summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Schools", value: schoolCount },
          { label: "Students", value: studentCount },
          { label: "Teachers", value: teacherCount },
          { label: "Curriculum Items", value: curriculumCount },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
          >
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-violet-300">{s.value}</p>
          </div>
        ))}
      </div>

      {/* County breakdown */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold mb-4">By County</h2>
        {countyStats.length === 0 ? (
          <p className="text-sm text-slate-400">No data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-4">County</th>
                  <th className="pb-2 pr-4">Schools</th>
                  <th className="pb-2 pr-4">Users</th>
                  <th className="pb-2">Classes</th>
                </tr>
              </thead>
              <tbody>
                {countyStats.map((c) => (
                  <tr
                    key={c.county}
                    className="border-b border-slate-800/50 text-slate-300"
                  >
                    <td className="py-2 pr-4 font-medium text-slate-100">
                      {c.county}
                    </td>
                    <td className="py-2 pr-4">{c.schools}</td>
                    <td className="py-2 pr-4">{c.users}</td>
                    <td className="py-2">{c.classes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

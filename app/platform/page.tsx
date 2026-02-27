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
          <p className="text-sm text-slate-400 mt-1">
            District insights are being prepared. Contact LiberiaLearn support
            for early access.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-400">
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

  const stats = [
    { label: "Schools", value: schoolCount, color: "bg-violet-500/20 text-violet-300" },
    { label: "Total Users", value: userCount, color: "bg-blue-500/20 text-blue-300" },
    { label: "Students", value: studentCount, color: "bg-emerald-500/20 text-emerald-300" },
    { label: "Teachers", value: teacherCount, color: "bg-amber-500/20 text-amber-300" },
    { label: "Curriculum Items", value: curriculumCount, color: "bg-cyan-500/20 text-cyan-300" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Platform Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">
          Cross-school overview for MOE platform administrators.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
          >
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.color.split(" ")[1]}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent schools */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
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
          <p className="text-sm text-slate-400">No schools yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
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
                    className="border-b border-slate-800/50 text-slate-300"
                  >
                    <td className="py-2 pr-4 font-medium text-slate-100">
                      {s.name}
                    </td>
                    <td className="py-2 pr-4">{s.county ?? "--"}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          s.status === "ACTIVE"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : s.status === "PENDING"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{s._count.users}</td>
                    <td className="py-2 pr-4">{s._count.classes}</td>
                    <td className="py-2 text-xs text-slate-500">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
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

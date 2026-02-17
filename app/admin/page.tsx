import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminConsolePage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  const schoolId = user.schoolId as string | null;
  if (!schoolId) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p>No school assigned to this admin account.</p>
      </main>
    );
  }

  const [school, studentCount, teacherCount, classCount, homeworkCount] =
    await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
      prisma.user.count({ where: { schoolId, role: "STUDENT" } }),
      prisma.user.count({ where: { schoolId, role: "TEACHER" } }),
      prisma.class.count({ where: { schoolId } }),
      prisma.homework.count({
        where: { Class: { schoolId } },
      }),
    ]);

  const schoolName = school?.name ?? "Your School";

  const stats = [
    { label: "Total Students", value: studentCount, color: "text-emerald-300" },
    { label: "Total Teachers", value: teacherCount, color: "text-blue-300" },
    { label: "Total Classes", value: classCount, color: "text-amber-300" },
    { label: "Homework Assigned", value: homeworkCount, color: "text-purple-300" },
  ];

  const actions = [
    { label: "Curriculum / AI Factory", href: "/admin/curriculum", bg: "bg-emerald-500" },
    { label: "Seed Demo Data", href: "/admin/seed", bg: "bg-blue-500" },
    { label: "Homework", href: "/admin/homework", bg: "bg-purple-500" },
    { label: "Guardian Links", href: "/admin/guardian-link", bg: "bg-amber-500" },
    { label: "Analytics", href: "/admin/analytics", bg: "bg-cyan-500" },
    { label: "Classes", href: "/admin/classes", bg: "bg-rose-500" },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between gap-4">
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

        {/* Quick actions */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className={`flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 hover:bg-slate-800/80 transition-colors`}
              >
                <div
                  className={`h-10 w-10 rounded-xl ${a.bg} flex items-center justify-center text-slate-950 font-bold text-sm`}
                >
                  {a.label[0]}
                </div>
                <span className="text-sm font-semibold">{a.label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

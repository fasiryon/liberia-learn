import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PlatformReportsPage() {
  const user = await requirePlatformAdmin().catch(() => null);
  if (!user) redirect("/login");

  // ---- National Summary ----
  const [schoolCount, studentCount, teacherCount, curriculumCount, fullPackCount] =
    await Promise.all([
      prisma.school.count(),
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({ where: { role: "TEACHER" } }),
      prisma.curriculumContent.count(),
      prisma.curriculumContent.count({ where: { contentType: "full_pack", status: "published" } }),
    ]);

  // ---- County breakdown ----
  const schools = await prisma.school.findMany({
    select: {
      id: true,
      name: true,
      county: true,
      primaryHex: true,
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

  // ---- Attendance rollups per county ----
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    select: {
      status: true,
      Meeting: { select: { Class: { select: { School: { select: { county: true } } } } } },
    },
    take: 5000,
  });

  const attendanceByCounty = new Map<string, { total: number; present: number; absent: number; late: number }>();
  for (const r of attendanceRecords) {
    const county = r.Meeting.Class.School.county ?? "Unassigned";
    const entry = attendanceByCounty.get(county) ?? { total: 0, present: 0, absent: 0, late: 0 };
    entry.total++;
    if (r.status === "PRESENT") entry.present++;
    else if (r.status === "ABSENT") entry.absent++;
    else if (r.status === "LATE") entry.late++;
    attendanceByCounty.set(county, entry);
  }
  const attendanceStats = Array.from(attendanceByCounty.entries())
    .map(([county, s]) => ({
      county,
      total: s.total,
      presentPct: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
      absentPct: s.total > 0 ? Math.round((s.absent / s.total) * 100) : 0,
      latePct: s.total > 0 ? Math.round((s.late / s.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // ---- Performance signals (avg grades per school) ----
  const grades = await prisma.grade.findMany({
    select: {
      percent: true,
      Class: { select: { School: { select: { id: true, name: true, county: true } } } },
    },
    take: 5000,
  });

  const perfBySchool = new Map<string, { name: string; county: string; total: number; sum: number }>();
  for (const g of grades) {
    const sid = g.Class.School.id;
    const entry = perfBySchool.get(sid) ?? { name: g.Class.School.name, county: g.Class.School.county ?? "", total: 0, sum: 0 };
    entry.total++;
    entry.sum += g.percent;
    perfBySchool.set(sid, entry);
  }
  const perfStats = Array.from(perfBySchool.values())
    .map((s) => ({ ...s, avgGrade: s.total > 0 ? Math.round(s.sum / s.total) : 0 }))
    .sort((a, b) => b.avgGrade - a.avgGrade);

  // ---- Curriculum adoption ----
  const curriculumByType = await prisma.curriculumContent.groupBy({
    by: ["contentType"],
    _count: true,
    where: { status: "published" },
  });

  // ---- Pilot Readiness Score ----
  const schoolsForReadiness = await prisma.school.findMany({
    select: {
      id: true,
      name: true,
      county: true,
      primaryHex: true,
      _count: { select: { users: true, classes: true } },
    },
  });

  const readinessScores = await Promise.all(
    schoolsForReadiness.map(async (school) => {
      let score = 0;

      // Branding set (20 pts)
      if (school.primaryHex) score += 20;

      // Guardian SMS coverage (20 pts)
      const guardianCount = await prisma.user.count({
        where: { schoolId: school.id, role: "GUARDIAN" },
      });
      const smsGuardians = await prisma.user.count({
        where: { schoolId: school.id, role: "GUARDIAN", guardianPhoneE164: { not: null } },
      });
      if (guardianCount > 0) {
        score += Math.round((smsGuardians / guardianCount) * 20);
      }

      // Attendance records exist (20 pts)
      const attendanceCount = await prisma.attendanceRecord.count({
        where: { Meeting: { Class: { schoolId: school.id } } },
        take: 1,
      });
      if (attendanceCount > 0) score += 20;

      // Curriculum packs published (20 pts)
      const publishedPacks = await prisma.curriculumContent.count({
        where: { status: "published" },
      });
      if (publishedPacks > 0) score += 20;

      // Classes with enrollments (20 pts)
      const classesWithEnrollments = await prisma.enrollment.findFirst({
        where: { Class: { schoolId: school.id } },
      });
      if (classesWithEnrollments) score += 20;

      return { name: school.name, county: school.county ?? "Unassigned", score };
    })
  );

  function readinessColor(score: number) {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 40) return "bg-amber-500";
    return "bg-red-500";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">MOE Reports</h1>
        <p className="text-sm text-slate-400 mt-1">
          Aggregate statistics for Ministry of Education reporting.
        </p>
      </div>

      {/* National summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: "Schools", value: schoolCount },
          { label: "Students", value: studentCount },
          { label: "Teachers", value: teacherCount },
          { label: "Curriculum Items", value: curriculumCount },
          { label: "Full Packs Published", value: fullPackCount },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-violet-300">{s.value}</p>
          </div>
        ))}
      </div>

      {/* CSV Export Links */}
      <div className="flex flex-wrap gap-2">
        {["attendance", "performance", "curriculum", "readiness"].map((type) => (
          <a
            key={type}
            href={`/api/platform/reports?type=${type}&format=csv`}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-violet-500 hover:text-violet-300"
          >
            Export {type} CSV
          </a>
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
                  <tr key={c.county} className="border-b border-slate-800/50 text-slate-300">
                    <td className="py-2 pr-4 font-medium text-slate-100">{c.county}</td>
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

      {/* Attendance Rollups */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold mb-4">Attendance by County</h2>
        {attendanceStats.length === 0 ? (
          <p className="text-sm text-slate-400">No attendance data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-4">County</th>
                  <th className="pb-2 pr-4">Records</th>
                  <th className="pb-2 pr-4">Present %</th>
                  <th className="pb-2 pr-4">Absent %</th>
                  <th className="pb-2">Late %</th>
                </tr>
              </thead>
              <tbody>
                {attendanceStats.map((a) => (
                  <tr key={a.county} className="border-b border-slate-800/50 text-slate-300">
                    <td className="py-2 pr-4 font-medium text-slate-100">{a.county}</td>
                    <td className="py-2 pr-4">{a.total}</td>
                    <td className="py-2 pr-4 text-emerald-400">{a.presentPct}%</td>
                    <td className="py-2 pr-4 text-red-400">{a.absentPct}%</td>
                    <td className="py-2 text-amber-400">{a.latePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Performance Signals */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold mb-4">Performance by School</h2>
        {perfStats.length === 0 ? (
          <p className="text-sm text-slate-400">No grade data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-4">School</th>
                  <th className="pb-2 pr-4">County</th>
                  <th className="pb-2 pr-4">Avg Grade %</th>
                  <th className="pb-2">Total Grades</th>
                </tr>
              </thead>
              <tbody>
                {perfStats.map((p) => (
                  <tr key={p.name} className="border-b border-slate-800/50 text-slate-300">
                    <td className="py-2 pr-4 font-medium text-slate-100">{p.name}</td>
                    <td className="py-2 pr-4">{p.county}</td>
                    <td className="py-2 pr-4 text-violet-300">{p.avgGrade}%</td>
                    <td className="py-2">{p.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Curriculum Adoption */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold mb-4">Curriculum Adoption</h2>
        {curriculumByType.length === 0 ? (
          <p className="text-sm text-slate-400">No published curriculum.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {curriculumByType.map((ct) => (
              <div key={ct.contentType} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs text-slate-400 capitalize">{ct.contentType.replace(/_/g, " ")}</p>
                <p className="text-xl font-bold text-violet-300 mt-1">{ct._count}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pilot Readiness Score */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold mb-4">Pilot Readiness Score</h2>
        <p className="text-xs text-slate-400 mb-4">
          Score out of 100: Branding (20) + Guardian SMS (20) + Attendance (20) + Curriculum (20) + Enrollments (20)
        </p>
        {readinessScores.length === 0 ? (
          <p className="text-sm text-slate-400">No schools.</p>
        ) : (
          <div className="space-y-3">
            {readinessScores
              .sort((a, b) => b.score - a.score)
              .map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="w-40 shrink-0">
                    <p className="text-sm font-medium text-slate-100 truncate">{s.name}</p>
                    <p className="text-[10px] text-slate-500">{s.county}</p>
                  </div>
                  <div className="flex-1 h-4 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${readinessColor(s.score)} transition-all`}
                      style={{ width: `${s.score}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-200 w-10 text-right">{s.score}</span>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}


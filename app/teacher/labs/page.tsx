import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TeacherLabsPage() {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      throw new Error("No school context available.");
    }

    const classes = await prisma.class.findMany({
      where: { teacherId: user.id, schoolId: user.schoolId },
      select: { id: true },
    });

    const classIds = classes.map((cls) => cls.id);
    const scheduledWork = classIds.length
      ? await prisma.scheduledWork.findMany({
          where: { classId: { in: classIds } },
          select: { id: true, scheduledDate: true },
        })
      : [];

    const workMap = new Map(scheduledWork.map((item) => [item.id, item]));
    const sessions = scheduledWork.length
      ? await prisma.labSession.findMany({
          where: {
            schoolId: user.schoolId,
            scheduledWorkId: { in: scheduledWork.map((item) => item.id) },
          },
          select: {
            id: true,
            labId: true,
            startedAt: true,
            completedAt: true,
            score: true,
            student: { select: { name: true, email: true } },
          },
          orderBy: { startedAt: "desc" },
        })
      : [];

    const labs = sessions.length
      ? await prisma.virtualLab.findMany({
          where: { labId: { in: sessions.map((session) => session.labId) } },
          select: { labId: true, title: true },
        })
      : [];

    const labMap = new Map(labs.map((lab) => [lab.labId, lab.title]));

    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
        <div className="mx-auto max-w-6xl space-y-6">
          <div>
            <Link href="/teacher/dashboard" className="text-sm text-emerald-300 hover:text-emerald-200">
              &larr; Back to Teacher Dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-bold">Teacher Lab Review</h1>
            <p className="mt-2 text-sm text-slate-400">
              Review lab sessions from your classes, inspect student observations, and record your feedback.
            </p>
          </div>

          {sessions.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
              No lab sessions are ready for review yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-900/90 text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Lab</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className="border-t border-white/5 text-slate-200">
                      <td className="px-4 py-3">{session.student.name ?? session.student.email ?? "Student"}</td>
                      <td className="px-4 py-3">{labMap.get(session.labId) ?? session.labId}</td>
                      <td className="px-4 py-3">
                        {(workMap.get(session.id)?.scheduledDate ?? session.startedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">{session.completedAt ? "Submitted" : "In progress"}</td>
                      <td className="px-4 py-3">{session.score ?? "Pending"}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/teacher/labs/sessions/${session.id}`}
                          className="inline-flex rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    );
  } catch (error: any) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
          {error?.message ?? "Unable to load lab reviews."}
        </div>
      </main>
    );
  }
}

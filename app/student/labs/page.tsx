import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function typeLabel(labType: string) {
  if (labType === "guided_walkthrough") return "Physical";
  if (labType === "2d_simulation") return "Simulation";
  return "Virtual";
}

export default async function StudentLabsPage() {
  try {
    const user = await requireRole("STUDENT");

    const sessions = await prisma.labSession.findMany({
      where: { studentId: user.id, schoolId: user.schoolId ?? undefined },
      orderBy: [{ completedAt: "asc" }, { startedAt: "desc" }],
      select: {
        id: true,
        labId: true,
        startedAt: true,
        completedAt: true,
        score: true,
      },
    });

    const labIds = sessions.map((session) => session.labId);
    const labs = labIds.length
      ? await prisma.virtualLab.findMany({
          where: { labId: { in: labIds } },
          select: {
            labId: true,
            title: true,
            subject: true,
            estimatedMinutes: true,
            labType: true,
          },
        })
      : [];

    const labMap = new Map(labs.map((lab) => [lab.labId, lab]));

    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <Link href="/student/dashboard" className="text-sm text-emerald-300 hover:text-emerald-200">
              &larr; Back to Dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-bold">Student Labs</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Complete your assigned labs, record your observations, and submit your findings for teacher review.
            </p>
          </div>

          {sessions.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 text-sm text-slate-300">
              No labs have been assigned yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {sessions.map((session) => {
                const lab = labMap.get(session.labId);
                if (!lab) return null;

                return (
                  <div key={session.id} className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-slate-100">{lab.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{lab.subject.replace(/_/g, " ")}</p>
                      </div>
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-200">
                        {typeLabel(lab.labType)}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                      <span className="rounded-full border border-white/10 px-3 py-1">{lab.estimatedMinutes} min</span>
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        {session.completedAt ? `Completed${session.score != null ? ` • ${session.score}%` : ""}` : "Ready to start"}
                      </span>
                    </div>

                    <Link
                      href={`/student/labs/${lab.labId}`}
                      className="mt-5 inline-flex rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
                    >
                      {session.completedAt ? "Review Lab" : "Start Lab"}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    );
  } catch (error: any) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
          {error?.message ?? "Unable to load labs."}
        </div>
      </main>
    );
  }
}

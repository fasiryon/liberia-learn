import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { labRegistry } from "@/lib/labs/registry";
import type { LabId } from "@/lib/labs/types";
import { isAiLabsEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

function typeLabel(labType: string) {
  if (labType === "guided_walkthrough") return "Physical";
  if (labType === "2d_simulation") return "Simulation";
  return "Virtual";
}

const LAB_GROUPS: Array<{
  subject: string;
  accent: string;
  labs: LabId[];
}> = [
  {
    subject: "Physics",
    accent: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
    labs: ["gravity-explorer", "pendulum-lab", "electric-circuit", "wave-motion"],
  },
  {
    subject: "Biology",
    accent: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
    labs: ["human-heart", "cell-division", "ecosystem-balance"],
  },
  {
    subject: "Chemistry",
    accent: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-100",
    labs: ["molecule-motion", "chemical-reaction", "periodic-table"],
  },
  {
    subject: "Earth Science",
    accent: "border-amber-400/30 bg-amber-400/10 text-amber-100",
    labs: ["weather-system", "tectonic-plates"],
  },
];

export default async function StudentLabsPage() {
  try {
    const user = await requireRole("STUDENT");
    const aiLabsEnabled = isAiLabsEnabled();

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
      <main className="ll-dashboard-shell px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <div>
            <Link href="/student/dashboard" className="text-sm text-emerald-300 hover:text-emerald-200">
              &larr; Back to Dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-bold">Student Labs</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Open AI learning labs or complete assigned practical labs for teacher review.
            </p>
          </div>

          <section className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  AI Labs Library
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">All 12 interactive learning labs</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Browse the complete lab library by subject. Each lab opens with a canvas scene, controls, tutor prompts, and validated state changes.
                </p>
              </div>
              {!aiLabsEnabled ? (
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">
                  Disabled
                </span>
              ) : null}
            </div>
            {LAB_GROUPS.map((group) => (
              <section key={group.subject} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-white">{group.subject}</h3>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${group.accent}`}>
                    {group.labs.length} labs
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {group.labs.map((labId) => {
                    const lab = labRegistry[labId];
                    if (!lab) return null;
                    return (
                      <article key={lab.id} className="flex min-h-64 flex-col rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5 shadow-none">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${group.accent}`}>
                            {lab.subject}
                          </span>
                          <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] font-semibold text-slate-300">
                            Tier {lab.tier}
                          </span>
                        </div>
                        <h4 className="mt-4 text-xl font-semibold leading-7 text-slate-50">{lab.title}</h4>
                        <p className="mt-1 text-sm font-medium text-slate-300">{lab.gradeBand}</p>
                        <p className="mt-3 flex-1 text-sm leading-6 text-slate-300">{lab.description}</p>
                        <Link
                          href={`/student/labs/${lab.id}`}
                          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
                        >
                          Open Lab
                        </Link>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </section>

          <section>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                Assigned Labs
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Teacher-assigned practical labs</h2>
            </div>

          {sessions.length === 0 ? (
            <div className="ll-section mt-4 rounded-xl p-8 text-sm text-slate-300">
              No labs have been assigned yet.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {sessions.map((session) => {
                const lab = labMap.get(session.labId);
                if (!lab) return null;

                return (
                  <div key={session.id} className="ll-card rounded-xl p-5">
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
          </section>
        </div>
      </main>
    );
  } catch (error: any) {
    return (
      <main className="ll-dashboard-shell px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-[var(--ll-danger)] bg-[rgba(251,113,133,0.08)] p-6 text-sm text-[var(--ll-danger)]">
          {error?.message ?? "Unable to load labs."}
        </div>
      </main>
    );
  }
}

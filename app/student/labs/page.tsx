import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
  badgeCls: string;
  labs: LabId[];
}> = [
  {
    subject: "Physics",
    badgeCls: "border-[var(--ll-yellow)]/30 bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)]",
    labs: ["gravity-explorer", "pendulum-lab", "electric-circuit", "wave-motion"],
  },
  {
    subject: "Biology",
    badgeCls: "border-[var(--ll-pink)]/30 bg-[var(--ll-pink-soft)] text-[var(--ll-pink)]",
    labs: ["human-heart", "cell-division", "ecosystem-balance"],
  },
  {
    subject: "Chemistry",
    badgeCls: "border-[var(--ll-silver)]/30 bg-[var(--ll-silver-soft)] text-[var(--ll-silver)]",
    labs: ["molecule-motion", "chemical-reaction", "periodic-table"],
  },
  {
    subject: "Earth Science",
    badgeCls: "border-[var(--ll-wood)]/30 bg-[rgba(200,149,106,0.11)] text-[var(--ll-wood)]",
    labs: ["weather-system", "tectonic-plates"],
  },
];

function parseGradeBand(gradeBand: string): { min: number; max: number } {
  const match = gradeBand.match(/(\d+)[^\d]+(\d+)/);
  if (match) return { min: Number(match[1]), max: Number(match[2]) };
  const single = gradeBand.match(/(\d+)/);
  if (single) return { min: Number(single[1]), max: Number(single[1]) };
  return { min: 1, max: 12 };
}

export default async function StudentLabsPage() {
  try {
    const user = await requireRole("STUDENT");
    const aiLabsEnabled = isAiLabsEnabled();

    const [student, sessions] = await Promise.all([
      prisma.student.findUnique({
        where: { userId: user.id },
        select: { currentGrade: true },
      }),
      prisma.labSession.findMany({
        where: { studentId: user.id, ...(user.schoolId ? { schoolId: user.schoolId } : {}) },
        orderBy: [{ completedAt: "asc" }, { startedAt: "desc" }],
        select: {
          id: true,
          labId: true,
          startedAt: true,
          completedAt: true,
          score: true,
        },
      }),
    ]);

    const studentGrade = student?.currentGrade ?? null;

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
        }).catch(() => [])
      : [];

    const labMap = new Map(labs.map((lab) => [lab.labId, lab]));

    return (
      <main className="ll-dashboard-shell px-4 py-5">
        <div className="mx-auto max-w-6xl space-y-5">
          <div>
            <Link href="/dashboard" className="text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)]">
              <span className="inline-flex items-center gap-1">
                <ChevronLeft size={14} />
                Back to Dashboard
              </span>
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-[var(--ll-text)]">Student Labs</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--ll-text-muted)]">
              Open AI learning labs or complete assigned practical labs for teacher review.
            </p>
          </div>

          <section className="space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                  AI Labs Library
                </p>
                <h2 className="mt-2 text-base font-semibold text-[var(--ll-text)]">All 12 interactive learning labs</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--ll-text-muted)]">
                  Browse the complete lab library by subject. Each lab opens with a canvas scene, controls, tutor prompts, and validated state changes.
                </p>
              </div>
              {!aiLabsEnabled ? (
                <span className="rounded-full border border-[var(--ll-border)] bg-[rgba(250,204,21,0.08)] px-3 py-1 text-xs font-medium text-[var(--ll-warning)]">
                  Disabled
                </span>
              ) : null}
            </div>
            {(() => {
              const gradeFilteredGroups = LAB_GROUPS.map((group) => ({
                ...group,
                labs: group.labs.filter((labId) => {
                  const lab = labRegistry[labId];
                  if (!lab || !studentGrade) return true;
                  const { min, max } = parseGradeBand(lab.gradeBand);
                  return studentGrade >= min && studentGrade <= max;
                }),
              })).filter((group) => group.labs.length > 0);

              if (gradeFilteredGroups.length === 0) {
                return (
                  <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-6 text-center">
                    <p className="text-sm text-[var(--ll-text-muted)]">
                      No labs available for your grade yet. Check back soon.
                    </p>
                  </div>
                );
              }

              return gradeFilteredGroups.map((group) => (
                <section key={group.subject} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-[var(--ll-text)]">{group.subject}</h3>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${group.badgeCls}`}>
                      {group.labs.length} labs
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {group.labs.map((labId) => {
                      const lab = labRegistry[labId];
                      if (!lab) return null;
                      return (
                        <article key={lab.id} className="flex min-h-64 flex-col rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 shadow-none">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${group.badgeCls}`}>
                              {lab.subject}
                            </span>
                            <span className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-[11px] font-medium text-[var(--ll-text-faint)]">
                              Tier {lab.tier}
                            </span>
                          </div>
                          <h4 className="mt-4 text-base font-semibold leading-6 text-[var(--ll-text)]">{lab.title}</h4>
                          <p className="mt-1 text-xs text-[var(--ll-text-faint)]">{lab.gradeBand}</p>
                          <p className="mt-3 flex-1 text-sm leading-6 text-[var(--ll-text-muted)]">{lab.description}</p>
                          <Link
                            href={`/student/labs/${lab.id}`}
                            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--ll-accent)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)] hover:opacity-90"
                          >
                            Open Lab
                          </Link>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ));
            })()}
          </section>

          <section>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                Assigned Labs
              </p>
              <h2 className="mt-2 text-base font-semibold text-[var(--ll-text)]">Teacher-assigned practical labs</h2>
            </div>

          {sessions.length === 0 ? (
            <div className="ll-section mt-4 p-6 text-center">
              <p className="text-sm leading-6 text-[var(--ll-text-muted)]">No labs have been assigned yet.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {sessions.map((session) => {
                const lab = labMap.get(session.labId);
                if (!lab) return null;

                return (
                  <div key={session.id} className="ll-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-[var(--ll-text)]">{lab.title}</p>
                        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{lab.subject.replace(/_/g, " ")}</p>
                      </div>
                      <span className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-1 text-[11px] font-medium text-[var(--ll-text-muted)]">
                        {typeLabel(lab.labType)}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--ll-text-faint)]">
                      <span className="rounded-full border border-[var(--ll-border)] px-3 py-1">{lab.estimatedMinutes} min</span>
                      <span className="rounded-full border border-[var(--ll-border)] px-3 py-1">
                        {session.completedAt ? `Completed${session.score != null ? ` • ${session.score}%` : ""}` : "Ready to start"}
                      </span>
                    </div>

                    <Link
                      href={`/student/labs/${lab.labId}`}
                      className="mt-4 inline-flex rounded-lg bg-[var(--ll-accent)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)] hover:opacity-90"
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
      <main className="ll-dashboard-shell px-4 py-5">
        <div className="mx-auto max-w-3xl">
          <div className="ll-notice ll-notice-error">
            {error?.message ?? "Unable to load labs."}
          </div>
        </div>
      </main>
    );
  }
}

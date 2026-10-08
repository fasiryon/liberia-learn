import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAiLabsEnabled } from "@/lib/serverFlags";
import { fromPracticalLab, listLabExperiences } from "@/lib/learner-experience/labExperience";
import { buildLabsTab, LABS_TAB_SECTIONS, type LabSessionSummary } from "@/lib/learner-experience/labsTab";
import { LabExperienceCard } from "@/components/learner-experience/LabExperienceCard";

export const dynamic = "force-dynamic";

const EMPTY: Record<(typeof LABS_TAB_SECTIONS)[number]["id"], string> = {
  "for-you": "Labs linked to the lessons you are learning will appear here.",
  assigned: "No labs have been assigned yet.",
  continue: "You have no unfinished labs.",
  library: "No labs available for your grade yet. Check back soon.",
  completed: "Labs you finish will appear here.",
};

/**
 * Product Redesign V1 Labs tab: one destination for every lab. Legacy
 * simulations, teacher practical labs and released interactive labs all render
 * through the LabExperience contract; unreleased labs never appear.
 */
export default async function StudentLabsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  try {
    const user = await requireRole("STUDENT");
    const aiLabsEnabled = isAiLabsEnabled();

    const [student, sessions] = await Promise.all([
      prisma.student.findUnique({ where: { userId: user.id }, select: { currentGrade: true } }),
      prisma.labSession.findMany({
        where: { studentId: user.id, ...(user.schoolId ? { schoolId: user.schoolId } : {}) },
        orderBy: [{ completedAt: "asc" }, { startedAt: "desc" }],
        select: { id: true, labId: true, startedAt: true, completedAt: true, scheduledWorkId: true },
      }),
    ]);

    const labIds = sessions.map((session) => session.labId);
    const practical = labIds.length
      ? await prisma.virtualLab.findMany({
          where: { labId: { in: labIds } },
          select: { labId: true, title: true, subject: true, estimatedMinutes: true, labType: true },
        }).catch(() => [])
      : [];

    const known = listLabExperiences();
    const knownIds = new Set(known.map((lab) => lab.labId));
    const labs = [...known, ...practical.filter((record) => !knownIds.has(record.labId)).map(fromPracticalLab)];
    const summaries: LabSessionSummary[] = sessions.map((session) => ({
      sessionId: session.id,
      labId: session.labId,
      assigned: session.scheduledWorkId != null,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
    }));
    // For You reads approved links on the learner's governed path. None are approved yet, so it stays empty.
    const tab = buildLabsTab({ labs, sessions: summaries, pathLinks: [], grade: student?.currentGrade ?? null });

    const requested = typeof searchParams?.tab === "string" ? searchParams.tab : null;
    const fallback = tab.forYou.length ? "for-you" : tab.continue.length ? "continue" : "library";
    const active = LABS_TAB_SECTIONS.find((section) => section.id === requested) ?? LABS_TAB_SECTIONS.find((section) => section.id === fallback)!;
    const entries = tab[active.key];

    return (
      <div className="ll-dashboard-shell">
        <main className="px-4 py-5">
          <div className="mx-auto max-w-6xl space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-[var(--ll-text)]">Labs</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--ll-text-muted)]">Explore, test ideas and see science happen.</p>
              </div>
              {!aiLabsEnabled ? (
                <span className="rounded-full border border-[var(--ll-border)] bg-[rgba(250,204,21,0.08)] px-3 py-1 text-xs font-medium text-[var(--ll-warning)]">AI lab helpers disabled</span>
              ) : null}
            </div>

            <nav aria-label="Lab sections" className="-mx-4 overflow-x-auto px-4">
              <ul className="flex min-w-max gap-2">
                {LABS_TAB_SECTIONS.map((section) => (
                  <li key={section.id}>
                    <Link
                      href={`/student/labs?tab=${section.id}`}
                      aria-current={section.id === active.id ? "page" : undefined}
                      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${section.id === active.id ? "border-[var(--ll-accent)] bg-[var(--ll-accent)] text-[var(--ll-bg)]" : "border-[var(--ll-border)] text-[var(--ll-text-muted)]"}`}
                    >
                      {section.label}
                      <span className="text-xs opacity-80">{tab[section.key].length}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <section aria-labelledby="labs-section-title">
              <h2 id="labs-section-title" className="sr-only">{active.label}</h2>
              {entries.length === 0 ? (
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-6 text-center">
                  <p className="text-sm text-[var(--ll-text-muted)]">{EMPTY[active.id]}</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {entries.map((entry) => (
                    <LabExperienceCard key={`${entry.lab.labId}:${entry.session?.sessionId ?? "library"}`} lab={entry.lab} session={entry.session} reason={entry.reason} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    );
  } catch (error: any) {
    return (
      <main className="ll-dashboard-shell px-4 py-5">
        <div className="mx-auto max-w-3xl">
          <div className="ll-notice ll-notice-error">{error?.message ?? "Unable to load labs."}</div>
        </div>
      </main>
    );
  }
}

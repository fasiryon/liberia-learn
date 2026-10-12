import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAiLabsEnabled } from "@/lib/serverFlags";
import { fromPracticalLab, listLabExperiences } from "@/lib/learner-experience/labExperience";
import { buildLabsTab, type LabSessionSummary } from "@/lib/learner-experience/labsTab";
import { LabsHubView } from "@/components/learner-experience/LabsHub";
import { loadAuthorizedPracticalSessions } from "@/lib/student/labEligibility";
import { loadShowcaseLabAccess, NO_SHOWCASE_ACCESS, showcaseLabExperiences } from "@/lib/student/showcaseLabAccess";

export const dynamic = "force-dynamic";

/**
 * Product Redesign V1 Labs tab: one destination for every lab. Legacy
 * simulations, teacher practical labs and released interactive labs all render
 * through the LabExperience contract; unreleased labs never appear unless the
 * server grants this learner showcase access to them.
 */
export default async function StudentLabsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  try {
    const user = await requireRole("STUDENT");
    const aiLabsEnabled = isAiLabsEnabled();

    const [student, authorized, showcaseAccess] = await Promise.all([
      prisma.student.findUnique({ where: { userId: user.id }, select: { currentGrade: true } }),
      loadAuthorizedPracticalSessions(user),
      // A failed grant check denies showcase access; it never takes the rest of the hub down.
      loadShowcaseLabAccess(user).catch(() => NO_SHOWCASE_ACCESS),
    ]);
    // Server-granted showcase labs: openable for this learner, still unreleased everywhere else.
    const showcase = showcaseLabExperiences(showcaseAccess);
    const sessions = authorized.map(({ session }) => session);
    const practical = [...new Map(authorized.map(({ lab }) => [lab.labId, lab])).values()];
    const known = listLabExperiences();
    const practicalIds = new Set(practical.map((lab) => lab.labId));
    const labs = [...known.filter((lab) => !practicalIds.has(lab.labId)), ...practical.map(fromPracticalLab)];
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

    return <LabsHubView tab={tab} requested={requested} showcase={showcase} aiLabsEnabled={aiLabsEnabled} />;
  } catch {
    return (
      <main className="ll-dashboard-shell px-4 py-5">
        <div className="mx-auto max-w-3xl">
          <div className="ll-notice ll-notice-error">Unable to load labs.</div>
        </div>
      </main>
    );
  }
}

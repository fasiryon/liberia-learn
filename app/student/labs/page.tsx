import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAiLabsEnabled } from "@/lib/serverFlags";
import { fromPracticalLab, listLabExperiences } from "@/lib/learner-experience/labExperience";
import { buildLabsTab, type LabSessionSummary } from "@/lib/learner-experience/labsTab";
import { LabsHubView } from "@/components/learner-experience/LabsHub";
import { loadAuthorizedPracticalSessions } from "@/lib/student/labEligibility";
import { loadAuthorizedShowcaseLabs } from "@/lib/student/showcaseLabs";

export const dynamic = "force-dynamic";

/**
 * Product Redesign V1 Labs tab: one destination for every lab. Legacy
 * simulations, teacher practical labs and released interactive labs all render
 * through the LabExperience contract; only explicit showcase authority adds
 * unreleased labs, in a separate section above the ordinary tabs.
 */
export default async function StudentLabsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  try {
    const user = await requireRole("STUDENT");
    const aiLabsEnabled = isAiLabsEnabled();

    // Showcase labs come from the server authority only; they render in their own section, never in Library.
    const [student, authorized, showcase] = await Promise.all([
      prisma.student.findUnique({ where: { userId: user.id }, select: { currentGrade: true } }),
      loadAuthorizedPracticalSessions(user),
      loadAuthorizedShowcaseLabs(user),
    ]);
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

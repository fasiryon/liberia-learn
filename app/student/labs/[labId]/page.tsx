import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { loadAuthorizedPracticalSessions } from "@/lib/student/labEligibility";
import { LabSessionClient } from "@/app/student/labs/LabSessionClient";
import { projectStudentLabPayload } from "@/lib/curriculum/studentLessonProjection";
import { InteractiveLabScreen } from "@/components/learner-experience/InteractiveLabScreen";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { fromInteractiveLab, isStudentAccessible } from "@/lib/learner-experience/labExperience";
import { isShowcaseLabAuthorized, loadShowcaseLabAccess, NO_SHOWCASE_ACCESS } from "@/lib/student/showcaseLabAccess";

export const dynamic = "force-dynamic";

export default async function StudentLabDetailPage({
  params,
  searchParams,
}: {
  params: { labId: string };
  searchParams?: { session?: string };
}) {
  try {
    const user = await requireRole("STUDENT");

    // Unified lab namespace: interactive V2 labs open here too (formerly /student/interactive-labs/[labId]).
    const interactive = getInteractiveLabDefinition(params.labId);
    if (interactive) {
      // Same rule as the Labs tab: approved definition and a real release binding.
      const released = interactive.reviewState === "APPROVED" && interactive.approvalState === "APPROVED" && isStudentAccessible(fromInteractiveLab(interactive));
      // Otherwise only a server showcase grant opens it; the lab stays unreleased and records no evidence.
      const showcase = !released && isShowcaseLabAuthorized(await loadShowcaseLabAccess(user).catch(() => NO_SHOWCASE_ACCESS), params.labId);
      return <InteractiveLabScreen labId={params.labId} access={released ? "RELEASED" : showcase ? "SHOWCASE" : "DENIED"} />;
    }

    const [authorized] = await loadAuthorizedPracticalSessions(user, { labId: params.labId, sessionId: searchParams?.session });
    const session = authorized?.session;

    if (!session) {
      return (
        <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
          <div className="mx-auto max-w-3xl rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 text-sm text-[var(--ll-text)]">
            No lab session was found for this assignment.
          </div>
        </main>
      );
    }

    const lab = authorized?.lab;

    if (!lab) {
      return (
        <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
          <div className="mx-auto max-w-3xl rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 text-sm text-[var(--ll-text)]">
            This lab definition is no longer available.
          </div>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
        <div className="mx-auto max-w-4xl space-y-6">
          <Link href="/student/labs" className="ll-interactive inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            Back to Labs
          </Link>
          <LabSessionClient
            lab={{
              labId: lab.labId,
              title: lab.title,
              estimatedMinutes: lab.estimatedMinutes,
              payload: projectStudentLabPayload(lab.payload),
            }}
            sessionId={session.id}
            initialCompleted={Boolean(session.completedAt)}
          />
        </div>
      </main>
    );
  } catch {
    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
          Unable to load the lab.
        </div>
      </main>
    );
  }
}

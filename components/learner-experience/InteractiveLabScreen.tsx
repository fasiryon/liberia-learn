import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { InteractiveLabPlayer } from "@/components/interactive-labs/v2/InteractiveLabPlayer";
import type { LabLaunchContext } from "@/lib/learner-experience/labLaunch";
import { LabExperienceHost } from "./LabExperienceHost";

/** How the server resolved this learner's access to an interactive lab. The screen never decides it.
 * SHOWCASE reuses the observation-only `internalPreview` host capability: no session, evidence or mastery writes. */
export type InteractiveLabAccess = "RELEASED" | "SHOWCASE" | "DENIED";

/** A lab opened from a lesson scene: where to return, rebuilt by the server page from validated ids. */
export type InteractiveLabLessonReturn = Readonly<{ context: LabLaunchContext; returnHref: string; labVersion: string; totalChecks: number }>;

/**
 * The /student/labs/[labId] screen for interactive labs, with a Back to Labs path in every state. A RELEASED
 * lab opened from a lesson returns to that lesson scene instead; a showcase grant never becomes lesson-linked.
 */
export function InteractiveLabScreen({ labId, access, lessonReturn }: { labId: string; access: InteractiveLabAccess; lessonReturn?: InteractiveLabLessonReturn | null }) {
  if (access === "RELEASED" && lessonReturn && lessonReturn.context.labId === labId) {
    return <LabExperienceHost context={lessonReturn.context} labVersion={lessonReturn.labVersion} totalChecks={lessonReturn.totalChecks} returnHref={lessonReturn.returnHref} internalPreview={false} />;
  }
  return (
    <main className="min-h-screen bg-slate-900 px-4 py-8 text-white">
      <Link href="/student/labs" className="mb-4 inline-flex min-h-[var(--pdv2-target,44px)] items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        Back to Labs
      </Link>
      {access === "DENIED" ? <p>This lab is not available.</p> : <InteractiveLabPlayer labId={labId} internalPreview={access === "SHOWCASE"} />}
    </main>
  );
}

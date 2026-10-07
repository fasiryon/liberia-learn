import { notFound } from "next/navigation";
import { LabExperienceHost } from "@/components/learner-experience/LabExperienceHost";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { buildLessonReturnHref, parseLabLaunchContext } from "@/lib/learner-experience/labLaunch";
import { isLearnerExperiencePrototypeEnabled, loadPrototypeExperience, PROTOTYPE_BASE_PATH } from "@/lib/learner-experience/prototypeRoute";

// Lab entered from a Lesson Player V2 scene. The launch context must match a governed link on this lesson;
// the return URL is rebuilt from validated identifiers, never read from the query string.
export const dynamic = "force-dynamic";

export default function LessonLabPrototypePage({ params, searchParams }: { params: { experienceId: string; labId: string }; searchParams: Record<string, string | string[] | undefined> }) {
  if (!isLearnerExperiencePrototypeEnabled(process.env)) notFound();
  const loaded = loadPrototypeExperience(params.experienceId);
  const context = parseLabLaunchContext(params.labId, searchParams);
  if (!loaded || !context || context.origin.experienceId !== loaded.experience.id || context.origin.experienceVersion !== loaded.experience.version) notFound();
  const link = loaded.links.find((candidate) => candidate.linkId === context.linkId);
  const definition = getInteractiveLabDefinition(params.labId);
  if (!link || !definition || link.experience.labId !== params.labId || link.placement.sceneId !== context.origin.sceneId) notFound();
  const scene = loaded.experience.scenes.find((candidate) => candidate.id === context.origin.sceneId)!;
  return (
    <LabExperienceHost
      context={context}
      lessonTitle={loaded.experience.title}
      sceneTitle={scene.title}
      labVersion={definition.version}
      totalChecks={definition.checks.length}
      returnHref={buildLessonReturnHref(PROTOTYPE_BASE_PATH, context)}
      internalPreview
    />
  );
}

import { notFound } from "next/navigation";
import { LessonPlayerV2 } from "@/components/learner-experience/LessonPlayerV2";
import { isLearnerExperiencePrototypeEnabled, loadPrototypeExperience, PROTOTYPE_BASE_PATH } from "@/lib/learner-experience/prototypeRoute";

// Product Redesign V1 / Phase A internal prototype (Lesson Player V2). Dev-only, like the lab review harness:
// it renders an unreleased lesson fixture and a DRAFT lab, so it 404s in production builds.
export const dynamic = "force-dynamic";

export default function LessonExperiencePrototypePage({ params, searchParams }: { params: { experienceId: string }; searchParams: Record<string, string | string[] | undefined> }) {
  if (!isLearnerExperiencePrototypeEnabled(process.env)) notFound();
  const loaded = loadPrototypeExperience(params.experienceId);
  if (!loaded) notFound();
  const scene = typeof searchParams.scene === "string" && searchParams.from === "lab" ? searchParams.scene : null;
  return <LessonPlayerV2 {...loaded} basePath={PROTOTYPE_BASE_PATH} exitHref="/student/learn" returnSceneId={scene} />;
}

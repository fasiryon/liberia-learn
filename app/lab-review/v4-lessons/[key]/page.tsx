import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonPlayerV2 } from "@/components/learner-experience/LessonPlayerV2";
import { isLearnerExperiencePrototypeEnabled } from "@/lib/learner-experience/prototypeRoute";
import { loadV4Preview, V4_REVIEW_BASE_PATH } from "@/lib/curriculum/v4/preview";

// Interactive Learning V4 review: an unreviewed V4 DRAFT candidate played by Lesson Player V2. Dev-only and
// gated like the Lesson Player V2 prototype; 404 in production builds. Nothing here is sent, scored or released.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "V4 lesson review · LiberiaLearn", robots: { index: false, follow: false } };

export default function V4LessonReviewPage({ params }: { params: { key: string } }) {
  if (!isLearnerExperiencePrototypeEnabled(process.env)) notFound();
  const loaded = loadV4Preview(params.key);
  if (!loaded) notFound();
  return <LessonPlayerV2 experience={loaded.experience} toolsByScene={loaded.toolsByScene} exitHref={V4_REVIEW_BASE_PATH} returnSceneId={null} linkPolicy="INTERNAL_PREVIEW" />;
}

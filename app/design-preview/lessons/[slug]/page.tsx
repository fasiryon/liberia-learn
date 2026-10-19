import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeachingLessonPlayer } from "@/components/experience/teaching/TeachingLessonPlayer";
import { DEMO_TEACHING_LESSONS } from "@/lib/learner-experience/teaching/demoLessons";
import { releasedTeachingAvailability } from "@/lib/learner-experience/teaching/availability";
import { isStudentDesignPreviewEnabled } from "@/lib/learner-experience/demo/designPreview";

// Dev-only DEMO teaching lessons (synthetic, labelled, unreleased). 404 in production builds unless
// STUDENT_DESIGN_PREVIEW=1. No API call, storage write, evidence, completion or mastery.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "DEMO lesson preview · LiberiaLearn", robots: { index: false, follow: false } };

export default function DemoTeachingLessonPage({ params, searchParams }: { params: { slug: string }; searchParams?: { scene?: string } }) {
  if (!isStudentDesignPreviewEnabled(process.env)) notFound();
  const lesson = DEMO_TEACHING_LESSONS[params.slug];
  if (!lesson) notFound();
  return <TeachingLessonPlayer lesson={lesson} availability={releasedTeachingAvailability(lesson)} initialSceneId={typeof searchParams?.scene === "string" ? searchParams.scene : null} backHref="/design-preview/lessons" backLabel="Back to Previews" moreHref="/design-preview/lessons" />;
}

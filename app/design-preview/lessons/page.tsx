import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewGallery } from "@/components/experience/teaching/PreviewGallery";
import { DEMO_TEACHING_LESSONS } from "@/lib/learner-experience/teaching/demoLessons";
import { releasedNativeLessons, releasedTeachingAvailability } from "@/lib/learner-experience/teaching/availability";
import { isStudentDesignPreviewEnabled } from "@/lib/learner-experience/demo/designPreview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "DEMO lesson previews · LiberiaLearn", robots: { index: false, follow: false } };

export default function DemoTeachingLessonsPage() {
  if (!isStudentDesignPreviewEnabled(process.env)) notFound();
  return <PreviewGallery releases={releasedNativeLessons()} chips={Object.fromEntries(Object.entries(DEMO_TEACHING_LESSONS).map(([slug, lesson]) => [slug, releasedTeachingAvailability(lesson).chip]))} />;
}

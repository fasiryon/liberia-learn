import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V4ReviewGallery } from "@/components/experience/review/V4Review";
import { isLearnerExperiencePrototypeEnabled } from "@/lib/learner-experience/prototypeRoute";
import { V4_REVIEW_BASE_PATH, v4ReviewCatalogue } from "@/lib/curriculum/v4/preview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "V4 lesson candidates · LiberiaLearn", robots: { index: false, follow: false } };

/** Dev-only index of the Interactive Learning V4 DRAFTs: factory-generated packages and hand-authored reference fixtures. */
export default function V4LessonIndexPage() {
  if (!isLearnerExperiencePrototypeEnabled(process.env)) notFound();
  const { entries, rejected } = v4ReviewCatalogue();
  return <V4ReviewGallery entries={entries} rejected={rejected} basePath={V4_REVIEW_BASE_PATH} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { factoryVersions, selectable, V4ReviewBar, V4SelectionRejected } from "@/components/experience/review/V4Review";
import { LessonPlayerV2 } from "@/components/learner-experience/LessonPlayerV2";
import { isLearnerExperiencePrototypeEnabled } from "@/lib/learner-experience/prototypeRoute";
import { loadV4Preview, V4_REVIEW_BASE_PATH, v4ReviewCatalogue } from "@/lib/curriculum/v4/preview";

// Interactive Learning V4 review: an unreviewed V4 DRAFT played by Lesson Player V2. Dev-only and gated like the
// Lesson Player V2 prototype; 404 in production builds. The loader verifies the selection and never substitutes
// another version; provenance renders in the reviewer bar, outside the player. Nothing here is sent, scored or released.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "V4 lesson review · LiberiaLearn", robots: { index: false, follow: false } };

/** Links keep `@` literal; a percent-encoded key is decoded once, and a malformed one is not a selection. */
function selectionFrom(raw: string): string | null {
  if (!raw.includes("%")) return raw;
  try { return decodeURIComponent(raw); } catch { return null; }
}

export default function V4LessonReviewPage({ params }: { params: { key: string } }) {
  if (!isLearnerExperiencePrototypeEnabled(process.env)) notFound();
  const selection = selectionFrom(params.key);
  if (!selection) notFound();
  const loaded = loadV4Preview(selection);
  if (loaded.ok === false) { // equality narrowing: the repo compiles with strict: false
    if (loaded.reason === "UNKNOWN_SELECTION") notFound();
    return <V4SelectionRejected selection={selection} reason={loaded.reason} basePath={V4_REVIEW_BASE_PATH} />;
  }
  const { entries } = v4ReviewCatalogue();
  const versions = factoryVersions(entries).get(loaded.entry.lessonKey) ?? [];
  const reference = loaded.entry.origin === "FACTORY_GENERATED" ? selectable(entries).find((entry) => entry.origin === "HAND_AUTHORED_FIXTURE" && entry.lessonKey === loaded.entry.lessonKey) ?? null : null;
  return <>
    <V4ReviewBar entry={loaded.entry} versions={versions} reference={reference} basePath={V4_REVIEW_BASE_PATH} />
    <LessonPlayerV2 experience={loaded.experience} toolsByScene={loaded.toolsByScene} exitHref={V4_REVIEW_BASE_PATH} returnSceneId={null} linkPolicy="INTERNAL_PREVIEW" />
  </>;
}

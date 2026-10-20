"use client";

import { TeachingLessonPlayer } from "@/components/experience/teaching/TeachingLessonPlayer";
import { GRADE7_PLACE_VALUE } from "@/lib/learner-experience/teaching/demoLessons";
import type { TeachingAvailability } from "@/lib/learner-experience/teaching/contract";

/**
 * DEMO — Grade 7 Number Sense: Place value (Student Experience V3 design preview).
 *
 * Synthetic preview content authored as a TeachingLesson (lib/learner-experience/teaching/demoLessons.ts),
 * labelled DEMO from the published-release registry check. It is NOT a released or governed Grade 7 lesson,
 * is not delivered through the lesson delivery seam, makes no network request, writes no storage, sends no
 * evidence, records no completion and never changes mastery.
 */
export function PlaceValueDemo({ availability, initialSceneId }: { availability: TeachingAvailability; initialSceneId?: string | null }) {
  return <TeachingLessonPlayer lesson={GRADE7_PLACE_VALUE} availability={availability} initialSceneId={initialSceneId} moreHref="/design-preview/lessons" />;
}

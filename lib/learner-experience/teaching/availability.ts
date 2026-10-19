// Server side only (the registry validates releases with node:crypto); client components receive the result as props.
import { publishedRelease, publishedReleases } from "@/lib/learning-authority/publishedReleases";
import { teachingLessonAvailability, type TeachingAvailability, type TeachingLesson } from "./contract";

/** Server side: a teaching lesson's status from the published-release registry (the only release authority). */
export function releasedTeachingAvailability(lesson: TeachingLesson): TeachingAvailability {
  return teachingLessonAvailability(lesson, publishedRelease);
}

/** Server side: the registered native releases, for the content-status inventory. */
export function releasedNativeLessons(): { id: string; grade: number; subject: string }[] {
  return publishedReleases().map((release) => ({ id: release.id, grade: release.grade, subject: release.subject }));
}

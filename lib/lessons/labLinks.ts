import type { LabId } from "@/lib/labs/types";

export type LessonLabLink = { labId: LabId; label: string };

/** Grade/subject cannot establish an approved objective binding or runtime certification. */
export function getLessonLabLinks(_input: { subject: string; grade: number }): LessonLabLink[] {
  // Future learner links must use governed LearningExperienceLink records.
  return [];
}

import {
  enqueuePendingCurriculumRegenerationJobs,
  processCurriculumRegenerationLessonJob,
  type CurriculumRegenerationGroupPayload,
  type CurriculumRegenerationJobPayload,
} from "@/lib/curriculum/regenerationQueue";

export async function handleCurriculumRegenerationLessonJob(payload: CurriculumRegenerationJobPayload) {
  return processCurriculumRegenerationLessonJob(payload);
}

export async function handleCurriculumRegenerationGroupJob(payload: CurriculumRegenerationGroupPayload) {
  return enqueuePendingCurriculumRegenerationJobs(payload);
}

export async function handleCurriculumRegenerationResumeJob(payload: CurriculumRegenerationGroupPayload) {
  return enqueuePendingCurriculumRegenerationJobs(payload);
}

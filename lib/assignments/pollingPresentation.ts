export type SubmissionListItem = {
  id: string;
  submittedAt: string | null;
  score: number | null;
  points: number;
  schoolId?: string | null;
};

export function sortSubmissionsNewestFirst<T extends SubmissionListItem>(submissions: T[]): T[] {
  return [...submissions].sort((left, right) => {
    const leftTime = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
    const rightTime = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

export function isNewSubmission(submittedAt: string | null, now = new Date()): boolean {
  if (!submittedAt) return false;
  return now.getTime() - new Date(submittedAt).getTime() < 10 * 60 * 1000;
}

export function completedScoreLabel(submission: Pick<SubmissionListItem, "score" | "points">): string | null {
  return submission.score === null ? null : `Score ${submission.score}/${submission.points}`;
}

export function filterSubmissionsForTenant<T extends SubmissionListItem>(
  submissions: T[],
  schoolId: string
): T[] {
  return submissions.filter((submission) => submission.schoolId === schoolId);
}

export const STUDENT_LESSON_HELP_SUGGESTIONS = [
  "Explain this lesson in simpler words",
  "Give me a real-life example of this",
  "What should I know before this lesson?",
] as const;

export function gradeToTutorBand(grade: number): string {
  if (!Number.isFinite(grade)) {
    return "lower_primary";
  }

  if (grade <= 3) {
    return "lower_primary";
  }

  if (grade <= 6) {
    return "upper_primary";
  }

  return "secondary";
}

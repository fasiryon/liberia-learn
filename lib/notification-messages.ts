// lib/notification-messages.ts — SMS templates (under 160 chars)

export function attendanceAbsent(studentName: string, date: string): string {
  return `LiberiaLearn: ${studentName} was marked absent on ${date}. Please contact the school if this is incorrect.`;
}

export function lessonCompleted(studentName: string, lessonTitle: string): string {
  return `LiberiaLearn: ${studentName} completed "${lessonTitle.slice(0, 40)}". Great progress!`;
}

export function teacherFlag(studentName: string, teacherNote: string): string {
  const note = teacherNote.slice(0, 80);
  return `LiberiaLearn: Teacher flagged ${studentName}: ${note}. Please check in.`;
}

export function weeklyReport(studentName: string, completed: number, total: number): string {
  return `LiberiaLearn: ${studentName} completed ${completed}/${total} lessons this week. Keep it up!`;
}

export function placementConfirmationStudent(schoolName: string, grade: number): string {
  return `Your grade placement has been confirmed by your teacher at ${schoolName}. You have been placed in Grade ${grade}. Log in to LiberiaLearn to see your full results.`;
}

export function placementConfirmationGuardian(studentName: string, grade: number): string {
  return `${studentName}'s grade placement has been confirmed. They have been placed in Grade ${grade}. Log in to view their full placement results and AI analysis.`;
}

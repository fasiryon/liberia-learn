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

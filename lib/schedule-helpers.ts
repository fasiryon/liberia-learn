// lib/schedule-helpers.ts — Shared schedule utilities

export function getWeekDates(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getUTCDay();
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7)); // Monday
  monday.setUTCHours(0, 0, 0, 0);

  const dates: Date[] = [];
  for (let i = 0; i < 5; i++) {
    const dd = new Date(monday);
    dd.setUTCDate(monday.getUTCDate() + i);
    dates.push(dd);
  }
  return dates;
}

export function formatScheduleDate(date: Date): string {
  return date.toLocaleDateString("en-LR", { weekday: "short", month: "short", day: "numeric" });
}

export function hasConflict(
  classId: string,
  date: string,
  existingSchedule: Array<{ classId: string; scheduledDate: string }>
): boolean {
  const dateStr = new Date(date).toISOString().slice(0, 10);
  return existingSchedule.some(
    (s) => s.classId === classId && new Date(s.scheduledDate).toISOString().slice(0, 10) === dateStr
  );
}

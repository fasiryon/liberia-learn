// lib/progress-helpers.ts â€” Shared progress computation helpers

type ProgressRecord = {
  completedAt: Date | string | null;
  scheduledWork?: { content?: { subject?: string } };
};

export function computeStreak(records: ProgressRecord[]): number {
  const completedDays = new Set<string>();
  for (const r of records) {
    if (r.completedAt) {
      const d = new Date(r.completedAt);
      completedDays.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`);
    }
  }

  if (completedDays.size === 0) return 0;

  let streak = 0;
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  for (let i = 0; i < 365; i++) {
    const key = `${day.getUTCFullYear()}-${day.getUTCMonth()}-${day.getUTCDate()}`;
    if (completedDays.has(key)) {
      streak++;
    } else if (i > 0) {
      break; // allow today to not have completions yet
    }
    day.setUTCDate(day.getUTCDate() - 1);
  }

  return streak;
}

export function computeStatus(lastActiveDate: Date | string | null): "active" | "at-risk" | "inactive" {
  if (!lastActiveDate) return "inactive";
  const last = new Date(lastActiveDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - last.getTime()) / 86400000);

  if (diffDays <= 1) return "active";
  if (diffDays <= 3) return "at-risk";
  return "inactive";
}

export function groupBySubject(records: ProgressRecord[]): Record<string, { completed: number; total: number }> {
  const map: Record<string, { completed: number; total: number }> = {};

  for (const r of records) {
    const subject = r.scheduledWork?.content?.subject || "Unknown";
    if (!map[subject]) map[subject] = { completed: 0, total: 0 };
    map[subject].total++;
    if (r.completedAt) map[subject].completed++;
  }

  return map;
}


/**
 * In-memory stand-in for prisma.studentProgress covering the calls made by
 * completeScheduledLesson: findUnique by (studentId, scheduledWorkId),
 * createMany with skipDuplicates, and conditional updateMany where a `null`
 * filter value means "column IS NULL" (the claim-once semantics).
 */
export function createFakeStudentProgress() {
  let seq = 0;
  const rows: any[] = [];

  const matches = (row: any, where: any) =>
    Object.entries(where ?? {}).every(([key, value]) => (value === null ? row[key] == null : row[key] === value));

  const pick = (row: any, select?: Record<string, boolean>) => {
    if (!select) return { ...row };
    return Object.fromEntries(Object.keys(select).map((key) => [key, row[key] ?? null]));
  };

  const delegate = {
    findUnique: async ({ where, select }: any) => {
      const key = where.studentId_scheduledWorkId;
      const row = rows.find((r) => r.studentId === key.studentId && r.scheduledWorkId === key.scheduledWorkId);
      return row ? pick(row, select) : null;
    },
    createMany: async ({ data, skipDuplicates }: any) => {
      let count = 0;
      for (const entry of data) {
        const exists = rows.some((r) => r.studentId === entry.studentId && r.scheduledWorkId === entry.scheduledWorkId);
        if (exists) {
          if (skipDuplicates) continue;
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        rows.push({ id: `progress-${++seq}`, completedAt: null, ...entry });
        count += 1;
      }
      return { count };
    },
    updateMany: async ({ where, data }: any) => {
      const hit = rows.filter((row) => matches(row, where));
      hit.forEach((row) => Object.assign(row, data));
      return { count: hit.length };
    },
  };

  /** Seed a row, e.g. a completion recorded before a crash or migration. */
  const seed = (row: Record<string, unknown>) => {
    const stored = { id: `progress-${++seq}`, completedAt: null, ...row };
    rows.push(stored);
    return stored;
  };

  return { delegate, rows, seed };
}

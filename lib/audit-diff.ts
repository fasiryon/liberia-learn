type DiffEntry = { from: unknown; to: unknown };

function normalizeValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function computeFieldDiff<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: string[]
): Record<string, DiffEntry> {
  const diff: Record<string, DiffEntry> = {};
  for (const field of fields) {
    const beforeValue = normalizeValue(before[field]);
    const afterValue = normalizeValue(after[field]);
    if (beforeValue !== afterValue) {
      diff[field] = { from: beforeValue, to: afterValue };
    }
  }
  return diff;
}

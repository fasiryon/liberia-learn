import { createHash } from "crypto";

export type CanonicalJson =
  | null
  | boolean
  | number
  | string
  | CanonicalJson[]
  | { [key: string]: CanonicalJson };

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Curriculum snapshots cannot contain non-finite numbers");
  }
  return Object.is(value, -0) ? 0 : value;
}

export function toCanonicalJson(value: unknown): CanonicalJson {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return normalizeNumber(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toCanonicalJson);
  if (typeof value === "object") {
    const result: Record<string, CanonicalJson> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry !== undefined) result[key] = toCanonicalJson(entry);
    }
    return result;
  }
  throw new Error(`Unsupported curriculum snapshot value: ${typeof value}`);
}

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(toCanonicalJson(value));
}

export function hashCurriculumSnapshot(
  snapshotSchemaVersion: number,
  contentSnapshot: unknown,
): string {
  return createHash("sha256")
    .update(canonicalizeJson({ snapshotSchemaVersion, contentSnapshot }), "utf8")
    .digest("hex");
}

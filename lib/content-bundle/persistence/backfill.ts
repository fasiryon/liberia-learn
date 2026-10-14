import type { Prisma } from "@prisma/client";
import type { ContentBundleAuthorityReader } from "../v1/resolver";
import { PIN_FIELDS, classifyScheduledWork, readScheduledWorkDelivery, type ScheduledWorkPins, type GovernedScheduledWorkRef } from "./scheduledWork";

export type BackfillRow = ScheduledWorkPins & { id: string; schoolId: string; classId: string; contentId: string; gradeLevel: number | null; subject: string };
/** Explicit operator-reviewed historical correspondence. Never infer history from current content. */
export type BackfillMatch = { scheduledWorkId: string; schoolId: string; contentId: string; ref: GovernedScheduledWorkRef };
export type BackfillAnalysis = {
  id: string; schoolId: string;
  status: "SAFE_TO_PIN" | "AMBIGUOUS" | "NO_GOVERNED_MATCH" | "ALREADY_PINNED" | "INVALID_PARTIAL_PIN";
  proposed?: GovernedScheduledWorkRef;
  /** Source identity observed during analysis; application refuses the proposal if it changed. */
  observed?: { contentId: string; classId: string };
};
export async function analyzeScheduledWorkBackfill(rows: readonly BackfillRow[], matches: readonly BackfillMatch[], reader: (schoolId: string) => ContentBundleAuthorityReader): Promise<BackfillAnalysis[]> {
  const results: BackfillAnalysis[] = [];
  for (const row of rows) {
    const base = { id: row.id, schoolId: row.schoolId };
    const classification = classifyScheduledWork(row);
    if (classification !== "LEGACY_UNPINNED") {
      results.push({ ...base, status: classification === "GOVERNED_PINNED" ? "ALREADY_PINNED" : "INVALID_PARTIAL_PIN" });
      continue;
    }
    const candidates = matches.filter(match => match.scheduledWorkId === row.id && match.schoolId === row.schoolId && match.contentId === row.contentId);
    const unique = new Map(candidates.map(match => [JSON.stringify(PIN_FIELDS.map(key => match.ref[key])), match]));
    if (unique.size > 1) { results.push({ ...base, status: "AMBIGUOUS" }); continue; }
    const candidate = [...unique.values()][0];
    if (!candidate) { results.push({ ...base, status: "NO_GOVERNED_MATCH" }); continue; }
    const resolved = await readScheduledWorkDelivery(candidate.ref, reader(row.schoolId), async () => null);
    if (resolved.status !== "RESOLVED" || resolved.learnerProjection.identity.gradeLevel !== row.gradeLevel ||
        resolved.learnerProjection.identity.subject.toLowerCase() !== row.subject.toLowerCase() ||
        !resolved.learnerProjection.lessons.some(lesson => lesson.identity.itemId === row.contentId) ||
        (candidate.ref.itemKind === "LESSON" && candidate.ref.itemId !== row.contentId)) {
      results.push({ ...base, status: "NO_GOVERNED_MATCH" }); continue;
    }
    const proposed = Object.fromEntries(PIN_FIELDS.map(key => [key, candidate.ref[key]])) as GovernedScheduledWorkRef;
    results.push({ ...base, status: "SAFE_TO_PIN", proposed, observed: { contentId: row.contentId, classId: row.classId } });
  }
  return results;
}

/** Optional future local application boundary. Caller must re-analyze inside its transaction.
 * Conditional writer MUST match id, school, the observed contentId/classId and six NULL fields
 * together; a row whose source changed after analysis matches nothing and is reported as refused.
 * Default makes no calls.
 */
export async function applySafeBackfill(analysis: readonly BackfillAnalysis[],
  writer: (request: { where: Prisma.ScheduledWorkWhereInput; data: GovernedScheduledWorkRef }) => Promise<number>, options: { write?: boolean; target?: "LOCAL_TEST" } = {}) {
  if (!options.write) return { mode: "DRY_RUN" as const, written: 0 };
  const localUrl = (value: string | undefined) => {
    try { return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(value ?? "").hostname); } catch { return false; }
  };
  if (options.target !== "LOCAL_TEST" || process.env.NODE_ENV === "production" ||
      !localUrl(process.env.DATABASE_URL) || (process.env.DIRECT_URL !== undefined && !localUrl(process.env.DIRECT_URL))) throw new Error("HOSTED_BACKFILL_NOT_AUTHORIZED");
  const filled = (value: unknown): value is string => typeof value === "string" && !!value.trim();
  let written = 0;
  const refused: string[] = [];
  for (const row of analysis) if (row.status === "SAFE_TO_PIN" && row.proposed && classifyScheduledWork(row.proposed) === "GOVERNED_PINNED") {
    if (!filled(row.id) || !filled(row.schoolId) || !filled(row.observed?.contentId) || !filled(row.observed?.classId)) throw new Error("BACKFILL_SCOPE_REQUIRED");
    const count = await writer({
      where: { id: row.id, contentId: row.observed!.contentId, classId: row.observed!.classId, class: { schoolId: row.schoolId }, ...Object.fromEntries(PIN_FIELDS.map(key => [key, null])) },
      data: Object.fromEntries(PIN_FIELDS.map(key => [key, row.proposed![key]])) as GovernedScheduledWorkRef,
    });
    if (count === 1) written++; else refused.push(row.id);
  }
  return { mode: "LOCAL_TEST_WRITE" as const, written, refused };
}

import type { PrismaClient } from "@prisma/client";
import type { GovernedContentRef } from "../v1/types";
import { GOVERNED_ITEM_KINDS } from "../v1/types";
import { resolveContentBundle, type ContentBundleAuthorityReader } from "../v1/resolver";
import { createContentBundleRepository, withPersistentComposition } from "./repository";

export const PIN_FIELDS = ["bundleId", "bundleVersion", "bundleContentHash", "itemId", "itemVersion", "itemKind"] as const;
export type ScheduledWorkPins = { [K in typeof PIN_FIELDS[number]]?: string | null };
export type GovernedScheduledWorkRef = GovernedContentRef & { bundleContentHash: string };
export function classifyScheduledWork(row: ScheduledWorkPins): "GOVERNED_PINNED" | "LEGACY_UNPINNED" | "INVALID_PARTIAL_PIN" {
  if (PIN_FIELDS.every(key => row[key] == null)) return "LEGACY_UNPINNED";
  // Exact means non-empty, untrimmed-equal and never a moving alias; anything else is invalid, not legacy.
  if (!PIN_FIELDS.every(key => typeof row[key] === "string" && !!row[key]!.trim() && row[key]!.trim() === row[key] && !/^(latest|current|\*)$/i.test(row[key]!))) return "INVALID_PARTIAL_PIN";
  if (!/^[a-f0-9]{64}$/.test(row.bundleContentHash!) || !GOVERNED_ITEM_KINDS.includes(row.itemKind as GovernedContentRef["itemKind"])) return "INVALID_PARTIAL_PIN";
  return "GOVERNED_PINNED";
}

/** The only compatibility decision: invalid governed data never invokes legacy delivery. */
export async function readScheduledWorkDelivery<T>(row: ScheduledWorkPins, reader: ContentBundleAuthorityReader, legacy: () => Promise<T>) {
  const classification = classifyScheduledWork(row);
  if (classification === "LEGACY_UNPINNED") return { classification, status: "LEGACY" as const, legacy: await legacy() };
  const unavailable = (code: string) => ({ classification, status: "INCOMPATIBLE" as const, diagnostics: [{ code, path: "scheduledWork" }] });
  if (classification === "INVALID_PARTIAL_PIN") return unavailable("INVALID_PARTIAL_PIN");
  const resolved = await resolveContentBundle({ bundleId: row.bundleId!, bundleVersion: row.bundleVersion!, expectedContentHash: row.bundleContentHash! }, reader);
  if (resolved.status !== "RESOLVED") return { classification, ...resolved };
  const bundle = resolved.bundle;
  const member = [...bundle.lessons, ...bundle.activities, ...bundle.assessments, ...bundle.labs].find(item =>
    item.identity.itemId === row.itemId && item.identity.itemVersion === row.itemVersion && item.identity.itemKind === row.itemKind);
  if (!member) return unavailable("EXACT_ITEM_PIN_MISMATCH");
  // Only learner projection crosses delivery boundary; server composition stays private.
  return { classification, status: "RESOLVED" as const, governedContentRef: {
    bundleId: row.bundleId!, bundleVersion: row.bundleVersion!, itemId: row.itemId!, itemVersion: row.itemVersion!, itemKind: row.itemKind!,
  }, learnerProjection: resolved.learnerProjection, diagnostics: resolved.diagnostics };
}

export type GovernedScheduleInput = {
  schoolId: string; actorId: string; classId: string; contentId: string; scheduledDate: Date;
  governedContentRef: GovernedScheduledWorkRef;
};

/** Server dependency supplies existing exact authority; no caller-controlled approval flags. */
export async function createGovernedScheduledWork(db: PrismaClient, input: GovernedScheduleInput,
  createReader: (schoolId: string) => ContentBundleAuthorityReader) {
  if (classifyScheduledWork(input.governedContentRef) !== "GOVERNED_PINNED" || !Number.isFinite(input.scheduledDate.getTime())) throw new Error("INVALID_GOVERNED_SCHEDULE");
  return db.$transaction(async tx => {
    const [classroom, actor, content] = await Promise.all([
      tx.class.findUnique({ where: { id: input.classId } }),
      tx.user.findUnique({ where: { id: input.actorId }, select: { schoolId: true, role: true } }),
      tx.curriculumContent.findUnique({ where: { contentId: input.contentId }, select: { schoolId: true, grade: true, subject: true } }),
    ]);
    if (!classroom || !actor || actor.schoolId !== input.schoolId || classroom.schoolId !== input.schoolId ||
        !["TEACHER", "ADMIN"].includes(actor.role) || (actor.role === "TEACHER" && classroom.teacherId !== input.actorId) ||
        !content || (content.schoolId !== null && content.schoolId !== input.schoolId)) throw new Error("SCHEDULE_SCOPE_FORBIDDEN");
    const reader = withPersistentComposition(createReader(input.schoolId), createContentBundleRepository(tx, input.schoolId));
    const composition = await createContentBundleRepository(tx, input.schoolId).getContentBundle(input.governedContentRef.bundleId, input.governedContentRef.bundleVersion);
    if (!composition) throw new Error("STORED_BUNDLE_MISSING");
    if (!composition.manifest.lessons.some(lesson => lesson.identity.itemId === input.contentId) ||
        (input.governedContentRef.itemKind === "LESSON" && input.governedContentRef.itemId !== input.contentId)) throw new Error("LEGACY_LINK_NOT_IN_BUNDLE");
    const result = await readScheduledWorkDelivery(input.governedContentRef, reader, async () => { throw new Error("GOVERNED_LEGACY_FALLBACK_FORBIDDEN"); });
    if (result.status !== "RESOLVED") throw new Error("GOVERNED_DELIVERY_UNAVAILABLE");
    const bundle = result.learnerProjection;
    if (bundle.identity.gradeLevel !== classroom.gradeLevel || bundle.identity.subject.toLowerCase() !== classroom.subject.toLowerCase() ||
        content.grade !== classroom.gradeLevel || content.subject.toLowerCase() !== classroom.subject.toLowerCase()) throw new Error("SCHEDULE_CONTENT_SCOPE_MISMATCH");
    const work = await tx.scheduledWork.create({ data: {
      classId: input.classId, contentId: input.contentId, createdById: input.actorId, scheduledDate: input.scheduledDate,
      ...Object.fromEntries(PIN_FIELDS.map(key => [key, input.governedContentRef[key]])),
    } });
    await tx.auditLog.create({ data: {
      userId: input.actorId, schoolId: input.schoolId, action: "scheduled_work.governed_created",
      resourceType: "ScheduledWork", resourceId: work.id,
      details: { classId: input.classId, ...Object.fromEntries(PIN_FIELDS.map(key => [key, input.governedContentRef[key]])) },
    } });
    return work;
  }, { isolationLevel: "Serializable" });
}

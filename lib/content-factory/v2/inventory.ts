import { z } from "zod";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { digest, sealBlueprint, type UnitBlueprint } from "./blueprint";

const id = z.string().trim().min(1);
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const exportSchema = z.strictObject({
  schemaVersion: z.literal("factory-legacy-inventory/1.0.0"),
  environment: z.enum(["PRODUCTION_READ_ONLY_EXPORT", "REPOSITORY_FIXTURE"]), capturedAt: z.string().datetime(), queryRef: id,
  lessons: z.array(z.strictObject({
    databaseId: id, contentId: id, grade: z.number().int().min(1).max(12), subject: id,
    contentType: id, version: id, status: id, revisionId: id.nullable(), revisionNumber: z.number().int().nonnegative().nullable(),
    snapshotSchemaVersion: z.number().int().positive().nullable(), contentSnapshot: z.unknown(), contentHash: sha.nullable(),
    captureGaps: z.array(id).optional(),
    relationshipCounts: z.strictObject({ assignments: z.number().int().nonnegative(), submissions: z.number().int().nonnegative(), learningEvents: z.number().int().nonnegative(), scheduledWork: z.number().int().nonnegative() }),
  })),
});
export type LegacyInventory = z.infer<typeof exportSchema>;

/** Consumes an operator-supplied export. This function has no database capability. */
export function inventoryLegacy(input: unknown) {
  const inventory = exportSchema.parse(input);
  if (new Set(inventory.lessons.map(l => l.databaseId)).size !== inventory.lessons.length || new Set(inventory.lessons.map(l => l.contentId)).size !== inventory.lessons.length) throw new Error("duplicate_legacy_identity");
  const rows = inventory.lessons.map(lesson => {
    const gaps: string[] = [...(lesson.captureGaps ?? [])];
    if (!lesson.revisionId || lesson.revisionNumber === null || !lesson.snapshotSchemaVersion || !lesson.contentHash || !lesson.contentSnapshot) gaps.push("EXACT_LEGACY_REVISION_MISSING");
    else if (hashCurriculumSnapshot(lesson.snapshotSchemaVersion, lesson.contentSnapshot) !== lesson.contentHash) gaps.push("LEGACY_SNAPSHOT_HASH_MISMATCH");
    return { ...lesson, gaps, candidateEligible: gaps.length === 0 && lesson.grade === 7 && lesson.subject === "MATH" && lesson.contentType.toUpperCase() === "LESSON" };
  });
  return { inventory, inventoryHash: digest("factory-legacy-inventory/1.0.0", inventory), rows,
    selected: rows.filter(r => r.candidateEligible).sort((a, b) => a.databaseId.localeCompare(b.databaseId))[0] ?? null,
    liveVerification: "NOT_PERFORMED_BY_FACTORY" as const,
    writes: [] as never[],
  };
}

export function bindLegacyPilot(blueprint: UnitBlueprint, report: ReturnType<typeof inventoryLegacy>, replacementVersion: string): UnitBlueprint {
  const selected = report.selected;
  if (!selected || !selected.revisionId || selected.revisionNumber === null || !selected.contentHash) throw new Error("legacy_pilot_requires_exact_revision");
  if (blueprint.grade !== selected.grade || blueprint.subject !== selected.subject) throw new Error("legacy_pilot_scope_mismatch");
  if (replacementVersion === blueprint.version) throw new Error("replacement_requires_new_blueprint_version");
  return sealBlueprint({ ...blueprint, version: replacementVersion, legacy: [{ databaseId: selected.databaseId, contentId: selected.contentId, revisionId: selected.revisionId,
    revisionNumber: selected.revisionNumber, snapshotSha256: selected.contentHash,
    inventoryPin: { id: "legacy-pilot-inventory", version: "1.0.0", sha256: report.inventoryHash, sourceRef: report.inventory.queryRef } }],
    unresolved: [...blueprint.unresolved.filter(g => g !== "PRODUCTION_INVENTORY_NOT_VERIFIED"), "OPERATOR_EXPORT_REQUIRES_ENVIRONMENT_ATTESTATION", "HISTORICAL_RELATIONSHIP_COMPARISON_REQUIRED"],
  });
}

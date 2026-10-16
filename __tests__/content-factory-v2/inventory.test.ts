import { describe, expect, it } from "vitest";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { bindLegacyPilot, inventoryLegacy } from "@/lib/content-factory/v2/inventory";
import { demoBlueprint } from "@/lib/content-factory/v2/demo";

function fixture() {
  const contentSnapshot = { identity: { grade: 7, subject: "MATH", title: "Fixture only" }, delivery: { body: "Historical fixture" } };
  return { schemaVersion: "factory-legacy-inventory/1.0.0", environment: "REPOSITORY_FIXTURE", capturedAt: "2026-10-16T12:00:00.000Z", queryRef: "fixture:read-only-export", lessons: [{
    databaseId: "fixture-database-id", contentId: "fixture-content-id", grade: 7, subject: "MATH", contentType: "LESSON", version: "legacy-v1", status: "PUBLISHED", revisionId: "fixture-revision-id", revisionNumber: 3, snapshotSchemaVersion: 1, contentSnapshot,
    contentHash: hashCurriculumSnapshot(1, contentSnapshot), relationshipCounts: { assignments: 4, submissions: 23, learningEvents: 81, scheduledWork: 2 },
  }] };
}
describe("Read-only legacy inventory and pilot lineage", () => {
  it("preserves IDs, exact revision, content and relationships without mutation", () => {
    const input = fixture(); const before = JSON.stringify(input);
    const report = inventoryLegacy(input);
    const replacement = bindLegacyPilot(demoBlueprint(), report, "0.2.0");
    expect(JSON.stringify(input)).toBe(before);
    expect(replacement.legacy[0]).toMatchObject({ databaseId: "fixture-database-id", contentId: "fixture-content-id", revisionId: "fixture-revision-id", revisionNumber: 3, snapshotSha256: input.lessons[0].contentHash });
    expect(report.inventory.lessons[0].relationshipCounts).toEqual(input.lessons[0].relationshipCounts);
    expect(report.writes).toEqual([]);
    expect(report.liveVerification).toBe("NOT_PERFORMED_BY_FACTORY");
    expect(replacement.unresolved).toContain("OPERATOR_EXPORT_REQUIRES_ENVIRONMENT_ATTESTATION");
  });
  it("keeps missing provenance visible and refuses candidate binding", () => {
    const input = fixture(); input.lessons[0].revisionId = null;
    const report = inventoryLegacy(input);
    expect(report.rows[0].gaps).toContain("EXACT_LEGACY_REVISION_MISSING");
    expect(() => bindLegacyPilot(demoBlueprint(), report, "0.2.0")).toThrow("legacy_pilot_requires_exact_revision");
  });
  it("rejects altered historical snapshots and duplicate logical IDs", () => {
    const input = fixture(); input.lessons[0].contentSnapshot.delivery.body = "Tampered";
    expect(inventoryLegacy(input).selected).toBe(null);
    expect(inventoryLegacy(input).rows[0].gaps).toContain("LEGACY_SNAPSHOT_HASH_MISMATCH");
    expect(() => inventoryLegacy({ ...input, lessons: [input.lessons[0], input.lessons[0]] })).toThrow("duplicate_legacy_identity");
  });
});

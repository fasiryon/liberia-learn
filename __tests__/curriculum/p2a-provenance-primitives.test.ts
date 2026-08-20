import { describe, expect, it } from "vitest";
import {
  buildCurriculumContentSnapshotV1,
  CURRICULUM_SNAPSHOT_SCHEMA_VERSION,
  SNAPSHOT_V1_EXCLUDED_FIELDS,
  validateCurriculumContentSnapshotV1,
} from "@/lib/curriculum/provenance/snapshot";
import {
  canonicalizeJson,
  hashCurriculumSnapshot,
} from "@/lib/curriculum/provenance/hash";
import {
  assertAutomatedApprovalAllowed,
  evaluateProvenanceCompleteness,
} from "@/lib/curriculum/provenance/validation";

const baseRow = {
  title: "Scalar title",
  grade: 7,
  subject: "SCIENCE",
  contentType: "lesson",
  payload: {
    title: "Learner title",
    body: "A complete learner-visible lesson body.",
    objectives: ["Explain the water cycle"],
    activities: [{ name: "Observe evaporation" }],
    approvalStatus: "APPROVED",
    riskScore: 9,
    metadata: {
      model: "do-not-snapshot",
      promptHash: "do-not-snapshot",
    },
  },
  moeAlignments: [{ code: "SCI.7.1" }],
  waecSyllabusTopics: ["B", "A", "A"],
  learningObjectives: ["Scalar objective"],
  schoolId: "excluded",
};

describe("P2-A provenance primitives", () => {
  it("builds an explicit Snapshot V1 and excludes governance and generation metadata", () => {
    const snapshot = buildCurriculumContentSnapshotV1(baseRow);
    validateCurriculumContentSnapshotV1(snapshot);
    expect(snapshot.identity.title).toBe("Learner title");
    expect(snapshot.instruction.objectives).toEqual(["Explain the water cycle"]);
    expect(snapshot.standards.waecSyllabusTopics).toEqual(["A", "B"]);
    const serialized = JSON.stringify(snapshot);
    for (const excluded of SNAPSHOT_V1_EXCLUDED_FIELDS) {
      expect(serialized).not.toContain(`"${excluded}"`);
    }
  });

  it("canonicalizes objects independent of insertion order and hashes deterministically", () => {
    expect(canonicalizeJson({ z: 1, a: { d: 2, b: 1 } })).toBe(
      canonicalizeJson({ a: { b: 1, d: 2 }, z: 1 }),
    );
    const snapshot = buildCurriculumContentSnapshotV1(baseRow);
    const first = hashCurriculumSnapshot(CURRICULUM_SNAPSHOT_SCHEMA_VERSION, snapshot);
    const second = hashCurriculumSnapshot(CURRICULUM_SNAPSHOT_SCHEMA_VERSION, snapshot);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });

  it("distinguishes not-applicable deterministic fields from missing AI lineage", () => {
    expect(
      evaluateProvenanceCompleteness({
        revisionKind: "ORIGINAL_GENERATION",
        originKind: "DETERMINISTIC_GENERATED",
        generatorName: "national-factory",
        generatorVersion: "1.0.0",
        generatedAt: new Date(),
      }),
    ).toBe("VERIFIED");
    expect(
      evaluateProvenanceCompleteness({
        revisionKind: "ORIGINAL_GENERATION",
        originKind: "AI_GENERATED",
        generatorName: "lesson-v2",
        generatorVersion: "2.0.0",
        generatedAt: new Date(),
      }),
    ).toBe("PARTIAL");
  });

  it("never upgrades requested completeness above proven lineage", () => {
    expect(
      evaluateProvenanceCompleteness({
        revisionKind: "BACKFILL_SNAPSHOT",
        originKind: "LEGACY_UNKNOWN",
        idempotencyKey: "legacy:1",
        backfillRunId: "run-1",
        requestedCompleteness: "VERIFIED",
      }),
    ).toBe("UNVERIFIED");
    expect(() => assertAutomatedApprovalAllowed("PARTIAL")).toThrow(
      "Automated approval requires VERIFIED provenance",
    );
  });

  it("rejects snapshots without learner-visible instructional content", () => {
    const snapshot = buildCurriculumContentSnapshotV1({
      ...baseRow,
      payload: { title: "Empty" },
    });
    expect(() => validateCurriculumContentSnapshotV1(snapshot)).toThrow(
      "no learner-visible instructional content",
    );
  });
});

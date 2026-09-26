import { describe, expect, it } from "vitest";
import { buildCleanupPlan, validateCleanupPlan, type CurriculumSnapshot, type SnapshotContent, type SnapshotReference } from "@/lib/curriculum/cleanup/cleanupPlan";

const lesson = (id: string, overrides: Partial<SnapshotContent> = {}): SnapshotContent => ({
  id, contentId: `c-${id}`, title: `Lesson ${id}`, grade: 4, subject: "Mathematics", canonicalSubject: "MATH",
  status: "APPROVED", unitId: null, payloadApprovalStatus: "APPROVED", sectionCount: 3, currentRevisionId: `rev-${id}`,
  lastGovernance: "NONE", updatedAt: "2026-09-01T00:00:00.000Z", ...overrides,
});
const ref = (overrides: Partial<SnapshotReference> & Pick<SnapshotReference, "table" | "value">): SnapshotReference => ({
  column: "contentId", key: "contentId", rows: 1, learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false, ...overrides,
});

function snapshot(partial: Partial<CurriculumSnapshot>): CurriculumSnapshot {
  return { capturedAt: "2026-09-26T00:00:00.000Z", database: { db: "test", addr: null }, contents: [], references: [], prerequisites: [], variants: [], units: [], ...partial };
}

describe("curriculum cleanup plan", () => {
  it("keeps the human-reviewed duplicate and supersedes the other", () => {
    const snap = snapshot({ contents: [
      lesson("a", { title: "Fractions!", sectionCount: 9 }),
      lesson("b", { title: "fractions", lastGovernance: "HUMAN_REVIEW", sectionCount: 1 }),
    ] });
    const plan = buildCleanupPlan(snap);
    expect(plan.duplicateGroups).toHaveLength(1);
    expect(plan.duplicateGroups[0]!.survivor.contentPk).toBe("b");
    expect(plan.actions.filter((a) => a.kind === "SUPERSEDE_DUPLICATE").map((a) => a.contentPk)).toEqual(["a"]);
    expect(validateCleanupPlan(plan, snap).ok).toBe(true);
  });

  it("prefers the duplicate carrying learner activity when neither is human reviewed", () => {
    const snap = snapshot({
      contents: [lesson("a", { title: "Place value" }), lesson("b", { title: "Place Value", sectionCount: 10 })],
      references: [ref({ table: "LearningEvent", value: "c-a", rows: 5 })],
    });
    expect(buildCleanupPlan(snap).duplicateGroups[0]!.survivor.contentPk).toBe("a");
  });

  it("repoints forward bindings but retains history and unique bindings the survivor already owns", () => {
    const snap = snapshot({
      contents: [lesson("a", { title: "Data", lastGovernance: "HUMAN_REVIEW" }), lesson("b", { title: "Data" })],
      references: [
        ref({ table: "LearningEvent", value: "c-b", rows: 4 }),
        ref({ table: "TeacherLessonAssignment", value: "c-b", policy: "REPOINT" }),
        ref({ table: "CurriculumLessonPlan", column: "curriculumContentId", value: "c-b", policy: "REPOINT", uniquePerLesson: true, learnerData: false }),
        ref({ table: "CurriculumLessonPlan", column: "curriculumContentId", value: "c-a", policy: "REPOINT", uniquePerLesson: true, learnerData: false }),
      ],
    });
    const plan = buildCleanupPlan(snap);
    const repoints = plan.actions.filter((a) => a.kind === "REPOINT_REFERENCE");
    expect(repoints).toEqual([expect.objectContaining({ table: "TeacherLessonAssignment", from: "c-b", to: "c-a" })]);
    expect(plan.retainedReferences.map((r) => `${r.table}:${r.reason}`).sort()).toEqual([
      "CurriculumLessonPlan:unique_binding_survivor_already_bound", "LearningEvent:history_preserved"]);
    const validation = validateCleanupPlan(plan, snap);
    expect(validation.ok).toBe(true);
    expect(validation.after.referencesToRetiredLessons).toBe(0);
  });

  it("returns approved lessons with pending payload approval to review unless human reviewed", () => {
    const snap = snapshot({ contents: [
      lesson("a", { payloadApprovalStatus: "NEEDS_REVIEW" }),
      lesson("b", { title: "Other", payloadApprovalStatus: "PENDING", lastGovernance: "HUMAN_REVIEW" }),
    ] });
    const plan = buildCleanupPlan(snap);
    expect(plan.actions.filter((a) => a.kind === "RETURN_FOR_REVIEW").map((a) => a.contentPk)).toEqual(["a"]);
    expect(plan.learnerImpact.lessonsLeavingLearnerView).toBe(1);
  });

  it("deletes dangling edges, repoints edges off retired duplicates and drops the resulting duplicates", () => {
    const snap = snapshot({
      contents: [lesson("a", { title: "T", lastGovernance: "HUMAN_REVIEW" }), lesson("b", { title: "T" }), lesson("c", { title: "U" })],
      prerequisites: [
        { id: "e1", lessonId: "c", prerequisiteLessonId: "a" },
        { id: "e2", lessonId: "c", prerequisiteLessonId: "b" },
        { id: "e3", lessonId: "c", prerequisiteLessonId: "gone" },
        { id: "e4", lessonId: "a", prerequisiteLessonId: "b" },
      ],
    });
    const plan = buildCleanupPlan(snap);
    expect(plan.counts.DELETE_DANGLING_PREREQUISITE).toBe(1);
    expect(plan.actions.filter((a) => a.kind === "DELETE_DUPLICATE_PREREQUISITE").map((a) => `${a.edge.id}:${a.reason}`).sort())
      .toEqual(["e2:duplicate_after_repoint", "e4:self_loop"]);
    expect(validateCleanupPlan(plan, snap).after.danglingPrerequisites).toBe(0);
  });

  it("deletes orphan variants with their full before-image", () => {
    const snap = snapshot({ contents: [lesson("a")], variants: [
      { id: "v1", lessonId: "a", row: { body: "keep" } }, { id: "v2", lessonId: "gone", row: { body: "restore me" } }] });
    const plan = buildCleanupPlan(snap);
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: "DELETE_ORPHAN_VARIANT", variant: { id: "v2", lessonId: "gone", row: { body: "restore me" } } }));
  });

  it("repairs a unit link only when sequence and title agree, otherwise retains the key", () => {
    const units = [
      { id: "u1", unitId: "yearmap-g4-math-u03", grade: 4, subject: "MATH", title: "Fractions", sequence: 3 },
      { id: "u2", unitId: "yearmap-g4-math-u01", grade: 4, subject: "MATH", title: "Data", sequence: 1 },
    ];
    const snap = snapshot({ units, contents: [
      lesson("a", { unitId: "math-g4-3-fractions-and-decimals" }),
      lesson("b", { title: "B", unitId: "math-g4-1-number-sense" }),
    ] });
    const plan = buildCleanupPlan(snap);
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: "REPAIR_UNIT_LINK", contentPk: "a", toUnitId: "yearmap-g4-math-u03" }));
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: "RETAIN_UNIT_KEY", contentPk: "b", fromUnitId: "math-g4-1-number-sense" }));
    const validation = validateCleanupPlan(plan, snap);
    expect(validation.ok).toBe(true);
    expect(validation.after.unaccountedUnitLinks).toBe(0);
  });

  it("rollback simulation restores the snapshot and tampered plans fail validation", () => {
    const snap = snapshot({ contents: [lesson("a", { title: "T", lastGovernance: "HUMAN_REVIEW" }), lesson("b", { title: "T" })] });
    const plan = buildCleanupPlan(snap);
    expect(validateCleanupPlan(plan, snap).rollbackRestoresSnapshot).toBe(true);
    const tampered = { ...plan, actions: plan.actions.filter((a) => a.kind !== "SUPERSEDE_DUPLICATE") };
    expect(validateCleanupPlan(tampered, snap).errors).toContain("residual_duplicates:2");
  });

  it("is deterministic", () => {
    const snap = snapshot({ contents: [lesson("b", { title: "T" }), lesson("a", { title: "T" })], prerequisites: [{ id: "e", lessonId: "x", prerequisiteLessonId: "a" }] });
    expect(JSON.stringify(buildCleanupPlan(snap))).toBe(JSON.stringify(buildCleanupPlan({ ...snap, contents: [...snap.contents].reverse() })));
  });
});

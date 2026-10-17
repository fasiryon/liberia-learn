// First-ten modernization contract: every lesson is a real catalog lesson bound to its exact audited
// revision (no invented ids), and every lesson spec satisfies the shared contract rules before any
// rewriting starts. Runs from committed files only.
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { MODERNIZATION_DIR } from "@/lib/curriculum/modernization/build";
import { FIRST_TEN_SPEC_DOC, renderFirstTenSpec, type FirstTenSpec } from "@/lib/curriculum/modernization/firstTen";

type Lesson = {
  contentId: string; contentPk: string; legacy: { revisionId: string; contentHash: string };
  grade: number; subject: string; unitId: string | null; track: string; dependencies: Record<string, number>;
  audit: { auditDigest: string };
};
type InventoryFile = { extract: { extractSha256: string }; lessons: (Lesson & {
  revision: { id: string; contentHash: string }; classification: { track: string }; modernization: { candidate: unknown };
  audit: { auditDigest: string };
})[] };
type Assessment = { id: string; objectiveIds: string[]; kind: string; scoring: string };
type LessonSpec = Lesson & {
  key: string;
  defects: { id: string; severity: string; verification: string; correction: string }[];
  objectives: { id: string; layer: string }[];
  prerequisites: { diagnostic: string; fallbackRoute: string }[];
  visualAndInteractive: { offlineFallback: string }[];
  independentAssessment: { endOfLesson: Assessment[]; selectedResponseMaxShare: number; answersVisibleToLearner: boolean };
  misconceptions: { id: string; probe: string; feedback: string }[];
  retention: { delayDays: number; items: string[] };
  transfer: { context: string; task: string };
  extension: { optional: boolean };
  teacherReview: string[];
  moeWaec: { moe: string; waec: string };
};
type SpecFile = {
  contractVersion: string; status: string; basis: { inventory: { extractSha256: string } };
  selection: { excludedAlreadyInReview: string[] }; lessons: LessonSpec[]; alternates: Lesson[];
};

const FIRST_TEN = `${MODERNIZATION_DIR}/first-ten/spec.json`;
const spec = JSON.parse(readFileSync(FIRST_TEN, "utf8")) as SpecFile;
const inventory = JSON.parse(readFileSync(`${MODERNIZATION_DIR}/inventory.json`, "utf8")) as InventoryFile;
const byId = new Map(inventory.lessons.map((lesson) => [lesson.contentId, lesson]));
const VERIFICATION = new Set(["MECHANICAL_AUDIT_CONFIRMED", "AUTHOR_COMPUTED", "AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM"]);
const WRITING_SUBJECTS = new Set(["LITERACY", "ENGLISH"]);

describe("first-ten contract identity", () => {
  it("is a proposal, pinned to the committed inventory extract", () => {
    expect(spec.status).toBe("PROPOSED_NOT_AGREED");
    expect(spec.contractVersion).toMatch(/^liberialearn-first-ten-modernization-contract\/\d+\.\d+\.\d+$/);
    expect(spec.basis.inventory.extractSha256).toBe(inventory.extract.extractSha256);
  });
  it("lists exactly ten distinct lessons with unique keys", () => {
    expect(spec.lessons).toHaveLength(10);
    expect(new Set(spec.lessons.map((lesson) => lesson.contentId)).size).toBe(10);
    expect(new Set(spec.lessons.map((lesson) => lesson.key)).size).toBe(10);
  });
  it("binds every lesson and alternate to its exact inventory record (no invented ids)", () => {
    for (const lesson of [...spec.lessons, ...spec.alternates]) {
      const live = byId.get(lesson.contentId);
      expect(live, lesson.contentId).toBeDefined();
      expect(lesson.contentPk).toBe(live!.contentPk);
      expect(lesson.legacy.revisionId).toBe(live!.revision.id);
      expect(lesson.legacy.contentHash).toBe(live!.revision.contentHash);
      expect([lesson.grade, lesson.subject, lesson.unitId]).toEqual([live!.grade, live!.subject, live!.unitId]);
      expect(lesson.track).toBe(live!.classification.track);
      expect(lesson.audit.auditDigest).toBe(live!.audit.auditDigest);
      for (const [key, count] of Object.entries(lesson.dependencies)) expect(count, `${lesson.contentId}.${key}`).toBe(live!.dependencies[key]);
    }
  });
  it("selects only schedulable lessons that have no candidate yet", () => {
    const excluded = new Set(spec.selection.excludedAlreadyInReview);
    expect(excluded.size).toBe(inventory.lessons.filter((lesson) => lesson.modernization.candidate).length);
    for (const lesson of spec.lessons) {
      expect(excluded.has(lesson.contentId), lesson.contentId).toBe(false);
      expect(byId.get(lesson.contentId)!.modernization.candidate).toBeNull();
      expect(lesson.track).not.toBe("D_GOVERNANCE_HOLD");
    }
  });
  it("keeps the human-readable specification rendered from the JSON source", () => {
    expect(readFileSync(FIRST_TEN_SPEC_DOC, "utf8")).toBe(renderFirstTenSpec(spec as unknown as FirstTenSpec));
    for (const lesson of spec.lessons) expect(readFileSync(FIRST_TEN_SPEC_DOC, "utf8")).toContain(lesson.legacy.revisionId);
  });
  it("covers mathematics, literacy, science and civics, and lessons with learners", () => {
    const subjects = new Set(spec.lessons.map((lesson) => lesson.subject));
    for (const subject of ["MATH", "SCIENCE", "CIVICS"]) expect(subjects.has(subject), subject).toBe(true);
    expect([...subjects].some((subject) => WRITING_SUBJECTS.has(subject))).toBe(true);
    for (const lesson of spec.lessons) {
      const d = lesson.dependencies;
      expect(d.scheduledWork + d.studentProgress + d.learningEvents, lesson.contentId).toBeGreaterThan(0);
    }
  });
});

describe("first-ten contract rules per lesson", () => {
  for (const lesson of spec.lessons) {
    describe(lesson.key, () => {
      const objectiveIds = new Set(lesson.objectives.map((objective) => objective.id));
      const assessed = lesson.independentAssessment.endOfLesson;
      it("records each defect with a correction and a verification status", () => {
        expect(lesson.defects.length).toBeGreaterThan(0);
        for (const defect of lesson.defects) {
          expect(VERIFICATION.has(defect.verification), defect.id).toBe(true);
          expect(defect.correction.length).toBeGreaterThan(20);
        }
      });
      it("has a National Foundation objective and assesses every objective at the end of the lesson", () => {
        expect(lesson.objectives.some((objective) => objective.layer === "NATIONAL_FOUNDATION")).toBe(true);
        const covered = new Set(assessed.flatMap((task) => task.objectiveIds));
        for (const id of objectiveIds) expect(covered.has(id), id).toBe(true);
        for (const id of covered) expect(objectiveIds.has(id), id).toBe(true);
      });
      it("keeps selected response within the blueprint share and keys away from learners", () => {
        const limit = WRITING_SUBJECTS.has(lesson.subject) ? 0.5 : 0.6;
        expect(lesson.independentAssessment.selectedResponseMaxShare).toBeLessThanOrEqual(limit);
        const selected = assessed.filter((task) => task.kind.startsWith("SELECTED_RESPONSE")).length;
        expect(selected / assessed.length).toBeLessThanOrEqual(limit);
        expect(assessed.some((task) => task.scoring === "ANALYTIC_RUBRIC")).toBe(true);
        expect(lesson.independentAssessment.answersVisibleToLearner).toBe(false);
      });
      it("diagnoses prerequisites, probes misconceptions and keeps offline fallbacks", () => {
        for (const prerequisite of lesson.prerequisites) expect(prerequisite.diagnostic && prerequisite.fallbackRoute).toBeTruthy();
        expect(lesson.misconceptions.length).toBeGreaterThanOrEqual(3);
        for (const misconception of lesson.misconceptions) expect(misconception.probe && misconception.feedback, misconception.id).toBeTruthy();
        for (const visual of lesson.visualAndInteractive) expect(visual.offlineFallback).toBeTruthy();
      });
      it("plans delayed retention, new-context transfer, an optional extension and teacher review", () => {
        expect(lesson.retention.delayDays).toBeGreaterThanOrEqual(7);
        expect(lesson.retention.items.length).toBeGreaterThan(0);
        expect(lesson.transfer.context).toBe("NEW");
        expect(lesson.extension.optional).toBe(true);
        expect(lesson.teacherReview.length).toBeGreaterThan(0);
        expect(lesson.moeWaec.moe && lesson.moeWaec.waec).toBeTruthy();
      });
    });
  }
});

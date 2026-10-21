// First-ten modernization contract: every lesson is a real catalog lesson bound to its exact audited
// revision (no invented ids), and every lesson spec satisfies the shared contract rules before any
// rewriting starts. Runs from committed files only.
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { MODERNIZATION_DIR } from "@/lib/curriculum/modernization/build";
import { buildFirstTenManifest, FIRST_TEN_MANIFEST_FILE, FIRST_TEN_SPEC_DOC, renderFirstTenSpec, type FirstTenSpec } from "@/lib/curriculum/modernization/firstTen";

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
const VERIFICATION = new Set(["MECHANICAL_AUDIT_CONFIRMED", "AUTHOR_COMPUTED", "AUTHOR_SOURCED_REVIEWER_MUST_CONFIRM", "AUTHOR_IDENTIFIED_REVIEWER_MUST_CONFIRM", "ADVISORY_REVIEW_FINDING_AUTHOR_VERIFIED", "AUTHOR_VERIFIED_CORRECTING_MECHANICAL_AUDIT"]);
const WRITING_SUBJECTS = new Set(["LITERACY", "ENGLISH"]);

describe("first-ten contract identity", () => {
  it("is a proposal, pinned to the committed inventory extract", () => {
    expect(["PROPOSED_NOT_AGREED", "READY_FOR_OWNER_APPROVAL"]).toContain(spec.status);
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

// V1.0.0: the cohort accepted at 9628d97f is frozen; finalization adds evidence, policy and integration fields only.
const FROZEN_BASELINE: readonly (readonly [string, string, string])[] = [
  ["ft01-g7-civics-counties-capitals", "wk_mca7a_fri_p4", "cmss8ptit002jvo540275dfvw"],
  ["ft02-g7-civics-founding-of-liberia", "wk_mca7a_wed_p4", "cmss8poxb001fvo544mp6ebop"],
  ["ft03-g7-civics-democracy-representation", "hero-civics-g7-democracy-and-representation-in-liberia", "cmss94h3z03bzvo54hj7c7z8t"],
  ["ft04-g7-science-states-of-matter", "wk_mca7a_fri_p3", "cmss8pt0j002fvo54be8gcrnd"],
  ["ft05-g5-science-photosynthesis", "science-g5-plants", "cmss8mp3p0007vo1wqsa620v2"],
  ["ft06-g7-math-area-perimeter", "hero-math-g7-geometry-area-and-perimeter-of-polygons", "cmss9493703a7vo54xxnhxmjy"],
  ["ft07-g7-math-fractions", "lesson_mca_1", "cmss8mpl0000bvo1wos7i1ew4"],
  ["ft08-g2-math-place-value", "hero-math-g2-place-value-tens-and-ones", "cmss946is039nvo54is10v1t4"],
  ["ft09-g7-literacy-main-idea", "wk_mca7a_mon_p2", "cmss8pj580003vo54iiun3f8s"],
  ["ft10-g7-english-vocabulary-in-context", "hero-english-g7-vocabulary-in-context-reading-west-african-texts", "cmss94i4b03c7vo54sblilk60"],
];

type V1Spec = {
  status: string;
  sharedLessonContract: { version?: string; stages: string[] };
  sources?: { registry: { id: string; url: string }[] };
  sourceBindings?: { path: string; sha256: string };
  subjectPolicy?: Record<string, string>;
  lessons: (LessonSpec & {
    defects: { id: string; verification: string; evidence?: { sourceId: string }[] }[];
    misconceptions: { id: string; misconceptionId?: string }[];
    independentAssessment: { endOfLesson: (Assessment & { assessmentPurpose?: string; itemContext?: string })[] };
    transfer: { itemContext?: string; assessmentPurpose?: string };
    retention: { policyRef?: string; assessmentPurpose?: string; itemContext?: string };
    stageBindings?: Record<string, { sceneIds: string[] | null; assessmentDefinitionId: string | null; required: boolean; fallback: string | null }>;
    moeWaec: { subjectAuthority?: string; moeCrossReference?: { relation: string } };
    advisoryReview?: { countsAsIndependentReview: boolean; files: Record<string, { path: string; sha256: string }> };
  })[];
};
const v1 = spec as unknown as V1Spec;
type CitedDefect = { id: string; evidence?: { sourceId: string }[] };

describe("first-ten contract v1.0.0 finalization", () => {
  it("keeps the accepted ten source ids and revisions unchanged, in order", () => {
    expect(v1.lessons.map((lesson) => [lesson.key, lesson.contentId, lesson.legacy.revisionId])).toEqual(FROZEN_BASELINE);
  });
  it.runIf(v1.status === "READY_FOR_OWNER_APPROVAL")("carries cited sources for the owner-named corrections", () => {
    const registry = new Map((v1.sources?.registry ?? []).map((source) => [source.id, source]));
    const cited = (key: string, defectId: string) => ((v1.lessons.find((lesson) => lesson.key === key)!.defects as CitedDefect[]).find((defect) => defect.id === defectId)!.evidence) ?? [];
    for (const [key, defectId] of [["ft01-g7-civics-counties-capitals", "D1"], ["ft01-g7-civics-counties-capitals", "D2"], ["ft02-g7-civics-founding-of-liberia", "D1"]] as const) {
      const evidence = cited(key, defectId);
      expect(evidence.length, `${key}.${defectId}`).toBeGreaterThan(0);
      for (const item of evidence) expect(registry.get(item.sourceId)?.url, item.sourceId).toMatch(/^https:\/\//);
    }
    for (const lesson of v1.lessons) for (const defect of lesson.defects as CitedDefect[]) for (const item of defect.evidence ?? []) expect(registry.has(item.sourceId), item.sourceId).toBe(true);
  });
  it.runIf(v1.status === "READY_FOR_OWNER_APPROVAL")("keeps Civics a distinct subject with MOE Social Studies as cross-reference only", () => {
    expect(v1.subjectPolicy?.CIVICS).toMatch(/cross-reference/i);
    for (const lesson of v1.lessons.filter((l) => l.subject === "CIVICS")) {
      expect(lesson.moeWaec.subjectAuthority).toBe("LIBERIALEARN_CIVICS");
      expect(lesson.moeWaec.moeCrossReference?.relation).toBe("CROSS_REFERENCE_ONLY");
    }
  });
  it.runIf(v1.status === "READY_FOR_OWNER_APPROVAL")("exposes the learning-loop integration fields", () => {
    expect(v1.sharedLessonContract.version).toMatch(/^liberialearn-first-ten-lesson-contract\/\d+\.\d+\.\d+$/);
    for (const lesson of v1.lessons) {
      expect(Object.keys(lesson.stageBindings ?? {})).toEqual(v1.sharedLessonContract.stages.filter((stage) => stage !== "teacherView"));
      for (const [stage, binding] of Object.entries(lesson.stageBindings ?? {})) {
        expect([binding.sceneIds, binding.assessmentDefinitionId], stage).toEqual([null, null]);
        expect(binding.required, stage).toBe(stage !== "extension");
      }
      expect(lesson.stageBindings?.prerequisiteDiagnostic.fallback).toBeTruthy();
      for (const task of lesson.independentAssessment.endOfLesson) {
        expect(["FORMATIVE", "SUMMATIVE"]).toContain(task.assessmentPurpose);
        expect(["REHEARSED", "NEAR", "NEW"]).toContain(task.itemContext);
      }
      expect([lesson.transfer.assessmentPurpose, lesson.transfer.itemContext]).toEqual(["TRANSFER", "NEW"]);
      expect([lesson.retention.policyRef, lesson.retention.assessmentPurpose]).toEqual(["ll-aep-001-retention-pilot@1.0.0", "RETENTION"]);
      for (const misconception of lesson.misconceptions) expect(misconception.misconceptionId).toMatch(/^mc-[a-z]+(-[a-z0-9]+)+$/);
    }
  });
  it.runIf(v1.status === "READY_FOR_OWNER_APPROVAL")("uses unique catalog misconception ids across the cohort", () => {
    const ids = v1.lessons.flatMap((lesson) => (lesson.misconceptions as { misconceptionId?: string }[]).map((m) => m.misconceptionId));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it.runIf(v1.status === "READY_FOR_OWNER_APPROVAL")("pins source bindings and advisory reviews by hash", () => {
    const bindingsBytes = readFileSync(v1.sourceBindings!.path);
    expect(createHash("sha256").update(bindingsBytes).digest("hex")).toBe(v1.sourceBindings!.sha256);
    const bindings = JSON.parse(bindingsBytes.toString("utf8")) as { bindings: { key: string; source: { databaseId: string; contentId: string; revisionId: string; snapshotSha256: string } }[] };
    for (const lesson of v1.lessons) {
      const source = bindings.bindings.find((binding) => binding.key === lesson.key)!.source;
      expect([source.databaseId, source.contentId, source.revisionId, source.snapshotSha256]).toEqual([lesson.contentPk, lesson.contentId, lesson.legacy.revisionId, lesson.legacy.contentHash]);
      expect(lesson.advisoryReview?.countsAsIndependentReview).toBe(false);
      for (const file of Object.values(lesson.advisoryReview?.files ?? {})) expect(createHash("sha256").update(readFileSync(file.path)).digest("hex"), file.path).toBe(file.sha256);
    }
  });
});

describe("first-ten contract manifest", () => {
  it("matches the bytes of every contract file and advisory review", () => {
    const manifest = JSON.parse(readFileSync(FIRST_TEN_MANIFEST_FILE, "utf8"));
    const rebuilt = buildFirstTenManifest((path) => readFileSync(path), spec as never, (bytes) => createHash("sha256").update(bytes).digest("hex"));
    expect(manifest).toEqual(rebuilt);
  });
});

// Grade 7 v0.3.0: the Curriculum Excellence V1 corrections applied to the PR #191 candidates.
// The agent that wrote the corrections may not review them; only automated checks run, and the
// definitions it added stay reviewer-only governed candidates that nothing scores.
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { G7_NATIVE_LESSONS, evaluateG7Candidate, g7LearnerProjection } from "@/lib/curriculum/v2/g7Native";
import { G7_EXIT_ITEMS, G7_WRITING_RUBRIC, loadG7AssessmentDefinitions } from "@/lib/curriculum/v2/g7NativeReview";
import { G7_EXCELLENCE_DIR, G7_EXCELLENCE_V030_DIR, loadG7LessonInputs, readSourcePin } from "@/lib/curriculum/excellence/g7GapReportSources";
import { buildG7GapReport, renderG7GapReportMarkdown, renderG7IndexMarkdown, type G7GapReport } from "@/lib/curriculum/excellence/g7GapReport";
import { buildInstructionalReview } from "@/lib/curriculum/excellence/instructionalReviewer";
import { explainDistractor } from "@/lib/curriculum/excellence/misconceptionErrorModels";

const pin = readSourcePin(process.cwd(), G7_EXCELLENCE_V030_DIR);
const committed = (lessonKey: string) => JSON.parse(readFileSync(`${G7_EXCELLENCE_V030_DIR}/${lessonKey}/gap-report.json`, "utf8")) as G7GapReport;
const prior = (lessonKey: string) => JSON.parse(readFileSync(`${G7_EXCELLENCE_DIR}/${lessonKey}/gap-report.json`, "utf8")) as G7GapReport;
const inputs = loadG7LessonInputs(process.cwd(), G7_EXCELLENCE_V030_DIR);

describe("v0.3.0 candidates are the exact revisions the checks ran on", () => {
  it.each(G7_NATIVE_LESSONS.map((lesson) => [lesson.key, lesson] as const))("%s", (key, lesson) => {
    const outcome = evaluateG7Candidate(lesson);
    const source = pin.lessons.find((item) => item.lessonKey === key)!;
    expect(outcome.errors).toEqual([]);
    expect(outcome.status).toBe("REVIEW_BLOCKED");
    expect(source.expectedCandidateSha256).toBe(outcome.candidateSha256);
    expect(committed(key).review.revision.candidateSha256).toBe(outcome.candidateSha256);
    expect(new Set(source.packageGaps)).toEqual(new Set(outcome.gaps.filter((gap) => gap.severity === "BLOCKING" && gap.code !== "UNSUPPORTED_INTERACTION_DECLARED" && gap.code !== "SCENE_USES_FALLBACK").map((gap) => gap.code)));
  });

  it("regenerates byte-identical reports from this tree", () => {
    const rebuilt = inputs.map((lessonInputs) => buildG7GapReport(pin, lessonInputs, prior(lessonInputs.source.lessonKey)));
    for (const report of rebuilt) {
      expect(`${JSON.stringify(report, null, 2)}\n`).toBe(readFileSync(`${G7_EXCELLENCE_V030_DIR}/${report.lessonKey}/gap-report.json`, "utf8").replace(/\r\n/g, "\n"));
      expect(renderG7GapReportMarkdown(report)).toBe(readFileSync(`${G7_EXCELLENCE_V030_DIR}/${report.lessonKey}/gap-report.md`, "utf8").replace(/\r\n/g, "\n"));
    }
    expect(renderG7IndexMarkdown(pin, rebuilt)).toBe(readFileSync(`${G7_EXCELLENCE_V030_DIR}/README.md`, "utf8").replace(/\r\n/g, "\n"));
  });
});

describe("the repairing agent cannot review or certify its own repairs", () => {
  it("records the AI judgment review as refused and runs automated checks only", () => {
    for (const lesson of G7_NATIVE_LESSONS) {
      const report = committed(lesson.key);
      expect(report.review.reviewer.kind).toBe("AUTOMATED");
      expect(report.review.findings.every((item) => item.method === "DETERMINISTIC")).toBe(true);
      expect(report.review.independence).toMatchObject({ countsAsIndependentReview: false, reasons: ["AUTOMATED_CHECKS_ONLY"] });
      expect(report.aiJudgmentReview).toMatchObject({ status: "BLOCKED", code: "SELF_REVIEW_PROHIBITED", requires: "INDEPENDENT_REVIEWER" });
      expect(report.review).toMatchObject({ authority: "ADVISORY_ONLY", mayApprove: false, mayPublish: false, candidateOnly: true });
      expect(report.layers.asIs.every((layer) => !layer.attained)).toBe(true);
    }
  });

  it("refuses a direct AI review by the repairing agent, and refuses judgments in automated mode", () => {
    const [first] = inputs;
    const revision = {
      contentKey: first.source.contentKey, subject: first.source.subject, grade: first.source.grade,
      candidate: first.candidate, assessment: first.assessment,
      source: { gitCommit: null, candidatePath: first.source.candidatePath, assessmentPath: first.source.assessmentPath },
      authors: pin.candidateAuthors,
    };
    expect(() => buildInstructionalReview({ reviewer: pin.aiJudgmentReviewer!, revision })).toThrowError(/SELF_REVIEW_PROHIBITED/);
    const judgment = { id: "j", code: "X", criterionId: "LM-RSN-1", severity: "MINOR" as const, statement: "s", recommendation: "r", confidence: 0.5, evidence: [{ document: "CANDIDATE" as const, pointer: "/title", quote: first.candidate.title }] };
    expect(() => buildInstructionalReview({ reviewer: pin.reviewer, revision, judgments: [judgment] })).toThrowError(/AUTOMATED_CHECKS_TAKE_NO_JUDGMENTS/);
  });

  it("carries every v0.2.0 finding forward without declaring any resolved", () => {
    for (const lesson of G7_NATIVE_LESSONS) {
      const report = committed(lesson.key);
      const before = prior(lesson.key).review.findings;
      expect(report.priorFindings!.map((item) => item.findingId)).toEqual(before.map((item) => item.id));
      for (const item of report.priorFindings!) {
        expect(["NOT_REPRODUCED_BY_AUTOMATED_CHECKS", "STILL_PRESENT", "CORRECTION_APPLIED_PENDING_INDEPENDENT_REVIEW", "OPEN_CURRICULUM_OWNER_DECISION", "OPEN_NOT_ADDRESSED"]).toContain(item.status);
        if (item.method === "AI_JUDGMENT") expect(item.status).not.toBe("NOT_REPRODUCED_BY_AUTOMATED_CHECKS");
      }
      // Every blocking or major deterministic v0.2.0 finding no longer fires.
      const serious = before.filter((item) => item.method === "DETERMINISTIC" && item.severity !== "MINOR").map((item) => item.id);
      expect(report.priorFindings!.filter((item) => serious.includes(item.findingId)).every((item) => item.status === "NOT_REPRODUCED_BY_AUTOMATED_CHECKS")).toBe(true);
    }
    // The curriculum-owner decision stays open.
    expect(committed("math-number-sense-place-value").priorFindings!.find((item) => item.findingId === "ai-m4-mastery-depends-on-unapproved-scope")!.status).toBe("OPEN_CURRICULUM_OWNER_DECISION");
  });
});

describe("corrections in the candidate sources", () => {
  it("every mapped distractor with a verification is produced by the error its misconception names", () => {
    const signatures = pin.lessons.find((lesson) => lesson.lessonKey === "math-number-sense-place-value")!.misconceptionSignatures;
    for (const entry of G7_EXIT_ITEMS["math-number-sense-place-value"]) {
      for (const [index, misconception] of Object.entries(entry.distractorMisconceptions)) {
        const model = signatures[misconception];
        if (!model || !entry.verification) continue;
        expect(explainDistractor(entry.verification, entry.item.options[Number(index)]), `${entry.item.id}#${index}`).toContain(model);
      }
    }
  });

  it("blueprints are satisfied with selected response below the caps", () => {
    const [math, literacy] = G7_NATIVE_LESSONS.map((lesson) => committed(lesson.key).review.blueprint);
    expect(math.blockingGaps).toEqual([]);
    expect(literacy.blockingGaps).toEqual([]);
    expect(math.selectedResponseShareOfMastery!).toBeLessThanOrEqual(0.6);
    expect(literacy.selectedResponseShareOfMastery!).toBeLessThanOrEqual(0.5);
  });

  it("literacy mastery requires original unscaffolded writing scored with the candidate rubric", () => {
    const definitions = loadG7AssessmentDefinitions("literacy-essay-structure-argument");
    const writing = definitions.tasks.filter((task) => task.kind === "ORIGINAL_WRITING" && task.timing === "END_OF_LESSON" && task.scaffold === "NONE");
    expect(writing.length).toBeGreaterThan(0);
    expect(G7_WRITING_RUBRIC.criteria.map((criterion) => criterion.id)).toEqual(["thesis", "point", "evidence", "explain-link", "counterargument"]);
    expect(G7_WRITING_RUBRIC.status).toBe("GOVERNED_CANDIDATE");
  });
});

describe("assessment definitions stay governed candidates", () => {
  it.each(G7_NATIVE_LESSONS.map((lesson) => [lesson.key, lesson] as const))("%s: reviewer only, never in the learner projection", (key, lesson) => {
    const definitions = loadG7AssessmentDefinitions(key);
    expect(definitions).toMatchObject({ audience: "REVIEWER_ONLY", status: "GOVERNED_CANDIDATE" });
    const projection = JSON.stringify(g7LearnerProjection(lesson));
    // In-lesson diagnostics (deliveredBy) are formative items whose feedback teaches the answer by design;
    // everything else is teacher-administered and must never reach the learner.
    for (const task of definitions.tasks) {
      if (task.fallbackRoute) expect(projection, task.id).not.toContain(task.fallbackRoute.slice(0, 50));
      if (task.deliveredBy) continue;
      expect(projection, task.id).not.toContain(task.prompt.slice(0, 50));
      if (task.key) expect(projection, task.id).not.toContain(task.key);
    }
    expect(projection).not.toMatch(/scoringGuide|assessmentDefinitions|diagnosticOnly/);
  });

  it("only reviewer-side code reads the definitions; no scorer, mastery writer or release uses them", () => {
    const roots = ["app", "components", "lib", "scripts"];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) { if (name !== "node_modules") walk(file); }
        else if (/\.(ts|tsx|js|mjs|cjs)$/.test(name)) files.push(file.replace(/\\/g, "/"));
      }
    };
    roots.forEach(walk);
    // Match code, not comments: a type that documents the file shape (for example the pure
    // Assessment V2 candidate adapter) is not a reader.
    const code = (file: string) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const readers = files.filter((file) => /assessment-definitions|loadG7AssessmentDefinitions|G7_ASSESSMENT_DEFINITION_DIR/.test(code(file)));
    // Modernization packages have their own protected assessment-definitions.json;
    // their offline review packaging does not read the G7 definition namespace.
    expect(readers.sort()).toEqual([
      "lib/curriculum/modernization/pilot.ts", "lib/curriculum/modernization/pipeline.ts",
      "lib/curriculum/v2/g7NativePackage.ts", "lib/curriculum/v2/g7NativeReview.ts",
    ]);
    const g7Readers = files.filter((file) => /loadG7AssessmentDefinitions|G7_ASSESSMENT_DEFINITION_DIR|curriculum\/v2\/g7\/assessment-definitions/.test(code(file)));
    expect(g7Readers.sort()).toEqual(["lib/curriculum/v2/g7NativePackage.ts", "lib/curriculum/v2/g7NativeReview.ts"]);
  });
});

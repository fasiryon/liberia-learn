// Grade 7 v0.2.0 excellence gap reports: reproducible from the pinned PR #191 commit, bound to the
// exact candidate hashes, candidate-only, and never a review of the reviewer's own proposals.
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { G7_EXCELLENCE_DIR, loadG7LessonInputs, pinnedCommitAvailable, readSourcePin } from "@/lib/curriculum/excellence/g7GapReportSources";
import { buildG7GapReport, renderG7GapReportMarkdown, renderG7IndexMarkdown, type G7GapReport } from "@/lib/curriculum/excellence/g7GapReport";

const pin = readSourcePin();
const committed = (lessonKey: string) => JSON.parse(readFileSync(`${G7_EXCELLENCE_DIR}/${lessonKey}/gap-report.json`, "utf8")) as G7GapReport;
const reports = pin.lessons.map((lesson) => committed(lesson.lessonKey));

describe("committed Grade 7 gap reports", () => {
  it("are pinned to the exact v0.2.0 candidate revisions on PR #191", () => {
    expect(pin.pullRequest).toBe(191);
    expect(pin.gitCommit).toBe("1ad2e9ec3cbbcd15d3e0cccacfb5614951d52462");
    for (const [index, report] of reports.entries()) {
      expect(report.review.revision.candidateSha256).toBe(pin.lessons[index].expectedCandidateSha256);
      expect(report.review.revision.source.gitCommit).toBe(pin.gitCommit);
    }
  });

  it("stay candidate only, advisory and honest about independence", () => {
    for (const report of reports) {
      expect(report).toMatchObject({ candidateOnly: true, published: false });
      expect(report.review).toMatchObject({ authority: "ADVISORY_ONLY", mayApprove: false, mayPublish: false, outcome: "REVISE_BEFORE_HUMAN_REVIEW" });
      expect(report.review.independence).toMatchObject({ selfAuthored: false, independent: false, countsAsIndependentReview: false });
      expect(report.layers.asIs.every((layer) => !layer.attained && layer.isLearningEvidence === false)).toBe(true);
      expect(report.review.projectedBlueprintWithPlan).toMatchObject({ planAuthoredByReviewer: true, planReviewStatus: "UNREVIEWED_REQUIRES_INDEPENDENT_REVIEW" });
      expect(report.review.findings.filter((item) => item.method === "AI_JUDGMENT").every((item) => item.requiresHumanConfirmation)).toBe(true);
    }
  });

  it("record the blocking gaps the mission asked about", () => {
    const [math, literacy] = reports;
    for (const report of reports) {
      expect(report.review.blueprint.blockingGaps).toEqual(expect.arrayContaining(["BP-PREREQUISITE-DIAGNOSTIC", "BP-PRODUCTION", "BP-REASONING", "BP-SELECTED-SHARE", "BP-RETENTION", "BP-TRANSFER"]));
      expect(report.review.blueprint.selectedResponseShareOfMastery).toBe(1);
      expect(report.review.projectedBlueprintWithPlan?.evaluation.blockingGaps).toEqual([]);
    }
    // Misconception-mapping errors found mechanically, and every proposed correction checks out.
    expect(math.review.findings.filter((item) => item.code === "MISCONCEPTION_MAPPING_INCONSISTENT").map((item) => item.id).sort()).toEqual([
      "det-mismap-g7-pv-exit-1-0", "det-mismap-g7-pv-exit-1-1", "det-mismap-g7-pv-exit-1-3", "det-mismap-g7-pv-exit-2-1", "det-mismap-g7-pv-exit-2-2",
      "det-mismap-g7-pv-exit-4-1", "det-mismap-g7-pv-exit-5-0", "det-mismap-g7-pv-exit-5-2", "det-mismap-g7-pv-exit-6-0", "det-mismap-g7-pv-exit-6-2",
    ]);
    expect(math.correctionChecks.every((check) => check.consistent !== false)).toBe(true);
    // Literacy: original writing is required for mastery and the lesson's own writing is unscored.
    expect(literacy.review.findings.map((item) => item.id)).toEqual(expect.arrayContaining(["det-bp-production", "ai-l1-writing-objectives-evidenced-by-selection", "det-mc-unassessed-mc-circular-reasoning"]));
    expect(literacy.plan.tasks.some((task) => task.kind === "ORIGINAL_WRITING" && task.timing === "END_OF_LESSON" && task.scaffold === "NONE")).toBe(true);
  });
});

// A skipped describe still runs its body while collecting, so nothing here may read the pinned commit
// outside a test: a shallow CI checkout does not have it.
describe.runIf(pinnedCommitAvailable(pin))("reproducible from the pinned commit", () => {
  it("regenerates byte-identical reports (run the build script if this fails)", () => {
    const rebuilt = loadG7LessonInputs().map((inputs) => buildG7GapReport(pin, inputs));
    rebuilt.forEach((report) => {
      expect(`${JSON.stringify(report, null, 2)}\n`).toBe(readFileSync(`${G7_EXCELLENCE_DIR}/${report.lessonKey}/gap-report.json`, "utf8").replace(/\r\n/g, "\n"));
      expect(renderG7GapReportMarkdown(report)).toBe(readFileSync(`${G7_EXCELLENCE_DIR}/${report.lessonKey}/gap-report.md`, "utf8").replace(/\r\n/g, "\n"));
    });
    expect(renderG7IndexMarkdown(pin, rebuilt)).toBe(readFileSync(`${G7_EXCELLENCE_DIR}/README.md`, "utf8").replace(/\r\n/g, "\n"));
  });

  it("refuses a candidate that no longer matches the pinned hash", () => {
    const [first] = loadG7LessonInputs();
    const edited = { ...first, candidate: { ...first.candidate, title: `${first.candidate.title}!` } };
    expect(() => buildG7GapReport(pin, edited)).toThrowError(/REVISION_HASH_MISMATCH/);
  });

  it("refuses to run when the reviewer is recorded as the candidates' author", () => {
    const [first] = loadG7LessonInputs();
    expect(() => buildG7GapReport({ ...pin, candidateAuthors: [pin.reviewer] }, first)).toThrowError(/SELF_REVIEW_PROHIBITED/);
  });
});

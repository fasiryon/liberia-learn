import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCurriculumV2Contract } from "@/lib/curriculum/benchmarking/curriculumV2Contract";

/**
 * P2-C forensic remediation FIX 5: WASSCE must be recorded only as a
 * regional/historical reference on WAEC.LIBERIA.LSHSCE.REGULAR
 * (AssessmentBaselineFramework.regionalReferenceLabels), never as a
 * first-party synonym for LSHSCE, and must never be able to influence any
 * Liberia baseline calculation (core subjects, grading, CASS/TASS,
 * certificate rules, or competency mapping).
 */

const root = process.cwd();

function readSource(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("P2-C FIX 5: WASSCE reference isolation", () => {
  it("keeps regionalReferenceLabels and WASSCE out of every real calculation engine's source", () => {
    const calculationModules = [
      "lib/curriculum/benchmarking/gapEngine.ts",
      "lib/curriculum/benchmarking/aiWaecAlignment.ts",
      "lib/curriculum/benchmarking/depth.ts",
    ];
    for (const modulePath of calculationModules) {
      const source = readSource(modulePath);
      expect(source, `${modulePath} must never reference regionalReferenceLabels`).not.toContain("regionalReferenceLabels");
      expect(source, `${modulePath} must never reference WASSCE`).not.toMatch(/WASSCE/);
    }
  });

  it("never lets examAliases content change any calculated field of the Curriculum V2 contract", () => {
    const baseInput = {
      moeObjective: {
        id: "moe-1",
        code: "MOE.G12.MATH.SUBJECT_LEVEL_ONLY",
        grade: 12,
        subject: "MATH",
        domain: "GENERAL",
        topic: "General Mathematics",
        authoritativeWording: "Learners can apply general mathematics concepts.",
        verificationStatus: "VERIFIED" as const,
      },
      waecSubject: { subjectCode: "MATH", required: true, subjectGroup: "CORE" },
      baselineCompetency: { verificationStatus: "PARTIAL" as const, evidenceSpecificity: "SUBJECT_LEVEL" as const },
      evidence: [],
      assessedDepthRelation: null,
      masteryTarget: null,
      extensionTarget: null,
      reviewState: "NOT_REVIEWED",
    };

    const withoutWassce = buildCurriculumV2Contract({
      ...baseInput,
      framework: { code: "WAEC.LIBERIA.LSHSCE.REGULAR", exam: "LSHSCE", level: "SENIOR_SECONDARY", examAliases: [] },
    });
    const withWassce = buildCurriculumV2Contract({
      ...baseInput,
      framework: { code: "WAEC.LIBERIA.LSHSCE.REGULAR", exam: "LSHSCE", level: "SENIOR_SECONDARY", examAliases: ["WASSCE"] },
    });

    // Only the pass-through display field differs; every calculated field
    // (depth, evidence specificity, subject applicability, review state,
    // unknown-baseline details) is byte-identical regardless of WASSCE
    // labeling.
    const { applicableExamFramework: _withoutFramework, ...withoutCalculated } = withoutWassce;
    const { applicableExamFramework: _withFramework, ...withCalculated } = withWassce;
    expect(withCalculated).toEqual(withoutCalculated);
    expect(withoutWassce.applicableExamFramework?.examAliases).toEqual([]);
    expect(withWassce.applicableExamFramework?.examAliases).toEqual(["WASSCE"]);
    expect(withWassce.waecSubjectApplicability).toEqual(withoutWassce.waecSubjectApplicability);
    expect(withWassce.verifiedBaselineDepth).toBe(withoutWassce.verifiedBaselineDepth);
  });
});

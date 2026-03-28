import { describe, expect, it } from "vitest";
import {
  curriculumFramework,
  getSeniorSecondaryCoreSubjects,
  getSubjectMapByGrade,
  sampleCurriculumBlueprint,
} from "@/lib/curriculum/framework";

describe("curriculum framework", () => {
  it("covers grades 1 through 12 with a broad subject map", () => {
    const subjectMap = getSubjectMapByGrade();

    expect(Object.keys(subjectMap)).toHaveLength(12);
    expect(subjectMap[1]).toContain("MATH");
    expect(subjectMap[3]).toContain("LITERACY");
    expect(subjectMap[7]).toContain("COMPUTER_SCIENCE");
    expect(subjectMap[10]).toContain("GOVERNMENT");
  });

  it("defines senior pathways with one primary track and minor clusters", () => {
    expect(curriculumFramework.seniorPathways.length).toBeGreaterThanOrEqual(4);
    for (const pathway of curriculumFramework.seniorPathways) {
      expect(pathway.primarySubjects.length).toBeGreaterThanOrEqual(2);
      expect(pathway.minorClusters.length).toBeGreaterThanOrEqual(1);
      for (const minor of pathway.minorClusters) {
        expect(minor.electiveSubjects.length).toBeGreaterThanOrEqual(2);
      }
    }

    expect(getSeniorSecondaryCoreSubjects()).toContain("MATH");
    expect(getSeniorSecondaryCoreSubjects()).toContain("ENGLISH");
  });

  it("includes governance, guardian policy, and gap-fill priorities", () => {
    expect(curriculumFramework.governance.curriculumVersion).toBe("LiberiaLearn.CF.2026.1");
    expect(curriculumFramework.guardianSystem.communicationPolicy.defaultDigest).toBe("weekly");
    expect(curriculumFramework.mediaGenerationEngine.bestEffort).toBe(true);
    expect(curriculumFramework.gapFillPriorities.firstWave).toContain("Grade 7 Mathematics");
  });

  it("ships a grade 7 math sample blueprint with RAG chunk readiness", () => {
    expect(sampleCurriculumBlueprint.scope.grade).toBe(7);
    expect(sampleCurriculumBlueprint.scope.subject).toBe("MATH");
    expect(sampleCurriculumBlueprint.chunkReadiness.chunkTypes).toContain("guardian_support");
    expect(sampleCurriculumBlueprint.lessonBlueprint.guardianSupportNote.length).toBeGreaterThan(10);
    expect(sampleCurriculumBlueprint.lessonBlueprint.visualAssetSpecs.length).toBeGreaterThan(0);
  });
});

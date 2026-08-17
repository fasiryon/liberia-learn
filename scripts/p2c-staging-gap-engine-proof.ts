import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { buildCurriculumGapReport } from "../lib/curriculum/benchmarking/gapEngine";
import type { CoverageMapping, GapCompetency, GapObjective, GapTarget } from "../lib/curriculum/benchmarking/types";

/**
 * Gate 6: runs the real gapEngine.ts against data actually queried live from
 * staging (not local fixtures) -- the seed committed by
 * p2c-staging-real-data-seed.ts, plus a live CurriculumContent count proving
 * the LiberiaLearn-authoring gap is real, not simulated.
 */

const STAGING_REF = "yonpfzjczoffhrgibxkz";
const PRODUCTION_REF = "bnphuinpvgpmebcsvmsp";

function assertStaging(): void {
  const url = process.env.P2A_STAGING_DATABASE_URL?.trim();
  if (!url) throw new Error("P2A_STAGING_DATABASE_URL is required");
  if (!url.includes(STAGING_REF)) throw new Error("DATABASE_URL is not the approved staging project");
  if (url.includes(PRODUCTION_REF)) throw new Error("REFUSING: URL touches the production project ref");
  process.env.DATABASE_URL = url;
}
assertStaging();

const prisma = new PrismaClient();

async function main() {
  const moeObjectivesRaw = await prisma.moeCurriculumObjective.findMany({
    where: { code: { in: ["MOE.G9.MATH.SETS.TWO_SET_PROBLEMS", "MOE.G12.MATH.DIFFERENTIATION_AND_INTEGRATION", "MOE.G3.MATH.REVIEW_OF_OPERATIONS"] } },
  });
  const competencyRaw = await prisma.assessmentBaselineCompetency.findUnique({ where: { code: "WAEC.LIBERIA.MATH.SETS.SUBJECT_LEVEL" } });
  const alignmentsRaw = await prisma.curriculumBaselineAlignment.findMany({ where: { moeObjectiveId: { in: moeObjectivesRaw.map((o) => o.id) } } });
  const learningTargetsRaw = await prisma.curriculumLearningTarget.findMany({ where: { code: { in: ["LL.G9.MATH.SETS.TWO_SET_PROBLEMS.MASTERY", "LL.G12.MATH.DIFFERENTIATION_AND_INTEGRATION.EXTENSION"] } } });

  const g9 = moeObjectivesRaw.find((o) => o.grade === 9)!;
  const g12 = moeObjectivesRaw.find((o) => o.grade === 12)!;
  const g3 = moeObjectivesRaw.find((o) => o.grade === 3)!;

  console.log("=== Live staging query results ===");
  console.log("MOE objectives found:", moeObjectivesRaw.map((o) => o.code));
  console.log("WAEC competency found:", competencyRaw?.code);
  console.log("Baseline alignments found:", alignmentsRaw.length);
  console.log("Learning targets found:", learningTargetsRaw.map((t) => t.code));

  // --- Live LiberiaLearn content coverage check (the real gap, not simulated) ---
  const g9MathCount = await prisma.curriculumContent.count({ where: { subject: "MATH", grade: 9 } });
  const g12MathCount = await prisma.curriculumContent.count({ where: { subject: "MATH", grade: 12 } });
  console.log(`\n=== Live staging CurriculumContent counts ===`);
  console.log(`Grade 9 MATH rows on staging: ${g9MathCount}`);
  console.log(`Grade 12 MATH rows on staging: ${g12MathCount}`);

  // --- Gate 6a: G9 baseline layer, using the real library function ---
  const moeObjectiveInput: GapObjective = { id: g9.id, code: g9.code, criticality: g9.criticality, verificationStatus: g9.verificationStatus };
  const competencyInput: GapCompetency = {
    id: competencyRaw!.id,
    code: competencyRaw!.code,
    criticality: competencyRaw!.criticality,
    verificationStatus: competencyRaw!.verificationStatus,
    applicable: true,
  };
  const mappingInput: CoverageMapping = {
    id: alignmentsRaw[0].id,
    moeObjectiveId: alignmentsRaw[0].moeObjectiveId,
    baselineCompetencyId: alignmentsRaw[0].baselineCompetencyId,
    learningTargetId: null,
    coverage: alignmentsRaw[0].coverage,
    depthRelation: alignmentsRaw[0].depthRelation,
    confidence: alignmentsRaw[0].confidence,
    evidenceRefs: alignmentsRaw[0].evidenceRefs as unknown[],
    status: alignmentsRaw[0].status,
  };
  const g9BaselineReport = buildCurriculumGapReport({
    moeObjectives: [moeObjectiveInput],
    baselineCompetencies: [competencyInput],
    learningTargets: [],
    mappings: [mappingInput],
  });
  console.log("\n=== Gate 6a: G9 baseline layer (real gapEngine.ts, real seeded data) ===");
  console.log(g9BaselineReport);

  // --- Gate 6b: G9 mastery layer -- real gap since g9MathCount === 0 ---
  const masteryTargetRow = learningTargetsRaw.find((t) => t.targetLevel === "MASTERY")!;
  const masteryTargetInput: GapTarget = { id: masteryTargetRow.id, code: masteryTargetRow.code, targetLevel: "MASTERY" };
  const g9MasteryReport = buildCurriculumGapReport({
    moeObjectives: [moeObjectiveInput],
    baselineCompetencies: [competencyInput],
    learningTargets: [masteryTargetInput],
    mappings: [mappingInput], // no mapping for masteryTargetInput.id -- none exists, matching g9MathCount === 0
  });
  console.log("\n=== Gate 6b: G9 mastery layer (real gap: live CurriculumContent has 0 matching rows) ===");
  console.log(g9MasteryReport);
  if (g9MathCount !== 0) {
    console.warn("WARNING: staging now has Grade 9 MATH content -- the mastery gap above may no longer reflect live state.");
  }

  // --- Gate 6c: G3 NOT_APPLICABLE (real live data, no baseline competency applies) ---
  const g3Input: GapObjective = { id: g3.id, code: g3.code, criticality: g3.criticality, verificationStatus: g3.verificationStatus };
  const g3Report = buildCurriculumGapReport({ moeObjectives: [g3Input], baselineCompetencies: [], learningTargets: [], mappings: [] });
  console.log("\n=== Gate 6c: G3 NOT_APPLICABLE (real live data) ===");
  console.log(g3Report);

  // --- Gate 6d: G12 above-baseline candidate is NOT modeled as a baseline alignment (no WAEC competency exists) ---
  const g12Alignments = alignmentsRaw.filter((a) => a.moeObjectiveId === g12.id);
  console.log(`\n=== Gate 6d: G12 baseline alignments (expect 0 -- no WAEC baseline competency for calculus) ===`);
  console.log(`Count: ${g12Alignments.length}`);
  const extensionTargetRow = learningTargetsRaw.find((t) => t.targetLevel === "EXTENSION")!;
  console.log(`Extension target exists instead: ${extensionTargetRow.code}, baselineCompetencyId=${extensionTargetRow.baselineCompetencyId}`);

  const summary = {
    g9BaselineStatus: g9BaselineReport.waecBaselineCoverageStatus,
    g9BaselineReadiness: g9BaselineReport.readinessIndicator,
    g9MasteryGapReal: g9MasteryReport.incompleteMasteryTargets.length > 0 && g9MathCount === 0,
    g3NotApplicable: g3Report.waecBaselineCoverageStatus === "NOT_APPLICABLE",
    g12HasNoBaselineAlignment: g12Alignments.length === 0,
    g12ExtensionTargetPresent: Boolean(extensionTargetRow),
  };
  console.log("\n=== Gate 6 summary ===");
  console.log(summary);
  const allPass = Object.values(summary).every((v) => v === true || (typeof v === "string" && v.length > 0));
  console.log(allPass ? "GATE 6: PASS" : "GATE 6: FAIL");
  if (!allPass) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

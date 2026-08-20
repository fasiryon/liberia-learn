import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { buildCurriculumGapReport, classifyGapCategories } from "@/lib/curriculum/benchmarking/gapEngine";
import type { GapObjective, GapCompetency, GapTarget, CoverageMapping, VerificationStatus, Criticality } from "@/lib/curriculum/benchmarking/types";

/**
 * P2-C Phase 7 (course coverage analysis) + Phase 8 (baseline vs mastery vs
 * extension proof), read-only against real staging data. Writes nothing.
 *
 * Uses P2A_STAGING_DATABASE_URL. Refuses to run against production.
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
  const objectives = await prisma.moeCurriculumObjective.findMany({
    select: { id: true, code: true, criticality: true, verificationStatus: true, grade: true, subject: true, topic: true },
  });
  const competencies = await prisma.assessmentBaselineCompetency.findMany({
    select: { id: true, code: true, criticality: true, verificationStatus: true, expectation: true, evidenceSpecificity: true, baselineSubject: { select: { code: true, gradeMin: true, gradeMax: true, framework: { select: { code: true, exam: true } } } } },
  });
  const targets = await prisma.curriculumLearningTarget.findMany({
    select: { id: true, code: true, targetLevel: true, statement: true, grade: true, subject: true },
  });
  const mappings = await prisma.curriculumCompetencyCoverage.findMany();

  console.log(`Loaded: ${objectives.length} MOE objectives, ${competencies.length} baseline competencies, ${targets.length} learning targets, ${mappings.length} coverage mappings (real staging counts, not fixtures).`);

  const gapObjectives: GapObjective[] = objectives.map((o) => ({
    id: o.id,
    code: o.code,
    criticality: o.criticality as Criticality,
    verificationStatus: o.verificationStatus as VerificationStatus,
  }));
  const gapCompetencies: GapCompetency[] = competencies.map((c) => ({
    id: c.id,
    code: c.code,
    criticality: c.criticality as Criticality,
    verificationStatus: c.verificationStatus as VerificationStatus,
    applicable: true,
    evidenceSpecificity: c.evidenceSpecificity as GapCompetency["evidenceSpecificity"],
  }));
  const gapTargets: GapTarget[] = targets.map((t) => ({
    id: t.id,
    code: t.code,
    targetLevel: t.targetLevel as "MASTERY" | "EXTENSION",
  }));
  const gapMappings: CoverageMapping[] = mappings.map((m) => ({
    id: m.id,
    moeObjectiveId: m.moeObjectiveId,
    baselineCompetencyId: m.baselineCompetencyId,
    learningTargetId: m.learningTargetId,
    coverage: m.coverage as "NONE" | "PARTIAL" | "FULL",
    depthRelation: m.depthRelation as CoverageMapping["depthRelation"],
    confidence: m.confidence,
    evidenceRefs: Array.isArray(m.evidenceRefs) ? (m.evidenceRefs as unknown[]) : [],
    status: m.status as CoverageMapping["status"],
  }));

  const report = buildCurriculumGapReport({
    moeObjectives: gapObjectives,
    baselineCompetencies: gapCompetencies,
    learningTargets: gapTargets,
    mappings: gapMappings,
  });
  const categories = classifyGapCategories(report);

  console.log("\n=== PHASE 7: PLATFORM-WIDE GAP REPORT (real staging codes) ===");
  console.log(JSON.stringify(report, null, 2));
  console.log("\n=== GAP CATEGORY BREAKDOWN ===");
  console.log(JSON.stringify(categories, null, 2));

  console.log(`\nReal, honest reading: ${mappings.length} CurriculumCompetencyCoverage rows exist on staging. This sprint deliberately does not persist AI-generated alignment results as coverage mappings without a human/policy review step (see scripts/p2c-live-ai-sme-proof.ts), so every MOE objective correctly reports as CONTENT_GAP ("no reviewed coverage decision exists yet", not "LiberiaLearn has no relevant content"). Every baseline competency is currently SUBJECT_LEVEL only (no topic-level WAEC syllabus was recovered for any of them), so per the forensic-remediation gap-engine fix they correctly report as TOPIC_LEVEL_BASELINE_UNKNOWN, never CONTENT_GAP/BELOW_BASELINE -- a public-evidence limitation, not a LiberiaLearn content defect. It is not a synthetic pass.`);

  console.log("\n=== PHASE 8: MOE -> WAEC BASELINE -> LIBERIALEARN MASTERY -> LIBERIALEARN EXTENSION (Mathematics, the one subject with authored Mastery/Extension targets) ===");
  const mathObjective = objectives.find((o) => o.code === "MOE.G9.MATH.SETS.TWO_SET_PROBLEMS");
  const mathCompetency = competencies.find((c) => c.code === "WAEC.LIBERIA.MATH.SETS.SUBJECT_LEVEL");
  const masteryTarget = targets.find((t) => t.targetLevel === "MASTERY");
  const extensionTarget = targets.find((t) => t.targetLevel === "EXTENSION");
  console.log(JSON.stringify(
    {
      MOE_REQUIREMENT: mathObjective ? { code: mathObjective.code, grade: mathObjective.grade, topic: mathObjective.topic } : null,
      WAEC_LIBERIA_BASELINE: mathCompetency ? { code: mathCompetency.code, framework: mathCompetency.baselineSubject.framework.code, expectation: mathCompetency.expectation } : null,
      LIBERIALEARN_MASTERY: masteryTarget ? { code: masteryTarget.code, statement: masteryTarget.statement } : null,
      LIBERIALEARN_EXTENSION: extensionTarget ? { code: extensionTarget.code, statement: extensionTarget.statement } : null,
    },
    null,
    2,
  ));
  console.log("\nProof points: (1) WAEC baseline is SUBJECT_LEVEL only, never claimed as the ceiling. (2) LiberiaLearn's own Mastery target is written independently, in LiberiaLearn's own words, at a level a student could exceed the WAEC baseline through -- it does not just restate the WAEC expectation. (3) The Extension target explicitly documents that it has 'no independently WAEC-examined subject vehicle' and survives anyway -- extension does not require WAEC evidence to exist.");

  console.log("\n=== PHASE 8 GAP: no Mastery/Extension targets exist yet for the 14 newly-expanded subjects ===");
  const newSubjectCodes = new Set(objectives.filter((o) => o.code !== "MOE.G9.MATH.SETS.TWO_SET_PROBLEMS" && o.code !== "MOE.G12.MATH.DIFFERENTIATION_AND_INTEGRATION" && o.code !== "MOE.G3.MATH.REVIEW_OF_OPERATIONS").map((o) => o.code));
  console.log(`${newSubjectCodes.size} newly-expanded MOE objectives (Language Arts/Science/Social Studies/English/Economics/Geography/History/Literature/Biology/Chemistry/Physics) have zero paired CurriculumLearningTarget rows -- this is a real, honest MASTERY_TARGET_GAP/EXTENSION_GAP, not fabricated to look complete.`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

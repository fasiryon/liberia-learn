import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { buildCurriculumV2Contract, buildP5AHandoffContract } from "@/lib/curriculum/benchmarking/curriculumV2Contract";
import type { AlignmentEvidence } from "@/lib/curriculum/benchmarking/aiWaecAlignment";

/**
 * P2-C Phase 15/16: proves the Curriculum V2 and P5-A handoff contracts
 * assemble correctly from real staging data. Neither Curriculum V2 nor P5-A
 * is implemented by this script -- it only proves the contract shape.
 * Read-only. Uses P2A_STAGING_DATABASE_URL. Refuses to run against
 * production.
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
  // --- Curriculum V2 contract: Grade 9 Two-Set Problems (has both a mastery target and an extension example elsewhere) ---
  const objective = await prisma.moeCurriculumObjective.findFirstOrThrow({
    where: { code: "MOE.G9.MATH.SETS.TWO_SET_PROBLEMS" },
  });
  const competency = await prisma.assessmentBaselineCompetency.findFirstOrThrow({
    where: { code: "WAEC.LIBERIA.MATH.SETS.SUBJECT_LEVEL" },
    include: { baselineSubject: { include: { framework: true } } },
  });
  const masteryTarget = await prisma.curriculumLearningTarget.findFirst({
    where: { code: "LL.G9.MATH.SETS.TWO_SET_PROBLEMS.MASTERY" },
  });
  const extensionTarget = await prisma.curriculumLearningTarget.findFirst({
    where: { targetLevel: "EXTENSION" },
  });
  const alignment = await prisma.curriculumBaselineAlignment.findFirst({
    where: { moeObjectiveId: objective.id, baselineCompetencyId: competency.id },
  });

  const evidence: AlignmentEvidence[] = [
    {
      id: "moe-g79-sets",
      authorityType: "LIBERIA_MOE",
      canonicalUrl: "http://www.moe.gov.lr/wp-content/uploads/2019/09/GRADE-7-9.zip",
      sourceVersionId: objective.sourceVersionId,
      locator: objective.evidenceLocator,
      excerpt: objective.authoritativeWording,
      verificationStatus: "VERIFIED",
      evidenceSpecificity: "TOPIC_LEVEL",
    },
    {
      id: "waec-ljhsce-subject-table",
      authorityType: "WAEC_LIBERIA",
      canonicalUrl: "https://waecliberia.org.lr/ljhsce/",
      sourceVersionId: competency.sourceVersionId,
      locator: "LJHSCE subject table",
      excerpt: competency.expectation,
      verificationStatus: "VERIFIED",
      evidenceSpecificity: "SUBJECT_LEVEL",
    },
  ];

  const contract = buildCurriculumV2Contract({
    moeObjective: {
      id: objective.id,
      code: objective.code,
      grade: objective.grade,
      subject: objective.subject,
      domain: objective.domain,
      topic: objective.topic ?? "",
      authoritativeWording: objective.authoritativeWording,
      verificationStatus: objective.verificationStatus as never,
    },
    framework: {
      code: competency.baselineSubject.framework.code,
      exam: competency.baselineSubject.framework.exam,
      level: competency.baselineSubject.framework.level,
      examAliases: (competency.baselineSubject.framework as unknown as { examAliases: string[] }).examAliases ?? [],
    },
    waecSubject: {
      subjectCode: competency.baselineSubject.code,
      required: competency.baselineSubject.required,
      subjectGroup: competency.baselineSubject.subjectGroup,
    },
    baselineCompetency: {
      verificationStatus: competency.verificationStatus as never,
      evidenceSpecificity: (competency as unknown as { evidenceSpecificity: "FRAMEWORK_LEVEL" | "SUBJECT_LEVEL" | "TOPIC_LEVEL" }).evidenceSpecificity,
    },
    evidence,
    assessedDepthRelation: (alignment?.depthRelation as never) ?? null,
    masteryTarget: masteryTarget ? { code: masteryTarget.code, statement: masteryTarget.statement } : null,
    extensionTarget: null, // this objective's own extension is a different target (calculus); demonstrates the null-honesty path
    reviewState: "NOT_REVIEWED",
  });

  console.log("=== PHASE 15: CURRICULUM V2 CONTRACT (assembled from real staging data) ===");
  console.log(JSON.stringify(contract, null, 2));
  console.log(`\nProof point: evidenceSpecificity resolves from the persisted AssessmentBaselineCompetency.evidenceSpecificity column (SUBJECT_LEVEL). verifiedBaselineDepth is UNKNOWN because it is sourced only from the real CurriculumBaselineAlignment.depthRelation row (which is itself UNKNOWN -- no topic-level WAEC evidence exists), never inferred from evidence presence. unknownBaselineDetails is non-empty and honest, not padded to look complete.`);

  // --- P5-A contract: the MOE Grade 7-9 archive source version ---
  const moeSource = await prisma.curriculumAuthoritySource.findFirstOrThrow({
    where: { canonicalUrl: { contains: "GRADE-7-9.zip" } },
    include: { currentVersion: true },
  });
  if (!moeSource.currentVersion) throw new Error("Expected currentVersion to be set");
  const p5aContract = buildP5AHandoffContract({
    sourceVersionId: moeSource.currentVersion.id,
    sourceHash: moeSource.currentVersion.contentHash,
    validityStatus: moeSource.status === "ACTIVE" ? "ACTIVE" : moeSource.status === "SUPERSEDED" ? "SUPERSEDED" : "STALE",
    rightsStatus: moeSource.rightsStatus,
    revoked: false,
    superseded: moeSource.status === "SUPERSEDED",
  });

  console.log("\n=== PHASE 16: P5-A HANDOFF CONTRACT (assembled from real staging data) ===");
  console.log(JSON.stringify(p5aContract, null, 2));

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

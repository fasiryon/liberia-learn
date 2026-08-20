import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  validateAiWaecAlignment,
  type AlignmentEvidence,
} from "@/lib/curriculum/benchmarking/aiWaecAlignment";
import { buildPrompt, getPrompt } from "@/lib/ai/promptRegistry";
import { routedCompletion } from "@/lib/ai/routedCompletion";
import { logAIInteraction } from "@/lib/ai/interactionLog";

/**
 * P2-C production AI canary (Phase 9 of the controlled production cutover).
 * Single real call, hard-capped at $1 (expected actual ~$0.0003), reusing
 * scripts/p2c-live-ai-sme-proof.ts's proven Case A structure (Grade 9
 * Two-Set Problems, SUBJECT_LEVEL WAEC evidence only) against the REAL
 * production-seeded evidence this cutover just wrote -- not staging's IDs,
 * not hand-invented data. No CurriculumBaselineAlignment/
 * CurriculumCompetencyCoverage/CurriculumGovernanceEvent row is created;
 * this proves the AI path, it does not persist a new alignment result.
 *
 * Uses DATABASE_URL. Refuses to run against staging.
 */

const STAGING_REF = "yonpfzjczoffhrgibxkz";
const PRODUCTION_REF = "bnphuinpvgpmebcsvmsp";
const MAX_TOTAL_SPEND_USD = 1;
const RUN_ID = randomUUID();

function assertProduction(): void {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is required");
  if (!url.includes(`postgres.${PRODUCTION_REF}`)) throw new Error("DATABASE_URL is not the approved production project");
  if (url.includes(STAGING_REF)) throw new Error("REFUSING: URL touches the staging project ref");
}
assertProduction();

const prisma = new PrismaClient();
const RUN_STARTED_AT = new Date();

async function main() {
  // --- Pre-canary snapshot: must be zero new writes to these 3 tables ---
  const preAlignments = await prisma.curriculumBaselineAlignment.count();
  const preCoverage = await prisma.curriculumCompetencyCoverage.count();
  const preGovernanceEvents = await prisma.curriculumGovernanceEvent.count();

  // --- Real production evidence, fetched live, not hardcoded IDs ---
  const moeG79Source = await prisma.curriculumAuthoritySource.findFirstOrThrow({
    where: { canonicalUrl: { contains: "GRADE-7-9.zip" } },
  });
  const ljhsceSource = await prisma.curriculumAuthoritySource.findFirstOrThrow({
    where: { canonicalUrl: "https://waecliberia.org.lr/ljhsce/" },
  });
  if (!moeG79Source.currentVersionId || !ljhsceSource.currentVersionId) {
    throw new Error("Production evidence sources are missing currentVersionId");
  }

  const GRADE7_9_MOE: AlignmentEvidence = {
    id: "moe-g79-sets",
    authorityType: "LIBERIA_MOE",
    canonicalUrl: moeG79Source.canonicalUrl,
    sourceVersionId: moeG79Source.currentVersionId,
    locator: "Math 7-9.pdf, Semester One, Grade 9, Period I, Topic: TWO-SET PROBLEMS, page 37",
    excerpt:
      "Learners are able to apply the concepts of sets to solve simple two-set problems using Venn diagram, find the complement of a set and represent it on the Venn diagram.",
    verificationStatus: "VERIFIED",
    evidenceSpecificity: "TOPIC_LEVEL",
  };
  const LJHSCE_WAEC: AlignmentEvidence = {
    id: "waec-ljhsce-subject-table",
    authorityType: "WAEC_LIBERIA",
    canonicalUrl: ljhsceSource.canonicalUrl,
    sourceVersionId: ljhsceSource.currentVersionId,
    locator: "LJHSCE subject table",
    excerpt: "Mathematics (code 210) is one of four compulsory subjects examined at LJHSCE.",
    verificationStatus: "VERIFIED",
    evidenceSpecificity: "SUBJECT_LEVEL",
  };

  const moeObjectiveWording =
    "Learners are able to apply the concepts of sets to solve simple two-set problems using Venn diagram, find the complement of a set and represent it on the Venn diagram. Draw and use Venn diagrams to solve simple two-set problems. Find and write the number of subsets in a set with up to 5 elements. Find the rule of the number of subsets in a set.";
  const baselineExpectation =
    "Mathematics is a compulsory WAEC Liberia subject at LJHSCE (210); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes a dedicated Sets / Two-Set Problems unit at Grade 9. No topic-by-topic WAEC Mathematics syllabus was recovered to confirm the exact expected depth for this specific competency.";
  const evidence = [GRADE7_9_MOE, LJHSCE_WAEC];

  console.log("=== Production AI canary: Case A (Grade 9 Two-Set Problems, SUBJECT_LEVEL WAEC evidence) ===");
  const invocationId = randomUUID();
  const timestamp = new Date().toISOString();
  const prompt = getPrompt("curriculum.waecBaselineAlignment.system");
  const completion = await routedCompletion({
    messages: [
      { role: "system", content: buildPrompt(prompt.key) },
      {
        role: "user",
        content: buildPrompt("curriculum.waecBaselineAlignment.user", {
          moeObjectiveCode: "MOE.G9.MATH.SETS.TWO_SET_PROBLEMS",
          moeObjectiveWording,
          baselineCompetencyCode: "WAEC.LIBERIA.MATH.SETS.SUBJECT_LEVEL",
          baselineExpectation,
          evidenceJson: JSON.stringify(evidence),
        }),
      },
    ],
    responseFormat: "json",
    maxTokens: 900,
    forceSmartTier: true,
    aiUsage: {
      route: "curriculum.waecBaselineAlignment",
      feature: "curriculum",
      requestType: "p2c_production_ai_canary",
      promptKey: prompt.key,
      promptVersion: prompt.version,
      promptHash: prompt.hash,
      generationCorrelationId: invocationId,
      metadata: { authorityLabel: "AI_ASSESSED_ALIGNMENT", externalApprovalClaimed: false, proofRunId: RUN_ID },
    },
  });

  if (completion.estimatedCostUSD > MAX_TOTAL_SPEND_USD) {
    throw new Error(`SPEND_CAP_EXCEEDED: this call cost $${completion.estimatedCostUSD.toFixed(6)}, above the $${MAX_TOTAL_SPEND_USD} hard cap`);
  }

  const effectiveCorrelationId = completion.generationCorrelationId ?? invocationId;
  const telemetry = await logAIInteraction({
    route: "curriculum.waecBaselineAlignment",
    feature: "curriculum",
    requestType: "p2c_production_ai_canary",
    model: completion.model,
    tier: completion.tier,
    inputTokens: completion.inputTokens,
    outputTokens: completion.outputTokens,
    estimatedCostUSD: completion.estimatedCostUSD,
    promptKey: prompt.key,
    promptVersion: prompt.version,
    promptHash: prompt.hash,
    generationCorrelationId: effectiveCorrelationId,
    metadata: { proofRunId: RUN_ID, proofCase: "production-canary-case-a" },
    durable: true,
  }).then(() => ({ persisted: true, error: undefined as string | undefined }))
    .catch((error) => ({ persisted: false, error: error instanceof Error ? error.message : String(error) }));

  console.log(`Provider/model: ${completion.model} (tier: ${completion.tier}); tokens in/out: ${completion.inputTokens}/${completion.outputTokens}; cost: $${completion.estimatedCostUSD.toFixed(6)}; telemetry persisted: ${telemetry.persisted}`);
  console.log("RAW COMPLETION:", completion.content);

  let outcome: string;
  let validatedResult: unknown = null;
  let rawParsed: unknown = null;
  let guardMiss = false;
  try {
    rawParsed = JSON.parse(completion.content);
    const result = validateAiWaecAlignment({
      raw: rawParsed,
      moeObjectiveWording,
      baselineExpectation,
      evidence,
    });
    validatedResult = result;
    const DIRECT_DEPTH_CLAIMS = new Set(["MEETS_BASELINE", "ABOVE_BASELINE", "SIGNIFICANTLY_ABOVE_BASELINE", "BELOW_BASELINE"]);
    const overreached = result.relationshipType === "DIRECT" || DIRECT_DEPTH_CLAIMS.has(result.depthRelation);
    if (overreached) {
      guardMiss = true;
      outcome = "GUARD_MISS_FAIL: validator accepted DIRECT/definite depth without TOPIC_LEVEL WAEC evidence";
    } else {
      outcome = `HONEST_RESULT: relationshipType=${result.relationshipType}, depthRelation=${result.depthRelation}, coverage=${result.coverage}`;
    }
    console.log("VALIDATED RESULT:", JSON.stringify(result, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outcome = `FAIL_CLOSED_REJECTED: guard/schema correctly rejected raw output: ${message.slice(0, 300)}`;
  }
  console.log("\nOUTCOME:", outcome);

  // --- Postflight: the 5 named pass criteria ---
  const aiInteractionRows = await prisma.aIInteraction.findMany({
    where: { generationCorrelationId: effectiveCorrelationId },
    select: { id: true, model: true, estimatedCostUSD: true, dedupeKey: true },
  });
  const aiInteractionLogRows = await prisma.aiInteractionLog.count({
    where: { requestType: "p2c_production_ai_canary" },
  });
  const postAlignments = await prisma.curriculumBaselineAlignment.count();
  const postCoverage = await prisma.curriculumCompetencyCoverage.count();
  const postGovernanceEvents = await prisma.curriculumGovernanceEvent.count();

  const criteria = {
    realProviderResponse: !!completion.content && completion.model !== "" && !completion.model.toLowerCase().includes("mock"),
    exactlyOneAIInteractionRow: aiInteractionRows.length === 1,
    exactlyOneAiInteractionLogRow: aiInteractionLogRows === 1,
    guardNeverAcceptedOverreach: !guardMiss,
    zeroNewAlignmentRows: postAlignments === preAlignments,
    zeroNewCoverageRows: postCoverage === preCoverage,
    zeroNewGovernanceEventRows: postGovernanceEvents === preGovernanceEvents,
  };
  console.log("\n=== PASS CRITERIA ===");
  console.log(criteria);

  const allPass = Object.values(criteria).every(Boolean);
  console.log(allPass ? "\nCANARY: PASS" : "\nCANARY: FAIL");

  const artifact = {
    runId: RUN_ID,
    startedAt: RUN_STARTED_AT.toISOString(),
    completedAt: new Date().toISOString(),
    productionProjectRef: PRODUCTION_REF,
    spendCapUSD: MAX_TOTAL_SPEND_USD,
    actualCostUSD: completion.estimatedCostUSD,
    invocationId: effectiveCorrelationId,
    timestamp,
    provider: completion.model,
    tier: completion.tier,
    inputTokens: completion.inputTokens,
    outputTokens: completion.outputTokens,
    promptKey: prompt.key,
    promptVersion: prompt.version,
    promptHash: prompt.hash,
    evidence,
    rawModelOutput: rawParsed,
    validatedResult,
    outcome,
    telemetryPersisted: telemetry.persisted,
    telemetryError: telemetry.error,
    criteria,
    allPass,
  };
  const artifactDir = join(process.cwd(), "docs", "ops");
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = join(artifactDir, "P2C_PRODUCTION_AI_CANARY_PROOF.json");
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");
  console.log(`\nDurable proof artifact written: docs/ops/P2C_PRODUCTION_AI_CANARY_PROOF.json`);

  if (!allPass) process.exitCode = 1;
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("\n=== UNHANDLED FAILURE ===");
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});

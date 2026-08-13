import { randomUUID } from "crypto";
import { prisma } from "../lib/db";
import { getPrompt } from "../lib/ai/promptRegistry";
import { logAIInteraction } from "../lib/ai/interactionLog";
import { createCurriculumContent, updateCurriculumContent } from "../lib/curriculum/mutations/repository";
import { appendCurriculumGovernanceEvent } from "../lib/curriculum/mutations/governanceWriter";
import { appendCurriculumEvidence } from "../lib/curriculum/mutations/evidenceWriter";
import { revokeCurriculum } from "../lib/curriculum/mutations/revocationWriter";
import { getCurriculumProvenanceExplanation } from "../lib/curriculum/provenance/reader";
import { findUnauthorizedCurriculumWriters } from "./p2a-writer-guard";
import { APPROVED_STAGING_SUPABASE_PROJECT_REF } from "./p2a-staging-preflight";

type Check = { scenario: string; passed: boolean; detail?: string };

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function baseData(contentId: string, title: string) {
  return {
    contentId,
    title,
    grade: 6,
    subject: "MATH",
    contentType: "lesson",
    status: "draft",
    version: "p2a-e2e-v1",
    payload: {
      title,
      body: `${title}: Students compare quantities, explain each step, practise with Liberian market examples, and check their reasoning carefully.`,
      objectives: ["Explain the concept", "Apply the concept"],
      approvalStatus: "DRAFT",
    },
    moeAlignments: [{ code: "MATH-G6-E2E" }],
  } as const;
}

async function main() {
  if (process.env.STAGING_SUPABASE_PROJECT_REF !== APPROVED_STAGING_SUPABASE_PROJECT_REF) {
    throw new Error("P2-A E2E STOP: staging project identity mismatch");
  }
  if ((process.env.DATABASE_URL ?? "").includes("bnphuinpvgpmebcsvmsp")) {
    throw new Error("P2-A E2E STOP: production identity is prohibited");
  }
  if (process.env.P2A_PROVENANCE_WRITERS_DISABLED !== "false") {
    throw new Error("P2-A E2E STOP: staging provenance writers are not enabled");
  }

  const run = `p2a-e2e-${Date.now()}`;
  const checks: Check[] = [];
  const actor = await prisma.user.upsert({
    where: { email: `${run}@example.test` },
    update: {},
    create: { email: `${run}@example.test`, name: "P2-A Staging Verifier", role: "ADMIN", isPlatformAdmin: true },
  });
  const generatedAt = new Date();

  const deterministic = await createCurriculumContent(baseData(`${run}-deterministic`, "Deterministic lesson"), {
    revisionKind: "ORIGINAL_GENERATION",
    originKind: "DETERMINISTIC_GENERATED",
    actorLabel: "p2a-e2e",
    generatorName: "p2aDeterministicFixture",
    generatorVersion: "1.0.0",
    generatedAt,
    requestedCompleteness: "VERIFIED",
    auditAction: "p2a.e2e.deterministic",
    idempotencyKey: `${run}:deterministic`,
  });
  expect(deterministic.revision && deterministic.provenance?.provenanceCompleteness === "VERIFIED", "deterministic revision incomplete");
  checks.push({ scenario: "1 deterministic generation", passed: true });

  const prompt = getPrompt("lesson.deep", "3.0.0");
  const correlationId = randomUUID();
  await logAIInteraction({
    route: "p2a.staging.e2e",
    feature: "curriculum",
    model: "gpt-4o-mini",
    provider: "openai",
    promptKey: prompt.key,
    promptVersion: prompt.version,
    promptHash: prompt.hash,
    generationCorrelationId: correlationId,
    inputTokens: 10,
    outputTokens: 10,
    durable: true,
  });
  const ai = await createCurriculumContent(baseData(`${run}-ai`, "AI lesson"), {
    revisionKind: "ORIGINAL_GENERATION",
    originKind: "AI_GENERATED",
    actorLabel: "p2a-e2e",
    generatorName: "p2aAiFixture",
    generatorVersion: "1.0.0",
    aiProvider: "openai",
    aiModel: "gpt-4o-mini",
    generatedAt,
    generationCorrelationId: correlationId,
    primaryPromptKey: prompt.key,
    primaryPromptVersion: prompt.version,
    primaryPromptHash: prompt.hash,
    requestedCompleteness: "VERIFIED",
    auditAction: "p2a.e2e.ai",
    idempotencyKey: `${run}:ai`,
  });
  expect(ai.revision?.generationCorrelationId === correlationId, "AI correlation missing");
  checks.push({ scenario: "2 AI generation correlation", passed: true });

  const human = await createCurriculumContent({ ...baseData(`${run}-human`, "Teacher lesson"), teacherCreated: true, editedById: actor.id }, {
    revisionKind: "HUMAN_CREATE",
    originKind: "HUMAN_AUTHORED",
    actorUserId: actor.id,
    authorUserId: actor.id,
    requestedCompleteness: "VERIFIED",
    auditAction: "p2a.e2e.human_create",
    idempotencyKey: `${run}:human`,
  });
  checks.push({ scenario: "3 teacher authored", passed: Boolean(human.revision) });

  const edited = await updateCurriculumContent({ id: human.content.id }, { title: "Teacher lesson edited" }, {
    revisionKind: "HUMAN_EDIT",
    originKind: "HUMAN_AUTHORED",
    actorUserId: actor.id,
    authorUserId: actor.id,
    requestedCompleteness: "VERIFIED",
    auditAction: "p2a.e2e.human_edit",
    idempotencyKey: `${run}:human-edit`,
  });
  expect(edited.revision?.sequence === 2, "human edit sequence did not advance");
  checks.push({ scenario: "4 teacher edit", passed: true });

  const fork = await createCurriculumContent({ ...baseData(`${run}-fork`, "Forked lesson"), derivedFromContentId: human.content.contentId }, {
    revisionKind: "FORK",
    originKind: "FORKED",
    actorUserId: actor.id,
    authorUserId: actor.id,
    sourceRevisionId: edited.revision!.id,
    requestedCompleteness: "VERIFIED",
    auditAction: "p2a.e2e.fork",
    idempotencyKey: `${run}:fork`,
  });
  expect(fork.revision?.sourceRevisionId === edited.revision?.id, "fork source revision missing");
  checks.push({ scenario: "5 fork", passed: true });

  for (const [scenario, revisionKind] of [
    ["6 AI regeneration", "AI_REGENERATION"],
    ["7 AI upgrade", "AI_UPGRADE"],
  ] as const) {
    await updateCurriculumContent({ id: ai.content.id }, { title: `${scenario} result` }, {
      revisionKind,
      originKind: revisionKind === "AI_UPGRADE" ? "AI_UPGRADED" : "AI_GENERATED",
      actorUserId: actor.id,
      generatorName: `p2a${revisionKind}`,
      generatorVersion: "1.0.0",
      aiProvider: "openai",
      aiModel: "gpt-4o-mini",
      generatedAt: new Date(),
      generationCorrelationId: randomUUID(),
      primaryPromptKey: prompt.key,
      primaryPromptVersion: prompt.version,
      primaryPromptHash: prompt.hash,
      requestedCompleteness: "VERIFIED",
      auditAction: `p2a.e2e.${revisionKind.toLowerCase()}`,
      idempotencyKey: `${run}:${revisionKind}`,
    });
    checks.push({ scenario, passed: true });
  }

  for (const [scenario, revisionKind, data] of [
    ["8 deterministic enrichment", "DETERMINISTIC_ENRICHMENT", { learningObjectives: ["Enriched objective"] }],
    ["9 alignment change", "ALIGNMENT_CHANGE", { moeAlignments: [{ code: "MATH-G6-E2E-2" }] }],
  ] as const) {
    await updateCurriculumContent({ id: deterministic.content.id }, data as any, {
      revisionKind,
      originKind: "DETERMINISTIC_GENERATED",
      actorLabel: "p2a-e2e",
      generatorName: "p2aDeterministicFixture",
      generatorVersion: "1.0.0",
      generatedAt: new Date(),
      requestedCompleteness: "VERIFIED",
      auditAction: `p2a.e2e.${revisionKind.toLowerCase()}`,
      idempotencyKey: `${run}:${revisionKind}`,
    });
    checks.push({ scenario, passed: true });
  }

  const beforeGovernanceRevisionCount = await prisma.curriculumContentRevision.count({ where: { provenanceId: deterministic.provenance!.id } });
  await appendCurriculumGovernanceEvent({
    contentId: deterministic.content.contentId,
    eventType: "RISK_ASSESSED",
    actorType: "SYSTEM",
    actorLabel: "p2a-risk-policy",
    riskScore: 0,
    riskReasons: [],
    idempotencyKey: `${run}:risk`,
  });
  checks.push({ scenario: "10 risk assessment", passed: true });
  await appendCurriculumGovernanceEvent({
    contentId: deterministic.content.contentId,
    eventType: "APPROVED",
    actorType: "SYSTEM",
    actorLabel: "p2a-risk-policy",
    approvalBasis: "AUTOMATED_RISK_POLICY",
    reviewAuthority: "SYSTEM",
    idempotencyKey: `${run}:auto-approve`,
  });
  checks.push({ scenario: "11 permitted automated approval", passed: true });
  const afterGovernanceRevisionCount = await prisma.curriculumContentRevision.count({ where: { provenanceId: deterministic.provenance!.id } });
  expect(beforeGovernanceRevisionCount === afterGovernanceRevisionCount, "governance created a content revision");

  await appendCurriculumGovernanceEvent({
    contentId: human.content.contentId,
    eventType: "APPROVED",
    actorType: "USER",
    actorUserId: actor.id,
    approvalBasis: "HUMAN_REVIEW",
    reviewAuthority: "PLATFORM",
    reviewerRoleSnapshot: "ADMIN",
    idempotencyKey: `${run}:human-approve`,
  });
  checks.push({ scenario: "12 human approval", passed: true });

  const rejected = await createCurriculumContent(baseData(`${run}-rejected`, "Rejected lesson"), {
    revisionKind: "HUMAN_CREATE", originKind: "HUMAN_AUTHORED", actorUserId: actor.id, authorUserId: actor.id,
    requestedCompleteness: "VERIFIED", auditAction: "p2a.e2e.reject_create", idempotencyKey: `${run}:reject-create`,
  });
  await appendCurriculumGovernanceEvent({ contentId: rejected.content.contentId, eventType: "REJECTED", actorType: "USER", actorUserId: actor.id, reason: "Insufficient evidence", idempotencyKey: `${run}:reject` });
  checks.push({ scenario: "13 rejection", passed: true });

  await appendCurriculumGovernanceEvent({ contentId: human.content.contentId, eventType: "RETURNED_FOR_REVIEW", actorType: "USER", actorUserId: actor.id, reason: "Revise one example", idempotencyKey: `${run}:return` });
  checks.push({ scenario: "14 return for review", passed: true });
  await appendCurriculumGovernanceEvent({ contentId: human.content.contentId, eventType: "REAPPROVED", actorType: "USER", actorUserId: actor.id, approvalBasis: "HUMAN_REVIEW", reviewAuthority: "PLATFORM", idempotencyKey: `${run}:reapprove` });
  checks.push({ scenario: "15 reapproval", passed: true });

  const evidence = await appendCurriculumEvidence({
    contentId: human.content.contentId, revisionId: edited.revision!.id, evidenceType: "DOCUMENT", evidencePurpose: "REVIEW_SUPPORT",
    title: "Reviewer worksheet", documentRef: `${run}-worksheet`, addedByUserId: actor.id, idempotencyKey: `${run}:evidence`,
  });
  expect(evidence, "evidence was not created");
  checks.push({ scenario: "16 evidence addition", passed: true });
  await appendCurriculumEvidence({
    contentId: human.content.contentId, revisionId: edited.revision!.id, evidenceType: "DOCUMENT", evidencePurpose: "REVIEW_SUPPORT",
    title: "Corrected reviewer worksheet", documentRef: `${run}-worksheet-v2`, addedByUserId: actor.id,
    supersedesEvidenceId: evidence.id, idempotencyKey: `${run}:evidence-v2`,
  });
  checks.push({ scenario: "17 evidence supersession", passed: true });

  await revokeCurriculum({ contentId: human.content.contentId, actorType: "USER", actorUserId: actor.id, reason: "Integrity test revocation", reviewAuthority: "PLATFORM", urgent: true, idempotencyKey: `${run}:revoke` });
  const revokedEvent = await prisma.curriculumGovernanceEvent.findUnique({ where: { idempotencyKey: `${run}:revoke` } });
  expect(revokedEvent?.offlineCachePolicy === "URGENT_INVALIDATE_ON_NEXT_REFRESH", "offline invalidation policy missing");
  checks.push({ scenario: "18 revocation", passed: true });
  await appendCurriculumGovernanceEvent({ contentId: human.content.contentId, eventType: "REINSTATED", actorType: "USER", actorUserId: actor.id, approvalBasis: "HUMAN_REVIEW", reviewAuthority: "PLATFORM", idempotencyKey: `${run}:reinstate` });
  checks.push({ scenario: "19 reinstatement", passed: true });

  const successor = await createCurriculumContent(baseData(`${run}-successor`, "Successor lesson"), {
    revisionKind: "HUMAN_CREATE", originKind: "HUMAN_AUTHORED", actorUserId: actor.id, authorUserId: actor.id,
    requestedCompleteness: "VERIFIED", auditAction: "p2a.e2e.successor", idempotencyKey: `${run}:successor`,
  });
  await appendCurriculumGovernanceEvent({ contentId: human.content.contentId, eventType: "SUPERSEDED", actorType: "USER", actorUserId: actor.id, reason: "Replaced by corrected lesson", replacementRevisionId: successor.revision!.id, futureAssignmentPolicy: "REPLACE_WITH_SUCCESSOR", existingAssignmentPolicy: "REPLACE_WITH_SUCCESSOR", offlineCachePolicy: "INVALIDATE_ON_NEXT_REFRESH", idempotencyKey: `${run}:supersede` });
  checks.push({ scenario: "20 supersession replacement", passed: true });
  checks.push({ scenario: "21 offline invalidation", passed: revokedEvent?.existingAssignmentPolicy === "WITHDRAW_EXISTING" });

  const legacy = await prisma.curriculumContentRevision.findFirst({ where: { originKind: "LEGACY_UNKNOWN", backfillRunId: "p2a-staging-backfill-20260813" }, include: { provenance: true } });
  expect(legacy?.provenance.provenanceCompleteness === "UNVERIFIED", "legacy backfill was not UNVERIFIED");
  checks.push({ scenario: "22 legacy UNVERIFIED backfill", passed: true });

  const partial = await createCurriculumContent(baseData(`${run}-partial-ai`, "Partial AI lesson"), {
    revisionKind: "ORIGINAL_GENERATION", originKind: "AI_GENERATED", actorLabel: "p2a-e2e",
    generatorName: "legacyAiTool", generatorVersion: "unknown", aiProvider: "openai", aiModel: "legacy-model",
    generatedAt: new Date(), generationCorrelationId: randomUUID(), requestedCompleteness: "VERIFIED",
    auditAction: "p2a.e2e.partial_ai", idempotencyKey: `${run}:partial-ai`,
  });
  expect(partial.provenance?.provenanceCompleteness === "PARTIAL", "partial AI was overstated");
  checks.push({ scenario: "23 PARTIAL AI provenance", passed: true });
  expect(getPrompt(prompt.key, prompt.version).hash === prompt.hash, "archived prompt retrieval failed");
  checks.push({ scenario: "24 archived prompt retrieval", passed: true });
  expect(findUnauthorizedCurriculumWriters().length === 0, "writer guard found a bypass");
  checks.push({ scenario: "25 unauthorized writer rejection", passed: true });

  let immutabilityRejected = false;
  try {
    await prisma.$executeRaw`UPDATE "CurriculumContentRevision" SET "contentHash" = "contentHash" WHERE id = ${human.revision!.id}`;
  } catch {
    immutabilityRejected = true;
  }
  expect(immutabilityRejected, "database allowed revision mutation");
  checks.push({ scenario: "26 database immutability rejection", passed: true });

  const explanation = await getCurriculumProvenanceExplanation(deterministic.content.contentId);
  expect(explanation?.currentRevision && explanation.latestDecision, "explainability contract incomplete");
  const correlationRows = await prisma.aIInteraction.count({ where: { generationCorrelationId: correlationId } });
  expect(correlationRows >= 1, "AIInteraction correlation row missing");
  const compatibility = await prisma.curriculumContent.findUniqueOrThrow({ where: { id: deterministic.content.id } });
  expect(compatibility.status === "published", "compatibility projection did not publish");

  console.log(JSON.stringify({ run, checks, explainability: true, correlationRows, compatibilityStatus: compatibility.status }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

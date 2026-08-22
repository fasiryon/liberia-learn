import { createHash, randomUUID } from "crypto";
import type { Prisma, AIReviewSpecialty } from "@prisma/client";
import { prisma } from "@/lib/db";
import { routedCompletion } from "@/lib/ai/routedCompletion";
import { logAuditRequiredWithId } from "@/lib/audit";
import { ReviewOperationError } from "./errors";
import { REVIEW_SERIALIZABLE_TRANSACTION_OPTIONS } from "./transaction";
import {
  AI_REVIEW_DIMENSIONS,
  aiReviewDisagreementSignature,
  parseAIReviewResult,
  validateDeterministicAIReview,
  type WaecAlignmentContext,
} from "./aiEvidenceValidator";

export const AI_REVIEW_RUBRIC_KEY = "p2b.rubric.v1";
export const AI_REVIEW_POLICY_KEY = "p2b.ai-platform.v1";

const BASE_AGENTS: Array<{ agentKey: string; name: string; specialty: AIReviewSpecialty; promptKey: string; system: string }> = [
  { agentKey: "platform.ai.subject-sme.v1", name: "Platform AI Subject SME", specialty: "SUBJECT_MATTER", promptKey: "p2b.ai.subject-sme.v1", system: "You are an independent subject-matter curriculum reviewer. Focus on factual correctness, standards alignment, grade appropriateness, worked examples, answer keys, misconceptions, and terminology. Never claim MOE or WAEC approval." },
  { agentKey: "platform.ai.curriculum-sme.v1", name: "Platform AI Curriculum SME", specialty: "PEDAGOGY", promptKey: "p2b.ai.curriculum-sme.v1", system: "You are an independent curriculum and instruction reviewer. Focus on instructional quality, explanations, age appropriateness, assessment alignment, localization, accessibility, clarity, and learner experience. Never claim MOE or WAEC approval." },
  { agentKey: "platform.ai.adjudicator.v1", name: "Platform AI Review Adjudicator", specialty: "FACT_CHECK", promptKey: "p2b.ai.adjudicator.v1", system: "You are an independent adjudicator. Compare two immutable AI review assessments, analyze disagreements using the evidence and rubric, and issue a cautious platform recommendation. Never claim MOE or WAEC approval." },
  { agentKey: "platform.ai.waec-alignment-sme.v1", name: "Platform AI WAEC Baseline Alignment SME", specialty: "WAEC_ALIGNMENT", promptKey: "p2b.ai.waec-alignment-sme.v1", system: "You are an independent WAEC baseline alignment reviewer. Liberia MOE remains the curriculum authority; WAEC is only a minimum external assessment baseline that LiberiaLearn content must meet or exceed, never a ceiling. Focus the standards_alignment and assessment_alignment dimensions on whether this content covers the applicable WAEC baseline competency at sufficient depth, whether it is over-indexed on exam mechanics instead of broader mastery, and whether depth is at or above baseline. Cite evidence for every claim; if authoritative evidence is unavailable, say so and reduce confidence rather than relying on memory. Never claim WAEC approval, endorsement, licensing, or partnership; your output is AI_ASSESSED_ALIGNMENT only, never WAEC_APPROVED." },
];

function promptHash(system: string): string { return createHash("sha256").update(system, "utf8").digest("hex"); }

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function ensureAgent(agentKey: string, tx: Prisma.TransactionClient) {
  const definition = BASE_AGENTS.find((item) => item.agentKey === agentKey);
  if (!definition) throw new ReviewOperationError("AI_AGENT_NOT_FOUND", 404);
  const hash = promptHash(definition.system);
  return tx.aIReviewAgent.upsert({
    where: { agentKey },
    create: { agentKey, name: definition.name, specialty: definition.specialty, provider: "router", model: "configured-provider", promptKey: definition.promptKey, promptVersion: "1.0.0", promptHash: hash, policyKey: AI_REVIEW_POLICY_KEY, policyVersion: 1, rubricKey: AI_REVIEW_RUBRIC_KEY, rubricVersion: 1, minimumConfidence: 70, enabled: false },
    update: {},
  });
}

export async function provisionAIReviewAgents({ enable = false } = {}) {
  return prisma.$transaction(async (tx) => {
    const results = [];
    for (const definition of BASE_AGENTS) {
      const agent = await ensureAgent(definition.agentKey, tx);
      results.push(enable && !agent.enabled ? await tx.aIReviewAgent.update({ where: { id: agent.id }, data: { enabled: true } }) : agent);
    }
    return results;
  });
}

async function runAgent(taskId: string, agentKey: string, correlationId: string, priorAssessments?: unknown[]) {
  const agent = await prisma.aIReviewAgent.findUnique({ where: { agentKey } });
  const definition = BASE_AGENTS.find((item) => item.agentKey === agentKey);
  if (!agent || !definition || !agent.enabled) throw new ReviewOperationError("AI_AGENT_DISABLED", 503);
  const task = await prisma.curriculumReviewTask.findUnique({ where: { id: taskId }, include: { provenance: true, revision: { include: { evidence: true } } } });
  if (!task) throw new ReviewOperationError("TASK_NOT_FOUND", 404);
  if (task.provenance.currentRevisionId !== task.revisionId) throw new ReviewOperationError("REVISION_STALE", 409);
  const evidence = task.revision.evidence.map((item) => ({ id: item.id, title: item.title, citation: item.citation, uri: item.uri, status: item.status }));
  const specialistRequirements = (task.specialistRequirements as {
    waecAlignmentContext?: WaecAlignmentContext;
  } | null) ?? {};
  const completion = await routedCompletion({ forceSmartTier: true, responseFormat: "json", maxTokens: 1800, messages: [{ role: "system", content: `${definition.system}\nReturn JSON only with recommendation, confidence (0-100), rationale, and every dimension keyed by ${AI_REVIEW_DIMENSIONS.join(", ")}. Each dimension status must be PASS, CONCERN, FAIL, or NOT_APPLICABLE with a non-empty severity, rationale, and evidenceRefs array containing only supplied evidence IDs. If evidence is unavailable, ESCALATE. ${definition.specialty === "WAEC_ALIGNMENT" ? "Also return waecAlignment matching the P2-C alignment contract; DIRECT and definite baseline depth require TOPIC_LEVEL WAEC evidence." : ""}` }, { role: "user", content: JSON.stringify({ exactRevisionId: task.revisionId, provenanceId: task.provenanceId, riskBand: task.priorityBand, riskReasons: task.riskReasons, rubric: AI_REVIEW_RUBRIC_KEY, lesson: task.revision.contentSnapshot, evidence, waecAlignmentContext: specialistRequirements.waecAlignmentContext ?? null, priorAssessments: priorAssessments ?? null }) }], aiUsage: { route: "curriculum.ai-review", feature: "curriculum", requestType: "p2b_ai_review", promptKey: definition.promptKey, promptVersion: agent.promptVersion, promptHash: agent.promptHash, generationCorrelationId: correlationId, metadata: { agentKey, actorType: "AI", reviewAuthority: "PLATFORM" } } });
  const parsed = parseAIReviewResult(completion.content);
  const deterministicValidation = validateDeterministicAIReview({
    parsed,
    availableEvidence: [
      ...evidence,
      ...(specialistRequirements.waecAlignmentContext?.evidence ?? []).map((item) => ({
        id: item.id,
        status: ["VERIFIED", "PARTIAL", "RIGHTS_LIMITED"].includes(item.verificationStatus) ? "ACTIVE" : item.verificationStatus,
      })),
    ],
    evidenceRequirements: task.evidenceRequirements as { required?: boolean; approvalBlocked?: boolean } | null,
    minimumConfidence: agent.minimumConfidence,
    specialty: agent.specialty,
    waecAlignmentContext: specialistRequirements.waecAlignmentContext ?? null,
  });
  if (parsed.recommendation === "APPROVE" && deterministicValidation.approvalBlocked) {
    parsed.recommendation = "ESCALATE";
  }
  const idempotencyKey = `p2b-ai:${taskId}:${agent.id}:${correlationId}`;
  return prisma.curriculumAIReviewAssessment.upsert({
    where: { idempotencyKey },
    create: { taskId, aiReviewAgentId: agent.id, status: "SUBMITTED", rubricKey: AI_REVIEW_RUBRIC_KEY, rubricVersion: 1, rubricResponses: parsed.dimensions as Prisma.InputJsonValue, recommendation: parsed.recommendation, rationale: parsed.rationale, evidenceRefs: deterministicValidation.citedEvidenceRefs as Prisma.InputJsonValue, confidence: parsed.confidence, reviewCorrelationId: correlationId, idempotencyKey, aiReviewSnapshot: { schemaVersion: 2, agentId: agent.id, agentKey: agent.agentKey, provider: completion.model === "configured-provider" ? agent.provider : "router", model: completion.model, specialty: agent.specialty, promptKey: agent.promptKey, promptVersion: agent.promptVersion, promptHash: agent.promptHash, policyKey: agent.policyKey, policyVersion: agent.policyVersion, rubricKey: agent.rubricKey, rubricVersion: agent.rubricVersion, revisionId: task.revisionId, provenanceId: task.provenanceId, correlationId, confidence: parsed.confidence, deterministicValidation: toPrismaJson(deterministicValidation), ...(deterministicValidation.validatedWaecAlignment ? { validatedWaecAlignment: toPrismaJson(deterministicValidation.validatedWaecAlignment) } : {}), submittedAt: new Date().toISOString() } },
    update: {},
  });
}

export async function runAIReviewTask(taskId: string, options: { correlationId?: string } = {}) {
  const correlationId = options.correlationId ?? randomUUID();
  const task = await prisma.curriculumReviewTask.findUniqueOrThrow({ where: { id: taskId } });
  if (task.priorityBand === "CRITICAL") throw new ReviewOperationError("CRITICAL_AI_APPROVAL_DISABLED", 409);
  const flags = (task.specialistRequirements as { policyInputs?: Record<string, boolean> } | null)?.policyInputs ?? {};
  const first = await runAgent(taskId, "platform.ai.subject-sme.v1", correlationId);
  const second = await runAgent(taskId, "platform.ai.curriculum-sme.v1", correlationId);
  const waec = flags.waecBaselineAlignment ? await runAgent(taskId, "platform.ai.waec-alignment-sme.v1", correlationId) : null;
  const independent = [first, second, ...(waec ? [waec] : [])];
  const disagreement = new Set(independent.map(aiReviewDisagreementSignature)).size > 1;
  let adjudicator = null;
  if (disagreement) adjudicator = await runAgent(taskId, "platform.ai.adjudicator.v1", correlationId, independent.map((item) => ({ recommendation: item.recommendation, confidence: item.confidence, rubricResponses: item.rubricResponses, rationale: item.rationale, snapshot: item.aiReviewSnapshot })));
  return finalizeAIReviewTask({ taskId, correlationId, assessmentIds: [...independent.map((item) => item.id), ...(adjudicator ? [adjudicator.id] : [])], adjudicatorId: adjudicator?.id ?? null });
}

export async function finalizeAIReviewTask(input: { taskId: string; correlationId: string; assessmentIds: string[]; adjudicatorId?: string | null }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "CurriculumReviewTask" WHERE "id" = ${input.taskId} FOR UPDATE`;
    const task = await tx.curriculumReviewTask.findUnique({ where: { id: input.taskId }, include: { provenance: { include: { curriculumContent: true } } } });
    if (!task || task.provenance.currentRevisionId !== task.revisionId) throw new ReviewOperationError("REVISION_STALE", 409);
    if (task.priorityBand === "CRITICAL") throw new ReviewOperationError("CRITICAL_AI_APPROVAL_DISABLED", 409);
    const assessments = await tx.curriculumAIReviewAssessment.findMany({ where: { id: { in: input.assessmentIds }, taskId: task.id, status: "SUBMITTED", reviewCorrelationId: input.correlationId }, include: { aiReviewAgent: true }, orderBy: { submittedAt: "asc" } });
    if (assessments.length < 2) throw new ReviewOperationError("AI_REVIEW_INCOMPLETE", 409);
    const policyFlags = (task.specialistRequirements as { policyInputs?: Record<string, boolean> } | null)?.policyInputs ?? {};
    const independent = assessments.filter((item) => item.aiReviewAgent.specialty !== "FACT_CHECK");
    const specialties = new Set(independent.map((item) => item.aiReviewAgent.specialty));
    if (!specialties.has("SUBJECT_MATTER") || !specialties.has("PEDAGOGY") || (policyFlags.waecBaselineAlignment && !specialties.has("WAEC_ALIGNMENT"))) {
      throw new ReviewOperationError("AI_REVIEW_INCOMPLETE", 409);
    }
    const validationBlocked = assessments.some((item) => {
      const snapshot = item.aiReviewSnapshot && typeof item.aiReviewSnapshot === "object" && !Array.isArray(item.aiReviewSnapshot)
        ? item.aiReviewSnapshot as Record<string, unknown>
        : {};
      const validation = snapshot.deterministicValidation && typeof snapshot.deterministicValidation === "object"
        ? snapshot.deterministicValidation as Record<string, unknown>
        : null;
      return !validation || validation.passed !== true;
    });
    const disagreement = new Set(independent.map(aiReviewDisagreementSignature)).size > 1;
    const deciding = input.adjudicatorId ? assessments.find((item) => item.id === input.adjudicatorId) : assessments[0];
    const evidencePolicy = (task.evidenceRequirements as { approvalBlocked?: boolean } | null) ?? {};
    const recommendation = deciding?.recommendation ?? "ESCALATE";
    const approvalBlocked = recommendation === "APPROVE" && evidencePolicy.approvalBlocked;
    const escalated =
      validationBlocked ||
      (disagreement && !input.adjudicatorId) ||
      !deciding?.recommendation ||
      deciding.recommendation === "ESCALATE" ||
      approvalBlocked;
    const auditLogId = await logAuditRequiredWithId({
      action: escalated
        ? "curriculum.review.ai.assist.escalated"
        : "curriculum.review.ai.assist.completed",
      resourceType: "curriculum",
      resourceId: task.provenance.curriculumContent.contentId,
      schoolId: task.schoolId,
      traceId: input.correlationId,
      details: {
        actorType: "AI",
        authority: "ADVISORY_ONLY",
        taskId: task.id,
        revisionId: task.revisionId,
        assessmentIds: input.assessmentIds,
        recommendation,
        validationBlocked,
        disagreement,
        approvalBlocked,
      },
    }, tx);
    return {
      status: escalated ? "AI_ASSIST_ESCALATED" as const : "AI_ASSIST_COMPLETE" as const,
      authority: "ADVISORY_ONLY" as const,
      recommendation,
      auditLogId,
      assessments,
    };
  }, REVIEW_SERIALIZABLE_TRANSACTION_OPTIONS);
}

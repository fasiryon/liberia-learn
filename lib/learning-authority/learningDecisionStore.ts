import { prisma } from "@/lib/db";
import { deterministicReleaseIdentity, type CurriculumOntologyRelease, validateOntologyRelease } from "@/lib/learning-authority/governedGrade4Math";
import { compatibilityRelease } from "@/lib/learning-authority/compatibilityRelease";
import { generateLearningCandidates, learnerStateRevision, resolveLearningDecision, type DecisionModel, type TeacherOverride,
  type LearningRecommendation, type LearningPolicyResolution, type LearningDecision } from "@/lib/learning-authority/learningOrchestrator";
import { readCanonicalStudentConceptState } from "@/lib/learning-state/masteryWriter";
import { CANONICAL_MASTERY_EVENT_SOURCE, CANONICAL_MASTERY_EVENT_TYPE } from "@/lib/learning-state/studentLearningModel";

async function decideLearningActionOnce(input: {
  schoolId: string;
  studentId: string;
  studentUserId: string;
  idempotencyKey: string;
  model?: DecisionModel;
  shadowModel?: DecisionModel;
  teacherOverride?: TeacherOverride;
  offline?: boolean;
  release?: CurriculumOntologyRelease;
}) {
  if (!input.idempotencyKey || input.idempotencyKey.length > 128) throw new Error("decision_idempotency_key_invalid");
  const release = input.release ?? compatibilityRelease();
  validateOntologyRelease(release);
  const membership = await prisma.student.findFirst({
    where: { id: input.studentId, userId: input.studentUserId, currentGrade: release.grade, user: { schoolId: input.schoolId } },
    select: { id: true },
  });
  if (!membership) throw new Error("student_release_membership_invalid");
  const asOf = new Date().toISOString();
  const identity = deterministicReleaseIdentity(release);
  const read = () => Promise.all(release.concepts.map((concept) =>
    readCanonicalStudentConceptState({ scope: {
      schoolId: input.schoolId, studentId: input.studentId, studentUserId: input.studentUserId,
      conceptId: concept.id, ontologyReleaseId: release.id,
      ontologyReleaseIdentity: identity,
    }, asOf })
  ));
  const states = await read();
  if (!input.teacherOverride) {
    const latestOverride = await prisma.learningEvent.findFirst({
      where: { eventType: "learning.policy_resolution.v1", source: "governed-learning-orchestrator",
        schoolId: input.schoolId, studentId: input.studentId, userId: input.studentUserId,
        actorRole: { in: ["TEACHER", "ADMIN"] } },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      select: { id: true, metadata: true, actorId: true, actorRole: true },
    });
    const resolution = (latestOverride?.metadata as { record?: LearningPolicyResolution } | null)?.record;
    if (resolution?.teacherOverride && resolution.teacherOverride.actorId === latestOverride?.actorId &&
      resolution.teacherOverride.role === latestOverride.actorRole &&
      resolution.id === latestOverride.id) {
      const decisionId = resolution.id.replace(/^resolution-/, "decision-");
      const linked = await prisma.learningEvent.findMany({
        where: { id: { in: [resolution.recommendationId, decisionId] }, schoolId: input.schoolId,
          studentId: input.studentId, userId: input.studentUserId },
        select: { id: true, eventType: true, metadata: true },
      });
      const recommendation = (linked.find((row) => row.id === resolution.recommendationId)?.metadata as { record?: LearningRecommendation } | null)?.record;
      const decision = (linked.find((row) => row.id === decisionId)?.metadata as { record?: LearningDecision } | null)?.record;
      if (recommendation?.learnerStateRevision === learnerStateRevision(states, release) &&
        recommendation.ontologyReleaseIdentity === identity &&
        decision?.ontologyReleaseId === release.id &&
        decision.ontologyReleaseIdentity === identity &&
        decision?.learnerStateRevision === recommendation.learnerStateRevision &&
        decision.resolutionId === resolution.id && decision.recommendationId === recommendation.id &&
        decision.action.id === resolution.selectedCandidateId &&
        generateLearningCandidates({ states, release }).some((candidate) => candidate.id === decision.action.id) &&
        learnerStateRevision(await read(), release) === recommendation.learnerStateRevision &&
        await prisma.learningEvent.count({ where: {
          eventType: CANONICAL_MASTERY_EVENT_TYPE, source: CANONICAL_MASTERY_EVENT_SOURCE,
          schoolId: input.schoolId, studentId: input.studentId, userId: input.studentUserId,
          metadata: { path: ["canonicalEvent", "scope", "ontologyReleaseIdentity"], equals: identity },
        } }) === states.reduce((sum, state) => sum + state.replay.eventCount, 0)) {
        return { recommendation, resolution, decision, duplicate: true };
      }
    }
  }
  const result = await resolveLearningDecision({ states, idempotencyKey: input.idempotencyKey,
    model: input.model, shadowModel: input.shadowModel, teacherOverride: input.teacherOverride,
    offline: input.offline, release, currentRevision: async () => learnerStateRevision(await read(), release) });
  const expectedEventCount = states.reduce((sum, state) => sum + state.replay.eventCount, 0);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.learningEvent.findMany({
      where: { id: { in: [result.recommendation.id, result.resolution.id, result.decision.id] } },
      select: { id: true, schoolId: true, studentId: true, userId: true, metadata: true, eventType: true },
    });
    if (existing.length) {
      if (existing.length !== 3 || existing.some((row) => row.schoolId !== input.schoolId ||
        row.studentId !== input.studentId || row.userId !== input.studentUserId)) throw new Error("decision_idempotency_collision");
      const stored = existing.map((row) => ({ ...row, record: (row.metadata as { record?: unknown } | null)?.record }));
      const recommendation = stored.find((row) => row.id === result.recommendation.id);
      const resolution = stored.find((row) => row.id === result.resolution.id);
      const decision = stored.find((row) => row.id === result.decision.id);
      if (recommendation?.eventType !== "learning.recommendation.v1" ||
        resolution?.eventType !== "learning.policy_resolution.v1" || decision?.eventType !== "learning.decision.v1" ||
        !recommendation.record || !resolution.record || !decision.record) throw new Error("decision_idempotency_collision");
      const storedResolution = resolution.record as typeof result.resolution;
      if (JSON.stringify(storedResolution.teacherOverride) !== JSON.stringify(input.teacherOverride ?? null) ||
        storedResolution.selectedCandidateId !== result.resolution.selectedCandidateId) throw new Error("decision_idempotency_collision");
      return { recommendation: recommendation.record as typeof result.recommendation,
        resolution: resolution.record as typeof result.resolution,
        decision: decision.record as typeof result.decision, duplicate: true };
    }
    const currentCount = await tx.learningEvent.count({ where: {
      eventType: CANONICAL_MASTERY_EVENT_TYPE, source: CANONICAL_MASTERY_EVENT_SOURCE,
      schoolId: input.schoolId, studentId: input.studentId, userId: input.studentUserId,
      metadata: { path: ["canonicalEvent", "scope", "ontologyReleaseIdentity"], equals: identity },
    } });
    if (currentCount !== expectedEventCount) throw new Error("learner_state_stale");
    const records = [
      { kind: "recommendation", value: result.recommendation },
      { kind: "policy_resolution", value: result.resolution },
      { kind: "decision", value: result.decision },
    ] as const;
    for (const record of records) {
      await tx.learningEvent.create({ data: {
        id: record.value.id, schoolId: input.schoolId, studentId: input.studentId, userId: input.studentUserId,
        actorType: record.kind === "policy_resolution" && input.teacherOverride ? "human" : "system",
        actorId: record.kind === "policy_resolution" && input.teacherOverride ? input.teacherOverride.actorId : "governed-learning-orchestrator",
        actorRole: record.kind === "policy_resolution" && input.teacherOverride ? input.teacherOverride.role : "SYSTEM",
        targetType: "learning_decision", targetId: result.decision.id,
        eventType: `learning.${record.kind}.v1`, source: "governed-learning-orchestrator",
        status: "accepted", subject: release.subject, grade: release.grade,
        curriculumVersion: release.version,
        calculationVersion: "learning-decision-policy/1.0.0",
        metadata: { record: record.value },
      } });
    }
    return { ...result, duplicate: false };
  }, { isolationLevel: "Serializable" });
}

export async function decideLearningAction(input: Parameters<typeof decideLearningActionOnce>[0]) {
  try {
    return await decideLearningActionOnce(input);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
    if (code !== "P2002" && code !== "P2034") throw error;
    // A competing request can commit the same decision between the read and
    // insert. One fresh read recovers its persisted triplet as a duplicate.
    return decideLearningActionOnce(input);
  }
}

/** Compatibility entry point for the previously published Grade 4 route. */
export const decideGrade4LearningAction = decideLearningAction;

import { generateKeyPairSync, randomUUID } from "crypto";
import { prisma } from "../lib/db";
import { appendCurriculumEvidence } from "../lib/curriculum/mutations/evidenceWriter";
import { appendCurriculumGovernanceEvent } from "../lib/curriculum/mutations/governanceWriter";
import { revokeCurriculum } from "../lib/curriculum/mutations/revocationWriter";
import { getCurriculumProvenanceExplanation } from "../lib/curriculum/provenance/reader";
import { signContentAvailability } from "../lib/content-availability-manifest.server";
import { verifyContentAvailabilityManifest } from "../lib/content-availability-manifest";

const PRODUCTION_PROJECT_REF = "bnphuinpvgpmebcsvmsp";
const STAGING_PROJECT_REF = "yonpfzjczoffhrgibxkz";

function assertProduction(): void {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (process.env.P2A_PRODUCTION_PROJECT_REF !== PRODUCTION_PROJECT_REF) {
    throw new Error("P2-A post-cutover STOP: explicit production project identity mismatch");
  }
  if (!databaseUrl.includes(PRODUCTION_PROJECT_REF) || databaseUrl.includes(STAGING_PROJECT_REF)) {
    throw new Error("P2-A post-cutover STOP: database URL is not positively production");
  }
  if (process.env.P2A_PROVENANCE_WRITERS_DISABLED?.trim().toLowerCase() !== "false") {
    throw new Error("P2-A post-cutover STOP: provenance writers are not enabled");
  }
}

async function latestFixture(kind: "deterministic" | "ai" | "teacher") {
  return prisma.curriculumContent.findFirstOrThrow({
    where: {
      contentId: { startsWith: "p2a-production-smoke-", endsWith: `-${kind}` },
      payload: { path: ["p2aProductionFixture"], equals: true },
    },
    orderBy: { createdAt: "desc" },
    include: {
      provenance: { include: { currentRevision: true } },
    },
  });
}

async function main() {
  assertProduction();
  const run = `p2a-production-post-cutover-${Date.now()}`;
  const [deterministic, ai, teacher] = await Promise.all([
    latestFixture("deterministic"),
    latestFixture("ai"),
    latestFixture("teacher"),
  ]);
  if (!deterministic.provenance?.currentRevision || !ai.provenance?.currentRevision || !teacher.provenance?.currentRevision) {
    throw new Error("P2-A post-cutover STOP: controlled fixture revision is missing");
  }

  const evidenceOne = await appendCurriculumEvidence({
    contentId: teacher.contentId,
    revisionId: teacher.provenance.currentRevision.id,
    evidenceType: "REVIEWER_NOTE",
    evidencePurpose: "REVIEW_SUPPORT",
    title: "P2-A production-safe review evidence",
    citation: "Controlled P2-A production cutover fixture review. No learner content is involved.",
    idempotencyKey: `${run}:evidence:1`,
  });
  if (!evidenceOne) throw new Error("P2-A post-cutover STOP: evidence writer returned no row");
  const evidenceTwo = await appendCurriculumEvidence({
    contentId: teacher.contentId,
    revisionId: teacher.provenance.currentRevision.id,
    evidenceType: "REVIEWER_NOTE",
    evidencePurpose: "REVIEW_SUPPORT",
    title: "P2-A production-safe corrected review evidence",
    citation: "Append-only correction for the controlled P2-A fixture.",
    supersedesEvidenceId: evidenceOne.id,
    idempotencyKey: `${run}:evidence:2`,
  });
  if (!evidenceTwo) throw new Error("P2-A post-cutover STOP: superseding evidence writer returned no row");

  await appendCurriculumGovernanceEvent({
    contentId: deterministic.contentId,
    revisionId: deterministic.provenance.currentRevision.id,
    eventType: "APPROVED",
    actorType: "SYSTEM",
    actorLabel: "p2a-production-safe-policy",
    approvalBasis: "AUTOMATED_RISK_POLICY",
    reviewAuthority: "SYSTEM",
    idempotencyKey: `${run}:deterministic:approved`,
  });
  const replacementRevocation = await revokeCurriculum({
    contentId: deterministic.contentId,
    revisionId: deterministic.provenance.currentRevision.id,
    actorType: "SYSTEM",
    actorLabel: "p2a-production-safe-policy",
    reviewAuthority: "SYSTEM",
    reason: "Controlled urgent replacement verification on an unassigned fixture",
    replacementRevisionId: ai.provenance.currentRevision.id,
    replaceWithSuccessor: true,
    urgent: true,
    idempotencyKey: `${run}:deterministic:revoked`,
  });

  await appendCurriculumGovernanceEvent({
    contentId: teacher.contentId,
    revisionId: teacher.provenance.currentRevision.id,
    eventType: "APPROVED",
    actorType: "SYSTEM",
    actorLabel: "p2a-production-safe-human-review",
    approvalBasis: "HUMAN_REVIEW",
    reviewAuthority: "PLATFORM",
    idempotencyKey: `${run}:teacher:approved`,
  });
  const defaultRevocation = await revokeCurriculum({
    contentId: teacher.contentId,
    revisionId: teacher.provenance.currentRevision.id,
    actorType: "SYSTEM",
    actorLabel: "p2a-production-safe-policy",
    reviewAuthority: "SYSTEM",
    reason: "Controlled default revocation verification on an unassigned fixture",
    idempotencyKey: `${run}:teacher:revoked`,
  });
  await appendCurriculumGovernanceEvent({
    contentId: teacher.contentId,
    revisionId: teacher.provenance.currentRevision.id,
    eventType: "REINSTATED",
    actorType: "SYSTEM",
    actorLabel: "p2a-production-safe-human-review",
    approvalBasis: "HUMAN_REVIEW",
    reviewAuthority: "PLATFORM",
    reason: "Controlled fixture reinstatement after revocation verification",
    idempotencyKey: `${run}:teacher:reinstated`,
  });

  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.CONTENT_MANIFEST_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.CONTENT_MANIFEST_KEY_ID = `p2a-safe-${randomUUID()}`;
  const revokedManifest = signContentAvailability({
    contentId: deterministic.contentId,
    version: null,
    revoked: true,
  });
  const manifestVerified = revokedManifest
    ? await verifyContentAvailabilityManifest(
        revokedManifest,
        publicKey.export({ type: "spki", format: "pem" }).toString(),
      )
    : false;

  let immutabilityRejected = false;
  try {
    await prisma.$executeRawUnsafe(
      'UPDATE "CurriculumContentRevision" SET "contentHash" = "contentHash" WHERE id = $1',
      teacher.provenance.currentRevision.id,
    );
  } catch {
    immutabilityRejected = true;
  }

  const [deterministicExplanation, teacherExplanation, evidenceState, assignmentReferences, integrity] = await Promise.all([
    getCurriculumProvenanceExplanation(deterministic.contentId),
    getCurriculumProvenanceExplanation(teacher.contentId),
    prisma.curriculumEvidence.findMany({
      where: { id: { in: [evidenceOne.id, evidenceTwo.id] } },
      select: { id: true, revisionId: true, supersedesEvidenceId: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.$queryRaw<Array<{ references: bigint }>>`
      SELECT (
        (SELECT count(*) FROM "ScheduledWork" WHERE "contentId" IN (${deterministic.contentId}, ${teacher.contentId})) +
        (SELECT count(*) FROM "Assignment" WHERE "contentId" IN (${deterministic.contentId}, ${teacher.contentId})) +
        (SELECT count(*) FROM "TeacherLessonAssignment" WHERE "contentId" IN (${deterministic.contentId}, ${teacher.contentId}))
      )::bigint AS references
    `,
    prisma.$queryRaw<Array<{
      roots: bigint;
      missing_pointers: bigint;
      duplicate_sequences: bigint;
      unaudited_events: bigint;
    }>>`
      SELECT
        (SELECT count(*) FROM "CurriculumProvenance")::bigint AS roots,
        (SELECT count(*) FROM "CurriculumProvenance" p LEFT JOIN "CurriculumContentRevision" r ON r.id = p."currentRevisionId" AND r."provenanceId" = p.id WHERE p."currentRevisionId" IS NULL OR r.id IS NULL)::bigint AS missing_pointers,
        (SELECT count(*) FROM (SELECT "provenanceId", sequence FROM "CurriculumContentRevision" GROUP BY 1, 2 HAVING count(*) > 1) d)::bigint AS duplicate_sequences,
        (SELECT count(*) FROM "CurriculumGovernanceEvent" WHERE "auditLogId" IS NULL)::bigint AS unaudited_events
    `,
  ]);

  const latestDeterministicDecision = deterministicExplanation?.latestDecision;
  const latestTeacherDecision = teacherExplanation?.latestDecision;
  const checks = {
    fixtureUnassigned: Number(assignmentReferences[0].references) === 0,
    evidenceRevisionSpecific: evidenceState.every((row) => row.revisionId === teacher.provenance!.currentRevision!.id),
    evidenceSupersession: evidenceState.length === 2 && evidenceState[1].supersedesEvidenceId === evidenceOne.id,
    replacementRevocation:
      replacementRevocation?.futureAssignmentPolicy === "REPLACE_WITH_SUCCESSOR" &&
      replacementRevocation.existingAssignmentPolicy === "REPLACE_WITH_SUCCESSOR" &&
      replacementRevocation.offlineCachePolicy === "URGENT_INVALIDATE_ON_NEXT_REFRESH" &&
      replacementRevocation.replacementRevisionId === ai.provenance.currentRevision.id,
    defaultRevocation:
      defaultRevocation?.futureAssignmentPolicy === "BLOCK_NEW" &&
      defaultRevocation.existingAssignmentPolicy === "WITHDRAW_EXISTING" &&
      defaultRevocation.offlineCachePolicy === "INVALIDATE_ON_NEXT_REFRESH",
    revokedReader:
      deterministicExplanation?.provenance?.lifecycleState === "REVOKED" &&
      latestDeterministicDecision?.eventType === "REVOKED",
    reinstatedReader:
      teacherExplanation?.provenance?.lifecycleState === "APPROVED" &&
      latestTeacherDecision?.eventType === "REINSTATED",
    exactCurrentRevision:
      teacherExplanation?.currentRevision?.id === teacher.provenance.currentRevision.id,
    explainability:
      Boolean(teacherExplanation?.provenance?.completenessReason) &&
      Array.isArray(teacherExplanation?.revisionHistory) &&
      teacherExplanation!.revisionHistory.length >= 2,
    signedOfflineInvalidation:
      Boolean(revokedManifest?.payload.revoked) && manifestVerified,
    immutableHistoryRejected: immutabilityRejected,
    rootsComplete: Number(integrity[0].roots) === 1105,
    pointersValid: Number(integrity[0].missing_pointers) === 0,
    sequencesUnique: Number(integrity[0].duplicate_sequences) === 0,
    governanceAudited: Number(integrity[0].unaudited_events) === 0,
  };
  if (Object.values(checks).some((passed) => !passed)) {
    throw new Error(`P2-A post-cutover STOP: ${JSON.stringify(checks)}`);
  }
  console.log(JSON.stringify({
    run,
    fixtureContentIds: [deterministic.contentId, ai.contentId, teacher.contentId],
    checks,
    policies: {
      replacement: {
        future: replacementRevocation?.futureAssignmentPolicy,
        existing: replacementRevocation?.existingAssignmentPolicy,
        offline: replacementRevocation?.offlineCachePolicy,
      },
      default: {
        future: defaultRevocation?.futureAssignmentPolicy,
        existing: defaultRevocation?.existingAssignmentPolicy,
        offline: defaultRevocation?.offlineCachePolicy,
      },
    },
    integrity: integrity[0],
  }, (_, value) => typeof value === "bigint" ? Number(value) : value, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

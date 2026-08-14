import { randomUUID } from "crypto";
import { prisma } from "../lib/db";
import { getPrompt } from "../lib/ai/promptRegistry";
import { logAIInteraction } from "../lib/ai/interactionLog";
import {
  createCurriculumContent,
  updateCurriculumContent,
} from "../lib/curriculum/mutations/repository";
import { appendCurriculumGovernanceEvent } from "../lib/curriculum/mutations/governanceWriter";

const PRODUCTION_PROJECT_REF = "bnphuinpvgpmebcsvmsp";
const STAGING_PROJECT_REF = "yonpfzjczoffhrgibxkz";

function assertProduction(): void {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (process.env.P2A_PRODUCTION_PROJECT_REF !== PRODUCTION_PROJECT_REF) {
    throw new Error("P2-A production smoke STOP: explicit production project identity mismatch");
  }
  if (!databaseUrl.includes(PRODUCTION_PROJECT_REF) || databaseUrl.includes(STAGING_PROJECT_REF)) {
    throw new Error("P2-A production smoke STOP: database URL is not positively production");
  }
  if (process.env.P2A_PROVENANCE_WRITERS_DISABLED?.trim().toLowerCase() !== "false") {
    throw new Error("P2-A production smoke STOP: provenance writers are not enabled");
  }
}

function fixture(contentId: string, title: string) {
  return {
    contentId,
    title,
    grade: 6,
    subject: "MATH",
    contentType: "lesson",
    status: "draft",
    version: "p2a-production-smoke-v1",
    payload: {
      title,
      body: `${title}: controlled production-safe verification fixture. It is not assigned to learners.`,
      objectives: ["Verify governed curriculum mutation behavior"],
      approvalStatus: "DRAFT",
      p2aProductionFixture: true,
    },
    moeAlignments: [{ code: "P2A-PRODUCTION-SMOKE" }],
  } as const;
}

async function main() {
  assertProduction();
  const run = `p2a-production-smoke-${Date.now()}`;
  const beforeCounts = await prisma.$queryRaw<
    Array<{ roots: bigint; revisions: bigint; events: bigint; audits: bigint }>
  >`
    SELECT
      (SELECT count(*) FROM "CurriculumProvenance")::bigint AS roots,
      (SELECT count(*) FROM "CurriculumContentRevision")::bigint AS revisions,
      (SELECT count(*) FROM "CurriculumGovernanceEvent")::bigint AS events,
      (SELECT count(*) FROM "AuditLog" WHERE action LIKE 'p2a.production.smoke.%')::bigint AS audits
  `;

  const deterministic = await createCurriculumContent(
    fixture(`${run}-deterministic`, "P2-A deterministic production smoke"),
    {
      revisionKind: "ORIGINAL_GENERATION",
      originKind: "DETERMINISTIC_GENERATED",
      actorLabel: "p2a-production-smoke",
      generatorName: "p2aProductionSmoke",
      generatorVersion: "1.0.0",
      generatedAt: new Date(),
      requestedCompleteness: "VERIFIED",
      auditAction: "p2a.production.smoke.deterministic",
      idempotencyKey: `${run}:deterministic`,
    },
  );

  const prompt = getPrompt("lesson.deep", "3.0.0");
  const correlationId = randomUUID();
  await logAIInteraction({
    route: "p2a.production.smoke",
    feature: "curriculum",
    model: "gpt-4o-mini",
    provider: "openai",
    promptKey: prompt.key,
    promptVersion: prompt.version,
    promptHash: prompt.hash,
    generationCorrelationId: correlationId,
    inputTokens: 0,
    outputTokens: 0,
    durable: true,
  });
  const ai = await createCurriculumContent(fixture(`${run}-ai`, "P2-A AI production smoke"), {
    revisionKind: "ORIGINAL_GENERATION",
    originKind: "AI_GENERATED",
    actorLabel: "p2a-production-smoke",
    generatorName: "p2aProductionSmoke",
    generatorVersion: "1.0.0",
    aiProvider: "openai",
    aiModel: "gpt-4o-mini",
    generatedAt: new Date(),
    generationCorrelationId: correlationId,
    primaryPromptKey: prompt.key,
    primaryPromptVersion: prompt.version,
    primaryPromptHash: prompt.hash,
    requestedCompleteness: "VERIFIED",
    auditAction: "p2a.production.smoke.ai",
    idempotencyKey: `${run}:ai`,
  });

  const teacher = await createCurriculumContent(
    { ...fixture(`${run}-teacher`, "P2-A teacher production smoke"), teacherCreated: true },
    {
      revisionKind: "HUMAN_CREATE",
      originKind: "HUMAN_AUTHORED",
      actorLabel: "p2a-production-smoke-teacher",
      requestedCompleteness: "VERIFIED",
      auditAction: "p2a.production.smoke.teacher_create",
      idempotencyKey: `${run}:teacher`,
    },
  );
  const edited = await updateCurriculumContent(
    { id: teacher.content.id },
    { title: "P2-A teacher production smoke edited" },
    {
      revisionKind: "HUMAN_EDIT",
      originKind: "HUMAN_AUTHORED",
      actorLabel: "p2a-production-smoke-teacher",
      requestedCompleteness: "VERIFIED",
      auditAction: "p2a.production.smoke.teacher_edit",
      idempotencyKey: `${run}:teacher-edit`,
    },
  );

  const revisionsBeforeGovernance = await prisma.curriculumContentRevision.count({
    where: { provenanceId: deterministic.provenance!.id },
  });
  const event = await appendCurriculumGovernanceEvent({
    contentId: deterministic.content.contentId,
    eventType: "RISK_ASSESSED",
    actorType: "SYSTEM",
    actorLabel: "p2a-production-smoke-policy",
    riskScore: 0,
    riskReasons: [],
    idempotencyKey: `${run}:risk`,
  });
  const revisionsAfterGovernance = await prisma.curriculumContentRevision.count({
    where: { provenanceId: deterministic.provenance!.id },
  });

  const afterCounts = await prisma.$queryRaw<
    Array<{ roots: bigint; revisions: bigint; events: bigint; audits: bigint }>
  >`
    SELECT
      (SELECT count(*) FROM "CurriculumProvenance")::bigint AS roots,
      (SELECT count(*) FROM "CurriculumContentRevision")::bigint AS revisions,
      (SELECT count(*) FROM "CurriculumGovernanceEvent")::bigint AS events,
      (SELECT count(*) FROM "AuditLog" WHERE action LIKE 'p2a.production.smoke.%')::bigint AS audits
  `;

  const checks = {
    deterministicRevision: deterministic.revision?.sequence === 1,
    deterministicRoot: deterministic.provenance?.currentRevisionId === deterministic.revision?.id,
    aiCorrelation: ai.revision?.generationCorrelationId === correlationId,
    teacherEditSequence: edited.revision?.sequence === 2,
    teacherPointerAdvanced: edited.provenance?.currentRevisionId === edited.revision?.id,
    governanceEvent: Boolean(event?.id),
    governanceDidNotCreateRevision: revisionsBeforeGovernance === revisionsAfterGovernance,
    compatibilityProjection: (await prisma.curriculumContent.findUniqueOrThrow({
      where: { id: edited.content.id },
    })).title === "P2-A teacher production smoke edited",
    auditGrowth: Number(afterCounts[0].audits) - Number(beforeCounts[0].audits) >= 4,
  };
  if (Object.values(checks).some((passed) => !passed)) {
    throw new Error(`P2-A production smoke STOP: ${JSON.stringify(checks)}`);
  }

  console.log(JSON.stringify({ run, checks, beforeCounts, afterCounts }, (_, value) =>
    typeof value === "bigint" ? Number(value) : value, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

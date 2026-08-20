import { compileTextbook } from "@/lib/ai/textbook/textbookCompiler";
import { provenanceWritersEnabled, upsertCurriculumContent } from "@/lib/curriculum/mutations/repository";
import { appendCurriculumGovernanceEvent } from "@/lib/curriculum/mutations/governanceWriter";

type TextbookJobPayload = {
  subject: string;
  gradeLevel: number;
  schoolId?: string;
  title?: string;
};

export async function handleGenerateTextbookJob(payload: TextbookJobPayload) {
  if (!payload?.subject || !payload?.gradeLevel) {
    throw new Error("subject and gradeLevel are required for GENERATE_TEXTBOOK");
  }

  const textbook = await compileTextbook(payload);
  const schoolScope = payload.schoolId ?? "national";
  const contentId = `textbook-${payload.subject.toLowerCase()}-g${payload.gradeLevel}-${schoolScope}`;

  const writersEnabled = provenanceWritersEnabled();
  const write = await upsertCurriculumContent(
    { contentId },
    {
      contentId,
      grade: payload.gradeLevel,
      subject: payload.subject.toUpperCase(),
      contentType: "textbook",
      status: writersEnabled ? "draft" : "published",
      version: new Date().toISOString().slice(0, 10),
      payload: textbook as any,
      schoolId: payload.schoolId ?? null,
    },
    {
      grade: payload.gradeLevel,
      subject: payload.subject.toUpperCase(),
      contentType: "textbook",
      status: writersEnabled ? "draft" : "published",
      version: new Date().toISOString().slice(0, 10),
      payload: textbook as any,
    },
    {
      revisionKind: "DETERMINISTIC_ENRICHMENT",
      originKind: "DETERMINISTIC_GENERATED",
      actorLabel: "textbook-compiler-worker",
      generatorName: "compileTextbook",
      generatorVersion: "1.0.0",
      requestedCompleteness: "VERIFIED",
      auditAction: "curriculum.revision.textbook_compiled",
      idempotencyKey: `textbook:${contentId}:${textbook.generatedAt.toISOString()}`,
      schoolId: payload.schoolId ?? null,
    },
  );
  if (writersEnabled) {
    await appendCurriculumGovernanceEvent({
      contentId,
      revisionId: write.revision?.id,
      eventType: "APPROVED",
      actorType: "SYSTEM",
      actorLabel: "textbook-approved-source-policy",
      approvalBasis: "ROLE_POLICY",
      reviewAuthority: "SYSTEM",
      idempotencyKey: `textbook-governance:${contentId}:${textbook.generatedAt.toISOString()}`,
      schoolId: payload.schoolId ?? null,
    });
  }
}

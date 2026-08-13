import {
  type CurriculumEvidence,
  type CurriculumEvidencePurpose,
  type CurriculumEvidenceStatus,
  type CurriculumEvidenceType,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAuditRequired } from "@/lib/audit";
import { provenanceWritersEnabled } from "@/lib/curriculum/mutations/repository";

export type EvidenceInput = {
  contentId: string;
  revisionId: string;
  evidenceType: CurriculumEvidenceType;
  evidencePurpose: CurriculumEvidencePurpose;
  title: string;
  uri?: string | null;
  documentRef?: string | null;
  citation?: string | null;
  publisher?: string | null;
  locator?: string | null;
  contentHash?: string | null;
  license?: string | null;
  addedByUserId?: string | null;
  status?: CurriculumEvidenceStatus;
  supersedesEvidenceId?: string | null;
  idempotencyKey?: string | null;
  backfillRunId?: string | null;
  schoolId?: string | null;
};

export async function appendCurriculumEvidence(
  input: EvidenceInput,
): Promise<CurriculumEvidence | null> {
  if (!provenanceWritersEnabled()) return null;
  if (!input.title.trim()) throw new Error("Evidence title is required");
  if (!input.uri && !input.documentRef && !input.citation) {
    throw new Error("Evidence requires a URI, document reference, or citation");
  }
  if (input.contentHash && !/^[a-f0-9]{64}$/.test(input.contentHash)) {
    throw new Error("Evidence contentHash must be lowercase SHA-256");
  }
  return prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const prior = await tx.curriculumEvidence.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (prior) return prior;
    }
    const revision = await tx.curriculumContentRevision.findUniqueOrThrow({
      where: { id: input.revisionId },
      include: { provenance: { include: { curriculumContent: true } } },
    });
    if (revision.provenance.curriculumContent.contentId !== input.contentId) {
      throw new Error("Evidence revision does not belong to the requested content");
    }
    if (input.supersedesEvidenceId) {
      const superseded = await tx.curriculumEvidence.findUniqueOrThrow({
        where: { id: input.supersedesEvidenceId },
      });
      if (superseded.revisionId !== input.revisionId) {
        throw new Error("Evidence can supersede only evidence on the same revision");
      }
    }
    const evidence = await tx.curriculumEvidence.create({
      data: {
        revisionId: input.revisionId,
        evidenceType: input.evidenceType,
        evidencePurpose: input.evidencePurpose,
        title: input.title.trim(),
        uri: input.uri ?? null,
        documentRef: input.documentRef ?? null,
        citation: input.citation ?? null,
        publisher: input.publisher ?? null,
        locator: input.locator ?? null,
        contentHash: input.contentHash ?? null,
        license: input.license ?? null,
        addedByUserId: input.addedByUserId ?? null,
        status: input.status ?? "ACTIVE",
        supersedesEvidenceId: input.supersedesEvidenceId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        backfillRunId: input.backfillRunId ?? null,
      },
    });
    if (
      input.evidencePurpose === "IMPORT_ORIGIN" &&
      revision.originKind === "IMPORTED" &&
      revision.generatorName &&
      revision.generatorVersion
    ) {
      await tx.curriculumProvenance.update({
        where: { id: revision.provenanceId },
        data: { provenanceCompleteness: "VERIFIED" },
      });
    }
    await logAuditRequired(
      {
        userId: input.addedByUserId ?? null,
        action: "curriculum.evidence.appended",
        resourceType: "curriculum",
        resourceId: revision.provenance.curriculumContent.contentId,
        schoolId: input.schoolId ?? revision.provenance.curriculumContent.schoolId ?? null,
        details: {
          evidenceId: evidence.id,
          revisionId: input.revisionId,
          evidenceType: input.evidenceType,
          evidencePurpose: input.evidencePurpose,
          status: input.status ?? "ACTIVE",
          supersedesEvidenceId: input.supersedesEvidenceId ?? null,
        },
      },
      tx,
    );
    return evidence;
  });
}

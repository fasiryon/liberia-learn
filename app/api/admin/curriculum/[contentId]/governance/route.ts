import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { appendCurriculumGovernanceEvent } from "@/lib/curriculum/mutations/governanceWriter";
import { revokeCurriculum } from "@/lib/curriculum/mutations/revocationWriter";
import { prisma } from "@/lib/db";
import { curriculumSchoolScopeWhere } from "@/lib/curriculum/review/tenantScope";
import { enforceLegacyReviewAdapter } from "@/lib/curriculum/review/legacyAdapter";

const GovernanceSchema = z.object({
  revisionId: z.string().min(1).optional(),
  eventType: z.enum([
    "SUBMITTED",
    "RISK_ASSESSED",
    "APPROVED",
    "REJECTED",
    "RETURNED_FOR_REVIEW",
    "REAPPROVED",
    "REVOKED",
    "REINSTATED",
    "SUPERSEDED",
  ]),
  approvalBasis: z
    .enum([
      "HUMAN_REVIEW",
      "AUTOMATED_RISK_POLICY",
      "ROLE_POLICY",
      "SCHOOL_POLICY",
      "IMPORT_POLICY",
      "LEGACY_UNKNOWN",
    ])
    .optional(),
  reason: z.string().trim().min(1).max(4000).optional(),
  riskScore: z.number().int().min(0).optional(),
  riskReasons: z.array(z.string().trim().min(1).max(300)).max(50).optional(),
  replacementRevisionId: z.string().min(1).optional(),
  urgent: z.boolean().optional(),
  replaceWithSuccessor: z.boolean().optional(),
  idempotencyKey: z.string().min(1).max(300),
});

export async function POST(
  req: Request,
  { params }: { params: { contentId: string } },
) {
  const user = await requireUser();
  assertPermission(user, PERMISSIONS.CURRICULUM_APPROVE);
  const body = GovernanceSchema.parse(await req.json());
  const scopedContent = await prisma.curriculumContent.findFirst({
    where: { contentId: params.contentId, ...curriculumSchoolScopeWhere(user) },
    select: { id: true },
  });
  if (!scopedContent) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (["APPROVED", "REJECTED", "RETURNED_FOR_REVIEW", "REAPPROVED", "REVOKED", "REINSTATED"].includes(body.eventType)) {
    await enforceLegacyReviewAdapter({
      contentId: params.contentId,
      user,
      requestedAction: body.eventType,
      idempotencyKey: body.idempotencyKey,
    });
  }
  const reviewAuthority =
    user.role === "MOE_OFFICIAL" || user.role === "MOE_SUPER_ADMIN"
      ? ("MOE" as const)
      : user.isPlatformAdmin
        ? ("PLATFORM" as const)
        : ("SCHOOL" as const);
  const event =
    body.eventType === "REVOKED"
      ? await revokeCurriculum({
          contentId: params.contentId,
          revisionId: body.revisionId,
          actorType: "USER",
          actorUserId: user.id,
          reason: body.reason,
          replacementRevisionId: body.replacementRevisionId,
          reviewAuthority,
          urgent: body.urgent,
          replaceWithSuccessor: body.replaceWithSuccessor,
          schoolId: user.schoolId ?? null,
          idempotencyKey: body.idempotencyKey,
        })
      : await appendCurriculumGovernanceEvent({
          contentId: params.contentId,
          revisionId: body.revisionId,
          eventType: body.eventType,
          actorType: "USER",
          actorUserId: user.id,
          approvalBasis: body.approvalBasis,
          reviewAuthority,
          reviewerRoleSnapshot: user.role,
          reason: body.reason,
          riskScore: body.riskScore,
          riskReasons: body.riskReasons,
          replacementRevisionId: body.replacementRevisionId,
          schoolId: user.schoolId ?? null,
          idempotencyKey: body.idempotencyKey,
        });
  return NextResponse.json({ contentId: params.contentId, event });
}

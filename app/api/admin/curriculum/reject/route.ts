import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { appendCurriculumGovernanceEvent } from "@/lib/curriculum/mutations/governanceWriter";
import { isCurriculumFeedbackEnabled } from "@/lib/serverFlags";
import { deleteCurriculumContentRagChunks } from "@/lib/ai/rag/ragIngestionService";
import { Redis } from "@upstash/redis";
import { COVERAGE_CACHE_KEY } from "@/app/api/admin/curriculum/coverage/route";
import { assertCurriculumSchoolScope } from "@/lib/curriculum/review/tenantScope";
import { enforceLegacyReviewAdapter } from "@/lib/curriculum/review/legacyAdapter";

let redis: Redis | null = null;
try { redis = Redis.fromEnv(); } catch { /* Redis not configured */ }

const RequestSchema = z.object({
  contentId: z.string().min(1),
  rejectionReason: z.string().trim().min(1).max(500).optional(),
});

/**
 * POST /api/admin/curriculum/reject
 * Body: { contentId: string, rejectionReason?: string }
 * Sets status to "rejected" and records structured telemetry.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user, PERMISSIONS.CURRICULUM_APPROVE);

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { contentId, rejectionReason } = parsed.data;

    const record = await prisma.curriculumContent.findUnique({
      where: { contentId },
      include: { editedBy: { select: { schoolId: true } } },
    });
    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (Object.prototype.hasOwnProperty.call(record, "schoolId")) assertCurriculumSchoolScope(user, record);
    await enforceLegacyReviewAdapter({
      contentId,
      user,
      requestedAction: "REJECT",
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : `reject:${contentId}`,
    });

    const payload = (record.payload as any) ?? {};
    const rejectedAt = new Date();
    await appendCurriculumGovernanceEvent({
      contentId,
      eventType: "REJECTED",
      actorType: "USER",
      actorUserId: user.id,
      reason: rejectionReason,
      reviewAuthority:
        user.role === "MOE_OFFICIAL" || user.role === "MOE_SUPER_ADMIN"
          ? "MOE"
          : user.isPlatformAdmin
            ? "PLATFORM"
            : "SCHOOL",
      reviewerRoleSnapshot: user.role,
      reviewerQualificationRef: `permission:${PERMISSIONS.CURRICULUM_APPROVE}:${user.id}`,
      reviewerQualificationSnapshot: {
        schemaVersion: 1,
        basis: "ROLE_PERMISSION",
        userId: user.id,
        role: user.role,
        permission: PERMISSIONS.CURRICULUM_APPROVE,
        platformAdmin: Boolean(user.isPlatformAdmin),
      },
      schoolId: user.schoolId ?? null,
      idempotencyKey:
        typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
      compatibility: {
        projection: {
          status: "rejected",
          payload: {
            ...payload,
            approvalStatus: "REJECTED",
            rejectedByUserId: user.id,
            rejectedAt: rejectedAt.toISOString(),
          },
        },
        auditAction: "curriculum.reject",
        auditDetails: { hasRejectionReason: Boolean(rejectionReason) },
      },
    });

    try {
      await deleteCurriculumContentRagChunks(record.id);
    } catch (cleanupError) {
      console.error(
        "[RAG] Best-effort curriculum rejection cleanup failed",
        cleanupError
      );
    }

    if (isCurriculumFeedbackEnabled()) {
      try {
        const generationMethod =
          (payload as any)?.type === "full_pack" ? "deterministic" : "AI";
        await prisma.curriculumFeedback.create({
          data: {
            curriculumId: contentId,
            action: "rejected",
            rejectionReason: rejectionReason ?? null,
            grade: record.grade,
            subject: record.subject,
            generationMethod,
          },
        });
      } catch (telemetryError) {
        console.error(
          "[TELEMETRY] Best-effort curriculum rejection feedback failed",
          telemetryError
        );
      }
    }

    // Invalidate coverage cache — rejection moves content out of the approved pool
    if (redis) redis.del(COVERAGE_CACHE_KEY).catch(() => null);

    return NextResponse.json({ ok: true, contentId, status: "rejected" });
  } catch (err: any) {
    console.error("Curriculum reject error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to reject" },
      { status: err?.status ?? 500 }
    );
  }
}

// route-policy: auth=session; scope=tenant; authority=curriculum-approve; rationale=requires curriculum approval permission before governed publication and embedding deferral
import { deferLessonEmbedding } from "@/lib/ai/rag/embeddingDeferral";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { appendCurriculumGovernanceEvent } from "@/lib/curriculum/mutations/governanceWriter";
import { isCurriculumFeedbackEnabled } from "@/lib/serverFlags";
import { enqueueJob, isQueueConfigured, JobType } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { Redis } from "@upstash/redis";
import { COVERAGE_CACHE_KEY } from "@/app/api/admin/curriculum/coverage/route";
import { assertCurriculumSchoolScope } from "@/lib/curriculum/review/tenantScope";
import { enforceLegacyReviewAdapter } from "@/lib/curriculum/review/legacyAdapter";

let redis: Redis | null = null;
try { redis = Redis.fromEnv(); } catch { /* Redis not configured */ }

/**
 * POST /api/admin/curriculum/approve
 * Body: { contentId: string }
 * Sets status to "published" and adds approval metadata in payload.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user, PERMISSIONS.CURRICULUM_APPROVE);

    const body = await req.json();
    const { contentId } = body;
    if (!contentId || typeof contentId !== "string") {
      return NextResponse.json(
        { error: "contentId required" },
        { status: 400 }
      );
    }

    const record = await prisma.curriculumContent.findUnique({
      where: { contentId },
      include: { provenance: { select: { lifecycleState: true } }, editedBy: { select: { schoolId: true } } },
    });
    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (Object.prototype.hasOwnProperty.call(record, "schoolId")) assertCurriculumSchoolScope(user, record);
    await enforceLegacyReviewAdapter({
      contentId,
      user,
      requestedAction: "APPROVE",
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : `approve:${contentId}`,
    });

    const payload = (record.payload as any) ?? {};
    const approvedAt = new Date();
    await appendCurriculumGovernanceEvent({
      contentId,
      eventType:
        record.provenance?.lifecycleState === "REJECTED" ? "REAPPROVED" : "APPROVED",
      actorType: "USER",
      actorUserId: user.id,
      approvalBasis: "HUMAN_REVIEW",
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
          status: "published",
          payload: {
            ...payload,
            approvalStatus: "APPROVED",
            approvedByUserId: user.id,
            approvedAt: approvedAt.toISOString(),
          },
        },
        auditAction: "curriculum.approve",
      },
    });

    if (isQueueConfigured()) {
        try {
          const accepted = await enqueueJob(JobType.GENERATE_EMBEDDINGS, {
            lessonId: record.id,
            contentId: record.contentId,
          });
          // A rejected send is deferred (no inline paid embedding).
          if (!accepted) throw new Error("Queue did not accept the embedding job");
      } catch {
        // Founder DEFER 2026-11-13: no paid inline embedding while the queue is unavailable.
        await deferLessonEmbedding({
          lessonId: record.id,
          contentId: record.contentId,
          actorUserId: user.id,
          schoolId: user.schoolId ?? null,
          source: "admin.curriculum.approve",
          removeStaleChunks: true,
        });
      }
    } else {
      // Founder DEFER 2026-11-13 / Atlas R3 P2-1: no queue configured is not a licence for inline paid embedding.
      await deferLessonEmbedding({
        lessonId: record.id,
        contentId: record.contentId,
        actorUserId: user.id,
        schoolId: user.schoolId ?? null,
        source: "admin.curriculum.approve",
        reason: "QUEUE_NOT_CONFIGURED",
        removeStaleChunks: true,
      });
    }

    if (isCurriculumFeedbackEnabled()) {
      try {
        const generationMethod =
          (payload as any)?.type === "full_pack" ? "deterministic" : "AI";
        await prisma.curriculumFeedback.create({
          data: {
            curriculumId: contentId,
            action: "approved",
            grade: record.grade,
            subject: record.subject,
            generationMethod,
          },
        });
      } catch (telemetryError) {
        logger.warn("[TELEMETRY] Best-effort curriculum approval feedback failed", { error: telemetryError });
      }
    }

    // Invalidate coverage cache so the next matrix request reflects the newly approved lesson
    if (redis) redis.del(COVERAGE_CACHE_KEY).catch(() => null);

    return NextResponse.json({ ok: true, contentId, status: "published" });
  } catch (err: any) {
    logger.error("Curriculum approve error", {
      route: "/api/admin/curriculum/approve",
      error: err,
      status: err?.status ?? 500,
    });
    return NextResponse.json(
      { error: err?.message ?? "Failed to approve" },
      { status: err?.status ?? 500 }
    );
  }
}

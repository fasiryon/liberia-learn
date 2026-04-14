import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isCurriculumFeedbackEnabled } from "@/lib/serverFlags";
import { embedLesson } from "@/lib/ai/rag/embeddingService";
import { syncCurriculumContentRagChunks } from "@/lib/ai/rag/ragIngestionService";
import { enqueueJob, isQueueConfigured, JobType } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { validateCurriculumApproval } from "@/lib/policy/policyEngine";

/**
 * POST /api/admin/curriculum/approve
 * Body: { contentId: string }
 * Sets status to "published" and adds approval metadata in payload.
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");

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
    });
    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const schoolModel = (prisma as typeof prisma & {
      school?: { findUnique?: (args: unknown) => Promise<{ districtId?: string | null } | null> };
    }).school;
    const school = user.schoolId && schoolModel?.findUnique
      ? await schoolModel.findUnique({
          where: { id: user.schoolId },
          select: { districtId: true },
        })
      : null;
    await validateCurriculumApproval({
      schoolId: user.schoolId ?? null,
      districtId: school?.districtId ?? null,
      nextStatus: "published",
    });

    const payload = (record.payload as any) ?? {};
    const updatedPayload = {
      ...payload,
      approvalStatus: "APPROVED",
      approvedByUserId: user.id,
      approvedAt: new Date().toISOString(),
    };

    await prisma.curriculumContent.update({
      where: { contentId },
      data: {
        status: "published",
        payload: updatedPayload,
      },
    });

    await logAudit({
      userId: user.id,
      action: "curriculum.approve",
      resourceType: "curriculum",
      resourceId: contentId,
      schoolId: user.schoolId ?? undefined,
    });

    if (isQueueConfigured()) {
        try {
          await enqueueJob(JobType.GENERATE_EMBEDDINGS, {
            lessonId: record.id,
            contentId: record.contentId,
          });
      } catch (queueError) {
        logger.warn("[QUEUE] Falling back to inline embedding generation", { error: queueError });

        try {
          await syncCurriculumContentRagChunks(record.id);
        } catch (syncError) {
          logger.warn("[RAG] Best-effort approval chunk sync failed", { error: syncError });
        }

        try {
          await embedLesson(record.id);
        } catch (embeddingError) {
          logger.warn("[RAG] Best-effort approval embedding failed", { error: embeddingError });
        }
      }
    } else {
      try {
        await syncCurriculumContentRagChunks(record.id);
      } catch (syncError) {
        logger.warn("[RAG] Best-effort approval chunk sync failed", { error: syncError });
      }

      try {
        await embedLesson(record.id);
      } catch (embeddingError) {
        logger.warn("[RAG] Best-effort approval embedding failed", { error: embeddingError });
      }
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

    return NextResponse.json({ ok: true, contentId, status: "published" });
  } catch (err: any) {
    logger.error("Curriculum approve error", {
      route: "/api/admin/curriculum/approve",
      error: err,
      status: err?.status ?? 500,
    });
    return handleApiError(err, { route: "/api/admin/curriculum/approve", method: "POST" });
  }
}

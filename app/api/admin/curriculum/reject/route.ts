import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isCurriculumFeedbackEnabled } from "@/lib/serverFlags";
import { deleteCurriculumContentRagChunks } from "@/lib/ai/rag/ragIngestionService";
import { Redis } from "@upstash/redis";
import { COVERAGE_CACHE_KEY } from "@/app/api/admin/curriculum/coverage/route";

let redis: Redis | null = null;
try { redis = Redis.fromEnv(); } catch { /* Redis not configured */ }

const RequestSchema = z.object({
  contentId: z.string().min(1),
  rejectionReason: z.string().max(500).optional(),
});

/**
 * POST /api/admin/curriculum/reject
 * Body: { contentId: string, rejectionReason?: string }
 * Sets status to "rejected" and records structured telemetry.
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
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
    });
    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payload = (record.payload as any) ?? {};
    const updatedPayload = {
      ...payload,
      approvalStatus: "REJECTED",
      rejectedByUserId: user.id,
      rejectedAt: new Date().toISOString(),
    };

    await prisma.curriculumContent.update({
      where: { contentId },
      data: {
        status: "rejected",
        payload: updatedPayload,
      },
    });

    await logAudit({
      userId: user.id,
      action: "curriculum.reject",
      resourceType: "curriculum",
      resourceId: contentId,
      details: { hasRejectionReason: !!rejectionReason },
      schoolId: user.schoolId ?? undefined,
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

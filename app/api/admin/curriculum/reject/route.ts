import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isCurriculumFeedbackEnabled } from "@/lib/serverFlags";

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
    const user = await requireRole("ADMIN", "TEACHER");

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

    // Update payload with rejection info
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
    });

    // Telemetry — never crashes the response
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
      } catch {
        // intentional no-op: telemetry must not crash rejection
      }
    }

    return NextResponse.json({ ok: true, contentId, status: "rejected" });
  } catch (err: any) {
    console.error("Curriculum reject error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to reject" },
      { status: err?.status ?? 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isCurriculumFeedbackEnabled } from "@/lib/serverFlags";

/**
 * POST /api/admin/curriculum/approve
 * Body: { contentId: string }
 * Sets status to "published" and adds approval metadata in payload.
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN", "TEACHER");

    const body = await req.json();
    const { contentId } = body;
    if (!contentId || typeof contentId !== "string") {
      return NextResponse.json({ error: "contentId required" }, { status: 400 });
    }

    const record = await prisma.curriculumContent.findUnique({
      where: { contentId },
    });
    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Update payload with approval info
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

    // Telemetry — never crashes the response
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
      } catch {
        // intentional no-op: telemetry must not crash approval
      }
    }

    return NextResponse.json({ ok: true, contentId, status: "published" });
  } catch (err: any) {
    console.error("Curriculum approve error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to approve" },
      { status: err?.status ?? 500 }
    );
  }
}

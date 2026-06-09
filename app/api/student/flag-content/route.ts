import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

const BodySchema = z.object({
  contentId: z.string().min(1),
  reason: z.enum(["inappropriate_content", "factually_wrong", "other"]),
  note: z.string().max(500).optional(),
});

const FLAG_THRESHOLD = 3;

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("STUDENT");
    const body = BodySchema.parse(await req.json());

    // Dedup: same student can't flag same lesson twice
    const existing = await prisma.lessonHelpFlag.findUnique({
      where: { studentId_contentId: { studentId: user.id, contentId: body.contentId } },
    });
    if (existing) return NextResponse.json({ ok: true, duplicate: true });

    await prisma.lessonHelpFlag.create({
      data: {
        id: randomUUID(),
        studentId: user.id,
        contentId: body.contentId,
        note: body.note ?? null,
        flagType: body.reason,
        resolved: false,
      },
    });

    // Check threshold for principal notification
    const unresolvedCount = await prisma.lessonHelpFlag.count({
      where: { contentId: body.contentId, resolved: false },
    });

    if (unresolvedCount >= FLAG_THRESHOLD) {
      const content = await prisma.curriculumContent.findUnique({
        where: { contentId: body.contentId },
        select: { schoolId: true, title: true },
      });
      if (content?.schoolId) {
        const principal = await prisma.user.findFirst({
          where: { role: "ADMIN", schoolId: content.schoolId },
          select: { id: true },
        });
        if (principal) {
          await prisma.notificationInboxItem.create({
            data: {
              userId: principal.id,
              title: "Lesson flagged for review",
              body: `"${content.title ?? "A lesson"}" has received ${unresolvedCount} flags. Please review in the moderation queue.`,
              url: "/admin/content-review",
            },
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, { route: "/api/student/flag-content", method: "POST", requestId: "flag" });
  }
}

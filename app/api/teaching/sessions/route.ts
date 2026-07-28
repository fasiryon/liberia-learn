import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { determineAlignmentMode } from "@/lib/teaching/alignment";
import {
  getLessonNarration,
  getLessonSlides,
} from "@/lib/teaching/lessonContent";

const StartSessionSchema = z.object({
  contentId: z.string().trim().min(1).max(200),
});

const APPROVED_CONTENT_STATUSES = ["APPROVED", "approved", "published"];

export async function POST(req: Request) {
  const user = await requireRole("TEACHER", "ADMIN");
  if (!user.schoolId) {
    return NextResponse.json(
      { error: "A school-scoped account is required" },
      { status: 403 }
    );
  }

  const parsed = StartSessionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const content = await prisma.curriculumContent.findFirst({
    where: {
      contentId: parsed.data.contentId,
      status: { in: APPROVED_CONTENT_STATUSES },
      OR: [{ schoolId: null }, { schoolId: user.schoolId }],
    },
  });
  if (!content) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const alignmentMode = determineAlignmentMode(content.moeAlignments);
  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.teachingSession.create({
      data: {
        contentId: content.contentId,
        facilitatorId: user.id,
        schoolId: user.schoolId!,
        grade: String(content.grade),
        subject: content.subject,
        alignmentMode,
        status: "ACTIVE",
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "teaching.session.start",
        resourceId: created.id,
        resourceType: "TeachingSession",
        schoolId: user.schoolId,
        details: {
          contentId: content.contentId,
          alignmentMode,
        },
      },
    });

    return created;
  });

  return NextResponse.json({
    sessionId: session.id,
    alignmentMode,
    narration: getLessonNarration(content.payload),
    slides: getLessonSlides(content.payload),
  });
}

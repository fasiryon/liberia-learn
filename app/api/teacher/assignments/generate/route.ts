import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAiAssignmentGenerationEnabled } from "@/lib/serverFlags";
import { generateAssessmentItems } from "@/lib/curriculum-helpers";

export const dynamic = "force-dynamic";

/**
 * POST /api/teacher/assignments/generate
 * Part 5 (Pathway C): AI-generate a draft assignment from a lesson.
 * Returns a DRAFT — does NOT save to DB. Teacher must POST to the assignment create route.
 * Body: { scheduledWorkId?, contentId?, classId, assignmentType }
 */
export async function POST(req: NextRequest) {
  if (!isAiAssignmentGenerationEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("TEACHER", "ADMIN");

    const body = await req.json();
    const { scheduledWorkId, contentId: bodyContentId, classId, assignmentType } = body;

    if (!classId || !assignmentType) {
      return NextResponse.json(
        { error: "classId and assignmentType are required" },
        { status: 400 }
      );
    }

    const validTypes = ["classwork", "homework", "quiz"];
    if (!validTypes.includes(assignmentType)) {
      return NextResponse.json(
        { error: `assignmentType must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify class belongs to teacher's school
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
    if (!cls || cls.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Resolve contentId
    let resolvedContentId = bodyContentId;
    let resolvedScheduledWorkId = scheduledWorkId;

    if (!resolvedContentId && scheduledWorkId) {
      const sw = await prisma.scheduledWork.findUnique({
        where: { id: scheduledWorkId },
        include: { class: { select: { schoolId: true } } },
      });
      if (!sw || sw.class.schoolId !== user.schoolId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      resolvedContentId = sw.contentId;
      resolvedScheduledWorkId = sw.id;
    }

    if (!resolvedContentId) {
      return NextResponse.json(
        { error: "scheduledWorkId or contentId required" },
        { status: 400 }
      );
    }

    const content = await prisma.curriculumContent.findUnique({
      where: { contentId: resolvedContentId },
      select: { grade: true, subject: true, moeAlignments: true, payload: true },
    });

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const alignments = content.moeAlignments as Array<{ code: string }> | null;
    const moeAlignmentCodes = alignments ? alignments.map((a) => a.code).filter(Boolean) : [];
    const topic = (content.payload as any)?.title ?? "Lesson";

    const questions = generateAssessmentItems(
      content.grade,
      content.subject,
      topic,
      moeAlignmentCodes
    );

    return NextResponse.json({
      draft: {
        title: `${assignmentType === "quiz" ? "Quiz" : "Assignment"}: ${topic}`,
        questions,
        moeStandardCodes: moeAlignmentCodes,
        scheduledWorkId: resolvedScheduledWorkId ?? undefined,
        contentId: resolvedContentId,
        generationMethod: "ai_generated",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to generate assignment" },
      { status: err?.status ?? 500 }
    );
  }
}

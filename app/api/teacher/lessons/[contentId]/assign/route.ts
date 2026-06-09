import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

const BodySchema = z.object({
  classId: z.string().min(1),
  scheduledFor: z.string().datetime().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { contentId: string } }
) {
  const traceId = randomUUID();
  try {
    const user = await requireRole("TEACHER");
    const body = BodySchema.parse(await req.json());

    const lesson = await prisma.curriculumContent.findUnique({
      where: { contentId: params.contentId },
      select: { contentId: true, editedById: true, editReviewStatus: true },
    });
    if (!lesson) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (lesson.editReviewStatus !== "APPROVED") {
      return NextResponse.json({ error: "lesson_not_approved" }, { status: 403 });
    }

    // Verify the target class belongs to the teacher's school
    if (user.schoolId) {
      const targetClass = await prisma.class.findUnique({
        where: { id: body.classId },
        select: { schoolId: true },
      });
      if (!targetClass || targetClass.schoolId !== user.schoolId) {
        return NextResponse.json({ error: "class_not_in_school" }, { status: 403 });
      }
    }

    try {
      const assignment = await prisma.teacherLessonAssignment.create({
        data: {
          id: randomUUID(),
          contentId: params.contentId,
          classId: body.classId,
          assignedById: user.id,
          scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
        },
      });
      return NextResponse.json({ id: assignment.id, contentId: assignment.contentId, classId: assignment.classId });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return NextResponse.json({ error: "already_assigned" }, { status: 409 });
      }
      throw err;
    }
  } catch (error) {
    return handleApiError(error, {
      route: `/api/teacher/lessons/${params.contentId}/assign`,
      method: "POST",
      requestId: traceId,
    });
  }
}

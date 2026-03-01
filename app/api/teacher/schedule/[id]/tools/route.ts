import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isToolkitLessonIntegrationEnabled } from "@/lib/serverFlags";
import { getToolsForLesson } from "@/lib/toolkit/toolRegistry";

export const dynamic = "force-dynamic";

/**
 * GET /api/teacher/schedule/[id]/tools
 * Part 6: Returns required, optional, and contextual tools for a scheduled lesson.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isToolkitLessonIntegrationEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { id } = params;

    const sw = await prisma.scheduledWork.findUnique({
      where: { id },
      include: {
        class: { select: { schoolId: true } },
        content: {
          select: {
            grade: true,
            subject: true,
            deliveryProfile: true,
            payload: true,
          },
        },
      },
    });

    if (!sw || sw.class.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { grade, subject, deliveryProfile } = sw.content;
    const profile = deliveryProfile as any;
    const toolsRequired = profile?.toolsRequired ?? undefined;
    const lessonType = "lesson";

    const result = getToolsForLesson(subject, grade, lessonType, toolsRequired);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to get tools" },
      { status: err?.status ?? 500 }
    );
  }
}

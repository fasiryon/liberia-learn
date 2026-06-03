import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Serve the answerKey for a specific problemSet to the student.
// Verifies the student has access to this scheduledWork before returning.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scheduledWorkId: string; problemSetId: string }> }
) {
  try {
    const user = await requireRole("STUDENT");
    const { scheduledWorkId, problemSetId } = await params;

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const sw = await prisma.scheduledWork.findUnique({
      where: { id: scheduledWorkId },
      select: {
        classId: true,
        content: { select: { payload: true, status: true } },
        class: { select: { schoolId: true } },
      },
    });

    if (!sw || !["published", "APPROVED"].includes(sw.content.status)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (sw.class.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_classId: { studentId: student.id, classId: sw.classId } },
      select: { id: true },
    });
    if (!enrollment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = sw.content.payload as { problemSets?: Array<{ id: string; answerKey?: string }> } | null;
    const problemSet = payload?.problemSets?.find((ps) => ps.id === problemSetId);

    return NextResponse.json({ answerKey: problemSet?.answerKey ?? null });
  } catch (error: any) {
    if (error?.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Failed to fetch answer" }, { status: 500 });
  }
}

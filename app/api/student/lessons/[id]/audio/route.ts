import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { selectLessonBody } from "@/lib/lessons";
import { getCurrentLessonAudio, queueLessonAudioGeneration } from "@/lib/lessons/audioGeneration";
import { projectStudentLessonPayload } from "@/lib/curriculum/studentLessonProjection";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole("STUDENT");
    const sw = await prisma.scheduledWork.findUnique({
      where: { id: params.id },
      include: {
        content: {
          select: {
            contentId: true,
            version: true,
            payload: true,
          },
        },
        class: { select: { id: true, schoolId: true } },
      },
    });
    if (!sw) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (sw.class.schoolId !== user.schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_classId: { studentId: student.id, classId: sw.classId } },
      select: { id: true },
    });
    if (!enrollment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const current = await getCurrentLessonAudio(sw.content.contentId, sw.content.version);
    if (current.audio?.status === "GENERATED") {
      return NextResponse.json({ status: current.status, audio: current.audio });
    }

    const payload = sw.content.payload as any;
    const studentPayload = projectStudentLessonPayload(payload);
    const learnerBody = typeof studentPayload.body === "string" ? studentPayload.body : "";
    const learnerStandardBody = typeof studentPayload.body_standard === "string"
      ? studentPayload.body_standard
      : learnerBody;
    const learnerBlockBody = typeof studentPayload.body_block === "string"
      ? studentPayload.body_block
      : learnerBody;
    const text = selectLessonBody(
      {
        body: learnerBody,
        body_standard: learnerStandardBody,
        body_block: learnerBlockBody,
      },
      sw.classFormat ?? "standard"
    );
    const audio = await queueLessonAudioGeneration({
      lessonId: sw.content.contentId,
      contentVersion: sw.content.version,
      schoolId: user.schoolId ?? null,
      userId: user.id,
      text,
    });
    return NextResponse.json({ status: audio.status, audio });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Audio request failed" }, { status: error?.status ?? 500 });
  }
}

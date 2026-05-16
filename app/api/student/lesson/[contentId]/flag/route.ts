import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push/sendPush";
import { logAudit } from "@/lib/audit";

const FLAG_PUSH_THRESHOLD = 3;

export async function POST(
  req: NextRequest,
  { params }: { params: { contentId: string } }
) {
  let user: Awaited<ReturnType<typeof requireRole>>;
  try {
    user = await requireRole("STUDENT");
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
  }

  const { contentId } = params;
  const body = await req.json().catch(() => ({}));
  const note: string | undefined =
    typeof body.note === "string" ? body.note.trim().slice(0, 500) : undefined;

  await prisma.lessonHelpFlag.create({
    data: {
      studentId: user.id,
      contentId,
      note: note || null,
    },
  });

  logAudit({
    action: "lesson_flagged",
    userId: user.id,
    schoolId: user.schoolId ?? null,
    details: { contentId, note: note ?? null },
  });

  // Count total flags for this student+lesson
  const totalFlags = await prisma.lessonHelpFlag.count({
    where: { studentId: user.id, contentId },
  });

  if (totalFlags >= FLAG_PUSH_THRESHOLD) {
    // Find a teacher for this student's class that has this content
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        Student: { userId: user.id },
      },
      select: {
        Class: { select: { teacherId: true } },
      },
    });

    const teacherId = enrollment?.Class?.teacherId;
    if (teacherId) {
      const lesson = await prisma.curriculumContent.findUnique({
        where: { contentId },
        select: { title: true },
      });
      const studentName = user.name ?? "A student";
      const lessonTitle = lesson?.title ?? contentId;

      void sendPushToUser(teacherId, {
        title: "Student needs help 🚩",
        body: `${studentName} has flagged ${lessonTitle} ${totalFlags} times`,
        url: `/teacher/students/${user.id}`,
      });
    }
  }

  return NextResponse.json({ flagged: true, totalFlags });
}

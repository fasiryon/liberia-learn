import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendSMS } from "@/lib/sms";

export const dynamic = "force-dynamic";

type QuestionItem = {
  index: number;
  text: string;
  options: string[];
  correct: number;
};

function buildQuestionSms(
  title: string,
  q: QuestionItem,
  total: number,
): string {
  const opts = ["A", "B", "C", "D"];
  const lines = [
    `LiberiaLearn Quiz: ${title}`,
    `Q${q.index + 1}/${total}: ${q.text}`,
    ...q.options.map((o, i) => `${opts[i]}) ${o}`),
    "Reply A, B, C, or D",
  ];
  return lines.join("\n");
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireRole("TEACHER", "ADMIN");
  if (!user.schoolId) {
    return NextResponse.json({ error: "School context required" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const studentPhone: string | undefined = body?.studentPhone;
  const studentId: string | undefined = body?.studentId;

  if (!studentPhone) {
    return NextResponse.json({ error: "studentPhone is required" }, { status: 400 });
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: params.id },
    include: {
      Class: { select: { schoolId: true, teacherId: true } },
    },
  });

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }
  if (assignment.Class.schoolId !== user.schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Questions must be stored on the assignment as JSON (contentId / rubric-backed)
  // Fall back to a placeholder so the route is functional when no questions exist yet
  const rawQuestions: QuestionItem[] = Array.isArray(body?.questions)
    ? body.questions
    : [];

  if (rawQuestions.length === 0) {
    return NextResponse.json(
      { error: "No questions provided. Include a 'questions' array in the request body." },
      { status: 400 },
    );
  }

  const limited = rawQuestions.slice(0, 10);

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Enable SMS on assignment if not already
  if (!assignment.smsEnabled) {
    await prisma.assignment.update({
      where: { id: params.id },
      data: { smsEnabled: true },
    });
  }

  const session = await prisma.smsSession.create({
    data: {
      assignmentId: params.id,
      studentPhone,
      studentId: studentId ?? null,
      questions: limited as object[],
      currentIndex: 0,
      score: 0,
      status: "ACTIVE",
      expiresAt,
    },
  });

  const firstMessage = buildQuestionSms(assignment.title, limited[0], limited.length);
  const smsResult = await sendSMS(studentPhone, firstMessage);

  logAudit({
    action: "SMS_QUIZ_SENT",
    userId: user.id,
    resourceType: "SmsSession",
    resourceId: session.id,
    schoolId: user.schoolId,
    details: { assignmentId: params.id, studentPhone, sent: smsResult.ok },
  });

  return NextResponse.json({ sessionId: session.id, sent: smsResult.ok });
}

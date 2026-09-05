import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSMS } from "@/lib/sms";
import { sendPushToUser } from "@/lib/push/sendPush";
import { authenticateAfricaTalkingWebhook, claimAfricaTalkingMessage, readAfricaTalkingBody } from "@/lib/webhooks/africasTalking";

// route-policy: auth=provider; scope=none; authority=africas-talking-hmac; rationale=grade-affecting SMS quiz replies

export const dynamic = "force-dynamic";

const VALID_ANSWERS = new Set(["A", "B", "C", "D"]);

type QuestionItem = {
  index: number;
  text: string;
  options: string[];
  correct: number; // 0-indexed
};

function buildNextQuestionSms(q: QuestionItem, total: number): string {
  const opts = ["A", "B", "C", "D"];
  return [
    `Q${q.index + 1}/${total}: ${q.text}`,
    ...q.options.map((o, i) => `${opts[i]}) ${o}`),
    "Reply A, B, C, or D",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const body = await readAfricaTalkingBody(req);
  const auth = authenticateAfricaTalkingWebhook(body, req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const from = body.fields.from ?? "";
  const text = (body.fields.text ?? "").trim().toUpperCase();
  const messageId = body.fields.id ?? "";
  if (!from || !messageId) return NextResponse.json({ error: "malformed_payload" }, { status: 400 });
  if (!(await claimAfricaTalkingMessage(messageId))) {
    return NextResponse.json({ error: "replayed_message" }, { status: 409 });
  }

  const session = await prisma.smsSession.findFirst({
    where: { studentPhone: from, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      assignment: { select: { title: true, Class: { select: { teacherId: true } } } },
      student: { select: { name: true } },
    },
  });

  if (!session) return new NextResponse("", { status: 200 });

  if (new Date() > session.expiresAt) {
    await prisma.smsSession.update({ where: { id: session.id }, data: { status: "EXPIRED" } });
    await sendSMS(from, "Your quiz session has expired. Ask your teacher to resend it.");
    return new NextResponse("", { status: 200 });
  }

  if (!VALID_ANSWERS.has(text)) {
    await sendSMS(from, "Please reply with A, B, C, or D only.");
    return new NextResponse("", { status: 200 });
  }

  const questions: QuestionItem[] = Array.isArray(session.questions)
    ? (session.questions as QuestionItem[])
    : [];

  const currentQ = questions[session.currentIndex];
  if (!currentQ) return new NextResponse("", { status: 200 });

  const answerIndex = ["A", "B", "C", "D"].indexOf(text);
  const correct = answerIndex === currentQ.correct;

  await prisma.smsResponse.create({
    data: {
      sessionId: session.id,
      questionIdx: session.currentIndex,
      answer: text,
      correct,
    },
  });

  const newScore = session.score + (correct ? 1 : 0);
  const nextIndex = session.currentIndex + 1;
  const isLast = nextIndex >= questions.length;

  if (isLast) {
    await prisma.smsSession.update({
      where: { id: session.id },
      data: { score: newScore, currentIndex: nextIndex, status: "COMPLETE", updatedAt: new Date() },
    });

    const total = questions.length;
    await sendSMS(
      from,
      `Quiz complete! Score: ${newScore}/${total}\nYour result has been sent to your teacher.`,
    );

    // Write grade to gradebook as AssignmentSubmission
    if (session.studentId) {
      await prisma.assignmentSubmission.upsert({
        where: { assignmentId_studentId: { assignmentId: session.assignmentId, studentId: session.studentId } },
        create: {
          assignmentId: session.assignmentId,
          studentId: session.studentId,
          score: Math.round((newScore / total) * 100),
          feedback: `SMS quiz: ${newScore}/${total} correct`,
          gradedAt: new Date(),
          gradedBy: "sms-auto",
          turnedInAt: new Date(),
          content: `SMS answers via ${from}`,
        },
        update: {
          score: Math.round((newScore / total) * 100),
          feedback: `SMS quiz: ${newScore}/${total} correct`,
          gradedAt: new Date(),
          turnedInAt: new Date(),
        },
      }).catch(() => null);
    }

    // Push notification to teacher
    const teacherId = session.assignment?.Class?.teacherId;
    if (teacherId) {
      const studentLabel = session.student?.name ?? from;
      sendPushToUser(teacherId, {
        title: "SMS Quiz Complete",
        body: `${studentLabel} scored ${newScore}/${total} on ${session.assignment.title}`,
        url: `/teacher/assignments`,
      }).catch(() => null);
    }
  } else {
    await prisma.smsSession.update({
      where: { id: session.id },
      data: { score: newScore, currentIndex: nextIndex, updatedAt: new Date() },
    });

    const nextQ = questions[nextIndex];
    await sendSMS(from, buildNextQuestionSms(nextQ, questions.length));
  }

  return new NextResponse("", { status: 200 });
}

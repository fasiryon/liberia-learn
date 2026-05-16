import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { routedCompletion } from "@/lib/ai/router";

const DAILY_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

type TutorMessage = { role: "user" | "assistant"; content: string; ts: string };

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
  const message: string = typeof body.message === "string" ? body.message.trim().slice(0, 200) : "";
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Rate limit: 10 messages per student per lesson per day
  const today = new Date().toISOString().slice(0, 10);
  const rlResult = await checkRateLimit(`${user.id}:${contentId}:${today}`, {
    windowMs: DAY_MS,
    limit: DAILY_LIMIT,
    namespace: "tutor",
  });

  if (!rlResult.allowed) {
    return NextResponse.json(
      {
        error:
          "You've reached your daily question limit for this lesson. Try again tomorrow.",
      },
      { status: 429 }
    );
  }

  // Load lesson context
  const lesson = await prisma.curriculumContent.findUnique({
    where: { contentId },
    select: { payload: true, title: true, grade: true, subject: true },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const payload = lesson.payload as Record<string, unknown>;
  const rawBody =
    (payload.body_standard as string | null) ??
    (payload.body_block as string | null) ??
    (payload.body as string | null) ??
    "";
  const lessonBody = rawBody.slice(0, 2000);
  const grade = lesson.grade;
  const subject = lesson.subject;
  const title = (lesson.title as string | null) ?? subject;

  // Load or create today's conversation
  const sessionStart = new Date();
  sessionStart.setHours(0, 0, 0, 0);

  let conversation = await prisma.tutorConversation.findFirst({
    where: {
      studentId: user.id,
      contentId,
      sessionDate: { gte: sessionStart },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!conversation) {
    conversation = await prisma.tutorConversation.create({
      data: {
        studentId: user.id,
        contentId,
        schoolId: user.schoolId ?? "",
        messages: [],
        questionsAsked: 0,
        sessionDate: new Date(),
      },
    });
  }

  const history = Array.isArray(conversation.messages)
    ? (conversation.messages as TutorMessage[])
    : [];

  const systemPrompt = `You are a friendly AI tutor helping a Grade ${grade} student in Liberia understand their ${subject} lesson.

LESSON CONTEXT (use this to answer):
${lessonBody}

RULES:
- Only answer questions about this lesson and this subject.
- If the student asks about something unrelated, say: 'I can only help with your ${subject} lesson right now. What would you like to know about ${title}?'
- Use simple, encouraging language appropriate for Grade ${grade}.
- Use Liberian names and examples where helpful.
- Never do the student's homework for them. Guide them to the answer instead.
- Keep responses under 150 words.`;

  const aiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  let reply = "I'm having trouble right now. Please try again in a moment.";
  try {
    const result = await routedCompletion({
      messages: aiMessages,
      maxTokens: 250,
      aiUsage: {
        route: "api/student/tutor/[contentId]/chat",
        feature: "tutor",
        userId: user.id,
        schoolId: user.schoolId,
        contentId,
        requestType: "tutor_chat",
      },
    });
    reply = result.content.trim();
  } catch {
    // use default reply
  }

  const now = new Date().toISOString();
  const updatedMessages: TutorMessage[] = [
    ...history,
    { role: "user", content: message, ts: now },
    { role: "assistant", content: reply, ts: now },
  ];

  await prisma.tutorConversation.update({
    where: { id: conversation.id },
    data: {
      messages: updatedMessages,
      questionsAsked: { increment: 1 },
    },
  });

  const questionsLeft = Math.max(0, DAILY_LIMIT - rlResult.limit + rlResult.remaining);

  return NextResponse.json({ reply, questionsLeft });
}

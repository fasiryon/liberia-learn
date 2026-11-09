// route-policy: auth=session; scope=record; authority=class-teacher-feedback; rationale=a TEACHER replies only inside an existing conversation whose threadKey is exactly {teacher, recipient}, to a STUDENT or GUARDIAN of the teacher's school who links (own enrollment, or a linked child's) to a class where lib/authz/classAuthority grants class.feedback; otherwise a non-disclosing 404 (recipient or conversation) or 403 (not a participant, not a teacher) before any message body is read and before any write, audit or push (AT-GRADE-01-2C)
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { authorizeClassAccess } from "@/lib/authz/classAuthority";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push/sendPush";
import { shouldFlag } from "@/lib/messaging/keywordFilter";

export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 1000;
const conversationNotFound = () => NextResponse.json({ error: "Conversation not found" }, { status: 404 });

/** Classes the recipient links to: a student's own enrollments, or a guardian's linked children's enrollments. */
async function recipientClassIds(recipient: { id: string; role: string }): Promise<string[]> {
  if (recipient.role === "STUDENT") {
    const student = await prisma.student.findUnique({ where: { userId: recipient.id }, select: { enrollments: { select: { classId: true } } } });
    return (student?.enrollments ?? []).map((e) => e.classId);
  }
  const links = await prisma.studentGuardian.findMany({ where: { guardianId: recipient.id }, select: { student: { select: { enrollments: { select: { classId: true } } } } } });
  return links.flatMap((link) => link.student.enrollments.map((e) => e.classId));
}

function sanitizeBody(raw: string): string {
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "TEACHER" || !user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { threadKey, body: rawBody, recipientId } = body as Record<string, unknown>;

    if (!threadKey || typeof threadKey !== "string") {
      return NextResponse.json({ error: "threadKey is required" }, { status: 400 });
    }
    if (!recipientId || typeof recipientId !== "string") {
      return NextResponse.json({ error: "recipientId is required" }, { status: 400 });
    }
    if (!rawBody || typeof rawBody !== "string") {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    // The thread is exactly the pair {teacher, recipient} (threadKey = sorted pair of userIds): the recipient must be the
    // other participant, never a client-chosen third party.
    const parts = threadKey.split(":");
    if (parts.length !== 2 || recipientId === user.id || threadKey !== [user.id, recipientId].sort().join(":")) {
      return NextResponse.json({ error: "You are not part of this conversation" }, { status: 403 });
    }

    const sanitized = sanitizeBody(rawBody);
    if (!sanitized) {
      return NextResponse.json({ error: "Message body cannot be empty" }, { status: 400 });
    }
    if (sanitized.length > MAX_BODY_LENGTH) {
      return NextResponse.json({ error: `Body must be ${MAX_BODY_LENGTH} chars or fewer` }, { status: 400 });
    }

    // AT-GRADE-01-2C: a STUDENT or GUARDIAN of this school, in an existing conversation, linked to a class where this
    // teacher holds class.feedback. Every refusal is the same 404, before any message body is read or anything written.
    const recipient = await prisma.user.findUnique({ where: { id: recipientId }, select: { id: true, role: true, schoolId: true } });
    if (!recipient || recipient.schoolId !== user.schoolId || (recipient.role !== "STUDENT" && recipient.role !== "GUARDIAN")) {
      return conversationNotFound();
    }
    // Participants and roles only; message bodies are never read here.
    const existingMessage = await prisma.message.findFirst({
      where: { threadKey },
      select: { id: true, senderRole: true, recipientRole: true, fromUserId: true, toUserId: true },
    });
    if (!existingMessage) return conversationNotFound();
    let authorized = false;
    for (const classId of Array.from(new Set(await recipientClassIds(recipient)))) {
      if ((await authorizeClassAccess(user, { classId, fn: "class.feedback" })).allowed) { authorized = true; break; }
    }
    if (!authorized) return conversationNotFound();

    const recipientRole = recipient.role;

    const flagged = shouldFlag(sanitized);

    const message = await prisma.message.create({
      data: {
        id: randomUUID(),
        fromUserId: user.id,
        toUserId: recipientId,
        body: sanitized,
        senderRole: "TEACHER",
        recipientRole,
        threadKey,
        flagged,
        flaggedAt: flagged ? new Date() : null,
        flagReason: flagged ? "keyword_match" : null,
      },
    });

    void logAudit({
      userId: user.id,
      action: flagged ? "message.auto_flagged" : "teacher.message.reply.sent",
      resourceType: "message",
      resourceId: message.id,
      schoolId: user.schoolId ?? undefined,
      traceId,
    });

    void sendPushToUser(recipientId, {
      title: "Reply from your teacher",
      body: `${user.name ?? "Your teacher"}: ${sanitized.slice(0, 77)}`,
      url: recipientRole === "STUDENT" ? "/student/messages" : "/guardian/messages",
    });

    return NextResponse.json({ messageId: message.id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}

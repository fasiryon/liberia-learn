import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push/sendPush";
import { shouldFlag } from "@/lib/messaging/keywordFilter";

export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 1000;

function sanitizeBody(raw: string): string {
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "TEACHER") {
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

    // Validate teacher is part of this threadKey (threadKey = sorted pair of userIds)
    const parts = threadKey.split(":");
    if (parts.length !== 2 || !parts.includes(user.id)) {
      return NextResponse.json({ error: "You are not part of this conversation" }, { status: 403 });
    }

    const sanitized = sanitizeBody(rawBody);
    if (!sanitized) {
      return NextResponse.json({ error: "Message body cannot be empty" }, { status: 400 });
    }
    if (sanitized.length > MAX_BODY_LENGTH) {
      return NextResponse.json({ error: `Body must be ${MAX_BODY_LENGTH} chars or fewer` }, { status: 400 });
    }

    // Determine recipient role — look at existing thread messages
    const existingMessage = await prisma.message.findFirst({
      where: { threadKey },
      select: { senderRole: true, recipientRole: true, fromUserId: true, toUserId: true },
    });

    const recipientRole = existingMessage
      ? (existingMessage.fromUserId === recipientId ? existingMessage.senderRole : existingMessage.recipientRole)
      : "STUDENT";

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

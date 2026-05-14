import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push/sendPush";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { shouldFlag } from "@/lib/messaging/keywordFilter";

export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 1000;
const RATE_LIMIT_PER_DAY = 10;
const PAGE_SIZE = 50;

function sanitizeBody(raw: string): string {
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

function buildThreadKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const threadKey = searchParams.get("threadKey");
    const before = searchParams.get("before");

    // Paginated single-thread mode
    if (threadKey) {
      const messages = await prisma.message.findMany({
        where: {
          threadKey,
          OR: [{ fromUserId: user.id }, { toUserId: user.id }],
          ...(before ? { createdAt: { lt: new Date(before) } } : {}),
          NOT: { deletedBySender: true, fromUserId: user.id },
        },
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
        include: {
          readReceipts: { where: { userId: user.id }, select: { id: true } },
        },
      });

      const nextCursor = messages.length === PAGE_SIZE
        ? messages[messages.length - 1].createdAt.toISOString()
        : null;

      return NextResponse.json({
        messages: messages.reverse().map((m) => ({
          id: m.id,
          body: m.deletedBySender ? "[Message retracted]" : m.body,
          senderRole: m.senderRole,
          fromUserId: m.fromUserId,
          createdAt: m.createdAt.toISOString(),
          read: m.toUserId !== user.id || m.readReceipts.length > 0,
          deletedBySender: m.deletedBySender,
          attachmentUrl: m.attachmentUrl ?? null,
          attachmentName: m.attachmentName ?? null,
          attachmentType: m.attachmentType ?? null,
        })),
        nextCursor,
      });
    }

    // Thread list mode (default)
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ fromUserId: user.id }, { toUserId: user.id }],
        senderRole: { in: ["STUDENT", "TEACHER"] },
      },
      orderBy: { createdAt: "asc" },
      include: {
        fromUser: { select: { id: true, name: true, role: true } },
        toUser: { select: { id: true, name: true, role: true } },
        readReceipts: { where: { userId: user.id }, select: { id: true } },
      },
    });

    const threadMap = new Map<string, {
      threadKey: string;
      otherId: string;
      otherName: string;
      messages: typeof messages;
    }>();

    for (const msg of messages) {
      const key = msg.threadKey || buildThreadKey(msg.fromUserId, msg.toUserId);
      const other = msg.fromUserId === user.id ? msg.toUser : msg.fromUser;
      if (!threadMap.has(key)) {
        threadMap.set(key, { threadKey: key, otherId: other.id, otherName: other.name ?? "Teacher", messages: [] });
      }
      threadMap.get(key)!.messages.push(msg);
    }

    // Mark messages as read via MessageReadReceipt
    const unreadIds = messages
      .filter((m) => m.toUserId === user.id && m.readReceipts.length === 0)
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      await Promise.all(
        unreadIds.map((messageId) =>
          prisma.messageReadReceipt.upsert({
            where: { messageId_userId: { messageId, userId: user.id } },
            create: { id: randomUUID(), messageId, userId: user.id },
            update: {},
          }).catch(() => null)
        )
      );
    }

    const threads = Array.from(threadMap.values())
      .map((thread) => {
        // Latest 50 messages per thread; older ones load via pagination
        const recent = thread.messages.slice(-PAGE_SIZE);
        const last = recent[recent.length - 1];
        const unreadCount = thread.messages.filter(
          (m) => m.toUserId === user.id && m.readReceipts.length === 0
        ).length;
        const hasMore = thread.messages.length > PAGE_SIZE;
        const nextCursor = hasMore ? thread.messages[thread.messages.length - PAGE_SIZE - 1].createdAt.toISOString() : null;
        return {
          threadKey: thread.threadKey,
          otherId: thread.otherId,
          otherName: thread.otherName,
          lastMessage: last ? { body: last.body.slice(0, 60), createdAt: last.createdAt.toISOString() } : null,
          unreadCount,
          nextCursor,
          messages: recent
            .filter((m) => !(m.deletedBySender && m.fromUserId === user.id))
            .map((m) => ({
              id: m.id,
              body: m.deletedBySender ? "[Message retracted]" : m.body,
              senderRole: m.senderRole,
              fromUserId: m.fromUserId,
              createdAt: m.createdAt.toISOString(),
              read: m.toUserId !== user.id || m.readReceipts.length > 0,
              deletedBySender: m.deletedBySender,
              attachmentUrl: m.attachmentUrl ?? null,
              attachmentName: m.attachmentName ?? null,
              attachmentType: m.attachmentType ?? null,
            })),
        };
      })
      .sort((a, b) => {
        const aTime = a.lastMessage?.createdAt ?? "";
        const bTime = b.lastMessage?.createdAt ?? "";
        return bTime.localeCompare(aTime);
      });

    return NextResponse.json({ threads });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { teacherId, body: rawBody, attachmentUrl, attachmentName, attachmentType } = body as Record<string, unknown>;

    if (!teacherId || typeof teacherId !== "string") {
      return NextResponse.json({ error: "teacherId is required" }, { status: 400 });
    }
    if (!rawBody || typeof rawBody !== "string") {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const sanitized = sanitizeBody(rawBody);
    if (!sanitized) {
      return NextResponse.json({ error: "Message body cannot be empty" }, { status: 400 });
    }
    if (sanitized.length > MAX_BODY_LENGTH) {
      return NextResponse.json({ error: `Body must be ${MAX_BODY_LENGTH} chars or fewer` }, { status: 400 });
    }

    const studentRecord = await prisma.student.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!studentRecord) {
      return NextResponse.json({ error: "Student record not found" }, { status: 403 });
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: studentRecord.id, Class: { teacherId } },
      include: { Class: { select: { schoolId: true } } },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "That teacher does not teach any of your classes" }, { status: 403 });
    }

    const rlKey = `${user.id}:${teacherId}`;
    const rl = await checkRateLimit(rlKey, {
      windowMs: 24 * 60 * 60 * 1000,
      limit: RATE_LIMIT_PER_DAY,
      namespace: "student_message",
    });
    if (!rl.allowed) {
      return rateLimitExceededResponse(rl);
    }

    const threadKey = buildThreadKey(user.id, teacherId);
    const flagged = shouldFlag(sanitized);

    const message = await prisma.message.create({
      data: {
        id: randomUUID(),
        fromUserId: user.id,
        toUserId: teacherId,
        body: sanitized,
        senderRole: "STUDENT",
        recipientRole: "TEACHER",
        threadKey,
        classId: (enrollment as any).classId ?? null,
        flagged,
        flaggedAt: flagged ? new Date() : null,
        flagReason: flagged ? "keyword_match" : null,
        attachmentUrl: typeof attachmentUrl === "string" ? attachmentUrl : null,
        attachmentName: typeof attachmentName === "string" ? attachmentName : null,
        attachmentType: typeof attachmentType === "string" ? attachmentType : null,
      },
    });

    void logAudit({
      userId: user.id,
      action: flagged ? "message.auto_flagged" : "student.message.sent",
      resourceType: "message",
      resourceId: message.id,
      schoolId: enrollment.Class.schoolId,
      traceId,
    });

    void sendPushToUser(teacherId, {
      title: "Message from Student",
      body: `${user.name ?? "A student"}: ${sanitized.slice(0, 77)}`,
      url: "/teacher/messages",
    });

    return NextResponse.json({ messageId: message.id, threadKey }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [{ fromUserId: user.id }, { toUserId: user.id }],
        senderRole: { in: ["STUDENT", "TEACHER"] },
      },
      orderBy: { createdAt: "asc" },
      include: {
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
        readReceipts: { where: { userId: user.id }, select: { id: true } },
      },
    });

    // Group into threads
    const threadMap = new Map<string, {
      threadKey: string;
      otherId: string;
      otherName: string;
      messages: typeof messages;
    }>();

    for (const msg of messages) {
      const key = msg.threadKey || [msg.fromUserId, msg.toUserId].sort().join(":");
      const other = msg.fromUserId === user.id ? msg.toUser : msg.fromUser;
      if (!threadMap.has(key)) {
        threadMap.set(key, { threadKey: key, otherId: other.id, otherName: other.name ?? "Student", messages: [] });
      }
      threadMap.get(key)!.messages.push(msg);
    }

    // Mark incoming messages as read
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
        const last = thread.messages[thread.messages.length - 1];
        const unreadCount = thread.messages.filter(
          (m) => m.toUserId === user.id && m.readReceipts.length === 0
        ).length;
        return {
          threadKey: thread.threadKey,
          otherId: thread.otherId,
          otherName: thread.otherName,
          lastMessage: last ? { body: last.body.slice(0, 60), createdAt: last.createdAt.toISOString() } : null,
          unreadCount,
          messages: thread.messages.map((m) => ({
            id: m.id,
            body: m.body,
            senderRole: m.senderRole,
            fromUserId: m.fromUserId,
            createdAt: m.createdAt.toISOString(),
            read: m.toUserId !== user.id || m.readReceipts.length > 0,
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

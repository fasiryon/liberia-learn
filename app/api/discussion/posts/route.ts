import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push/sendPush";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const user = await requireRole("STUDENT", "TEACHER", "ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { threadId, body: postBody, parentPostId } = body;

  if (!threadId || !postBody?.trim()) {
    return NextResponse.json({ error: "threadId and body are required" }, { status: 400 });
  }

  const thread = await prisma.discussionThread.findUnique({
    where: { id: threadId },
    include: { class: { select: { gradeLevel: true } } },
  });
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  if (thread.locked) return NextResponse.json({ error: "Thread is locked" }, { status: 400 });

  // Scope check
  if (user.role === "STUDENT") {
    const enrollment = await prisma.enrollment.findFirst({
      where: { classId: thread.classId, Student: { userId: user.id } },
    });
    if (!enrollment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Rate limit: 10 posts per day per class
    const rl = await checkRateLimit(`${user.id}:${thread.classId}`, {
      windowMs: 86_400_000,
      limit: 10,
      namespace: "discussion_post",
    });
    if (!rl.allowed) return rateLimitExceededResponse(rl);

    // Additional count-based check (belt-and-suspenders)
    const since = new Date(Date.now() - 86_400_000);
    const count = await prisma.discussionPost.count({
      where: {
        thread: { classId: thread.classId },
        authorId: user.id,
        createdAt: { gte: since },
      },
    });
    if (count >= 10) {
      return NextResponse.json({ error: "Daily post limit reached for this class" }, { status: 429 });
    }
  } else {
    const cls = await prisma.class.findFirst({ where: { id: thread.classId, schoolId: user.schoolId! } });
    if (!cls) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isPending = user.role === "STUDENT" && (thread.class.gradeLevel ?? 99) <= 6;

  const post = await prisma.discussionPost.create({
    data: {
      threadId,
      authorId: user.id,
      authorRole: user.role,
      body: postBody.trim(),
      parentPostId: parentPostId ?? null,
      pending: isPending,
    },
  });

  // Update thread updatedAt
  await prisma.discussionThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });

  // Push notification to thread author if teacher replied
  if (user.role === "TEACHER" && thread.authorId !== user.id) {
    sendPushToUser(thread.authorId, {
      title: "Teacher replied to your question",
      body: postBody.trim().slice(0, 80),
      url: `/student/class/${thread.classId}/discussion`,
    });
  }

  logAudit({ userId: user.id, action: "discussion.post.create", details: { postId: post.id, threadId } });

  return NextResponse.json(post, { status: 201 });
}

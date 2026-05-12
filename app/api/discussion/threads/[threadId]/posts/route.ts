import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  const user = await requireRole("STUDENT", "TEACHER", "ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = params;
  const thread = await prisma.discussionThread.findUnique({ where: { id: threadId } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Scope check
  if (user.role === "STUDENT") {
    const enrollment = await prisma.enrollment.findFirst({
      where: { classId: thread.classId, Student: { userId: user.id } },
    });
    if (!enrollment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (user.role === "TEACHER") {
    const cls = await prisma.class.findFirst({ where: { id: thread.classId, schoolId: user.schoolId! } });
    if (!cls) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Upsert lastRead
  await prisma.discussionLastRead.upsert({
    where: { userId_threadId: { userId: user.id, threadId } },
    update: { readAt: new Date() },
    create: { userId: user.id, threadId },
  });

  const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10);
  const take = 20;
  const skip = (page - 1) * take;

  const where: Record<string, unknown> = { threadId, parentPostId: null };
  // Students only see their own pending posts; teachers/admins see all
  if (user.role === "STUDENT") {
    where.OR = [{ pending: false }, { authorId: user.id }];
  }

  const posts = await prisma.discussionPost.findMany({
    where,
    orderBy: { createdAt: "asc" },
    skip,
    take,
    include: {
      author: { select: { id: true, name: true } },
      replies: {
        where:
          user.role === "STUDENT"
            ? { OR: [{ pending: false }, { authorId: user.id }] }
            : undefined,
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      upvoters: { where: { userId: user.id }, select: { id: true } },
    },
  });

  return NextResponse.json(posts);
}

// route-policy: auth=session; scope=tenant; authority=class-membership; rationale=child posts are readable only by class members and staff of the class school
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { authorizeDiscussionThread } from "@/lib/discussion/access";

export async function GET(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  const user = await requireRole("STUDENT", "TEACHER", "ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = params;
  const access = await authorizeDiscussionThread(user, threadId);
  if (access instanceof NextResponse) return access;

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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const user = await requireRole("STUDENT", "TEACHER", "ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = params;

  // Check if already upvoted
  const existing = await prisma.discussionUpvote.findUnique({
    where: { postId_userId: { postId, userId: user.id } },
  });

  if (existing) {
    return NextResponse.json({ message: "Already upvoted" }, { status: 200 });
  }

  await prisma.$transaction([
    prisma.discussionUpvote.create({ data: { postId, userId: user.id } }),
    prisma.discussionPost.update({ where: { id: postId }, data: { upvotes: { increment: 1 } } }),
  ]);

  return NextResponse.json({ upvoted: true });
}

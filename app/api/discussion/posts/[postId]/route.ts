import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const user = await requireRole("STUDENT", "TEACHER", "ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = params;
  const post = await prisma.discussionPost.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Students can only delete own posts; teachers/admins can delete any
  if (user.role === "STUDENT" && post.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.discussionPost.delete({ where: { id: postId } });
  logAudit({ userId: user.id, action: "discussion.post.delete", details: { postId } });
  return NextResponse.json({ deleted: true });
}

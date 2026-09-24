// route-policy: auth=session; scope=tenant; authority=author-or-same-school-moderator; rationale=students delete own posts and staff moderate only their school
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { authorizeDiscussionPost } from "@/lib/discussion/access";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const user = await requireRole("STUDENT", "TEACHER", "ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = params;
  const access = await authorizeDiscussionPost(user, postId);
  if (access instanceof NextResponse) return access;

  // Students can only delete own posts; teachers/admins can delete any post in their school
  if (user.role === "STUDENT" && access.post.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.discussionPost.delete({ where: { id: postId } });
  logAudit({ userId: user.id, action: "discussion.post.delete", details: { postId } });
  return NextResponse.json({ deleted: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const user = await requireRole("TEACHER", "ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { postId } = params;
  const post = await prisma.discussionPost.update({
    where: { id: postId },
    data: { pending: false },
  });

  logAudit({ userId: user.id, action: "discussion.post.approve", details: { postId } });
  return NextResponse.json(post);
}

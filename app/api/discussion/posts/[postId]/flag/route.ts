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
  const post = await prisma.discussionPost.update({
    where: { id: postId },
    data: { flagged: true },
  });
  return NextResponse.json(post);
}

// route-policy: auth=session; scope=tenant; authority=class-membership; rationale=only class members or school staff may flag a class post
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { authorizeDiscussionPost } from "@/lib/discussion/access";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const user = await requireRole("STUDENT", "TEACHER", "ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = params;
  const access = await authorizeDiscussionPost(user, postId);
  if (access instanceof NextResponse) return access;

  await prisma.discussionPost.update({
    where: { id: postId },
    data: { flagged: true },
  });
  return NextResponse.json({ id: postId, flagged: true });
}

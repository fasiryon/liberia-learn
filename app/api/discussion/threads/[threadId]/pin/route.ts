// route-policy: auth=session; scope=tenant; authority=same-school-class-moderator; rationale=thread moderation is limited to staff of the class school
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { authorizeDiscussionThread } from "@/lib/discussion/access";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  const user = await requireRole("TEACHER", "ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const access = await authorizeDiscussionThread(user, params.threadId, { moderate: true });
  if (access instanceof NextResponse) return access;

  const updated = await prisma.discussionThread.update({
    where: { id: params.threadId },
    data: { pinned: !access.thread.pinned },
  });
  return NextResponse.json(updated);
}

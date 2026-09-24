// route-policy: auth=session; scope=tenant; authority=same-school-class-moderator; rationale=thread deletion is limited to staff of the class school
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { authorizeDiscussionThread } from "@/lib/discussion/access";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  const user = await requireRole("TEACHER", "ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { threadId } = params;
  const access = await authorizeDiscussionThread(user, threadId, { moderate: true });
  if (access instanceof NextResponse) return access;

  await prisma.discussionThread.delete({ where: { id: threadId } });
  logAudit({ userId: user.id, action: "discussion.thread.delete", details: { threadId } });
  return NextResponse.json({ deleted: true });
}

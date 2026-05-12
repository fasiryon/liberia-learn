import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  const user = await requireRole("TEACHER", "ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { threadId } = params;
  const thread = await prisma.discussionThread.findUnique({ where: { id: threadId } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.discussionThread.delete({ where: { id: threadId } });
  logAudit({ userId: user.id, action: "discussion.thread.delete", details: { threadId } });
  return NextResponse.json({ deleted: true });
}

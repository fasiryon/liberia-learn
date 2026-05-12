import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  const user = await requireRole("TEACHER", "ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { threadId } = params;
  const thread = await prisma.discussionThread.findUnique({ where: { id: threadId } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.discussionThread.update({
    where: { id: threadId },
    data: { pinned: !thread.pinned },
  });
  return NextResponse.json(updated);
}

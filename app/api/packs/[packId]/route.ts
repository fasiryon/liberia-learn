import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { packId: string } }) {
  const user = await requireRole("TEACHER", "STUDENT", "ADMIN");
  const pack = await prisma.offlinePack.findUnique({
    where: { id: params.packId },
    select: {
      id: true,
      requestedById: true,
      status: true,
      blobUrl: true,
      sizeBytes: true,
      lessonCount: true,
      failureReason: true,
      expiresAt: true,
    },
  });

  if (!pack || pack.requestedById !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(pack);
}

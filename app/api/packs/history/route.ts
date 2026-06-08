import { NextResponse } from "next/server";
import { getDownloadUrl } from "@vercel/blob";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireRole("TEACHER", "STUDENT", "ADMIN");

  const packs = await prisma.offlinePack.findMany({
    where: { requestedById: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      weekStart: true,
      weekEnd: true,
      audience: true,
      status: true,
      blobUrl: true,
      sizeBytes: true,
      lessonCount: true,
      createdAt: true,
      completedAt: true,
      failureReason: true,
      expiresAt: true,
    },
  });

  const signedPacks = packs.map((p) => ({
    ...p,
    blobUrl: p.blobUrl ? getDownloadUrl(p.blobUrl) : null,
  }));
  return NextResponse.json({ packs: signedPacks });
}

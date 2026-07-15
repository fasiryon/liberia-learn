import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RETENTION_DAYS = 7;

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Find rejected videos older than 7 days
  const stale = await prisma.lessonVideo.findMany({
    where: {
      status: "REJECTED",
      uploadedAt: { lt: cutoff },
    },
    select: { id: true, storageUrl: true, thumbnailUrl: true },
    take: 50,
  });

  let deleted = 0;
  let errors = 0;

  for (const video of stale) {
    try {
      // Delete from Vercel Blob (best-effort)
      if (video.storageUrl?.startsWith("https://")) {
        await del(video.storageUrl).catch(() => null);
      }
      if (video.thumbnailUrl?.startsWith("https://")) {
        await del(video.thumbnailUrl).catch(() => null);
      }
      // Delete from DB
      await prisma.lessonVideo.delete({ where: { id: video.id } });
      deleted++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ deleted, errors, checked: stale.length, cutoff });
}

// Vercel Cron Jobs invoke via GET, not POST - see docs/ops/CRON_MIDDLEWARE_FIX.md.
export const GET = POST;

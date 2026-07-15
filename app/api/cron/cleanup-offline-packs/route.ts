import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expiredPacks = await prisma.offlinePack.findMany({
    where: { expiresAt: { lt: new Date() }, status: "ready" },
    select: { id: true, blobKey: true },
    take: 50,
  });

  let deleted = 0;
  let errors = 0;
  for (const pack of expiredPacks) {
    try {
      if (pack.blobKey) {
        await del(pack.blobKey);
      }
      await prisma.offlinePack.update({
        where: { id: pack.id },
        data: { status: "expired", blobUrl: null },
      });
      deleted++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ deleted, errors, checked: expiredPacks.length });
}

// Vercel Cron Jobs invoke via GET, not POST - see docs/ops/CRON_MIDDLEWARE_FIX.md.
export const GET = POST;

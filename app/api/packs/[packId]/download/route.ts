import { NextResponse } from "next/server";
import { getDownloadUrl } from "@vercel/blob";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Generates a fresh signed download URL for a stored pack blob.
export async function GET(
  _req: Request,
  { params }: { params: { packId: string } }
) {
  try {
    const user = await requireRole("TEACHER", "STUDENT", "ADMIN");
    const pack = await prisma.offlinePack.findUnique({
      where: { id: params.packId },
      select: { blobUrl: true, requestedById: true, status: true },
    });
    if (!pack?.blobUrl || pack.status !== "ready") {
      return NextResponse.json({ error: "Pack not found or not ready" }, { status: 404 });
    }
    if (pack.requestedById !== user.id && user.role === "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(getDownloadUrl(pack.blobUrl));
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Streams a pack ZIP through the server so private-blob auth is transparent to the browser.
export async function GET(
  _req: Request,
  { params }: { params: { packId: string } }
) {
  try {
    const user = await requireRole("TEACHER", "STUDENT", "ADMIN");
    const pack = await prisma.offlinePack.findUnique({
      where: { id: params.packId },
      select: { blobUrl: true, requestedById: true, status: true, weekStart: true },
    });
    if (!pack?.blobUrl || pack.status !== "ready") {
      return NextResponse.json({ error: "Pack not found or not ready" }, { status: 404 });
    }
    if (pack.requestedById !== user.id && user.role === "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const blobRes = await fetch(pack.blobUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!blobRes.ok) {
      return NextResponse.json({ error: "Blob fetch failed" }, { status: 502 });
    }

    const weekLabel = pack.weekStart
      ? new Date(pack.weekStart).toISOString().slice(0, 10)
      : "this-week";

    return new NextResponse(blobRes.body, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="lessons-pack-${weekLabel}.zip"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}

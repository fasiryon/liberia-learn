import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { contentId: string } }) {
  try {
    const row = await prisma.curriculumContent.findUnique({
      where: { contentId: params.contentId },
      select: { contentId: true, grade: true, subject: true, contentType: true, status: true, version: true, hash: true, payload: true, createdAt: true, updatedAt: true },
    });

    if (!row) return NextResponse.json({ error: "Not found", contentId: params.contentId }, { status: 404 });
    return NextResponse.json({ metadata: row, payload: row.payload });
  } catch (e) {
    console.error("GET /api/curriculum/[contentId] failed:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

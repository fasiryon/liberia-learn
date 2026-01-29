import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/curriculum/:contentId
export async function GET(
  _req: Request,
  { params }: { params: { contentId: string } }
) {
  try {
    const contentId = params.contentId;

    const row = await prisma.curriculumContent.findUnique({
      where: { contentId },
      select: {
        contentId: true,
        grade: true,
        subject: true,
        contentType: true,
        status: true,
        version: true,
        hash: true,
        payload: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!row) {
      return NextResponse.json({ error: "Not found", contentId }, { status: 404 });
    }

    return NextResponse.json({
      metadata: {
        contentId: row.contentId,
        grade: row.grade,
        subject: row.subject,
        contentType: row.contentType,
        status: row.status,
        version: row.version,
        hash: row.hash,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      payload: row.payload,
    });
  } catch (e: any) {
    console.error("GET /api/curriculum/[contentId] failed:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

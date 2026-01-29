import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const gradeParam = url.searchParams.get("grade");
    const subject = url.searchParams.get("subject") || undefined;
    const contentType = url.searchParams.get("contentType") || undefined;

    const grade = gradeParam ? Number(gradeParam) : undefined;
    if (gradeParam && Number.isNaN(grade)) {
      return NextResponse.json({ error: "grade must be a number" }, { status: 400 });
    }

    const items = await prisma.curriculumContent.findMany({
      where: {
        ...(grade !== undefined ? { grade } : {}),
        ...(subject ? { subject } : {}),
        ...(contentType ? { contentType } : {}),
      },
      select: {
        id: true,
        contentId: true,
        grade: true,
        subject: true,
        contentType: true,
        status: true,
        version: true,
        hash: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ grade: "asc" }, { subject: "asc" }, { contentId: "asc" }],
      take: 500,
    });

    return NextResponse.json({ count: items.length, items });
  } catch (e: any) {
    console.error("GET /api/curriculum failed:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/curriculum?grade=5&subject=MATH
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const gradeParam = searchParams.get("grade");
    const subject = searchParams.get("subject");
    const takeParam = searchParams.get("take");

    const grade = gradeParam ? Number(gradeParam) : undefined;
    const take = takeParam ? Number(takeParam) : 50;

    const rows = await prisma.curriculumContent.findMany({
      where: {
        ...(typeof grade === "number" && !Number.isNaN(grade) ? { grade } : {}),
        ...(subject ? { subject } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take,
      select: {
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
    });

    return NextResponse.json({ count: rows.length, items: rows });
  } catch (e: any) {
    console.error("GET /api/curriculum failed:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

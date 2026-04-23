import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { buildCurriculumDisplayTitle } from "@/lib/curriculum/title";

export const dynamic = "force-dynamic";

// GET /api/curriculum?grade=5&subject=MATH
export async function GET(req: Request) {
  try {
    const user = await requireRole("STUDENT", "TEACHER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const gradeParam = searchParams.get("grade");
    const subject = searchParams.get("subject");
    const takeParam = searchParams.get("take");

    const grade = gradeParam ? Number(gradeParam) : undefined;
    const limitParam = searchParams.get("limit");
    const take = limitParam ? Number(limitParam) : takeParam ? Number(takeParam) : 50;

    const statusFilter =
      user.role === "STUDENT"
        ? { in: ["published", "APPROVED"] }
        : { in: ["published", "APPROVED", "pending_approval", "rejected"] };

    const rows = await prisma.curriculumContent.findMany({
      where: {
        status: statusFilter,
        ...(typeof grade === "number" && !Number.isNaN(grade) ? { grade } : {}),
        ...(subject ? { subject } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take,
      select: {
        id: true,
        contentId: true,
        title: true,
        grade: true,
        subject: true,
        contentType: true,
        status: true,
        version: true,
        payload: true,
        audioAssets: {
          orderBy: { generatedAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            contentVersion: true,
            storageUrl: true,
            estimatedCostUsd: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      count: rows.length,
      items: rows.map((row) => ({
        ...row,
        audioStatus:
          row.audioAssets[0]?.contentVersion === row.version
            ? row.audioAssets[0]?.status ?? "NOT_GENERATED"
            : row.audioAssets[0]?.status === "GENERATED"
              ? "STALE"
              : row.audioAssets[0]?.status ?? "NOT_GENERATED",
        displayTitle: buildCurriculumDisplayTitle({
          title: row.title,
          subject: row.subject,
          gradeLevel: row.grade,
          payload: row.payload,
        }),
      })),
    });
  } catch (e: any) {
    console.error("GET /api/curriculum failed:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

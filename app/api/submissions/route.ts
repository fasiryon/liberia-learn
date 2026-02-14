import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// GET /api/submissions?homeworkId=...&take=50
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user.schoolId) return NextResponse.json({ error: "User missing schoolId" }, { status: 403 });

    const url = new URL(req.url);
    const homeworkId = url.searchParams.get("homeworkId") ?? undefined;
    const take = Math.min(Math.max(parseInt(url.searchParams.get("take") ?? "50", 10) || 50, 1), 200);

    if (!homeworkId) return NextResponse.json({ error: "homeworkId is required" }, { status: 400 });

    const hw = await prisma.homework.findFirst({
      where: { id: homeworkId, Class: { schoolId: user.schoolId } },
      select: { id: true },
    });
    if (!hw) return NextResponse.json({ error: "Homework not found (or not in your school)" }, { status: 404 });

    const subModel =
      (prisma as any).homeworkSubmission ??
      (prisma as any).submission ??
      (prisma as any).Submission ??
      null;

    if (!subModel) {
      return NextResponse.json(
        { error: "No submission model found on Prisma client. Expected homeworkSubmission or submission." },
        { status: 500 }
      );
    }

    const rows = await subModel.findMany({
      where: { homeworkId: hw.id },
      orderBy: { submittedAt: "desc" },
      take,
      select: { id: true, homeworkId: true, studentId: true, answers: true, submittedAt: true },
    });

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal Server Error" }, { status: e?.status ?? 500 });
  }
}
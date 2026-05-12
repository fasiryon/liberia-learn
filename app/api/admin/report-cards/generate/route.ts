import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateReportCard } from "@/lib/reportCards/generateReportCard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const body = await req.json();
    const { classId, termId } = body as { classId?: string; termId?: string };
    if (!classId || !termId) {
      return NextResponse.json({ error: "classId and termId are required" }, { status: 400 });
    }

    // Verify the class belongs to this school
    const cls = await prisma.class.findFirst({
      where: { id: classId, schoolId: user.schoolId },
    });
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Get all enrolled students
    const enrollments = await prisma.enrollment.findMany({
      where: { classId },
      select: { Student: { select: { id: true } } },
    });

    let generated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const { Student } of enrollments) {
      try {
        const existing = await prisma.reportCard.findUnique({
          where: { studentId_termId: { studentId: Student.id, termId } },
        });
        if (existing?.status === "PUBLISHED") {
          skipped++;
          continue;
        }
        await generateReportCard(Student.id, termId, classId, user.id);
        generated++;
      } catch (e: any) {
        errors.push(`Student ${Student.id}: ${e.message}`);
      }
    }

    return NextResponse.json({ generated, skipped, errors });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: e.message ?? "Internal error" }, { status: 500 });
  }
}

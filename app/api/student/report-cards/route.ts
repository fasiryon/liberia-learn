import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("STUDENT");

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) {
      return NextResponse.json({ reportCards: [] });
    }

    const reportCards = await prisma.reportCard.findMany({
      where: { studentId: student.id, status: "PUBLISHED" },
      include: {
        term: {
          include: { academicYear: { select: { yearLabel: true } } },
        },
      },
      orderBy: { generatedAt: "desc" },
    });

    return NextResponse.json({ studentId: student.id, reportCards });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: e.message ?? "Internal error" }, { status: 500 });
  }
}

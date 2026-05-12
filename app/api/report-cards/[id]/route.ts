import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();

    const card = await prisma.reportCard.findUnique({
      where: { id: params.id },
      include: {
        student: { include: { user: { select: { name: true } } } },
        term: {
          include: { academicYear: { select: { yearLabel: true } } },
        },
      },
    });

    if (!card) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Access control: ADMIN/TEACHER see any card in their school
    // STUDENT sees only their own PUBLISHED cards
    // GUARDIAN sees PUBLISHED cards for their linked children
    if (user.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (card.studentId !== student?.id || card.status !== "PUBLISHED") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    } else if (user.role === "GUARDIAN") {
      const link = await prisma.studentGuardian.findFirst({
        where: { guardianId: user.id, studentId: card.studentId },
      });
      if (!link || card.status !== "PUBLISHED") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    } else if (user.role === "TEACHER" || user.role === "ADMIN") {
      if (card.schoolId !== user.schoolId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ reportCard: card });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: e.message ?? "Internal error" }, { status: 500 });
  }
}

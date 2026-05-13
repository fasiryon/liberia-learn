import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logProductSignal } from "@/lib/autonomous/signals/productSignalService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("GUARDIAN");
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");

    // Verify this guardian is linked to the student
    const links = await prisma.studentGuardian.findMany({
      where: { guardianId: user.id },
      include: {
        student: { include: { user: { select: { name: true } } } },
      },
    });

    if (links.length === 0) {
      return NextResponse.json({ children: [], reportCards: [] });
    }

    const children = links.map(({ student }) => ({
      id: student.id,
      name: student.user.name ?? "Child",
    }));

    const targetStudentId = studentId ?? links[0].student.id;
    const isLinked = links.some((l) => l.student.id === targetStudentId);
    if (!isLinked) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const reportCards = await prisma.reportCard.findMany({
      where: { studentId: targetStudentId, status: "PUBLISHED" },
      include: {
        term: {
          include: { academicYear: { select: { yearLabel: true } } },
        },
      },
      orderBy: { generatedAt: "desc" },
    });

    if (reportCards.length > 0) {
      await logProductSignal({
        schoolId: user.schoolId,
        userId: user.id,
        studentId: targetStudentId,
        actor: { type: "user", id: user.id, role: user.role },
        target: { type: "student", id: targetStudentId },
        eventType: "guardian.report_card.viewed",
        source: "/api/guardian/report-cards",
        dedupeKey: `guardian.report_card.viewed:${user.schoolId ?? "unknown"}:${user.id}:${targetStudentId}:${new Date().toISOString().slice(0, 10)}`,
        metadata: {
          reportCardCount: reportCards.length,
          selectedStudentLinked: true,
        },
      });
    }

    return NextResponse.json({ children, reportCards, selectedStudentId: targetStudentId });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: e.message ?? "Internal error" }, { status: 500 });
  }
}

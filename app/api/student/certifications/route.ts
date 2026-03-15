import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { isExamSystemEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("STUDENT");
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) {
      return NextResponse.json({ certifications: [] });
    }

    const certifications = await prisma.examCertification.findMany({
      where: { studentId: student.id },
      include: {
        exam: {
          select: { title: true, subject: true, grade: true },
        },
      },
      orderBy: { issuedAt: "desc" },
    });

    return NextResponse.json({
      certifications: certifications.map((certification) => ({
        id: certification.id,
        examId: certification.examId,
        examTitle: certification.exam.title,
        subject: certification.subject,
        grade: certification.grade,
        score: certification.score,
        issuedAt: certification.issuedAt,
        certCode: certification.certCode,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

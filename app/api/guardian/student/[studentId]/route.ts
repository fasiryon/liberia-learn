// app/api/guardian/student/[studentId]/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkSchoolAccess } from "@/lib/tenant/assert-school-access";
import { isGuardianPortalEnabled } from "@/lib/serverFlags";
import { getPlacementOutcomeText, getPlacementReviewStatus } from "@/lib/placement";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { studentId: string } }
) {
  try {
    if (!isGuardianPortalEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const user = await requireRole("GUARDIAN");
    const { studentId } = params;

    // Verify guardian-student link
    const link = await prisma.studentGuardian.findFirst({
      where: { guardianId: user.id, studentId },
    });
    if (!link) {
      return NextResponse.json(
        { error: "You do not have access to this student" },
        { status: 403 }
      );
    }

    // Verify guardian is in the same school as the student (cross-school guard)
    const studentSchool = await prisma.student.findUnique({
      where: { id: studentId },
      select: { user: { select: { schoolId: true } } },
    });
    if (studentSchool?.user?.schoolId && user.schoolId) {
      const denied = await checkSchoolAccess(user, studentSchool.user.schoolId);
      if (denied) return denied;
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { name: true, email: true } },
        placementTests: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Last 10 homework submissions with homework title
    const homeworkSubmissions = await prisma.homeworkSubmission.findMany({
      where: { studentId },
      orderBy: { submittedAt: "desc" },
      take: 10,
      include: {
        Homework: { select: { title: true } },
      },
    });

    // Attendance last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        studentId,
        markedAt: { gte: thirtyDaysAgo },
      },
      select: { status: true },
    });

    const attendance = {
      present: attendanceRecords.filter((a) => a.status === "PRESENT").length,
      absent: attendanceRecords.filter((a) => a.status === "ABSENT").length,
      late: attendanceRecords.filter((a) => a.status === "LATE").length,
    };

    // Lesson views last 30 days
    const lessonViews = await prisma.auditLog.count({
      where: {
        userId: student.userId,
        action: "lesson_view",
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.user.name,
        email: student.user.email,
        currentGrade: student.currentGrade,
        relation: link.relation,
      },
      placementTests: (student.placementTests ?? []).map((pt) => ({
        id: pt.id,
        band: pt.band,
        estimatedGrade: pt.estimatedGrade,
        teacherDecision: pt.teacherDecision,
        teacherGrade: pt.teacherGrade,
        teacherReason: pt.teacherReason,
        levelLabel: pt.levelLabel,
        rawScore: pt.rawScore,
        totalQuestions: pt.totalQuestions,
        createdAt: pt.createdAt,
        status: getPlacementReviewStatus(pt.teacherDecision),
        summary: getPlacementOutcomeText({
          estimatedGrade: pt.estimatedGrade,
          teacherDecision: pt.teacherDecision,
          teacherGrade: pt.teacherGrade,
        }),
      })),
      homeworkSubmissions: homeworkSubmissions.map((hs) => ({
        id: hs.id,
        title: hs.Homework.title,
        submittedAt: hs.submittedAt,
        aiScore: hs.aiReviewed ? hs.aiScore : null,
        teacherScore: hs.teacherScore,
        aiReviewed: hs.aiReviewed,
      })),
      attendance,
      lessonViews,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}

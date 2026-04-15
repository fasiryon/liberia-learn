// app/api/student/passport/route.ts — Sprint 6
// GET /api/student/passport
//   - STUDENT: returns their own learning passport
//   - GUARDIAN: returns linked student's passport via ?studentId=<Student.id>
// No MOE access — individual student passports are not exposed to MOE dashboard.

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildStudentPassport } from "@/lib/passport/buildStudentPassport";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { logDataAccess } from "@/lib/dataAccess/logDataAccess";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("STUDENT", "GUARDIAN");

    let studentId: string;

    if (user.role === "STUDENT") {
      // Resolve Student row from User.id
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!student) {
        return NextResponse.json({ error: "Student record not found" }, { status: 404 });
      }
      studentId = student.id;
    } else {
      // GUARDIAN — must supply ?studentId and must have a StudentGuardian link
      const rawStudentId = req.nextUrl.searchParams.get("studentId");
      if (!rawStudentId) {
        return NextResponse.json(
          { error: "studentId query parameter is required for guardians" },
          { status: 400 }
        );
      }

      const link = await prisma.studentGuardian.findFirst({
        where: { guardianId: user.id, studentId: rawStudentId },
        select: { studentId: true },
      });
      if (!link) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      studentId = link.studentId;
    }

    const passport = await buildStudentPassport(studentId);

    void logDataAccess({
      userId: user.id,
      schoolId: user.schoolId ?? null,
      resourceType: "student_passport",
      resourceId: studentId,
      action: "view",
      scope: user.role === "GUARDIAN" ? "guardian_linked_student" : "own_student",
      metadata: { role: user.role },
    });

    logLearningEvent({
      userId: user.id,
      studentId,
      eventType: "student.passport.viewed",
      metadata: { role: user.role },
    }).catch(() => {});

    return NextResponse.json(passport);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

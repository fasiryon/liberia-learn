// app/api/student/placement/route.ts
import { NextResponse } from "next/server";
// route-policy: auth=session; scope=tenant; authority=student-membership; rationale=diagnostic placement is tenant-bound and cannot change administrative grade
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const user = await requireRole("STUDENT");

    const student = await prisma.student.findFirst({
      where: {
        userId: user.id,
        user: { schoolId: user.schoolId ?? null },
      },
      select: { id: true, currentGrade: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student record not found" }, { status: 404 });
    }

    const body = await req.json();

    const {
      band,
      levelLabel,
      estimatedGrade,
      rawScore,
      totalQuestions,
      details,
      questions,
      answers,
      aiAnalysis,
    } = body ?? {};

    if (
      typeof band !== "string" ||
      typeof levelLabel !== "string" ||
      typeof estimatedGrade !== "number" ||
      typeof rawScore !== "number" ||
      typeof totalQuestions !== "number"
    ) {
      return NextResponse.json(
        { error: "Missing or invalid placement payload" },
        { status: 400 }
      );
    }

    const placementData: any = {
      studentId: student.id,
      band,
      levelLabel,
      estimatedGrade,
      rawScore,
      totalQuestions,
      details: details ?? null,
      questions: questions ?? null,
      answers: answers ?? null,
      aiAnalysis: aiAnalysis ?? null,
    };

    // Placement is diagnostic evidence only. Administrative grade changes
    // remain behind teacher review and the enrollment/promotion authority.
    const placement = await prisma.placementTest.create({ data: placementData });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId ?? null,
      action: "student.placement.created",
      resourceType: "placement_test",
      resourceId: placement.id,
      details: {
        band,
        estimatedGrade,
        rawScore,
        totalQuestions,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        placement,
        currentGrade: student.currentGrade,
        recommendedGrade: estimatedGrade,
        administrativeGradeChanged: false,
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Placement API error:", err);
    return NextResponse.json(
      { error: "Failed to record placement test" },
      { status: 500 }
    );
  }
}

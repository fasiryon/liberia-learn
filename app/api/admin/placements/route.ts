import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlacementReviewStatus } from "@/lib/placement";

export const dynamic = "force-dynamic";

function toCsv(rows: string[][]) {
  return rows
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const requestedSchoolId = url.searchParams.get("schoolId");
    const format = url.searchParams.get("format");
    const schoolId = user.isPlatformAdmin ? requestedSchoolId ?? user.schoolId ?? null : user.schoolId ?? null;

    if (!schoolId) {
      return NextResponse.json({ error: "schoolId is required" }, { status: 400 });
    }

    const placements = await prisma.placementTest.findMany({
      where: {
        student: {
          user: {
            schoolId,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    const rows = placements.map((placement) => ({
      id: placement.id,
      studentName: placement.student.user.name ?? placement.student.user.email ?? "Student",
      currentGrade: placement.student.currentGrade,
      testDate: placement.createdAt.toISOString(),
      aiGrade: placement.estimatedGrade,
      band: placement.band,
      levelLabel: placement.levelLabel,
      teacherGrade: placement.teacherGrade,
      teacherDecision: placement.teacherDecision,
      teacherReason: placement.teacherReason,
      status: getPlacementReviewStatus(placement.teacherDecision),
      aiAnalysis: placement.aiAnalysis,
    }));

    const reviewed = rows.filter((row) => row.status !== "pending");
    const overridden = rows.filter((row) => row.status === "overridden");
    const overrideRate = reviewed.length > 0 ? Math.round((overridden.length / reviewed.length) * 100) : 0;

    const summary = {
      totalPlacements: rows.length,
      pendingTeacherReview: rows.filter((row) => row.status === "pending").length,
      aiConfirmed: rows.filter((row) => row.status === "confirmed").length,
      aiOverridden: overridden.length,
      overrideRate,
      calibrationSignal:
        overrideRate <= 15
          ? { label: "AI is well-calibrated", level: "green" }
          : overrideRate <= 30
          ? { label: "Review AI calibration", level: "amber" }
          : { label: "AI needs recalibration", level: "red" },
    };

    if (format === "csv") {
      const csv = toCsv([
        [
          "Student",
          "Current Grade",
          "Test Date",
          "AI Grade",
          "Band",
          "Teacher Grade",
          "Decision",
          "Override Reason",
          "AI Analysis",
        ],
        ...rows.map((row) => [
          row.studentName,
          String(row.currentGrade ?? ""),
          row.testDate,
          String(row.aiGrade),
          row.levelLabel,
          String(row.teacherGrade ?? ""),
          row.status,
          row.teacherReason ?? "",
          JSON.stringify(row.aiAnalysis ?? {}),
        ]),
      ]);

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="placements-${schoolId}.csv"`,
        },
      });
    }

    return NextResponse.json({ summary, placements: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}

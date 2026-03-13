import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { notifyPlacementConfirmation } from "@/lib/placement-notifications";

export const dynamic = "force-dynamic";

function isValidDecision(value: unknown): value is "confirm" | "override" {
  return value === "confirm" || value === "override";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const { id } = await params;
    const body = await req.json();
    const { decision, overrideGrade, overrideReason } = body ?? {};

    if (!isValidDecision(decision)) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    }

    if (decision === "override") {
      if (typeof overrideGrade !== "number" || overrideGrade < 1 || overrideGrade > 12) {
        return NextResponse.json({ error: "overrideGrade must be between 1 and 12" }, { status: 400 });
      }
      if (typeof overrideReason !== "string" || overrideReason.trim().length < 20) {
        return NextResponse.json({ error: "overrideReason must be at least 20 characters" }, { status: 400 });
      }
    }

    const placement = await prisma.placementTest.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                schoolId: true,
                guardianPhoneE164: true,
                school: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            guardians: {
              select: {
                guardianId: true,
                guardian: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!placement) {
      return NextResponse.json({ error: "Placement not found" }, { status: 404 });
    }

    if (placement.student.user.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const finalGrade = decision === "override" ? overrideGrade : placement.estimatedGrade;
    const reviewedAt = new Date();

    const updatedPlacement = await prisma.$transaction(async (tx) => {
      const nextPlacement = await tx.placementTest.update({
        where: { id: placement.id },
        data: {
          teacherDecision: decision === "confirm" ? "confirmed" : "overridden",
          teacherGrade: decision === "override" ? overrideGrade : null,
          teacherReason: decision === "override" ? overrideReason.trim() : null,
          reviewedAt,
          reviewedBy: user.id,
        },
      });

      await tx.student.update({
        where: { id: placement.studentId },
        data: {
          currentGrade: finalGrade,
        },
      });

      return nextPlacement;
    });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "teacher.placement.reviewed",
      resourceType: "placement_test",
      resourceId: placement.id,
      details: {
        decision,
        estimatedGrade: placement.estimatedGrade,
        finalGrade,
        overrideReason: decision === "override" ? overrideReason.trim() : null,
      },
    });

    try {
      await notifyPlacementConfirmation({
        actingUserId: user.id,
        schoolId: user.schoolId,
        schoolName: placement.student.user.school?.name ?? "LiberiaLearn",
        student: {
          id: placement.studentId,
          userId: placement.student.user.id,
          name: placement.student.user.name ?? null,
          phone: placement.student.user.guardianPhoneE164 ?? null,
          guardians: placement.student.guardians.map((link) => ({
            guardianId: link.guardianId,
            guardianName: link.guardian.name ?? null,
          })),
        },
        finalGrade,
      });
    } catch (notificationError) {
      console.error("Placement confirmation notification failed", notificationError);
    }

    return NextResponse.json({
      reviewed: true,
      placement: {
        id: updatedPlacement.id,
        teacherDecision: updatedPlacement.teacherDecision,
        teacherGrade: updatedPlacement.teacherGrade,
        teacherReason: updatedPlacement.teacherReason,
        reviewedAt: updatedPlacement.reviewedAt?.toISOString() ?? null,
      },
      finalGrade,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}

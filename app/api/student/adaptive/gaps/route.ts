import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { detectMasteryGaps } from "@/lib/adaptive/gapDetector";
import { isAdaptiveEngineEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isAdaptiveEngineEnabled()) {
      return NextResponse.json({ error: "adaptive_engine_disabled" }, { status: 404 });
    }

    const user = await requireRole("STUDENT");
    const student = await prisma.student.findFirst({
      where: {
        userId: user.id,
        user: { schoolId: user.schoolId ?? null },
      },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ error: "student_not_found" }, { status: 404 });
    }

    const gaps = await detectMasteryGaps(student.id);

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "student.adaptive.gaps.viewed",
      resourceType: "adaptive_gap",
      details: { gapCount: gaps.length },
    });

    return NextResponse.json({ gaps });
  } catch (error: any) {
    console.error("[adaptive.gaps.GET]", error);
    return NextResponse.json(
      { error: error?.message ?? "Server error" },
      { status: error?.status ?? 500 }
    );
  }
}

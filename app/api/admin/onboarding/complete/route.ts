import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 400 });

    const now = new Date();

    await prisma.schoolOnboarding.upsert({
      where: { schoolId: user.schoolId },
      update: { completed: true, completedAt: now, step: 5 },
      create: { schoolId: user.schoolId, step: 5, completed: true, completedAt: now },
    });

    await prisma.school.update({
      where: { id: user.schoolId },
      data: { onboardingStep: 5 },
    });

    void logAudit({
      userId: user.id,
      action: "onboarding.completed",
      resourceType: "school",
      resourceId: user.schoolId,
      details: {} as any,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}

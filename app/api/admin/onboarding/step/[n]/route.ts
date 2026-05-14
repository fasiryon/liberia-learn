import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { n: string } }
) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 400 });

    const stepNum = parseInt(params.n, 10);
    if (isNaN(stepNum) || stepNum < 1 || stepNum > 5) {
      return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }

    const body = await req.json();

    // Load or create the SchoolOnboarding record
    let onboarding = await prisma.schoolOnboarding.findUnique({
      where: { schoolId: user.schoolId },
    });

    if (!onboarding) {
      onboarding = await prisma.schoolOnboarding.create({
        data: { schoolId: user.schoolId, step: 1 },
      });
    }

    // Enforce sequential progress — cannot skip ahead
    if (stepNum > onboarding.step + 1) {
      return NextResponse.json(
        { error: `Complete step ${onboarding.step} first` },
        { status: 400 }
      );
    }

    // Validate gates per step
    if (stepNum === 2) {
      const teacherCount = await prisma.user.count({
        where: { schoolId: user.schoolId, role: "TEACHER" },
      });
      if (teacherCount < 1) {
        return NextResponse.json({ error: "Add at least 1 teacher before proceeding" }, { status: 400 });
      }
    }

    if (stepNum === 3) {
      const studentCount = await prisma.user.count({
        where: { schoolId: user.schoolId, role: "STUDENT" },
      });
      if (studentCount < 1) {
        return NextResponse.json({ error: "Import at least 1 student before proceeding" }, { status: 400 });
      }
    }

    // Persist step-level data to School model
    const schoolUpdate: Record<string, unknown> = {};

    if (stepNum === 1) {
      if (body.name) schoolUpdate.name = body.name;
      if (body.address) schoolUpdate.contactEmail = body.address; // reuse contactEmail for address for now
      if (body.principalName) schoolUpdate.contactName = body.principalName;
      if (body.phone) schoolUpdate.contactPhone = body.phone;
      if (body.schoolType) schoolUpdate.schoolType = body.schoolType;
      if (body.logoUrl !== undefined) schoolUpdate.logoUrl = body.logoUrl || null;
    }

    if (Object.keys(schoolUpdate).length > 0) {
      await prisma.school.update({ where: { id: user.schoolId }, data: schoolUpdate });
    }

    // Advance onboarding step
    const nextStep = Math.max(onboarding.step, stepNum);
    await prisma.schoolOnboarding.update({
      where: { schoolId: user.schoolId },
      data: { step: nextStep, metadata: body.metadata ?? onboarding.metadata },
    });

    // Mirror to legacy onboardingStep on School
    await prisma.school.update({
      where: { id: user.schoolId },
      data: { onboardingStep: nextStep },
    });

    void logAudit({
      userId: user.id,
      action: "onboarding.step_completed",
      resourceType: "school",
      resourceId: user.schoolId,
      details: { step: stepNum } as any,
    });

    return NextResponse.json({ success: true, step: nextStep });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}

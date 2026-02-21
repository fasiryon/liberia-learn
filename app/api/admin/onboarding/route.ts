import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 400 });

    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: {
        id: true, name: true, county: true, motto: true, contactName: true,
        primaryHex: true, logoUrl: true, onboardingStep: true,
      },
    });

    const teacherCount = await prisma.user.count({ where: { schoolId: user.schoolId, role: "TEACHER" } });
    const classCount = await prisma.class.count({ where: { schoolId: user.schoolId } });

    return NextResponse.json({ school, teacherCount, classCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 400 });

    const body = await req.json();
    const { step, data } = body;

    if (typeof step !== "number" || step < 1 || step > 5) {
      return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }

    const updateData: any = {};

    // Step 1: School identity
    if (step === 1) {
      if (data.name) updateData.name = data.name;
      if (data.county) updateData.county = data.county;
      if (data.motto) updateData.motto = data.motto;
      if (data.contactName) updateData.contactName = data.contactName;
    }

    // Step 2: Branding
    if (step === 2) {
      if (data.primaryHex) updateData.primaryHex = data.primaryHex;
      if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl || null;
    }

    // Step 5: Mark complete
    if (step >= updateData.onboardingStep || step === 5) {
      updateData.onboardingStep = step;
    }

    await prisma.school.update({ where: { id: user.schoolId }, data: updateData });

    await logAudit({
      userId: user.id,
      action: "onboarding.step_completed",
      resourceType: "school",
      resourceId: user.schoolId,
      details: { step } as any,
    });

    return NextResponse.json({ success: true, step });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}


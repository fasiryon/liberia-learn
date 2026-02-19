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
        id: true,
        name: true,
        county: true,
        district: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        motto: true,
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

    const existing = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { id: true, onboardingStep: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const existingStep = existing.onboardingStep ?? 0;
    const updateData: any = {};

    // Step 1: School identity
    if (step === 1) {
      const name = data.name?.trim();
      const county = data.county?.trim();
      const district = data.district?.trim();
      const contactEmail = data.contactEmail?.trim();
      const contactPhone = data.contactPhone?.trim();

      if (!name) return NextResponse.json({ error: "School name is required" }, { status: 400 });
      if (!county) return NextResponse.json({ error: "County is required" }, { status: 400 });
      if (!district) return NextResponse.json({ error: "District is required" }, { status: 400 });
      if (!contactEmail) return NextResponse.json({ error: "Contact email is required" }, { status: 400 });
      if (!contactPhone) return NextResponse.json({ error: "Contact phone is required" }, { status: 400 });

      if (!/^\S+@\S+\.\S+$/.test(contactEmail)) {
        return NextResponse.json({ error: "Contact email is invalid" }, { status: 400 });
      }

      updateData.name = name;
      updateData.county = county;
      updateData.district = district;
      updateData.contactEmail = contactEmail;
      updateData.contactPhone = contactPhone;
      if (data.motto) updateData.motto = data.motto;
      if (data.contactName) updateData.contactName = data.contactName;
    }

    // Step 2: Branding
    if (step === 2) {
      if (data.primaryHex) updateData.primaryHex = data.primaryHex;
      if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl || null;
    }

    const shouldAdvance = step > existingStep || (step === 5 && existingStep < 5);
    if (shouldAdvance) {
      updateData.onboardingStep = step;
    }

    await prisma.school.update({ where: { id: user.schoolId }, data: updateData });

    if (shouldAdvance) {
      await logAudit({
        userId: user.id,
        schoolId: user.schoolId,
        action: "onboarding.step_completed",
        resourceType: "school",
        resourceId: user.schoolId,
        details: {
          step: { from: existingStep, to: step },
        },
      });
    }

    return NextResponse.json({ success: true, step });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}

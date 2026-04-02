import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH() {
  try {
    const user = await requireRole("TEACHER");
    const existing = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        schoolId: true,
        fullName: true,
      },
    });

    const schoolId = existing?.schoolId ?? user.schoolId ?? "";
    if (!schoolId) {
      return NextResponse.json(
        { error: "Teacher school is missing" },
        { status: 400 }
      );
    }

    await prisma.teacherProfile.upsert({
      where: { userId: user.id },
      update: {
        isOnboarded: true,
        onboardedAt: new Date(),
      },
      create: {
        id: existing?.id ?? user.id,
        fullName: existing?.fullName ?? user.name ?? "Teacher",
        isOnboarded: true,
        onboardedAt: new Date(),
        updatedAt: new Date(),
        User: { connect: { id: user.id } },
        School: { connect: { id: schoolId } },
      },
    });

    void logAudit({
      userId: user.id,
      schoolId,
      action: "teacher.onboarding.completed",
      resourceType: "teacher_onboarding",
      resourceId: user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to complete onboarding" },
      { status: err?.status ?? 500 }
    );
  }
}

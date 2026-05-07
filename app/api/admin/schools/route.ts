// app/api/admin/schools/route.ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { randomUUID } from "crypto";
import { enqueueJob, JobType } from "@/lib/queue";

function isSchoolOnboardingKitFlagEnabled() {
  const value = process.env.ENABLE_SCHOOL_ONBOARDING_KITS;
  if (value != null) return value === "true";
  return process.env.NODE_ENV !== "production";
}

export async function POST(request: Request) {
  const traceId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" || !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();

    const name = (formData.get("name") as string | null)?.trim();
    const timezone = (formData.get("timezone") as string | null)?.trim() || "Africa/Monrovia";
    const primaryHex =
      (formData.get("primaryHex") as string | null)?.trim() || "#22c55e";
    const secondaryHex =
      (formData.get("secondaryHex") as string | null)?.trim() || "#0ea5e9";

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const id = `school-${Date.now()}`;

    await prisma.school.create({
      data: {
        id,
        name,
        timezone,
        primaryHex,
        secondaryHex,
      },
    });

    await logAudit({
      userId: user.id,
      action: "admin.school.created",
      resourceType: "school",
      resourceId: id,
      schoolId: user.schoolId ?? null,
      traceId,
      details: { name },
    });

    if (isSchoolOnboardingKitFlagEnabled()) {
      await prisma.school.update({
        where: { id },
        data: { onboardingKitStatus: "pending" },
      });
      await enqueueJob(JobType.GENERATE_SCHOOL_ONBOARDING_KIT, {
        schoolId: id,
        actorUserId: user.id,
      });
      await logAudit({
        userId: user.id,
        action: "school.onboarding_kit.enqueued",
        resourceType: "school",
        resourceId: id,
        schoolId: id,
        traceId,
      });
    }

    return NextResponse.redirect(new URL("/admin/schools", request.url));
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error creating school:", err);
    return NextResponse.json(
      { error: "Failed to create school" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isGoogleSsoFlagEnabled } from "@/lib/flags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("ADMIN");
    const schoolId = user.schoolId;
    if (!schoolId) {
      return NextResponse.json({ error: "No school assigned" }, { status: 400 });
    }
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        approvalRequired: true,
        allowTeacherPublish: true,
        allowBlueprintAdoption: true,
        googleSsoEnabled: true,
      },
    });
    return NextResponse.json(school ?? {});
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    const schoolId = user.schoolId;
    if (!schoolId) {
      return NextResponse.json({ error: "No school assigned" }, { status: 400 });
    }

    const body = await req.json();
    const data: Record<string, boolean> = {};

    if (typeof body.approvalRequired === "boolean") data.approvalRequired = body.approvalRequired;
    if (typeof body.allowTeacherPublish === "boolean") data.allowTeacherPublish = body.allowTeacherPublish;
    if (typeof body.allowBlueprintAdoption === "boolean") data.allowBlueprintAdoption = body.allowBlueprintAdoption;
    if (typeof body.googleSsoEnabled === "boolean") {
      if (!(await isGoogleSsoFlagEnabled())) {
        return NextResponse.json({ error: "google_sso_disabled" }, { status: 403 });
      }
      data.googleSsoEnabled = body.googleSsoEnabled;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.school.update({
      where: { id: schoolId },
      data,
      select: {
        approvalRequired: true,
        allowTeacherPublish: true,
        allowBlueprintAdoption: true,
        googleSsoEnabled: true,
      },
    });

    await logAudit({
      userId: user.id,
      action: "school.settings.update",
      resourceType: "school",
      resourceId: schoolId,
      details: data as Record<string, unknown>,
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { requireMoeActor } from "@/lib/moe/authority";

export const dynamic = "force-dynamic";
const policyPrisma = prisma as typeof prisma & {
  policyOverride: typeof prisma extends object ? any : never;
};

export async function GET() {
  try {
    const { user, scope } = await requireMoeActor({ allowDistrict: true });
    assertPermission(user, scope.level === "district" ? PERMISSIONS.MOE_ACCESS_DISTRICT : PERMISSIONS.CURRICULUM_OVERRIDE);
    const overrides = await policyPrisma.policyOverride.findMany({
      where: scope.level === "national" ? {} : { OR: [{ districtId: scope.districtId }, { schoolId: { in: scope.schoolIds } }] },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ overrides, scope });
  } catch (error) {
    return handleApiError(error, { route: "/api/moe/override", method: "GET" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, scope } = await requireMoeActor({ allowDistrict: true });
    assertPermission(user, PERMISSIONS.CURRICULUM_OVERRIDE);
    const body = (await req.json()) as {
      policyKey?: string;
      targetType?: string;
      targetId?: string | null;
      reason?: string;
      overrideData?: Record<string, unknown>;
      expiresAt?: string | null;
      schoolId?: string | null;
      districtId?: string | null;
      policyId?: string | null;
    };

    if (!body.policyKey || !body.targetType || !body.reason || !body.overrideData) {
      throw Object.assign(new Error("policyKey, targetType, reason, and overrideData are required"), { status: 400 });
    }

    const override = await policyPrisma.policyOverride.create({
      data: {
        policyKey: body.policyKey,
        targetType: body.targetType,
        targetId: body.targetId ?? null,
        reason: body.reason,
        overrideData: body.overrideData,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        schoolId: body.schoolId ?? null,
        districtId: body.districtId ?? scope.districtId,
        policyId: body.policyId ?? null,
        createdById: user.id,
      },
    });

    await logAudit({
      userId: user.id,
      action: "moe.override.created",
      resourceType: "policy_override",
      resourceId: override.id,
      details: { policyKey: override.policyKey, targetType: override.targetType, targetId: override.targetId },
    });

    return NextResponse.json({ override }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { route: "/api/moe/override", method: "POST" });
  }
}

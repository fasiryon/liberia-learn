import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { requireMoeActor } from "@/lib/moe/authority";

export const dynamic = "force-dynamic";
const policyPrisma = prisma as typeof prisma & {
  policyConfig: typeof prisma extends object ? any : never;
};

export async function GET() {
  try {
    const { user, scope } = await requireMoeActor({ allowDistrict: true });
    assertPermission(
      user,
      scope.level === "district" ? PERMISSIONS.MOE_ACCESS_DISTRICT : PERMISSIONS.POLICY_CONTROL
    );

    const policies = await policyPrisma.policyConfig.findMany({
      where: scope.level === "national" ? {} : { OR: [{ scope: "NATIONAL" }, { districtId: scope.districtId }] },
      orderBy: [{ policyKey: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ policies, scope });
  } catch (error) {
    return handleApiError(error, { route: "/api/moe/policies", method: "GET" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, scope } = await requireMoeActor({ allowDistrict: true });
    assertPermission(user, PERMISSIONS.POLICY_CONTROL);
    const body = (await req.json()) as {
      policyKey?: string;
      scope?: "NATIONAL" | "DISTRICT" | "SCHOOL";
      districtId?: string | null;
      schoolId?: string | null;
      config?: Record<string, unknown>;
      isActive?: boolean;
    };

    if (!body.policyKey || !body.scope || !body.config) {
      throw Object.assign(new Error("policyKey, scope, and config are required"), { status: 400 });
    }

    const policy = await policyPrisma.policyConfig.create({
      data: {
        policyKey: body.policyKey,
        scope: body.scope,
        districtId: body.scope === "DISTRICT" ? body.districtId ?? scope.districtId : null,
        schoolId: body.scope === "SCHOOL" ? body.schoolId ?? user.schoolId ?? null : null,
        config: body.config,
        isActive: body.isActive ?? true,
        createdById: user.id,
        updatedById: user.id,
      },
    });

    await logAudit({
      userId: user.id,
      action: "moe.policy.created",
      resourceType: "policy_config",
      resourceId: policy.id,
      details: { policyKey: policy.policyKey, scope: policy.scope },
    });

    return NextResponse.json({ policy }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { route: "/api/moe/policies", method: "POST" });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { requireMoeActor } from "@/lib/moe/authority";
import { isCurriculumVersionStandardizationEnabled } from "@/lib/serverFlags";
import { buildCurriculumVersionDriftSummary } from "@/lib/moe/policyGovernance";

export const dynamic = "force-dynamic";
const policyPrisma = prisma as typeof prisma & {
  curriculumVersion: typeof prisma extends object ? any : never;
};

export async function GET() {
  try {
    const { user } = await requireMoeActor();
    assertPermission(user, PERMISSIONS.CURRICULUM_VERSION_MANAGE);

    const versions = await policyPrisma.curriculumVersion.findMany({
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { contents: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    const driftSummary = isCurriculumVersionStandardizationEnabled()
      ? await buildCurriculumVersionDriftSummary()
      : null;

    return NextResponse.json({ versions, driftSummary });
  } catch (error) {
    return handleApiError(error, { route: "/api/moe/curriculum/version", method: "GET" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireMoeActor();
    assertPermission(user, PERMISSIONS.CURRICULUM_VERSION_MANAGE);
    const body = (await req.json()) as { versionName?: string };
    const versionName = body.versionName?.trim();
    if (!versionName) {
      throw Object.assign(new Error("versionName is required"), { status: 400 });
    }

    const version = await policyPrisma.curriculumVersion.create({
      data: {
        versionName,
        createdById: user.id,
      },
    });

    await logAudit({
      userId: user.id,
      action: "moe.curriculum_version.created",
      resourceType: "curriculum_version",
      resourceId: version.id,
      details: { versionName },
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { route: "/api/moe/curriculum/version", method: "POST" });
  }
}

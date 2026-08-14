import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { requireMoeActor } from "@/lib/moe/authority";
import { validateCurriculumApproval } from "@/lib/policy/policyEngine";
import { transitionMoeDirective } from "@/lib/moe/policyGovernance";
import { updateCurriculumReleaseProjectionMany } from "@/lib/curriculum/mutations/repository";
import { isP2bReviewOperationsEnabled } from "@/lib/serverFlags";
import { assertMoeReleaseReady } from "@/lib/curriculum/review/legacyAdapter";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireMoeActor();
    assertPermission(user, PERMISSIONS.CURRICULUM_OVERRIDE);
    const body = (await req.json()) as { versionId?: string; contentIds?: string[]; archive?: boolean; directiveId?: string };
    if (!body.versionId) {
      throw Object.assign(new Error("versionId is required"), { status: 400 });
    }

    const nextStatus = body.archive ? "ARCHIVED" : "ACTIVE";
    const releaseContentIds = !body.archive && isP2bReviewOperationsEnabled()
      ? await assertMoeReleaseReady(body.versionId, body.contentIds)
      : body.contentIds;
    await validateCurriculumApproval({
      schoolId: user.schoolId ?? null,
      districtId: null,
      nextStatus,
    });

    const result = await prisma.$transaction(async (tx) => {
      const scopedTx = tx as typeof tx & {
        curriculumVersion: any;
        curriculumContent: any;
      };
      if (!body.archive) {
        await scopedTx.curriculumVersion.updateMany({
          where: { status: "ACTIVE", NOT: { id: body.versionId } },
          data: { status: "ARCHIVED" },
        });
      }

      const version = await scopedTx.curriculumVersion.update({
        where: { id: body.versionId },
        data: { status: nextStatus },
      });

      if (Array.isArray(releaseContentIds) && releaseContentIds.length > 0) {
        await updateCurriculumReleaseProjectionMany(scopedTx, {
          contentId: { in: releaseContentIds },
        }, {
          versionId: version.id,
          status: body.archive ? "archived" : "published",
        });
      }

      return version;
    });

    await logAudit({
      userId: user.id,
      action: body.archive ? "moe.curriculum_version.archived" : "moe.curriculum_version.published",
      resourceType: "curriculum_version",
      resourceId: result.id,
      details: { contentCount: body.contentIds?.length ?? 0 },
    });

    if (body.directiveId && !body.archive) {
      await transitionMoeDirective({
        directiveId: body.directiveId,
        userId: user.id,
        nextStatus: "published",
        reason: "Published with curriculum version activation",
      });
    }

    return NextResponse.json({ version: result });
  } catch (error) {
    return handleApiError(error, { route: "/api/moe/curriculum/publish", method: "POST" });
  }
}

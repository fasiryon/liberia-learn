import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { requireMoeActor } from "@/lib/moe/authority";
import { isMoeGovernanceWorkflowEnabled, isMoePolicyPushEnabled } from "@/lib/serverFlags";
import { transitionMoeDirective, type DirectiveStatus } from "@/lib/moe/policyGovernance";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { directiveId: string } }) {
  try {
    if (!isMoePolicyPushEnabled() || !isMoeGovernanceWorkflowEnabled()) {
      throw Object.assign(new Error("MOE policy governance workflow is disabled"), { status: 503 });
    }

    const { user } = await requireMoeActor();
    assertPermission(user, PERMISSIONS.POLICY_CONTROL);
    const body = (await req.json()) as { status?: DirectiveStatus; reason?: string | null };
    if (!body.status) {
      throw Object.assign(new Error("status is required"), { status: 400 });
    }

    const directive = await transitionMoeDirective({
      directiveId: params.directiveId,
      userId: user.id,
      nextStatus: body.status,
      reason: body.reason ?? null,
    });

    return NextResponse.json({ directive });
  } catch (error) {
    return handleApiError(error, { route: "/api/moe/policies/[directiveId]", method: "PATCH" });
  }
}

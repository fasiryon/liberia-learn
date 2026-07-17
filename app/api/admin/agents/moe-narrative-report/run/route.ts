/**
 * POST /api/admin/agents/moe-narrative-report/run
 *
 * Manual trigger for the moe-narrative-report agent (Sprint 6.3), mirroring
 * /api/admin/agents/echo/run's shape. Platform-admin only (not school ADMIN,
 * unlike the echo test route) - this agent's costLimits are shared across
 * ALL scopes nationally, and generating a report always costs real LLM spend,
 * so triggering it manually is a platform-level action, not a per-school one.
 * Gated at the runtime by AGENT_MOE_REPORT_ENABLED (FEATURE_DISABLED when off).
 *
 * Body: { scope: "national"|"district"|"school", scopeId?: string,
 *         periodType: "monthly"|"quarterly", periodStart: string, periodEnd: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import "@/lib/agents/bootstrap";
import { runAgent } from "@/lib/agents/runtime";

const SCOPES = new Set(["national", "district", "school"]);
const PERIOD_TYPES = new Set(["monthly", "quarterly"]);

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    assertPermission(user, PERMISSIONS.AGENT_PLATFORM_VIEW);

    const body = await req.json().catch(() => ({}));
    const { scope, scopeId, periodType, periodStart, periodEnd } = body ?? {};

    if (typeof scope !== "string" || !SCOPES.has(scope)) {
      return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
    }
    if (scope !== "national" && (typeof scopeId !== "string" || !scopeId)) {
      return NextResponse.json({ error: "scopeId_required" }, { status: 400 });
    }
    if (typeof periodType !== "string" || !PERIOD_TYPES.has(periodType)) {
      return NextResponse.json({ error: "invalid_periodType" }, { status: 400 });
    }
    if (typeof periodStart !== "string" || typeof periodEnd !== "string") {
      return NextResponse.json({ error: "period_required" }, { status: 400 });
    }

    // Deliberately verbose and explicit (not just terse key:value pairs) -
    // a short instruction classifies as the "fast" tier (a small model),
    // which was observed calling the tool by a wrong abbreviated name
    // (e.g. "moe.getScopeData" instead of "moereport.getScopeData",
    // apparently reading the "(moe)" domain tag in the tool listing as a
    // shorter alias) across multiple real attempts. Restating the exact
    // tool name repeatedly, and pushing the message length past
    // classifyMessage's smart-tier threshold, both reduce that risk - the
    // larger "smart" tier model handles the correct name reliably.
    const instruction = [
      `Generate a narrative MOE progress report for the following request.`,
      `Requested scope: ${scope}${scopeId ? ` (scopeId: ${scopeId})` : " (no scopeId - this is the whole nation, not one district or school)"}.`,
      `Requested period type: ${periodType}, covering ${periodStart} through ${periodEnd} inclusive.`,
      `Your first tool call must be exactly "moereport.getScopeData" (the full name, including the "moereport." prefix - do not shorten it to "moe" or call it "getScopeData" without the prefix) with scope=${scope}, ${scopeId ? `scopeId=${scopeId}, ` : ""}periodStart=${periodStart}, and periodEnd=${periodEnd}.`,
      `After that succeeds, follow the rest of your system instructions: check for a prior report with moereport.getPriorReport, compare with moereport.detectNotableChanges if one exists, write the narrative, and save it with moereport.saveDraftReport.`,
    ].join(" ");

    // userRole here is "system", not "admin" - this agent's rolesAllowed is
    // ["system"] (spec: invoked by schedule or an explicit trigger, never a
    // chat interface). The platform-admin check above already gates who may
    // hit this HTTP endpoint; userRole is what the invocation is attributed
    // as internally, matching content-qa-sweep's identical pattern.
    const result = await runAgent("moe-narrative-report", instruction, {
      userId: user.id,
      userRole: "system",
      schoolId: user.schoolId ?? null,
      traceId: randomUUID(),
      triggeredBy: "USER",
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: "request_failed" }, { status });
  }
}

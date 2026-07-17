/**
 * POST /api/admin/agents/district-update/run
 *
 * Manual trigger for the district-update agent (Sprint 6.4), mirroring
 * moe-narrative-report/run's shape and lessons learned: the instruction is
 * deliberately verbose and restates exact tool names, since Sprint 6.3 found
 * a short instruction classifies as the "fast" tier (a small model) that
 * mis-named tools by reading a domain tag as a shortened alias. Platform-
 * admin only, matching moe-narrative-report's precedent - generating a draft
 * always costs real LLM spend, and this route can target any school/
 * district/class, not just the caller's own. Gated at the runtime by
 * AGENT_DISTRICT_UPDATE_ENABLED (FEATURE_DISABLED when off).
 *
 * Body (type "standings"): { type: "standings", scope: "district"|"school",
 *   scopeId: string, periodType: "weekly"|"monthly" }
 * Body (type "milestone"): { type: "milestone", scope: "school"|"class",
 *   scopeId: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import "@/lib/agents/bootstrap";
import { runAgent } from "@/lib/agents/runtime";

const STANDINGS_SCOPES = new Set(["district", "school"]);
const MILESTONE_SCOPES = new Set(["school", "class"]);
const PERIOD_TYPES = new Set(["weekly", "monthly"]);

function buildStandingsInstruction(scope: string, scopeId: string, periodType: string): string {
  return [
    `Generate a district-competition standings update for the following request.`,
    `type: standings.`,
    `Requested scope: ${scope} (scopeId: ${scopeId}).`,
    `Requested period type: ${periodType}.`,
    `Your first tool call must be exactly "districtupdate.getLeagueStandings" (the full name, including the "districtupdate." prefix - do not shorten it) with scope=${scope}, scopeId=${scopeId}, and periodType=${periodType}.`,
    `After that succeeds, follow the rest of your system instructions for the standings path: call districtupdate.getPriorStandings with the same scope/scopeId/periodType, call districtupdate.detectStandingsChanges only if a prior period was found, compose the draft, then save it with districtupdate.saveDraftUpdate.`,
  ].join(" ");
}

function buildMilestoneInstruction(scope: string, scopeId: string): string {
  return [
    `Generate a school milestone celebration draft for the following request.`,
    `type: milestone.`,
    `Requested scope: ${scope} (scopeId: ${scopeId}).`,
    `Your first tool call must be exactly "districtupdate.getMilestoneCandidates" (the full name, including the "districtupdate." prefix - do not shorten it) with scope=${scope} and scopeId=${scopeId}.`,
    `After that succeeds, follow the rest of your system instructions for the milestone path: if candidates is empty, do not save a draft and say so plainly; otherwise choose the single most notable candidate, compose a short draft, then save it with districtupdate.saveDraftUpdate.`,
  ].join(" ");
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    assertPermission(user, PERMISSIONS.AGENT_PLATFORM_VIEW);

    const body = await req.json().catch(() => ({}));
    const { type, scope, scopeId, periodType } = body ?? {};

    if (type !== "standings" && type !== "milestone") {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }
    if (typeof scopeId !== "string" || !scopeId) {
      return NextResponse.json({ error: "scopeId_required" }, { status: 400 });
    }

    let instruction: string;
    if (type === "standings") {
      if (typeof scope !== "string" || !STANDINGS_SCOPES.has(scope)) {
        return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
      }
      if (typeof periodType !== "string" || !PERIOD_TYPES.has(periodType)) {
        return NextResponse.json({ error: "invalid_periodType" }, { status: 400 });
      }
      instruction = buildStandingsInstruction(scope, scopeId, periodType);
    } else {
      if (typeof scope !== "string" || !MILESTONE_SCOPES.has(scope)) {
        return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
      }
      instruction = buildMilestoneInstruction(scope, scopeId);
    }

    // userRole "system", not "admin" - rolesAllowed is ["system"] (matches
    // moe-narrative-report's identical fix from Sprint 6.3). The platform-
    // admin check above already gates who may call this HTTP endpoint.
    const result = await runAgent("district-update", instruction, {
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

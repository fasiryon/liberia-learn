/**
 * POST /api/admin/agents/morning-brief/run
 *
 * Manual trigger for the morning-brief agent (Sprint 7.4), mirroring
 * /api/admin/agents/moe-narrative-report/run's shape. Platform-admin only -
 * every invocation costs real LLM spend, so triggering it manually is a
 * platform-level action. Gated at the runtime by AGENT_MORNING_BRIEF_ENABLED
 * (FEATURE_DISABLED when off).
 *
 * Body: { teacherUserId: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import "@/lib/agents/bootstrap";
import { runAgent } from "@/lib/agents/runtime";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    assertPermission(user, PERMISSIONS.AGENT_PLATFORM_VIEW);

    const body = await req.json().catch(() => ({}));
    const { teacherUserId } = body ?? {};
    if (typeof teacherUserId !== "string" || !teacherUserId) {
      return NextResponse.json({ error: "teacherUserId_required" }, { status: 400 });
    }

    const briefDate = new Date().toISOString().slice(0, 10);
    const instruction = [
      "Generate today's morning brief for this teacher.",
      `teacherUserId: ${teacherUserId}`,
      `briefDate: ${briefDate}`,
      "Your first tool call must be exactly \"morningbrief.getTeacherSignals\" with this teacherUserId.",
    ].join("\n");

    const result = await runAgent("morning-brief", instruction, {
      userId: user.id,
      userRole: "system",
      traceId: randomUUID(),
      triggeredBy: "USER",
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: "request_failed" }, { status });
  }
}

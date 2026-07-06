/**
 * POST /api/admin/agents/echo/run
 *
 * Admin-only test-invocation endpoint for the echo agent. Validates the harness
 * end to end from the admin surface. Gated at the runtime by AGENT_ECHO_ENABLED
 * (the runtime returns FEATURE_DISABLED when off).
 *
 * Body: { text: string }
 * Returns the RunResult.
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
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    assertPermission(user, PERMISSIONS.AGENT_PLATFORM_VIEW);

    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text : "";
    if (!text.trim()) {
      return NextResponse.json({ error: "text_required" }, { status: 400 });
    }

    const result = await runAgent("echo", text, {
      userId: user.id,
      userRole: "admin",
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

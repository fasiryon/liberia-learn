/**
 * POST /api/teacher/training/open
 *
 * Marks a training module as in-progress for the authenticated teacher.
 * Also emits a server-side training.module_opened metric event.
 *
 * Called by ModulePlayer on mount (client-side fire-and-forget).
 * Will not downgrade a module that is already "complete".
 *
 * Auth: TEACHER or ADMIN
 * Tenant isolation: enforced via teacherUserId → User.schoolId
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { markModuleStarted } from "@/lib/training/progress";
import { getModuleById } from "@/lib/training/modules";
import { recordMetricEvent } from "@/lib/metrics/events";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");

    const body = await req.json().catch(() => ({}));
    const { moduleId } = body as { moduleId?: unknown };

    if (!moduleId || typeof moduleId !== "string") {
      return NextResponse.json({ error: "moduleId is required" }, { status: 400 });
    }

    const trainingModule = getModuleById(moduleId);
    if (!trainingModule) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    await markModuleStarted(user.id, moduleId);

    await recordMetricEvent(
      "training.module_opened",
      { moduleId, level: trainingModule.level },
      {
        scope: "school",
        scopeId: user.schoolId ?? null,
        schoolId: user.schoolId ?? null,
        userId: user.id,
        severity: "info",
        kind: "event",
        pilotOnly: false,
      }
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: err?.status ?? 500 });
  }
}

/**
 * POST /api/teacher/training/complete
 *
 * Marks a training module as complete for the authenticated teacher.
 * Checks whether completing the module also completes its level, and if so
 * emits training.level_completed + training.badge_awarded events.
 *
 * Returns:
 *   { ok, levelComplete, badges: Badge[] }
 *
 * Auth: TEACHER or ADMIN
 * Tenant isolation: enforced via teacherUserId → User.schoolId
 * Idempotent: re-completing an already-complete module is safe (updates completedAt).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { markModuleComplete, getTeacherProgress } from "@/lib/training/progress";
import { isLevelComplete, computeEarnedBadges, LEVEL_BADGES } from "@/lib/training/badges";
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

    const metricScope = {
      scope: "school" as const,
      scopeId: user.schoolId ?? null,
      schoolId: user.schoolId ?? null,
      userId: user.id,
      severity: "info" as const,
      kind: "event" as const,
      pilotOnly: false,
    };

    // Snapshot level state BEFORE completing this module
    const progressBefore = await getTeacherProgress(user.id);
    const levelWasComplete = isLevelComplete(trainingModule.level, progressBefore);

    // Persist completion
    await markModuleComplete(user.id, moduleId);

    // Snapshot AFTER
    const progressAfter = await getTeacherProgress(user.id);
    const levelNowComplete = isLevelComplete(trainingModule.level, progressAfter);
    const levelJustCompleted = !levelWasComplete && levelNowComplete;

    const badges = computeEarnedBadges(progressAfter);

    // Telemetry
    await recordMetricEvent("training.module_completed", { moduleId, level: trainingModule.level }, metricScope);

    if (levelJustCompleted) {
      await recordMetricEvent("training.level_completed", { level: trainingModule.level }, metricScope);
      await recordMetricEvent(
        "training.badge_awarded",
        { badgeName: LEVEL_BADGES[trainingModule.level].name, level: trainingModule.level },
        metricScope
      );
    }

    return NextResponse.json({ ok: true, levelComplete: levelJustCompleted, badges });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: err?.status ?? 500 });
  }
}

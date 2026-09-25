// route-policy: auth=session; scope=tenant; authority=student-self; rationale=a learner reports only their own payload-free device queue summary bound to their session identity and school
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordMetricEvent } from "@/lib/metrics/events";
import {
  SYNC_DIAGNOSTIC_SNAPSHOT_METRIC,
  sanitizeSyncDiagnosticSnapshot,
} from "@/lib/offline/syncDiagnosticsContract";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const MIN_REPORT_INTERVAL_MS = 30 * 1000;

/**
 * Stores a learner-reported sync snapshot as diagnostic telemetry. The
 * snapshot is non-authoritative: no learning, grading, mastery, or release
 * decision reads it, and it cannot change queue or server learner state.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("STUDENT");
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Snapshot too large" }, { status: 413 });
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid snapshot" }, { status: 400 });
    }
    const snapshot = sanitizeSyncDiagnosticSnapshot((body as { snapshot?: unknown } | null)?.snapshot);
    if (!snapshot) {
      return NextResponse.json({ error: "Invalid snapshot" }, { status: 400 });
    }

    const recent = await prisma.metricEvent.findFirst({
      where: {
        userId: user.id,
        name: SYNC_DIAGNOSTIC_SNAPSHOT_METRIC,
        createdAt: { gte: new Date(Date.now() - MIN_REPORT_INTERVAL_MS) },
      },
      select: { id: true },
    });
    if (recent) {
      return NextResponse.json({ recorded: false, reason: "rate_limited" });
    }

    await recordMetricEvent(SYNC_DIAGNOSTIC_SNAPSHOT_METRIC, snapshot, {
      scope: "school",
      scopeId: user.schoolId ?? null,
      schoolId: user.schoolId ?? null,
      kind: "snapshot",
      severity: snapshot.counts.quarantined + snapshot.counts.conflict + snapshot.counts.authRequired > 0 ? "warning" : "info",
      userId: user.id,
    });
    return NextResponse.json({ recorded: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}

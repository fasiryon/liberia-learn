import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listOperatorNotes } from "@/lib/autonomous/operatorIncidentNoteService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

const REPLAY_ELIGIBLE_ERROR_CODES = new Set([
  "workflow_timeout",
  "lock_conflict",
  "transient_db_error",
  "queue_timeout",
  "sqs_send_failed",
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: { workflowRunId: string } }
) {
  try {
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }
    if (!isRuntimeDashboardEnabled()) {
      return NextResponse.json({ error: "Runtime dashboard disabled" }, { status: 403 });
    }

    const workflowRun = await (prisma as any).workflowRun.findUnique({
      where: { id: params.workflowRunId },
    });

    if (!workflowRun) {
      return NextResponse.json({ error: "WorkflowRun not found" }, { status: 404 });
    }

    if (!user.isPlatformAdmin && workflowRun.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const replayEligible =
      workflowRun.lastErrorCode != null &&
      REPLAY_ELIGIBLE_ERROR_CODES.has(workflowRun.lastErrorCode);

    const quarantined =
      workflowRun.executionMetadata?.quarantined === true ||
      workflowRun.lastErrorCode === "stuck_workflow_exhausted";

    const notes = await listOperatorNotes(params.workflowRunId);

    return NextResponse.json({
      workflowRunId: params.workflowRunId,
      workflowType: workflowRun.workflowType,
      status: workflowRun.status,
      attempt: workflowRun.attempt,
      maxAttempts: workflowRun.maxAttempts,
      lastErrorCode: workflowRun.lastErrorCode ?? null,
      lastErrorMessage: workflowRun.lastErrorMessage ?? null,
      deadLetteredAt: workflowRun.deadLetteredAt?.toISOString() ?? null,
      replayEligible,
      quarantined,
      schoolId: workflowRun.schoolId ?? null,
      tenantId: workflowRun.tenantId ?? null,
      replayOfRunId: workflowRun.replayOfRunId ?? null,
      replayMode: workflowRun.replayMode ?? null,
      notes,
      noteCount: notes.length,
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status });
  }
}

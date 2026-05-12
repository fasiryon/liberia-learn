import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getWorkflowReplayPlan, createReplayWorkflowRun } from "@/lib/autonomous/workflowReplayService";
import { startExecutionTrace, finishExecutionTrace } from "@/lib/autonomous/executionTraceService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";
import type { WorkflowReplayMode } from "@/lib/autonomous/types";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const VALID_REPLAY_MODES: WorkflowReplayMode[] = [
  "analysis_only",
  "recommendation_only",
  "approved_action_replay",
];

export async function POST(
  req: NextRequest,
  { params }: { params: { workflowRunId: string } }
) {
  try {
    const user = await requireUser();
    if (!user.isPlatformAdmin) {
      return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
    }
    if (!isRuntimeDashboardEnabled()) {
      return NextResponse.json({ error: "Runtime dashboard disabled" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body.dryRun !== false;
    const confirm: boolean = body.confirm === true;
    const replayMode: WorkflowReplayMode = VALID_REPLAY_MODES.includes(body.replayMode)
      ? body.replayMode
      : "analysis_only";

    const plan = await getWorkflowReplayPlan(params.workflowRunId);

    if (replayMode !== "analysis_only" && !plan.replaySafe) {
      return NextResponse.json(
        {
          error: "Action replay blocked: workflow has succeeded actions. Set replayMode to analysis_only or investigate first.",
          code: "workflow_replay_side_effect_guard",
          replaySafe: plan.replaySafe,
        },
        { status: 409 }
      );
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        workflowRunId: params.workflowRunId,
        replayMode,
        replaySafe: plan.replaySafe,
        sideEffectsBlockedByDefault: plan.sideEffectsBlockedByDefault,
        checkpointCount: plan.checkpoints.length,
        stepCount: plan.steps.length,
        decisionCount: plan.decisions.length,
        actionCount: plan.actions.length,
        workflowType: plan.workflowRun.workflowType,
        status: plan.workflowRun.status,
      });
    }

    if (!confirm) {
      return NextResponse.json(
        {
          error: "Operator confirmation required for live replay. Send confirm=true to proceed.",
          code: "confirmation_required",
          replayMode,
          replaySafe: plan.replaySafe,
        },
        { status: 409 }
      );
    }

    const traceId = randomUUID();
    const trace = (await startExecutionTrace({
      traceId,
      workflowRunId: params.workflowRunId,
      spanType: "replay",
      spanName: "operator.workflow.replay",
      actorType: "platform_admin",
      actorId: user.id,
    })) as { id: string };

    let newRun: { id: string };
    try {
      const replayResult = await createReplayWorkflowRun({
        workflowRunId: params.workflowRunId,
        requestedByUserId: user.id,
        replayMode,
      });
      newRun = { id: (replayResult as any).workflowRun?.id ?? (replayResult as any).id };
    } catch (err: any) {
      await finishExecutionTrace({
        id: trace.id,
        status: "failed",
        errorCode: err?.code ?? "replay_error",
        errorMessage: err?.message ?? "unknown",
      });
      throw err;
    }

    await finishExecutionTrace({ id: trace.id, status: "succeeded" });

    void logAudit({
      action: "autonomous.workflow.replay",
      userId: user.id,
      resourceType: "WorkflowRun",
      resourceId: params.workflowRunId,
      details: {
        originalWorkflowRunId: params.workflowRunId,
        newWorkflowRunId: newRun.id,
        replayMode,
        traceId,
      },
    });

    return NextResponse.json({
      dryRun: false,
      replayed: true,
      newWorkflowRunId: newRun.id,
      replayMode,
      originalWorkflowRunId: params.workflowRunId,
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status });
  }
}

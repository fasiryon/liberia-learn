import { enqueueJob, JobType } from "@/lib/queue";
import {
  buildQueueDeduplicationId,
  buildQueueGroupId,
} from "@/lib/autonomous/executionCorrelationService";
import {
  acquireWorkflowRun,
  createApprovalRequest,
  createWorkflowRun,
  markWorkflowFailure,
  recordWorkflowCheckpoint,
  releaseWorkflowRun,
  transitionWorkflowStatus,
  type CreateWorkflowRunInput,
} from "@/lib/autonomous/workflowStateManager";

export async function startWorkflow(input: CreateWorkflowRunInput & { enqueue?: boolean }) {
  const result = await createWorkflowRun(input);
  if (input.enqueue && result.created) {
    await enqueueWorkflowRun(result.workflowRun);
  }
  return result;
}

export async function enqueueWorkflowRun(workflowRun: {
  id: string;
  workflowType: string;
  partitionKey: string;
  idempotencyKey?: string | null;
  attempt?: number | null;
}) {
  await enqueueJob(
    JobType.AUTONOMOUS_WORKFLOW_RUN,
    {
      workflowRunId: workflowRun.id,
      workflowType: workflowRun.workflowType,
      partitionKey: workflowRun.partitionKey,
    },
    {
      messageGroupId: buildQueueGroupId({
        partitionKey: workflowRun.partitionKey,
        workflowType: workflowRun.workflowType,
      }),
      messageDeduplicationId: buildQueueDeduplicationId({
        workflowRunId: workflowRun.id,
        idempotencyKey: workflowRun.idempotencyKey,
        attempt: workflowRun.attempt,
      }),
    }
  );
}

export async function resumeWorkflowFromCheckpoint(input: {
  workflowRunId: string;
  workerId: string;
  handler: (workflowRun: any) => Promise<{ status?: "succeeded" | "waiting_for_approval"; checkpointKey?: string }>;
}) {
  const run = await acquireWorkflowRun(input);
  try {
    await recordWorkflowCheckpoint({
      workflowRunId: input.workflowRunId,
      checkpointKey: "resume_started",
      workerId: input.workerId,
      traceId: run.traceId,
    });
    const result = await input.handler(run);
    if (result.checkpointKey) {
      await recordWorkflowCheckpoint({
        workflowRunId: input.workflowRunId,
        checkpointKey: result.checkpointKey,
        workerId: input.workerId,
        traceId: run.traceId,
      });
    }
    if (result.status) {
      await transitionWorkflowStatus({ workflowRunId: input.workflowRunId, status: result.status });
    }
    return result;
  } catch (error) {
    await markWorkflowFailure({ workflowRunId: input.workflowRunId, error });
    throw error;
  } finally {
    await releaseWorkflowRun({ workflowRunId: input.workflowRunId, workerId: input.workerId });
  }
}

export async function requestWorkflowApproval(input: Parameters<typeof createApprovalRequest>[0]) {
  return createApprovalRequest(input);
}


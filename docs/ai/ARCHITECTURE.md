# Autonomous OS Architecture

## Topology

The autonomous OS is a governed control plane over LiberiaLearn's existing production systems.

```text
LearningEvent / domain records
  -> trigger eligibility
  -> workflow instance
  -> agent registry
  -> evidence retrieval
  -> recommendation or action request
  -> approval gate
  -> execution
  -> evaluation
  -> memory update
  -> optimization proposal
```

## Event-Driven Architecture

`LearningEvent` is the canonical education event stream. Domain records such as `AssessmentAttempt`, `MasterySnapshot`, `Intervention`, `InterventionChain`, `AIInteraction`, `CurriculumContent`, `CurriculumVersion`, `ExportJobRequest`, and `AuditLog` provide state and governance context.

Events must be idempotent and replayable. Future workflow triggers must rely on event ids, dedupe keys, original timestamps, replay metadata, and tenant scope.

## Orchestration Model

Workflow orchestration must be durable and database-backed first. External queues may wake workers, but the database record is the source of truth for workflow state, checkpoints, retries, approvals, and outcomes.

Recommended orchestration boundary:

- DB workflow state for durability.
- Existing `lib/queue.ts` for asynchronous dispatch.
- SQS-compatible queue for production worker scale.
- Dead-letter handling with replay tooling.
- Feature flags and kill switches at trigger and executor boundaries.

## Workflow Lifecycle

Statuses:

- `pending`
- `eligible`
- `running`
- `waiting_for_approval`
- `approved`
- `executing`
- `succeeded`
- `failed`
- `dead_lettered`
- `cancelled`
- `replayed`

Every workflow must store tenant scope, trigger event, agent id, risk level, evidence references, checkpoints, retry count, last error, approval refs, and outcome refs.

## Memory Lifecycle

Memory is derived from approved, tenant-safe facts:

1. Source event or record.
2. Redaction and tenant partitioning.
3. Summary or embedding creation.
4. Lineage record.
5. Retrieval with role and tenant filters.
6. Retention or deletion.

Raw PII is not memory. National memory is aggregate only.

## Evaluation Lifecycle

Evaluation begins when a recommendation or action is produced and continues until measurable outcomes can be attributed.

Track:

- baseline state
- recommendation evidence
- action taken or declined
- outcome window
- effectiveness
- false positive and false negative status
- confidence calibration
- model/prompt/version refs

## Optimization Lifecycle

Optimization consumes evaluated outcomes, not raw AI guesses. It proposes curriculum improvements, intervention policies, operational changes, or forecasting signals with evidence and confidence. Human review is required before medium/high-impact changes.

## Observability Topology

Observability must connect request traces, workflow ids, event ids, agent ids, action ids, audit ids, AI interaction ids, queue job ids, and cost records. Debugging should reconstruct the full path from trigger to outcome without exposing raw PII.

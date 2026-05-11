# Workflow Engine

## Durable Execution Strategy

Workflow state must live in the database. Queues wake work; they are not the state store. A workflow record must include tenant scope, trigger event, current status, current checkpoint, retry count, risk level, assigned agent, evidence refs, approval refs, and final outcome.

## Checkpoint Model

Recommended checkpoints:

- `trigger_received`
- `eligibility_checked`
- `evidence_loaded`
- `agent_completed`
- `recommendation_recorded`
- `approval_requested`
- `approval_resolved`
- `action_executed`
- `evaluation_scheduled`
- `memory_updated`
- `workflow_closed`

Each checkpoint should be append-only and traceable to the actor or worker that wrote it.

## Retry Policies

- Transient dependency failure: exponential backoff with jitter.
- Validation failure: no retry until input changes.
- Approval timeout: expire or escalate based on policy.
- AI parse failure: bounded retry only through routed AI path.
- Permission failure: no retry.

## Resumability

Workers must resume from the latest persisted checkpoint. Restarting a worker, replaying a queue message, or rerunning a job must not duplicate actions.

## Workflow Statuses

Use explicit states: `pending`, `running`, `waiting_for_approval`, `approved`, `executing`, `succeeded`, `failed`, `dead_lettered`, `cancelled`, `replayed`.

## Dead-Letter Handling

Dead-lettered workflows require:

- final error category
- last safe checkpoint
- retry count
- tenant scope
- replay eligibility
- operator notes
- audit event when manually replayed or cancelled

## Concurrency Controls

- One active workflow per tenant/target/action type unless policy allows otherwise.
- Use row-level locking or optimistic version checks for contested workflows.
- Apply per-tenant, per-agent, and global concurrency limits.
- Prevent thundering herd behavior from replay or offline sync.

## DB Write Throttling

Batch low-value telemetry where safe, but never batch away audit requirements. Apply backpressure before queue saturation causes database contention.

## Replay Model

Replay is analysis-first. It can reproduce detection, recommendation, and evaluation. Action replay requires explicit approval and must write new replay-linked events.

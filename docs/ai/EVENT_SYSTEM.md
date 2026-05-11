# Event System

## LearningEvent Extension Strategy

Use `LearningEvent` and `lib/events/logLearningEvent.ts` as the canonical event path. Extend the model additively only when required fields cannot be represented by existing actor, target, context, version, metadata, quality marker, dedupe, or replay fields.

Autonomous OS event categories should use stable names:

- `agent.detected`
- `workflow.started`
- `workflow.checkpointed`
- `workflow.waiting_for_approval`
- `action.proposed`
- `action.approved`
- `action.executed`
- `action.failed`
- `evaluation.completed`
- `memory.updated`
- `optimization.proposed`

## Event Routing

Routing must use deterministic eligibility filters before invoking any AI:

- tenant scope
- role scope
- event type allowlist
- feature flag
- risk policy
- dedupe key
- replay mode
- queue capacity

## Trigger Eligibility

An event is eligible only if:

- it has tenant or approved national aggregate scope
- it is not a duplicate
- it passes feature flag checks
- the agent is enabled for that tenant/environment
- the target action risk is allowed
- source data is complete enough for evidence requirements

## Deduplication

Use stable dedupe keys derived from tenant, event type, target resource, and time window. Never dedupe across tenants. Duplicate events should be logged or counted but must not create duplicate workflow execution.

## Idempotency

Every workflow and action must be safe to retry. Writes must include idempotency keys, unique constraints where appropriate, or transactional checks.

## Replay Support

Replay must preserve `originalOccurredAt`, set replay metadata, and route to replay-safe handlers. Replayed events may regenerate recommendations but must not execute actions unless explicitly approved for replay execution.

## Event Partitioning

Partition by tenant first:

- school-level partitions for school operations
- district partitions for district aggregate jobs
- national aggregate partitions for MOE-safe analytics
- user/device partitions for offline sync

## Queue Integration Strategy

Use existing `lib/queue.ts` for background dispatch. Queue messages should carry event id and workflow id, not full sensitive payloads. Workers load data server-side using RBAC-equivalent tenant constraints.

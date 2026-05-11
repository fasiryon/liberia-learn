# Observability

## Workflow Tracing

Every autonomous workflow needs a trace id connecting trigger event, workflow id, queue job id, agent id, approval id, action id, audit id, and evaluation id.

## Agent Tracing

Agent traces must record:

- input event
- evidence loaded
- deterministic rules applied
- AI call ids when used
- confidence score
- proposed action
- approval route
- final outcome

## Replay System

Replay tooling must reproduce detection and recommendation paths without executing side effects by default. Replay output must show diffs between original and replayed results.

## Telemetry

Required metrics:

- workflow count by status
- workflow latency
- agent success/failure
- approval latency
- action execution result
- queue depth
- dead-letter count
- retry count
- AI cost and tokens
- false positives/false negatives
- kill switch activations

## Cost Tracking

Use existing AI telemetry and cost summaries. Agents must set feature, route, model, tier, token, latency, and prompt version metadata without logging raw PII.

## Execution Graphs

Execution graphs should show event-to-outcome lineage for debugging and governance review. Graph nodes must use ids and summaries, not raw sensitive content.

## Latency Tracking

Track latency by phase: event ingestion, eligibility, queue wait, evidence load, AI call, approval wait, action execution, evaluation update, memory update.

## Redaction Rules

Logs and traces must remove names, emails, phone numbers, addresses, raw prompts, raw student submissions, and long free-text content unless explicitly approved for secure tenant-local debugging.

## Debugging Requirements

Operators must be able to answer what happened, why, who approved it, what changed, whether it can be replayed, and whether tenant/privacy controls were respected.

# Safety And Autonomy

## Kill Switches

Required kill switches:

- disable all autonomous OS triggers
- disable agent detection
- disable AI-assisted agents
- disable action execution
- disable memory writes
- disable optimization proposals
- pause queue consumers
- force recommend-only mode

## Emergency Shutdown

Emergency shutdown must stop new triggers, pause execution workers, preserve audit trails, and leave in-flight workflows in an inspectable state. Do not delete workflow history during incidents.

## Degraded Mode Handling

If AI, queue, database, storage, or provider dependencies degrade:

- stop AI-dependent agents
- continue deterministic read-only insights when safe
- avoid live communication
- avoid high-volume writes
- log degraded-mode events
- surface operator alerts

## Runaway Workflow Prevention

- Per-agent concurrency limits.
- Per-tenant workflow caps.
- Global queue depth limits.
- Deduplication windows.
- Retry ceilings.
- Circuit breakers on repeated failures.
- Replay defaults to no side effects.

## Queue Saturation Prevention

Workers must check queue depth and database latency before launching heavy workflows. Queue saturation should degrade to delayed recommendation, not uncontrolled retries.

## Hallucination Containment

AI output must be treated as untrusted until validated. Require schemas, allowed action lists, evidence ids, confidence, and deterministic checks. Invalid or unsupported claims become failures, not accepted recommendations.

## Governance Escalation

Escalate immediately for:

- possible cross-tenant data exposure
- raw PII in national layer
- unapproved medium/high-risk execution
- repeated false positives affecting students
- unexplained cost spike
- queue runaway
- audit logging failure
- model output without evidence

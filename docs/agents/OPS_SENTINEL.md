# Ops Sentinel

STATUS: **Implemented, feature-flagged off by default (`AGENT_OPS_SENTINEL_ENABLED`).**

Platform-health monitoring for LiberiaLearn admins. Not user-facing - never
interacts with guardians, students, or teachers. Registered as an
agent-platform agent (`lib/agents/agents/ops-sentinel.agent.ts`) for
consistency (feature flag via `AgentControl`/`resolveAgentEnabled`, admin
dashboard visibility, audit trail) even though the routine sweep bypasses
the LLM loop entirely - see "Why deterministic, not LLM-judged" below.

## What it detects

Four categories, each reusing an existing signal source rather than building
a parallel one (`lib/agents/opsSentinel/detectors.ts`):

1. **Cron misses** - a monitored cron (`agents-tick`, `check-dlq`,
   `check-ai-budget`) hasn't recorded a heartbeat within
   `intervalMinutes * 2`. Heartbeats are a new `MetricEvent` name
   (`cron.heartbeat`, `lib/ops/cronHeartbeat.ts`), written by each monitored
   cron's route handler on successful completion (best-effort - a heartbeat
   write failure never fails the cron itself).
2. **Migration drift** - rows in `_prisma_migrations` with
   `finished_at IS NULL AND rolled_back_at IS NULL` (same query
   `app/api/health/route.ts` already uses). Always `HIGH` severity - schema
   state is always the high-caution category. A query failure is treated as
   a detection (fail closed, not open).
3. **Error spikes** - `lib/ops/errorRates.ts:getErrorRates24h()` (existing,
   `MetricEvent`-based) against an env-configurable threshold
   (`OPS_SENTINEL_ERROR_SPIKE_THRESHOLD`, default 50).
4. **Cost cap breaches** - count of `AgentInvocation` rows with
   `status = "COST_CAPPED"` in the last 24h, against
   `OPS_SENTINEL_COST_CAP_THRESHOLD` (default 5).

## Tiering: what auto-fixes vs. what escalates

Deterministic, not LLM-judged - same discipline as Sprint 6.1's safeguarding
keyword gate: safety/correctness-critical decisions stay in code.

- **Tier 1 (provably safe, auto-executed)**: only cron-miss retry
  (`lib/agents/opsSentinel/actions.ts:retryCron` - re-invokes the exact same
  cron route Vercel would, no state mutation beyond what that cron already
  does idempotently) and clearing a small, explicit allowlist of
  always-recomputable cache keys (`clearOpsCaches`). If a retry fails, the
  detection is escalated instead (Tier 2).
- **Tier 2 (anything touching production-live tables/schema, or a
  business/config judgment call)**: migration drift, error spikes, and cost
  cap breaches are always proposed via the existing `EscalationQueue`
  (`lib/agents/escalation.ts:enqueueEscalation`) at the detection's own
  severity as priority - never auto-applied. A `HIGH`-priority escalation
  also sends an ops alert (`lib/ops/alerts.ts:sendOpsAlert`, email); alert
  failures are logged and swallowed, never block the escalation record
  itself from being written.

## Why deterministic, not LLM-judged

The scheduled sweep (`app/api/cron/ops-sentinel`) calls the detector/action
functions directly - it does not invoke the `ops-sentinel` agent's LLM loop.
The agent is registered anyway so this remains agent-platform-native
(feature flag, admin dashboard, audit trail), and so it's available for a
future "admin asks it to investigate a specific escalation" flow
(`lib/agents/prompts/ops-sentinel.md`): read-only investigation using the
`ops.*` tools, never calling `ops.retryCron` or `ops.clearOpsCaches` without
an admin's explicit request in that conversation.

## Wiring

- Cron: `app/api/cron/ops-sentinel` (`vercel.json`, every 15 minutes),
  `CRON_SECRET`-gated like every other agent-platform cron, then
  `AGENT_OPS_SENTINEL_ENABLED`-gated via `resolveAgentEnabled`.
- Monitored crons write their own heartbeat
  (`recordCronHeartbeat(name)`) after successful completion:
  `app/api/cron/agents/tick`, `app/api/cron/check-dlq`,
  `app/api/cron/check-ai-budget`. Extend `MONITORED_CRONS` in
  `detectors.ts` when adding a new one.
- Tools registered in `lib/agents/tools/opsSentinel.tools.ts`
  (`ops.detectCronMisses`, `ops.detectMigrationDrift`,
  `ops.detectErrorSpike`, `ops.detectCostCapBreaches`, `ops.retryCron`,
  `ops.clearOpsCaches`, `ops.proposeFix`).

## Deliberately out of scope

- No auto-fallback or auto-remediation for anything touching schema or
  business data - matches the same reasoning as the Orange SMS fallback
  decision (`ORANGE_LIBERIA_FALLBACK_BEHAVIOR.md`): a silent automated fix
  that turns out wrong is harder to debug than a loud escalation.
- No new alerting channel - reuses `EscalationQueue` and `sendOpsAlert`.
- No new metrics table - reuses `MetricEvent`.

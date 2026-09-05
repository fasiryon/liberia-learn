# NR-15 Unified Operational Readiness

## Authority

`getOperationalSnapshot` in `lib/ops/operationalSnapshot.ts` is the single
NR-15 composition authority. It runs bounded source readers independently,
preserves source failures as `UNKNOWN`, reconciles typed alerts, and returns a
versioned, tenant-bound snapshot. It does not recalculate P7 metrics,
experiment analysis, release criteria, curriculum decisions, offline conflict
policy, or safeguarding policy.

## Source-of-truth map

| Dashboard domain | Existing authority | NR-15 behavior |
|---|---|---|
| Runtime and dependencies | `lib/ops/healthCheck.ts` | Composes database, Redis, deployment, Sentry configuration, and latency state. |
| Queue and worker | `lib/ops/queueDepths.ts`, AWS SQS, worker completion metrics | Reads bounded SQS attributes. Unknown and unimplemented jobs are never reported as success. Unsupported age, failure, or heartbeat metrics remain `UNKNOWN`. |
| Offline synchronization | `MetricEvent` events emitted by `/api/student/sync` and P5-B policy | Reads only recent tenant-scoped aggregate counters. It never exposes queued payloads or learner responses. |
| Curriculum governance | P2 review tasks, decisions, provenance, and feature flags | Reads counts and activation state without changing review decisions. |
| AI quality | P7-A `governedMeasurement.ts` | Publishes P7-A version provenance. Because no authoritative persisted metric-result projection exists, live values remain `UNKNOWN`, not zero. |
| Experiments | P7-B `controlledExperiment.ts` and `qualityOperations.ts` | Does not recreate assignment, SRM, guardrail, or early-stop analysis. Values remain `UNKNOWN` until an authoritative persisted projection exists. |
| Quality operations | P7-C review tasks, calibration, release gate, rollback, and incidents | Reads persisted task and calibration counts. Non-persisted release results and incidents remain `UNKNOWN`. |
| Incidents | Existing `EscalationQueue` plus P7-C incident references | Returns bounded, aggregate-safe incident references, not copied incident records or sensitive reason text. |
| Tenant state | `School` and tenant-isolation telemetry | School scope is bound to the authenticated school. National aggregate requires platform or MOE super-admin authority. |
| External readiness | Canonical execution records | Static repository-known facts use `VERIFIED`, `PENDING`, `NOT_CONFIGURED`, `UNKNOWN`, or `BLOCKED`. Absence of live proof is never converted to success. |

## Status and freshness semantics

- `HEALTHY`: all available current evidence is healthy.
- `DEGRADED`: a subsystem is impaired or otherwise non-blocking, including a
  stale source that had claimed healthy.
- `BLOCKED`: an authoritative hard safety, quality, tenant, DLQ, or critical
  runtime condition blocks readiness.
- `UNKNOWN`: required evidence is unavailable or cannot be trusted as current.

Every panel includes the source subsystem, definition version, source
timestamp, generated timestamp, tenant scope, and freshness. One source
failure is isolated to that panel. Exception details are not returned.

## API and privacy

`GET /api/admin/ops/snapshot` accepts `scope=school|national` and an optional
bounded `schoolId`. School admins can read only their own school. Platform
admins and MOE super admins can read national aggregates or an explicit school.
Students, teachers, guardians, and unprivileged cross-school requests are
rejected. Responses are private and non-cacheable.

The contract contains aggregate counts, statuses, opaque IDs, and evidence
references. It excludes prompts, safeguarding narratives, assessment
responses, queue payloads, and direct learner or teacher identity data.

## Alert model

`lib/ops/operationalAlerts.ts` owns versioned alert definitions. Each definition
contains an ID, source, severity, condition, window, minimum evidence,
deterministic tenant-bound fingerprint, cooldown, owner role, and recommended
action. Reconciliation updates an existing open alert, preserves
acknowledgement, and records recovery as `RESOLVED` without deleting history.

The repository adapter is deliberately no-op. The unified dashboard does not
claim email, SMS, Slack, PagerDuty, or any other external delivery. Historical
provider-specific jobs in `docs/ops/ALERTS.md` are separate and remain
operationally uncertified until a real delivery drill succeeds.

## Performance

The snapshot runs panels concurrently. Each database reader uses indexed
filters, aggregate queries, a 30-day maximum telemetry window, and bounded
incident output of 100 rows. There is no per-school loop or per-row lookup, so
the national page does not introduce an N+1 query pattern. No repository-wide
scan or live third-party call is used in deterministic tests.

## Known external dependencies

The readiness panel keeps the following open: privileged MFA activation, the
500-job live run, independent penetration testing, qualified reviewer and MOE
activation, signing-key proof, classroom hub and named-device field proof,
P7 live reviewer roster, real sampled traffic, and live P7-C migration
application. NR-13 governed database promotion also remains pending. None was
mutated by NR-15.

## Tabletop incident drill

On 2026-09-04, the deterministic NR-15 fixture exercised this sequence:

1. A queue reports pending work older than 15 minutes and a non-empty DLQ.
2. The snapshot becomes `BLOCKED` while unaffected panels remain visible.
3. A tenant-bound critical alert receives one deterministic fingerprint.
4. Re-observation updates evidence and count instead of creating a duplicate.
5. Acknowledgement preserves the fingerprint and opening evidence.
6. A later zero-DLQ observation moves the alert to `RESOLVED` and retains its
   history.

The repository tabletop passed. No live queue message, deployment, provider
notification, staging database, or production system was changed. A real
delivery and on-call acknowledgement drill remains an external operational
gate.



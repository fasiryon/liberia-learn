# Telemetry & Observability

**Last updated:** 2026-02-24 (Block 5 — Ops Intelligence)

---

## Mandatory Signals

Every deployed feature must ship with:

| Signal type | Storage | Tool |
|---|---|---|
| Structured request logs | Server stdout | Vercel / Sentry |
| Metric events | `MetricEvent` table | `recordMetricEvent()` |
| Client-side events | `AuditLog` table | `trackEvent()` → `/api/track` |
| Audit logs | `AuditLog` table | Auth middleware |
| Traces (AI calls) | `AuditLog` + `OpsExplanation` | Manual + promptHash |

A feature is **incomplete** if it ships without measurable signals and failure visibility.

---

## Event Envelope Standard (Block 5)

All telemetry payloads — client and server — must conform to this shape:

```typescript
interface OpsEventPayload {
  name:        string;                                       // dot-notation event name
  severity:    "info" | "warn" | "critical";
  actorRole:   "TEACHER" | "ADMIN" | "GUARDIAN" | "SYSTEM";
  schoolId:    string | null;                                // null only for global/platform events
  windowHours?: number;                                      // for rate-based events
  // Additional event-specific fields — NO PII
}
```

**PII is strictly prohibited** in all telemetry payloads. See [ADR-0007](../adr/0007-ops-agent-recommend-only.md) for the no-PII policy.

---

## Client-Side Events (`trackEvent` → AuditLog)

Events are fired from browser components via `lib/trackEvent.ts` and stored as `AuditLog` rows.

### Core events

| Constant | Event name | Description |
|---|---|---|
| `LESSON_VIEW` | `lesson_view` | Teacher/student views a lesson |
| `LESSON_COMPLETE` | `lesson_complete` | Lesson marked complete |
| `HOMEWORK_START` | `homework_start` | Student starts homework |
| `HOMEWORK_SUBMIT` | `homework_submit` | Homework submitted |
| `LOGIN` / `LOGOUT` | `login` / `logout` | Auth events |

### Onboarding events (ENABLE_GUIDED_ONBOARDING)

| Constant | Event name | Key payload fields |
|---|---|---|
| `ONBOARDING_STEP_COMPLETED` | `onboarding.step_completed` | `stepIndex`, `schoolId` |
| `ONBOARDING_COMPLETED` | `onboarding.completed` | `schoolId` |
| `ONBOARDING_DISMISSED` ★ | `onboarding.dismissed` | `stepIndex`, `schoolId` |
| `ONBOARDING_REOPENED` ★ | `onboarding.reopened` | `schoolId` |

### Accessibility events (ENABLE_ACCESSIBILITY_MODE)

| Constant | Event name | Key payload fields |
|---|---|---|
| `ACCESSIBILITY_MODE_TOGGLED` | `accessibility.mode_toggled` | `enabled`, `schoolId` |

### Training events (ENABLE_TRAINING_CENTER)

| Constant | Event name | Key payload fields |
|---|---|---|
| `TRAINING_MODULE_OPENED` | `training.module_opened` | `moduleId`, `schoolId` |
| `TRAINING_MODULE_STEP_COMPLETED` | `training.module_step_completed` | `moduleId`, `stepIndex` |
| `TRAINING_MODULE_COMPLETED` | `training.module_completed` | `moduleId`, `schoolId` |
| `TRAINING_LEVEL_COMPLETED` | `training.level_completed` | `level`, `schoolId` |
| `TRAINING_BADGE_AWARDED` | `training.badge_awarded` | `badge`, `schoolId` |
| `TRAINING_MODULE_ABANDONED` ★ | `training.module_abandoned` | `moduleId`, `stepIndex`, `schoolId` |
| `TRAINING_LEVEL_ABANDONED` ★ | `training.level_abandoned` | `level`, `schoolId` |

### Offline / ops events ★

| Constant | Event name | Key payload fields |
|---|---|---|
| `OFFLINE_SYNC_CONFLICT_DETECTED` | `offline.sync_conflict_detected` | `count`, `schoolId` |
| `OFFLINE_QUEUE_DEADLETTERED` | `offline.queue_deadlettered` | `count`, `schoolId` |
| `SMS_FAILED_RATE_COMPUTED` | `sms.failed_rate_computed` | `rate`, `windowHours`, `schoolId` |

★ = Added in Block 5

---

## Server-Side Metric Events (`recordMetricEvent` → MetricEvent)

Server-side operational signals stored in the `MetricEvent` table.

### Existing metric event names

| Event name | Emitted by | Payload |
|---|---|---|
| `sms.sent` | `sms-service.ts` | `{ messageType }` |
| `sms.failed` | `sms-service.ts` | `{ error }` |
| `sms.throttled` | `sms-service.ts` | `{ windowHours }` |
| `sms.retry` | `sms-service.ts` | `{ attempt }` |
| `sms.blocked.opted_out` | `sms-service.ts` | — |
| `sync.attempt` | offline sync | — |
| `sync.failure` | offline sync | `{ error }` |
| `sync.result` | offline sync | `{ processed, conflicts }` |
| `offline.queue.pending` | offline queue | `{ count }` |
| `offline.queue.conflicts` | offline queue | `{ count }` |
| `offline.queue.dead_letter` | offline queue | `{ count }` |
| `export.generated` | export service | `{ exportType }` |
| `export.failed` | export service | `{ error }` |
| `training.module_opened` | training open API | `{ moduleId }` |
| `training.module_completed` | training complete API | `{ moduleId }` |
| `training.level_completed` | training complete API | `{ level }` |
| `training.badge_awarded` | training complete API | `{ badge }` |

---

## Ops Aggregate Metrics (Block 5)

Computed by `lib/ops/aggregates.ts`. Used as input to the findings engine.

### Onboarding aggregates

| Metric | Source | Formula |
|---|---|---|
| `completionRate` | MetricEvent | completed / (completed + dismissed) |
| `abandonRate` | MetricEvent | dismissed / (completed + dismissed) |
| `totalDismissed` | MetricEvent count of `onboarding.dismissed` | — |
| `totalReopened` | MetricEvent count of `onboarding.reopened` | — |

### Training aggregates

| Metric | Source | Formula |
|---|---|---|
| `l1CompletionRate` | TrainingProgress | teachers with all L1 modules complete / total teachers |
| `l2CompletionRate` | TrainingProgress | teachers with all L2 modules complete / total teachers |
| `l3CompletionRate` | TrainingProgress | teachers with all L3 modules complete / total teachers |
| `totalAbandoned` | MetricEvent | count of `training.module_abandoned` + `training.level_abandoned` |

### SMS aggregates

| Metric | Source | Formula |
|---|---|---|
| `failureRate` | MetricEvent | sms.failed / (sms.sent + sms.failed) |
| `throttledCount` | MetricEvent | count of `sms.throttled` |

### Offline aggregates

| Metric | Source | Formula |
|---|---|---|
| `conflictCount` | MetricEvent | sum of `count` in `offline.sync_conflict_detected` + `offline.queue.conflicts` |
| `deadLetterCount` | MetricEvent | sum of `count` in `offline.queue_deadlettered` + `offline.queue.dead_letter` |

---

## Education-Specific Metrics (Original)

- Onboarding completion rate ← now tracked via `onboarding.completed` + `onboarding.dismissed`
- Teacher workflow drop-offs ← tracked via `training.module_abandoned`, `training.level_abandoned`
- Offline conflict rate ← `offline.sync_conflict_detected`, `offline.queue.conflicts`
- SMS delivery + opt-out rate ← `sms.sent`, `sms.failed`, `sms.blocked.opted_out`
- AI suggestion acceptance/override rate ← future (Phase 2 AI factory)

---

## Definition of Done

A feature is incomplete if it ships without:
1. At least one metric event for the primary success path
2. At least one metric event for the primary failure path
3. A `schoolId`-scoped payload (or explicit `null` for global events)
4. Zero PII keys in any emitted payload

---

## Related

- [ADR-0007 — Ops Agent Recommend-Only + No-PII Policy](../adr/0007-ops-agent-recommend-only.md)
- [ADR-0004 — SMS Throttle Rate Limiting](../adr/0004-sms-throttle-rate-limit.md)
- [ADR-0001 — Offline-First Protocol](../adr/0001-offline-first.md)
- [SELF_HEALING_OPS_AGENT.md](../ops/SELF_HEALING_OPS_AGENT.md)

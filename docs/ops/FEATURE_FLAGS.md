# Feature Flags & Kill Switches

## Why
National systems require safe rollback and controlled rollout.

## Rules
- Any major feature must be flaggable.
- Phase 4 features must always be flaggable.
- Flags must support tenant-level configuration (future-ready).

## Emergency Switches
- disable messaging (per tenant)
- disable AI generation (fallback to manual tools)
- enable degraded mode (reduce heavy operations)

## Operational Discipline
Flags are not optional. They are safety infrastructure.

---

## SMS Throttle Rate Limiting

Prevents guardian inbox flooding from misconfigured event triggers or runaway notification loops.

| Environment Variable         | Type    | Default | Description                                                         |
|-----------------------------|---------|---------|---------------------------------------------------------------------|
| `SMS_THROTTLE_ENABLED`      | boolean | `true`  | Set to `"false"` to disable throttle (e.g., during a known drill). |
| `SMS_THROTTLE_WINDOW_HOURS` | integer | `24`    | Rolling window length in hours for the per-guardian send count.    |
| `SMS_THROTTLE_MAX_PER_WINDOW` | integer | `3`  | Max `sent` + `queued` messages allowed per guardian per window.    |

**Behaviour when throttled:**
- Delivery log is created with `status = blocked`.
- `sms.throttled` metric event is emitted (severity: `warning`).
- Provider is **not** called — no charge, no guardian message.
- Idempotency key still applies: a throttled attempt does not block a future retry once the window clears (the log has a distinct idempotency key).

**Telemetry:**
- `sms.throttled` — counter, school-scoped.
- Visible in `aggregateMetrics().sms.throttledCount`.

**Related ADR:** [ADR-0004 — SMS Guardian Throttle Rate Limiting](../adr/0004-sms-throttle-rate-limit.md)

---

## SMS Retry Policy

Controls exponential-backoff retry behaviour for transient provider failures.

| Environment Variable    | Type    | Default | Description                                    |
|------------------------|---------|---------|------------------------------------------------|
| `SMS_MAX_ATTEMPTS`     | integer | `3`     | Maximum delivery attempts before marking failed. |
| `SMS_BASE_BACKOFF_MS`  | integer | `250`   | Base delay (ms) for exponential backoff.       |

---

## Pilot-Only Data Isolation

All SMS delivery logs, guardian consents, metric events, and export records carry a `pilotOnly` boolean (`true` by default). This isolates pilot-phase data from future production records and enables clean post-pilot analytics segmentation.

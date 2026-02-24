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

---

## Training Center

Enables the in-platform Micro Training & Adoption Engine (Block 4).
Controls all UI surfaces and route access for the Training Center feature.

| Environment Variable                    | Type    | Default | Description                                                                     |
|-----------------------------------------|---------|---------|---------------------------------------------------------------------------------|
| `NEXT_PUBLIC_ENABLE_TRAINING_CENTER`    | boolean | `false` | Set to `"true"` to show the Training Center on the teacher dashboard and enable `/teacher/training/*` and `/admin/training/adoption` routes. |

**When `false`:**
- No Training tab or card appears in the Teacher Dashboard.
- `/teacher/training/*` routes redirect to `/teacher`.
- `/admin/training/adoption` redirects to `/admin`.
- Training Adoption link is hidden from Admin Console nav.

**When `true`:**
- `🎓 Training` tab appears in Teacher Dashboard nav.
- Training Center card appears on Teacher Dashboard (shows earned badges when present).
- `/teacher/training` shows Level 1–3 modules with progress indicators.
- `/teacher/training/[moduleId]` shows step-by-step module player.
- `/admin/training/adoption` shows school-wide teacher adoption counts.

**API routes are NOT flag-gated** (`/api/teacher/training/*`, `/api/admin/training/adoption`).
They remain active regardless of the flag to support tooling and future CLI scripts.

**Telemetry events** (all emitted when training is active):
- `training.module_opened` — school-scoped, severity: info
- `training.module_step_completed` — client-side via `/api/track`
- `training.module_completed` — school-scoped, severity: info
- `training.level_completed` — school-scoped, severity: info
- `training.badge_awarded` — school-scoped, severity: info

**Related ADR:** [ADR-0006 — Training Center Architecture](../adr/0006-training-center.md)

---

## Pilot-Only Data Isolation

All SMS delivery logs, guardian consents, metric events, and export records carry a `pilotOnly` boolean (`true` by default). This isolates pilot-phase data from future production records and enables clean post-pilot analytics segmentation.

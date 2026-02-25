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

---

## MOE Governance (Block 6)

Controls the compliance audit log search, data export routes, and national aggregates.

### Circuit Breaker Policy

The governance circuit breaker is a single kill switch for the entire governance
subsystem. When tripped, ALL governance exports and audit log search return `503`.

**When to trip:** During a security incident where you suspect governance features
may expose data inappropriately. Trip immediately, investigate, then clear.

```
ENABLE_GOV_CIRCUIT_BREAKER=true   # Trip — disable ALL governance features
ENABLE_GOV_CIRCUIT_BREAKER=false  # Clear — re-enable governance features
```

The circuit breaker overrides all individual governance flags.

### Runtime-Safe Flags (Governance)

All governance flags are server-side only (no `NEXT_PUBLIC_` prefix).
They are read at call-time, making them safe to change without a server restart
in environments that support live environment variable updates.

| Environment Variable | Type | Default | Description |
|---------------------|------|---------|-------------|
| `ENABLE_GOV_CIRCUIT_BREAKER` | boolean | `false` | **Emergency kill switch.** Disables all governance features instantly. Set to `"true"` during incidents. |
| `ENABLE_GOV_EXPORTS` | boolean | `true` | Master switch for all governance export routes (student performance, class summary, monthly report). Set `"false"` to disable all. |
| `ENABLE_GOV_NATIONAL_EXPORT` | boolean | `true` | Allows platform admins to request national-scope exports. Set `"false"` to restrict to school-scope only. |
| `ENABLE_GOV_AUDIT_SEARCH` | boolean | `true` | Enables audit log search and CSV download at `/admin/compliance`. |
| `ENABLE_GOV_STUDENT_PII_EXPORT` | boolean | `false` | **Safe default OFF.** Allows PII fields in exports. Must be explicitly `"true"`. Requires platform-admin role. |

### Operational Runbook for Governance Flags

**Disable all governance exports (incident response):**
```bash
ENABLE_GOV_CIRCUIT_BREAKER=true
```

**Disable only national exports (data concern):**
```bash
ENABLE_GOV_NATIONAL_EXPORT=false
```

**Enable PII exports (requires MOE authorization):**
```bash
ENABLE_GOV_STUDENT_PII_EXPORT=true  # Only after institutional approval
```

**Telemetry events (all server-side, no PII):**
- `gov.export.generated` — counter, scoped to school or national
- `gov.export.failed` — error counter (future)

**Related ADR:** [ADR-0008 — MOE Governance Controls](../adr/0008-moe-governance-controls.md)

---

## OPS AI Explanations (Block 5)

Controls the AI-powered ops findings explanation endpoint.

| Environment Variable | Type | Default | Description |
|---------------------|------|---------|-------------|
| `OPS_AI_EXPLANATIONS_ENABLED` | boolean | `false` | Enables the AI explanation endpoint. Default OFF. |
| `OPS_AI_MIN_SEVERITY` | string | `warn` | Minimum finding severity for AI explanations (`info`, `warn`, `critical`). |
| `OPENAI_API_KEY` | string | — | Required when OPS AI is enabled. Never commit this value. |

**Related ADR:** [ADR-0007 — Ops Agent Recommend-Only](../adr/0007-ops-agent-recommend-only.md)

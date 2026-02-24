# ADR 0004 — SMS Guardian Throttle Rate Limiting

## Status
Accepted

## Context
LiberiaLearn sends automated SMS messages to guardians for absence alerts, at-risk flags, and praise notifications. Without a rate limit, two failure modes can silently flood a guardian's phone:

1. **Misconfigured event triggers** — a buggy attendance loop could fire `absence` events for every meeting, producing dozens of messages per day.
2. **Retry amplification** — a transient provider failure combined with aggressive retries could re-queue the same message multiple times before idempotency is enforced.

Both scenarios damage guardian trust, risk regulatory non-compliance with Liberia telecommunications norms, and may incur unexpected provider costs.

## Decision
We introduce a **per-guardian, per-school, rolling-window rate limit** enforced in `sendGuardianSMS` before the provider is called:

- The window and limit are configurable via env vars (`SMS_THROTTLE_WINDOW_HOURS`, `SMS_THROTTLE_MAX_PER_WINDOW`).
- The feature is controlled by a kill switch: `SMS_THROTTLE_ENABLED=false` disables it without a code deploy.
- When throttled, the delivery log is created with `status = blocked` and a `sms.throttled` metric event is emitted — no provider call is made.
- The throttle check is **always scoped by `schoolId` and `guardianId`** to preserve multi-tenant isolation (ADR-0002).
- The throttle check is **skipped** when the message is already blocked by opt-out or channel preference, to avoid unnecessary DB round-trips.

**Default limits:** 3 messages per guardian per 24-hour rolling window.

## Consequences
- Legitimate high-frequency scenarios (e.g., multiple absences in one day for different students) may be throttled. Operators can raise `SMS_THROTTLE_MAX_PER_WINDOW` or widen `SMS_THROTTLE_WINDOW_HOURS`.
- `aggregateMetrics()` now surfaces `sms.throttledCount` for operational visibility.
- The `SMSDeliveryStatus` enum is unchanged: `blocked` covers both channel-blocked and throttled cases; differentiation is via the metric event name (`sms.throttled` vs `sms.blocked.opted_out`).
- No schema migration required — throttle count is derived from the existing `SMSDeliveryLog` table using tenant-scoped `count` queries.

## Alternatives Considered
- **No rate limiting** (rejected: too high a risk of guardian inbox flooding at national scale)
- **Database-level throttle table** (deferred: adds schema complexity without benefit given existing `SMSDeliveryLog` data)
- **Provider-side rate limiting only** (rejected: does not prevent charge or log entries; provides no guardian UX protection)

## References
- [docs/ops/FEATURE_FLAGS.md](../ops/FEATURE_FLAGS.md) — flag documentation
- ADR-0002 — Multi-Tenant School Isolation Model
- ADR-0001 — Offline Sync Protocol (related: delivery integrity)

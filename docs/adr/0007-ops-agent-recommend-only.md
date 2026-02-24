# ADR-0007 — Ops Agent: Recommend-Only Architecture + No-PII Prompt Policy

**Date:** 2026-02-24
**Status:** Accepted
**Deciders:** Systems Engineering (Principal), National Platform Team
**Supersedes:** `docs/ops/SELF_HEALING_OPS_AGENT.md` (Stage 1–3 autonomous design — replaced)

---

## Context

Block 5 introduces automated detection of operational issues and an optional AI-powered explanation feature. Two architectural decisions need to be recorded:

1. **Should the ops agent apply remediations autonomously?**
2. **What data may be included in AI prompts?**

These decisions directly impact system safety, teacher privacy, and national audit compliance.

---

## Decision 1 — Recommend-Only (No Autonomous Remediations)

### Decision

The Ops Agent **never applies changes autonomously**. Every recommended action — including flag changes — requires an explicit human decision by an authenticated admin.

### Rationale

| Option | Evaluation |
|---|---|
| **Autonomous remediation** (toggle flags automatically) | High-risk: bugs in rule logic could inadvertently disable SMS for an entire school, or lock teachers out of training. Liberia's network context means errors may go unnoticed for hours. |
| **Recommend-only** ✅ | All changes are explicit. Admin reviews finding + recommended actions → applies manually. No side effects from the engine itself. |
| **Two-phase (recommend + confirm)** | More complex UI; deferred to V2 if adoption data shows need. |

### Consequences

- `recommendedFlags` in `OpsFinding` are stored as JSON and displayed for human review. The engine never calls any flag-setter function.
- `recommendedActions` are plain-language steps — the engine emits text, not code execution.
- Future V2 may introduce a "one-click apply" for specific low-risk flag changes after field testing.

---

## Decision 2 — No PII in AI Prompts

### Decision

AI prompts sent to OpenAI must contain **only aggregate signal values**. No personally identifiable information (PII) may appear in any prompt.

### Prohibited in prompts

- Teacher names, emails, or user IDs
- Guardian phone numbers or email addresses
- Student names, IDs, or identifiers
- School names (to avoid re-identification via small cohorts)
- Any field from `User`, `Student`, `SMSDeliveryLog.phoneE164`, or `GuardianConsent`

### Allowed in prompts

- Aggregate counts and rates (`failureRate: 0.42`, `totalAbandoned: 15`)
- Signal metadata (`signalKey`, `severity`, `category`, `windowHours`)
- Feature flag names (not values)
- Recommended action strings (pre-defined, no user data)

### Implementation

- `buildSafePromptContext()` in `lib/ops/findings-engine.ts` is the single source of truth for what enters the prompt.
- A `promptHash` (SHA-256 of the sanitized prompt) is stored in `OpsExplanation` for audit replay detection.
- The raw OpenAI response is stored in `OpsExplanation.rawJson` for audit, not re-sent to any client.
- Tests in `__tests__/ops-explain.test.ts` assert that PII key patterns are absent from captured prompts.

### Rationale

| Concern | Mitigation |
|---|---|
| OpenAI data retention | Aggregate-only prompts contain no identifiable data — even if retained, they cannot be used to identify individuals. |
| Liberia data protection law | Aligns with draft data protection bill requiring PII to remain in-country or be anonymised before export. |
| Trust with schools | Schools adopting the platform must be confident that teacher/guardian data is not sent to external AI services. |
| Prompt injection | Aggregate values are numbers/strings, not user-controlled free text — drastically reduces injection surface. |

---

## Decision 3 — AI is Advisory; Manual Action Required

### Decision

AI explanations are generated **only on explicit admin request**. There is no auto-explain mode by default.

### Feature flags

| Flag | Default | Purpose |
|---|---|---|
| `OPS_AI_EXPLANATIONS_ENABLED` | `false` | Must be explicitly enabled to activate the endpoint |
| `OPS_AI_MIN_SEVERITY` | `warn` | Minimum finding severity for AI generation |

The endpoint returns `403 feature_disabled` unless `OPS_AI_EXPLANATIONS_ENABLED=true`.

Even with the flag enabled, the admin must click "Generate AI Explanation" on a specific finding. There is no background job, no webhook, and no automatic trigger.

### Consequences

- AI costs are bounded (only triggered by explicit admin action on specific findings).
- Every AI call produces an audit record (`OpsExplanation` with `promptHash`, `modelUsed`, `createdAt`).
- Explanations are cached per finding — re-requesting does not re-call OpenAI.

---

## Alternatives Considered

### Auto-explain on finding creation

**Rejected.** Would send many AI calls for noisy/informational findings. Hard to predict cost. Removes human judgment from the loop.

### Store full prompt for audit

**Rejected.** Even though prompts contain no PII, storing full prompts in DB is unnecessary and increases storage cost. The `promptHash` (SHA-256) is sufficient for replay detection and integrity verification.

### Use a local/on-device model

**Deferred to V2.** Liberia has unreliable internet. A local model deployment would be better for offline-first scenarios. The current design uses OpenAI only for admin-facing tooling (not teacher-facing), so connectivity is acceptable.

---

## Status

Accepted. Implementation complete in Block 5. To be revisited when:
- School count exceeds 50 (evaluate auto-explain cost)
- Liberia data protection legislation finalises
- V2 "one-click apply for safe flags" feature is scoped

---

## Related

- [ADR-0004 — SMS Throttle Rate Limiting](./0004-sms-throttle-rate-limit.md)
- [ADR-0003 — AI Transparency](./0003-ai-transparency.md)
- [ADR-0002 — Tenant Isolation](./0002-tenant-isolation.md)
- [ADR-0001 — Offline-First Protocol](./0001-offline-first.md)
- [SELF_HEALING_OPS_AGENT.md](../ops/SELF_HEALING_OPS_AGENT.md)
- [TELEMETRY_OBSERVABILITY.md](../architecture/TELEMETRY_OBSERVABILITY.md)

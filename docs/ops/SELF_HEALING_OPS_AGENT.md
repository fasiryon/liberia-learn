# Self-Healing Ops Agent — SAFE MODE (Recommend-Only)

**Status:** Block 5 — Implemented (V1: Deterministic + AI-Advisory)
**Last updated:** 2026-02-24

---

## Philosophy

The Ops Agent is a **recommend-only** system. It detects issues and proposes actions, but it **never applies changes autonomously**. Every remediation requires an explicit human decision.

This is a deliberate architectural constraint — see [ADR-0007](../adr/0007-ops-agent-recommend-only.md).

---

## Architecture (Two-Part)

```
MetricEvents + TrainingProgress + SMSDeliveryLog
              │
              ▼
    ┌─────────────────────┐
    │  Part A: Findings   │  ← Deterministic, authoritative
    │  Engine (rules.ts)  │
    └────────┬────────────┘
             │  OpsFinding rows (open|ack|resolved)
             ▼
    ┌─────────────────────┐
    │  Part B: AI Explain │  ← Advisory only, off by default
    │  (OpenAI Responses) │
    └────────┬────────────┘
             │  OpsExplanation rows (linked to finding)
             ▼
    Admin UI: /admin/ops/findings
```

---

## Part A — Deterministic Findings Engine

**File:** `lib/ops/findings-engine.ts`
**Rules:** `lib/ops/rules.ts`
**Trigger:** Manual (Admin presses "Run Engine Now" button) or via POST `/api/admin/ops/findings`

### Finding shape

| Field | Type | Description |
|---|---|---|
| `signalKey` | string | Unique rule identifier (e.g. `sms.high_failure_rate`) |
| `severity` | `info \| warn \| critical` | Determined by rule logic |
| `category` | `sms \| onboarding \| training \| offline \| auth` | Problem domain |
| `windowHours` | int | Look-back window for the aggregate |
| `baseline` | float? | Expected normal value |
| `current` | float? | Observed value that triggered the rule |
| `deltaPct` | float? | `(current - baseline) / baseline × 100` |
| `recommendedActions` | string[] | Plain-language steps for the operator |
| `recommendedFlags` | `{flag,setValue}[]` | Suggested flag changes — **advisory only** |
| `status` | `open \| ack \| resolved` | Updated by admin |

### Starter rules (8)

| signalKey | Category | Trigger | Severity |
|---|---|---|---|
| `sms.high_failure_rate` | sms | failureRate ≥ 30% | warn; ≥ 60% → critical |
| `sms.throttle_spike` | sms | throttledCount ≥ 5 | warn |
| `onboarding.low_completion` | onboarding | completionRate < 50% AND dismissed ≥ 3 | warn |
| `onboarding.abandon_spike` | onboarding | abandonRate ≥ 60% | warn |
| `training.l1_low_adoption` | training | l1Rate < 20%, teachers ≥ 3 | info; < 10% → warn |
| `training.abandon_spike` | training | totalAbandoned ≥ 10 | info; ≥ 20 → warn |
| `offline.deadletter_nonzero` | offline | deadLetterCount > 0 | warn |
| `offline.conflict_spike` | offline | conflictCount ≥ 20 | warn; ≥ 50 → critical |

### Deduplication

A finding is not created if an `open` or `ack` finding with the same `signalKey + schoolId` already exists within the rule's `windowHours`. This prevents flooding the admin with duplicate alerts.

### Tenant isolation

Every finding is scoped to `schoolId`. Non-platform-admin users can only see findings for their own school. Platform admins may specify `schoolId` or query globally.

---

## Part B — OpenAI Explanations (Advisory)

**File:** `app/api/admin/ops/findings/[findingId]/explain/route.ts`
**Model:** `gpt-4o-mini` via OpenAI Responses API (server-side only)
**Trigger:** Manual — Admin clicks "Generate AI Explanation" on a finding detail page

### Guardrails

1. **Feature flag:** `OPS_AI_EXPLANATIONS_ENABLED=true` required (default: false).
2. **Severity gate:** Finding severity must meet `OPS_AI_MIN_SEVERITY` (default: `warn`).
3. **PII-free prompts:** Only aggregate signal values enter the prompt. No names, phones, student IDs, or guardian identifiers.
4. **Advisory only:** AI output is stored for human review. It never mutates flags, config, or sends messages.
5. **JSON validation:** Model output is parsed and validated against the required schema. Malformed responses return 502 and are logged.
6. **Audit trail:** `OpsExplanation` stores the model name, promptHash (SHA-256), and full raw response.
7. **Idempotent:** Calling the endpoint a second time returns the cached explanation without re-calling OpenAI.

### Explanation output shape

```json
{
  "summary":     "1–2 sentence plain-language summary",
  "hypotheses":  ["root cause 1", "root cause 2", "root cause 3"],
  "checklist":   ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "monitor_next": ["What to watch over the next 24–48 hours"]
}
```

### Feature flags

| Variable | Default | Description |
|---|---|---|
| `OPS_AI_EXPLANATIONS_ENABLED` | `false` | Enables the `/explain` endpoint |
| `OPS_AI_MIN_SEVERITY` | `warn` | Minimum finding severity for AI generation |
| `OPENAI_API_KEY` | — | OpenAI API key (server-side only, never exposed to client) |

---

## Admin UI

| Route | Description |
|---|---|
| `/admin/ops/findings` | List with severity/category/status filters; Run Engine button |
| `/admin/ops/findings/[id]` | Detail: metrics, recommended actions, flags, AI explanation |

All pages have:
- **Escape hatch:** ← Back link at top
- **Keyboard navigation:** All interactive elements are focusable with visible focus rings
- No automatic actions — every mutation is an explicit button click

---

## Hard Prohibitions

- ❌ No autonomous production deploys
- ❌ No autonomous DB migrations or schema changes
- ❌ No autonomous flag application (flags listed as `recommendedFlags` are advisory only)
- ❌ No PII in telemetry events or AI prompts
- ❌ No AI calls without `OPS_AI_EXPLANATIONS_ENABLED=true` AND admin manual action

---

## Data Flow (No Cross-Tenant Leakage)

```
Teacher (School A) → MetricEvent (schoolId: A)
                      ↓
          Findings Engine (scoped WHERE schoolId = A)
                      ↓
          OpsFinding (schoolId: A)
                      ↓
          Admin (School A) → sees only School A findings
          Platform Admin   → can query any schoolId
```

---

## V2 Roadmap (Not Yet Implemented)

- Scheduled engine runs (cron job / server action)
- Email digest of new critical findings
- Trend tracking (baseline vs. previous window)
- Auth category rules (failed login spikes, suspicious role changes)
- Multi-school batch scan for platform admins

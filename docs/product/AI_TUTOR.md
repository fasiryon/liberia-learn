# AI Tutor & Teacher Assist — Product & Implementation Reference

> **Feature flags:** `AI_TUTOR_ENABLED=true` | `AI_TEACHER_ASSIST_ENABLED=true` (both default OFF)
> **Status:** V1 — Block 10 (February 2026)
> **Related ADR:** [ADR-0012 — AI Stabilization Policy](../adr/0012-ai-stabilization-policy.md)
> **Depends on:** Block 7A (Mastery Engine), Block 7B (Adaptive Baseline)

---

## What It Does

### Student AI Tutor (`POST /api/student/tutor`)

Provides strand-targeted explanations, practice prompts, and step-by-step guidance based
on a student's current mastery context. Accessible to any authenticated user.

Input fields (none are PII):

| Field | Values |
|---|---|
| `subject` | e.g. `Mathematics`, `English` |
| `strandKey` | e.g. `fractions.adding` |
| `masteryState` | `NOT_ASSESSED` \| `DEVELOPING` \| `APPROACHING` \| `MASTERED` |
| `proficiencyState` | `NOT_ASSESSED` \| `BELOW_PROFICIENT` \| `APPROACHING` \| `PROFICIENT` |
| `gradeBand` | `lower_primary` \| `upper_primary` \| `junior_secondary` |
| `requestType` | `explain` \| `practice` \| `step_by_step` \| `reinforce` |

Response:

```json
{
  "explanation": "...",
  "practicePrompt": "..." | null,
  "guidanceLevel": "light" | "moderate" | "intensive",
  "confidenceScore": 0.0–1.0,
  "hadFallback": false
}
```

### Teacher Support Assistant (`POST /api/teacher/assist`)

Suggests practical reinforcement activities based on class-wide aggregate mastery patterns.
Requires `TEACHER` role.

Input fields (class-aggregate only — no individual student data):

| Field | Description |
|---|---|
| `subject` | Subject name |
| `strandKey` | Primary strand focus |
| `classAverageMasteryState` | Class-wide aggregate (not any individual) |
| `weakStrandKeys` | Array of strand keys needing support (max 10) |
| `gradeBand` | Grade band for the class |

Response:

```json
{
  "reinforcementSuggestions": ["...", "..."],
  "pacingSuggestion": "...",
  "resourceHints": ["..."],
  "hadFallback": false
}
```

---

## What It NEVER Does

- **No PII** — No student names, IDs, teacher names, or school names enter any AI prompt.
- **No autonomous mutation** — AI output is advisory only. It never modifies mastery profiles,
  flags, grades, or any persistent state.
- **No evaluation** — Teacher assist never scores or ranks teachers. Language is always
  supportive and constructive.
- **No student identification** — `AiInteractionLog` has no `studentId` column. Correlation
  metrics are stored at subject/strand/gradeBand level only.
- **No cross-tenant leakage** — `studentId` is always taken from the session, never from the
  request body. `schoolId` is from session.

---

## Guardrails for Minors

The student tutor system prompt enforces:

1. **No harmful content** — Guide understanding; never provide inappropriate content.
2. **Age-appropriate language** — Calibrated to `gradeBand` (primary / secondary).
3. **No direct assessment answers** — Guidance only; not cheating enablement.
4. **JSON-only output** — Structured format prevents prompt injection in response.
5. **Parse + validate** — Response schema is validated; any deviation triggers fallback.

---

## Cost Control Policy

Budget enforcement is **automatic** and **non-blocking**:

| Threshold | Action |
|---|---|
| `monthlySpend >= 80% of cap` | Emit `ai.budget.warning` metric event |
| `monthlySpend >= cap` | Return 503 gracefully; AI calls halted for the month |

Default cap: **$100/month** (`AI_BUDGET_MONTHLY_CAP_USD`).

Cost is tracked in `AiInteractionLog.estimatedCostUSD` using the token cost model
from `lib/ai/router.ts` (OpenAI gpt-4o-mini and Groq rates). Costs are estimates —
actual billing should be monitored via the OpenAI dashboard.

---

## Rate Limits

Rate limits are enforced per authenticated user per calendar day, counted against
`AuditLog` entries with the corresponding `action`.

| Endpoint | Default limit | Config env var |
|---|---|---|
| `/api/student/tutor` | 20 calls/user/day | `AI_TUTOR_DAILY_LIMIT` |
| `/api/teacher/assist` | 50 calls/teacher/day | `AI_TEACHER_ASSIST_DAILY_LIMIT` |

Returns `429 rate_limit_exceeded` when exceeded.

---

## Fallback Behavior

The system **always returns a valid response** — AI availability is never a hard
requirement. When the AI call fails (network error, OpenAI outage, JSON parse error,
or schema validation failure):

- `hadFallback: true` is set in the response
- A pre-written, curriculum-aligned fallback message is returned
- `ai_tutor_fallback` / `ai_teacher_assist_fallback` metric is emitted
- No error is propagated to the user

The system functions fully without AI enabled. Setting both flags to `false`
returns 404s — the platform continues to operate normally.

---

## AI Correlation Tracking

After an AI tutor interaction, the next mastery evidence submission for the
same student × strand can trigger a correlation check via `scheduleAiCorrelationCheck()`.

The result (`improved`, `unchanged`, `declined`) is stored as a `MetricEvent`
with `name = "ai_tutor_correlation"`.

**No student identifier is stored.** Correlation is at `subject + strandKey + gradeBand`
level for aggregate analysis only.

---

## Audit Trail

Every AI call writes an `AuditLog` entry:

| Field | Value |
|---|---|
| `action` | `ai.tutor.requested` or `ai.teacher.assist.requested` |
| `resourceType` | `ai_tutor` or `ai_teacher_assist` |
| `userId` | Session user ID |
| `schoolId` | Session school ID |
| `details` | subject, strandKey, requestType, guidanceLevel, hadFallback |
| `details` (teacher) | subject, strandKey, classAverageMasteryState, weakStrandCount, hadFallback |

No student names, student scores, or identifiers appear in the details payload.

---

## Feature Flag Reference

All flags are server-side (`lib/serverFlags.ts`) — no `NEXT_PUBLIC_` prefix.

| Env var | Default | Description |
|---|---|---|
| `AI_TUTOR_ENABLED` | `false` | Enable student tutor endpoint |
| `AI_TEACHER_ASSIST_ENABLED` | `false` | Enable teacher assist endpoint |
| `AI_TUTOR_DAILY_LIMIT` | `20` | Max tutor calls per user per day |
| `AI_TEACHER_ASSIST_DAILY_LIMIT` | `50` | Max teacher assist calls per teacher per day |
| `AI_BUDGET_MONTHLY_CAP_USD` | `100` | Monthly spend cap in USD |

---

## Known Limitations (Block 10)

1. **Correlation check is manual** — `scheduleAiCorrelationCheck()` must be called
   from evidence processing code; it is not yet wired automatically.
2. **Cost estimates** — Token costs are estimated using fixed rates from `router.ts`.
   Actual costs may vary; monitor the OpenAI billing dashboard.
3. **No per-strand rate limit** — Rate limit is per user per day across all strands.
   Block 11 may add per-strand throttling.
4. **Groq fallback for smart tier** — If `GROQ_API_KEY` is set, fast-tier requests
   use Groq. The student tutor forces smart tier (`forceSmartTier: true`) so Groq
   is only used if OpenAI is unavailable.

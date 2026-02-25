# ADR-0012 — AI Stabilization Policy (Block 10)

**Status:** Accepted
**Date:** 2026-02-25
**Block:** 10
**Authors:** Engineering (LiberiaLearn)
**Related:** ADR-0002 (Tenant Isolation), ADR-0007 (Mastery Engine), ADR-0008 (Governance Controls)

---

## Context

Blocks 7A–9 established mastery profiles, adaptive baselines, evidence pipelines, and
leadership dashboards. Block 10 adds an AI layer that uses these signals to guide students
and support teachers. This document records the non-negotiable policy decisions that govern
how AI is deployed on LiberiaLearn.

---

## Decisions

### 1. AI output is advisory-only — it never mutates data autonomously

**Decision:** All AI responses are returned to the caller as read-only text. The AI layer
has no write access to mastery profiles, student records, grades, flags, or any persistent
state. Callers decide what (if anything) to do with AI suggestions.

**Rationale:** The students and teachers on this platform are in a vulnerable educational
context. Automated mutations — even well-intentioned ones — could cause harm if the model
is wrong, biased, or manipulated. Advisory output keeps humans in the decision loop.

**Consequence:** AI cannot self-correct mastery scores, cannot auto-advance lessons, and
cannot trigger any workflow on its own. Future blocks may allow opt-in human-confirmed
mutations, but never autonomous ones.

---

### 2. No PII in any AI prompt

**Decision:** The student tutor prompt contains only `subject`, `strandKey`, `masteryState`,
`proficiencyState`, `gradeBand`, and `requestType`. No student name, studentId, teacherId,
school name, or any identifier enters any AI prompt.

**Rationale:**
- Sending PII to a third-party AI API violates Liberia's data protection obligations and
  general educational privacy standards.
- PII in prompts cannot be recalled once sent. The risk of logging, training data
  inclusion, or breach is permanent.
- The prompts are fully effective without PII — mastery context is sufficient for
  pedagogically useful guidance.

**Consequence:** The AI cannot personalise using historical conversation or student-specific
context beyond the current mastery state. This is an acceptable trade-off for privacy
safety.

---

### 3. Teacher assist is supportive, never evaluative

**Decision:** The teacher assist prompt explicitly instructs the model to avoid evaluative
or punitive framing. A post-generation guardrail scans for punitive keywords (`fail`,
`incompetent`, `deficit`, etc.) and substitutes a safe fallback if triggered.

**Rationale:**
- Teachers in low-resource settings may already feel scrutinised. AI feedback that implies
  teacher failure — even incidentally — causes harm to morale and professional trust.
- The platform's role is to support teachers, not to assess them.
- The guardrail is a belt-and-suspenders measure: the system prompt alone may be
  insufficient for all model variants.

**Consequence:** Legitimate use of words like "failing" in a curriculum context (e.g.,
"students are failing to connect fraction concepts") may also trigger the guardrail.
The guardrail errs on the side of caution — false positives return the fallback rather
than risk punitive output.

---

### 4. Both AI endpoints are feature-flagged OFF by default

**Decision:** `AI_TUTOR_ENABLED` and `AI_TEACHER_ASSIST_ENABLED` both default to `false`.
Both endpoints return 404 (not 403) when disabled.

**Rationale:**
- AI carries ongoing cost. Enabling it by default in production would cause unbounded
  spending without conscious operator action.
- The 404 response (not 403) avoids disclosing the endpoint's existence to users on
  builds where AI is not yet deployed. This pattern is established in ADR-0008 for
  governance endpoints.
- School operators should make an explicit decision to enable AI features and communicate
  the capability change to teachers and students.

**Consequence:** New deployments have no AI capability until operators set the env vars.
This is intentional.

---

### 5. Cost governance is mandatory, not optional

**Decision:** A monthly budget cap (`AI_BUDGET_MONTHLY_CAP_USD`, default $100) is
enforced in every AI API call path. At 80% of the cap, a warning metric is emitted.
At 100%, AI calls return 503 gracefully and cost the caller nothing.

**Rationale:**
- LiberiaLearn operates in a resource-constrained environment. Unbounded AI spend
  would threaten the platform's operational sustainability.
- The cap is enforced server-side — it cannot be bypassed by clients.
- The 80% warning gives operators time to increase the cap or reduce usage before
  the cutoff.

**Consequence:** During high-traffic periods, AI may become unavailable mid-month.
The fallback system ensures the platform continues to function. Operators are
responsible for monitoring the `ai.budget.warning` metric event.

---

### 6. No studentId in AiInteractionLog

**Decision:** `AiInteractionLog` has no `studentId` column. The log stores `schoolId`
(optional), `subject`, `strandKey`, `requestType`, `guidanceLevel`, `hadFallback`,
and `estimatedCostUSD`.

**Rationale:**
- Interaction logs are used for aggregate analytics (cost, fallback rate, subject
  distribution) and do not require student-level granularity.
- Storing studentId would create a PII record linking students to AI interactions,
  raising re-identification and data minimisation concerns.
- Rate limiting uses the existing `AuditLog` (which already stores userId for audit
  trail purposes) rather than introducing a second user-linked table.

**Consequence:** Per-student AI usage analytics are not possible from this table.
If per-student analytics become necessary in a future block, the decision to add
studentId should go through a fresh privacy review.

---

### 7. Fallback is always available — AI is never a hard dependency

**Decision:** Every AI call path returns a valid response whether or not the AI
call succeeds. Parse failures, validation failures, network errors, and model
unavailability all produce a pre-written fallback that is curriculum-appropriate
and safe.

**Rationale:**
- Schools in Liberia may have intermittent connectivity. AI services may be
  unavailable due to API outages or budget exhaustion.
- A broken AI endpoint that returns 500s would erode trust in the platform as a whole.
- The fallback content is reviewed for curriculum alignment and minor safety.

**Consequence:** Users may receive generic guidance when AI is unavailable. The
`hadFallback: true` field in the response allows clients to display an appropriate
notice if desired.

---

## Rejected Alternatives

| Alternative | Reason rejected |
|---|---|
| Store studentId in AiInteractionLog for personalisation | Privacy violation; re-identification risk; not necessary for cost/fallback analytics |
| Auto-apply AI suggestions to mastery profiles | AI advisory-only principle; human must confirm any data mutation |
| Hard-fail on AI unavailability | Platform must function offline-first; AI is an enhancement, not a dependency |
| Enable AI by default | Unbounded cost risk; operator must make a conscious decision |
| Use 403 when feature flag is off | 403 discloses endpoint existence; 404 is consistent with ADR-0008 |
| Single combined AI endpoint for both tutor and teacher | Different auth (requireUser vs requireRole("TEACHER")), different rate limits, different audit actions |

---

## Consequences

- AI is a transparent opt-in capability, not a background service.
- All AI calls are auditable via `AuditLog` with action-level granularity.
- Budget governance is built in at launch rather than retrofitted.
- The privacy baseline (no PII in prompts, no studentId in logs) can be relaxed in
  future blocks only with a new ADR and privacy review.
- Teachers and students may notice AI suggestions are sometimes generic (fallback).
  This is preferable to system failures or unsafe content.

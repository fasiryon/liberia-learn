# AI Workflow Tools for Teachers — Block 12B

## Overview

Block 12B introduces three AI-powered workflow tools for teachers and school
administrators. All tools are **advisory only** — they augment teacher
judgement, never replace it. All are feature-flagged and default OFF.

| Tool | Flag | Audience |
|------|------|----------|
| Assignment Tutor | `ENABLE_ASSIGNMENT_TUTOR` | Teachers |
| AI Grading Assist | `ENABLE_AI_GRADING_ASSIST` | Teachers |
| Intervention Alerts | `ENABLE_INTERVENTION_ALERTS` | School Admins |

---

## Assignment Tutor

**Route:** `POST /api/teacher/assignment/tutor`
**Auth:** TEACHER role
**Audit action:** `assignment.tutor.used`

Provides grade- and strand-specific teaching guidance for a specific assignment,
including:
- **Teaching hints** — strategies to deliver the assignment effectively
- **Anticipated misconceptions** — common student errors to prepare for
- **Scaffolding suggestions** — differentiation and support techniques

### Input

```jsonc
{
  "grade": 7,
  "subject": "MATH",
  "strandKey": "algebra.linear-equations",
  "rubric": "...",        // max 500 chars used
  "questionPrompt": "..." // max 400 chars used
}
```

No student identifiers are accepted in the request body. The endpoint actively
rejects any body field named `studentId`.

### PII Policy

- No `studentId`, student name, or school identifier appears in AI prompts.
- `teacherId` and `schoolId` are **not** included in AI prompt content.
- Audit log records `subject`, `strandKey`, `grade`, and `hadFallback` only.

### Fallback

If the AI call fails or returns invalid JSON, a safe static fallback is
returned with `hadFallback: true`. The response always has the same shape.

---

## AI Grading Assist

**Route:** `POST /api/teacher/grading/assist`
**Auth:** TEACHER role
**Audit action:** `grading.assist.used`

Provides rubric-aligned feedback on an **anonymized** student submission:
- **Feedback** — specific, constructive comments tied to rubric criteria
- **Suggested score bands** — ranges only (e.g., "Approaching Standard: 50–74%")
- **Strengths** — what the submission does well
- **Areas for development** — what needs improvement

### Teacher Final Authority

`teacherFinalAuthority: true` is always present in every response (including
fallback). The AI never assigns a final score — it suggests bands only.
Teachers retain full grading authority.

### Anonymization Responsibility

The caller (front-end or calling service) **must** strip all PII from
`submissionContent` before sending. The API trusts the caller has done this.
`submissionContent` is never written to audit logs or the AI interaction log.

### Punitive Language Guardrail

The response is checked against a keyword list that includes: `fail`, `failure`,
`incompetent`, `poor performance`, `underperforming`, `deficit`, `blame`,
`punish`, `lazy`, `careless`, `stupid`, and similar terms. If any punitive
keyword appears in the AI output, the entire response is replaced with the
safe fallback (`hadFallback: true`). This is the same keyword list used by
the teacher AI assist (Block 10).

### Input

```jsonc
{
  "subject": "SCIENCE",
  "strandKey": "biology.cells",
  "rubric": "...",              // max 500 chars used
  "submissionContent": "...",   // anonymized — max 600 chars used
  "expectedAnswer": "..."       // optional — max 300 chars used
}
```

---

## Intervention Alerts

**Route:** `GET /api/admin/dashboard/school/interventions`
**Auth:** ADMIN + `dashboard:school:interventions` permission
**Audit action:** `dashboard.interventions.school.viewed`

Surfaces class-level signals that warrant administrator attention. All alerts
are **class-scoped** — no student-level data is returned.

### Signal Types

| Signal | Trigger | Min Severity |
|--------|---------|--------------|
| `low_mastery_persistence` | ≥ 50% of class at DEVELOPING/BELOW_PROFICIENT | warning |
| `low_mastery_persistence` | ≥ 75% of class at DEVELOPING/BELOW_PROFICIENT | critical |
| `negative_growth` | Mean growth delta < 0 (any decline) | warning |
| `negative_growth` | Mean growth delta < −5pp | critical |
| `low_proficiency_rate` | Proficiency rate < 50% with no improvement trend | info |
| `low_proficiency_rate` | Proficiency rate < 25% with no improvement trend | critical |
| `stagnation` | Sample ≥ 10, mastery delta < 2pp (near zero positive) | info |

**Minimum class size:** 3 profiles. Classes with fewer are excluded to prevent
noise from very small groupings.

### No Ranking

Intervention alerts are not ranked across classes or schools. Displaying
comparative rankings could create stigma. The `triggerValue` is the raw
metric that triggered the alert, not a ranking score.

### Governance

- All `scopeId` values are `classId` (never `studentId`).
- Alerts are sorted critical → warning → info, then alphabetically by class name.
- The computation layer (`computeInterventionAlerts`) is a pure function and
  does not access the database, making it fully testable without DB mocks.

---

## Shared Governance Rules (All AI Workflow Tools)

### Monthly Budget Cap

All AI workflow calls check the monthly spend against `AI_BUDGET_MONTHLY_CAP_USD`
(default $100). If the cap is reached, the endpoint returns `503 ai_budget_exhausted`
without making an AI call. Spend is tracked in `AiInteractionLog.estimatedCostUSD`.

### AI Router Tier

Both Assignment Tutor and Grading Assist use `forceSmartTier: true` to route
to the higher-quality model (gpt-4o-mini or equivalent). This is appropriate
because these are low-frequency, high-value teacher-facing decisions.

### Audit Logging

Every successful AI workflow call writes an audit record. The audit `details`
object never contains student identifiers, submission content, or raw teacher IDs.

### Fallback Guarantee

All AI workflow tools always return a valid response shape. If the AI fails
for any reason (network error, model timeout, invalid JSON, punitive language
detected), a safe static fallback is returned with `hadFallback: true`.
The UI can display fallback content while noting that AI assistance was unavailable.

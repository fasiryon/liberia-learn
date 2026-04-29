# LiberiaLearn — Pipeline Automation Agent Design

## Purpose

The pipeline agent is the orchestration layer that drives the national curriculum from
approved lessons through audio generation, textbook compilation, and MOE packaging —
without requiring a human to trigger every batch manually.

This document specifies what the agent does, how it makes decisions, its safety envelope,
and what needs to be implemented to make it fully autonomous.

---

## Agent Scope

The agent is **not** an AI reasoning agent. It is a deterministic state machine that:
1. Reads current pipeline state from the database
2. Identifies the next safe unit of work
3. Executes it (or schedules it via existing cron/API infrastructure)
4. Records the result
5. Reports progress

The agent does **not**:
- Generate curriculum content (that is a human-reviewed step)
- Approve content (requires editorial review)
- Make decisions based on lesson quality
- Modify any APPROVED content

---

## State Machine

```
                     ┌─────────────┐
                     │   IDLE      │◄────────────────────┐
                     └──────┬──────┘                     │
                            │ tick (cron or admin trigger)│
                            ▼                             │
                     ┌─────────────┐                     │
                     │  SCAN       │                      │
                     │ (read DB)   │                      │
                     └──────┬──────┘                     │
              ┌─────────────┼─────────────┐              │
              ▼             ▼             ▼              │
     ┌──────────────┐ ┌──────────┐ ┌──────────────┐     │
     │ AUDIO_PENDING│ │TEXTBOOK  │ │ ALL_DONE     │     │
     │ exists?      │ │ READY?   │ │              │     │
     └──────┬───────┘ └────┬─────┘ └──────┬───────┘     │
            │              │              │               │
            ▼              ▼              ▼               │
     ┌────────────┐ ┌────────────┐ ┌───────────┐        │
     │ CLAIM JOBS │ │ COMPILE    │ │  REPORT   │        │
     │ (batch)    │ │ TEXTBOOK   │ │  + notify │        │
     └──────┬─────┘ └──────┬─────┘ └───────────┘        │
            │              │                             │
            ▼              ▼                             │
     ┌────────────┐ ┌────────────┐                      │
     │ PROCESS    │ │ ARCHIVE    │                      │
     │ JOBS       │ │ PDF        │                      │
     └──────┬─────┘ └──────┬─────┘                      │
            │              │                             │
            ▼              │                             │
     ┌────────────┐        │                             │
     │ EVALUATE   │        │                             │
     │ RESULT     │        │                             │
     └──────┬─────┘        │                             │
            │              │                             │
     ┌──────┴──────────────┘                             │
     ▼                                                   │
  LOG + NEXT_TICK ──────────────────────────────────────►┘
```

---

## Agent Entry Points

### 1. Vercel Cron — Scheduled (every 5 minutes)
```
POST /api/cron/process-audio-generation
Authorization: Bearer $CRON_SECRET
Body: { "limit": 3 }
```
Processes the next 3 PENDING audio jobs globally.
No grade/subject filter — processes in queue order (oldest PENDING first).

### 2. Admin Trigger — On-demand via UI
```
POST /api/admin/audio-generation/process
Cookie: <admin-session>
Body: { "limit": 5 }
```
Processes 1–5 jobs immediately. Used for manual intervention and validation.

### 3. Enqueue Trigger — Before a new phase
```
POST /api/admin/audio-generation/enqueue
Body: { "grade": N, "subject": "X", "limit": 200 }
```
Creates PENDING rows for a grade/subject. Must be called once per combo before
the cron worker can pick up jobs for that combo.

---

## Agent Decision Logic

### Selecting the next work unit

Priority order when multiple combos have PENDING audio:

```typescript
// Conceptual priority — not yet implemented as a single function
// Implemented today: claimNextAudioJobs picks oldest PENDING globally

function selectNextAudioBatch(): { grade: number; subject: string; limit: number } {
  // 1. Check for FAILED rows needing retry > 3 failures in last hour → stop
  // 2. Check for PROCESSING rows > 10 min old → reset to PENDING (stuck recovery)
  // 3. Return next PENDING batch (oldest generatedAt first — natural queue order)
}
```

### Textbook readiness gate

```typescript
// Trigger textbook compilation when:
// - readinessPct >= 80 (144+ of 180 lessons approved)
// - pending audio = 0 for that combo
// - no existing PDF for current academic year
function shouldCompileTextbook(combo: { grade: number; subject: string }): boolean {
  const status = await getAudioQueueStatus(combo);
  const readiness = await getReadinessPct(combo);
  return status.pending === 0 && status.failed === 0 && readiness >= 80;
}
```

---

## Safety Envelope

### Hard limits
- `MAX_JOBS_PER_INVOCATION = 5` (cron), `10` (admin trigger)
- Never process a job with `status !== "PENDING"` (claim check)
- Never upsert GENERATED rows to a lower status (idempotent enqueue enforced)
- Never source content from `status !== "APPROVED"` lessons

### Cost guardrails
- Daily cost cap tracked via `AIInteractionLog`
- If daily TTS spend > `AI_BUDGET_MONTHLY_CAP_USD / 30`: pause and alert
- Each batch logs `estimatedCostUsd` before running — abort if projected cost > remaining budget

### Stuck job detection (to implement)
```sql
-- Jobs stuck in PROCESSING for > 10 minutes
SELECT id, lessonId, generatedAt
FROM LessonAudio
WHERE status = 'PROCESSING'
  AND generatedAt < NOW() - INTERVAL '10 minutes';
```
Recovery: `UPDATE SET status = 'PENDING' WHERE id IN (...)`.
Implement in a periodic cleanup cron (separate from processing cron).

### Error rate stop rule
If `failed / (processed + failed) > 0.1` in a single batch → pause cron, alert admin.
Likely cause: OpenAI quota exhausted, Supabase auth rotated, or network issue.

---

## Reporting

### Per-run report (logged after each cron/admin invocation)
```json
{
  "runId": "uuid",
  "triggeredBy": "cron | admin",
  "startedAt": "ISO",
  "durationMs": 4210,
  "jobsProcessed": 3,
  "jobsFailed": 0,
  "totalCostUsd": 0.051,
  "results": [
    { "jobId": "...", "lessonId": "...", "status": "GENERATED", "url": "https://..." }
  ]
}
```
Written to: `AIInteractionLog` (one row per job via `logAIInteraction`).

### Daily summary (to implement)
```
POST /api/admin/audio-generation/report
```
Returns: per-combo progress, total cost to date, projected completion date,
failure hotspots.

### National readiness report
Derived from `getYearReadinessReport()` + `getAudioQueueStatus()` per combo.
Summary: combos at 100%, combos at 80%+, combos at <50%, total cost to date.

---

## Textbook Variants (Design Spec)

The current `compileTextbook` + `renderTextbookPdfStream` produces a student edition.
To support teacher, workbook, and assessment editions, the compiler needs a `format` parameter.

### Proposed API extension
```typescript
// lib/ai/textbook/textbookCompiler.ts
type TextbookFormat = "student" | "teacher" | "workbook" | "assessment";

async function compileTextbook(input: {
  subject: string;
  gradeLevel: number;
  schoolId?: string;
  format?: TextbookFormat;  // ADD THIS
  academicYear?: string;    // ADD THIS — default: current year
}): Promise<TextbookData>
```

### Format differences
| Format       | Content included                               |
|---|---|
| `student`    | Lesson bodies, exercises, vocabulary           |
| `teacher`    | + Lesson notes, teaching tips, answer keys     |
| `workbook`   | Exercises only, worksheet style, space for answers |
| `assessment` | Assessment lessons only, no answer keys        |

### Route extension
```
GET /api/admin/curriculum/textbook?gradeLevel=5&subject=ENGLISH&format=teacher
GET /api/admin/curriculum/textbook?gradeLevel=5&subject=ENGLISH&format=workbook
GET /api/admin/curriculum/textbook?gradeLevel=5&subject=ENGLISH&format=assessment
```

---

## Implementation Gaps (Next Sprint Candidates)

| Gap | Priority | Effort |
|---|---|---|
| Textbook formats (teacher/workbook/assessment) | High | Medium |
| Stuck-job cleanup cron | High | Small |
| PDF archive to Supabase `lesson-pdf/` bucket | High | Small |
| Daily cost report route | Medium | Small |
| Error-rate stop rule in cron handler | Medium | Small |
| `SELECT FOR UPDATE SKIP LOCKED` for concurrent workers | Low | Medium |
| National readiness dashboard page (`/admin/curriculum/national`) | Medium | Medium |
| MOE export package ZIP builder | Low | Large |

---

## Observability

### What is monitored today
- `AIInteractionLog` — every TTS call with cost, timing, status
- `AuditLog` — every textbook compilation
- `/admin/audio-generation` UI — live queue counts

### What to add
- Vercel Analytics on `/api/cron/process-audio-generation` — invocation frequency, duration
- Sentry alert on `failed / processed > 0.10` threshold
- Weekly digest email to `fasiryon@gmail.com` with pipeline progress
  (can use existing SMS/email infrastructure via `lib/guardian/sms-notifications.ts`)

---

## Rollback Strategy

| Scenario | Recovery |
|---|---|
| Batch of audio uploaded with wrong voice | `retryFailedJobs` after correcting voice param; old MP3s remain in Supabase (harmless) |
| Wrong contentVersion audio generated | Bump lesson version → stale detection triggers re-queue |
| Textbook PDF built from incomplete content | Re-trigger compile after content fill; overwrite file in Supabase |
| PROCESSING rows stuck | Manual: `retryFailedJobs` or future stuck-job cleanup cron |
| OpenAI quota exceeded | Set `ENABLE_LESSON_AUDIO_GENERATION=false` → cron becomes no-op; resume when quota restored |
| Supabase bucket made private accidentally | Re-enable public access in Supabase Dashboard; existing URLs stop serving until fixed |

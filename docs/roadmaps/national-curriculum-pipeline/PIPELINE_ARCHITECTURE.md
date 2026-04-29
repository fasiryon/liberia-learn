# LiberiaLearn — National Curriculum Pipeline Architecture

## Overview

The national curriculum pipeline converts approved lesson content into a complete,
audio-enabled, textbook-packaged national curriculum for all grades and subjects.

```
 ADMIN TRIGGER / CRON
        │
        ▼
 ┌──────────────────────────────────────────────────────────┐
 │  CURRICULUM LAYER                                        │
 │  CurriculumContent (status: DRAFT → APPROVED)            │
 │  4,093 approved lessons across 88 grade/subject pairs    │
 └────────────────────────┬─────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
 ┌────────────┐  ┌──────────────┐  ┌───────────────┐
 │  AUDIO     │  │  TEXTBOOK    │  │  ASSESSMENT   │
 │  QUEUE     │  │  COMPILER    │  │  BOOKLET      │
 │            │  │              │  │               │
 │ LessonAudio│  │compileTextbok│  │  (future)     │
 │ PENDING    │  │renderPdfStream│  │               │
 │ PROCESSING │  │              │  │               │
 │ GENERATED  │  │              │  │               │
 │ FAILED     │  │              │  │               │
 └─────┬──────┘  └──────┬───────┘  └───────┬───────┘
       │                │                  │
       ▼                ▼                  ▼
 ┌─────────────────────────────────────────────────┐
 │  STORAGE LAYER                                  │
 │  Supabase Storage                               │
 │    lesson-audio/  (MP3, public bucket)          │
 │    lesson-pdf/    (future)                      │
 │  Postgres (via Supabase)                        │
 │    LessonAudio rows — status + storageUrl       │
 │    AIInteractionLog — cost tracking             │
 └─────────────────────────────────────────────────┘
       │
       ▼
 ┌─────────────────────────────────────────────────┐
 │  OUTPUT LAYER                                   │
 │  Student audio player  (LessonAudio.storageUrl) │
 │  Student textbook PDF                           │
 │  Teacher edition PDF                            │
 │  Workbook PDF                                   │
 │  Assessment booklet PDF                         │
 │  MOE export package                             │
 └─────────────────────────────────────────────────┘
```

---

## Data Models

### CurriculumContent
Primary lesson record. Status drives pipeline entry.

| Field        | Meaning                                      |
|---|---|
| `contentId`  | Unique stable ID (`draft-phase6-g5-english-w05-d1-core`) |
| `grade`      | Integer 1–12                                 |
| `subject`    | Uppercase string (`ENGLISH`, `MATH`, ...)    |
| `status`     | `DRAFT` → `APPROVED` — only APPROVED feeds pipeline |
| `version`    | Content hash — changes on payload edit       |
| `payload`    | JSON: `body`, `body_standard`, `audioScriptSpecs[]` |

### LessonAudio
Queue record per lesson. Status is the job lifecycle.

```
PENDING → PROCESSING → GENERATED
                    ↘ FAILED → (retry) → PENDING
```

| Field             | Meaning                                       |
|---|---|
| `status`          | Job lifecycle state                           |
| `voice`           | TTS voice (`alloy` default)                   |
| `storageUrl`      | Supabase public URL when GENERATED            |
| `estimatedCostUsd`| Cost at $15/1M chars                          |
| `generatedAt`     | Timestamp of last state transition            |
| `contentVersion`  | Locked to lesson version — stale check via STALE status |

Unique constraint: `(lessonId, contentVersion, voice)` — idempotent enqueue.

### Queue Status Invariants
- A lesson has at most one active job per `(lessonId, contentVersion, voice)`.
- PROCESSING rows older than 10 min with no update → stuck; safe to reset to PENDING.
- GENERATED rows are never overwritten unless `force=true`.

---

## Service Layer

### `lib/audio/audioGenerationQueue.ts`
Core queue operations. No HTTP coupling — usable from CLI, cron, and API routes.

| Function                | Action                                       |
|---|---|
| `enqueueLessonAudio`    | Bulk-create PENDING rows for grade+subject   |
| `claimNextAudioJobs`    | Atomic PENDING→PROCESSING claim              |
| `processAudioJob`       | TTS + Supabase upload for one job            |
| `retryFailedJobs`       | FAILED→PENDING reset with optional filter    |
| `getAudioQueueStatus`   | Count by status, last processed, total cost  |

### `lib/lessons/audioGeneration.ts`
Lower-level operations used by the queue service.

| Function                    | Action                              |
|---|---|
| `generateLessonAudioNow`    | Single-lesson TTS + upload          |
| `processPendingLessonAudio` | Legacy batch processor (still valid)|
| `queueLessonAudioGeneration`| Upsert single PENDING row           |
| `getCurrentLessonAudio`     | Listen-mode read (checks version staleness) |

### `lib/ai/textbook/textbookCompiler.ts`
Compiles approved lessons into structured textbook data per grade/subject.

### `app/api/admin/curriculum/textbook/route.ts`
GET renders compiled textbook as streaming PDF.
Currently: student edition only — teacher/workbook/assessment editions are planned.

---

## API Routes

### Admin (session auth via `requireRole("ADMIN")`)

| Route                                    | Method | Purpose                        |
|---|---|---|
| `/api/admin/audio-generation/enqueue`    | POST   | Bulk-enqueue grade+subject     |
| `/api/admin/audio-generation/process`    | POST   | Claim and process next batch   |
| `/api/admin/audio-generation/status`     | GET    | Queue counts + cost            |
| `/api/admin/audio-generation/retry`      | POST   | Reset FAILED → PENDING         |
| `/api/admin/curriculum/audio/batch`      | POST   | Legacy: enqueue all APPROVED   |
| `/api/admin/curriculum/audio/process`    | POST   | Legacy: process pending        |
| `/api/admin/curriculum/[id]/audio`       | GET/POST | Per-lesson audio status/queue |
| `/api/admin/curriculum/textbook`         | GET    | Generate + stream PDF          |

### Cron (Bearer `CRON_SECRET`)

| Route                                    | Method | Purpose                        |
|---|---|---|
| `/api/cron/process-audio-generation`     | POST   | Scheduled audio batch worker   |

### Admin UI

| Path                         | Purpose                                      |
|---|---|
| `/admin/audio-generation`    | Live queue dashboard + action buttons        |
| `/admin/curriculum`          | Curriculum list, coverage, bulk approve      |

---

## Storage

### Supabase — `lesson-audio` bucket (public)
Path pattern: `grade-{N}/{subject}/{contentId}/{voice}.mp3`
Example: `grade-5/english/draft-phase6-g5-english-w05-d1-core/alloy.mp3`
Access: public read, service-role write.

### Alternate path (via `generateLessonAudioNow`)
`lessons/audio/{lessonId}/{contentVersion}.mp3`
Both paths are valid. The CLI script uses the grade/subject pattern; the queue service uses the lessonId/version pattern.

---

## Cost Model

| Item                        | Rate                    | Est. all remaining  |
|---|---|---|
| OpenAI TTS (`tts-1`)        | $15 / 1M chars          | —                   |
| Avg chars per lesson        | ~1,140                  | —                   |
| Cost per lesson             | ~$0.017                 | —                   |
| Total audio remaining       | 3,981 lessons           | **~$67.70**         |
| Supabase storage            | ~3,981 × ~50 KB         | ~199 MB / free tier |

Cost cap enforcement: set `AI_BUDGET_MONTHLY_CAP_USD` in env. The `AIInteractionLog`
table tracks every TTS call with `estimatedCostUSD`.

---

## Safety Controls

1. **No overwrite of GENERATED**: `enqueueLessonAudio` skips rows where
   `status=GENERATED AND contentVersion=current`. Only a `force=true` param overrides.

2. **Idempotent enqueue**: Unique constraint `(lessonId, contentVersion, voice)` ensures
   duplicate enqueue calls are harmless upserts.

3. **Claim locking**: `claimNextAudioJobs` uses `updateMany WHERE status=PENDING` after
   `findMany`. On Vercel cron (one invocation at a time), this is safe. For concurrent
   workers, use `SELECT FOR UPDATE SKIP LOCKED` via raw SQL.

4. **APPROVED-only pipeline**: Audio enqueue and textbook compilation only source from
   `CurriculumContent.status = "APPROVED"`. Draft content never enters the pipeline.

5. **Rollback**: Any PROCESSING/GENERATED row can be set back to PENDING via
   `retryFailedJobs`. No data is deleted — only status is mutated.

6. **Audit log**: Every TTS call writes to `AIInteractionLog` via `logAIInteraction`.
   Every textbook generation writes to `AuditLog` via `logAudit`.

7. **Stuck-job recovery**: PROCESSING rows with `generatedAt < now() - 10min` are
   considered stuck. A scheduled cleanup (future) or manual retry resets them.

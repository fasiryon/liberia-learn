# Sprint 20 — Homework Auto-Grading + Grade Book

**Status:** Planned
**Priority:** High — closes the manual grading bottleneck; pilot-ready milestone

---

## Goals

1. AI-powered homework auto-grading for submitted assignments
2. Grade book view for teachers (per-student, per-assignment)
3. Stale approval timeout: auto-approve assignments after 72h with no teacher action
4. Grade change notifications to guardians via SMS

---

## Scope

### 1. Homework Auto-Grading (`lib/ai/grading/autoGrader.ts`)

**Trigger:** When a student submits homework (`HomeworkSubmission.status` → "SUBMITTED"), enqueue an auto-grade job.

**Grading function:**
```typescript
autoGradeSubmission(params: {
  submissionId: string;
  assignmentId: string;
  studentResponse: string;
  rubric?: string;       // from CurriculumContent.assessmentQuestions
  subject: string;
  grade: number;
}): Promise<{
  score: number;          // 0–100
  feedback: string;       // 2-3 sentence AI feedback
  autoGraded: boolean;    // always true
  model: string;
}>
```

**AI prompt:**
- System: "You are a grading assistant for a Grade {grade} {subject} class in Liberia. Score the student response against the rubric. Return JSON: { score: 0-100, feedback: '...' }."
- Rubric provided if available; otherwise uses assignment description
- Model: GPT-4o-mini via `routedCompletion` (forceSmartTier: false = cheaper model)
- Max tokens: 200 (score + feedback only)

**Score storage:**
- Write `HomeworkSubmission.aiScore`, `HomeworkSubmission.aiFeedback`, `HomeworkSubmission.autoGraded = true`
- Status remains "SUBMITTED" — teacher must still APPROVE/REJECT (AI grade is advisory)
- Teacher can override: manual score overwrites AI score, `autoGraded = false`

**Schema additions:**
```prisma
// HomeworkSubmission additions
aiScore      Float?
aiFeedback   String?
autoGraded   Boolean @default(false)
finalScore   Float?   // teacher-confirmed score (null until teacher acts)
```

---

### 2. Grade Book View

**Route:** GET `/api/teacher/gradebook`
- Params: `classId`, `subjectFilter?`, `dateFrom?`, `dateTo?`
- Auth: teacher in that school
- Returns:
  ```typescript
  {
    students: {
      studentId: string;
      name: string;
      assignments: {
        assignmentId: string;
        title: string;
        submittedAt: string | null;
        aiScore: number | null;
        finalScore: number | null;
        status: "NOT_SUBMITTED" | "SUBMITTED" | "GRADED";
      }[];
      averageScore: number | null;
    }[];
  }
  ```

**UI:** `app/teacher/gradebook/page.tsx`
- Grid: rows = students, columns = assignments
- Color coding: green ≥70, amber 50–69, red <50, grey = not submitted
- Click cell → side drawer with submission text + AI feedback + score override input
- Export to CSV button (no PDF required for grade book)
- Filter by subject/date range

**Weighted average calculation:**
- Each subject has equal weight by default
- Assignment weight configurable per assignment (1x/2x/3x)

---

### 3. Stale Approval Timeout Cron

**Cron:** runs every 6 hours via Vercel cron (or `app/api/cron/grade-timeout/route.ts`)

**Logic:**
- Find all `HomeworkSubmission` where `status = "SUBMITTED"` and `submittedAt < NOW() - 72h`
- If `aiScore >= 50`: auto-approve with `finalScore = aiScore`, `status = "APPROVED"`, `autoGraded = true`
- If `aiScore < 50` OR `aiScore = null`: escalate — create `TeacherAlert` (type: "STALE_SUBMISSION", severity: "medium")
- Log via `logAudit` (action: "homework_auto_approved" or "homework_stale_escalated")

**Configurable timeout:** `HOMEWORK_STALE_TIMEOUT_HOURS` env var (default 72)

---

### 4. Grade Notifications to Guardians

**Trigger:** When `HomeworkSubmission.status` → "APPROVED" (by teacher or by stale-timeout cron)

**Notification content:**
```
Hi {guardianName}, {studentName} received {score}% on "{assignmentTitle}".
{feedbackExcerpt}. Log in at liberialearn.edu.lr to view details.
```

**Channels:**
- SMS via Africa's Talking (existing `lib/guardian/sms-notifications.ts`)
- Only send if guardian has `smsNotifications = true` and linked to student

**New SMS type:** `assignment_graded` (add to existing enum)
**Rate limit:** max 1 grade notification per student per day (avoid spam on bulk grading)

---

## Schema Migration

`prisma/migrations/20260526_000001_sprint20_grading/migration.sql`

```sql
ALTER TABLE "HomeworkSubmission"
  ADD COLUMN "aiScore" FLOAT,
  ADD COLUMN "aiFeedback" TEXT,
  ADD COLUMN "autoGraded" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "finalScore" FLOAT;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "HomeworkSubmission_status_submittedAt_idx"
  ON "HomeworkSubmission" ("status", "submittedAt");
```

---

## Files Touched

- `prisma/schema.prisma` — HomeworkSubmission additions
- `prisma/migrations/20260526_000001_sprint20_grading/migration.sql` — NEW
- `lib/ai/grading/autoGrader.ts` — NEW
- `app/api/teacher/gradebook/route.ts` — NEW
- `app/api/cron/grade-timeout/route.ts` — NEW
- `app/teacher/gradebook/page.tsx` — NEW
- `lib/guardian/sms-notifications.ts` — add `assignment_graded` type

## Tests Required

- `__tests__/sprint20.autoGrader.test.ts` — scoring, feedback, score override, budget
- `__tests__/sprint20.gradebook.test.ts` — grade aggregation, weighted avg, auth
- `__tests__/sprint20.staleTimeout.test.ts` — 72h logic, auto-approve vs escalate
- `__tests__/sprint20.gradeNotifications.test.ts` — rate limit, guardian opt-in check

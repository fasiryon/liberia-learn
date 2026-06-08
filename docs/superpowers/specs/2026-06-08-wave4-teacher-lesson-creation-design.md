# Wave 4 — Teacher Lesson Creation: Design Spec
**Date:** 2026-06-08  
**Status:** Approved (v2 — tightened after review)  
**Approach:** Extend `CurriculumContent` (not a new TeacherLesson model)

---

## Context

The spec originally described a standalone `TeacherLesson` model. Pre-flight codebase exploration revealed that teacher lesson creation is already partially implemented using `CurriculumContent` with `teacherCreated: true` and `editReviewStatus` fields. Seven API routes, three UI pages, and a basic admin moderation queue are already live.

**Wave 4 fills the gaps** in that existing foundation rather than replacing it.

### Already built (do not re-implement)
- `CurriculumContent.teacherCreated`, `editReviewStatus`, `editedById`, `editedAt`
- `/teacher/lessons/create` — Tiptap editor, title/subject/grade, submit for review
- `/teacher/lessons/[lessonId]/edit` — save draft, submit for review, version history component
- `/teacher/lessons` — My lessons list + Shared with me tabs
- `/admin/content-review` — basic PENDING queue, approve/reject
- `/api/teacher/lessons` and 6 sub-routes (create, edit, versioning, sharing, audio)
- `LessonEditor.tsx` — full Tiptap editor with toolbar

---

## State Machine: editReviewStatus

This section is normative. All server routes MUST enforce it.

### Allowed transitions

| From | To | Trigger |
|------|-----|---------|
| `null` | `PENDING` | Teacher submits draft for review |
| `PENDING` | `APPROVED` | Admin approves |
| `PENDING` | `REJECTED` | Admin rejects (reason required) |
| `REJECTED` | `PENDING` | Teacher resubmits after revisions |

### Disallowed transitions (return HTTP 409)

| Attempt | Reason |
|---------|--------|
| `APPROVED` → `REJECTED` | Cannot un-approve a published lesson. Use emergency unpublish (see 4C) or teacher creates v2. |
| `null` → `APPROVED` | Must go through PENDING review. |
| `REJECTED` → `APPROVED` | Must resubmit through PENDING. |
| Any → `null` | Not a valid target state. |

### Enforcement

`PATCH /api/admin/content-review/[lessonId]` checks current `editReviewStatus` before applying transition. Returns `{ error: "invalid_transition", from: "...", to: "..." }` with status 409 on violation.

`PATCH /api/teacher/lessons/[contentId]` (teacher submitting for review) checks current status is `null` or `REJECTED` before setting to `PENDING`. Returns 409 otherwise.

---

## Wave 4A — Schema + Data Model

### CurriculumContent additions (migration)

```sql
ALTER TABLE "CurriculumContent"
  ADD COLUMN IF NOT EXISTS "learningObjectives" JSONB    NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "visibility"         TEXT     NOT NULL DEFAULT 'class_only',
  ADD COLUMN IF NOT EXISTS "parentLessonId"     TEXT,
  ADD COLUMN IF NOT EXISTS "lessonVersion"      INTEGER  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "publishedAt"        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "rejectionReason"    TEXT,
  ADD COLUMN IF NOT EXISTS "schoolId"           TEXT;

CREATE INDEX IF NOT EXISTS "CurriculumContent_schoolId_visibility_idx"
  ON "CurriculumContent"("schoolId", "visibility");
```

Field semantics:
- `learningObjectives`: `string[]` — teacher-authored objectives, max 8
- `visibility`: `class_only | school_wide` — class_only requires explicit assignment; school_wide surfaces to all students at the same school without assignment
- `schoolId`: denormalized from `editedBy.schoolId` at lesson creation time — enables efficient school_wide queries without joining through User
- `parentLessonId`: references `CurriculumContent.id` — chains version history for teacher-created versions
- `lessonVersion`: integer version counter (separate from the `version` date-string field used elsewhere)
- `publishedAt`: set atomically with `editReviewStatus = 'APPROVED'`
- `rejectionReason`: stored on rejection, surfaced to teacher in their lesson list

### New model — TeacherLessonAssignment

```prisma
model TeacherLessonAssignment {
  id           String            @id @default(cuid())
  contentId    String
  content      CurriculumContent @relation(fields: [contentId], references: [contentId])
  classId      String
  class        Class             @relation(fields: [classId], references: [id])
  assignedById String
  assignedBy   User              @relation("TeacherLessonAssignments", fields: [assignedById], references: [id])
  scheduledFor DateTime?         // null = immediately visible
  assignedAt   DateTime          @default(now())

  @@unique([contentId, classId])
  @@index([classId, scheduledFor])
}
```

Add back-relations:
```prisma
// on CurriculumContent
teacherLessonAssignments TeacherLessonAssignment[]

// on User
teacherLessonAssignments TeacherLessonAssignment[] @relation("TeacherLessonAssignments")
```

### Certificate decision (locked here, not in 4D)

**Decision: Option A — certificates issued identically to AI lessons.**

When a student completes a teacher-created lesson with a passing quiz score, a `Certificate` is issued using the same pipeline as AI lessons. The cert says "Lesson Certificate" with the lesson title. No differentiation of origin on the certificate itself. MOE audit log captures `teacherCreated: true` in the details JSON, so traceability is maintained without cluttering the student UI.

Rationale: students don't care about provenance; MOE can audit it; simplest to implement.

### Migration file
`prisma/migrations/20260608_000001_wave4_teacher_lessons/migration.sql`

Apply via:
```
npx prisma db execute --file prisma/migrations/20260608_000001_wave4_teacher_lessons/migration.sql
```
Register in `_prisma_migrations` after applying.

### Tests (Wave 4A — 18 tests)
**Schema tests:**
- CurriculumContent created with `learningObjectives`, `visibility`, `schoolId` fields
- `visibility` defaults to `class_only`
- `TeacherLessonAssignment` created, unique constraint enforced (contentId + classId)
- Assignment with `scheduledFor` in future is not immediately visible
- `parentLessonId` chain: lesson v2 references lesson v1's id
- `lessonVersion` increments correctly on fork
- `publishedAt` is null until admin approves
- `rejectionReason` stored and readable

**State machine tests (one per transition):**
- `null → PENDING`: allowed
- `PENDING → APPROVED`: allowed
- `PENDING → REJECTED`: allowed (reason required)
- `REJECTED → PENDING`: allowed (resubmit)
- `APPROVED → REJECTED`: blocked with 409
- `null → APPROVED`: blocked with 409
- `REJECTED → APPROVED`: blocked with 409
- `APPROVED → PENDING` via emergency unpublish path: allowed (see 4C)

**Migration test:**
- SQL is idempotent (IF NOT EXISTS guards)

**Gate:** schema applied, all 18 tests passing, no UI work in this wave.

---

## Wave 4B — Editor Enhancements

### What changes on `/teacher/lessons/create`

1. **Subject dropdown** — update `SUBJECTS` constant to all Subject enum values: `MATH, SCIENCE, LITERACY, SOCIAL_STUDIES, ENGLISH, CS, ENGINEERING_FOUNDATIONS, CIVICS`

2. **Learning objectives** — below title: "Add objective" button appends a text input. Remove icon per row. Stored as `string[]`, max 8. Submitted with lesson body.

3. **Fork from AI lesson tab** — new tab on create page. Search bar hits `GET /api/teacher/lessons/forkable?q=...` (approved, non-teacher-created lessons). Selecting one pre-fills title, subject, grade, and body in the Tiptap editor. `derivedFromContentId` stored on save.

4. **Autosave** — 30-second debounce after any change to title, body, or objectives. Fires `PATCH /api/teacher/lessons/[contentId]` with `{title, bodyHtml, learningObjectives}`. Shows "Auto-saved [HH:MM]" indicator. Only fires if lesson already has a contentId (never on initial unsaved state).

5. **Inline question editor** — "Add question" button opens inline drawer:
   - MCQ: question text + up to 4 choices + correct answer radio selector
   - Short answer: question text + model answer text area
   Questions stored in `assessmentQuestions` JSON array (existing shape). Drag handles for reorder.

### Question grading scope (v1, locked)

| Question type | Grading |
|--------------|---------|
| MCQ | Auto-graded server-side against teacher's answer key (same as AI lesson MCQs) |
| Short answer | Added to `/teacher/grading` queue for manual teacher review |
| Essay | NOT supported in teacher lessons for v1 — defer |
| Code | NOT supported in teacher lessons for v1 — defer |

Rationale: essay grading (Claude) and code grading (Judge0) are expensive pipeline integrations. MCQ and short answer cover 95% of what primary school teachers will write.

### What changes on `/teacher/lessons/[lessonId]/edit`

- Same objectives editor
- Same question editor
- If `editReviewStatus === 'APPROVED'`: show "Create v[N+1]" button in place of "Submit for review". Calls `POST /api/teacher/lessons/[contentId]/fork`.

### Fork route — three-case logic

`POST /api/teacher/lessons/[contentId]/fork`

```
Server logic:
  - If source.teacherCreated === false:
      // Teacher forking an AI lesson as starting point
      Create new CurriculumContent:
        lessonVersion = 1
        parentLessonId = null
        derivedFromContentId = source.contentId
        editReviewStatus = null (draft)
        teacherCreated = true
        editedById = requesting user

  - If source.teacherCreated === true AND source.editedById === user.id:
      // Teacher creating v2 of their own published lesson
      Create new CurriculumContent:
        lessonVersion = source.lessonVersion + 1
        parentLessonId = source.id
        derivedFromContentId = null
        editReviewStatus = null (draft)
        All content fields copied from source

  - If source.teacherCreated === true AND source.editedById !== user.id:
      // Teacher copying another teacher's school-wide lesson
      Create new CurriculumContent:
        lessonVersion = 1
        parentLessonId = null
        derivedFromContentId = source.contentId
        editReviewStatus = null (draft)
        teacherCreated = true
        editedById = requesting user

  - If source.editReviewStatus is NOT 'APPROVED':
      Return 403 — can only fork published/approved content
      (prevents forking pending or rejected lessons)
```

Response: `{ contentId, lessonId }` — client redirects to `/teacher/lessons/[lessonId]/edit`.

### API additions
- `GET /api/teacher/lessons/forkable` — returns approved non-teacher-created lessons, searchable by title/subject/grade
- `POST /api/teacher/lessons/[contentId]/fork` — three-case fork logic above

### Tests (Wave 4B — 9 tests)
- Objectives saved and reloaded on edit
- Autosave debounce: mock timer, confirm PATCH fires at 30s not before, does not fire without contentId
- Fork AI lesson: `lessonVersion=1`, `parentLessonId=null`, `derivedFromContentId` set
- Fork own teacher lesson: `lessonVersion=parent+1`, `parentLessonId=parent.id`
- Fork other teacher's lesson: `lessonVersion=1`, `parentLessonId=null`, `derivedFromContentId` set
- Fork rejected lesson: returns 403
- Question editor: add MCQ with answer key stored correctly
- Question editor: short answer stored with model answer
- Subject dropdown includes all 8 subjects

---

## Wave 4C — Moderation Queue Upgrade

### `/admin/content-review` upgrade

Mirrors `/admin/video-moderation` pattern.

**Tab bar:** Pending (count badge) | Approved | Rejected

**Lesson card (Pending tab):**
- Title, grade, subject, teacher name, school, submitted date, flag count badge (if any flags)
- "Preview" button → slide-in panel: rendered lesson HTML via `dangerouslySetInnerHTML` (same as student viewer), learning objectives list, assessment question count
- Approve / Reject buttons

**On Approve** (`PATCH /api/admin/content-review/[lessonId]` with `{ editReviewStatus: "APPROVED" }`):

Server:
1. Checks transition is valid (`PENDING → APPROVED`); 409 if not
2. Sets `editReviewStatus = 'APPROVED'`, `status = 'published'`, `publishedAt = now()`
3. Writes audit log: `action = 'teacher.lesson.published'`
4. Creates `NotificationInboxItem` for teacher: "Your lesson '[title]' was approved and is now published."

**On Reject** (`PATCH /api/admin/content-review/[lessonId]` with `{ editReviewStatus: "REJECTED", rejectionReason: "..." }`):

Server:
1. Checks transition is valid; 409 if not
2. Sets `editReviewStatus = 'REJECTED'`, `rejectionReason = reason`
3. Writes audit log: `action = 'teacher.lesson.rejected'`
4. Creates `NotificationInboxItem` for teacher with reason included

**Approved tab:** read-only cards. Each card shows `publishedAt`. Flag badge if unresolved flags. "Unpublish (emergency)" button.

**Rejected tab:** read-only cards showing `rejectionReason`.

### Emergency unpublish (admin only)

In the Approved tab, each lesson card has a small "Unpublish (emergency)" button. Clicking opens a confirmation modal: "This removes the lesson from all student views immediately. Teacher will be notified."

`POST /api/admin/content-review/[lessonId]/unpublish` with optional `{ reason: "..." }`:
1. Checks current state is `APPROVED`; 409 if not
2. Sets `editReviewStatus = 'PENDING'`, `status = 'draft'`, `publishedAt = null`
3. Writes audit log: `action = 'teacher.lesson.emergency_unpublish'`, includes admin userId and reason
4. Creates `NotificationInboxItem` for teacher: "Your lesson '[title]' has been temporarily unpublished by an admin. Reason: [reason]. Please revise and resubmit."
5. Existing `TeacherLessonAssignment` records remain intact (assignments don't disappear silently) but the visibility query (`editReviewStatus = 'APPROVED'`) means students no longer see the content

Note: `APPROVED → PENDING` via this route is the ONE allowed "backward" transition. It goes through a separate endpoint with admin-only auth and full audit trail, not through the general PATCH.

### Tests (Wave 4C — 12 tests)
- Pending tab shows only `editReviewStatus = 'PENDING'`
- Approved tab shows only `editReviewStatus = 'APPROVED'`
- Rejected tab shows only `editReviewStatus = 'REJECTED'`
- Approve: sets `editReviewStatus`, `status`, `publishedAt` atomically
- Approve: blocked if current state is not PENDING (409)
- Reject: stores `rejectionReason`
- Reject: blocked if current state is not PENDING (409)
- Audit log entry created on approve
- Audit log entry created on reject
- `NotificationInboxItem` created for teacher on approve
- `NotificationInboxItem` created for teacher on reject
- Emergency unpublish: sets `editReviewStatus = 'PENDING'`, `publishedAt = null`, audit log written, teacher notified

**Gate:** principal can approve, status transitions correctly, audit log fires. Emergency unpublish removes from student visibility.

---

## Wave 4D — Student Visibility + Assignment

### Teacher assignment flow

On `/teacher/lessons` (My lessons tab), approved/published lessons show an "Assign" button.

Clicking opens a modal:
- Class selector (teacher's classes from `/api/teacher/dashboard`)
- Optional date picker (`scheduledFor` — default null = immediate)
- Submit: `POST /api/teacher/lessons/[contentId]/assign` → `{ classId, scheduledFor? }`
- Creates `TeacherLessonAssignment`

**Race condition handling:**
If two teachers attempt to assign the same lesson to the same class simultaneously, the unique constraint `(contentId, classId)` on `TeacherLessonAssignment` causes the second write to fail with a DB constraint error. The server maps this to HTTP 409 with `{ error: "already_assigned" }`. The UI catches 409 and shows: "Already assigned to this class. [View assignment →]" (links to the lesson card with the assignment chip visible).

"Assigned classes" chip list appears on the lesson card after assignment.

### Student visibility

`GET /api/student/teacher-lessons` returns the union of both paths:

**Path 1 — class_only:**
```
TeacherLessonAssignment where:
  classId = student.classId
  AND (scheduledFor IS NULL OR scheduledFor <= now())
  JOIN CurriculumContent where editReviewStatus = 'APPROVED'
```

**Path 2 — school_wide:**
```
CurriculumContent where:
  visibility = 'school_wide'
  AND schoolId = student.schoolId
  AND editReviewStatus = 'APPROVED'
```

Called by `app/student/today/page.tsx` alongside the existing scheduled work fetch.

### Student lesson viewer

Teacher lessons render through `LessonDeliveryClient` at `/student/lessons/[id]`.

Lesson response gains one optional field:
```ts
teacherAuthorName: string | null
```
Populated when `content.teacherCreated = true`.

`LessonDeliveryClient` renders a badge near the lesson title:
```tsx
{teacherAuthorName && (
  <span className="rounded-full bg-[var(--ll-border)] px-2 py-0.5 text-xs text-[var(--ll-text-muted)]">
    From {teacherAuthorName}
  </span>
)}
```
One conditional. No special-case routing.

### Offline pack integration

`lib/packs/generatePack.ts` updated to include teacher lessons:

1. After fetching `ScheduledWork` items for the class+week, also fetch:
   - `TeacherLessonAssignment` records for the class with `scheduledFor` within the pack window (or null)
   - School-wide `CurriculumContent` records with `visibility = 'school_wide'` and `schoolId = class.school.schoolId`
   Both filtered to `editReviewStatus = 'APPROVED'`

2. `stripStudentKeys()` applied to teacher lessons same as AI lessons — answer keys never in student pack

3. Pack manifest entries for teacher lessons include `"teacherCreated": true` and `"teacherAuthorName": "..."` so the offline reader can show the "From [Teacher]" badge without hitting the API

**Test:** student1's pack contains any assigned teacher lesson with correct content and no answer keys.

### Guardian SMS digest integration

The weekly digest composer (`lib/notifications/guardianDigest.ts`) reads `StudentProgress` and `StuckEvent` records. Since `StudentProgress` does not filter by `content.teacherCreated`, teacher lesson completions already flow into the digest by default.

**Verify:** after student completes a teacher-created lesson:
- Lesson appears in digest lesson count
- Score included in avg score calculation

**Test:** guardian digest includes teacher lesson in count and score fields.

### Certificate generation

When a student completes a teacher-created lesson with a passing quiz score, the existing certificate pipeline fires identically to AI lessons. No code change needed — the pipeline reads from `StudentProgress` regardless of `teacherCreated`. Audit log details include `teacherCreated: true` for MOE traceability.

**Test:** completing a teacher lesson with passing score creates a `Certificate` record.

### Tests (Wave 4D — 14 tests)
- Unassigned published lesson: not returned by `/api/student/teacher-lessons`
- Assigned with `scheduledFor = tomorrow`: not returned today
- Assigned with `scheduledFor = null`: returned immediately
- `school_wide` lesson visible to student in same school
- `school_wide` lesson NOT visible to student in different school
- `class_only` lesson NOT visible to student in different class at same school
- Emergency-unpublished lesson: NOT returned (editReviewStatus no longer APPROVED)
- Teacher author name in lesson response when `teacherCreated = true`
- Assignment 409: duplicate assignment returns 409 with `"already_assigned"`
- Pack: teacher lesson appears in offline pack for assigned class
- Pack: answer keys stripped from teacher lesson in pack
- Pack manifest: `teacherCreated: true` flag present
- Guardian digest: teacher lesson included in lesson count
- Certificate: passing teacher lesson quiz creates Certificate record

**Gate:** full pipeline — teacher creates → admin approves → teacher assigns → student sees and completes → certificate issued.

---

## Wave 4E — Polish + Audit + MOE

### MOE dashboard panel

New panel in `/moe/dashboard`: **"Teacher Content"**
- Total published teacher-created lessons nationally
- Per-school breakdown: school name, lesson count, avg quiz score on teacher lessons
- Avg quiz score comparison: teacher lessons vs AI lessons (side-by-side)
- Top 5 most-assigned teacher lessons (by `TeacherLessonAssignment` count)

Endpoint: `GET /api/moe/teacher-lessons` — Redis cache key `moe:teacher-lessons`, TTL 1800s.

### Teacher "My Created Lessons" stats

On `/teacher/lessons`, each lesson card expands to show:
- Views: distinct students who started the lesson (from `StudentProgress` starts)
- Completions: count where `completedAt` is set
- Avg quiz score: mean of quiz answers for this lesson

No new tracking models — all from existing `StudentProgress` table.

### Versioning UI

Lessons with `lessonVersion > 1` show a `v{N}` badge in My Lessons list.

On a published lesson: "Create new version" button (author only) — calls `POST /api/teacher/lessons/[contentId]/fork` (case 2 in fork logic). Students continue seeing v1 until v2 is approved.

### School-wide lesson browser

Third tab on `/teacher/lessons`: "School lessons"
- `GET /api/teacher/lessons/school-wide` — `school_wide` published lessons from same school, excluding own
- "Fork" button on each card — calls fork case 3 (cross-teacher copy)

### Content flagging

Student lesson view: small "Report" link.
- `POST /api/student/flag-content` with `{ contentId, reason: 'inappropriate_content' | 'factually_wrong' | 'other', note? }`

**Deduplication:** server checks for existing `LessonHelpFlag` with same `(contentId, studentId)`. If found, returns 200 no-op. Same student cannot flag same lesson twice.

**Threshold and escalation:**
- Lessons with 3+ unresolved flags: red badge appears on the lesson card in `/admin/content-review` Approved tab AND a `NotificationInboxItem` is created for the school's principal user (role = `ADMIN`, same `schoolId`).
- "Unresolved" = flags with no `resolvedAt`.

**Principal review actions** (in the Approved tab flag UI):
- "Mark resolved" — sets `resolvedAt` on all flags for this lesson (lesson stays published)
- "Unpublish for revision" — triggers the emergency unpublish flow (see 4C), which notifies the teacher including the flag reasons

**Test:** 3+ flags from different students triggers principal notification.

### Wave 4 audit script

`scripts/wave4-audit.ts`:
- All teacher-created published lessons have `publishedAt` set
- All have non-null `editedById`
- All have valid `learningObjectives` (parseable JSON array)
- No orphan `TeacherLessonAssignment` records pointing to deleted/non-existent content
- No lessons stuck in `PENDING` > 7 days (logs a warning, doesn't fail)
- No `lessonVersion > 1` lessons without a `parentLessonId`

### Tests (Wave 4E — 9 tests)
- MOE endpoint returns correct lesson counts per school
- Fork creates correct `parentLessonId` and `lessonVersion` (own lesson)
- Students continue seeing v1 after v2 draft is created (v2 not APPROVED yet)
- School-wide browser excludes own lessons
- Flag deduplication: second flag from same student returns 200 no-op
- Flag threshold: 3+ flags from different students creates principal notification
- Principal "mark resolved" clears `resolvedAt` on flags, lesson stays published
- Principal "unpublish for revision" triggers emergency unpublish and notifies teacher
- Audit script reports orphan assignment as anomaly

---

## Test Count Summary

| Wave | Tests | Focus |
|------|-------|-------|
| 4A | 18 | Schema, state machine transitions (all 8), migration idempotency |
| 4B | 9 | Editor enhancements, fork 3-case logic, question types |
| 4C | 12 | Moderation tabs, approve/reject, 409 enforcement, emergency unpublish |
| 4D | 14 | Visibility paths, race condition, pack, digest, certificate |
| 4E | 9 | Polish, flagging deduplication + threshold, versioning, audit |
| **Total** | **62** | |

---

## Pre-VSL Checklist (after 4E)

- [ ] 3 teacher-created demo lessons exist (at least 1 school-wide)
- [ ] MOE dashboard shows teacher lesson count and score comparison
- [ ] Full flow verified: teacher creates → admin approves → teacher assigns → student completes → certificate issued
- [ ] Emergency unpublish tested manually: lesson disappears from student Today immediately
- [ ] Offline pack downloaded for a student with an assigned teacher lesson; confirm it appears with no answer keys
- [ ] Audit script runs clean (0 issues)
- [ ] Screenshots: create page, moderation queue (all 3 tabs), student Today with teacher lesson badge, MOE panel

---

## File Inventory (new or modified)

### New files
- `prisma/migrations/20260608_000001_wave4_teacher_lessons/migration.sql`
- `app/api/teacher/lessons/[contentId]/assign/route.ts`
- `app/api/teacher/lessons/[contentId]/fork/route.ts`
- `app/api/teacher/lessons/forkable/route.ts`
- `app/api/teacher/lessons/school-wide/route.ts`
- `app/api/admin/content-review/[lessonId]/unpublish/route.ts`
- `app/api/student/teacher-lessons/route.ts`
- `app/api/student/flag-content/route.ts`
- `app/api/moe/teacher-lessons/route.ts`
- `scripts/wave4-audit.ts`
- `__tests__/wave4a.schema.test.ts`
- `__tests__/wave4b.editor.test.ts`
- `__tests__/wave4c.moderation.test.ts`
- `__tests__/wave4d.visibility.test.ts`
- `__tests__/wave4e.polish.test.ts`

### Modified files
- `prisma/schema.prisma` — new fields on CurriculumContent + TeacherLessonAssignment model
- `app/teacher/lessons/create/page.tsx` — objectives, all subjects, fork tab, autosave, question editor
- `app/teacher/lessons/[lessonId]/edit/page.tsx` — objectives, question editor, "Create vN+1" button
- `app/teacher/lessons/page.tsx` — assign button, stats, school-wide tab, 409 handling
- `app/admin/content-review/page.tsx` — 3 tabs, preview panel, emergency unpublish, flag badge
- `app/api/admin/content-review/[lessonId]/route.ts` — state machine enforcement, publishedAt, audit log, notification
- `app/api/admin/content-review/route.ts` — tab filtering
- `app/student/today/page.tsx` — fetch teacher-lessons alongside scheduled work
- `app/student/lessons/[id]/LessonDeliveryClient.tsx` — teacherAuthorName badge
- `app/moe/dashboard/page.tsx` — teacher content panel
- `lib/packs/generatePack.ts` — include TeacherLessonAssignment + school_wide lessons

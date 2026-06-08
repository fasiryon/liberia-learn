# Wave 4 — Teacher Lesson Creation: Design Spec
**Date:** 2026-06-08  
**Status:** Approved  
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

## Wave 4A — Schema + Data Model

### CurriculumContent additions (migration)

```sql
ALTER TABLE "CurriculumContent"
  ADD COLUMN "learningObjectives" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "visibility"         TEXT   NOT NULL DEFAULT 'class_only',
  ADD COLUMN "parentLessonId"     TEXT,
  ADD COLUMN "lessonVersion"      INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "publishedAt"        TIMESTAMPTZ,
  ADD COLUMN "rejectionReason"    TEXT,
  ADD COLUMN "schoolId"           TEXT;

CREATE INDEX IF NOT EXISTS "CurriculumContent_schoolId_visibility_idx"
  ON "CurriculumContent"("schoolId", "visibility");
```

- `learningObjectives`: `string[]` — teacher-authored objectives for the lesson
- `visibility`: `class_only | school_wide` — class_only requires assignment; school_wide surfaces to all students at the same school
- `schoolId`: denormalized from `editedBy.schoolId` at creation time — enables efficient school_wide visibility queries without joining through User
- `parentLessonId`: references `CurriculumContent.id` — chains version history
- `lessonVersion`: integer version counter (separate from `version` which is a date string)
- `publishedAt`: set on admin approval
- `rejectionReason`: stored on rejection, shown to teacher in their lesson list

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
  scheduledFor DateTime?         -- null = available immediately
  assignedAt   DateTime          @default(now())

  @@unique([contentId, classId])
  @@index([classId, scheduledFor])
}
```

Add back-relations on `CurriculumContent` and `User`:
```prisma
// CurriculumContent
teacherLessonAssignments TeacherLessonAssignment[]

// User
teacherLessonAssignments TeacherLessonAssignment[] @relation("TeacherLessonAssignments")
```

### Migration file
`prisma/migrations/20260608_000001_wave4_teacher_lessons/migration.sql`

Standard Supabase manual SQL pattern. Apply via:
```
npx prisma db execute --file prisma/migrations/20260608_000001_wave4_teacher_lessons/migration.sql
```
Register in `_prisma_migrations` after applying.

### Tests (Wave 4A, 10+)
- CurriculumContent created with `learningObjectives`, `visibility` fields
- `visibility` defaults to `class_only`
- `TeacherLessonAssignment` created, unique constraint enforced (contentId + classId)
- Assignment with `scheduledFor` in future is not immediately visible
- `parentLessonId` chain: lesson v2 references lesson v1's id
- `lessonVersion` increments correctly on fork
- `publishedAt` is null until admin approves
- `rejectionReason` stored and readable
- `editReviewStatus` transitions: null → PENDING → APPROVED/REJECTED
- Migration SQL is idempotent (uses IF NOT EXISTS / IF EXISTS guards)

**Gate:** schema applied, all 10 tests passing, no UI work in this wave.

---

## Wave 4B — Editor Enhancements

### What changes on `/teacher/lessons/create`

1. **Subject dropdown** — update `SUBJECTS` constant to include all `Subject` enum values: `MATH, SCIENCE, LITERACY, SOCIAL_STUDIES, ENGLISH, CS, ENGINEERING_FOUNDATIONS, CIVICS` (currently only 4)

2. **Learning objectives** — below title, add an "Objectives" section with add/remove text inputs. Stored as JSON array, submitted with lesson body. Max 8 objectives.

3. **Fork from existing** — new "Fork from AI lesson" tab on the create page. Search bar fetches `GET /api/teacher/lessons/forkable?q=...` (approved AI lessons). Selecting one pre-fills title, subject, grade, and body in the Tiptap editor. Teacher edits from there. `derivedFromContentId` sent on save.

4. **Autosave** — after any body/title change, a 30-second debounce timer fires `PATCH /api/teacher/lessons/[contentId]` with `{title, bodyHtml, learningObjectives}`. Shows "Auto-saved [time]" indicator. Only fires if lesson already exists (has a contentId from first save).

5. **Inline question editor** — "Add question" button opens a drawer:
   - MCQ: question text + up to 4 choices + correct answer selector
   - Short answer: question text + model answer
   Questions stored in `assessmentQuestions` JSON array (matches existing shape). Reorderable via drag handle.

### What changes on `/teacher/lessons/[lessonId]/edit`

- Same objectives editor
- Same question editor
- If `editReviewStatus === 'APPROVED'` (published): show "Create v[N+1]" button instead of "Submit for review". Clicking it calls `POST /api/teacher/lessons/[contentId]/fork`.

### API additions
- `GET /api/teacher/lessons/forkable` — returns approved non-teacher-created lessons, searchable by title
- `POST /api/teacher/lessons/[contentId]/fork` — creates new draft with `parentLessonId`, `lessonVersion = parent + 1`

### Tests (Wave 4B)
- Objectives saved and reloaded on edit
- Autosave debounce: mock timer, confirm PATCH fires at 30s, not before
- Fork: pre-fills editor with parent body and sets `derivedFromContentId`
- Question editor: add MCQ, remove, reorder — stored correctly in `assessmentQuestions`
- Subject dropdown shows all 8 subjects

---

## Wave 4C — Moderation Queue Upgrade

### `/admin/content-review` upgrade

Mirrors `/admin/video-moderation` pattern exactly.

**Tab bar:** Pending (with count badge) | Approved | Rejected

**Lesson card** (in pending tab):
- Title, grade, subject, teacher name, school, submitted date
- "Preview" button → slide-in panel showing rendered lesson HTML, learning objectives list, assessment questions count
- Approve / Reject buttons

**On Approve:**
```
PATCH /api/admin/content-review/[lessonId]
{ editReviewStatus: "APPROVED" }
```
Server sets:
- `editReviewStatus = 'APPROVED'`
- `status = 'published'`
- `publishedAt = now()`
Writes audit log: `action = 'teacher.lesson.published'`
Creates `NotificationInboxItem` for the teacher: "Your lesson '[title]' was approved and is now published."

**On Reject:**
```
PATCH /api/admin/content-review/[lessonId]
{ editReviewStatus: "REJECTED", rejectionReason: "..." }
```
Server sets:
- `editReviewStatus = 'REJECTED'`
- `rejectionReason = reason`
Writes audit log: `action = 'teacher.lesson.rejected'`
Creates `NotificationInboxItem` for the teacher with reason included.

**Approved and Rejected tabs:** same layout, read-only (no action buttons), shows `publishedAt` or `rejectionReason`.

### Tests (Wave 4C)
- Pending tab shows only `editReviewStatus = 'PENDING'`
- Approved tab shows only `editReviewStatus = 'APPROVED'`
- Approve: sets all three fields (`editReviewStatus`, `status`, `publishedAt`)
- Reject: stores `rejectionReason`
- Audit log entry created on approve
- Audit log entry created on reject
- `NotificationInboxItem` created for teacher on approve
- `NotificationInboxItem` created for teacher on reject

**Gate:** principal can approve, status transitions correctly, audit log fires.

---

## Wave 4D — Student Visibility + Assignment

### Teacher assignment flow

On `/teacher/lessons` (My lessons tab), published lessons show an "Assign" button.

Clicking opens a modal:
- Class selector (teacher's classes from `/api/teacher/dashboard`)
- Optional date picker (scheduledFor — default null = immediate)
- Submit: `POST /api/teacher/lessons/[contentId]/assign`
  ```json
  { "classId": "...", "scheduledFor": "2026-06-10T00:00:00Z" }
  ```
  Creates `TeacherLessonAssignment`. Returns 409 if already assigned to that class.

"Assigned classes" chip list shown on the lesson card after assignment.

### Student visibility

**Two paths — evaluated in `/api/student/teacher-lessons`:**

1. `class_only`: student sees lesson if:
   - `TeacherLessonAssignment` exists for student's `classId`
   - `scheduledFor` is null OR `scheduledFor <= now()`
   - lesson `editReviewStatus = 'APPROVED'`

2. `school_wide`: student sees lesson if:
   - `content.visibility = 'school_wide'`
   - `content.schoolId = student.schoolId` (direct field — no join needed)
   - `editReviewStatus = 'APPROVED'`

`GET /api/student/teacher-lessons` returns the union. Called by student Today page alongside the existing scheduled work fetch.

### Student lesson viewer

Teacher lesson renders through the same `LessonDeliveryClient` at `/student/lessons/[id]`.

The lesson response shape gains one optional field:
```ts
teacherAuthorName: string | null
```
Populated when `content.teacherCreated = true` and `content.editedBy.name` is available.

`LessonDeliveryClient` renders a small badge near the title:
```tsx
{teacherAuthorName && (
  <span className="...">From {teacherAuthorName}</span>
)}
```
One conditional render, no special-case routing.

### Tests (Wave 4D)
- Unassigned published lesson: not returned for student
- Assigned lesson with `scheduledFor = tomorrow`: not returned today, returned tomorrow
- Assigned lesson with `scheduledFor = null`: returned immediately
- `school_wide` lesson visible to student in same school without assignment
- `school_wide` lesson NOT visible to student in different school
- `class_only` lesson NOT visible to student in a different class at same school
- Teacher author name appears in lesson response when `teacherCreated = true`

**Gate:** full pipeline — teacher creates → admin approves → teacher assigns → student sees and completes.

---

## Wave 4E — Polish + Audit + MOE

### MOE dashboard panel

New panel in `/moe/dashboard`: **"Teacher Content"**
- Total published teacher-created lessons nationally
- Breakdown by school (name, count, avg quiz score on teacher lessons)
- Avg quiz score: teacher lessons vs AI lessons (side-by-side)
- Top 5 most-assigned teacher lessons (by assignment count)

Data endpoint: `GET /api/moe/teacher-lessons` — 30-min Redis cache key `moe:teacher-lessons`.

### Teacher "My Created Lessons" stats

On `/teacher/lessons` (My lessons tab), each lesson card expands to show:
- Views: count of distinct students who started the lesson (from `StudentProgress`)
- Completions: count where `completedAt` is set
- Avg quiz score: mean of quiz answers for this lesson

Data from existing `StudentProgress` table — no new tracking needed.

### Versioning UI

In My Lessons list, lessons with `lessonVersion > 1` show a `v{N}` badge.

On published lesson: "Create new version" button (visible to lesson author only):
- `POST /api/teacher/lessons/[contentId]/fork`
- Server creates new `CurriculumContent` with:
  - `parentLessonId = current.id`
  - `lessonVersion = current.lessonVersion + 1`
  - `editReviewStatus = null` (draft, not yet submitted)
  - `status = 'draft'`
  - `teacherCreated = true`, `editedById = current user`
  - All content fields copied from parent
- Redirects teacher to new draft's edit page

Students continue seeing published v1 until v2 is approved.

### School-wide lesson browser

Third tab on `/teacher/lessons`: **"School lessons"**
- `GET /api/teacher/lessons/school-wide` — `school_wide` published lessons from same school, excluding own
- Read-only cards with "Fork" button to create a personal copy

### Content flagging

On student lesson view: small "Report" link (next to existing help flag).
- `POST /api/student/flag-content` with `{ contentId, reason: 'inappropriate_content' | 'factually_wrong' | 'other', note? }`
- Creates `LessonHelpFlag` with `flagType = 'inappropriate_content'` (reuses existing model)
- Admin content-review queue shows flag count per lesson as a red badge

### Wave 4 audit script

`scripts/wave4-audit.ts`:
- All teacher-created published lessons have `publishedAt` set
- All have non-null `editedById`
- All have valid `learningObjectives` (parseable JSON array)
- No orphan `TeacherLessonAssignment` records (referencing deleted content)
- No lessons stuck in PENDING > 7 days (alert)

### Tests (Wave 4E)
- MOE endpoint returns correct lesson counts per school
- Fork creates correct `parentLessonId` and `lessonVersion`
- Students continue seeing v1 after v2 draft is created
- School-wide browser excludes own lessons
- Content flag creates `LessonHelpFlag` with correct `flagType`
- Audit script reports orphan assignments

---

## Pre-VSL Checklist (after 4E)

- [ ] 3 teacher-created demo lessons exist (at least 1 school-wide)
- [ ] MOE dashboard shows teacher lesson count correctly
- [ ] Full flow verified: teacher creates → admin approves → teacher assigns → student completes
- [ ] Audit script runs clean (0 issues)
- [ ] Screenshots: create page, moderation queue, student Today with teacher lesson, MOE panel

---

## Test Count Target

| Wave | New Tests |
|------|-----------|
| 4A   | 10        |
| 4B   | 5         |
| 4C   | 8         |
| 4D   | 7         |
| 4E   | 6         |
| **Total** | **36** |

---

## File Inventory (new or modified)

### New files
- `prisma/migrations/20260608_000001_wave4_teacher_lessons/migration.sql`
- `app/api/teacher/lessons/[contentId]/assign/route.ts`
- `app/api/teacher/lessons/[contentId]/fork/route.ts`
- `app/api/teacher/lessons/forkable/route.ts`
- `app/api/teacher/lessons/school-wide/route.ts`
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
- `prisma/schema.prisma` — new fields + `TeacherLessonAssignment` model
- `app/teacher/lessons/create/page.tsx` — objectives, all subjects, fork tab, autosave, question editor
- `app/teacher/lessons/[lessonId]/edit/page.tsx` — objectives, question editor, "Create v2" button
- `app/teacher/lessons/page.tsx` — assign button, stats, school-wide tab
- `app/admin/content-review/page.tsx` — tabs, preview panel, publishedAt display
- `app/api/admin/content-review/[lessonId]/route.ts` — publishedAt + audit log + notification
- `app/api/admin/content-review/route.ts` — tab filtering
- `app/student/today/page.tsx` — fetch teacher-lessons alongside scheduled work
- `app/student/lessons/[id]/LessonDeliveryClient.tsx` — `teacherAuthorName` badge
- `app/moe/dashboard/page.tsx` — teacher content panel

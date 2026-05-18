# Sprint 25 — Teacher Content Creation

**Status:** Planned
**Priority:** High — reduces dependency on AI-only curriculum; enables teachers to enrich content

---

## Goals

1. Teachers can create, edit, and publish their own lessons and quizzes
2. Rich-text editor (no HTML knowledge required)
3. Teacher-created content goes through school admin approval before students see it
4. Version history so edits can be rolled back

---

## Scope

### 1. Rich-Text Editor

**Library:** `TipTap` (headless, React-compatible, extensible)
- Extensions needed: Bold, Italic, Underline, Heading (H2/H3), BulletList, OrderedList, Image (Vercel Blob), Code, Table
- No LaTeX math editor for MVP (add in future sprint)
- Character count warning at 10,000 chars

**Component:** `components/editor/RichTextEditor.tsx`
- Controlled component: `value: string (HTML)` + `onChange: (html: string) => void`
- Toolbar: formatting buttons + image upload button
- Image upload: POST to `/api/teacher/content/upload-image` → returns Vercel Blob URL → inserts into editor
- Mobile-friendly (teachers in Liberia often use phones)

---

### 2. DB Schema — Teacher-Created Content

Teacher-created content reuses the existing `CurriculumContent` model with additions:

```prisma
// CurriculumContent additions
authorId       String?   // null = AI-generated; set = teacher-created
authorType     ContentAuthor @default(AI)
editedBody     String?   // stores teacher-edited HTML body (rich text)
editHistory    Json?     // [{editedAt, editedBy, bodySnapshot}] — last 10 versions
publishedAt    DateTime?

enum ContentAuthor {
  AI
  TEACHER
}
```

**Note:** Teacher-created lessons use the same approval workflow (`status: NEEDS_REVIEW → APPROVED`) — school admins review before students see it.

---

### 3. Create Lesson Flow

**Route:** POST `/api/teacher/content`
- Auth: `requireRole("TEACHER")`
- Body:
  ```typescript
  {
    title: string;
    subject: string;
    grade: number;
    lessonFormat: "standard";
    body: string;           // rich text HTML from TipTap
    learningObjectives: string[];
    assessmentQuestions: { question: string; answer: string }[];
    tags?: string[];
  }
  ```
- Creates `CurriculumContent` with `authorType: TEACHER`, `status: NEEDS_REVIEW`
- Creates `TeacherAlert` to school admin (type: "CONTENT_PENDING_REVIEW")
- Returns `{ contentId }`

**Page:** `app/teacher/content/new/page.tsx`
- Form with TipTap editor for body
- Separate inputs for learning objectives (add/remove list)
- Assessment questions builder (question + answer pairs)
- Subject/grade dropdowns
- "Save Draft" (status: DRAFT) and "Submit for Review" buttons

---

### 4. Edit Existing AI Lesson

**Route:** PATCH `/api/teacher/content/[contentId]`
- Auth: teacher in same school
- Body: `{ editedBody?: string, title?, learningObjectives?, assessmentQuestions? }`
- Saves to `editedBody` (does not overwrite AI `body_standard`)
- Appends to `editHistory` (capped at 10 versions)
- Resets status to NEEDS_REVIEW if lesson was APPROVED (edit invalidates approval)
- `logAudit` (action: "lesson_edited_by_teacher")

**UI:** "Edit" button on lesson detail page (teacher view only)
- Opens TipTap editor pre-loaded with `editedBody ?? body_standard`
- Shows "AI Original" toggle to compare with original

---

### 5. Version History

**Route:** GET `/api/teacher/content/[contentId]/history`
- Returns `editHistory` array (last 10 edits with timestamp + editor name)

**Route:** POST `/api/teacher/content/[contentId]/revert`
- Auth: teacher in same school or school admin
- Body: `{ historyIndex: number }`
- Reverts `editedBody` to the snapshot at that index
- Adds new entry to `editHistory` (revert is itself a tracked edit)

---

### 6. School Admin Review Queue

**Route:** GET `/api/admin/content/pending`
- Returns `CurriculumContent` where `authorType: TEACHER` and `status: NEEDS_REVIEW`
- Includes `authorId`, `teacherName`, `createdAt`

**Route:** PATCH `/api/admin/content/[contentId]/review`
- Body: `{ action: "APPROVE" | "REJECT", note?: string }`
- On APPROVE: `status → APPROVED`, push notification to teacher
- On REJECT: `status → NEEDS_REVIEW` (stays in queue with note), push notification to teacher
- School admins cannot publish AI-generated content (that goes through the existing MOE approval workflow)

---

### 7. Draft/Publish Lifecycle

```
DRAFT → NEEDS_REVIEW (submit for review)
NEEDS_REVIEW → APPROVED (admin approves) → visible to students in assigned classes
NEEDS_REVIEW → DRAFT (admin rejects with note) → teacher can revise
APPROVED → ARCHIVED (teacher or admin archives)
```

**Feature flag:** `ENABLE_TEACHER_CONTENT_CREATION=true`

---

### 8. Schema Migration

`prisma/migrations/20260630_000001_sprint25_teacher_content/migration.sql`

```sql
CREATE TYPE "ContentAuthor" AS ENUM ('AI', 'TEACHER');

ALTER TABLE "CurriculumContent"
  ADD COLUMN "authorId" TEXT,
  ADD COLUMN "authorType" "ContentAuthor" NOT NULL DEFAULT 'AI',
  ADD COLUMN "editedBody" TEXT,
  ADD COLUMN "editHistory" JSONB,
  ADD COLUMN "publishedAt" TIMESTAMP(3);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "CurriculumContent_authorType_status_idx"
  ON "CurriculumContent"("authorType", "status");
```

---

## Files Touched

- `prisma/schema.prisma` — CurriculumContent additions, ContentAuthor enum
- `prisma/migrations/20260630_000001_sprint25_teacher_content/migration.sql` — NEW
- `components/editor/RichTextEditor.tsx` — NEW
- `app/api/teacher/content/route.ts` — POST create
- `app/api/teacher/content/[contentId]/route.ts` — GET, PATCH
- `app/api/teacher/content/[contentId]/history/route.ts` — NEW
- `app/api/teacher/content/[contentId]/revert/route.ts` — NEW
- `app/api/teacher/content/upload-image/route.ts` — NEW
- `app/api/admin/content/pending/route.ts` — NEW
- `app/api/admin/content/[contentId]/review/route.ts` — NEW
- `app/teacher/content/new/page.tsx` — NEW
- `app/teacher/content/[contentId]/edit/page.tsx` — NEW
- `package.json` — add `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image`

## Tests Required

- `__tests__/sprint25.teacherContent.test.ts` — create, edit, version history, revert, status transitions
- `__tests__/sprint25.contentReview.test.ts` — admin approve/reject, notifications, tenant scoping
- `__tests__/sprint25.imageUpload.test.ts` — Blob URL injection, type validation

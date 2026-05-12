# LiberiaLearn — Full Online School Build Plan

> Last updated: 2026-05-11
> Owner: Fasiryon
> Goal: Every feature of a complete K-12 online school. No payment processing.

## Sprint Approval Status

| # | Sprint | Status | Commit |
|---|--------|--------|--------|
| 1 | Lesson Regeneration Direct Processor | IN PROGRESS | — |
| 2 | Assignment Grading + Gradebook | AWAITING APPROVAL | — |
| 3 | Term Report Cards | AWAITING APPROVAL | — |
| 4 | Push Notifications + PWA Install | AWAITING APPROVAL | — |
| 5 | School Events Calendar | AWAITING APPROVAL | — |
| 6 | Live Class Sessions (Jitsi) | AWAITING APPROVAL | — |
| 7 | Class Discussion Boards | AWAITING APPROVAL | — |
| 8 | Guardian Portal Enhancement | AWAITING APPROVAL | — |
| 9 | Canva Documents Suite | AWAITING APPROVAL | — |
| 10 | Student Portfolio + Capstone | AWAITING APPROVAL | — |
| 11 | Mobile PWA + Offline Enhancement | AWAITING APPROVAL | — |
| 12 | Two-Way Student↔Teacher Messaging | AWAITING APPROVAL | — |

---

## Sprint 1 — Lesson Regeneration Direct Processor

**Goal:** Process 1,227 empty lessons (status NEEDS_REVIEW, payload < 300 chars) without SQS.

**Problem:** SQS_QUEUE_URL is empty in Vercel production. The ECS worker never runs. All 1,000 queued DB jobs are stranded.

**Solution:** `scripts/process-regen-jobs-direct.ts` — calls `generateCurriculumPayload` directly for each pending DB job, validates depth gate, writes APPROVED to DB.

**Deliverables:**
- `scripts/process-regen-jobs-direct.ts` — main processor
- `scripts/regen-status.ts` — status check (no writes)

**Depth gates:**
- G1–G6: ≥ 15 slides, ≥ 1200 words
- G7–G12: ≥ 18 slides, ≥ 1200 words
- No placeholder phrases

**Validation run:** --limit 50 before overnight full batch

**Overnight command:**
```bash
npx dotenv -e .env.production -- npx tsx scripts/process-regen-jobs-direct.ts
```

---

## Sprint 2 — Assignment Grading + Gradebook

**Goal:** Close the teacher grading loop. Teachers currently assign homework but have no inbox to review and grade submissions.

**New routes:**
- `GET /api/teacher/grading/inbox` — pending submissions list
- `POST /api/teacher/grading/submit` — submit grade + feedback
- `GET /api/teacher/gradebook?classId=` — full gradebook grid

**New pages:**
- `/teacher/grading` — grading inbox (submissions list, rubric viewer, grade form)
- `/teacher/gradebook` — grade grid (students × assignments, export CSV)

**Schema:** `AssignmentSubmission` already exists with `status`, `score`, `feedback` fields. No new migration needed.

---

## Sprint 3 — Term Report Cards

**Goal:** End-of-term academic report for students and guardians.

**New model:**
```prisma
model ReportCard {
  id          String   @id @default(cuid())
  studentId   String
  schoolId    String
  termId      String
  grades      Json     // { subject: { score, grade, remarks } }
  overallGpa  Float?
  attendance  Int?
  status      String   @default("draft")
  publishedAt DateTime?
  createdAt   DateTime @default(now())
}
```

**New routes:**
- `POST /api/admin/report-cards/generate` — generate for all students in a class
- `GET /api/student/report-card` — view own report card
- `GET /api/guardian/report-card?studentId=` — guardian view

**New pages:**
- `/student/report-card` — printable report card
- `/admin/report-cards` — generate + publish controls
- `/guardian/report-card` — guardian view

---

## Sprint 4 — Push Notifications + PWA Install

**Goal:** Students and teachers receive push notifications on mobile; teachers can install as PWA.

**Package:** `web-push` (already in package.json? check)

**New model:**
```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   @unique
  keys      Json
  createdAt DateTime @default(now())
}
```

**Triggers:**
- New assignment → student push
- Assignment graded → student push
- Alert → teacher push
- Certificate awarded → student push

**New routes:**
- `POST /api/push/subscribe`
- `DELETE /api/push/unsubscribe`
- `POST /api/push/send` (internal)

**SW update:** `public/sw.js` — add `push` event handler

---

## Sprint 5 — School Events Calendar

**Goal:** School-wide event calendar visible on all dashboards (assemblies, exams, holidays, sports days).

**New model:**
```prisma
model SchoolEvent {
  id          String   @id @default(cuid())
  schoolId    String
  title       String
  description String?
  startAt     DateTime
  endAt       DateTime?
  eventType   String   // assembly|exam|holiday|sports|parent_meeting|other
  createdBy   String
  createdAt   DateTime @default(now())
}
```

**New routes:**
- `GET /api/school/events?month=` — list events
- `POST /api/school/events` — create (admin only)
- `DELETE /api/school/events/:id` — delete (admin only)

**UI additions:**
- Calendar widget on student, teacher, guardian, and admin dashboards
- Full calendar page at `/admin/events`

---

## Sprint 6 — Live Class Sessions (Jitsi)

**Goal:** Teachers start a live class; students join from their Today page.

**Technology:** Jitsi Meet iframe embed (no API key needed for public Jitsi)

**New model:**
```prisma
model LiveSession {
  id          String   @id @default(cuid())
  classId     String
  teacherId   String
  roomName    String   @unique
  startedAt   DateTime @default(now())
  endedAt     DateTime?
  status      String   @default("active")
  schoolId    String
}
```

**New routes:**
- `POST /api/live/start` — teacher starts session, creates room
- `POST /api/live/end` — teacher ends session
- `GET /api/live/active?classId=` — students poll for active session

**UI:**
- `/teacher/live` — Start Live Class button + end controls
- `/student/today` — "Live Now" banner when session active for student's class

---

## Sprint 7 — Class Discussion Boards

**Goal:** Async discussion threads per class/subject — students and teachers post, reply, react.

**New models:**
```prisma
model DiscussionThread {
  id        String   @id @default(cuid())
  classId   String
  title     String
  authorId  String
  isPinned  Boolean  @default(false)
  createdAt DateTime @default(now())
  posts     DiscussionPost[]
}

model DiscussionPost {
  id         String   @id @default(cuid())
  threadId   String
  authorId   String
  body       String
  parentId   String?
  createdAt  DateTime @default(now())
  thread     DiscussionThread @relation(fields: [threadId], references: [id])
}
```

**New routes:**
- `GET /api/discussion/threads?classId=`
- `POST /api/discussion/threads`
- `GET /api/discussion/threads/:id/posts`
- `POST /api/discussion/threads/:id/posts`

**New pages:**
- `/student/discussion` — student view, classes-only
- `/teacher/discussion` — teacher view, moderation controls

---

## Sprint 8 — Guardian Portal Enhancement

**Goal:** Guardians see attendance, grades, and can send messages directly to teachers.

**New capabilities:**
- Attendance view: guardian sees daily attendance records for linked student
- Grades view: guardian sees current term scores
- Two-way guardian↔teacher messaging (teacher-side already exists via MessagingCenter)

**New routes:**
- `GET /api/guardian/attendance?studentId=` — attendance records
- `GET /api/guardian/grades?studentId=` — current grades
- Guardian side of existing `Message` model already supports `GuardianMessage`

**UI additions:**
- `/guardian/attendance` — full attendance history
- `/guardian/grades` — subject grade cards
- `/guardian/messages` — two-way messaging surface

---

## Sprint 9 — Canva Documents Suite

**Goal:** Generate official school documents using Canva MCP integration.

**Documents:**
- Student ID Card — name, photo placeholder, grade, school, ID number
- Enrollment Confirmation Letter — student name, school, grade, academic year
- Report Card PDF — formatted version of term report card
- Certificate of Achievement — already partially built (pending MCP token)

**Requires:** `CANVA_MCP_AUTHORIZATION_TOKEN` env var set in Vercel.

**New routes:**
- `POST /api/canva/generate-id-card`
- `POST /api/canva/generate-enrollment-letter`
- `POST /api/canva/generate-report-card-pdf`

**Admin UI:**
- `/admin/documents` — generate + download document suite per student

---

## Sprint 10 — Student Portfolio + Capstone

**Goal:** Students build a portfolio of work; Grade 10–12 students complete a capstone project.

**New pages:**
- `/student/portfolio` — portfolio items list, add/remove, shareable URL
- `/student/capstone` — capstone project manager (G10–G12 only)

**Uses existing models:** `PortfolioItem`, `CapstoneProject` (already in schema)

**New routes:**
- `GET /api/student/portfolio`
- `POST /api/student/portfolio`
- `DELETE /api/student/portfolio/:id`
- `GET /api/student/capstone`
- `POST /api/student/capstone`
- `GET /p/:studentId` — public portfolio URL

---

## Sprint 11 — Mobile PWA + Offline Enhancement

**Goal:** Installable PWA with offline lesson cache for unreliable networks.

**Enhancements:**
- Install prompt component (beforeinstallprompt)
- Offline lesson cache up to 50 lessons (already 20-lesson cap — increase to 50)
- Offline quiz drafts (in-progress quiz saved locally, synced on reconnect)
- Network status indicator in UI

**Service worker updates:**
- Cache version bump for new assets
- Background sync for offline quiz submissions

---

## Sprint 12 — Two-Way Student↔Teacher Messaging

**Goal:** Students can message their teacher directly; teachers see a unified inbox.

**Context:** Current `Message` model supports teacher↔guardian. Need to add student↔teacher direction.

**New routes:**
- `POST /api/student/messages` — student sends message to teacher
- `GET /api/student/messages` — student inbox
- `/teacher/messages` already exists — extend to show student threads too

**Security:** Students can only message teachers of their enrolled classes.

---

## Gate Protocol

Each sprint runs:
1. `npx prisma generate`
2. `npx tsc --noEmit`
3. `npx vitest run`
4. `npm run build`

Then commit + push. Do NOT start next sprint until user approves.

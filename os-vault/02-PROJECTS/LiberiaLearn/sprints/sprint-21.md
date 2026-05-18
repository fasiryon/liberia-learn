# Sprint 21 — Video Micro-Lessons

**Status:** Planned
**Priority:** Medium — enhances content richness; no transcoding complexity

**Technical decision locked:** Vercel Blob only (no transcoding, no streaming service). Teacher uploads separate thumbnail image.

---

## Goals

1. Teachers can upload short video lessons (up to 10 min) via Vercel Blob
2. Students watch videos in the lesson delivery experience
3. Moderation queue — admin approves video before students can access
4. Per-school storage quota to control Blob costs

---

## Scope

### 1. DB Schema — `VideoLesson` Model

```prisma
model VideoLesson {
  id           String    @id @default(cuid())
  schoolId     String
  lessonId     String?   // optional: linked to a CurriculumContent lesson
  title        String
  description  String?
  blobUrl      String    // Vercel Blob URL (public)
  thumbnailUrl String?   // separate thumbnail blob URL
  durationSec  Int?      // detected on upload or set manually
  uploadedBy   String    // userId of teacher
  status       VideoStatus @default(PENDING_REVIEW)
  rejectedNote String?   // admin note if rejected
  viewCount    Int        @default(0)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  school       School    @relation(...)
  uploader     User      @relation(...)

  @@index([schoolId, status])
  @@index([lessonId])
}

enum VideoStatus {
  PENDING_REVIEW
  APPROVED
  REJECTED
}
```

---

### 2. Upload Flow

**Route:** POST `/api/teacher/videos/upload-url`
- Auth: `requireRole("TEACHER")`
- Checks school storage quota before issuing upload URL
- Returns: `{ uploadUrl, blobToken }` (Vercel Blob client upload pattern)

**Route:** POST `/api/teacher/videos`
- Called after upload completes
- Body: `{ blobUrl, thumbnailUrl?, title, description, lessonId?, durationSec? }`
- Creates `VideoLesson` with `status: PENDING_REVIEW`
- Triggers `TeacherAlert` to school admin (type: "VIDEO_PENDING_REVIEW")

**File validation:**
- Accepted types: `video/mp4`, `video/webm` only
- Max file size: 500MB (Vercel Blob supports up to 5GB, but school quota applies)
- Max duration: enforced on client via HTML5 video `loadedmetadata` event — warn if > 10 min, still allow upload

**Thumbnail upload:**
- Separate route: POST `/api/teacher/videos/upload-thumbnail-url`
- Accepted types: `image/jpeg`, `image/png`, `image/webp`
- Max size: 2MB

---

### 3. Storage Quota

**Per-school quota:** `School.videoStorageQuotaMB` (default: 2048 = 2GB)
**Tracking:** `School.videoStorageUsedMB` — updated on upload and on video deletion

**Quota check logic (`lib/video/quotaGuard.ts`):**
- Before issuing upload URL: check `usedMB + estimatedUploadMB <= quotaMB`
- If over quota: return 409 with message "Storage quota reached. Delete older videos or contact admin."
- Platform admins can update `videoStorageQuotaMB` via admin panel

---

### 4. Moderation Queue

**Route:** GET `/api/admin/videos/pending`
- Auth: `requireRole("SCHOOL_ADMIN")` OR `isPlatformAdmin()`
- Returns all `VideoLesson` with `status: PENDING_REVIEW` for the school

**Route:** PATCH `/api/admin/videos/[videoId]/review`
- Body: `{ action: "APPROVE" | "REJECT", note?: string }`
- On APPROVE: `status → APPROVED`, notify teacher via SMS/email
- On REJECT: `status → REJECTED`, `rejectedNote = note`, notify teacher
- `logAudit` on both actions

---

### 5. Student Viewing Experience

**Where videos appear:**
- On the lesson delivery page (`/student/lesson/[contentId]`) — if a linked `VideoLesson` (APPROVED) exists, show a "Watch Video Lesson" button above the lesson body
- On `/student/today` — video lessons listed alongside text lessons

**Video player:**
- HTML5 `<video>` tag with controls — no custom player needed
- Vercel Blob URL is public — no signed URL complexity
- Shows thumbnail as poster image
- Tracks `viewCount` increment via POST `/api/student/videos/[videoId]/view` (fire-and-forget)

**Offline:** Video not available offline (Blob URLs not cached by service worker — out of scope)

---

### 6. Schema Migration

`prisma/migrations/20260602_000001_sprint21_video/migration.sql`

```sql
CREATE TYPE "VideoStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

CREATE TABLE "VideoLesson" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "lessonId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "blobUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "durationSec" INTEGER,
  "uploadedBy" TEXT NOT NULL,
  "status" "VideoStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "rejectedNote" TEXT,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoLesson_pkey" PRIMARY KEY ("id")
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "VideoLesson_schoolId_status_idx" ON "VideoLesson"("schoolId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "VideoLesson_lessonId_idx" ON "VideoLesson"("lessonId");

ALTER TABLE "School"
  ADD COLUMN "videoStorageQuotaMB" INTEGER NOT NULL DEFAULT 2048,
  ADD COLUMN "videoStorageUsedMB" INTEGER NOT NULL DEFAULT 0;
```

---

## Files Touched

- `prisma/schema.prisma` — VideoLesson model, School storage fields
- `prisma/migrations/20260602_000001_sprint21_video/migration.sql` — NEW
- `lib/video/quotaGuard.ts` — NEW
- `app/api/teacher/videos/upload-url/route.ts` — NEW
- `app/api/teacher/videos/route.ts` — POST create video record
- `app/api/teacher/videos/upload-thumbnail-url/route.ts` — NEW
- `app/api/admin/videos/pending/route.ts` — NEW
- `app/api/admin/videos/[videoId]/review/route.ts` — NEW
- `app/api/student/videos/[videoId]/view/route.ts` — NEW
- `components/student/VideoLessonPlayer.tsx` — NEW
- `components/teacher/VideoUploadForm.tsx` — NEW

## Tests Required

- `__tests__/sprint21.videoUpload.test.ts` — quota check, type validation, auth
- `__tests__/sprint21.moderation.test.ts` — approve/reject, notifications, tenant scoping
- `__tests__/sprint21.viewTracking.test.ts` — view count, idempotency

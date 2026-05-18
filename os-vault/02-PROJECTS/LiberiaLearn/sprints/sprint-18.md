# Sprint 18 — Labs + Password Recovery + PDF Reports

**Status:** Planned
**Priority:** High — restores broken lab generation, unblocks students without email

---

## Goals

1. Restore labs generation via a dedicated Labs Pass 3 batch script
2. Unblock student password recovery — including students with no email (admin reset code flow)
3. Printable PDF progress reports for guardians and MOE field officers

---

## Scope

### 1. Labs Pass 3 Script (`scripts/generate-labs-batch.ts`)

Labs were lost or left in NEEDS_REVIEW during the two-pass regen. This script:
- Queries all approved/NEEDS_REVIEW lessons that have `labs: []` or no lab rows in DB
- Calls `generateCurriculumPayload({ contentType: "lab", ... })` for each
- Writes lab payload to `CurriculumContent` linked to the parent lesson
- Rate-limits to avoid exceeding AI budget (max 10 concurrent)
- Logs: total processed, succeeded, failed, skipped

**Subjects that need labs:**
`SCIENCE`, `COMPUTER_SCIENCE`, `ENGINEERING`, `MATH` (G7+), `LITERACY`

**Additions:**
- Dry-run mode (`--dry-run` flag) — prints what would be generated without calling AI
- Resume flag (`--resume`) — skips lessons that already have labs to avoid re-generating
- Per-grade progress reporting in console output

---

### 2. Student Password Recovery

**Primary flow (students with email):**
- "Forgot password" link on login page
- POST `/api/auth/forgot-password` → sends reset link to email (already exists for teachers; extend to students)
- 1-hour expiry, tokenHash-only lookup (OWASP fix already in place)

**Fallback flow (students with `@no-email.liberialearn.internal` placeholder):**
- Teacher/admin sees "Generate Reset Code" button on student profile
- POST `/api/admin/students/[studentId]/reset-code` → generates 6-digit alphanumeric one-time code
- Code stored as `passwordResetToken` with 24h expiry
- Student visits `/reset-password?code=XXXXXX` — no email required
- Code is single-use; shown once to teacher then hashed

**Security requirements:**
- Rate limit: 5 reset attempts per IP per hour
- Reset code must be at least 8 chars alphanumeric
- Audit log on every reset (success + failure)
- Teachers can only reset codes for students in their school (`schoolId` scoping)

---

### 3. Printable Progress Reports (PDF)

**Report contents:**
- Student name, grade, school, date range
- Per-subject: lessons completed, assessment average, mastery %
- Attendance summary (if meeting data available)
- Certificate count (if any)
- Teacher comments field (optional, pre-fill blank)
- MOE logo + school name header

**Implementation:**
- Use `@react-pdf/renderer` or `puppeteer` (headless Chromium via Vercel)
- Route: GET `/api/student/[studentId]/progress-report.pdf`
- Auth: teacher in same school OR guardian linked to student OR MOE_OFFICIAL
- Trigger UI: button on teacher → student profile page, and guardian dashboard
- Caching: generated PDF cached for 1 hour (Redis key: `pdf:progress:{studentId}:{dateHash}`)

**Additions:**
- Class-level report: `/api/teacher/class/[classId]/progress-report.pdf` — aggregates all students
- MOE bulk export: `/api/moe/district/[district]/progress-report.pdf` — district summary (no PII, aggregate only)
- Print-friendly CSS fallback for browsers without PDF support

---

## Files Touched

- `scripts/generate-labs-batch.ts` — NEW
- `app/api/auth/forgot-password/route.ts` — extend to students
- `app/api/admin/students/[studentId]/reset-code/route.ts` — NEW
- `app/(auth)/reset-password/page.tsx` — extend for code-based reset
- `app/api/student/[studentId]/progress-report/route.ts` — NEW
- `app/api/teacher/class/[classId]/progress-report/route.ts` — NEW
- `components/student/ProgressReportButton.tsx` — NEW

## Tests Required

- `__tests__/sprint18.labs.test.ts` — dry-run behavior, resume flag, per-subject filtering
- `__tests__/sprint18.passwordRecovery.test.ts` — email flow, code flow, rate limit, tenant scoping
- `__tests__/sprint18.progressReport.test.ts` — auth checks, cache key, aggregate correctness

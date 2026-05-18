# Sprint 24 — Onboarding Tours + Housekeeping

**Status:** Planned
**Priority:** Medium — reduces drop-off at first login; compliance and data hygiene

---

## Goals

1. Role-specific onboarding tours for teachers, students, and guardians (first login only)
2. Automated backup cron job confirmation
3. Privacy policy page + terms of service acceptance gate
4. GDPR-light data export for student records

---

## Scope

### 1. In-App Onboarding Tours

**Library:** `driver.js` (lightweight, no React dependency, works with SSR) OR `react-joyride`
- Recommendation: `driver.js` — smaller bundle, no peer-dep conflicts with React 19

**Tour trigger:**
- Check `localStorage.getItem('onboarding_tour_completed_{role}')` on first dashboard render
- If not set AND user.createdAt < 7 days ago: show tour
- Users can skip at any time → sets the localStorage key

**Teacher tour (7 steps):**
1. Dashboard overview — "This is your command center"
2. Class management — "Create or view your classes here"
3. Lesson delivery — "Assign lessons to students"
4. Grade book (Sprint 20) — "Review and override AI grades here"
5. Student progress — "See each student's mastery profile"
6. Teacher alerts — "Act on flagged students here"
7. Help & settings — "Find training materials and notification settings"

**Student tour (5 steps):**
1. Today's lessons — "Your daily learning plan is here"
2. Lesson delivery — "Tap any lesson to start learning"
3. AI tutor (Sprint 19) — "Ask the AI tutor if you're stuck"
4. Achievements — "Earn badges as you progress"
5. Offline mode — "Download lessons to study without internet"

**Guardian tour (4 steps):**
1. Child progress — "See your child's learning progress"
2. Report download — "Download progress reports here"
3. Notifications — "Set up how you receive updates"
4. Contact teacher — "Message your child's teacher directly"

**Implementation:**
- `components/onboarding/TeacherTour.tsx`, `StudentTour.tsx`, `GuardianTour.tsx`
- Each tour mounted in the relevant dashboard layout
- Tour data stored as static arrays (no DB needed)
- "Take the tour again" link in settings page

---

### 2. Backup Cron Job Confirmation

**What already exists:**
- Supabase handles automated daily backups (Point-In-Time Recovery)
- `scripts/dr/healthCheck.ts` verifies DB connectivity

**What's missing:**
- No confirmation that backups are actually running
- No backup verification in health check output

**Sprint 24 additions:**

**`app/api/cron/backup-verify/route.ts`:**
- Runs daily at 2am Liberia time (UTC-0, so 2am UTC)
- Calls Supabase Management API: `GET /v1/projects/{ref}/database/backups`
- Checks that the most recent backup is < 25 hours old
- On success: `logAudit` (action: "backup_verified")
- On failure: create `TeacherAlert` scoped to platform admin (type: "BACKUP_VERIFICATION_FAILED", severity: "critical")
- Also send SMS to `PLATFORM_ADMIN_PHONE` env var if set

**Health check update (`scripts/dr/healthCheck.ts`):**
- Add 5th check: "Last backup < 25h old" (calls same Supabase Management API)
- Degrade to WARN (not ERROR) so health endpoint still returns 200

---

### 3. Privacy Policy + Terms of Service

**New pages:**
- `/privacy` — Privacy policy (static, no auth required)
- `/terms` — Terms of service (static, no auth required)

**Content coverage (privacy policy):**
- What data is collected: account info, lesson progress, assessment scores, SMS number
- How it's used: education tracking, guardian notifications, MOE compliance reports
- Data retention: active accounts + 3 years after last login
- Student data: never sold, no advertising, MOE access only for national compliance
- Contact: `privacy@liberialearn.edu.lr`
- Compliant with Liberia's ICT Policy framework

**Terms of service acceptance gate:**
- `User.tosAcceptedAt DateTime?` — add to schema
- On login (both custom JWT and NextAuth paths): if `tosAcceptedAt` is null, redirect to `/terms?required=true`
- `/terms?required=true` shows accept/decline buttons
- On accept: PATCH `/api/auth/accept-terms` → sets `tosAcceptedAt = now()`
- On decline: sign out (can't use platform without accepting)
- Gate exempted for: MOE_OFFICIAL (they have separate government terms), automated scripts

**Migration:**
```sql
ALTER TABLE "User" ADD COLUMN "tosAcceptedAt" TIMESTAMP(3);
```

---

### 4. GDPR-Light Data Export

**Route:** GET `/api/student/[studentId]/data-export`
- Auth: student (own data) OR school admin OR MOE_OFFICIAL
- Returns JSON export of all student data:
  ```json
  {
    "exportedAt": "2026-06-16T00:00:00Z",
    "student": { name, email, grade, schoolName, createdAt },
    "lessonProgress": [...],
    "assessmentHistory": [...],
    "certificates": [...],
    "tutorConversations": [...],
    "homeworkSubmissions": [...],
    "exportNote": "All personal data held by LiberiaLearn for this student."
  }
  ```
- Rate limited: 1 export per student per 24 hours
- `logAudit` on every export (action: "student_data_exported")

**Delete account request (future — out of scope for this sprint, noted for Sprint 27+):**
- Add placeholder UI "Request Data Deletion" button on settings page that emails `privacy@liberialearn.edu.lr`
- Actual deletion flow is manual for now (MOE compliance requires record retention period)

---

### 5. Schema Migration

`prisma/migrations/20260623_000001_sprint24_tos/migration.sql`

```sql
ALTER TABLE "User" ADD COLUMN "tosAcceptedAt" TIMESTAMP(3);
```

---

## Files Touched

- `prisma/schema.prisma` — User.tosAcceptedAt
- `prisma/migrations/20260623_000001_sprint24_tos/migration.sql` — NEW
- `components/onboarding/TeacherTour.tsx` — NEW
- `components/onboarding/StudentTour.tsx` — NEW
- `components/onboarding/GuardianTour.tsx` — NEW
- `app/(auth)/login/route.ts` + NextAuth signIn callback — add TOS gate redirect
- `app/api/auth/accept-terms/route.ts` — NEW
- `app/api/cron/backup-verify/route.ts` — NEW
- `scripts/dr/healthCheck.ts` — add backup check
- `app/privacy/page.tsx` — NEW (static)
- `app/terms/page.tsx` — NEW (static, with accept/decline when `?required=true`)
- `app/api/student/[studentId]/data-export/route.ts` — NEW
- `package.json` — add `driver.js`

## Tests Required

- `__tests__/sprint24.toGate.test.ts` — accept flow, decline → sign out, exemptions
- `__tests__/sprint24.dataExport.test.ts` — auth, rate limit, completeness, audit log
- `__tests__/sprint24.backupCron.test.ts` — backup age check, alert on failure

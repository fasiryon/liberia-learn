# Sprint 23 — Push Notifications + Student Flags

**Status:** Planned
**Priority:** Medium — closes the "parent stays informed" gap; critical for Liberia engagement

**Technical decision locked:** Web Push API via existing PWA service worker. No OneSignal, no Firebase — zero third-party dependency.

---

## Goals

1. Teachers and guardians receive push notifications for important events
2. Students can flag a lesson as confusing (surfaces to teacher as alert)
3. Guardian push notifications for student milestones (certificate, assignment graded)
4. Notification preference center so users can control what they receive

---

## Scope

### 1. DB Schema — Push Subscriptions + Notification Preferences

```prisma
model PushSubscription {
  id         String   @id @default(cuid())
  userId     String
  endpoint   String   @unique
  p256dh     String
  auth       String
  userAgent  String?
  createdAt  DateTime @default(now())
  user       User     @relation(...)

  @@index([userId])
}

model NotificationPreference {
  id              String  @id @default(cuid())
  userId          String  @unique
  teacherAlerts   Boolean @default(true)
  gradeUpdates    Boolean @default(true)
  studentMilestone Boolean @default(true)
  weeklyDigest    Boolean @default(true)
  user            User    @relation(...)
}
```

---

### 2. VAPID Key Setup

**Generate once (run script, store in env):**
```bash
npx web-push generate-vapid-keys
```

**New env vars:**
```bash
VAPID_PUBLIC_KEY=...   # NEXT_PUBLIC_VAPID_PUBLIC_KEY for client
VAPID_PRIVATE_KEY=...  # server-only
VAPID_SUBJECT=mailto:admin@liberialearn.edu.lr
```

---

### 3. Service Worker — Push Handler (update `public/sw.js`)

```javascript
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'LiberiaLearn', {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: data.url ?? '/' },
      tag: data.tag,          // deduplication key
      renotify: false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

---

### 4. Push Engine (`lib/push/pushNotification.ts`)

```typescript
sendPush(params: {
  userId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;    // dedup key — same tag replaces previous notification
}): Promise<{ sent: number; failed: number }>
```

**Behavior:**
- Load all `PushSubscription` for userId (user may have multiple devices)
- Filter based on `NotificationPreference` for that user
- Call `webpush.sendNotification()` for each endpoint
- On 410 (gone) response: delete subscription from DB
- Fire-and-forget (no throw on failure, log errors)

**Package:** `web-push` (npm)

---

### 5. Notification Triggers

**Teacher alerts:** When `TeacherAlert` is created with severity "high" or "critical"
- Push to teacher: "⚠️ {studentName} needs support — {alertType}"
- URL: `/teacher/dashboard`

**Assignment graded:** When `HomeworkSubmission.status → APPROVED` (from Sprint 20)
- Push to guardian: "{studentName} received {score}% on {assignmentTitle}"
- URL: `/guardian/progress`
- Gate: `NotificationPreference.gradeUpdates === true`

**Student milestone — certificate:**
- Push to guardian: "🎓 {studentName} earned a certificate in {subject}!"
- URL: `/guardian/progress`
- Gate: `NotificationPreference.studentMilestone === true`

**Weekly digest (cron, every Monday 8am Liberia time):**
- Push to guardians: "📊 Weekly update: {studentName} completed {n} lessons this week"
- Gate: `NotificationPreference.weeklyDigest === true`
- Cron route: `app/api/cron/push-digest/route.ts`

---

### 6. API Routes

**POST `/api/push/subscribe`**
- Auth: any authenticated user
- Body: `{ endpoint, p256dh, auth, userAgent? }`
- Upsert subscription by endpoint
- Returns 200

**DELETE `/api/push/unsubscribe`**
- Body: `{ endpoint }`
- Removes subscription

**GET `/api/push/preferences`**
**PATCH `/api/push/preferences`**
- Auth: own user only
- Manages `NotificationPreference` record

---

### 7. Student "Flag This Lesson" Button

**UI:** Small flag icon in lesson delivery toolbar
- On click: modal "What was confusing?" with 3 preset options + free text
- POST `/api/student/lessons/[contentId]/flag`
- Creates `TeacherAlert` (type: "LESSON_FLAGGED", severity: "low")
  - Includes flag reason and student grade (no student name for privacy)
  - Deduped: one alert per lesson per week (idempotency key: `lesson:{contentId}:flags:{week}`)
- Sends push to teacher: "📌 A student flagged '{lessonTitle}' as confusing"

**Aggregation:** If 3+ students flag the same lesson within 7 days:
- Severity escalates to "medium"
- Creates `CurriculumFlag` (type: "LESSON_FLAGGED_BY_MULTIPLE_STUDENTS")
- Notifies MOE_OFFICIAL if platform flag exists

---

### 8. Notification Preference Center UI

**Route:** `/settings/notifications`
**Component:** `app/settings/notifications/page.tsx`
- Toggle switches for each preference type
- "Enable push notifications" master toggle (triggers browser permission prompt)
- Shows number of devices currently subscribed
- Link from student today page + teacher dashboard + guardian dashboard

---

### 9. Schema Migration

`prisma/migrations/20260616_000001_sprint23_push/migration.sql`

```sql
CREATE TABLE "PushSubscription" (...);
CREATE TABLE "NotificationPreference" (...);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");
```

---

## Files Touched

- `prisma/schema.prisma` — PushSubscription, NotificationPreference models
- `prisma/migrations/20260616_000001_sprint23_push/migration.sql` — NEW
- `public/sw.js` — add push event handler + notificationclick handler
- `lib/push/pushNotification.ts` — NEW
- `app/api/push/subscribe/route.ts` — NEW
- `app/api/push/unsubscribe/route.ts` — NEW
- `app/api/push/preferences/route.ts` — GET + PATCH
- `app/api/student/lessons/[contentId]/flag/route.ts` — NEW
- `app/api/cron/push-digest/route.ts` — NEW
- `app/settings/notifications/page.tsx` — NEW
- `components/student/FlagLessonButton.tsx` — NEW
- `components/LessonDeliveryClient.tsx` — add FlagLessonButton
- `package.json` — add `web-push`

## Tests Required

- `__tests__/sprint23.pushEngine.test.ts` — send, 410 cleanup, preference gate, multi-device
- `__tests__/sprint23.flagLesson.test.ts` — idempotency, escalation at 3+, privacy (no name)
- `__tests__/sprint23.preferences.test.ts` — CRUD, auth, cross-user isolation

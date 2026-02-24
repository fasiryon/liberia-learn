# Training Center — Product & Implementation Reference

> **Feature flag:** `NEXT_PUBLIC_ENABLE_TRAINING_CENTER=true`
> **Status:** V1 — shipped in Block 4 (February 2026)
> **Related ADR:** [ADR-0006 — Training Center Architecture](../adr/0006-training-center.md)

---

## Overview

The LiberiaLearn Training Center is an in-platform micro-training system that teaches teachers and admins how to use the platform while they are actively using it.

Design priorities:
- **Mobile-first** — every step and module works on a 4G phone screen.
- **Low-literacy friendly** — short sentences, large tap targets (≥ 44px), escape hatches on every view.
- **Offline-aware** — training pages require a connection; progress is persisted to the DB on completion.
- **Feature-flagged** — zero UI surface when the flag is off.

---

## Modules (V1 — 8 total)

| ID                     | Title                                       | Level | Est. Time |
|------------------------|---------------------------------------------|-------|-----------|
| `l1-login-nav`         | Login & Navigation Basics                   | 1     | 5 min     |
| `l1-class-work`        | Find Your Class & Today's Work              | 1     | 5 min     |
| `l2-create-lesson`     | Create a Lesson                             | 2     | 7 min     |
| `l2-create-assignment` | Create an Assignment                        | 2     | 7 min     |
| `l2-grade-feedback`    | Grade & Give Feedback                       | 2     | 6 min     |
| `l2-message-guardians` | Message Guardians Safely                    | 2     | 5 min     |
| `l3-view-reports`      | View Reports & Student Progress             | 3     | 7 min     |
| `l3-guided-tools`      | Use Guided Onboarding & Accessibility Tools | 3     | 5 min     |

Each module has 4–6 steps with plain-language instructions and optional screenshot placeholders (to be replaced with real screenshots in V2).

---

## User Flows

### Teacher: Opening a Module

1. Teacher Dashboard → **🎓 Training** tab (nav) or **Training Center** card.
2. Training Center landing page shows Levels 1–3 with per-module progress indicators.
3. Teacher taps a module card → Module detail page (`/teacher/training/[moduleId]`).
4. **ModulePlayer** (client component) loads; fires `training.module_opened` event + marks module `in_progress` via `POST /api/teacher/training/open`.
5. Teacher reads each step; taps **Next Step →** (fires `training.module_step_completed`).
6. On the last step, teacher taps **✅ Mark as Complete** → `POST /api/teacher/training/complete`.
7. Completion screen appears — shows badge if level was just finished.

### Teacher: Viewing Progress

- The **Training Center landing page** shows real-time progress from the DB.
- The **Teacher Dashboard** shows earned badge chips (small) under the Training Center card.
- A full-page completion bar shows `n / 8 modules complete`.

### Admin: Checking Adoption

1. Admin Console → **Training Adoption** (nav link or Quick Actions tile).
2. `/admin/training/adoption` shows:
   - Total teachers in the school.
   - Count + percentage of teachers who completed Level 1 / 2 / 3.
   - Progress bars per level.
3. No individual teacher data is shown — aggregate counts only.

---

## Architecture

### Data Model

Uses existing **`TrainingModule`** and **`TrainingProgress`** Prisma models (migrated in `20260220_180000_training_reporting`).

Module records are seeded by `20260224_000000_seed_training_modules/migration.sql`.
Module content (steps) lives in `lib/training/modules.ts` — no extra DB roundtrip.

```
TrainingModule   (id = module code, title, sortOrder, estimatedMinutes, isActive)
TrainingProgress (id, teacherUserId → User, moduleId → TrainingModule,
                  status: not_started|in_progress|complete,
                  startedAt?, completedAt?, updatedAt)
  @@unique([teacherUserId, moduleId])
```

**Tenant isolation:** `TrainingProgress.teacherUserId` FK → `User.schoolId` — no record can reference a user from a different school without a malicious cross-tenant query.

### Key Files

| File | Purpose |
|------|---------|
| `lib/training/modules.ts` | Static module definitions (SSR-safe, no DB) |
| `lib/training/progress.ts` | DB helpers: `getTeacherProgress`, `markModuleStarted`, `markModuleComplete`, `getSchoolAdoptionStats` |
| `lib/training/badges.ts` | Pure badge computation: `computeEarnedBadges`, `isLevelComplete` |
| `app/teacher/training/page.tsx` | Training Center landing (server component) |
| `app/teacher/training/[moduleId]/page.tsx` | Module page wrapper (server component) |
| `app/teacher/training/[moduleId]/ModulePlayer.tsx` | Step-by-step player (client component) |
| `app/admin/training/adoption/page.tsx` | Admin adoption dashboard (server component) |
| `app/api/teacher/training/open/route.ts` | POST — mark module in_progress + emit metric |
| `app/api/teacher/training/complete/route.ts` | POST — mark module complete, check badge |
| `app/api/admin/training/adoption/route.ts` | GET — adoption stats (ADMIN only) |

### Badges

Badges are **derived at read-time** from `TrainingProgress` — not persisted. This keeps the schema minimal and avoids sync issues.

| Badge | Condition |
|-------|-----------|
| 🥉 Level 1 Certified | All 2 Level 1 modules complete |
| 🥈 Level 2 Certified | All 4 Level 2 modules complete |
| 🏅 Level 3 Certified | All 2 Level 3 modules complete |

---

## Telemetry Events

All events flow through `trackEvent()` (client-side → `/api/track`) or `recordMetricEvent()` (server-side → `MetricEvent` table).

| Event | Source | Payload |
|-------|--------|---------|
| `training.module_opened` | Client + Server | `{ moduleId, level }` |
| `training.module_step_completed` | Client only | `{ moduleId, stepIndex, level }` |
| `training.module_completed` | Server | `{ moduleId, level }` |
| `training.level_completed` | Server | `{ level }` |
| `training.badge_awarded` | Server | `{ badgeName, level }` |

---

## Feature Flag

| Variable | Type | Default | Effect when `true` |
|----------|------|---------|-------------------|
| `NEXT_PUBLIC_ENABLE_TRAINING_CENTER` | boolean | `false` | Shows Training nav tab + card on teacher dashboard; enables all training routes; adds Training Adoption to admin nav |

When the flag is `false`:
- All `/teacher/training/*` routes redirect to `/teacher`.
- All `/admin/training/adoption` routes redirect to `/admin`.
- No Training tab or card appears in the UI.
- The `GET /api/admin/training/adoption` and `POST /api/teacher/training/*` routes still work (not flag-gated at the API layer to support future tooling).

---

## V2 Roadmap

- Replace screenshot placeholders with real annotated screenshots.
- Add video clips per module step.
- Persist badges in a dedicated `UserBadge` table for push notifications.
- National leaderboard showing county/district adoption rates.
- Role-aware modules (Admin-specific training separate from Teacher training).
- Offline caching of module content via service worker.

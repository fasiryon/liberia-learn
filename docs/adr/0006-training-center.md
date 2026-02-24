# ADR-0006 — Training Center Architecture

| Field     | Value                      |
|-----------|----------------------------|
| Status    | Accepted                   |
| Date      | 2026-02-24                 |
| Authors   | Platform Engineering       |
| Ticket    | Block 4 — Micro Training & Adoption Engine |

---

## Context

LiberiaLearn is deployed to schools with teachers who have low computer literacy and often limited internet access.  A significant adoption risk is that teachers do not know how to use core features (homework, grading, guardian messaging).  An in-platform training system is needed that:

1. Works on mobile phones.
2. Requires no external LMS or third-party dependency.
3. Tracks per-teacher progress and rewards completion with visible certifications.
4. Gives school admins visibility into how many of their teachers have completed each level.
5. Is fully feature-flagged so it can be enabled per deployment without a code change.

---

## Decision

### Module Content: Static TypeScript vs. CMS / DB-driven

**Chosen:** Static TypeScript constants in `lib/training/modules.ts`.

**Rationale:**
- Module content changes with platform feature updates — content updates should be deployed as code, not DB patches.
- Zero extra queries on the training landing page (no `TrainingModule.findMany` needed for content).
- SSR-safe by construction (no window/localStorage).
- `TrainingModule` DB table is still seeded (via migration) so that `TrainingProgress.moduleId` FK constraints are satisfied.

**Rejected:** DB-driven content (would require a content API, seeding strategy, and a CMS or admin UI for content editing — V2 concern).

### Progress Persistence: DB vs. localStorage

**Chosen:** Database (`TrainingProgress` table, scoped by `teacherUserId`).

**Rationale:**
- localStorage is device-local — a teacher switching from phone to laptop would lose progress.
- The `TrainingProgress` model already exists in the schema with the correct compound unique index `[teacherUserId, moduleId]`.
- Tenant isolation is guaranteed by the FK chain `teacherUserId → User.schoolId`.
- Per-user, per-school scoping enables the Admin Adoption Dashboard without extra denormalization.

**Rejected:** localStorage-only (no cross-device persistence, can't aggregate for admin view).

### Badge Persistence: DB vs. Derived

**Chosen:** Derived at read-time from `TrainingProgress` records.

**Rationale:**
- Badges are a pure function of module completion state — no separate table needed.
- Eliminates synchronisation bugs (badge state always matches progress state).
- Performance is acceptable: computing 3 `isLevelComplete` checks over ≤ 8 progress records is O(n) with n = 8.

**Rejected:** Persisted `UserBadge` table (adds schema complexity, requires migration, risks out-of-sync state — deferred to V2 when push notifications are needed).

### Admin Adoption: Aggregate Counts vs. Individual Rows

**Chosen:** Aggregate counts only (`totalTeachers`, `level1Complete`, `level2Complete`, `level3Complete`).

**Rationale:**
- School admins should see adoption rates to prioritise coaching, not individual teacher records.
- Minimises PII exposure.
- Simple to compute from `TrainingProgress` grouped by school.

**Rejected:** Individual teacher progress table (unnecessary PII surface for V1 — deferred to V2 if school admins need to coach specific teachers).

### API Route Design

Two new teacher-facing POST routes:
- `POST /api/teacher/training/open` — marks `in_progress` + emits `training.module_opened`.
- `POST /api/teacher/training/complete` — marks `complete`, checks level completion, emits badges.

One admin GET route:
- `GET /api/admin/training/adoption` — returns aggregate counts, role-gated to ADMIN, tenant-scoped.

These routes are **not** gated by the feature flag at the API layer.  This allows:
- Future CLI/tooling scripts to record completions without requiring the UI flag.
- Clean separation of feature visibility (UI flag) from data integrity (always-available API).

### Schema Impact

No new Prisma models.  Uses existing `TrainingModule` and `TrainingProgress` tables.

New migration `20260224_000000_seed_training_modules` inserts 8 `TrainingModule` rows using `ON CONFLICT DO NOTHING` — idempotent and safe to re-run.

The existing `TrainingProgress` schema has two quirks handled in application code:
1. `id String @id` without `@default` — we generate UUIDs via `randomUUID()` from Node's `crypto` module.
2. `updatedAt DateTime` without `@updatedAt` — we pass `updatedAt: new Date()` explicitly on every write.

---

## Consequences

**Positive:**
- No schema changes beyond seed data.
- Full offline-read safety for module content (static TS).
- Tenant isolation proven by FK chain through `User.schoolId`.
- Test coverage: 3 new test files, all in Vitest node environment (no jsdom).
- All 5 required telemetry events are emitted.

**Negative / Trade-offs:**
- Module content updates require a code deploy (acceptable for V1).
- Progress is lost if the DB is wiped (acceptable; same as all other user data).
- Module completion requires an active connection (no offline completion in V1).

---

## Alternatives Considered and Rejected

| Alternative | Reason rejected |
|-------------|-----------------|
| Third-party LMS (e.g., Moodle, TalentLMS) | External dependency, cost, data sovereignty concerns in Liberia |
| Video-only content | Requires large bandwidth; incompatible with intermittent 4G connections |
| Persistent badges table | Adds schema complexity with no V1 benefit; deferred to V2 |
| County/national adoption in V1 | Would require platform-admin gating and multi-tenant scope; deferred to V2 |

---

## Related

- [ADR-0002 — Tenant Isolation](0002-tenant-isolation.md)
- [ADR-0005 — Usability Infrastructure](0005-usability-infrastructure.md)
- [docs/product/TRAINING_CENTER.md](../product/TRAINING_CENTER.md)
- `prisma/migrations/20260224_000000_seed_training_modules/migration.sql`

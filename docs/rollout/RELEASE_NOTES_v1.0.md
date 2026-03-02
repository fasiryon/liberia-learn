# LiberiaLearn v1.0.0 — Release Notes

**Release date:** 2026-03-01
**Type:** Initial Production Release
**Tests:** 921 passing

---

## Overview

LiberiaLearn v1.0.0 is the first production-ready release of the Ministry of Education's digital learning platform for Liberia. The platform serves teachers, students, school administrators, district administrators, and MOE national officials across Liberia's public school system.

This release covers **30 engineering blocks** built over the project lifecycle, achieving:

- Full multi-tenant school management
- AI-assisted curriculum generation with MOE standard alignment
- National oversight portal for MOE officials
- Disaster recovery infrastructure
- 921 automated tests with zero known defects

---

## Feature Summary by Area

### Core Platform (Blocks 1–4)

- **Multi-tenant school management:** School creation, admin assignment, tenant isolation enforced on every Prisma query via `schoolId`/`tenantId` scoping
- **Authentication:** NextAuth.js with role-based access control (STUDENT, TEACHER, ADMIN, GUARDIAN, DISTRICT_ADMIN, MOE_OFFICIAL)
- **Session security:** Stale session invalidation after password change (JWT `iat` vs `passwordChangedAt` check)
- **Audit logging:** Fire-and-forget `logAudit()` on all sensitive operations; never throws; stores actor, action, resource, and metadata

### Ops Intelligence (Block 5)

- Server health findings API with configurable severity thresholds (`info`/`warn`/`critical`)
- Optional AI-generated explanations for ops findings (`OPS_AI_EXPLANATIONS_ENABLED`)

### Governance Exports (Block 6)

- Student performance, class summary, and monthly report exports
- Per-school and national aggregate scopes (platform admin only)
- Emergency circuit breaker (`ENABLE_GOV_CIRCUIT_BREAKER`) — single env var disables all governance exports instantly
- PII export requires explicit opt-in flag (`ENABLE_GOV_STUDENT_PII_EXPORT`)

### Training Center (Block 7B)

- 8 teacher micro-modules with progress tracking and badges
- Admin adoption view showing completion rates per school

### Mastery Engine (Block 7A)

- Strand taxonomy across MATH, SCIENCE, LITERACY, CIVICS, CS, ENGINEERING
- Per-student mastery profiles with hybrid scoring by grade band
- Mastery telemetry events for platform analytics

### AI Endpoints (Block 10)

- **Student AI Tutor** (`POST /api/student/tutor`): Configurable daily rate limit; budget-aware; fallback on AI failure
- **Teacher Support Assistant** (`POST /api/teacher/assist`): Advisory only; daily rate limit per teacher
- **Monthly budget cap**: `AI_BUDGET_MONTHLY_CAP_USD` (default $100); 503 response with `ai_budget_exhausted` error when exceeded

### Impact Analytics + Workflow Intelligence (Block 12)

- School-level and district-level impact dashboards
- **AI Grading Assist** (`POST /api/teacher/grading/assist`): Advisory scoring bands and feedback; punitive language guardrail with automatic fallback; `teacherFinalAuthority: true` always enforced
- Intervention alert engine (class-level signals, no student IDs)
- AI intervention recommendations (school + district)
- Intervention outcomes resolution and tracking
- District intelligence aggregates

### Classroom Toolkit (Block 21)

- Calculator, science tools, geometry tools, timer — all individually flag-gated
- Toolkit overlay component with lesson integration
- Longitudinal growth tracking (monthly snapshots)

### Predictive Analytics (Blocks 16, 19–20)

- **Dropout risk scoring**: Deterministic signal model with optional AI augmentation
- **Curriculum optimization loop**: National strand weakness detection + emphasis advisory
- **Geo intelligence**: County-level performance aggregates
- **National insights dashboard**: Curriculum health + coverage by subject and grade band

### AI Factory — Curriculum Generation (Blocks 14, RR-3A)

- `generateCurriculumPayload()` with Liberian context, tone guidance by grade band, MOE standard alignment
- `generateAssessmentItems()` and `generateRubric()` with standard code attachment
- **Tone guidance injection**: Age-appropriate language enforced per grade (early elementary → high school)
- **53 MOE standard codes** across MATH (20), SCIENCE (11), LITERACY (11), CIVICS (6), CS (5)
- **92-strand catalog** (MATH, SCIENCE, ENGLISH, CS, LITERACY, CIVICS, ENGINEERING)
- 94% standard coverage (50/53 codes with content intervention)
- Curriculum feedback telemetry: approval and rejection events captured in `CurriculumFeedback` table

### Integrated Lesson Delivery Engine (Block 32 / Parts 1–9)

- **Delivery profiles**: AI-generated phase plans (standard/block formats) with exit tickets and toolkit requirements
- **Lesson delivery tracking**: `PATCH /api/teacher/schedule/[id]/deliver` marks delivery with timestamp
- **A/B block scheduling**: Block-day pair auto-creation with shared `sessionPairId` (UUID)
- **Curriculum units**: `CurriculumUnit` model for grouping related content
- **Assignment linkage**: Exit ticket → `AssignmentSuggestion` auto-creation; AI draft generation
- **Toolkit integration**: Tool recommendations per lesson phase (required/optional/contextual)
- **Virtual labs**: `VirtualLab` + `LabSession` models; labs auto-matched on scheduling by subject/grade
- **MOE compliance reporting**: Delivery rate by district; week view enhanced with delivery status

### Enrollment + Account Management (Blocks RR-1, RR-3)

- Enrollment invite system (admin + teacher can invite students)
- Account recovery (forgot password / reset password via email)

### Guardian Portal (Block RR-2)

- Guardian linking APIs (token acceptance + admin invites)
- Guardian portal UI showing linked students' progress

### MOE Access Portal (Block 28)

Five read-only national oversight routes, all gated by `ENABLE_MOE_PORTAL` and `MOE_OFFICIAL` role (or `isPlatformAdmin`):

| Route | Description |
|-------|-------------|
| `GET /api/moe/dashboard` | National summary: school/district/student counts, delivery rate, intervention volume |
| `GET /api/moe/standards-coverage` | MOE standard coverage by subject and grade band |
| `GET /api/moe/delivery-compliance` | Lesson delivery compliance rate by district |
| `GET /api/moe/curriculum-health` | Curriculum alignment health by subject |
| `GET /api/moe/intervention-impact` | Average intervention outcome delta and effect size by district |

All routes: zero PII, fire-and-forget audit logging, no school-scoped data leakage.

### Disaster Recovery (Block 29)

- `scripts/dr/healthCheck.ts`: 5 parallel health checks (env vars, Prisma client, DB connectivity, migrations, feature flags); CLI with `--json` flag; exits 1 on unhealthy
- `scripts/dr/rollbackPlan.ts`: Typed rollback step definitions for Blocks 26–28; `validateRollback()` helper
- `docs/rollout/ROLLBACK_RUNBOOK.md`: Operator runbook for production incident response

---

## Database Migrations

20 migration files ship with v1.0.0. Two are pending on the production Supabase DB and must be applied at deploy time:

1. `20260228_block26_perf_indexes` — 3 composite indexes on Enrollment, Meeting, HomeworkSubmission (additive, safe)
2. `20260301_000001_moe_official_role` — `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MOE_OFFICIAL'` (additive, irreversible per PostgreSQL semantics)

Apply with: `npx prisma migrate deploy`

---

## Performance

- Composite indexes on high-traffic join paths: `(studentId, classId)` on Enrollment, `(classId, date)` on Meeting, `(studentId, homeworkId)` on HomeworkSubmission
- N+1 elimination in `districtAggregator` and `dashboardAggregator`
- Parallel `Promise.all()` query patterns throughout
- AI budget cap prevents unbounded spend

---

## Security

- Multi-tenant isolation: every Prisma query is school/district scoped
- Role enforcement on every API route
- No PII in AI prompts (verified by test suite)
- Audit trail on all sensitive operations
- Stale session detection (password change invalidation)
- Governance circuit breaker for emergency shutdown
- Punitive language guardrail on AI grading assist

---

## Known Limitations

- `ENABLE_GOV_EXPORTS` defaults ON — review before first deploy if export restrictions are required
- 3 non-critical ESLint warnings (pre-existing): `<img>` usage, `useMemo` dependencies — no functional impact
- ENGINEERING subject has strands but zero MOE codes (structural gap; tracked as ACTION-2)
- 3 remaining MOE standard code gaps: ACTION-2 (ENGINEERING), ACTION-4 (CS G1_3), ACTION-5 (CS G4_6)

---

## Upgrade Path

This is the initial production release. No upgrade path is defined yet.
Future releases will follow semantic versioning: MAJOR.MINOR.PATCH.

---

## Support

For platform issues, contact the LiberiaLearn engineering team or open a ticket via the Ministry of Education ICT helpdesk.

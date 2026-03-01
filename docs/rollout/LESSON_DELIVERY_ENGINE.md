# Integrated Lesson Delivery Engine

**Document version:** 1.0
**Date:** 2026-03-01
**Branch:** feat/integrated-delivery-engine
**Author:** Engineering (LiberiaLearn Platform Team)
**Status:** Engineering Review Complete — MOE-Ready

---

## Table of Contents

1. [Overview](#1-overview)
2. [Part 1: Lesson Delivery Profile](#2-part-1-lesson-delivery-profile)
3. [Part 2: ScheduledWork Tracking Fields](#3-part-2-scheduledwork-tracking-fields)
4. [Part 3: A/B Block Day Intelligence](#4-part-3-ab-block-day-intelligence)
5. [Part 4: Unit Grouping](#5-part-4-unit-grouping)
6. [Part 5: Assignment and Homework Linkage](#6-part-5-assignment-and-homework-linkage)
7. [Part 6: Toolkit Integration](#7-part-6-toolkit-integration)
8. [Part 7: Virtual Lab System](#8-part-7-virtual-lab-system)
9. [Part 8: MOE Compliance Reporting](#9-part-8-moe-compliance-reporting)
10. [Feature Flags Reference](#10-feature-flags-reference)
11. [API Reference](#11-api-reference)
12. [Migration Strategy](#12-migration-strategy)

---

## 1. Overview

The Integrated Lesson Delivery Engine (ILDE) is a coordinated set of eight platform capabilities that close the gap between AI-generated curriculum content and the actual delivery of that content in Liberian classrooms. Prior to this release, LiberiaLearn could generate lessons and schedule them, but had no instrumentation for whether lessons were taught, how they were taught, whether tools were used, or whether follow-up assignments were assigned.

The ILDE provides:

- **Structured delivery guidance** embedded in each AI-generated lesson (Part 1)
- **Delivery confirmation tracking** so teachers mark lessons as taught (Part 2)
- **A/B block day pair management** for schools operating 90-minute block schedules (Part 3)
- **Curriculum unit grouping** so lessons can be organised into multi-week instructional units (Part 4)
- **Three-pathway assignment linkage** connecting lessons to homework and formative assessment (Part 5)
- **Context-aware classroom toolkit integration** recommending tools for each lesson (Part 6)
- **Virtual lab system** enabling student-facing simulation/investigation sessions tied to content (Part 7)
- **MOE compliance reporting** giving administrators and the Ministry of Education a delivery evidence trail (Part 8)

Each part is independently feature-flagged (see Section 10). All parts share the same tenant isolation model — every query is scoped to `schoolId` and enforced in the route handler before any data is returned.

### Design Principles

1. **Flag-guarded activation:** every new route and new behaviour is OFF by default. Ops enables parts individually per-school or platform-wide.
2. **Non-breaking additions:** existing routes are extended, not replaced. Legacy clients that do not read new fields are unaffected.
3. **MOE-safe data model:** no student PII appears in compliance reports. All reporting is aggregate.
4. **Mastery continuity:** virtual lab completions feed the existing `StudentMasteryProfile` system via the unchanged `updateMasteryProfile` service.

---

## 2. Part 1: Lesson Delivery Profile

### Purpose

When an AI-generated lesson is too large for a single 45-minute period, teachers historically had to make ad-hoc decisions about what to include, skip, or extend. The delivery profile gives every lesson a machine-readable structure that tells the teacher exactly how to deliver it in both standard (45 min) and block (90 min) formats.

### deliveryProfile Schema

The schema is defined in `lib/schemas/curriculumPayload.ts` as `DeliveryProfileSchema` (Zod). The shape stored in `CurriculumContent.deliveryProfile` (JSON column) is:

```typescript
{
  estimatedMinutes: number,              // total instructional time as designed
  recommendedFormat: "standard" | "block" | "either",
  phases: DeliveryPhase[],              // canonical phase list
  standardVersion: {
    phases: DeliveryPhase[],            // compressed to 45 min
    omittedActivities: string[]
  },
  blockVersion: {
    phases: DeliveryPhase[],            // expanded to 90 min
    extensions: string[]
  },
  splitPoint?: {                         // only present when estimatedMinutes > 60
    afterPhase: string,
    day2Opening: string
  },
  exitTicket: {
    questions: ExitTicketQuestion[]     // min 2, max 3 questions
  },
  toolsRequired: ToolRequired[],
  labComponent?: LabComponent | null
}
```

Each `ExitTicketQuestion` carries a `standardCode` field that links back to a MOE alignment code in the lesson's `moeAlignments` array. Each `ToolRequired` entry references a `toolKey` from the known toolkit registry (validated against the exact allowed list at generation time).

### Flag and AI Factory Changes

Flag: `ENABLE_DELIVERY_PROFILE`
Function: `isDeliveryProfileEnabled()` in `lib/serverFlags.ts`

When this flag is ON:

1. `generateCurriculumPayload()` in `lib/ai/curriculum-factory.ts` appends a structured `deliveryProfile` prompt block to the system message, including the full JSON schema, all validation rules, and the exact list of allowed `toolKey` values.
2. The AI response is parsed and then validated against `DeliveryProfileSchema` via `CurriculumPayloadSchema.safeParse()`. Invalid tool keys or fewer than 2 / more than 3 exit ticket questions cause a hard validation failure, prompting retry or manual review.
3. The `deliveryProfile` field is included in the returned `CurriculumPayload`.

When this flag is OFF:

1. The prompt contains no `deliveryProfile` instruction.
2. Any `deliveryProfile` field the model unexpectedly returns is stripped before validation.
3. Existing clients are completely unaffected.

---

## 3. Part 2: ScheduledWork Tracking Fields

### Purpose

Without delivery confirmation, the platform cannot distinguish a lesson that was scheduled (planned) from one that was actually taught in the classroom. Part 2 adds a lightweight PATCH endpoint allowing teachers to mark lessons as delivered at the conclusion of class.

### New ScheduledWork Fields

The following fields are added to the `ScheduledWork` model (added via Prisma migration):

| Field | Type | Description |
|---|---|---|
| `isDelivered` | Boolean | Whether the lesson was taught. Default: false. |
| `deliveredAt` | DateTime? | Timestamp of delivery confirmation. |
| `deliveryNotes` | String? | Optional teacher notes on how delivery went. |
| `completionRate` | Float? | Percentage of students who completed the class activity (0–100). |
| `toolUsageLog` | Json? | Structured log of which toolkit tools were opened during the lesson. |
| `classFormat` | String? | "standard", "block_a", "block_b" — the format actually used. |
| `sessionPairId` | String? | UUID linking block_a and block_b sibling sessions (Part 3). |
| `status` | String? | "confirmed", "suggested", "cancelled". |
| `suggestedLabs` | Json? | Array of lab metadata auto-bound at scheduling time (Part 7). |

### PATCH /api/teacher/schedule/[id]/deliver

Guarded by `isLessonDeliveryTrackingEnabled()`.

Request body (all optional except the route param `id`):

```json
{
  "deliveredAt": "2026-03-01T09:00:00Z",
  "deliveryNotes": "Strong engagement during the fraction activity",
  "completionRate": 85,
  "toolUsageLog": { "fraction-visualizer": { "openedAt": "09:12", "closedAt": "09:28" } }
}
```

- `completionRate` must be between 0 and 100 (inclusive) or the request returns 400.
- On success: `isDelivered` is set to `true`, `deliveredAt` defaults to `now()` if not supplied, and a `lesson.delivered` audit event is written.
- Returns `{ ok: true }`.

---

## 4. Part 3: A/B Block Day Intelligence

### Purpose

Many Liberian secondary schools run 90-minute block schedules where subjects alternate on an A/B day pattern (e.g., Math on Monday/Wednesday, English on Tuesday/Thursday). When a lesson's `deliveryProfile` includes a `splitPoint`, the lesson is explicitly designed to span two class sessions. Part 3 auto-creates the sibling session at scheduling time so teachers do not have to manually schedule the second half.

### Pair Logic

Flag: `ENABLE_AB_BLOCK_SCHEDULING`
Function: `isAbBlockSchedulingEnabled()`

A sibling session is created **if and only if** all three conditions hold:

1. `isAbBlockSchedulingEnabled()` returns `true`.
2. `classFormat` is `"block_a"` or `"block_b"` (not `"standard"` or absent).
3. The lesson's `deliveryProfile.splitPoint` is not null/undefined.

When all conditions are met, `POST /api/teacher/schedule`:

1. Generates a `sessionPairId` (random UUID) shared by both the primary and sibling records.
2. Creates the primary record with `classFormat` as supplied and `status: "confirmed"`.
3. Creates a sibling record with the opposite `classFormat` (`block_a` → `block_b`, `block_b` → `block_a`), `status: "suggested"`, the same `sessionPairId`, and `scheduledDate = primaryDate + 2 days`.
4. Returns `{ id, suggestedPair: { id, scheduledDate, classFormat, status } }` in the response body.

The sibling starts as `"suggested"` so the teacher can review and confirm it. If the teacher cancels, the sibling can be deleted independently.

---

## 5. Part 4: Unit Grouping

### Purpose

Individual lessons exist in isolation without a containing structure. Part 4 introduces the `CurriculumUnit` model, allowing curriculum administrators to group related lessons into named multi-week instructional units (e.g., "Fractions Unit — Weeks 3–4"). Teachers can then see lesson delivery progress within the context of a unit.

### CurriculumUnit Model

New Prisma model added in migration:

```prisma
model CurriculumUnit {
  id                   String   @id @default(cuid())
  unitId               String   @unique @default(uuid())
  name                 String
  description          String?
  subject              String
  grade                Int
  schoolId             String
  targetStandardCodes  String[] @default([])
  weekStart            Int      // 1-indexed week number
  weekEnd              Int
  createdById          String
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}
```

`CurriculumContent` gains an optional `unitId` foreign key so lessons can be assigned to a unit.

### Routes

Flag: `ENABLE_UNIT_GROUPING`
Function: `isUnitGroupingEnabled()`

`POST /api/admin/curriculum/units` — create a new unit (ADMIN role required).
Required fields: `name`, `subject`, `grade`, `weekStart`, `weekEnd`.
Optional: `description`, `targetStandardCodes`.

`GET /api/teacher/curriculum/units?grade=&subject=` — list units for the teacher's school, each augmented with a `lessonCount` derived from `CurriculumContent.unitId` group-by.

Tenant isolation: both routes scope all queries to `user.schoolId`.

---

## 6. Part 5: Assignment and Homework Linkage

### Purpose

After a lesson is delivered, teachers need a fast path to assign follow-up homework or a formative quiz. Without tooling, this requires switching to a separate assignment tool, re-entering the lesson context, and manually choosing standards. Part 5 automates this across three pathways.

### Three Pathways

**Pathway A — Manual** (existing, unchanged): teacher manually creates an assignment through the existing assignment routes.

**Pathway B — Auto-Suggest:** when a lesson is scheduled and the lesson's `deliveryProfile.exitTicket.questions` array is non-empty, an `AssignmentSuggestion` record is automatically created with:
- `status: "pending"`
- `suggestedTitle: "Check for Understanding: [lesson title]"`
- `suggestedDueDate: scheduledDate + 1 day`
- `moeStandardCodes` copied from the lesson's `moeAlignments`

Flag: `ENABLE_ASSIGNMENT_LESSON_LINKAGE`
Function: `isAssignmentLessonLinkageEnabled()`

The teacher accepts or dismisses the suggestion via:
- `POST /api/teacher/assignment-suggestions/[id]/accept` — creates an `Assignment` record with `generationMethod: "suggested"` and marks the suggestion `"accepted"`. Returns 400 if the suggestion is not in `"pending"` status.
- `POST /api/teacher/assignment-suggestions/[id]/dismiss` — marks the suggestion `"dismissed"` (no assignment created).

**Pathway C — AI Generate:** teacher requests a fully AI-generated assignment draft from a lesson's content.
`POST /api/teacher/assignments/generate` — accepts `{ scheduledWorkId?, contentId?, classId, assignmentType }`.
Returns a `draft` object with `title`, `questions` (from `generateAssessmentItems()`), `moeStandardCodes`, `contentId`, and `generationMethod: "ai_generated"`. The draft is **not saved** to the database — the teacher reviews and then POSTs it to the assignment create route.

Flag: `ENABLE_AI_ASSIGNMENT_GENERATION`
Function: `isAiAssignmentGenerationEnabled()`
(Meaningful only when `ENABLE_ASSIGNMENT_LESSON_LINKAGE` is also on.)

### AssignmentSuggestion Model

New Prisma model:

```prisma
model AssignmentSuggestion {
  id                String    @id @default(cuid())
  schoolId          String
  contentId         String
  scheduledWorkId   String
  classId           String
  suggestedTitle    String
  suggestedDueDate  DateTime
  moeStandardCodes  String[]  @default([])
  status            String    // "pending" | "accepted" | "dismissed"
  createdAt         DateTime  @default(now())
}
```

`Assignment` gains optional `scheduledWorkId`, `contentId`, `moeStandardCodes`, and `generationMethod` fields to track the linkage.

---

## 7. Part 6: Toolkit Integration

### Purpose

The Classroom Toolkit (introduced in Block 21) provides calculator, science, geometry, timer, and language tools. Previously, the toolkit was accessed via a generic classroom overlay with no awareness of what lesson was being taught. Part 6 connects the toolkit to specific lessons, using the lesson's `deliveryProfile.toolsRequired` to surface exactly the right tools for each lesson phase.

### getToolsForLesson()

New exported function in `lib/toolkit/toolRegistry.ts`:

```typescript
function getToolsForLesson(
  subject: string,
  grade: number,
  lessonType: string,
  toolsRequired?: Array<{ toolKey: string; reason: string; phase: string; required: boolean }>
): LessonToolSet
```

Returns:

```typescript
interface LessonToolSet {
  required: ToolRegistryEntry[];   // toolsRequired where required=true
  optional: ToolRegistryEntry[];   // toolsRequired where required=false
  contextual: ToolRegistryEntry[]; // context-matched tools not in required/optional
}
```

`required` and `optional` come directly from `deliveryProfile.toolsRequired`, filtered against the registry (unknown keys are silently skipped). `contextual` is derived by running `getToolsForContext()` for the lesson's subject, grade band, and lesson type, then excluding any tools already present in required or optional.

### GET /api/teacher/schedule/[id]/tools

Flag: `ENABLE_TOOLKIT_LESSON_INTEGRATION`
Function: `isToolkitLessonIntegrationEnabled()`

Returns `{ required, optional, contextual }` for a specific scheduled lesson. The route resolves the lesson's `grade`, `subject`, and `deliveryProfile.toolsRequired`, then delegates to `getToolsForLesson()`. Access is scoped to the teacher's school (`class.schoolId` check → 403 if mismatch).

---

## 8. Part 7: Virtual Lab System

### Purpose

Science, engineering, and CS lessons benefit from hands-on investigation. In schools with limited physical lab resources, virtual simulation labs provide a digital alternative. Part 7 introduces a complete virtual lab system: a catalogue of platform-managed labs, teacher-initiated session creation, student session tracking, and mastery integration on completion.

### VirtualLab Model

```prisma
model VirtualLab {
  id                   String   @id @default(cuid())
  labId                String   @unique @default(uuid())
  title                String
  description          String?
  subject              String
  grade                Int
  gradeBand            String
  labType              String   // "simulation" | "investigation" | "interactive"
  estimatedMinutes     Int
  difficulty           String   // "beginner" | "intermediate" | "advanced"
  status               String   // "draft" | "published" | "archived"
  schoolId             String?  // null = platform-wide
  moeStandardCodes     String[] @default([])
  triggerStandardCodes String[] @default([])
  payload              Json?
  createdAt            DateTime @default(now())
}
```

`schoolId: null` means the lab is available to all schools. A non-null `schoolId` restricts the lab to that school only.

### LabSession Model

```prisma
model LabSession {
  id               String    @id @default(cuid())
  labId            String
  studentId        String    // User.id of the student
  scheduledWorkId  String?
  schoolId         String
  startedAt        DateTime?
  completedAt      DateTime?
  score            Float?    // 0-100
  observations     String?
  conclusions      String?
  masteryUpdated   Boolean   @default(false)
  createdAt        DateTime  @default(now())
}
```

### Flow

Flag: `ENABLE_VIRTUAL_LABS`
Function: `isVirtualLabsEnabled()`

1. **Auto-match at scheduling time:** when `POST /api/teacher/schedule` is called with virtual labs enabled and the lesson has MOE alignment codes, the route queries `VirtualLab` for published labs matching `triggerStandardCodes` (for the correct grade and school scope). Up to 3 suggested labs are stored in `ScheduledWork.suggestedLabs` (JSON).

2. **Teacher lab listing:** `GET /api/teacher/labs?subject=&grade=` returns published labs accessible to the teacher's school (platform-wide + school-specific).

3. **Lab detail:** `GET /api/teacher/labs/[labId]` returns full lab metadata including `payload`. Returns 403 if the lab is school-specific and belongs to a different school.

4. **Teacher links a lab:** `POST /api/teacher/schedule/[id]/lab` with `{ labId }` creates a `LabSession` row for every student enrolled in the class (`Enrollment.findMany` → `LabSession.createMany`). Returns `{ ok: true, sessionCount: N }`.

5. **Student starts session:** `POST /api/student/labs/[labId]/session` looks up the student's pre-created `LabSession`. If none exists, returns 404 (students cannot self-initiate — the teacher must link the lab first). If found, updates `startedAt` and returns the session.

6. **Student completes session:** `PATCH /api/student/labs/sessions/[sessionId]` with `{ observations?, conclusions?, score?, completedAt? }`. Tenant isolation: session must match `studentId` and `schoolId` or 403. When `completedAt` and `score` are both provided and `masteryUpdated` is false, the route triggers `updateMasteryProfile()` asynchronously (failures are non-fatal — the session still saves). A second `labSession.update` sets `masteryUpdated: true`.

### Seed Labs

The `prisma/seed.ts` file includes a set of platform-wide seed labs covering the priority MOE subjects: MATH G4–9 (number sense, algebra), SCIENCE G7–9 (cell biology, chemistry), COMPUTER_SCIENCE G7–12 (algorithms, circuits). These labs are seeded with `status: "published"` and `schoolId: null`.

---

## 9. Part 8: MOE Compliance Reporting

### Purpose

The Ministry of Education requires evidence that schools are teaching the mandated curriculum, completing the required number of lessons per week, and covering the specified MOE standard codes. Without automated reporting, headteachers and district officers must manually inspect lesson books. Part 8 generates aggregate delivery evidence in real time from the data already captured by Parts 1–7.

### Enhanced Teacher Schedule GET

When `isDeliveryComplianceReportingEnabled()` is true, `GET /api/teacher/schedule` returns 8 additional fields alongside the standard `{ items, classes, weekStart }` response:

| Field | Type | Description |
|---|---|---|
| `moeStandardsCoverage` | string[] | Unique MOE codes present across all scheduled lessons this week |
| `pacingStatus` | string | "on_track" (>=90% delivered) or "behind" (<90% delivered) |
| `plannedVsDelivered` | object | `{ planned: N, delivered: M }` lesson counts |
| `pendingAssignmentSuggestions` | number | Pending suggestions for this school |
| `labSessionsThisWeek` | number | Completed lab sessions linked to this week's schedule |
| `pendingLabSessions` | number | Lab sessions not yet completed |
| `unitProgress` | object[] | Per-unit `{ unitId, unitName, lessonsScheduled, lessonsDelivered }` |
| `unscheduledStandards` | string[] | Reserved for future gap analysis (currently []) |

Each item in `items` also carries the Part 2 delivery tracking fields: `isDelivered`, `deliveredAt`, `completionRate`, `classFormat`, `sessionPairId`, `status`.

### GET /api/admin/compliance/delivery-report

Flag: `ENABLE_DELIVERY_COMPLIANCE_REPORTING`
Auth: ADMIN role

Query params: `?schoolId=&weekOf=`

Tenant isolation:
- Non-platform-admin: `schoolId` param is ignored if supplied but does not match `user.schoolId` → 403.
- Platform-admin: `schoolId` param is required → 400 if missing.

Response fields (no student identifiers at any level):

```json
{
  "plannedLessons": 12,
  "deliveredLessons": 9,
  "deliveryRate": 0.75,
  "moeStandardsCovered": ["MATH-G6-ALG-01", "SCI-G8-LIF-01"],
  "labSessionsCompleted": 5,
  "assignmentsLinked": 3
}
```

`moeStandardsCovered` reflects only standards from **delivered** lessons (not merely scheduled), ensuring the report represents actual classroom activity rather than intent.

---

## 10. Feature Flags Reference

All flags are read at call-time from `process.env`. Set to `"true"` to enable; any other value (or absent) means disabled.

| Flag | Function | Default | Part |
|---|---|---|---|
| `ENABLE_DELIVERY_PROFILE` | `isDeliveryProfileEnabled()` | OFF | 1 |
| `ENABLE_LESSON_DELIVERY_TRACKING` | `isLessonDeliveryTrackingEnabled()` | OFF | 2 |
| `ENABLE_AB_BLOCK_SCHEDULING` | `isAbBlockSchedulingEnabled()` | OFF | 3 |
| `ENABLE_UNIT_GROUPING` | `isUnitGroupingEnabled()` | OFF | 4 |
| `ENABLE_ASSIGNMENT_LESSON_LINKAGE` | `isAssignmentLessonLinkageEnabled()` | OFF | 5 |
| `ENABLE_AI_ASSIGNMENT_GENERATION` | `isAiAssignmentGenerationEnabled()` | OFF | 5 (Pathway C) |
| `ENABLE_TOOLKIT_LESSON_INTEGRATION` | `isToolkitLessonIntegrationEnabled()` | OFF | 6 |
| `ENABLE_VIRTUAL_LABS` | `isVirtualLabsEnabled()` | OFF | 7 |
| `ENABLE_DELIVERY_COMPLIANCE_REPORTING` | `isDeliveryComplianceReportingEnabled()` | OFF | 8 |

Recommended activation order for a school rollout:

1. Enable Part 2 first (delivery tracking) — low risk, high data value.
2. Enable Part 8 (compliance reporting) — requires Part 2 data to be useful.
3. Enable Part 1 (delivery profile) — requires AI token budget headroom.
4. Enable Part 3 (A/B block) — only needed for block-schedule schools.
5. Enable Part 5 (assignment linkage) — enable Pathway B before Pathway C.
6. Enable Part 6 (toolkit integration) — requires `ENABLE_CLASSROOM_TOOLKIT` also set.
7. Enable Part 4 (unit grouping) — can be enabled at any time.
8. Enable Part 7 (virtual labs) — enable after seed labs are seeded.

---

## 11. API Reference

| Method | Path | Flag | Auth | Description |
|---|---|---|---|---|
| PATCH | `/api/teacher/schedule/[id]/deliver` | `ENABLE_LESSON_DELIVERY_TRACKING` | TEACHER, ADMIN | Mark a lesson as delivered |
| GET | `/api/teacher/schedule/[id]/tools` | `ENABLE_TOOLKIT_LESSON_INTEGRATION` | TEACHER, ADMIN | Get required/optional/contextual tools for a lesson |
| POST | `/api/teacher/schedule/[id]/lab` | `ENABLE_VIRTUAL_LABS` | TEACHER, ADMIN | Link a virtual lab and create student sessions |
| POST | `/api/admin/curriculum/units` | `ENABLE_UNIT_GROUPING` | ADMIN | Create a curriculum unit |
| GET | `/api/teacher/curriculum/units` | `ENABLE_UNIT_GROUPING` | TEACHER, ADMIN | List curriculum units with lesson counts |
| POST | `/api/teacher/assignment-suggestions/[id]/accept` | `ENABLE_ASSIGNMENT_LESSON_LINKAGE` | TEACHER, ADMIN | Accept a pending assignment suggestion |
| POST | `/api/teacher/assignment-suggestions/[id]/dismiss` | `ENABLE_ASSIGNMENT_LESSON_LINKAGE` | TEACHER, ADMIN | Dismiss a pending assignment suggestion |
| POST | `/api/teacher/assignments/generate` | `ENABLE_AI_ASSIGNMENT_GENERATION` | TEACHER, ADMIN | AI-generate assignment draft (not saved) |
| GET | `/api/teacher/labs` | `ENABLE_VIRTUAL_LABS` | TEACHER, ADMIN | List published virtual labs for school |
| GET | `/api/teacher/labs/[labId]` | `ENABLE_VIRTUAL_LABS` | TEACHER, ADMIN | Get full lab detail |
| POST | `/api/student/labs/[labId]/session` | `ENABLE_VIRTUAL_LABS` | STUDENT | Start a pre-created lab session |
| PATCH | `/api/student/labs/sessions/[sessionId]` | `ENABLE_VIRTUAL_LABS` | STUDENT | Update lab session; triggers mastery on completion |
| GET | `/api/admin/compliance/delivery-report` | `ENABLE_DELIVERY_COMPLIANCE_REPORTING` | ADMIN | MOE aggregate delivery evidence report |

All routes that return 404 when their flag is OFF do so **before** calling `requireRole`, so unauthenticated requests to disabled routes receive 404, not 401 — preventing feature enumeration.

Enhanced fields on existing routes (no new flag required for existing route to function; flag gates only the extra fields):

| Method | Path | Flag | Enhancement |
|---|---|---|---|
| GET | `/api/teacher/schedule` | `ENABLE_DELIVERY_COMPLIANCE_REPORTING` | +8 compliance fields in response |
| POST | `/api/teacher/schedule` | `ENABLE_AB_BLOCK_SCHEDULING` | `suggestedPair` in response |
| POST | `/api/teacher/schedule` | `ENABLE_ASSIGNMENT_LESSON_LINKAGE` | Auto-creates `AssignmentSuggestion` |
| POST | `/api/teacher/schedule` | `ENABLE_VIRTUAL_LABS` | `suggestedLabs` bound to created record |

---

## 12. Migration Strategy

All database changes are additive (no columns dropped, no types changed). Migrations use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS` patterns to be safe for concurrent rollout.

New tables added:

- `CurriculumUnit` — unit grouping container
- `AssignmentSuggestion` — auto-suggested post-lesson assignments
- `VirtualLab` — virtual lab catalogue
- `LabSession` — per-student lab session records

New columns on `ScheduledWork`:

- `isDelivered BOOLEAN NOT NULL DEFAULT FALSE`
- `deliveredAt TIMESTAMPTZ`
- `deliveryNotes TEXT`
- `completionRate FLOAT`
- `toolUsageLog JSONB`
- `classFormat TEXT`
- `sessionPairId TEXT`
- `status TEXT`
- `suggestedLabs JSONB`

New columns on `CurriculumContent`:

- `deliveryProfile JSONB` — stores the structured delivery guide generated by the AI factory
- `unitId TEXT` — optional foreign key to `CurriculumUnit.unitId`

New columns on `Assignment`:

- `scheduledWorkId TEXT` — links assignment back to the lesson that triggered it
- `contentId TEXT`
- `moeStandardCodes TEXT[]`
- `generationMethod TEXT` — "manual" | "suggested" | "ai_generated"

Migration SQL files are located in `prisma/migrations/` and follow the naming convention `YYYYMMDD_HHMMSS_description.sql`. Production migrations are applied by the ops team during a scheduled maintenance window using Supabase's migration tooling. All indexes use `CREATE INDEX CONCURRENTLY IF NOT EXISTS` to avoid table locks.

**Rollback plan:** each new column is nullable or has a safe default, and each new table has no FK constraints that would block deletion. In the event of rollback, setting all ILDE feature flags to `"false"` immediately disables all new behaviour without requiring a schema change. Schema rollback is a separate, lower-urgency operation.

---

*MOE Readiness Statement:* The Integrated Lesson Delivery Engine provides the data infrastructure required for the MOE to monitor lesson delivery fidelity at the school, district, and national level without requiring manual reporting from teachers. The compliance report route (`GET /api/admin/compliance/delivery-report`) is the designated integration point for MOE district officer dashboards and national aggregation pipelines. All data returned is aggregate; no student identifiers are exposed at any reporting tier.

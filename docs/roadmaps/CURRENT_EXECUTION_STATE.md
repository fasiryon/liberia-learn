# CURRENT EXECUTION STATE

## Purpose
Live execution tracking for the final closeout program.

## Resume here

- **Canonical plan:** `docs/roadmaps/NATIONAL_ROLLOUT_EXECUTION_PLAN.md`
- **Escalation contract:** `docs/agents/ADVISOR_ESCALATION_CONTRACT.md`
- **Next national sprint:** NR-3, Load-Test Identity Pool, the first `PENDING`
  row in the canonical plan
- **Pre-NR-3 verification:** confirm the live production `DATABASE_URL` uses
  the pooled endpoint before accepting NR-1's historical completion claim
- **Teaching Runtime v1:** all 16 tasks merged to `main` at `61bc3279`;
  production remains disabled until deliberate release approval and
  real-device Whisper push verification
- **Mobile audit:** validated commit `d8da8453` is in `main`; six later
  follow-up paths failed the required full gate and were explicitly discarded
- **Stale worktrees:** mobile-audit and load-test-validation worktrees were
  removed after their merged/equivalent committed work was verified
- **Unattended loop:** design agreed in principle, driver not built; do not
  imply that pending sprints are running automatically
- **Execution limit:** one sprint per unattended cycle, then stop and report
- **Gate trust:** independently re-derive at least one concrete claim from live
  state at every reported success gate

Pending work outside the NR sprint index:

- confirm Supabase, ElevenLabs, Fal.ai, and curriculum daily-budget status
  before paid generation; ElevenLabs balance and pricing require independent
  verification before audio spend
- ask FA whether the drafted Minister Jarso Jallah outreach was ever sent
- re-verify the production homework and labs pipeline counts before relying on
  the stale readiness brief
- keep managed-device deployment deferred until a real pilot's hardware and IT
  constraints are known
- Curriculum Health / Content Lifecycle Agent remains queued as
  detect-and-propose only, with irreversible actions routed to escalation

Historical detail follows. Use the block above to resume; do not scan the
historical sections to select work.

## AI Teaching Runtime v1 (completed 2026-07-29)
- **Plan:** `docs/superpowers/plans/2026-07-28-teaching-runtime-v1.md`
- **Final report:** `docs/audits/TEACHING_RUNTIME_V1_FINAL_REPORT.md`
- **Branch:** `feat/teaching-runtime-v1`
- **Status:** Tasks 1 through 16 COMPLETE and merged to `main` at `61bc3279`
- **Preview:** `https://liberia-learn-m35foesnv-farquema-siryons-projects.vercel.app`
- **Production flag:** remains disabled
- **Sprint scope:** 41 files covering additive persistence, alignment and
  pacing, the governed agent and tools, atomic turn orchestration, offline
  recovery, four tenant-scoped APIs, ledger generation, cost measurement,
  tests, and final certification
- **Final merge gate:** Prisma PASS; TypeScript PASS with 6144 MB heap; Vitest
  PASS (4,409 tests / 537 files); build PASS
- **Task 15 measured cost:** aligned 50-turn session $0.032309; unaligned
  50-turn session $0.013708
- **Task 16 walkthrough:** aligned 10 turns / 1 deferral / WORKSHEET recovery;
  unaligned 10 turns / 5 deferrals; Whisper tool persisted; both ledgers saved
- **Runtime issue closed:** teaching tool argument aliases are normalized before
  strict validation, exact tool schemas are reinforced in the prompt, and
  fail-closed agent errors return structured 503 responses
- **Final review hardening:** Whisper and out-of-scope tools require the model
  target to match the active invocation's session trace; Whisper also verifies
  facilitator and school before reading or sending. Degraded mode can be
  recorded only while a session is active.
- **Production feature flag check:** Vercel production has no
  `AGENT_TEACHING_RUNTIME_ENABLED` variable, so the runtime remains disabled by
  default.
- **Next step:** keep the production feature flag off pending a deliberate
  release and live push-device verification.

### Mobile audit handoff included with final cycle summary
- Validated commit `d8da8453` is an ancestor of `main`.
- Its recorded gate is TypeScript PASS, Vitest PASS (1,541 tests / 204 files),
  build PASS, and encoding repair PASS.
- Six later follow-up paths were reviewed on current `main`. Focused tests
  passed 10/10 and TypeScript passed, but the required unmodified full suite
  failed on unrelated five-second timeout tests and exceeded the command
  ceiling. The follow-ups were therefore not committed and were explicitly
  discarded. The stale worktree and redundant local branch were removed.

## National Rollout Program (active)
- **Plan:** `docs/roadmaps/NATIONAL_ROLLOUT_EXECUTION_PLAN.md`
- **Current sprint:** NR-2 — ECS Worker Autoscale + Queue SLOs
- **Status:** NR-2 COMPLETE (2026-05-18). Re-verified live against AWS on 2026-07-28 after the sprint index table was found marking it PENDING (a stale table, not a real regression): ECS service `liberia-learn-worker` ACTIVE 1/1, autoscaling target `service/liberia-learn/liberia-learn-worker` min1/max10 with a target-tracking policy on `ApproximateNumberOfMessagesVisible` for `liberialearn-jobs.fifo` at target 50 (scale-out 30s / scale-in 120s), both `liberialearn-jobs.fifo` and its DLQ present. Sprint index table corrected to match.
- **Target:** World-class national rollout (all Liberia) — 22 sprints NR-0 through NR-21
- **Next sprint:** NR-3 — Load-Test Identity Pool (per the plan's actual NR-3 definition). Note: this line previously read "DATABASE_URL Port Fix + PgBouncer Validation", which does not match any defined NR-3 scope in the plan. That item traces back to a real open finding from NR-0/NR-1 ("DATABASE_URL: port 5432 with pgbouncer=true, MISCONFIGURED, needs 6543 for actual pooling") that was never confirmed fixed or folded into a numbered sprint. Flagged here, not silently resolved: verify current Vercel production DATABASE_URL port before NR-3 starts, since NR-1 (marked COMPLETE) lists pooled DATABASE_URL as one of its own deliverables.

### NR-0 + NR-1 Complete (2026-05-18)
Key findings:
- DB: 311 MB, 315 users, 9 schools, 4,363 approved lessons, 3,900 (89%) without audio
- DATABASE_URL: port 5432 with pgbouncer=true → MISCONFIGURED (needs 6543 for actual pooling)
- Curriculum: 62/96 cells at national gate (≥15); 34 zero-lesson deserts; ENGLISH only G5+G7, CS only G5, ENGINEERING_FOUNDATIONS completely empty
- Upstash hard-fail: DONE (lib/rateLimit.ts throws in prod if env vars absent)
- assertProductionEnv() startup check: DONE (lib/startup-checks.ts + app/instrumentation.ts)
- ECS decision: REBUILD-NR2 — 16+ live SQS callers, no consumer running; enqueueJob() now logs explicitly
- feat/phase-5-intelligence-system: DELETED (0 commits ahead of main)
- Build route conflict fixed: [id]/regenerate-audio merged into [contentId]/regenerate-audio
- Build requires NODE_OPTIONS=--max-old-space-size=6144 locally; Vercel CI builds fine

### NR-2 Complete (2026-05-18) — ECS Worker Autoscale + Queue SLOs
Infrastructure provisioned:
- ECS cluster `liberia-learn`: ACTIVE (us-east-1)
- Task definition `liberia-learn-worker:1`: registered (512 CPU / 1024 MB, FARGATE_SPOT weight 4)
- ECS service `liberia-learn-worker`: RUNNING (1/1 tasks at steady state)
- Autoscaling: min 1 / max 10 tasks, target 50 SQS messages, scale-out 30s / scale-in 120s
- SQS queue: `liberialearn-jobs.fifo` (VisibilityTimeout 300s confirmed)
- SQS DLQ: `liberialearn-jobs-dlq.fifo` (maxReceiveCount 3)
- SSM parameters: DATABASE_URL, DIRECT_URL, OPENAI_API_KEY, SQS_QUEUE_URL, SQS_DLQ_URL
- IAM: ecsTaskExecutionRole + AmazonECSTaskExecutionRolePolicy + ECR read + SSM read
- Flood test: 200 HEALTH_CHECK messages sent; queue drained; scale-out observed
Code changes:
- lib/queue.ts: HEALTH_CHECK enum added
- worker/handlers/index.ts: HEALTH_CHECK handler + safe default + noop for unimplemented types
- scripts/flood-test-queue.ts: created
- infra/ecs/worker-task-definition.json: created
- docs/ops/WORKER_DEPLOYMENT.md: updated with actual NR-2 values
Gate: prisma generate PASS, tsc PASS, vitest PASS (3,093 tests / 383 files), build PASS

NR-3 input:
1. Fix DATABASE_URL in Vercel: change port 5432 → 6543 + confirm pgbouncer=true (connection exhaustion risk at scale)
2. Add remaining SSM parameters (ELEVENLABS_API_KEY, ANTHROPIC_API_KEY, AFRICASTALKING_API_KEY, etc.)
3. Confirm worker drains backlog accumulated during ECS-dark period
4. NR-14: Audio pipeline for 3,900 no-audio lessons (GENERATE_LESSON_AUDIO worker handler)
5. NR-13: ENGLISH (10 deserts), CS (11 deserts), ENGINEERING_FOUNDATIONS (12 deserts)

## Fix 1 — Connection Pool (connection_limit=1)
- `lib/db.ts` now injects `connection_limit=1` into the database URL programmatically if not already present.
- `prisma/schema.prisma` datasource has both `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")`.
- **DATABASE_URL** must be the Supabase PgBouncer pooled URL (port 6543, pgbouncer=true in query string).
- **DIRECT_URL** must be the direct Postgres URL (port 5432, no pgbouncer param) — used by Prisma Migrate.
- `connection_limit=1` prevents connection exhaustion in serverless (each function instance uses 1 connection via PgBouncer).

## Phase 5.1.6 Curriculum Reliability Closure
- Current sprint: Phase 5.1.6 Curriculum Reliability Closure
- Current branch: `feat/phase-5-1-5-production-validation`
- Status: COMPLETE. Long-lesson elite upgrade reliability, platform-authoritative scoring alignment, and stable admin review evidence were closed on the existing curriculum upgrade path.
- Scope: fix only the known Phase 5.1.5 blockers. No new AI route, prompt registry system, curriculum model, or governance workflow was added.
- Root cause closed:
  - long real lessons were sending overly large source payloads into the elite prompt, increasing truncation/invalid JSON risk
  - parser and repair handling allowed malformed output retries but were still too brittle for some truncated long responses
  - review validation relied on brittle browser assertions instead of the stable review and approval surfaces already present
- Closure changes:
  - elite prompt input is now compacted to the curriculum fields needed for upgrade quality
  - elite parsing now requires the full reviewable lesson section set so partial JSON cannot count as success
  - retries and repair are bounded and elite-only, with compact fallback repair instructions for long lessons
  - platform content scoring remains authoritative; model self-scores are preserved as audit metadata only
  - review UI shows score source, model self-score, section improvements, and gold-standard status
  - Playwright validation supports exact lesson selection, stable dashboard waits, and approval fallback through the existing route
- Targeted validation:
  - single long lesson rerun: `math-g12-8-problem-solving-and-review-assessment-and-reflection` PASS
  - focused 10-lesson representative rerun batch: PASS
  - single-lesson admin approval + MOE visibility walkthrough: PASS
- Final gate:
  - `npx prisma generate`: PASS
  - `npx tsc --noEmit`: PASS
  - `npm test`: PASS (1976 tests, 280 files)
  - `npm run build`: PASS
  - `npx playwright test`: PASS (12 tests)

## AI Labs V1 Current State
- Current workstream: AI Labs V1
- Current phase: Phase 5 Batch 4 Earth Science Labs COMPLETE. All 12 labs live.
- Current branch: `main`
- Worktree status: Phase 5 Batch 4 committed, pushed, deployed, and verified on production.
- Last completed phase: AI Labs V1 Phase 5 Batch 4 - Earth Science Labs
- Last commit reference: `ee8dd3f feat(labs): complete phase 5 batch 4 earth science labs`

## AI Labs V1 Phase 2 Validation
- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test`: PASS (1843 tests, 256 files)
- `npm run build`: PASS (exit 0)
- Gravity scene dynamic chunks: PASS (`2232...js` 2.3 KB fallback, `7704...js` 3.2 KB scene; both under 200 KB)

## AI Labs V1 Phase 2 Deliverables
| Feature | Route / File | Notes |
|---------|--------------|-------|
| Gravity lab state/actions | `lib/labs/gravity-explorer/` | Typed state, action union, deterministic runtime, validator |
| Lab registry entry | `lib/labs/registry.ts` | `gravity-explorer`, tier 1, Physics Grades 7-9 |
| Runtime dispatch | `lib/labs/runtime/*` | Gravity apply/validate dispatchers wired |
| Canvas scene | `components/labs/gravity-explorer/Scene.tsx` | 2D animation, trail, velocity color, readout, controls |
| Low-end fallback | `components/labs/gravity-explorer/Fallback.tsx` | 2D canvas fallback with height bar and controls |
| Lab page | `/student/labs/gravity-explorer` | Student-only route with lab open telemetry |
| Lesson integration | `/student/lessons/[id]` | Physics Grades 7-9 shows slide-over "Open Gravity Lab" entry point |
| AI loop | `/api/labs/gravity-explorer/plan`, `/api/labs/gravity-explorer/explain` | Planner validates actions, frontend applies runtime state, explainer returns tutor text |
| Tests | `__tests__/labs/` | Gravity runtime and validator coverage added |

## AI Labs V1 Phase 3 Deliverables
| Feature | Route / File | Notes |
|---------|--------------|-------|
| Pendulum Lab partial | `lib/labs/pendulum-lab/` | Typed state/actions/runtime/validator only; tier 1; partial registry entry |
| Molecule Motion partial | `lib/labs/molecule-motion/` | Typed state/actions/runtime/validator only; tier 1; partial registry entry |
| Human Heart Simulator partial | `lib/labs/human-heart/` | Typed state/actions/runtime/validator only; tier 2; partial registry entry |
| Registry count | `lib/labs/registry.ts` | 4 registered labs total: Gravity complete + 3 partial labs |
| Runtime dispatch | `lib/labs/runtime/*` | Apply/validate dispatchers wired for all 4 registered labs |
| Tests | `__tests__/labs/` | Pendulum, Molecule Motion, and Human Heart runtime coverage added |

## AI Labs V1 Phase 4 Deliverables
| Feature | Route / File | Notes |
|---------|--------------|-------|
| Pendulum Lab complete | `/student/labs/pendulum-lab` | 2D canvas pendulum scene, low-end fallback, LabShell AI loop, lesson slide-over entry |
| Molecule Motion complete | `/student/labs/molecule-motion` | 2D particle scene with phase transitions, low-end fallback, LabShell AI loop, lesson slide-over entry |
| Human Heart complete | `/student/labs/human-heart` | 2D heart chamber pulse scene, low-end fallback, LabShell AI loop, lesson slide-over entry |
| Lesson integration | `/student/lessons/[id]` | Physics 7-9: Gravity + Pendulum; Chemistry 9-11: Molecule Motion; Biology 8-10: Human Heart |
| Labs index | `/student/labs` | Registered labs shown as cards with Open Lab actions and coming-soon handling |
| Registry status | `lib/labs/registry.ts` | 4 registered complete labs; no Phase 3 partial flags remain |

## AI Labs V1 Phase 4 Validation
- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test`: PASS (1864 tests, 259 files)
- `npm run build`: PASS (exit 0)
- Live production route verification: PASS for `/student/labs/pendulum-lab`, `/student/labs/molecule-motion`, `/student/labs/human-heart`
- Live production AI loop verification: PASS for Pendulum `SET_LENGTH`, Molecule Motion `SET_TEMPERATURE`, Human Heart `SET_EXERCISE_LEVEL`
- Live 375px canvas verification: PASS for all three labs
- Live lesson slide-over integration verification: PASS for Physics/Pendulum, Chemistry/Molecule, Biology/Heart

## AI Labs V1 Phase 5 Batch 1 Deliverables
| Feature | Route / File | Notes |
|---------|--------------|-------|
| Electric Circuit Builder | `/student/labs/electric-circuit` | 2D canvas circuit scene, low-end fallback, LabShell AI loop, registry/runtime/validator wiring, lesson slide-over entry |
| Wave Motion Lab | `/student/labs/wave-motion` | 2D transverse/longitudinal wave scene, low-end fallback, LabShell AI loop, registry/runtime/validator wiring, lesson slide-over entry |
| Lesson integration | `/student/lessons/[id]` | Physics Grades 9-11 shows Open Circuit Lab; Physics Grades 10-12 shows Open Wave Lab |
| Registry status | `lib/labs/registry.ts` | 6 registered complete labs |

## AI Labs V1 Phase 5 Batch 1 Validation
- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test`: PASS (1883 tests, 263 files)
- `npm run build`: PASS (exit 0)
- Electric Circuit scene chunk: PASS (`1782...js` 4.3 KB scene; fallback `9453...js` 1.3 KB; both under 200 KB)
- Wave Motion scene chunk: PASS (`7569...js` 4.6 KB scene; fallback `1163...js` 1.5 KB; both under 200 KB)
- Live production route verification: PASS for `/student/labs/electric-circuit` and `/student/labs/wave-motion`
- Live production AI loop verification: PASS for Electric Circuit `SET_VOLTAGE` and Wave Motion `SET_AMPLITUDE`
- Live lesson slide-over integration verification: PASS by lesson mapping for Physics Grades 9-11 Circuit and Grades 10-12 Wave
- Production deploy: PASS, aliased to `https://liberia-learn.vercel.app`
- GitHub Actions on latest main: PASS, all 4 workflows green (`PR Triage`, `Runtime Gate 1`, `Deploy ECS Images`, `CI`)

## AI Labs V1 Phase 5 Batch 2 Deliverables
| Feature | Route / File | Notes |
|---------|--------------|-------|
| Cell Division Explorer | `/student/labs/cell-division` | 2D canvas mitosis stage scene, low-end fallback, LabShell AI loop, registry/runtime/validator wiring, lesson slide-over entry |
| Ecosystem Balance Lab | `/student/labs/ecosystem-balance` | 2D ecosystem terrain, drought overlay, population history graph, stable trophic runtime, low-end fallback, LabShell AI loop, lesson slide-over entry |
| Lesson integration | `/student/lessons/[id]` | Biology Grades 9-11 shows Open Cell Division Lab; Biology Grades 7-9 shows Open Ecosystem Lab |
| Registry status | `lib/labs/registry.ts` | 8 registered complete labs |

## AI Labs V1 Phase 5 Batch 2 Validation
- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test`: PASS (1896 tests, 265 files)
- `npm run build`: PASS (exit 0)
- Cell Division route chunk: PASS (`page-90a8436f27732e2e.js` 9.13 KB; under 200 KB)
- Ecosystem Balance route chunk: PASS (`page-9177738ea74b4baa.js` 9.54 KB; under 200 KB)
- Ecosystem stability test: PASS, 200 STEP iterations keep plants, herbivores, and carnivores above zero
- Live production route verification: PASS for `/student/labs/cell-division` and `/student/labs/ecosystem-balance`
- Live production AI loop verification: PASS for Cell Division `ADVANCE_STAGE` to metaphase and Ecosystem Balance `ADD_DROUGHT`
- Live lesson slide-over integration verification: PASS by lesson mapping for Biology Grades 9-11 Cell Division and Grades 7-9 Ecosystem
- Production deploy: PASS, aliased to `https://liberia-learn.vercel.app`
- GitHub Actions on latest main: PASS, all 4 workflows green (`PR Triage`, `Runtime Gate 1`, `Deploy ECS Images`, `CI`)

## AI Labs V1 Phase 5 Batch 3 Deliverables
| Feature | Route / File | Notes |
|---------|--------------|-------|
| Chemical Reaction Lab | `/student/labs/chemical-reaction` | 2D canvas reaction vessel, molecule/collision animation, catalyst and temperature controls, LabShell AI loop, registry/runtime/validator wiring, lesson slide-over entry |
| Periodic Table Explorer | `/student/labs/periodic-table` | 118-element dataset, 2D table/Bohr/properties canvas views, low-end fallback, LabShell AI loop, registry/runtime/validator wiring, lesson slide-over entry |
| Lesson integration | `/student/lessons/[id]` | Chemistry Grades 10-12 shows Open Reaction Lab; Chemistry Grades 9-12 shows Open Periodic Table Lab |
| Registry status | `lib/labs/registry.ts` | 10 registered complete labs |

## AI Labs V1 Phase 5 Batch 3 Validation
- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test`: PASS (1912 tests, 268 files)
- `npm run build`: PASS (exit 0)
- Periodic element data accuracy test: PASS, all 118 elements present with required fields and reference checks for H, C, Au, and Og
- Chemical Reaction bundle: PASS (`page-59f173b864b25351.js` 9.25 KB route; `5729...js` 6.02 KB scene; `6503...js` 1.67 KB fallback; all under 200 KB)
- Periodic Table bundle: PASS (`2578...js` 35.91 KB page/data; `5226...js` 6.76 KB scene; `4298...js` 2.28 KB fallback; all under 200 KB)
- Live production route verification: PASS for `/student/labs/chemical-reaction` and `/student/labs/periodic-table`
- Live production AI loop verification: PASS for Chemical Reaction `ADD_CATALYST` and Periodic Table `HIGHLIGHT_CATEGORY`
- Live lesson slide-over integration verification: PASS by lesson mapping for Chemistry Grades 10-12 Reaction and Grades 9-12 Periodic Table
- Production deploy: PASS, aliased to `https://liberia-learn.vercel.app`
- GitHub Actions on latest main: PASS, all 4 workflows green (`PR Triage`, `Runtime Gate 1`, `Deploy ECS Images`, `CI`)

## AI Labs V1 Phase 5 Batch 4 Deliverables
| Feature | Route / File | Notes |
|---------|--------------|-------|
| Weather System Lab | `/student/labs/weather-system` | 2D canvas weather scene, cloud/precipitation animation, wet/dry season controls, LabShell AI loop, registry/runtime/validator wiring, lesson slide-over entry |
| Tectonic Plates Lab | `/student/labs/tectonic-plates` | 2D cross-section plate boundary scene, pressure/risk model, earthquake/eruption events, LabShell AI loop, registry/runtime/validator wiring, lesson slide-over entry |
| Lesson integration | `/student/lessons/[id]` | Earth Science Grades 7-9 shows Open Weather Lab; Earth Science Grades 8-10 shows Open Tectonic Plates Lab |
| Labs index | `/student/labs` | All 12 labs grouped by subject with no coming-soon placeholders |
| Registry status | `lib/labs/registry.ts` | 12 registered complete labs |

## AI Labs V1 Phase 5 Batch 4 Validation
- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test`: PASS (1932 tests, 270 files)
- `npm run build`: PASS (exit 0)
- Weather System bundle: PASS (`page-cde9bf16fb09ee4c.js` 8.99 KB route; `7752...js` 6.12 KB scene; `5608...js` 1.17 KB fallback; all under 200 KB)
- Tectonic Plates bundle: PASS (`page-82b23ee6724325a5.js` 9.33 KB route; `6618...js` 6.85 KB scene; `2000...js` 1.54 KB fallback; all under 200 KB)
- Live production route verification: PASS for `/student/labs/weather-system` and `/student/labs/tectonic-plates`
- Live production AI loop verification: PASS for Weather System `SIMULATE_STORM` and Tectonic Plates `SET_BOUNDARY_TYPE`
- Live labs index verification: PASS, `/student/labs` shows all 12 labs grouped by Physics, Biology, Chemistry, and Earth Science with no coming-soon placeholders
- Production deploy: PASS, aliased to `https://liberia-learn.vercel.app`
- GitHub Actions on latest main: PASS, all 4 workflows green (`PR Triage`, `Runtime Gate 1`, `Deploy ECS Images`, `CI`)

## Current workstream
Phase 5 Production Intelligence + Curriculum System

## Current sprint or phase
Phase 5 Phase 6 final gate in progress. Phases 0-5 are implemented and individually gated; Phase 6 integrity audit, generic lesson multimedia parity, and final Playwright coverage are being validated.

## Current branch
feat/phase-5-intelligence-system

## Phase 4.5 Demo Access
- Student: `<E2E_DEMO_STUDENT_EMAIL>` / `<DEMO_PASSWORD>` lands on `/dashboard`; first click `/student/today`; seeded lesson `/student/lessons/cha-demo-student1-multimedia-lesson`.
- Teacher: `<E2E_DEMO_TEACHER_EMAIL>` / `<DEMO_PASSWORD>` lands on `/teacher`; first click curriculum lesson management and video upload.
- Guardian: `<E2E_DEMO_GUARDIAN_EMAIL>` / `<DEMO_PASSWORD>` lands on `/guardian`; sees linked student Fatu Kollie.
- School Admin: `<E2E_DEMO_ADMIN_EMAIL>` / `<DEMO_PASSWORD>` lands on `/admin`; first click curriculum/audio tools and analytics.
- Platform Admin: `platform.admin@liberialearn.org` / `<DEMO_PASSWORD>` lands on `/platform`; sees platform operations surfaces.
- MOE Official: `<E2E_DEMO_MOE_EMAIL>` / `<DEMO_MOE_PASSWORD>` lands on `/moe/dashboard`; sees national analytics.

## Phase 4.5 Seeded Data Summary
- CHA school, Grade 9A Mathematics class, teacher, student, guardian, admin, MOE official, and platform admin are upserted by `npm run seed:cha`.
- Stable lesson: `Ratios in Market Prices`, content id `cha-g9-math-multimedia-demo`, scheduled work id `cha-demo-student1-multimedia-lesson`.
- Student surfaces include `/student/today`, `/student/exams`, `/student/certificates`, and `/student/textbooks`.
- Seed includes a published Grade 9 ratios exam, one lesson certificate, and multimedia learning events for Read, Slides, Listen, audio, and video analytics.

## Phase 4.5 Completion Summary
| Area | Status | Notes |
|------|--------|-------|
| Student navigation | COMPLETE | Exams, certificates, and textbooks routes resolve to real pages; textbooks no longer collides with `/student/[id]`; sidebar uses an accessible book icon. |
| Demo system | COMPLETE | `DEMO_ACCESS.md` documents student, teacher, guardian, school admin, platform admin, and MOE official accounts with first-click guidance. |
| MOE/Admin analytics | COMPLETE | Real aggregation from `LearningEvent`, `LessonAudio`, and `LessonVideo` powers lesson mode usage, engagement, audio usage, video usage, and cost summaries. |
| Audio system | COMPLETE | Admin curriculum page can batch queue approved lessons, process pending jobs, show status, and expose cost/status aggregation. |
| Video system | COMPLETE | Teacher uploads a generated WebM test clip, activates it, and student lesson playback shows the active video in production. Missing Supabase storage config falls back only for playable demo storage; real upload errors still fail. |
| Homepage hero | COMPLETE | Desktop hero layout rebalanced while maintaining 375px mobile quality. |
| Reviewer flow | COMPLETE | Production Playwright verifies student, teacher, admin, MOE, guardian, and platform admin first-click walkthroughs. |
| Cleanup | COMPLETE | `.git-temp-phase1` removed; `.git-temp-sprint2` absent; `.git-temp*`, `node_modules`, and `e2e/screenshots` covered by `.vercelignore`. |

## Phase 4.5 Production Validation
- `npm run seed:cha`: PASS; all six demo accounts upserted in the production-backed database.
- `npx prisma generate`: PASS.
- `npx tsc --noEmit`: PASS (0 errors).
- `npm test`: PASS (1951 tests, 274 files).
- `npm run build`: PASS (208 static pages; existing Sentry/OpenTelemetry warnings only).
- `npx playwright test`: PASS (6 production reviewer-flow tests).
- Production deploy: PASS, aliased to `https://liberia-learn.vercel.app`; deployment `dpl_APMaYiszSzo9V4JCkfuqAwwucQqk`.

## Phase 4.6 Completion Summary
| Area | Status | Notes |
|------|--------|-------|
| Student flow breaks | COMPLETE | Certificates and progress now expose clear `Back to Dashboard` navigation to `/dashboard`; stale `/student/dashboard` links were corrected. |
| Today experience | COMPLETE | `/student/today` is a real daily-flow page with ordered subjects, current/next lesson, completed/remaining counts, and Continue/Quiz/Lab quick actions. |
| Lesson navigation structure | COMPLETE | Today CTAs now land on `/student/today`; My Lessons remains a catalog/library destination only. |
| CTA/route consistency | COMPLETE | Student primary CTAs, dead `href="#"` states, MOE export disabled actions, and legacy student dashboard links were audited and corrected. |
| Homepage upgrade | COMPLETE | Old numeric metric block was replaced with six capability proof blocks: curriculum delivery, AI tutoring, offline-first access, national oversight, teacher tools, and student outcomes. |
| Playwright flow validation | COMPLETE | `e2e/flow-integrity.spec.ts` validates student Today routing, Continue lesson, certificates/progress dashboard return, homepage capability blocks, and 375px no-overflow. |

## Phase 4.6 Production Validation
- `npm run seed:cha`: PASS; all six demo accounts upserted in the production-backed database.
- `npx prisma generate`: PASS.
- `npx tsc --noEmit`: PASS (0 errors).
- `npm test`: PASS (1951 tests, 274 files).
- `npm run build`: PASS (208 static pages; existing Sentry/OpenTelemetry warnings only).
- `npx playwright test` with `PLAYWRIGHT_BASE_URL=https://liberia-learn.vercel.app`: PASS (9 browser tests).
- Production deploy: PASS, aliased to `https://liberia-learn.vercel.app`; deployment `dpl_HtJ2RmoTxbGqtj8wHZaKyWeR95H1`.

## Phase 5 Production Intelligence Summary
| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0 System inventory | COMPLETE | `docs/PHASE5_SYSTEM_INVENTORY.md` maps analytics, mastery, AI routing, curriculum, dashboards, queue, costs, Today, and multimedia paths. |
| Phase 1 Learning intelligence | COMPLETE | Student progress and teacher performance surfaces now expose mastery, weaknesses, recommended actions, struggling students, top performers, low-performing lessons, and interventions. |
| Phase 2 Admin/MOE intelligence | COMPLETE | Existing admin and MOE dashboards include real-data decision support for engagement, performance, teacher effectiveness proxy, district/school comparisons, subject heatmaps, adoption, and readiness. |
| Phase 3 Curriculum ingestion | COMPLETE | Admin curriculum import accepts PDF, DOCX, JSON, and structured text, parses into existing `CurriculumContent` and `CurriculumVersion`, and enters the existing review flow. |
| Phase 4 Elite curriculum upgrade | COMPLETE | Prompt registry and AI router now create governed elite upgrade drafts with quality scoring, original preservation, and side-by-side review UX. |
| Phase 5 Adaptive Today | COMPLETE | `/api/student/today` now returns deterministic `adaptivePlan` prioritizing scheduled work, weak areas, incomplete lessons, and next best actions. |
| Phase 6 Integrity/QA | IN PROGRESS | `docs/PHASE5_DUPLICATION_AUDIT.md` confirms no duplicate systems; generic library lessons now expose Read/Slides/Listen modes from the same multimedia payload fields. |

## Phase 5 Validation To Date
- Phase 0 gate: `npx tsc --noEmit` PASS; `npm test` PASS (1951 tests, 274 files); `npm run build` PASS.
- Phase 1 gate: `npx tsc --noEmit` PASS; `npm test` PASS (1952 tests, 275 files); `npm run build` PASS.
- Phase 2 gate: `npx tsc --noEmit` PASS; `npm test` PASS (1954 tests, 276 files); `npm run build` PASS.
- Phase 3 gate: `npx tsc --noEmit` PASS; `npm test` PASS (1956 tests, 277 files); `npm run build` PASS.
- Phase 4 gate: `npx tsc --noEmit` PASS; `npm test` PASS (1958 tests, 278 files); `npm run build` PASS.
- Phase 5 gate: `npx tsc --noEmit` PASS; `npm test` PASS (1960 tests, 279 files); `npm run build` PASS.
- Final Phase 6 gate: pending full sequence.

## Multimedia Lesson Delivery Sprint seed note
- Seeded student user: `<E2E_DEMO_STUDENT_EMAIL>` / `<DEMO_PASSWORD>`
- Seeded lesson title: `Ratios in Market Prices`
- Seeded lesson content id: `cha-g9-math-multimedia-demo`
- Seeded scheduled work id: `cha-demo-student1-multimedia-lesson`
- Direct student lesson path: `/student/lessons/cha-demo-student1-multimedia-lesson`
- Student surface: `/student/today` shows the lesson for the current UTC day after running `npm run seed:cha`
- Recreate fixture: run `npm run seed:cha`, which upserts the CHA school, teacher, student, enrollment, curriculum content, and scheduled work.

## Worktree status
Phase 5 implementation is complete on `feat/phase-5-intelligence-system`. Final local validation passed. Commit, push to main, production deploy, and GitHub Actions confirmation remain.

## Overall status
Sprints 1-16 + 16B + 16C + 16D + 16E + 16F + Dashboard UX complete. All role portals now share a consistent design system: DashboardTopBar, KPI cards, primary actions above fold, and role accent colours.

## Last completed phase
Phase 5 Production Intelligence + Curriculum System

## Last commit reference
Pending Phase 5 commit

## Last successful validation (Phase 5)
- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS
- `npm test`: PASS, 279 files / 1960 tests
- `npm run build`: PASS, 209 app routes generated
- `npx playwright test`: PASS, 11 tests
- Playwright verified seeded lesson `/student/lessons/cha-demo-student1-multimedia-lesson` still exposes Read / Slides / Listen.
- Playwright verified generic library lesson `/student/lesson/cha-g9-math-multimedia-demo` now exposes Read / Slides / Listen.

## Phase 5 Completion Summary
- Phase 0 inventory documented existing analytics, mastery, recommendations, AI routing, curriculum governance, queue, storage, dashboards, Today sequencing, and multimedia delivery in `docs/PHASE5_SYSTEM_INVENTORY.md`.
- Phase 1 extended existing student progress and teacher performance surfaces with learning intelligence, weakness detection, confidence tiers, recommended next actions, and class insight blocks.
- Phase 2 extended existing admin and MOE analytics with real-data decision-support summaries, engagement levels, performance distributions, weak subjects, district/school comparisons, usage trends, and readiness summaries.
- Phase 3 added curriculum import for PDF, DOCX, JSON, and structured text into existing `CurriculumContent` / `CurriculumVersion` records, with validation and audit logging.
- Phase 4 added elite curriculum upgrade prompts through the existing prompt registry and routed AI path, preserving original imported content and producing reviewable upgraded drafts with quality score deltas.
- Phase 5 made `/student/today` adaptive and deterministic by prioritizing scheduled work, weak areas, incomplete lessons, and next best lessons.
- Phase 6 documented duplication audit in `docs/PHASE5_DUPLICATION_AUDIT.md` and extended Playwright coverage for student, teacher, admin, MOE, guardian, platform admin, video, audio, analytics, and multimedia mode flows.

## Sprint 16F Deliverables
| Feature | Route / File | Notes |
|---------|--------------|-------|
| Privacy Policy | `/legal/privacy` | Full policy content, effective April 2026, LiberiaLearn / Republic of Liberia governing entity |
| Terms of Service | `/legal/terms` | Full terms content, K-12 education purpose, acceptable use, governing law |
| Data Handling for Minors | `/legal/data-for-minors` | Guardian rights, no advertising/profiling, contact path for data concerns |
| Contact page | `/contact` | Data requests, school enrollment questions, and technical support contacts |
| Consent acceptance | `components/ConsentGate.tsx`, `/api/legal/accept-policy` | Non-dismissible first-login modal for current policy version `2026-04` |
| Policy acceptance storage | `DataPolicyAcceptance`, `ConsentRecord` | Stores user, version, timestamp, source, and request IP address |
| Portal legal footer | all role portal shells/layouts | Links to privacy, terms, minors data policy, and contact |
| Cookie notice | public pages only | One-time localStorage dismissal; session cookies only, no tracking or advertising cookies |

## Sprint 16B Security Findings
| ID | Severity | File | Fix |
|----|----------|------|-----|
| FINDING-1 | CRITICAL | app/api/auth/login/route.ts | Removed hardcoded JWT_SECRET fallback; throws 500 if unset |
| FINDING-2 | HIGH | app/api/auth/reset-password/route.ts | Removed plaintext token OR fallback; query by tokenHash only |
| FINDING-3 | HIGH | app/api/placement/calculate-grade/route.ts | Added AI_HEAVY rate limiting per user |
| FINDING-4 | HIGH | next.config.js | Added Content-Security-Policy header |
| FINDING-5 | HIGH | app/api/moe/export/district/[district]/route.ts | Added rate limiting (30/hr per user) |
| FINDING-6 | MEDIUM | app/api/admin/governance/exports/ (6 routes) | Documented; protected by role checks |
| FINDING-7 | MEDIUM | Student performance national export | Documented; platform-admin-only export management |
| FINDING-8 | PASS | app/verify/[certificateCode] | First name + course + date only; crypto.randomBytes codes |
| FINDING-9 | PASS | app/api/moe/dashboard | Aggregate only; cohort suppression n<5; no PII drilldown |

## Sprint 16D Email Deliverability Results
| Touchpoint | Status | Notes |
|------------|--------|-------|
| School enrollment confirmation to principal | IMPLEMENTED | Routed through central email helper |
| Admin notification of new pending school | IMPLEMENTED | Routed through central email helper |
| School approval notification | IMPLEMENTED | Routed through central email helper |
| School rejection notification with reason | IMPLEMENTED | Routed through central email helper |
| Teacher invite email | IMPLEMENTED | Best-effort send handling |
| Student welcome email | IMPLEMENTED | Central branded template |
| Guardian welcome email | IMPLEMENTED | Added post-registration welcome send |
| Password reset | IMPLEMENTED | Send failure no longer crashes parent operation |
| Certificate awarded notification | IMPLEMENTED | Added best-effort certificate email |
| Guardian weekly digest | IMPLEMENTED | Email route supports weekly progress digest |
| Assignment due notification | IMPLEMENTED | Added best-effort assignment due email |

Email delivery guardrails: `sendEmail()` returns early in tests, production sends only when credentials are present, all provider sends use plain text fallback, and warnings log email type plus recipient role only.

## Sprint 16E Load Test Results
| Scenario | VUs | Duration | p95 | Error Rate | Result |
|----------|-----|----------|-----|------------|--------|
| Baseline | 100 | 5m | 602ms | 0.00% | PASS |
| AI Load | 50 | 3m | 265ms | 0.00% | PASS |
| Moderate | 1000 | 10m | 8,474ms | 34.74% | FAIL |
| Peak | 5000 | 5m | - | - | NOT RUN |

Root cause (Moderate FAIL): Vercel free tier concurrency cap + single demo credential auth rate limiting. CDN/page layer held at 97-99%. API routes saturated. Proven threshold: **100-VU p95 < 600ms**.

Required before national scale sign-off: Vercel Pro upgrade + seed load-test user pool (100+ unique students).

## Sprint 16C Deliverables
| Feature | Route | Notes |
|---------|-------|-------|
| Student self-registration | POST /api/register/student | School code + DOB + grade; email/phone optional; rate limit 10/hr/IP |
| Guardian self-registration | POST /api/register/guardian | Student match by name+DOB+code; no existence leak on mismatch |
| Student registration page | /register/student | Form with ?code= prefill from shareable link |
| Guardian registration page | /register/guardian | Links to student registration |
| School code on dashboard | /teacher/dashboard | Prominent display + copy-to-clipboard + shareable link |

## Phase status
- Sprints 1-16 + 16B + 16C + 16D + 16E + 16F complete
- Test baseline: 1820 passing tests (250 files)
- Security: OWASP-hardened
- Self-registration: Live at /register/student and /register/guardian
- Email deliverability: Verified and configured through central sendEmail() path
- Load tested: 100-VU baseline PASS; national scale requires Vercel Pro
- Legal/compliance: Privacy, terms, minors data, contact, consent acceptance, footers, and cookie notice complete
- System sign-off: SYSTEM-COMPLETE + SECURITY-HARDENED + LOAD-VALIDATED + SELF-REGISTRATION + EMAIL-VERIFIED + LEGAL-COMPLETE

## Sprint history (all on main target)

| Sprint | Deliverable | Commit | Tests |
|--------|-------------|--------|-------|
| 1-3 | Platform foundation, AI factory, mastery/interventions | pre-2bf49f6 | - |
| 4 | AI Telemetry + Versioning + Offline Sync Integrity | 2bf49f6 | - |
| 5 | Offline lesson delivery, Teacher weekly report, SMS dry-run gate | 6f93bae | 1649 |
| 6 | MOE National Dashboard + Student Learning Passport | 5c14e44 | 1671 |
| 7 | Governance + Anonymized Exports + Analytics APIs | 3c22ed2 | 1714 |
| 8 | Tests + Docs + Final Foundation Hardening | 0743cfc | 1731 |
| 9-15 | Phase 2 product, operations, and delivery hardening | completed before Sprint 16 Phase C sign-off | 1781+ |
| 16 | Final System Audit + Sign-Off | 811d8a2 | 1787 |
| 16B | OWASP Security Hardening Audit | 79a21a1 | 1787 |
| 16C | Student and Guardian Self-Registration | 9d2bf40 | 1805 |
| 16D | Email Deliverability Verification | ce8ec48 | 1805 |
| 16E | Load Test Validation | a0f50ae | 1787 |
| 16F | Legal and Compliance Pages | Pending Sprint 16F commit | 1820 |

## Untracked files (not part of Sprint 16F)
- `.git-temp-sprint2/`
- `e2e/`
- `playwright.config.ts`
- `prisma/migrations/20260416_100000_curriculum_version/`

## Online School Build Program
Full build plan: `docs/roadmaps/ONLINE_SCHOOL_BUILD.md`

| Sprint | Deliverable | Status |
|--------|-------------|--------|
| 1 | Lesson Regeneration Direct Processor | COMPLETE |
| 2 | Assignment Grading + Gradebook | COMPLETE |
| 3 | Term Report Cards | COMPLETE |
| 4 | Push Notifications + PWA Install | COMPLETE |
| 5 | School Events Calendar | COMPLETE |
| 6 | Live Class Sessions (Jitsi) | COMPLETE |
| 7 | Class Discussion Boards | COMPLETE |
| 8 | Guardian Portal Enhancement | COMPLETE |
| 9 | Canva Documents Suite | COMPLETE |
| 10 | Student Portfolio + Capstone | COMPLETE |
| 11 | Mobile PWA + Offline Enhancement | COMPLETE |
| 12 | Two-Way Student↔Teacher Messaging | COMPLETE |
| 13 | Messaging Hardening + Attachments | COMPLETE |
| 14 | Video delivery, analytics, guardian parity, FTS, a11y, gamification | COMPLETE |

## Sprint 1 COMPLETE — 2026-05-12
- `scripts/process-regen-jobs-direct.ts` — SHIPPED (commits 7e20684 + da717ff)
- `scripts/regen-status.ts` — SHIPPED
- `scripts/spot-check-approved.ts` — SHIPPED
- Gate: `npx tsc --noEmit` PASS, `npx vitest run` PASS (2601 tests / 348 files), `npm run build` PASS
- Schema fixes: `LabObservationFieldSchema.choices` .nullish, superRefine "either" → at-least-one
- Factory fix: max_tokens std 3000→6000, block 4000→8000; lessonFormat "either" (9000) for regen
- Processor fix: body_block priority for depth validation
- Validation run (--limit 50 --grade 7): 11 OK / 39 FAILED / 0 SKIPPED
- Spot-check (3 lessons): all PASS (18 slides, 1237–1355 words)
- DB state after validation: 3,852 APPROVED (+13), 1,208 NEEDS_REVIEW, 670 PENDING jobs, 114 APPROVED jobs

## Sprint 1 Known Limitations
- G3 SCIENCE: ~5–8% per-attempt pass rate — AI generates 700–1000 words for Grade 3 simple topics; well below 1200-word gate
- G5 ENGLISH: ~10–20% per-attempt pass rate — AI generates 1000–1150 words; close but below threshold
- G7 CIVICS: ~22% per-attempt pass rate — AI generates 850–1600 words; higher words pass, lower words fail
- Jobs with `status: "failed"` are re-processed on the next run. Multiple overnight runs needed to converge backlog.
- Overnight command: `npx dotenv -e .env.production -- npx tsx scripts/process-regen-jobs-direct.ts`

## Sprint 3 COMPLETE — 2026-05-12
- ReportCard model + migration `20260512_000001_sprint3_report_cards` — SHIPPED (commit b20a15a)
- `lib/reportCards/generateReportCard.ts` — SHIPPED
- `/admin/report-cards`, `/teacher/report-cards`, `/student/report-cards`, `/guardian/report-cards` — SHIPPED
- `/student/report-cards/[id]/print` — A4 print layout, grade table, signatures — SHIPPED
- All 5 APIs (generate, comment, publish, publish-all, listing routes) — SHIPPED
- Dashboard widgets: student Latest Report Card card, guardian Report Card Available banner, teacher nudge — SHIPPED
- Gate: `npx tsc --noEmit` PASS, `npx vitest run` PASS (2655 tests / 351 files), `npm run build` PASS
- 16 new tests in `__tests__/sprint3.reportcards.test.ts`

## Sprint 4 COMPLETE — 2026-05-12
- PushSubscription model + migration `20260512_000002_sprint4_push_subscriptions` — SHIPPED
- `lib/push/sendPush.ts` — `sendPushToUser`, `sendPushToMany`, expired-sub cleanup — SHIPPED
- APIs: `GET /api/notifications/vapid-public-key`, `POST /api/notifications/subscribe`, `DELETE /api/notifications/unsubscribe` — SHIPPED
- `public/sw.js` — push + notificationclick handlers appended — SHIPPED
- `public/manifest.json` — background_color #0a0a0a, theme_color #f5c518 — SHIPPED
- `components/PushPermissionPrompt.tsx` — 30s delay, Turn On/Not Now, 7-day dismiss, VAPID subscribe flow — SHIPPED
- Layout wiring: student, teacher, guardian layouts — SHIPPED
- Push triggers: assignment graded, assignment created (sendPushToMany to class), report card published, guardian message received — SHIPPED
- Pre-existing tsc errors fixed: `incidentTimelineService.ts`, ops notes/replay routes — SHIPPED
- VAPID keys generated for deployment. The original private key was mistakenly
  committed here and is now considered compromised; it must not be reused.
  Store the replacement key pair only in the deployment secret manager. The
  non-secret subject remains `mailto:admin@liberialearn.edu.lr`.
- Gate: `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2688 tests / 353 files), `npm run build` PASS
- 10 new tests in `__tests__/sprint4.push.test.ts`

## Sprint 6 COMPLETE — 2026-05-12
- Meeting model extended: `jitsiRoomId`, `joinUrl`, `liveStatus`, `startedAt`, `endedAt`, `hostUserId`, `subject`, `periodName`, `attendees` relation — SHIPPED
- `MeetingAttendee` model added + migration `20260512_000006_sprint6_live_sessions` — SHIPPED
- `lib/meetings/jitsiService.ts` — `generateJitsiRoomId` (deterministic, URL-safe, ≤64 chars) + `buildJoinUrl` — SHIPPED
- `lib/push/sendPush.ts` — `sendPushToClass` helper added — SHIPPED
- APIs: `POST /api/teacher/meetings`, `POST /api/teacher/meetings/[id]/start`, `PATCH /api/teacher/meetings/[id]/end` — SHIPPED
- APIs: `POST /api/student/meetings/[id]/join`, `GET /api/student/live-sessions/active` — SHIPPED
- Teacher schedule page: per-timetable-slot Schedule / Start / End session controls, 30s attendee count polling — SHIPPED
- `/student/live/[meetingId]` — full-screen Jitsi iframe, STUDENT-only, back button, handles SCHEDULED/LIVE/ENDED states — SHIPPED
- `components/LiveSessionBanner.tsx` — amber pulsing banner polls 30s, dismiss X, wired into `/student/today` — SHIPPED
- Auto-attendance: PATCH end marks each MeetingAttendee as PRESENT in AttendanceRecord — SHIPPED
- Push on start: `sendPushToClass` fires "Class is Live Now 🔴" to all enrolled students — SHIPPED
- Commit: `75707de`
- Gate: `npx prisma generate` PASS, `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2734 tests / 357 files), `npm run build` PASS
- 15 new tests in `__tests__/sprint6.livesessions.test.ts`

## Sprint 10 COMPLETE — 2026-05-13
- PortfolioShare model + migration `20260513_000002_sprint10_portfolio_capstone` — SHIPPED
- CapstoneProject extended: description, skills, teacherId, fileUrls, teacherFeedback, submittedAt, reviewedAt, createdAt — SHIPPED
- `lib/portfolio/buildPortfolio.ts` — `buildPortfolioSummary` aggregates badges, certs, lessons, quiz avg, streak, subjects — SHIPPED
- `/student/portfolio` — stats grid, badges, subjects, certs, capstone section, share button + copy URL — SHIPPED
- `/portfolio/[shareCode]` — public page (firstName + grade + school + stats + badges + subjects; no PII beyond first name) — SHIPPED
- `POST /api/student/portfolio/share` — creates/returns PortfolioShare; `GET /api/portfolio/[shareCode]` — 404 if inactive — SHIPPED
- `/student/capstone` — grade-gated G10+, DRAFT/SUBMITTED/APPROVED/REJECTED state machine — SHIPPED
- `/teacher/capstone` — pending/approved/rejected filter, inline review panel — SHIPPED
- All 7 capstone APIs (create, patch, submit, revise, teacher list, teacher review) — auth guarded — SHIPPED
- APPROVED capstone auto-creates PortfolioItem; pushes student on approve/reject — SHIPPED
- StudentSidebar: "My Portfolio" nav link added — SHIPPED
- fix(P1): `agentDecision` queries scoped via `workflowRun.schoolId` (tenant isolation) — SHIPPED
- Commit: `88a5817`
- Gate: `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2815 tests / 364 files), `npm run build` PASS
- 19 new tests in `__tests__/sprint10.portfolio.test.ts`

## Sprint 11 COMPLETE — 2026-05-13
- `components/PwaInstallPrompt.tsx` — 30s delay, beforeinstallprompt, 14-day dismiss, permanent install flag — SHIPPED
- `components/OfflineReadyBadge.tsx` — Cache API check, green checkmark / download icon, on-click cache trigger — SHIPPED
- `components/DataUsageBar.tsx` — navigator.storage.estimate, colour-coded bar, Low Data Mode toggle (localStorage) — SHIPPED
- `lib/offline/assignmentDraftQueue.ts` — saveDraftOffline / getDraftOffline / removeDraftOffline / listPendingDrafts — SHIPPED
- `lib/lesson-offline-cache.ts` — MAX_CACHED_LESSONS raised to 50 — SHIPPED
- `public/sw.js` — syncAssignmentDrafts + `sync` event handler for `submit-assignment-drafts` tag — SHIPPED
- `public/manifest.json` — screenshots array (home + today), categories, description hardened — SHIPPED
- `public/screenshots/` — home.png + today.png placeholder images — SHIPPED
- Layout wiring: student, teacher, guardian layouts all mount `PwaInstallPrompt` — SHIPPED
- `app/student/assignments/[id]/AssignmentSubmissionClient.tsx` — draft pre-fill banner, keystroke save, offline submit path, removeDraft on success — SHIPPED
- `app/student/today/page.tsx` — `OfflineReadyBadge` wired on each lesson item — SHIPPED
- `app/student/lessons/page.tsx` — `OfflineReadyBadge` wired on each lesson card — SHIPPED
- Commit: `1a94b11`
- Gate: `npx prisma generate` PASS, `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2844 tests / 365 files), `npm run build` PASS
- 27 new tests in `__tests__/sprint11.pwa.test.ts`

## Sprint 13 COMPLETE — 2026-05-14
- Upstash rate limit already wired (existing `checkRateLimit` auto-selects Upstash when env vars set) — CONFIRMED
- Message pagination: `GET /api/student/messages?threadKey=&before=&take=50` + `nextCursor` — SHIPPED
- 15s active-thread poll in student + teacher messages pages — SHIPPED
- Student soft-delete: `DELETE /api/student/messages/[messageId]` + `deletedBySender` field — SHIPPED
- `[Message retracted]` shown to teacher for soft-deleted messages — SHIPPED
- `lib/messaging/keywordFilter.ts` + auto-flag on POST for both student + teacher routes — SHIPPED
- `GET /api/admin/messages/flags` + `PATCH /api/admin/messages/[id]` flag review — SHIPPED
- `/admin/communications/flags` page: pending/dismissed/actioned tabs + Dismiss/Action Taken workflow — SHIPPED
- `flaggedMessages` stat wired to real DB count in `/api/admin/messages/stats` — SHIPPED
- `POST /api/messages/upload-attachment` (Vercel Blob, 5 MB max, images + PDF) — SHIPPED
- Attachment send/receive in student + teacher message bubbles (inline image / PDF download) — SHIPPED
- `lib/push/sendPush.ts` SMS fallback when no VAPID subscription + user has phone — SHIPPED
- `e2e/messaging.spec.ts` — 5 Playwright tests (skip-guarded on missing env creds) — SHIPPED
- Migration `20260513_000004_sprint13_message_hardening` applied to production — SHIPPED
- Commit: `70b3bff`
- Gate: `npx prisma generate` PASS, `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2885 tests / 367 files), `npm run build` PASS
- 21 new tests in `__tests__/sprint13.messaging-hardening.test.ts`

## Sprint 12 COMPLETE — 2026-05-13
- `Message` model extended: `senderRole`, `recipientRole`, `threadKey`, `read` fields + `MessageReadReceipt` model — SHIPPED
- Migration `20260513_000003_sprint12_unified_messaging` — SHIPPED
- `GET/POST /api/student/messages` — thread list with unread counts, rate-limited 10/day per teacher — SHIPPED
- `GET /api/student/messages/unread-count` — unread badge count for StudentSidebar polling — SHIPPED
- `GET /api/student/my-teachers` — enrolled teacher list for compose modal — SHIPPED
- `POST /api/teacher/messages/reply` — teacher reply with threadKey validation + push to student — SHIPPED
- `GET /api/teacher/messages/student-threads` — teacher view of student thread list — SHIPPED
- `GET /api/admin/messages/stats` — aggregate counts only, no message bodies (privacy) — SHIPPED
- `app/student/messages/page.tsx` — thread sidebar + chat bubbles + compose modal + read receipts (✓/✓✓) — SHIPPED
- `app/teacher/messages/page.tsx` — tabbed Guardian Messages / Student Messages with unread badge — SHIPPED
- `app/admin/communications/page.tsx` — message volume stats + privacy shield notice — SHIPPED
- `components/StudentSidebar.tsx` — Messages nav link + red unread badge (polls every 60s) — SHIPPED
- `components/admin/AdminNav.tsx` — Communications link added — SHIPPED
- Commit: `adc1b75`
- Gate: `npx prisma generate` PASS, `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2864 tests / 366 files), `npm run build` PASS
- 20 new tests in `__tests__/sprint12.messaging.test.ts`

## Sprint 14 COMPLETE — 2026-05-14
- LessonVideo upload migrated from Supabase to Vercel Blob (50 MB cap, MP4/WebM) — SHIPPED
- Video tab added to LessonDeliveryClient.tsx (hidden when no active video) — SHIPPED
- `AssessmentAttemptDetail` model + migration `20260514_000001_sprint14_features` — SHIPPED
- Per-question assessment analytics: `GET /api/teacher/analytics/assessment/[contentId]` — SHIPPED
- `/teacher/analytics/assessment/[contentId]` page: Q breakdown, correct rate color codes — SHIPPED
- Guardian push: assignment posted + live session started fire-and-forget — SHIPPED
- `GET /api/guardian/assignments` + `/guardian/assignments` page + GuardianNav link — SHIPPED
- FTS gin indexes on CurriculumContent + SchoolEvent — SHIPPED
- `GET /api/search` role-scoped full-text search — SHIPPED
- `components/GlobalSearch.tsx` command-palette overlay wired to student + teacher layouts — SHIPPED
- Skip nav link in `app/layout.tsx` — SHIPPED
- `role="log" aria-live="polite"` on message feed; `role="grid"` on EventCalendar — SHIPPED
- `StudentStreak` + `WeeklyLeaderboard` schema models — SHIPPED
- `lib/gamification/streakService.ts` + `lib/gamification/leaderboardService.ts` — SHIPPED
- Streak updated fire-and-forget on lesson complete — SHIPPED
- Streak display on Today page (🔥 X day streak, gold glow ≥7, badge ≥30) — SHIPPED
- `/student/leaderboard/[classId]` page: podium, table, opt-out — SHIPPED
- `POST /api/cron/rebuild-leaderboards` daily cron at 0 20 * * * — SHIPPED
- StudentSidebar: Leaderboard nav link added — SHIPPED
- Commit: `fc3bf21`
- Gate: `npx prisma generate` PASS, `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2904 tests / 368 files), `npm run build` PASS
- 19 new tests in `__tests__/sprint14.features.test.ts`

## Fix Session — 2026-05-14 (post-Sprint-14)
- `lib/db.ts`: `connection_limit=1` now injected programmatically if not in DATABASE_URL — SHIPPED
- `lib/lessons.ts`: `selectLessonBody` accepts `mode` param; slides mode prefers `body_block` — SHIPPED
- `lib/lessons.ts`: `renderSimpleMarkdown` strips `##` heading markers for clean Listen display — SHIPPED
- `app/student/discussion/page.tsx` + `app/teacher/discussion/page.tsx`: `ll-dashboard-shell` + back link — SHIPPED
- Commit: `0a6b314`
- Shell/nav audit: 29 pages audited; 9 needed shell fix; 20 needed back link — all fixed — SHIPPED
- Commit: `1e2a957`
- Gate: `npx tsc --noEmit` PASS, `npx vitest run` PASS (2904 tests / 368 files), `npm run build` PASS

## Sprint 9 COMPLETE — 2026-05-13
- GeneratedDocument model + migration `20260513_000001_sprint9_generated_documents` — SHIPPED
- `lib/canva/templates/`: studentIdCard, enrollmentLetter, teacherAppointment, permissionSlip — SHIPPED
- API routes: `GET /api/admin/documents`, `POST /api/admin/documents/id-cards/generate`, `/enrollment-letter`, `/teacher-appointment`, `/permission-slips` — SHIPPED
- `app/admin/documents/page.tsx` — tabbed admin UI for ID Cards, Enrollment Letters, Teacher Appointments, Permission Slips, Certificates — SHIPPED
- Autonomous OS phase 13–15: productSignalService, signalCoverageService (signal telemetry layer) — SHIPPED
- Predictive intelligence services: institutionalForecastService, trendForecastService, riskTrajectoryService, earlyWarningService, forecastCalibrationDashboardService, predictionReviewService — SHIPPED
- Autonomous OS admin pages: signals, predictions, forecasting, early-warnings, prediction-review, forecast-calibration — SHIPPED
- Signal telemetry wired to: push delivery, report card publish, assignment grade, meeting join, lesson complete, enrollment — SHIPPED
- `app/api/notifications/open` — notification open tracking — SHIPPED
- Commit: `6c50d46`
- Gate: `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2796 tests / 363 files), `npm run build` PASS
- 11 new tests in `__tests__/sprint9.documents.test.ts`

## Sprint 5 COMPLETE — 2026-05-12
- SchoolEvent model + migration `20260512_000005_sprint5_school_events` — SHIPPED
- `lib/push/sendPush.ts` — `sendPushToSchool` helper added — SHIPPED
- APIs: `GET/POST /api/admin/events`, `PATCH/DELETE /api/admin/events/[id]`, `PATCH /api/admin/events/[id]/publish` — SHIPPED
- `GET /api/events` — role-scoped visibility filter (ALL/STUDENTS/TEACHERS/GUARDIANS) — SHIPPED
- `/admin/events` CRUD page: filter tabs, inline form, draft/publish, edit, delete — SHIPPED
- `components/EventCalendar.tsx` — compact weekly strip + full month grid — SHIPPED
- EventCalendar compact wired into: student Today, teacher dashboard, guardian dashboard, admin dashboard — SHIPPED
- Dedicated events pages: `/student/events`, `/teacher/events`, `/guardian/events` — SHIPPED
- Nav links: StudentSidebar, TeacherNav, GuardianNav — SHIPPED
- `lib/events/eventSmsScheduler.ts` — 24h guardian SMS reminder, EXAM/MEETING only, skips past — SHIPPED
- Commit: `64b98f0`
- Gate: `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2712 tests / 355 files), `npm run build` PASS
- 9 new tests in `__tests__/sprint5.events.test.ts`

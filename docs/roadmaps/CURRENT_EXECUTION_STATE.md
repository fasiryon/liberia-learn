# CURRENT EXECUTION STATE

## Purpose
Live execution tracking for the final closeout program.

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
Phase 4.5 final platform review readiness

## Current sprint or phase
Phase 4.5 Full Completion Sprint COMPLETE. Deferred multimedia, navigation, analytics, demo, and reviewer walkthrough work is implemented and production-verified.

## Current branch
feat/phase-4-5-full-completion

## Phase 4.5 Demo Access
- Student: `student1@cha.edu.lr` / `DemoSeed2026!` lands on `/dashboard`; first click `/student/today`; seeded lesson `/student/lessons/cha-demo-student1-multimedia-lesson`.
- Teacher: `teacher1@cha.edu.lr` / `DemoSeed2026!` lands on `/teacher`; first click curriculum lesson management and video upload.
- Guardian: `guardian1@cha.family.lr` / `DemoSeed2026!` lands on `/guardian`; sees linked student Fatu Kollie.
- School Admin: `admin@cha.edu.lr` / `DemoSeed2026!` lands on `/admin`; first click curriculum/audio tools and analytics.
- Platform Admin: `platform.admin@liberialearn.org` / `DemoSeed2026!` lands on `/platform`; sees platform operations surfaces.
- MOE Official: `official1@moe.gov.lr` / `MOESeed2026!` lands on `/moe/dashboard`; sees national analytics.

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

## Multimedia Lesson Delivery Sprint seed note
- Seeded student user: `student1@cha.edu.lr` / `DemoSeed2026!`
- Seeded lesson title: `Ratios in Market Prices`
- Seeded lesson content id: `cha-g9-math-multimedia-demo`
- Seeded scheduled work id: `cha-demo-student1-multimedia-lesson`
- Direct student lesson path: `/student/lessons/cha-demo-student1-multimedia-lesson`
- Student surface: `/student/today` shows the lesson for the current UTC day after running `npm run seed:cha`
- Recreate fixture: run `npm run seed:cha`, which upserts the CHA school, teacher, student, enrollment, curriculum content, and scheduled work.

## Worktree status
Phase 4.5 committed locally; push to main and CI confirmation in progress.

## Overall status
Sprints 1-16 + 16B + 16C + 16D + 16E + 16F + Dashboard UX complete. All role portals now share a consistent design system: DashboardTopBar, KPI cards, primary actions above fold, and role accent colours.

## Last completed phase
Phase 4.5 Full Completion Sprint

## Last commit reference
`feat: complete phase 4.5 review readiness`

## Last successful validation (Dashboard UX)
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test`: PASS (1805 tests)
- `npm run build`: PASS (exit 0)

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

## Exact next step
Commit Sprint 16F legal and compliance pages, push to main, and confirm all four GitHub Actions workflows are green on main.

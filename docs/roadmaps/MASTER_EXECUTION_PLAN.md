# LiberiaLearn Final Closeout Execution Plan

> **SUPERSEDED FOR LIVE EXECUTION (2026-07-29).** This is a historical
> closeout record. Its completed sprint table must not be used to choose new
> work. The canonical live plan is
> `docs/roadmaps/NATIONAL_ROLLOUT_EXECUTION_PLAN.md`; resume state is
> `docs/roadmaps/CURRENT_EXECUTION_STATE.md`; escalation rules are in
> `docs/agents/ADVISOR_ESCALATION_CONTRACT.md`.

This plan governs the final 22-sprint closeout of LiberiaLearn from the validated Phase 15 baseline. Codex must execute one sprint at a time, inspect first, pass the full gate, commit/push, update state, and stop before beginning the next sprint.

| Sprint | Name | Status | Gate | Commit | Notes |
|--------|------|--------|------|--------|------|
| 1 | Production Seeding Truth Audit + Fix | COMPLETE | PASS | YES | Root cause was a seeding gap. Demo reset wiring was fixed, the missing policy engine file was committed, the build pipeline now runs `prisma generate`, the full gate passed, and Vercel succeeded for commit `4f1b9c6` on April 13, 2026. |
| 2 | Data Architecture + Schema + Immutable Event Layer | COMPLETE | PASS | YES | AssessmentAttempt, Intervention, MasterySnapshot (append-only), AIInteraction, TeacherAction, DataPolicyAcceptance, ExportJobRequest, LearningEvent models present. logLearningEvent() implemented. Branch: feat/data-intelligence-schema. |
| 3 | Intervention Chains + Derived Intelligence + Misconceptions | COMPLETE | PASS | YES | InterventionChain, DerivedStudentProgress, MasterySnapshot append-only strategy implemented. lib/interventions/ complete. Branch: feat/data-intelligence-chains. |
| 4 | AI Telemetry + Versioning + Offline Sync Integrity | COMPLETE | PASS | YES | AI interaction logging, curriculum versioning, offline sync integrity with conflict detection implemented. Branch: feat/data-intelligence-ai-telemetry. |
| 5 | High-Leverage Product Foundations | COMPLETE | PASS | YES | Core workflow fixes, dashboard UX, assignment workflow, rate limit + observability, flag graduation all completed. Branch: feat/high-leverage-product-foundations. |
| 6 | MOE Dashboard + Student Learning Passport | COMPLETE | PASS | YES | MOE dashboard with district aggregates, student learning passport/portfolio. Branch: feat/moe-dashboard-passport. |
| 7 | Governance + Anonymized Exports + Analytics APIs | COMPLETE | PASS | YES | Governance audit pack, MOE exports, district analytics APIs, anonymized data pipeline. Branch: feat/governance-export-analytics. |
| 8 | Tests + Docs + Final Foundation Hardening | COMPLETE | PASS | YES | Phase 5 Bundle A (Blocks 22–24): tenant isolation guard, composite indexes, N+1 elimination. 8 tests. Branch: phase5/bundleA-22-24-hardening-v2. |
| 9 | UX Defect Fix + Demo Experience Cleanup | COMPLETE | PASS | YES | UX defect fixes across all portals, demo reset flow, portal UX compression. Branch: feat/ux-defects-demo-cleanup. |
| 10 | Student AI Learning Experience | COMPLETE | PASS | YES | AI tutor, adaptive recommendations, student today page, achievement badges, greetings. Branch: feat/student-ai-learning-experience. |
| 11 | Adaptive Assessment + Gap Analysis | COMPLETE | PASS | YES | Adaptive mastery engine, gap detection, practice generator, contentGap alerts for G2/G9. Branch: feat/adaptive-assessment-gap-analysis. |
| 12 | Student Progress + Certificates | COMPLETE | PASS | YES | Student progress tracking, verifiable QR PDF certificates, national league table. Branch: feat/student-progress-certificates. |
| 13 | Teacher Professional Suite | COMPLETE | PASS | YES | Teacher alerts, class intelligence, push notifications, content creation, version history. Branch: feat/teacher-professional-suite. |
| 14 | School Operations Layer | COMPLETE | PASS | YES | School operations completion: enrollment, academic year, compliance, audit log. Branch: feat/school-operations-completion. |
| 15 | Liberia-Specific Delivery Hardening | COMPLETE | PASS | YES | Low-bandwidth mode, offline cache (MAX=20), SMS Liberian validators, STOP handler, offline quiz sync. Commit: 6df65a2. Branch: feat/liberia-delivery-hardening. |
| 16 | 5-Perspective System Audit + Final Sign-Off | COMPLETE | PASS | YES | Pre-reviewer audit: 15 fixes (H1–H4, M1–M5, L1–L6). E2E 13/13 PASS. Commits: 83a94b9–b1103b3. |
| 16B | Security Hardening Audit | COMPLETE | PASS | YES | OWASP hardening: JWT_SECRET guard, password reset by tokenHash only, AI rate limits, CSP header. Commit: 79a21a1. Branch: feat/security-hardening. |
| 16C | Student and Guardian Self-Registration | COMPLETE | PASS | YES | Student self-reg POST /api/register/student, guardian self-reg, rate-limited 10/hr per IP. Commit: f5cc601. |
| 16D | Email Deliverability Verification and Configuration | COMPLETE | PASS | YES | lib/email.ts sendStudentWelcome(), internal placeholder emails for students without email. |
| 16E | Load and Stress Test Validation | COMPLETE | PASS | YES | k6 load testing, circuit breaker, cache warming, edge config flags. Commit: 61c613e. |
| 16F | Legal and Compliance Pages | COMPLETE | PASS | YES | Privacy, terms, minors data policy, contact page, consent acceptance flow, portal footers, and public cookie notice completed. |

## How execution works

1. Inspect first. Read `AGENTS.md`, this file, and `docs/roadmaps/CURRENT_EXECUTION_STATE.md` before touching code.
2. Execute only the first sprint still marked `PENDING`, unless explicitly instructed otherwise.
3. Extend validated Phase 15 systems instead of rebuilding prior phases, duplicating subsystems, or replacing proven abstractions.
4. Report discovery and root-cause findings before code whenever a sprint requires inspection or diagnosis.
5. Run the sprint gate exactly as written. Every step must pass before anything from the next sprint begins.
6. Must-pass-before-next rule: no next sprint work, partial overlap, or silent scope drift is allowed before the current sprint gate passes.
7. Commit-after-gate rule: after a passed gate, commit, push, confirm push success, note CI status, update status tracking, and stop.
8. If a gate fails, stop forward progress, diagnose, apply the minimum required fix, rerun the gate, and remain on the same sprint.

## Between every sprint  commit template

Gate passed. Commit all changes with message "feat: sprint [N] complete  [sprint name]" and push to main. Confirm push succeeded and GitHub Actions CI is green before we proceed.

## Sprint 1  Production Seeding Truth Audit + Fix

- Branch: `feat/production-seeding-truth`
- Inspect first:
  - Vercel deployment logs
  - Prisma migration history
  - seed scripts and demo account creation logic
  - production Supabase demo data
- Determine root cause category:
  - seeding gap
  - deployment failure
  - migration not applied
  - demo accounts exist but no linked activity
- Report diagnosis before touching code.
- Apply the minimum correct fix based on the verified root cause.
- Verify demo accounts show expected data on `liberia-learn.vercel.app`.
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 2  Data Architecture + Schema + Immutable Event Layer

- Branch: `feat/data-intelligence-schema`
- Inspect first:
  - `prisma/schema.prisma`
  - `lib/**`
  - `app/api/**`
  - `__tests__/**`
- Discovery summary required: what exists, what is partial, what is missing.
- Implement or normalize:
  - `AssessmentAttempt`
  - `Intervention`
  - `MasterySnapshot` as append-only
  - `AIInteraction`
  - `TeacherAction`
  - `DataPolicyAcceptance` or `ConsentRecord`
  - `ExportJobRequest`
  - `LearningEvent` or `EventLog`
- `LearningEvent` must support actor, target, `eventType`, timestamps, curriculum context, metadata, quality markers, dedupe and replay fields, and version references.
- Add a typed event logger: `logLearningEvent()`.
- Use additive schema changes only.
- Use named migrations.
- Extend existing structures and never duplicate them.
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 3  Intervention Chains + Derived Intelligence + Misconceptions

- Branch: `feat/data-intelligence-chains`
- Inspect first:
  - intervention and remediation flows
  - assessment attempt and result logic
  - mastery and progress calculations
  - reporting aggregators
  - wrong-answer and error classification pathways
  - Sprint 2 work
- Discovery summary required before code.
- Implement or normalize:
  - `InterventionChain`
  - `DerivedStudentProgress`
  - `MasterySnapshot` append-only strategy
  - `MisconceptionCategory`
  - `MisconceptionTag`
  - `tagMisconception()` service
- Requirements:
  - open chain queries with attribution support
  - derived metrics separate from raw data
  - misconception taxonomy extensible and teacher-usable
  - no destructive rewriting of historical derived states
  - event wiring for intervention lifecycle with chain linkage
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 4  AI Telemetry + Versioning + Offline Sync Integrity

- Branch: `feat/data-intelligence-ai-telemetry`
- Inspect first:
  - `routedCompletion()`
  - AI telemetry and logging
  - tutor, retrieval, and citation flows
  - prompt version usage
  - offline queue and sync ingestion
  - dedupe and idempotency logic
  - Sprint 3 work
- Discovery summary required before code.
- Implement or normalize:
  - `logAIInteraction()`
  - prompt, content, assessment, and calculation version refs
  - `clientEventId`, `originalTimestamp`, `syncReceivedAt`
  - replay dedupe and sync conflict events
  - idempotent offline ingestion
- Requirements:
  - no direct provider calls outside `routedCompletion()`
  - no raw prompt text or student PII in telemetry
  - preserve original timestamps from offline events
  - add replay and conflict tests
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 5  High-Leverage Product Foundations

- Branch: `feat/high-leverage-product-foundations`
- Inspect first:
  - lesson delivery
  - offline and sync flows
  - teacher reporting
  - guardian relationships and notification abstractions
  - provider integrations
  - Sprint 4 work
- Discovery summary required before code.
- Implement:
  1. offline-first lesson delivery
  2. teacher weekly report service, API, and UI with event logging
  3. SMS guardian notification foundation with provider-agnostic adapter and safe fallback
- Requirements:
  - no second sync system
  - no second notification system
  - feature flags only for externally risky behavior such as live SMS
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 6  MOE Dashboard + Student Learning Passport

- Branch: `feat/moe-dashboard-passport`
- Inspect first:
  - MOE portal and login
  - reporting and dashboard code
  - derived progress and mastery snapshots
  - student profile and progress views
  - guardian access rules
  - Upstash Redis caching
- Discovery summary required before code.
- Implement:
  - national KPIs
  - county breakdown for all 15 Liberian counties
  - school and subject aggregate views
  - intervention effectiveness aggregates
  - AI usage aggregates
  - alerts feed
  - 15-minute Redis cache on aggregate queries
  - student learning passport service, API, and UI
- Privacy:
  - no raw student PII in MOE aggregate responses
  - no student individual drilldown from MOE dashboard
  - suppress or aggregate cohorts below 5
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 7  Governance + Anonymized Exports + Analytics APIs

- Branch: `feat/governance-export-analytics`
- Inspect first:
  - onboarding and consent
  - audit and access logs
  - export routes and jobs
  - analytics and reporting services
  - queue, storage, and download patterns
  - `DataPolicyAcceptance`
- Discovery summary required before code.
- Implement:
  - governance wiring
  - retention and archival foundations
  - `DataAccessLog`
  - `ExportJobRequest` approval workflow
  - anonymization service
  - secure export generation and download
  - typed analytics services for progress, intervention effectiveness, teacher action correlation, AI usage quality, misconception frequency, retention, and school or class summary
- Requirements:
  - no raw student PII in unrestricted exports
  - platform-admin-only export management
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 8  Tests + Docs + Final Foundation Hardening

- Branch: `feat/data-intelligence-tests-docs`
- No new features.
- Inspect prior work from Sprints 1 through 7.
- Add or extend tests for:
  - append-only events
  - raw vs derived data
  - intervention chains
  - tenant isolation across analytics
  - MOE aggregate privacy
  - export authorization and anonymization
  - AI telemetry privacy
  - offline replay safety
  - passport scoping
  - governance and access log behavior
- Add or update docs:
  - `docs/DATA_INTELLIGENCE_ARCHITECTURE.md`
  - `docs/EVENT_TAXONOMY.md`
  - `docs/PRIVACY_GOVERNANCE.md`
  - `docs/ANONYMIZED_EXPORTS.md`
  - `docs/MASTERY_AND_RETENTION.md`
  - `docs/ANALYTICS_SERVICES.md`
- Report final test count.
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 9  UX Defect Fix + Demo Experience Cleanup

- Branch: `feat/ux-defects-demo-cleanup`
- Root-cause inspection first:
  - lesson title rendering
  - debug UI visibility and guards
  - admin school nav
  - teacher logout and nav
  - AI create and generation state
  - AI tutor subject and grade injection
  - icon consistency
  - demo account activity and data rendering
- Fix:
  1. raw lesson IDs instead of titles
  2. debug elements visible outside `ADMIN` plus development
  3. non-clickable admin school rows
  4. missing teacher logout
  5. stale AI create state
  6. AI tutor missing subject and grade injection
  7. icon sizing inconsistency
  8. empty or broken demo activity data
- Requirements:
  - fix root causes, not surface symptoms only
  - no raw IDs, placeholder text, broken nav, or empty states in demo flow
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 10  Student AI Learning Experience

- Branch: `feat/student-ai-learning-experience`
- Inspect first:
  - student lesson view
  - current AI tutor flows
  - prompt registry
  - `routedCompletion()` patterns
  - mobile layout at `375px`
  - Phase 1 event logging
- Discovery summary required before code.
- Implement:
  - Help Me Understand button
  - session-safe AI help panel with suggested questions
  - prompt registry injection of lesson title, grade, subject, and first 800 words
  - grounded, grade-appropriate, Liberia-relevant responses
  - typing animation
  - mobile-first layout
  - role scoping
- Requirements:
  - all LLM calls through `routedCompletion()` with `forceSmartTier: true`
  - no inline prompts
  - telemetry through existing `logAIInteraction()`
  - no uncontrolled persistence
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 11  Adaptive Assessment + Gap Analysis

- Branch: `feat/adaptive-assessment-gap-analysis`
- Inspect first:
  - existing quiz and assessment generation or storage
  - lesson completion
  - `AssessmentAttempt`
  - misconception tagging
  - `routedCompletion()` integration
  - student result displays
- Discovery summary required before code.
- Implement:
  - AI quiz generator at lesson end
  - prompt registry JSON-only contract
  - five grade-calibrated questions from lesson content
  - MCQ UI
  - score and per-question explanations
  - DB attempt storage
  - parse failure retry once plus friendly error
  - post-quiz gap analysis
  - misconception tagging integration
- Requirements:
  - prompts in registry
  - `routedCompletion()` only
  - robust JSON fallback
  - telemetry and event logging through existing pathways
  - chain-friendly data structures
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 12  Student Progress + Certificates

- Branch: `feat/student-progress-certificates`
- Inspect first:
  - dashboards
  - lesson completion
  - quiz attempts
  - `DerivedStudentProgress`
  - `MasterySnapshot`
  - existing badge and certificate logic
  - notifications
  - audit and events
- Discovery summary required before code.
- Implement:
  - `/student/progress` dashboard
  - lesson and subject certificates
  - schema with unique 8-character `certificateCode`
  - notification on award
  - `/student/certificates` printable cards
  - `/verify/[certificateCode]` public verification with limited data
- Requirements:
  - use underlying Phase 1 data
  - certificate code must be cryptographically random
  - extend existing notification and audit systems
  - strict student scoping
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 13  Teacher Professional Suite

- Branch: `feat/teacher-professional-suite`
- Inspect first:
  - teacher dashboard
  - class and student performance services
  - lesson planning
  - assignments
  - at-risk logic
  - AI teacher assist
  - Sprint 5 teacher report
- Discovery summary required before code.
- Implement:
  - class performance intelligence
  - AI class insights
  - teacher lesson planning assistant
  - assignment system and completion tracking or export
- Requirements:
  - `routedCompletion()` for all AI
  - no tenant or school leakage
  - extend Sprint 5 teacher report foundation
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 14  School Operations Layer

- Branch: `feat/school-operations-layer`
- Inspect first:
  - school model and status flows
  - admin and principal dashboards
  - class management
  - invitation and account creation
  - CSV imports
  - SQS
  - storage
  - school approval workflows
  - messaging abstractions
- Discovery summary required before code.
- Implement:
  - self-service school enrollment
  - admin approval flow
  - principal dashboard
  - bulk student import with queued processing over 50
- Requirements:
  - use existing school and admin abstractions
  - async queued processing for large imports
  - email and SMS through existing messaging abstractions only
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 15  Liberia-Specific Delivery Hardening

- Branch: `feat/liberia-delivery-hardening`
- Inspect first:
  - low-bandwidth handling
  - PWA and service worker
  - offline lesson caching
  - sync
  - guardian SMS
  - profile preferences
  - storage and IndexedDB
- Discovery summary required before code.
- Implement:
  - low-bandwidth auto-detect and profile preference
  - offline lesson caching and offline lessons page or path
  - offline quiz attempt sync
  - Africa's Talking SMS completion with queueing and guardrails
- Requirements:
  - no second offline system
  - no second notification system
  - use existing sync, event, and telemetry pathways
  - safe stub if provider is not configured
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 16  5-Perspective System Audit + Final Sign-Off

- Branch: `feat/system-complete-audit`
- No new product features beyond minimum blocker fixes discovered by audit.
- Inspect prior work from Sprints 1 through 15.
- Run five audit tracks:
  - Senior Engineer
  - MOE Official
  - Teacher
  - Student
  - Admin
- Produce `docs/SYSTEM_COMPLETE_SIGNOFF.md`.
- Final gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`
- If all pass and no critical blockers remain, output `SYSTEM-COMPLETE`. MOE outreach can begin.
- Otherwise, list blockers with file paths and required fixes.

## Sprint 16B  Security Hardening Audit

- Branch: `feat/security-hardening`
- Inspect first:
  - authz and auth gaps
  - Prisma query safety
  - env exposure
  - uploads
  - public routes
  - headers
  - rate limiting
  - CORS
  - session expiry
- Audit and fix critical and high findings.
- Add HTTP security headers.
- Confirm certificate codes are cryptographically random.
- Report findings with severity, file and line, description, fix, and verification.
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 16C  Student and Guardian Self-Registration

- Branch: `feat/self-registration`
- Inspect first:
  - school code generation
  - account creation
  - auth and session
  - email provider
  - role and school scoping
- Implement student self-registration and guardian self-registration.
- Show school code on principal dashboard.
- Requirements:
  - `ACTIVE` school only
  - duplicate detection
  - server-side validation
  - rate limiting per IP
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 16D  Email Deliverability Verification and Configuration

- Branch: `feat/email-deliverability`
- Inspect first:
  - email provider integration
  - all email touchpoints
  - templates
  - env vars
- Map all email touchpoints.
- If no provider is configured, integrate Resend and a central `sendEmail()`.
- Add minimal branded HTML plus text fallback.
- Send a test email to each demo role and confirm delivery.
- Audit all send attempts without logging recipient email address.
- Errors must not crash the parent flow, retries are capped at 3, and sending is disabled in test and CI.
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 16E  Load and Stress Test Validation

- Branch: `feat/load-test-validation`
- Inspect first:
  - Vercel concurrency
  - Supabase pooling
  - Upstash thresholds
  - ECS worker scaling
  - SQS depth and concurrency
  - existing load tests
- Create k6 tests in `/load-tests/`.
- Run tests after the gate passes.
- Fix bottlenecks if they are found.
- Produce `docs/LOAD_TEST_RESULTS.md`.
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

## Sprint 16F  Legal and Compliance Pages

- Branch: `feat/legal-compliance`
- Inspect first:
  - existing legal routes
  - `DataPolicyAcceptance`
  - onboarding and registration flows
  - footer usage
  - cookie and session usage
- Implement privacy, terms, and minors data pages.
- Implement consent acceptance modal.
- Add footer links.
- Add cookie notice.
- Gate:
  1. `npx prisma generate`
  2. `npx tsc --noEmit`
  3. `npm test`
  4. `npm run build`

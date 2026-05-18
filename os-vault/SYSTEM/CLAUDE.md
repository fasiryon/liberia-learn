# LiberiaLearn — Business Operating System Constitution

> This file is loaded by every automated workflow before taking any action.
> It is the single source of truth for what this business is and how it operates.
> UPDATE: Weekly Focus every Monday. Update Active Phase after each sprint close.

---

## Business Identity

**Product:** LiberiaLearn
**Type:** Multi-tenant, AI-powered Education SaaS
**Mission:** National-scale digital education infrastructure for Liberia
**Primary Client:** Ministry of Education (MOE), Republic of Liberia
**Revenue Model:** Government SaaS contract + school tenant subscriptions
**Stage:** v1.0.0 released — post-launch sprint hardening + pilot preparation
**Current Version:** 1.0.0 (released 2026-03-01)

---

## Technology Identity

**Stack:**
- Framework: Next.js 14.2.35 (App Router, standalone output)
- Language: TypeScript 5.x (strict: false, noImplicitAny: false)
- ORM: Prisma 6.19.0 + PostgreSQL (Supabase hosted)
- Cache / Rate Limit: Upstash Redis (@upstash/redis 1.37.0, @upstash/ratelimit 2.0.8)
- Auth: NextAuth 4.24.7 + @auth/prisma-adapter
- AI Providers: Anthropic SDK 0.95.1, OpenAI 6.9.1, Groq 0.37.0 (multi-provider)
- AI Default Model: claude-sonnet-4-20250514 (ANTHROPIC_CANVA_MODEL env)
- SMS: Africa's Talking (africastalking 0.7.9) + Twilio
- Email: Resend 6.9.2
- Storage: Supabase Storage (lesson audio bucket)
- Push Notifications: web-push 3.6.7
- PDF: @react-pdf/renderer 4.3.2
- Charts: recharts 3.7.0
- Assets / Certificates: Higgsfield video generation, Canva OAuth integration
- AWS: S3 (@aws-sdk/client-s3), SQS (@aws-sdk/client-sqs) — curriculum regen queue
- Monitoring: Sentry (@sentry/nextjs 10.39.0, @sentry/node 10.43.0)
- Testing: Vitest 4.0.18 + @playwright/test 1.59.1
- Offline: idb-keyval 6.2.2 (IndexedDB), service worker (public/sw.js)

**Infrastructure:**
- Hosting: Vercel (production) + ECS Fargate pipeline available
- Database: Supabase PostgreSQL (pooler via PGBouncer for runtime, direct URL for migrations)
- CI/CD: GitHub Actions → Vercel auto-deploy on push to main
- ECS Pipeline: deploy-ecs.yml (ECR + ECS rolling deploy — alternate deploy path)
- Monitoring: Sentry + CloudWatch + custom MetricEvent / SloEvent tables

**Repository:**
- Working dir: C:\Users\fasir\liberia-learn
- Test runner: `npx vitest run` — 363 test files, 2712+ tests passing
- Build command: `prisma generate && next build`
- Deployment: git push to main → Vercel auto-deploy (preferred); CLI `npx vercel --prod` only on clean working tree

---

## Database Models (80+ Prisma models)

**User** — Platform user with role-based access; every user belongs to a school (except platform admin)
Key fields: role, schoolId, isPlatformAdmin, loginId, guardianPhone, smsOptIn
Relations: Student, TeacherProfile, guardianOf (StudentGuardian), sessions, auditLogs

**District** — Geographic district grouping schools under a tenantId
Key fields: tenantId, name, region, code, isActive

**School** — Multi-tenant root; every data record scopes to schoolId
Key fields: code (unique invite code), pilotStatus, onboardingStep, districtId, allowTeacherPublish
Relations: classes, users, inviteTokens, guardianConsents, policyConfigs

**Class** — Subject class within a school, taught by a teacher
Relations: enrollments, assignments, homework, meetings, scheduledWork, discussionThreads

**Student** — Extended profile linked to User; central entity for learning records
Relations: enrollments, attendance, mastery, adaptiveAttempts, badgeAwards, reportCards

**Enrollment** — Student ↔ Class membership (unique per pair)
**AcademicYear / Term** — School calendar structure; drives report cards and transcripts
**AcademicEnrollment** — Student-school-year enrollment for official grade tracking
**Transcript** — Computed GPA + summary per academic year per student
**ReportCard** — Per-student per-term report with subjectGrades JSON, status DRAFT/PUBLISHED

**Meeting** — Live class session (Jitsi integration); liveStatus SCHEDULED/ACTIVE/ENDED
**Attendance / AttendanceRecord** — Operational and meeting-specific attendance records
**MeetingAttendee** — Join log for live sessions

**Standard** — MOE curriculum standard with code (53 total: MATH 20, SCI 11, LIT 11, CIV 6, CS 5)
**Skill** — Teachable unit within a subject+band; tagged to Standards
**Unit / Lesson** — Curriculum structure hierarchy above CurriculumContent
**PracticeItem / AssessmentItem / Assessment / Submission / Grade** — Assessment infrastructure

**StrandCatalog** — 92-strand taxonomy (MATH/SCI/ENG/CS/LIT/CIVICS/ENGINEERING)
**QuestionTag** — Links practice items to strands + difficulty
**StudentMasteryProfile** — Per-student mastery state per subject+strand (proficiency + decay)
**MasteryRecord / ReviewSchedule** — Spaced-review engine state

**Message / AuditLog** — Internal messaging + immutable audit trail (every sensitive op)
**TrainingModule / TrainingProgress** — Teacher onboarding micro-modules (8 modules)

**Assignment / AssignmentSubmission** — Teacher-assigned work; MOE-standard-linked
**Homework / HomeworkSubmission** — AI-assisted homework with rubric scoring

**CapstoneProject / PortfolioItem** — Student portfolio and capstone work
**Partner / PartnerContact / PartnerProgram** — External org partnerships

**PlacementTest** — Diagnostic test for grade placement with AI analysis
**Agent / AgentTask / AgentMetric** — Autonomous OS agent infrastructure
**SystemEvent** — Platform operational events (severity-classified)
**ChatMessage** — AI tutor conversation history per student

**PasswordResetToken** — Single-use, hashed reset tokens
**Account / Session / VerificationToken** — NextAuth OAuth tables
**CanvaOAuthCredential / CanvaOAuthState** — Canva integration OAuth state
**InviteToken** — School enrollment invite tokens (teacher/student/guardian flows)
**NotificationLog / PushSubscription** — Push notification infrastructure

**StudentImportBatch** — Bulk student CSV import jobs with credential generation
**ExportRecord / ExportJobRequest** — Governance export request/approval lifecycle
**DataPolicyAcceptance / ConsentRecord** — Policy consent tracking (GDPR-adjacent)
**DataAccessLog** — Fine-grained data access audit trail
**GuardianConsent / SMSDeliveryLog** — Guardian SMS consent and delivery tracking
**MetricEvent / SloEvent** — Platform health + SLO monitoring events
**LearningEvent** — Immutable append-only canonical event stream (audit + replay)

**WorkflowRun / WorkflowStep / WorkflowCheckpoint** — Autonomous OS durable workflow engine
**AgentRun / AgentDecision / ActionExecution / ApprovalRequest** — Governed agent execution
**ExecutionTrace** — Distributed tracing spans for diagnostics

**CurriculumFeedback** — AI quality telemetry (approve/reject events)
**CurriculumContent** — Core content record (lessons, assessments); contentId is the canonical key
Key fields: grade, subject, status (published/accepted/pending/rejected), moeAlignments, embedding (pgvector)
**LessonAudio / LessonVideo** — Audio/video assets linked to CurriculumContent
**TextbookGenerationJob / GradePipelineJob** — Batch curriculum generation job tracking
**CurriculumRegenerationRun / Checkpoint / Job** — Curriculum refresh pipeline state
**PipelineLock** — Distributed lock for pipeline jobs
**CurriculumVersion** — Named snapshots of curriculum (DRAFT/ACTIVE/ARCHIVED)

**PolicyConfig / PolicyOverride** — School/district-level policy configuration
**MoePolicyDirective / MoeDirectiveApplication** — National MOE policy directives pushed to schools

**RagChunk** — pgvector RAG chunks for AI tutor grounding (scope: school/national)
**EvalRun** — RAG evaluation run results (recall, precision, grounding, fallback rate)

**StudentPerformanceEvent** — Normalized performance events for impact analytics
**AssessmentAttempt** — Cross-system normalized attempt record (complements exam/homework)

---

## API Surface (major route groups)

### Admin (school admin + platform admin)
- `GET/POST /api/admin/students` — Student management
- `POST /api/admin/import` — Bulk student CSV import
- `GET/POST /api/admin/classes` — Class management
- `GET/POST /api/admin/enrollment` — Enrollment management
- `GET/POST /api/admin/curriculum/*` — Generate, approve, reject, schedule curriculum
- `GET/POST /api/admin/exams/*` — Exam management
- `GET /api/admin/governance/exports/*` — Governed data exports (approval workflow)
- `GET /api/admin/dashboard/*` — School, district, national dashboards
- `GET /api/admin/ops/*` — Ops intelligence dashboard
- `GET/POST /api/admin/onboarding/*` — School onboarding flows
- `GET /api/admin/pilot-readiness` — MOE pilot readiness score
- `POST /api/admin/school` — School CRUD and branding

### Teacher
- `GET/POST /api/teacher/schedule` — Scheduled work management
- `GET /api/teacher/dashboard` — Class intelligence dashboard
- `GET/POST /api/teacher/assignments` — Assignment management
- `GET/POST /api/teacher/meetings/*` — Live class sessions
- `POST /api/teacher/grading/assist` — AI grading advisory
- `GET /api/teacher/alerts` — Automated teacher alerts

### Student
- `GET /api/student/today` — Daily lesson + adaptive recommendations
- `POST /api/student/work/[id]` — Lesson completion
- `POST /api/student/assignments/[id]/submit` — Assignment submission
- `GET /api/student/sync` — Offline sync endpoint
- `POST /api/student/tutor` — AI tutor (rate-limited)
- `POST /api/student/meetings/[id]/join` — Join live class

### Guardian
- `GET /api/guardian/dashboard` — Guardian view of linked students
- `GET /api/guardian/performance` — Student performance summary
- `POST /api/guardian/sms/send` — SMS message dispatch
- `GET /api/guardian/students` — List linked students

### MOE National
- `GET /api/moe/dashboard` — National summary (school/student counts, delivery rate)
- `GET /api/moe/standards-coverage` — MOE standard coverage by subject
- `GET /api/moe/delivery-compliance` — Delivery compliance by district
- `GET /api/moe/curriculum-health` — Curriculum alignment health
- `GET /api/moe/intervention-impact` — Intervention outcome delta by district

### Health / Auth
- `GET /api/health` — 4-check health endpoint (DB, migrations, AI key, SMS key)
- `POST /api/auth/login` — Credential login (loginId or email)
- `POST /api/register/student` — Student self-registration (rate-limited)
- `POST /api/register/guardian` — Guardian self-registration

---

## Active Stakeholders

**Ministry of Education (MOE)**
Role: Primary government client and regulatory body
Status: Pre-pilot engagement — platform production-ready
Next action: [User to populate — what's the next scheduled touchpoint?]
Key contacts: [User to populate]
Critical requirements: MOE curriculum alignment (53 standards), governance exports, audit logs, offline capability, multi-tenant isolation, no PII in national views

**School Tenants**
Role: End users of the platform (teachers, students, admins, guardians)
Status: Platform ready, pending MOE pilot approval
Onboarding model: MOE-coordinated enrollment; school code self-registration available
Current capacity: Designed for national scale

---

## Active Projects

**LiberiaLearn (Primary)**
Status: v1.0.0 released — currently in post-sprint hardening phases
Completed phases: Sprints 1–16C, Phase 5.1–5.3.1, RR-1 through RR-7, Trust Indicators
Current work: Sprint 15+ (signal detection, predictions, autonomous ops)
Blocking items: None known (4 real TODO files are pattern matchers in quality gates, not open work)
Open AI standard gaps: ACTION-2 (ENGINEERING MOE codes), ACTION-4 (CS G1_3), ACTION-5 (CS G4_6)
Next milestone: MOE pilot launch — awaiting MOE coordination

**Liberia Data Engine**
Status: Identified as v1 opportunity — national infrastructure intelligence platform
Score: 9.1/10 identified by project analysis
Current status: Not yet started
Next action: [User to populate — monetization model, data acquisition plan, GTM pilot strategy]

---

## Communication Standards

**Technical documentation style:** Precise, structured, no fluff
**MOE communication style:** Formal, government-appropriate, metric-driven, headline-first
**Stakeholder updates:** Executive summary first, detail second
**Code review comments:** Specific, actionable, reference line numbers

**What we never do:**
- Promise features without sprint capacity confirmation
- Send MOE communications without human review
- Share tenant data across tenant boundaries (ever — enforced in every Prisma query)
- Deploy without passing the full test suite (363 files, 2712+ tests)
- Merge without a deployment checklist review
- Hardcode JWT_SECRET or any secret — always from environment
- Skip rate limits on AI-heavy or auth endpoints

---

## Financial Framework

**Revenue targets:** [User to populate]
**Current MRR:** [User to populate]
**Key metrics to track:**
- Active school tenants
- Monthly active users (MAU) — students + teachers
- AI generation requests / month (budget cap: $100/mo default)
- TTS audio generation cost (cap: $100/mo)
- Infrastructure cost per tenant
- Test coverage percentage (currently: 363 files, 2712+ tests)
- Lesson delivery compliance rate (tracked via MetricEvent)
- MOE standard coverage (currently 94%: 50/53 codes)

---

## Sprint Operations

**Sprint cadence:** ~2 weeks per sprint (sprints 1–16C completed; phase numbering active)
**Test command:** `npx vitest run` (or `npm test`)
**Type check command:** `npx tsc --noEmit`
**Build command:** `npm run build` (runs prisma generate + next build)
**Deployment:** git push to main → Vercel auto-deploy (preferred path)
**Pre-deploy checklist:** Tests pass + tsc clean + no P0 open items
**Definition of done:** Tests pass + audit gate clear + no P0 open items + Vercel deploy succeeds

---

## Auth & Role System

Roles: `STUDENT`, `TEACHER`, `ADMIN`, `GUARDIAN`, `DISTRICT_ADMIN`, `MOE_OFFICIAL`
Platform admin: `User.isPlatformAdmin = true` (separate from role hierarchy)

Auth helpers (all in `lib/`):
- `requireRole(role)` → returns user or throws 401/403
- `requirePlatformAdmin()` → throws if not platform admin
- `getOptionalUser()` → returns user or null
- `requireTenant(user)` → validates schoolId present
- `assertPermission(user, permission)` → PERMISSIONS matrix check

**Golden rule:** Every Prisma query that touches tenant data includes `schoolId` (or `districtId` for district-scoped routes). No exceptions.

---

## Feature Flag Pattern

Server flags: `lib/serverFlags.ts` — `isXEnabled()` pattern, reads process.env
Client flags: `lib/featureFlags.ts` — `NEXT_PUBLIC_ENABLE_*` pattern

~50 feature flags covering: AI tutor, guardian portal, MOE portal, offline, governance exports, classroom toolkit, adaptive engine, dropout risk, intervention workflows, curriculum regen, Canva/Higgsfield asset generation, RAG tutor, and more.

---

## Windows/PowerShell Notes

**Working environment:** Windows 11, PowerShell, VS Code
**BOM-safe file write:**
```powershell
[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
```
**Test runner:** Always `npx vitest run` — not `npm test` alone
**Git:** Use standard git commands; Vercel auto-deploys on push to main

---

## Open Items (from code scan)

No real TODO/FIXME items found in app/ or lib/ — the 4 matches are inside quality-gate
regex pattern strings (expected false positives).

**Known AI standard gaps (tracked, not blocking):**
- [ ] lib/moe/standards-catalog.ts — ACTION-2: ENGINEERING MOE codes (structural gap)
- [ ] lib/moe/standards-catalog.ts — ACTION-4: CS G1_3 standard codes missing
- [ ] lib/moe/standards-catalog.ts — ACTION-5: CS G4_6 hardware strand codes missing

**Known release limitations (from v1.0.0 release notes):**
- [ ] ENABLE_GOV_EXPORTS defaults ON — verify before first production deploy
- [ ] 3 ESLint warnings (pre-existing, non-blocking): img usage, useMemo dependencies

---

## Operating Rules

1. Never delete vault files. Archive with `_ARCHIVED_YYYYMMDD_` prefix instead.
2. Never send external communications (MOE, stakeholders) without human review and approval.
3. Always date-stamp generated files as `YYYY-MM-DD-filename.md`.
4. Log every automated write to `SYSTEM/logs/operations.md`.
5. When uncertain about a decision: write to GENERATED and flag for review.
6. Escalate to human for: money, MOE commitments, architecture changes, security issues.
7. Never expose tenant data. Any query touching user data must include schoolId/districtId scoping.
8. Security audit findings are P0 — nothing ships until they are resolved.
9. AI standard gap fixes (ACTION-2, ACTION-4, ACTION-5) are low-urgency but must be done before the MOE pilot audit.
10. All push to production must go through git push (Vercel auto-deploy) — not `npx vercel --prod` with uncommitted work-in-progress files in the working tree.

---

## Weekly Focus

> UPDATE THIS EVERY MONDAY MORNING — 2 minutes, maximum impact.
> This weights every automated output toward what actually matters this week.

**Week of:** [Date — fill in each Monday]
**Top priority:** [One thing]
**Secondary:** [One thing]
**Blocked on:** [What's blocking]
**Shipping this week:** [What goes out]

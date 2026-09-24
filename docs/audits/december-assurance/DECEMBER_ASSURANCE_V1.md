# LiberiaLearn — December Product Assurance + Red-Team Audit V1

- Base: `bec602d859fed1b101fcbc6f4895da999f70b0b7`
- Date: 2026-09-24
- Scope: Repository-level assurance across nine lenses: student, teacher, guardian, admin/MOE, child privacy + security, accessibility + low-end UX, operations + support, failure/recovery, product reachability. No architecture redesign, no curriculum extraction, North-Star audit not rerun.
- External constraints: Supabase and Vercel were unavailable. No live database, RLS, feature-flag, blob-store, or deployed-runtime verification was performed; every result below is repository evidence.

## Summary

| Severity | Total | Fixed in this change | Documented (decision or external) |
| --- | --- | --- | --- |
| P0 | 0 | 0 | 0 |
| P1 | 8 | 8 | 0 |
| P2 | 17 | 10 | 7 |
| P3 | 6 | 1 | 5 |

No P0 defect was found. All eight P1 repository defects are fixed, and each is covered by a test that fails on the base commit and passes after the fix. The seven documented P2 items each need a child-privacy, educational-authority, product, or infrastructure decision; none is a hidden cross-tenant exposure. This change adds no parallel educational authority: every fix narrows an existing route or makes it consistent with an existing convention.

## Findings

### DA-01 · P1 · Open redirect after login and step-up

- **Lens:** security
- **Affected role:** all signed-in roles
- **Location:** `app/login/LoginClient.tsx`, `app/auth/step-up/StepUpClient.tsx`, `lib/auth/safeRedirect.ts`
- **Evidence / reproduction:** isNextUrlSafeForRole accepted any value starting with '/', so /login?next=//evil.example sent a user to another origin via router.push after a successful sign-in. The step-up check rejected '//' but not '/\evil.example', which browsers normalise to '//'. The Auth0 button forwarded ?next= unvalidated.
- **Authority / privacy impact:** Credential phishing aimed at teachers, admins, and guardians right after a genuine login.
- **Fix status:** fixed — Shared isSafeInternalPath rejects protocol-relative, backslash, and control-character paths; used by login, step-up, and the Auth0 callback.
- **Closure test:** __tests__/december-assurance/login-safety.test.ts
- **External dependency:** none

### DA-02 · P1 · All email logins shared one global rate-limit bucket

- **Lens:** operations + security
- **Affected role:** teacher, admin, guardian (email login)
- **Location:** `lib/auth.ts (resolveCredentialIdentifier)`
- **Evidence / reproduction:** studentId defaulted to "" and the key used '??', so every email login resolved to the key 'credentials:'. checkRateLimit counts every attempt (successful ones included) with a limit of 10 per 15 minutes, on the shared store in production.
- **Authority / privacy impact:** After about 10 email sign-ins nationwide in 15 minutes, every email login is refused with a generic failure: a national login outage that support cannot diagnose. It also means no per-account brute-force protection for email accounts.
- **Fix status:** fixed — Identifiers fall through with '||'; email logins are keyed per address ('email:<address>').
- **Closure test:** __tests__/december-assurance/login-safety.test.ts
- **External dependency:** Rate-limit backend (Redis) behaviour could not be observed live.

### DA-03 · P1 · Grading idempotency keys replayed another learner's submission

- **Lens:** security (student-to-student isolation)
- **Affected role:** student
- **Location:** `app/api/grading/code/route.ts`, `app/api/grading/ai-literacy/route.ts`
- **Evidence / reproduction:** Both routes returned gradedSubmission.findUnique({ clientSubmissionId }) without checking studentId. Homework and essay routes already bind the key to the learner.
- **Authority / privacy impact:** A student who obtained another student's client submission ID could read that student's response text, score, and feedback.
- **Fix status:** fixed — A key bound to a different learner returns 409 idempotency_key_payload_mismatch, matching /api/homework/submit.
- **Closure test:** __tests__/december-assurance/grading-idempotency.test.ts (fails on base)
- **External dependency:** none

### DA-04 · P1 · Teacher free-text notes about one child published on the national dashboard

- **Lens:** admin/MOE + child privacy
- **Affected role:** MOE official
- **Location:** `app/api/moe/placements/route.ts`, `app/moe/dashboard/page.tsx`
- **Evidence / reproduction:** Each district's topOverrideReason was the most frequent teacherReason: free text of at least 20 characters written about one learner at placement override. Because free text rarely repeats, the 'top' reason was usually one child's note, shown verbatim to national officials.
- **Authority / privacy impact:** Individual learner circumstances (names, family situation) crossed from school scope to national scope, against the MOE 'aggregates only' contract.
- **Fix status:** fixed — A reason is published only when at least 5 overrides share it (the same small-cell rule as the county dashboard); otherwise null ('--').
- **Closure test:** __tests__/december-assurance/moe-aggregate-privacy.test.ts
- **External dependency:** none

### DA-05 · P1 · National WAEC readiness county ranking had no small-cell suppression

- **Lens:** admin/MOE + child privacy
- **Affected role:** MOE official
- **Location:** `lib/waec/aggregate.ts (getNationalWaecReadiness)`, `components/waec/WaecPanels.tsx`
- **Evidence / reproduction:** byCounty published avgReadiness and assessedStudents for every county, including counties with one assessed learner. The MOE county and dashboard routes suppress cohorts below 5.
- **Authority / privacy impact:** A county with a single Grade 9+ assessed learner revealed that learner's readiness score.
- **Fix status:** fixed — Counties with fewer than 5 assessed learners return suppressed: true with null values; the panel shows 'Too few learners to show'.
- **Closure test:** __tests__/december-assurance/moe-aggregate-privacy.test.ts
- **External dependency:** none

### DA-06 · P2 · School admins could read the national WAEC aggregate

- **Lens:** admin/MOE
- **Affected role:** school admin
- **Location:** `app/api/moe/waec-readiness/route.ts`
- **Evidence / reproduction:** ALLOWED included ADMIN. Every other /api/moe aggregate uses isMoeSuperRole, and the only consumer (WaecMoePanel) renders on /moe/dashboard, which middleware blocks for ADMIN.
- **Authority / privacy impact:** School-scoped role reading national data it has no UI for.
- **Fix status:** fixed — Limited to MOE_OFFICIAL, MOE_SUPER_ADMIN, and platform admin.
- **Closure test:** __tests__/december-assurance/moe-aggregate-privacy.test.ts
- **External dependency:** none

### DA-07 · P2 · Unknown placement override rate shown as 0%

- **Lens:** admin/MOE
- **Affected role:** MOE official
- **Location:** `app/api/moe/placements/route.ts`, `app/moe/dashboard/page.tsx`
- **Evidence / reproduction:** overrideRate and nationalOverrideRate returned 0 when no placement had been reviewed.
- **Authority / privacy impact:** Unknown presented as zero: suggests the AI placement is never overridden when nobody has reviewed it.
- **Fix status:** fixed — Returns null; the dashboard renders '--'.
- **Closure test:** __tests__/december-assurance/moe-aggregate-privacy.test.ts
- **External dependency:** none

### DA-08 · P1 · Admin could mint a public share link for another school's learner

- **Lens:** security (tenant boundary)
- **Affected role:** school admin
- **Location:** `app/api/certificates/[id]/share/route.ts`
- **Evidence / reproduction:** Students were ownership-checked; ADMIN had no school check. The response creates a CertificateShare token and a public URL with WhatsApp text containing the learner's full name.
- **Authority / privacy impact:** Cross-tenant write that publishes a minor's name and achievement from another school.
- **Fix status:** fixed — Non-platform admins must share the learner's school (404 otherwise), matching /api/certificates/generate.
- **Closure test:** __tests__/december-assurance/tenant-and-recovery.test.ts
- **External dependency:** none

### DA-09 · P2 · Guardian dashboard showed AI homework scores before review

- **Lens:** guardian
- **Affected role:** guardian
- **Location:** `app/api/guardian/dashboard/route.ts`
- **Evidence / reproduction:** recentGrades used teacherScore ?? aiScore without checking aiReviewed. /api/guardian/students, /api/guardian/student/[id], and /api/homework/[id] all withhold aiScore until aiReviewed.
- **Authority / privacy impact:** Provisional machine scores shown to families as grades, unlabeled.
- **Fix status:** fixed — AI score shown only when aiReviewed, matching the other guardian and student surfaces.
- **Closure test:** __tests__/guardian.dashboard.test.ts ('AI score release')
- **External dependency:** none

### DA-10 · P2 · Public /api/health/db returned raw database driver errors

- **Lens:** security (error leakage)
- **Affected role:** anonymous
- **Location:** `app/api/health/db/route.ts`
- **Evidence / reproduction:** On failure the unauthenticated route returned err.message, which for Prisma connection errors names the database host and port.
- **Authority / privacy impact:** Infrastructure reconnaissance from an unauthenticated endpoint.
- **Fix status:** fixed — Returns 'database_unreachable' outside development; the full message stays in the server log.
- **Closure test:** __tests__/december-assurance/tenant-and-recovery.test.ts
- **External dependency:** none

### DA-11 · P1 · Learner transcripts and message attachments at predictable public blob URLs; transcript regeneration silently stale

- **Lens:** child privacy + data integrity
- **Affected role:** student, guardian, admin
- **Location:** `app/api/student/portfolio/generate/route.ts`, `app/api/admin/credentials/bulk-generate/route.ts`, `app/api/messages/upload-attachment/route.ts`
- **Evidence / reproduction:** @vercel/blob 2.3.3 does not add a random suffix by default. Transcripts were written to public 'portfolios/{studentId}/{term}/transcript.html' and attachments to 'message-attachments/{userId}/{timestamp}_{name}'. Blob v2 also refuses to overwrite, so regenerating a transcript threw inside a swallowed catch and left the old public copy in place.
- **Authority / privacy impact:** A minor's name, school, scores, and attendance were retrievable by anyone who knew or guessed a learner ID and term. Regenerated credentials kept serving stale numbers.
- **Fix status:** fixed — addRandomSuffix: true on all three public writes; each regeneration gets a new URL, which is stored on the credential.
- **Closure test:** __tests__/december-assurance/ui-contracts.test.ts ('unguessable URLs')
- **External dependency:** Earlier blobs already written at predictable paths stay public until removed from the Vercel Blob store (needs Vercel access).

### DA-12 · P2 · Report card double-publish sent duplicate notifications

- **Lens:** failure/recovery
- **Affected role:** school admin, student, guardian
- **Location:** `app/api/report-cards/[id]/publish/route.ts`
- **Evidence / reproduction:** Check-then-update: two concurrent PATCHes (double-click, retry) both saw DRAFT, both updated, and both sent push and inbox notifications to the student and every guardian.
- **Authority / privacy impact:** Duplicate family notifications; confusing publish state.
- **Fix status:** fixed — Conditional updateMany (status != PUBLISHED); the losing request returns 'Already published' and sends nothing.
- **Closure test:** __tests__/december-assurance/tenant-and-recovery.test.ts
- **External dependency:** none

### DA-13 · P2 · Teacher override of AI essay/code grades was unaudited

- **Lens:** teacher (governed overrides)
- **Affected role:** teacher, admin
- **Location:** `app/api/grading/[submissionId]/override/route.ts`
- **Evidence / reproduction:** The route overwrote gradedSubmission.score with no audit record and no trace of the previous score. Assignment grading and placement review both audit.
- **Authority / privacy impact:** Grade changes invisible to reviewers; no way to tell an AI grade from a human override afterwards.
- **Fix status:** fixed — Writes a grading.submission.override audit entry with the previous and new score.
- **Closure test:** __tests__/december-assurance/tenant-and-recovery.test.ts
- **External dependency:** none

### DA-14 · P1 · '+ Create Homework' led to a missing homework page

- **Lens:** teacher + product reachability
- **Affected role:** teacher
- **Location:** `app/teacher/homework/page.tsx`
- **Evidence / reproduction:** Both Create Homework buttons linked to /teacher/homework/create; the page is /teacher/homework/new, so 'create' was treated as a homework ID by /teacher/homework/[id].
- **Authority / privacy impact:** Teachers could not create homework from the Homework screen: a core December workflow dead end.
- **Fix status:** fixed — Links point to /teacher/homework/new.
- **Closure test:** __tests__/december-assurance/ui-contracts.test.ts
- **External dependency:** none

### DA-15 · P2 · Links to routes that do not exist

- **Lens:** product reachability
- **Affected role:** admin, guardian, MOE, teacher, public
- **Location:** `app/admin/* (8 back-links to /admin/dashboard)`, `app/guardian/GuardianDashboardClient.tsx (/guardian/lessons)`, `app/moe/dashboard/page.tsx (/moe/audit)`, `lib/intelligence/teacherAlerts.ts (/teacher/interventions)`, `app/share/certificate/[id]/page.tsx (/register)`, `components/GlobalSearch.tsx (/events; student lesson links for teachers)`
- **Evidence / reproduction:** Static href scan against the app route tree (dynamic segments resolved) found these literal targets with no page.
- **Authority / privacy impact:** Navigation dead ends. The 'Review intervention' alert action (the teacher intervention follow-up) went to a 404.
- **Fix status:** fixed — Pointed to existing routes: /admin, /guardian/progress, /teacher/intelligence (hosts the intervention table), /guardian/register, and role-aware search results. The MOE audit tile was removed; see DA-24.
- **Closure test:** __tests__/december-assurance/ui-contracts.test.ts
- **External dependency:** none

### DA-16 · P2 · Primary buttons failed WCAG AA contrast

- **Lens:** accessibility
- **Affected role:** all
- **Location:** `~110 buttons across app/ and components/ using bg-[var(--ll-yellow)] or bg-[var(--ll-accent)]`
- **Evidence / reproduction:** Text token --ll-text-faint (#6b6460) on --ll-yellow (#E8B84B) measures 3.15:1; some buttons used --ll-text or white, which is lower still. Many switched on hover to the 11%-alpha yellow, which would make dark text disappear.
- **Authority / privacy impact:** Low-legibility primary actions (Sign in, Submit, Retry) on low-end, outdoor-lit phone screens.
- **Fix status:** fixed — Solid yellow/accent surfaces use --ll-bg text (9.45:1) and hover:opacity-90. Colours and tokens are unchanged, so the visual identity holds.
- **Closure test:** __tests__/december-assurance/ui-contracts.test.ts (token ratio + source sweep)
- **External dependency:** none

### DA-17 · P3 · Icon-only controls without accessible names

- **Lens:** accessibility
- **Affected role:** student, teacher, guardian
- **Location:** `components/EventCalendar.tsx`, `app/teacher/timetable/page.tsx`
- **Evidence / reproduction:** Month navigation and a modal close button had only an icon; the calendar buttons were 28px touch targets.
- **Authority / privacy impact:** Screen readers announce 'button' with no purpose; small targets on phones.
- **Fix status:** fixed — aria-labels added; calendar buttons use the 44px minimum target.
- **Closure test:** __tests__/december-assurance/ui-contracts.test.ts
- **External dependency:** none

### DA-18 · P2 · Error and offline pages falsely claimed work was saved

- **Lens:** student + failure/recovery
- **Affected role:** student
- **Location:** `app/error.tsx`, `app/offline/page.tsx`, `public/offline.html`, `public/sw.js`
- **Evidence / reproduction:** 'Your work has been saved' was shown for every unexpected error and every offline navigation, including online-only flows that the offline queue reports as unsupported_offline.
- **Authority / privacy impact:** Misleading success state: learners do not redo work that was lost.
- **Fix status:** fixed — Honest wording plus a pointer to the error reference; SW_VERSION bumped so installed clients refresh the precached offline page.
- **Closure test:** __tests__/december-assurance/ui-contracts.test.ts; existing __tests__/sw.cache-rules.test.ts
- **External dependency:** none

### DA-19 · P2 · Portfolio share page ignored the portfolio feature flag

- **Lens:** child privacy
- **Affected role:** anyone signed in
- **Location:** `app/portfolio/[shareCode]/page.tsx`
- **Evidence / reproduction:** GET /api/portfolio/[shareCode] returns 404 when feature:portfolio is off; the page route read the share and rendered the learner's name and school regardless.
- **Authority / privacy impact:** Turning the feature off did not stop learner data being served.
- **Fix status:** fixed — The page returns notFound() when the flag is off.
- **Closure test:** __tests__/december-assurance/ui-contracts.test.ts
- **External dependency:** none

### DA-20 · P2 · AI homework scores reach families without human approval

- **Lens:** guardian + educational authority
- **Affected role:** guardian, student
- **Location:** `app/api/homework/review/route.ts`, `app/api/guardian/*`, `app/guardian/*`
- **Evidence / reproduction:** aiReviewed is set by the AI review pipeline itself, not by a teacher. After DA-09 every guardian surface consistently shows aiScore once aiReviewed is set, labelled '(AI)'. AssignmentSubmission, by contrast, requires teacherApproved before a score is released.
- **Authority / privacy impact:** An LLM-produced score is released to families without teacher approval, which CORE_AGENT_RULES says only governed systems or humans may decide.
- **Fix status:** documented — material educational-authority decision (TRUE STOP)
- **Closure test:** n/a
- **External dependency:** Decision owner: curriculum/assessment governance. Options: gate on teacherScore, or add a teacherApproved flag like AssignmentSubmission.

### DA-21 · P2 · 'Advisory' LLM grades update adaptive mastery

- **Lens:** student + educational authority
- **Affected role:** student
- **Location:** `app/api/grading/ai-literacy/route.ts`, `app/api/grading/code/route.ts`, `app/api/grading/essay/route.ts`
- **Evidence / reproduction:** Route headers say the LLM grade is advisory, yet each calls recordAnswer(correct = score >= threshold) on the adaptive mastery store.
- **Authority / privacy impact:** An LLM judgement becomes mastery evidence without human review.
- **Fix status:** documented — material educational-authority decision (TRUE STOP)
- **Closure test:** n/a
- **External dependency:** Decision owner: learning-authority governance.

### DA-22 · P2 · Portfolio 'share' links require a LiberiaLearn login

- **Lens:** child privacy + product reachability
- **Affected role:** student, external viewer
- **Location:** `middleware.ts (PUBLIC_PATHS)`, `app/portfolio/[shareCode]/page.tsx`
- **Evidence / reproduction:** /portfolio is not a public path, so external recipients hit the login redirect. Any signed-in user in any school can open a share code.
- **Authority / privacy impact:** The feature does not work for its intended audience, and its access model is undefined.
- **Fix status:** documented — material child-privacy policy decision (TRUE STOP)
- **Closure test:** n/a
- **External dependency:** Decision owner: child-privacy governance (public vs. authenticated share, expiry).

### DA-23 · P2 · Transcripts and message attachments remain public-access blobs

- **Lens:** child privacy
- **Affected role:** student, guardian
- **Location:** `app/api/messages/upload-attachment/route.ts`, `app/api/student/portfolio/generate/route.ts`, `app/api/admin/credentials/bulk-generate/route.ts`
- **Evidence / reproduction:** After DA-11 the URLs are unguessable but still public and non-expiring.
- **Authority / privacy impact:** A forwarded link grants permanent access to a minor's attachment or transcript.
- **Fix status:** documented — needs infrastructure (private blob store + signed delivery route)
- **Closure test:** n/a
- **External dependency:** Vercel Blob private store and a policy decision on transcript sharing.

### DA-24 · P2 · No MOE audit-trail surface

- **Lens:** admin/MOE + operations
- **Affected role:** MOE official
- **Location:** `app/moe/dashboard/page.tsx`
- **Evidence / reproduction:** The dashboard linked to /moe/audit, which does not exist; the dead tile was removed (DA-15). /admin/audit is ADMIN-only.
- **Authority / privacy impact:** National officials cannot review access to national data.
- **Fix status:** documented — policy decision on what MOE may see of the audit log
- **Closure test:** n/a
- **External dependency:** none

### DA-25 · P2 · Implemented pages with no navigation entry

- **Lens:** product reachability
- **Affected role:** student, teacher
- **Location:** `/student/packs`, `/student/passport`, `/teacher/packs`, `/teacher/approvals`, `/teacher/rag`, `/teacher/video-analytics`, `/teacher/help`
- **Evidence / reproduction:** Static scan found no literal or dynamic link to these pages. Labs are linked dynamically and are not included.
- **Authority / privacy impact:** Weekly offline packs, which matter for December offline delivery, and the learning passport are only reachable by typing the URL.
- **Fix status:** documented — product decision (nav placement, feature flag readiness)
- **Closure test:** n/a
- **External dependency:** none

### DA-26 · P2 · No operator view of a learner's stuck offline queue

- **Lens:** operations + support
- **Affected role:** support/operator
- **Location:** `app/api/student/sync/route.ts`, `app/admin/ops/*`
- **Evidence / reproduction:** The sync route returns structured resolutionHint codes and emits an offline.queue.conflicts gauge, but no admin surface lists one learner's rejected or conflicted operations. withRequestLogging wraps only 6 of 579 API routes.
- **Authority / privacy impact:** Support can see that sync is failing in aggregate but cannot answer 'why is this learner's work missing'.
- **Fix status:** documented — new operator surface; outside a defect fix
- **Closure test:** n/a
- **External dependency:** none

### DA-27 · P3 · Certificate share tokens cannot be revoked

- **Lens:** security
- **Affected role:** public
- **Location:** `lib/certificates/shareToken.ts`
- **Evidence / reproduction:** Tokens are a deterministic HMAC of the certificate ID with no expiry and a 'dev-fallback-secret' fallback when NEXTAUTH_SECRET is missing.
- **Authority / privacy impact:** A shared certificate stays public for good; the fallback secret is unsafe if production is ever misconfigured (NextAuth would also fail in that case).
- **Fix status:** documented
- **Closure test:** n/a
- **External dependency:** none

### DA-28 · P3 · Essay/code grade override is school-scoped, not class-scoped

- **Lens:** teacher
- **Affected role:** teacher
- **Location:** `app/api/grading/[submissionId]/override/route.ts`
- **Evidence / reproduction:** Any teacher in the school may override any learner's graded submission; the route-policy declares school-membership. The override is now audited (DA-13).
- **Authority / privacy impact:** Wider than assignment grading, which is limited to the class teacher.
- **Fix status:** documented — scoping decision
- **Closure test:** n/a
- **External dependency:** none

### DA-29 · P3 · Duplicate assignment creation page

- **Lens:** product reachability
- **Affected role:** teacher
- **Location:** `app/teacher/assignments/create/page.tsx`, `app/teacher/assignments/new/page.tsx`
- **Evidence / reproduction:** Both post to /api/teacher/assignments; only /new is linked.
- **Authority / privacy impact:** Maintenance drift only; no parallel authority.
- **Fix status:** documented
- **Closure test:** n/a
- **External dependency:** none

### DA-30 · P3 · Ops health page links to a repository runbook the app does not serve

- **Lens:** operations + support
- **Affected role:** admin
- **Location:** `app/admin/ops/health/page.tsx (/docs/ops/RUNBOOK.md)`
- **Evidence / reproduction:** No route serves /docs/*.
- **Authority / privacy impact:** Operator dead link during an incident.
- **Fix status:** documented
- **Closure test:** n/a
- **External dependency:** none

### DA-31 · P3 · Many routes return raw exception messages on 500

- **Lens:** security (error leakage)
- **Affected role:** all
- **Location:** `e.g. app/api/report-cards/[id]/route.ts, app/api/guardian/report-cards/route.ts, app/api/student/[id]/route.ts`
- **Evidence / reproduction:** Common pattern: NextResponse.json({ error: err?.message }). All of these routes require authentication.
- **Authority / privacy impact:** Possible internal detail disclosure to signed-in users; low individual risk.
- **Fix status:** documented — broad cleanup, best done through handleApiError
- **Closure test:** n/a
- **External dependency:** none

## Journey evidence (pass/fail)

| Lens | Journey / check | Result | Evidence |
| --- | --- | --- | --- |
| student | Quiz submit is scored from a sealed server session; retry and offline replay are idempotent | PASS | app/api/student/lessons/[id]/quiz/submit/route.ts; __tests__/quiz-attempt.idempotency.test.ts |
| student | Exit-ticket and quiz answer keys are never sent to learners | PASS | app/api/student/work/[scheduledWorkId]/route.ts (answerKey omitted, exit ticket sanitised) |
| student | Offline client cannot assert mastery; identity mismatch rejected | PASS | app/api/student/sync/route.ts resolutionHint offline_client_cannot_assert_mastery / learner_identity_mismatch; __tests__/student-sync.conflict.test.ts, __tests__/offline-hardening-v1.test.ts |
| student | No-evidence, weak-prerequisite, stale-release learner experience | PASS | __tests__/learning-authority/learner-experience-*.test.ts, release-manifests.test.ts, placement-containment.test.ts |
| student | Error/offline states are honest about unsaved work | FAIL → FIXED | DA-18 |
| student | Learner submissions isolated from other learners | FAIL → FIXED | DA-03 |
| teacher | Student detail and intelligence limited to the teacher's enrolled students | PASS | app/api/teacher/students/[studentId]/route.ts; app/api/teacher/intelligence/[studentId]/route.ts (getTeacherScope) |
| teacher | AI assignment grades need teacher approval before a score exists | PASS | app/api/teacher/assignments/submissions/[submissionId]/approve/route.ts |
| teacher | Placement override transactional and audited | PASS | app/api/teacher/placements/[id]/review/route.ts |
| teacher | Create homework from the Homework screen | FAIL → FIXED | DA-14 |
| teacher | Intervention alert → review intervention | FAIL → FIXED | DA-15 |
| teacher | Grade overrides are traceable | FAIL → FIXED | DA-13 |
| guardian | Every child-data route verifies the guardian↔student link for the requested child | PASS | app/api/guardian/{grades,attendance,assignments,report-cards,student/[studentId],dashboard}/route.ts; __tests__/guardian.dashboard.test.ts |
| guardian | Messages go only to a teacher of the linked child; read receipts recipient-only | PASS | app/api/guardian/messages/route.ts; app/api/guardian/messages/[id]/read/route.ts |
| guardian | Only published report cards visible | PASS | app/api/guardian/report-cards/route.ts; app/api/report-cards/[id]/route.ts |
| guardian | No unreviewed machine scores | FAIL → FIXED (policy item DA-20 remains) | DA-09, DA-20 |
| admin/MOE | MOE county and dashboard aggregates suppress cohorts below 5 | PASS | app/api/moe/counties/route.ts; app/api/moe/dashboard/route.ts |
| admin/MOE | MOE WAEC and placement aggregates free of individual facts | FAIL → FIXED | DA-04, DA-05, DA-06 |
| admin/MOE | Portal middleware: /moe MOE-only, /admin ADMIN-only, /platform platform-admin-only | PASS | middleware.ts |
| security | All 579 API routes scanned for missing authentication | PASS | Only intentional public routes lack session checks (health, auth, enroll/register, onboarding accept, SMS webhooks with provider checks, dev route blocked in production); cron routes verify CRON_SECRET |
| security | Tenant boundaries on ID-addressed routes (sampled 30+ [id] routes) | FAIL → FIXED | DA-08; all other sampled routes scope by schoolId, enrollment, or link |
| security | Post-login redirect and login throttling | FAIL → FIXED | DA-01, DA-02 |
| accessibility | Primary action contrast and icon-button names | FAIL → FIXED | DA-16, DA-17 |
| operations | Error pages expose a support reference (digest) without internals | PASS | app/error.tsx, app/global-error.tsx |
| failure/recovery | Double-submit of report card publish | FAIL → FIXED | DA-12 |
| failure/recovery | Homework and quiz retry after lost response | PASS | app/api/homework/submit/route.ts (key bound to learner and payload); quiz clientAttemptId replay |
| reachability | Literal navigation targets resolve to routes | FAIL → FIXED | DA-14, DA-15; DA-25 documented |

## External-only readiness items

- Supabase: verify RLS, tenant data, and that no stale public transcripts exist at portfolios/{studentId}/… paths (DA-11).
- Vercel: confirm feature:portfolio and guardian/MOE flag values for December, and confirm the production rate-limit backend is the shared store (DA-02).
- Vercel Blob: remove or rotate transcripts and message attachments written before this change at predictable paths (DA-11).
- Deployed PWA: confirm installed clients pick up SW_VERSION p5e-2026-09-24-1 and the revised offline page.

## Recommended next December mission

December Governance Decisions + Operator Readiness: (1) take DA-20, DA-21, and DA-22 to curriculum/child-privacy governance and implement the chosen AI-score release and portfolio-share policies; (2) build a read-only operator 'learner sync and submission' diagnostic view (DA-26) keyed by learner and school, with resolutionHint history; (3) once Supabase/Vercel return, run live verification of DA-02 and DA-11 cleanup and the flag matrix; (4) add nav entries for offline packs and the passport if the flags are December-ready (DA-25).

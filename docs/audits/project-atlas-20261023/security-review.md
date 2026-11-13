# Security and authority review

Pinned source `887f23eccbe5b194c2e7ff93c0b09c843549a9eb`. Static findings do not establish production activity or exploitation.

Two immediate P0 repairs: school administrators can read global raw invocation contents, and student sync can overwrite teacher attendance using newer client timestamps.

| ID | Priority | Severity | Finding | Evidence |
|---|---|---|---|---|
| SEC-R01 | P0 | HIGH | Cross-school agent invocation disclosure | SEC-E01, SEC-E02, SEC-E03 |
| SEC-R02 | P0 | HIGH | Student-authored canonical attendance | SEC-E04, SEC-E05, SEC-E06, SEC-E07 |
| SEC-R03 | P1 | HIGH | Generic runtime moderation fails open for teaching | SEC-E10, SEC-E11, SEC-E12 |
| SEC-R04 | P1 | HIGH | Partial backups lack demonstrated full recovery | SEC-E17, SEC-E18, SEC-E19 |
| SEC-R05 | P2 | MEDIUM | Tool role and output contracts not centrally enforced | SEC-E08, SEC-E09, SEC-E24, SEC-E25 |
| SEC-R06 | P2 | MEDIUM | Cost caps have concurrency and attribution gaps | SEC-E14, SEC-E15, SEC-E16 |
| SEC-R07 | P1 | HIGH | Env false is not absolute emergency disable | SEC-E13 |
| SEC-R08 | P1 | HIGH | MFA and RLS production posture unverified | SEC-E20, SEC-E21, SEC-E26, SEC-E27 |
| SEC-R09 | P2 | MEDIUM | Raw child/guardian invocation retention unverified | SEC-E03, SEC-E17, SEC-E18 |
| SEC-R10 | P2 | MEDIUM | Image publishing does not establish rollback readiness | SEC-E28 |

## SEC-R01 Cross-school agent invocation disclosure

Confirmed static authorization defect; deployment exploitation unknown. Likelihood: high when populated and reachable.

Require platform-admin for global logs or school-scope through correlated AuditLog; redact default response.

Owner: Platform security / agent platform. Complexity: S. Acceptance: Two-school fixtures deny foreign/unscoped invocations and counts, including spoofed userId filters.

## SEC-R02 Student-authored canonical attendance

Confirmed static authority defect; no live exploit attempted. Likelihood: high for student sync access.

Accept learner attendance as provisional observation only; teacher authority/server version wins and enrollment required.

Owner: School workflow / offline. Complexity: M. Acceptance: Student cannot replace teacher ABSENT with PRESENT using future timestamp or write another class meeting.

## SEC-R03 Generic runtime moderation fails open for teaching

Confirmed default UNCERTAIN acceptance; teaching activation unknown. Likelihood: medium on moderation outage.

Explicit audience policy; learner-facing runtime fails closed with approved fallback.

Owner: AI safety / teaching runtime. Complexity: S. Acceptance: Timeout/invalid JSON/UNCERTAIN cannot reach classroom narration.

## SEC-R04 Partial backups lack demonstrated full recovery

Export limits and silent upload failures confirmed; managed DB/PITR and drill state unknown. Likelihood: unknown disaster event probability.

Verify database-level backup and disposable restore; alert/non-200 on partial failures; update runbook and pagination.

Owner: Platform operations. Complexity: M. Acceptance: Recover linked academic/safeguarding state; publish measured RTO/RPO; injected upload failure alerts.

## SEC-R05 Tool role and output contracts not centrally enforced

Contract omission confirmed; no present privilege escalation proven. Likelihood: medium with future allowlist changes.

Check requiresAuth and outputSchema centrally, retaining handler resource authorization.

Owner: Agent platform. Complexity: S. Acceptance: Role-mismatched tool never runs; invalid output rejected; guardian and teaching checks retained.

## SEC-R06 Cost caps have concurrency and attribution gaps

Non-atomic check and post-call cap confirmed; spend unknown. Likelihood: medium under concurrent requests.

Reserve estimated spend before call, reconcile actual; attribute moderation/translation; clarify global versus scoped daily limit.

Owner: AI platform / operations. Complexity: M. Acceptance: Concurrent calls respect reservation cap within documented provider-estimate tolerance and supporting calls counted.

## SEC-R07 Env false is not absolute emergency disable

DB override precedence confirmed; current overrides unknown. Likelihood: unknown effective config.

Expose effective-state source; separate absolute emergency shutdown before enabling sensitive agents.

Owner: Agent platform / operations. Complexity: S. Acceptance: Emergency disable wins over override and schedule with audited restore.

## SEC-R08 MFA and RLS production posture unverified

Implementation guarded; August containment documentary only. Likelihood: unknown effective deployment.

Obtain deployment-bound read-only MFA/RLS evidence and wire existing RLS invariant into release gate.

Owner: Security / operations. Complexity: S. Acceptance: Privileged MFA denial tests; no RLS-disabled/exposed public tables; bypass-role paths tenant tested.

## SEC-R09 Raw child/guardian invocation retention unverified

Raw persistent data confirmed; approved minimization/deletion coverage not established. Likelihood: unknown retention/access.

Define retention/redaction including private backups and safeguarding exceptions; audited deletion.

Owner: Privacy / agent platform. Complexity: M. Acceptance: Minimum debugging content; tested retention and authorized exception handling.

## SEC-R10 Image publishing does not establish rollback readiness

Workflow scope confirmed; external integration unknown. Likelihood: unknown rollout coverage.

Verify actual ECS rollout owner, immutable image binding, health checks and rollback drill.

Owner: Platform operations. Complexity: S. Acceptance: Staging rollout/rollback evidence binds image SHA to task definition.

## Evidence

- SEC-E01: `app/api/admin/agents/invocations/route.ts:25-65`, `GET`. School ADMIN may query all invocation rows with no school constraint. Strength: static-confirmed.
- SEC-E02: `lib/permissions.ts:114-128`, `ROLE_PERMISSIONS.ADMIN`. School ADMIN has AGENT_PLATFORM_VIEW by default. Strength: static-confirmed.
- SEC-E03: `lib/agents/invocationLog.ts:32-75`, `persistInvocation`. Raw input/output and tool results persist; school association is only on correlated AuditLog. Strength: static-confirmed.
- SEC-E04: `app/api/student/sync/route.ts:575-615`, `POST attendance branch`. STUDENT own-profile and school-only meeting checks; no teacher review or class enrollment check. Strength: static-confirmed.
- SEC-E05: `app/api/student/sync/route.ts:647-708`, `POST attendance upsert`. Client status/timestamp resolved then upserted to canonical AttendanceRecord. Strength: static-confirmed.
- SEC-E06: `lib/offline-sync/policies.ts:27-40`, `resolveAttendance`. Newer client timestamp overrides server attendance. Strength: static-confirmed.
- SEC-E07: `app/api/guardian/student/[studentId]/route.ts:70-81`, `GET`. Guardian attendance counts consume AttendanceRecord. Strength: static-confirmed.
- SEC-E08: `lib/agents/runtime.ts:120-127`, `runLoop`. Tool allowlist resolves without role filtering. Strength: static-confirmed.
- SEC-E09: `lib/agents/runtime.ts:190-234`, `runLoop dispatch`. Input schema checked; requiresAuth and outputSchema not enforced. Strength: static-confirmed.
- SEC-E10: `lib/agents/runtime.ts:320-325`, `runAgent input moderation`. No minor audience; only UNSAFE blocks. Strength: static-confirmed.
- SEC-E11: `lib/agents/runtime.ts:375-403`, `runAgent output moderation`. UNCERTAIN output is not blocked. Strength: static-confirmed.
- SEC-E12: `lib/agents/moderation.ts:27-61`, `applyAudiencePolicy`. Minor audience maps uncertainty to unsafe; default classifier error is uncertain. Strength: static-confirmed.
- SEC-E13: `lib/agents/control.ts:6-24`, `resolveAgentEnabled`. DB override wins even over false env flag. Strength: static-confirmed.
- SEC-E14: `lib/agents/costEnforcement.ts:15-51`, `checkCostCaps`. Pre-call accumulated spend reads have no atomic reservation. Strength: static-confirmed.
- SEC-E15: `lib/agents/runtime.ts:134-164`, `runLoop completion cap`. Invocation cap checked after paid call; bounded loop exists. Strength: static-confirmed.
- SEC-E16: `lib/ai/budgetGuard.ts:63-104`, `checkBudget`. Unavailable accounting fails closed. Daily usage feature/school scoped; monthly global. Strength: static-confirmed.
- SEC-E17: `app/api/cron/nightly-backup/route.ts:27-119`, `POST selections`. Partial seven-category export, 50k caps on grades/attendance/invocations. Strength: static-confirmed.
- SEC-E18: `app/api/cron/nightly-backup/route.ts:177-207`, `POST uploads`. Private uploads allSettled; partial failure still 200; retention listing unpaginated. Strength: static-confirmed.
- SEC-E19: `docs/ops/BACKUP_SCHEDULE.md:52-109`, `Recovery and targets`. Illustrative incomplete COPY commands and stale three-file monitoring, no measured restore proof. Strength: documentation-only.
- SEC-E20: `lib/auth/privilegedIdentity.ts:29-31`, `isPrivilegedMfaEnforced`. MFA enforcement flag defaults false. Strength: static-confirmed.
- SEC-E21: `lib/auth.ts:150-181`, `authorizeCredentials`. Primary credentials has rate limit, bcrypt and conditional privileged MFA. Strength: static-confirmed.
- SEC-E22: `app/api/grading/[submissionId]/override/route.ts:37-87`, `PATCH`. Historical tenant flaw fixed by school check/platform-admin exception and audit. Strength: historical-documentation.
- SEC-E23: `lib/ai/staleGradeReleaser.ts:6-48`, `releaseStaleAIGrades`. Conditional claim releases provisional AI feedback without official grade writes. Strength: static-confirmed.
- SEC-E24: `lib/agents/tools/guardianAuth.ts:11-25`, `assertGuardianOf`. Guardian persisted link or trusted runtime temporary grants required. Strength: static-confirmed.
- SEC-E25: `lib/agents/tools/teaching.tools.ts:7-24`, `assertTeachingSessionContext`. Agent/session trace/user/school binding enforced. Strength: static-confirmed.
- SEC-E26: `docs/security/PRODUCTION_RLS_EXPOSURE_AUDIT.md:1-25`, `Containment status`. August report records RLS containment and backend postgres bypass. Not current verification. Strength: historical-documentation.
- SEC-E27: `scripts/verify-rls-invariant.ts:1-45`, `main`. Existing read-only invariant verifier; no GitHub workflow references found. Strength: static-confirmed.
- SEC-E28: `.github/workflows/deploy-ecs.yml:1-38`, `push-worker-image`. Manual image build/push workflow has no ECS service update or rollback. Strength: static-confirmed.
- SEC-E29: `lib/ai/rag/assistantActions.ts:46-96`, `buildAssistantActions`. Actions are metadata and intervention action requests confirmation. Strength: static-confirmed.
- SEC-E30: `lib/ai/rag/audienceScope.ts:51-99`, `resolveAssistantAudienceScope`. Student audience derived from persisted grade and enrollment. Strength: static-confirmed.

## Historical revalidation and unknowns

- Historical app/api/auth/login/route.ts absent at pinned HEAD; do not repeat prior login vulnerability as current.
- Historical grade override tenant defect fixed at current implementation.
- August RLS containment is historical documentation, not current production verification.
- Current production flags, AgentControl overrides, deployment SHA and privileged MFA enforcement
- Current managed DB backup/PITR coverage and restore drills
- Dependency advisories: no fresh network vulnerability scan performed
- External penetration test completion not independently verified
- Secret exposure/rotation not certified; no secret values reproduced

## Validation and limits

55 selected files inspected; 30 fingerprinted records. No runtime tests or application edits. Positive controls include guardian link checks, teaching session binding, fail-closed shared budget checks, provider timeouts and bounded retries, provisional AI feedback without official grades, and private backup uploads. This is not a penetration test or dependency vulnerability certification.

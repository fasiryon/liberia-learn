# P2-B Qualified Review Operations Staging Completion Record

Date: 2026-08-14

Branch: `codex/p2b-qualified-review-operations`

Production activation: NOT AUTHORIZED

## 1. Tenant remediation result

School-owned moderation and curriculum review routes now resolve authority and
tenant scope before lookup or mutation. School ADMIN access is limited to the
actor's school. Teacher review requires explicit roster and credential
eligibility. Cross-school list and action attempts fail closed without
unnecessary content-existence disclosure. Risk notification recipients are
selected from explicit school or higher-authority scope instead of broad role
broadcasts.

## 2. Final schema as implemented

The additive Option C model family contains:

- `ReviewerProfile`
- `ReviewerCredential`
- `ReviewerCredentialScope`
- `ReviewerCredentialStatusEvent`
- `ReviewerRestriction`
- `CurriculumReviewTask`
- `CurriculumReviewAssignment`
- `CurriculumReviewAssessment`
- `CurriculumReviewDecision`
- `ReviewCalibrationSession`
- `ReviewCalibrationResult`

No global reviewer role was added to `User.role`. P2-A remains the canonical
curriculum lifecycle and immutable governance history.

## 3. Migration result

Two additive canonical migrations are active only on approved staging project
`yonpfzjczoffhrgibxkz`:

- `20260813_000001_p2b_qualified_review_operations`, SHA-256
  `655AD60067634CAB8277CA0F2DE327B1909BADDCDB3B5C5299E76537283BA1D0`
- `20260814_000001_p2b_review_cycles`, SHA-256
  `3F2FB655B50B9DF524B758993BE22EF5DE1E9C4950077E84A68D99DA186B89C1`

The post-migration preflight confirms eight active canonical migration rows,
zero unfinished rows, all four P2-A tables, all eleven P2-B tables, TLS client
transport, and staging health HTTP 200.

## 4. Database invariants

Database constraints and triggers enforce grade ranges, ordered grade bounds,
verified-credential verifier/timestamp requirements, submitted-assessment
completeness, active assignment uniqueness, immutable submitted assessments,
immutable final decisions, immutable credential status events, immutable
calibration results, verified credential/core scope immutability, exact
revision/provenance integrity, and decision/governance/audit reference
integrity. The disposable PostgreSQL 17 proof produced one winner under a
real two-session slot race and rejected the competing insert.

## 5. P2-A transaction refactor

The existing public governance writer remains compatible. An internal
transaction-capable writer accepts an existing Prisma transaction. Final P2-B
decision composition locks the task and P2-A root, revalidates revision,
claim, eligibility, credentials, conflicts, and assessment independence, then
creates one AuditLog row, one P2-A governance event referencing that audit,
the immutable P2-B decision, and task completion in one transaction. Injected
post-audit failure rolled the complete transaction back in staging.

## 6. Reviewer roster

Roster operations support active/inactive profile state, organization and
authority ceiling, school scope, availability, capacity, and restrictions.
Role alone never creates qualification. `MOE_DISTRICT_ADMIN` remains
read-only. A rostered TEACHER can review only when the complete eligibility
contract passes.

## 7. Credentials and scopes

Credentials carry type, issuer, authority, validity dates, verification
state, evidence reference, and one or more subject, grade, domain, curriculum,
school, geography, language, or specialist scopes. Verification is
independent of the holder. Verified credential core and scope are immutable;
changes require governed suspension, revocation, expiry, or supersession.

## 8. Eligibility engine

`reviewEligibility` is deterministic and returns explicit reason codes plus
the matched credential and scope. It checks authentication, roster status,
RBAC ceiling, availability/capacity, credential status and dates, scope,
authority, exact current revision, restrictions, provenance conflicts,
independence, and calibration policy. It contains no LLM decision.

## 9. Policy and risk queue

The versioned policy engine produces priority band and score, rationale,
authority, review count, specialist slots, SLA, rubric version, blinding, and
evidence requirements. Initial SLAs are CRITICAL 4 hours, HIGH 24 hours,
STANDARD 5 business days, and LOW 10 business days. Queue order is priority
band, score descending, due time, then creation time. Age cannot promote work
across risk bands. Capacity exhaustion never approves high-risk content.

## 10. Claims and concurrency

Claims are database-backed 15-minute renewable leases with maximum continuous
duration, compare-and-set versions, release, expiry, reclaim, and audited
administrator override. Active slot and active reviewer constraints are
enforced in SQL. The real staging claim race produced exactly one successful
claim. Heartbeat, expiry, reclaim, lost-lease submission 409, and stale task
cancellation all passed.

## 11. Assessments

Draft assessments use optimistic versions. Submission captures immutable
reviewer, role, credential, credential scope, qualification, rubric,
recommendation, rationale, evidence, and risk-response snapshots.
Recommendations support APPROVE, REJECT, RETURN_FOR_REVISION, ESCALATE, and
ABSTAIN_CONFLICT. `NOT_APPLICABLE` remains distinct from a missing rubric
response.

## 12. Two-person review and blinding

Policy creates independent FIRST and SECOND slots for HIGH, CRITICAL,
national, WAEC-authoritative, configured sensitive, reinstatement, and policy
exception cases. The same person cannot fill both slots. The second reviewer
cannot see the first recommendation or rationale before immutable submission.
Agreement can finalize only when policy permits.

## 13. Disagreement and resolver

Both submitted assessments remain immutable. A disagreement moves the task to
DISAGREEMENT or ESCALATED and requires a third eligible resolver who is not
the author or either independent reviewer. The resolver records a final
rationale. Only the policy-satisfied resolution creates the P2-A governance
event.

## 14. Conflicts and recusal

Automatic conflicts cover revision authorship, known source-chain authors,
generator/import initiators, prior independent reviewers, and restricted
school, organization, or scope. Missing legacy provenance is not treated as
proof of no conflict. Declared recusal releases the claim, creates audit
evidence, and does not penalize the reviewer.

## 15. APIs

Implemented APIs cover reviewer profiles and restrictions, credential create
and transition operations, deterministic eligibility, task list/detail,
claim, heartbeat, release, draft assessment, submit, complete/resolve,
controlled operations, reports, and calibration. Mutation handlers require
authentication, authority, idempotency, relevant optimistic version, and
audit. Conflicts return explicit 409 responses.

## 16. Legacy adapters

Existing human approve, reject, governance, and moderation routes call the
P2-B adapter when operations are enabled. Admin status alone cannot bypass
qualification, conflict, exact-revision, or review-count rules. The staging
adapter bypass test passed.

## 17. Reviewer UI

Operational pages are available at `/review/queue`,
`/review/tasks/[taskId]`, and `/review/operations`. They include queue
priority, claim/lease status, stale-revision warning, provenance and evidence
context, rubric workspace, conflict/recusal, blind-review handling,
disagreement/resolution state, roster/credential operations, coverage,
reporting, and calibration summaries.

## 18. Notifications

The existing notification channel is reused for assignment, eligible
high-risk work, second review, disagreement, escalation, return for revision,
final decision, credential transition, and SLA events. Recipient selection is
assignment-based or eligibility-based, never a broadcast to every role
holder.

## 19. Reporting

Operational reporting includes queue volume/age/p90, SLA state, throughput,
claims, abandoned leases, workload, credential coverage, and uncovered
scopes. Quality reporting includes agreement, disagreement, escalation,
rubric variance, reversal/reapproval, evidence consistency, and calibration
drift. Reports expose sample size and suppress reviewer conclusions below
five comparable assessments. No punitive leaderboard exists.

## 20. Calibration

Controlled quarterly or ad hoc sessions target immutable revisions and
versioned rubric/policy snapshots. Reference outcomes are stored separately
from immutable reviewer results. Calibration creates no P2-A governance event
and cannot affect learner-visible content.

## 21. P2-C extension proof

Credential types and policy specialist slots represent
`WAEC_SUBJECT_REVIEW`, `LICENSED_SOURCE_REVIEW`, and
`SOURCE_RIGHTS_VERIFICATION`. The WAEC staging scenario passed. Licensing,
rights ownership, and source registry behavior remain outside P2-B.

## 22. Staging bootstrap and shadow parity

The roster/task bootstrap remains dry-run only and explicitly refuses role
inference. Final dry-run found 60 synthetic E2E profiles, 60 synthetic E2E
credentials, and 38 exact-revision candidates, and created no tasks. Shadow
parity matched PLATFORM authority with one required review for the canonical
fixture and recorded an audit-only comparison. The branch Preview has
`P2B_REVIEW_OPERATIONS_ENABLED=true`,
`P2B_REVIEW_SHADOW_ENABLED=true`, and the approved staging project ref.

## 23. Staging E2E

Run `p2b-e2e-1786722950519` passed all 33 required scenarios. Coverage
includes school and teacher review, self-review and cross-school denial,
credential state/scope rejection, claim race and lease lifecycle, stale
revision rejection, blind two-person agreement/disagreement, escalation and
resolver, return/reapproval, urgent revocation, two-person reinstatement, no
capacity auto-approval, immutable qualification snapshots, atomic P2-A/audit
composition and rollback, stale-task cancellation, calibration, reporting,
notifications, legacy-adapter enforcement, and WAEC extension.

## 24. Full validation

- `npx prisma validate`: PASS
- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS in 396.4 seconds
- focused P2-B Vitest: 30/30 PASS across 5 files
- first full Vitest run: 4 timeout-only failures, 4,695 tests passed
- unchanged timeout files in isolation: 52/52 PASS
- clean full Vitest restart: 4,699/4,699 PASS across 576 files
- `npm run build`: PASS with exit code 0 and BUILD_ID
  `RJzxDtptoMf0xxTDNyFDF`; local duration 2,698.1 seconds
- staging post-migration preflight: PASS
- staging E2E: 33/33 PASS
- PostgreSQL 17 canonical replay, SQL guards, and two-session concurrency:
  PASS
- tenant isolation and P2-A regression coverage: PASS in full suite
- `git diff --check`: PASS
- exact branch Preview deployment `dpl_BexakpQ4xR8FKqmo4WRZKBa54nfB`:
  Ready and health HTTP 200

The first full-suite timeouts were host-contention artifacts, not assertion
failures. The exact unchanged files passed together before the clean complete
restart. The production build completed with pre-existing warnings and no
fatal error.

## 25. Remaining debt

- The local Next.js build takes about 45 minutes on this Windows host.
  `npm run validate:changed` is now the required inner-loop command; full
  builds are reserved for CI and final gates.
- Locked dependency installation reports 21 existing audit findings: 1 low,
  3 moderate, 14 high, and 3 critical. Dependency remediation requires a
  separate reviewed sprint.
- Synthetic staging E2E fixtures are retained for immutable evidence and
  should be governed by a future staging-data retention policy.
- External notification delivery and browser/device walkthroughs remain
  operational release checks even though notification routing and staging
  service E2E pass.
- P2-C source licensing and rights policy remains intentionally unimplemented.

## 26. Commit SHAs

- `9bdf3da1`: core P2-B implementation
- `1c36ecf9`: feature flags
- `68c8080d`: staging guards
- `22256dd0`: dry-run bootstrap and authority hardening
- `da1866e0`: governed review cycles
- `d753e0db`: staging shadow activation marker
- `bf8731fd`: transaction hardening and 33-scenario staging proof
- `e082d5b6`: staging operations activation marker

## 27. Worktree state

The P2-B branch is pushed and finalized in a dedicated worktree. Generated
build artifacts are ignored. The primary checkout's concurrently selected
documentation branch was not changed.

## 28. Production untouched

No production migration, reviewer profile, credential, task, feature flag,
route cutover, RLS change, P2-A history change, or production deployment was
performed. Production project `bnphuinpvgpmebcsvmsp` was excluded from all
P2-B staging scripts and guards.

## 29. Recommendation

GO for founder/advisor review of a future production authorization package.
NO-GO for production activation until that explicit authorization is issued.

**P2-B FEATURE COMPLETE IN STAGING  PRODUCTION ACTIVATION AWAITS FINAL AUTHORIZATION**

# P1, P2, P5, P7 Recertification

Date: 2026-08-31

Baseline audited: `fd817df48916ab29283bc195e10874ddbab827e9`

This is a current-source recertification. Historical completion records remain
historical evidence; they are not substituted for the status below. The
original acceptance criteria remain in
`docs/roadmaps/PRIORITIES_1_2_5_6_7_EXECUTION_PROGRAM.md`.

## Status vocabulary

- **COMPLETE AND CERTIFIED** means the applicable repository contract and
  test gate are currently evidenced. It does not imply an unrecorded live
  provider or field operation.
- **ENGINEERING COMPLETE - EXTERNAL OPERATIONAL GATE REMAINS** means source
  and tests are complete, while an explicit human, provider, field, or live
  activation artifact is still required.
- **PARTIAL**, **NOT STARTED**, and **BLOCKED BY EXTERNAL DEPENDENCY** are
  intentionally not completion claims.

## Evidence matrix

| Priority | Subphase | Original acceptance criteria | Current source and test evidence | Operational evidence / external dependency | Status | Gap and next action |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | P1-A | Minor fail-closed moderation on tutor, adaptive practice, generated assessment, grading and labs; retryable safeguarding delivery, 24-hour fallback, required audits | `lib/agents/moderation.ts`, tutor/adaptive/WAEC and grading paths; `lib/agents/safeguarding/*`; current focused tests: 54 P1 tests passed, including provider failure, malformed response, inbox and fallback failure cases | No new live provider mutation was performed | COMPLETE AND CERTIFIED | Keep the route-level safety tests in required CI. |
| P1 | P1-B | School scoping, private media, cross-school reads, revoked offline content, signed content, required audit transitions | Tenant and manifest contracts are covered by `__tests__/trust/p1b-content-manifest.test.ts` and the current P1 suite. P5-A adds current signed manifest, expiry, hash, revocation, and multi-key proof | A production signing-key configuration is not evidenced in this audit. Fail-closed behavior protects against an absent key but cannot provide offline packs | ENGINEERING COMPLETE - EXTERNAL OPERATIONAL GATE REMAINS | Record deployed signing-key and manifest issuance proof before calling offline packs operational. |
| P1 | P1-C | MFA enrollment/recovery, step-up for sensitive operations, session invalidation, recovery rotation, rate limits, break-glass, audit | `lib/auth/privilegedIdentity.ts`, Auth0 Action, migration, recovery route, break-glass script and `__tests__/security/p1c-*` are present and pass in the current P1 suite | `docs/security/PRIVILEGED_MFA_RUNBOOK.md` requires real Auth0 tenant/action configuration, migration verification, enrollment and walkthrough. No evidence establishes those actions | ENGINEERING COMPLETE - EXTERNAL OPERATIONAL GATE REMAINS | Owner configures Auth0, enrolls every privileged identity, activates enforcement, and records preview and production walkthroughs. |
| P1 | P1-D | Literal 500-job NR-2 flood with measured drain and non-false acknowledgement of unknown/unimplemented jobs; independent penetration test | This recertification restores `scripts/flood-test-queue.ts` to exactly 500 jobs. `__tests__/scripts/floodTestQueue.test.ts` passes. Worker tests now prove noop and unknown jobs are not deleted as successes and enter retry/DLQ handling | Historical live evidence is only 200 jobs in 10.8s. A 500-job execution mutates the production queue and requires a quiet-window authorization. `docs/security/PEN_TEST_VENDOR_ENGAGEMENT.md` records no vendor engagement | PARTIAL | Run the 500-job test in an authorized window and retain submit/process/fail/drain evidence. Contract an independent vendor, remediate Critical/High findings or obtain formal MOE acceptance. |
| P2 | P2-A | Immutable provenance, lifecycle, reviewer/qualification, approval basis, risk, revocation, machine versus human approval, legacy-unverified | `CurriculumContent`, provenance/revision/governance models and migrations; `lib/curriculum/provenance/*`; current P2 tests passed. `docs/ops/P2A_PRODUCTION_CUTOVER_RECORD.md` records production deployment | Production cutover evidence exists. This audit did not mutate or re-query production | COMPLETE AND CERTIFIED | Continue requiring provenance and governance regression tests. |
| P2 | P2-B | Scoped reviewer roster and credentials, risk queues, high-risk two-person review, decisions, audit, locks, sampling and calibration | `lib/curriculum/review/*`, review routes/UI, and normalized reviewer models exist. Current P2 tests passed | `docs/ops/P2B_PRODUCTION_CUTOVER_RECORD.md` records zero production reviewer profiles and zero verified credentials, with feature activation explicitly NO-GO | ENGINEERING COMPLETE - EXTERNAL OPERATIONAL GATE REMAINS | MOE/qualified reviewers must supply credential evidence; then authorize roster, canaries, and human review walkthrough. |
| P2 | P2-C original licensed past-paper design | Licensed import and claimed WAEC review | Founder decision explicitly retires this design. No past-paper ingestion is used | No external license is required for the replacement contract | SUPERSEDED | Preserve the historical requirement as superseded. |
| P2 | P2-C founder redefined baseline contract | MOE authority, reference-only WAEC baseline, source/version/rights registry, alignment graph, depth taxonomy, AI-assessed labels, gap engine, above-baseline guarantee, original assessment and anti-teach-to-test signals | `lib/curriculum/benchmarking/*`, source/version models, and current P2-C tests prove the contract. `docs/ops/P2C_PRODUCTION_CUTOVER_RECORD.md` records production schema/seed and the flag off | P2-C runtime flag remains off. MOE/human governance is not fabricated | ENGINEERING COMPLETE - EXTERNAL OPERATIONAL GATE REMAINS | Authorize governed activation and reviewer workflow only after MOE/human review. |
| P5 | P5-A | Signed manifests, hashes/versions/minimum client/expiry/revocation, multi-key verification, rollback/replay, tamper rejection, storage pressure, resumable behavior | `lib/content-availability-manifest*`, offline cache and P5-A trust suites. Current P5 suite passed 54 tests, including signature, tamper, expiry, revocation, ordering and multi-key cases | No new production key rotation or signed-pack issuance evidence was obtained | ENGINEERING COMPLETE - EXTERNAL OPERATIONAL GATE REMAINS | Supply an authorized deployed-key/issuance proof. |
| P5 | P5-B | Durable partitioned outbox, idempotency, retry, conflict policy, auth expiry, shared device, clock and disconnection safety, unsupported-action handling | `lib/offline/syncProtocol.ts`, queue/cache/session modules, `/api/student/sync`, and current P5 tests prove sync, conflicts, and partition behavior | This is browser engineering; no physical-device proof is claimed | COMPLETE AND CERTIFIED | Preserve P5-A trust requirements for all future offline actions. |
| P5 | P5-C original classroom hub and field proof | Hub reference architecture, remote update, shared-device mode, local discovery, solar/battery worksheet, replacement process, named low-cost Android, measured 2G/3G | No hub reference architecture, discovery implementation, sizing worksheet, replacement process, named-device report, or measured 2G/3G result was found. `lib/lowBandwidthMode.ts` is only a browser heuristic | Hardware selection is expressly blocked until pilot-school electricity, network, security, device and support constraints are supplied | PARTIAL / BLOCKED BY EXTERNAL DEPENDENCY | Obtain pilot constraints, then produce the hub design and field-test artifacts. Do not call browser emulation field proof. |
| P5 | P5-C later browser/PWA lifecycle program | Service-worker lifecycle, offline reload, persistence, update and browser E2E | `docs/ops/PWA_LIFECYCLE_P5C.md`, `e2e/p5c-pwa-lifecycle.spec.ts`, and current P5 contract tests demonstrate browser implementation | Pixel 5 emulation is not a physical Android device | COMPLETE AND CERTIFIED | This is a parallel later program and does not close original P5-C. |
| P5 | P5-D later storage hardening | Non-physical offline storage safety | `lib/offline/storage*`, `docs/ops/OFFLINE_STORAGE_P5D.md`, and P5 tests cover protected unsynced work, storage failures and safe eviction | Founder explicitly defers physical certification to app-shell phase | COMPLETE AND CERTIFIED | Reopen physical tests only in the app-shell phase. |
| P7 | P7-A | Versioned governed taxonomy for dosage, retention, mastery, adoption, workflow, helpfulness, grounding, hallucination and safety; privacy cohorts, synthetic exclusion and complete metric definitions | **SUPERSEDED 2026-08-31 by merged P7-A PRs #112 and #113.** `lib/measurement/governedMeasurement.ts` now enforces a versioned registry, strict metadata allowlists, validation/quarantine, scoped replay identity, synthetic exclusion, tenant scope, explicit metric windows, and reproducible provenance; contract fixtures cover every required family | No P7 operational evidence is required to define this repository contract | COMPLETE AND CERTIFIED | P7-B may build on this contract. |
| P7 | P7-B | School/class assignment, holdouts, exposure logs, guardrails, sample-ratio checks, early stop, safety restrictions, uncertainty | **SUPERSEDED 2026-09-01 by merged P7-B PR #116.** `lib/experiments/controlledExperiment.ts` enforces deterministic school/class-only assignment, P7-A governed exposure, synthetic exclusion, tenant-bound exposure, allocation and lifecycle validation, safety-policy rejection, conflicts, SRM, early stop, and uncertainty-bearing provenance | No experiment operational evidence is required to certify this repository runtime | COMPLETE AND CERTIFIED | P7-C is the next repository-local P7 gap. |
| P7 | P7-C | Red-team/regression sets by age/subject/language/safety, human sampling, helpfulness/hallucination/moderation FP/FN review, release gates and rollback thresholds | AI quality and NR-14.5 fairness tests strengthen narrow quality controls. They do not form the required sampled quality-operations program or measured rollback gates | Human review sampling and release operations are absent | PARTIAL | Build the governed quality review and release-gate program; do not equate fairness fixtures with P7-C completion. |

## Cross-program reconciliation

- P1-B was strengthened by P5-A. It is not an offline pack operational proof.
- NR-12, NR-13 and NR-14 strengthened P2 curriculum generation and learner-safe
  delivery. They do not enroll human reviewers or enable P2-B/P2-C operations.
- P5-C browser/PWA and P5-D are parallel later programs. They do not satisfy the
  original classroom-hub, named-device, or 2G/3G field criteria.
- NR-14.5 strengthens assessment integrity and P7-C inputs. It does not provide
  P7 controlled experiments, quality sampling, or release governance.

## Remediation completed in this recertification

1. Restored the P1-D flood harness from 200 to the original 500-job threshold.
2. Changed worker noop/unknown handling so those messages are not deleted as
   successful work. They now follow the ordinary retry and DLQ path, with
   `WorkerJobNoop` or `WorkerJobUnknown` metrics rather than completion.

## NR-15 gate

**WAIT FOR REPOSITORY-LOCAL P7 GAPS.** P7-C is not complete. P7-A and P7-B
were certified after this recertification through PRs #112 through #116.
External P1/P2/P5 gates are listed above and must not be misrepresented, but
they do not authorize skipping the repository-local measurement, experiment,
and quality-engine work.

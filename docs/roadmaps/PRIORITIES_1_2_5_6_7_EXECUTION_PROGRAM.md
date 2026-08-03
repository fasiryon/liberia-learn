# Priorities 1, 2, 5, 6, and 7 Execution Program

## Purpose

This program turns the requested trust, curriculum-authority, offline,
distribution, and experimentation priorities into bounded sprints. It follows
the repository rule of one sprint per unattended cycle. No national-readiness
claim is allowed until the applicable gates below pass.

## Program order

### P1-A: Minor AI safety and safeguarding delivery truth

Status: COMPLETE locally on `codex/trust-remediation-1`; awaiting human review
and merge.

Deliverables:

- Minor-facing AI moderation fails closed when the classifier is uncertain,
  malformed, or unavailable.
- Student tutor input and output are moderated.
- Adaptive-practice and newly generated WAEC content are moderated before use
  or persistence.
- Existing minor-facing tutor, grading, and lab paths treat every non-safe
  moderation result as blocked.
- Safeguarding delivery distinguishes intended recipients from confirmed
  durable inbox delivery.
- Failed safeguarding delivery does not create a success marker and remains
  eligible for retry.
- The 24-hour tier requires confirmed platform-fallback delivery.
- Sensitive safeguarding completion markers use required audit writes.

Gate:

- Standard code gate.
- Forced moderation-provider failure returns no raw student-facing AI output.
- Forced inbox and fallback-email failures create failure evidence, not a sent
  marker, and a later run remains retryable.

### P1-B: Tenant isolation, revocation, and required audit transitions

Deliverables:

- Fix school scoping when activating lesson videos.
- Filter curriculum video supplements by school, approval status, and active
  state before resolving private media URLs.
- Distinguish network failure from server rejection in offline lesson fallback.
- Add signed content version and revocation checks to cached content.
- Apply required audit writes to curriculum approval, rejection, privileged
  access changes, and other named sensitive mutations.
- Add route-level tenant tests for every corrected path.

Gate:

- Cross-school activation and media-read tests fail before the fix and pass
  after it.
- Revoked cached content cannot be opened offline after a manifest refresh.
- A forced audit-store failure prevents each named sensitive transition.

### P1-C: Privileged identity hardening

Deliverables:

- MFA enrollment and recovery for ADMIN, MOE, and platform-admin accounts.
- Step-up authentication for exports, role changes, curriculum approval, and
  national controls.
- Session invalidation after role, school, password, or MFA-state changes.
- Recovery-code rotation, rate limiting, and audited break-glass procedure.

Escalation:

- Provider choice and any production-live User schema change require review.

### P1-D: Infrastructure and independent security proof

Deliverables:

- Re-run the literal NR-2 500-job flood and record actual drain time.
- Stop acknowledging unimplemented or unknown worker jobs as successful.
- Complete the external penetration test and remediate all critical and high
  findings, or record formal MOE acceptance.

External actions:

- A qualified independent penetration-testing vendor must be contracted.
- Production credentials and test windows must be approved by the owner.

## Curriculum authority

### P2-A: Immutable lesson provenance and lifecycle

Deliverables:

- Record source standards, generator and model, prompt version, evidence links,
  reviewer identity, reviewer qualification, review date, content version,
  risk score, approval basis, and revocation state.
- Preserve an immutable version history rather than overwriting provenance.
- Separate machine quality-gate success from human and MOE approval.
- Backfill legacy content as `legacy_unverified`, not falsely human-approved.

Escalation:

- CurriculumContent is production-live. Any schema change must stop for review
  before implementation.

### P2-B: Qualified review operations

Deliverables:

- Reviewer roster with subject, grade-band, and credential scope.
- Risk-based queues with two-person review for high-risk cells.
- Fully usable approve, reject, return-for-revision, and revoke interface.
- Required audit writes and conflict-safe review locking.
- Sampling and calibration reports by reviewer and content cell.

### P2-C: Curated WAEC authority

Deliverables:

- Named licensing or curation owner and rights register.
- Import format with source, year, paper, item rights, answer rationale, topic,
  difficulty, and reviewer provenance.
- Generated questions are clearly labeled and never represented as past papers.
- Duplicate, leakage, ambiguity, and answer-key QA.

External actions:

- Obtain a license or written permission where required.
- Contract qualified WAEC subject reviewers.

## Offline core architecture

### P5-A: Signed offline packs and revocation manifests

Deliverables:

- Versioned school and grade packs with size budgets and integrity hashes.
- Signed manifest containing content versions, minimum client version, expiry,
  and revocations.
- Resumable range downloads and storage-pressure handling.
- A revoked item is blocked even when its lesson body remains on the device.

### P5-B: Offline synchronization and conflict policy

Deliverables:

- Idempotent event IDs, resumable upload cursors, retry budgets, and dead-letter
  visibility.
- Explicit policies for assignment, grade, attendance, enrollment, and content
  conflicts.
- Shared-device logout, data partitioning, encryption, and wipe behavior.
- Multi-day disconnection and clock-skew test suite.

### P5-C: Classroom hub and device field proof

Deliverables:

- Local school-hub reference architecture and remote update process.
- Device-sharing mode and local-network discovery.
- Solar and battery sizing worksheet plus replacement process.
- Field test on named low-cost Android devices and measured 2G and 3G profiles.

External gate:

- Do not select hub hardware until pilot schools provide electricity, device,
  network, security, and support constraints.

## Distribution moat

### P6-A: Ministry and county adoption package

Deliverables:

- MOE decision brief, data-processing terms, safeguarding responsibilities,
  implementation RACI, pilot success measures, and exit plan.
- County onboarding checklist and school-readiness assessment.
- Teacher-champion selection, training, certification, and feedback loop.

### P6-B: Telecom, device, and financing partnerships

Deliverables:

- Telecom technical packet for zero-rating or education bundles.
- Device and classroom-hub specification with warranty and repair requirements.
- Donor investment case tied to learning outcomes and cost per active learner.
- Partner tracker with owner, next action, decision date, and evidence link.

External actions:

- MOE endorsement, telecom terms, device procurement, and donor commitments
  require named human owners and counterpart meetings.

### P6-C: Repeatable school onboarding

Deliverables:

- Safeguarding staff assignment is mandatory before activation.
- First academic year, classes, teachers, students, timetable, and first lesson
  are created and verified.
- Support channel, escalation path, and service-level expectations are tested.
- A school cannot become active while required readiness checks are incomplete.

## Experimentation and quality engine

### P7-A: Governed measurement foundation

Deliverables:

- Versioned event taxonomy for learning dosage, retention, mastery movement,
  teacher adoption, workflow completion, tutor helpfulness, AI grounding,
  hallucination, and safety decisions.
- Privacy-safe cohort definitions and synthetic-data exclusion.
- Metric definitions include numerator, denominator, window, eligibility,
  missing-data treatment, and owner.

### P7-B: Controlled experiment runtime

Deliverables:

- School or class-level assignment, holdouts, exposure logging, guardrails,
  sample-ratio checks, and early-stop rules.
- No individual child is assigned to a materially inferior safety policy.
- Analysis distinguishes exposure from assignment and reports uncertainty.

### P7-C: Quality operations

Deliverables:

- Red-team and regression sets by age, subject, language, and safety category.
- Human review sampling for tutor helpfulness, hallucination, and moderation
  false positives and false negatives.
- Release gates and rollback thresholds connected to measured quality.

## Program-level outcome gate

This program is complete only when:

1. Trust defects are closed with live delivery and external security evidence.
2. Approved curriculum has defensible human or MOE provenance.
3. Offline learning survives realistic multi-day disconnection and revocation.
4. Distribution agreements have named owners and recorded counterpart action.
5. Product decisions can be evaluated through governed experiments and
   learning-quality measures.

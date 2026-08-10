# Penetration Test Vendor Engagement (P1-D)

Status: NOT STARTED. This document is the procurement checklist; it does not
constitute a contracted engagement. `docs/security/PEN_TEST_BRIEF.md` is the
technical scope handed to whichever vendor is selected.

## Why this is a separate document

`docs/roadmaps/PRIORITIES_1_2_5_6_7_EXECUTION_PROGRAM.md` lists P1-D's
external-pen-test deliverable under "External actions": a qualified
independent vendor must be contracted, and production credentials plus test
windows must be approved by the owner. Neither of those can be done by an
engineering session; they require a named human decision and a signed
contract. This document exists so that decision has a checklist instead of
being re-derived from scratch each time someone picks this up.

## Vendor qualification criteria

- Independent from LiberiaLearn's engineering team and from any vendor
  that reviewed this codebase before (no conflict of interest).
- Demonstrated experience testing FERPA/COPPA-adjacent child-data platforms,
  or equivalent education/child-safety data-protection experience. This
  platform holds live minor PII (`docs/security/PEN_TEST_BRIEF.md` P0
  scope).
- Comfortable with the stated scope: grey-box web application test,
  Next.js/Prisma/Postgres/Vercel/AWS ECS-SQS stack (see brief for full
  stack detail).
- Can commit to the ~5 business day engagement window and a retest pass
  after remediation (both already assumed in the brief's "Deliverables
  Expected" section).
- References or a sample redacted report available for review before
  contracting.

## Contracting checklist (owner-approved steps)

1. **Select and contract a vendor** against the criteria above. This is not
   something an engineering session can do; it requires a named owner
   decision and a signed agreement/NDA.
2. **Confirm production credential scope with the vendor and the owner
   together**, using `PEN_TEST_BRIEF.md`'s demo account list as a starting
   point, but re-verify those passwords against the live bcrypt hash
   before handoff (see the note added to the brief; do not hand over
   stale/guessed credentials).
3. **Set the test window** outside Liberian school hours where the brief's
   scope overlaps live traffic paths (align with the existing load-test
   window convention: avoid Mon-Fri 08:00-15:00 GMT, per
   `docs/ops/WORKER_DEPLOYMENT.md` / `NR5_LOAD_TEST_RUNBOOK.md`), and
   confirm it explicitly in writing with the vendor and the owner.
4. **Decide `PRIVILEGED_MFA_ENFORCEMENT_ENABLED` state for the test window**:
   test with it off (matches current production state, per
   `CURRENT_EXECUTION_STATE.md`) or stage it on first so the new P1-C
   surface (see brief's "Privileged Identity / MFA" section) is actually
   exercised. This is a real scope decision, not a default; record the
   choice here once made.
5. **During the engagement**: route findings through the vendor's own
   report, not ad hoc messages; do not let engineering sessions "fix
   findings live" without the report first landing in
   `docs/audits/` and being triaged by the owner.
6. **On completion**: remediate all Critical and High findings (per
   P1-D's own gate, or record formal MOE acceptance if a finding is
   knowingly deferred with MOE sign-off), request the retest the brief's
   "Deliverables Expected" section already promises, and update this
   document's Status line plus `CURRENT_EXECUTION_STATE.md` with the
   outcome.

## Status log

- 2026-08-05: Document created. No vendor selected, no engagement
  contracted, no test window set. P1-D's external-pen-test deliverable
  remains fully outstanding pending owner action on steps 1-3 above.
- 2026-08-10: Owner has no budget for a paid engagement. As an interim
  compensating measure (explicitly NOT a substitute for this deliverable
  — see `docs/security/INTERNAL_SECURITY_REVIEW_2026-08-10.md` for the
  same caveat stated at length), an internal AI-assisted static code
  review was run against this brief's P0/P1 items and found 1 CRITICAL
  (`/api/auth/login`: no rate limiting + live hardcoded JWT secret
  fallback) and 1 HIGH (`/api/grading/[submissionId]/override`: missing
  school-scope check) finding; remediation status tracked in the review
  doc. This does not close P1-D's external-pen-test deliverable. Owner is
  considering a bug-bounty / pay-per-valid-finding model (HackerOne,
  Bugcrowd, or self-hosted) as a lower-cost path to a genuinely
  independent test; no such program has been set up yet.

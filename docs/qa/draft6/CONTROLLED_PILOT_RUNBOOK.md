# Draft.6 controlled student Learning Preview

The pilot infrastructure is prepared locally, with its server flag off and no active release policy. Five exact revisions have founder-reported conditional AI academic acceptance. This is advisory acceptance, not a human subject-expert decision, pilot-release authorization, or official publication approval. Civics is excluded in code. No draft.7 was generated.

## Delivery and authority

The separate route is `/learn/preview/factory@4.0.0-draft.6@<lesson-key>`. It uses the real LessonPlayerV2. Both the page and API require `V4_LEARNING_PREVIEW_ENABLED=1`; absence and every other value deny access. The page and API are dynamic and uncached. There is no latest alias, version fallback, student POST handler, assignment creation or evidence submission channel.

Every request rechecks the current STUDENT role, active school, undeleted Student record, explicitly listed user ID, and an Enrollment in an explicitly listed own-school Class. Existing academic enrollment, when present, must have ACTIVE status in an active academic year covering the request time. Grade or subject alone cannot grant access. Duplicate active school policies fail closed. DB or package-integrity errors deny access.

The server reads the primary database directly through the existing Prisma singleton. It does not use the policy engine's cache or fallback defaults. Deployment must use the primary writer connection for this policy, not a lagging read replica. All existing official delivery rules, including PUBLISHED plus APPROVED, remain unchanged. The sealed experience retains CURRICULUM_V2_DRAFT authority; no release ID is invented.

The derived pilot view has a separate `pilot:` experience ID, no offline package, no tools/tutor links, no evidence contracts and no assessment handoff. Its final scene says no graded assessment is available. The player keeps progress only in React memory and never reads or writes historic IndexedDB lesson progress. Finishing produces a PILOT_ONLY acknowledgement without constructing or submitting evidence. The banner says "Pilot lesson — not graded". The exact projection checksum returned by the API identifies the sealed source projection, not this derived view.

## Operator records, absent until separately authorized

No schema or migration is needed. Two existing PolicyConfig record types are read by this pathway. This PR has no endpoint, seed or automation that creates production approval records.

1. One active SCHOOL-scoped PolicyConfig with policyKey `V4_DRAFT6_LEARNING_PREVIEW`, correct schoolId and config matching `previewPolicySchema`. It contains the pilot's finite UTC window, user IDs, class IDs and exact selection/hash entries. Maximum window is fourteen days and maximum cohort is two hundred explicitly listed users. Each lesson has `revokedAt`, `approvalRecordId`, and real content, rights, access, accessibility, safety, runtime and release-authorization references. [pilot-policy.disabled.json](pilot-policy.disabled.json) is a disabled example with no lessons or users; it is not loaded automatically.
2. Each lesson points to a separate active SCHOOL-scoped PolicyConfig with policyKey `V4_PILOT_RELEASE_APPROVAL`. Its creator must currently be an ADMIN with isPlatformAdmin=true. Its config is `{status:"AUTHORIZED_PILOT_RELEASE", bindingSha256, auditLogId}`. `pilotApprovalBinding` hashes PILOT_ONLY, school, sorted class IDs, sorted user IDs, start/end dates, selection, package hash, the seven review references and the approval record ID. Changing any bound value invalidates that authorization.
3. The referenced existing AuditLog must name the same creator and school, action `V4_PILOT_RELEASE_AUTHORIZED`, resourceType `PolicyConfig`, resourceId equal to that approval record ID, and details.bindingSha256 equal to the binding. These names specify a new pilot-only audit contract. They do not assert that any real approval or audit record already exists. An authorized operator must record the actual decision through a separately reviewed operational workflow. This work creates only explicitly synthetic fixture records in its disposable test database.

Review-reference strings alone do not grant access. Neither an AI recommendation nor an existing curriculum approval is substituted for the separate pilot authorization and linked audit record. Conversely, pilot authorization cannot satisfy any official curriculum publication gate.

## Revocation and rollback

For one lesson, an authorized operator sets that allowlist entry's revokedAt to the actual UTC revocation time, or deactivates its separate approval record. The next server request denies access immediately. For the whole pilot, disable or deactivate the school policy, or set its revokedAt. Removing a user from studentUserIds or deleting their roster membership also denies the next request. No deployment is needed for database revocation.

The open browser revalidates every two seconds and has a 2.5-second request timeout. While offline, hidden or temporarily unable to verify access, it hides and inerts the mounted player, preserving progress only in React memory. Returning to the foreground requires revalidation before interaction resumes. Definite denial, expiry and revocation unmount the player and discard that memory. Foreground removal after revocation is bounded by the polling interval plus the timeout, normally faster. This is immediate server revocation with bounded open-player removal, not instantaneous recall of bytes already delivered. No offline pilot delivery is supported. Screen copies or a malicious client cannot be remotely erased.

Heartbeats perform only current authorization checks and return no content. They do not rehash files or rebuild projections. Every new full page/API content delivery verifies all pinned package bytes and validates the derived pilot scene contract. An existing memory view is already bound to verified source bytes; changing files on disk cannot alter it or authorize a new content response. The full GET API remains available for verified authenticated delivery and browser verification; it is not an offline-cache endpoint.

Emergency rollback order:

1. Revoke/deactivate the relevant database policy or approval records first, across the primary database used by all replicas.
2. Set `V4_LEARNING_PREVIEW_ENABLED=0` in the authorized deployment configuration and restart/redeploy through the normal approved process if needed. The environment flag is process configuration, not an instant multi-instance control.
3. Verify page/API denial using an enrolled student's session and confirm an already open player disappears. Preserve the genuine authorization and revocation audit history.
4. If code rollback is required, revert only the pilot infrastructure commit. Do not remove or regenerate the six candidate packages, handoff or review archive. There are no migrations or official learning-state writes to reverse.

No live rollback, flag change, policy write or deployment is authorized by this runbook.

## Activation checklist

- [ ] Founder authorizes the focused pilot PR to be pushed/reviewed; merge and deployment need separate authorization.
- [x] Claude acknowledges the supplied loader/player interface in a read-only AI review. See [the response and disposition](CLAUDE_PILOT_REVIEW.md).
- [ ] The frontend owner confirms no overlapping edits and reviews the final runtime/accessibility evidence after the fixes described in the [coordination handoff](../../architecture/content-factory/DRAFT6_PILOT_CLAUDE_COORDINATION.md).
- [ ] Resolve the reported dependency-audit findings through security review or an explicit authorized disposition. The infrastructure diff changes no dependency versions.
- [ ] Complete CI on the actual integrated commit, including security, production build and browser checks. Local results are evidence, not a fabricated hosted CI run.
- [ ] For every proposed hash, finish the real content, rights/attribution, tenant/access, keyboard, screen-reader, small-screen, safety and runtime checks and retain their evidence references.
- [ ] Confirm fractions' current CHECK-based delivery is approved for the pilot. Typed-rational input remains pending and must not be silently introduced. Verify science plot/text parity.
- [ ] The designated release authority records a genuine, exact-package, exact-cohort, exact-window pilot authorization and linked audit record. No human subject-expert event may be inferred from AI acceptance.
- [ ] Verify the cohort's current roster and academic-year membership, parent/child-data requirements, finite UTC start/end, and primary DB connection. Do not use production for testing.
- [ ] Keep Civics absent. A real map, accessible spatial alternative, integration tests and academic verification require their own reviewed change before its code exclusion can be reconsidered.
- [ ] Start with a disabled school policy and empty active allowlist. Test revocation against the approved non-production deployment with synthetic accounts.
- [ ] Obtain explicit founder activation authorization before enabling any policy, allowlist or feature flag in a student environment.

## Reproducing local checks

`scripts/content-factory-v4/pilot-validation.cjs` strips inherited app credentials and uses only the disposable loopback PostgreSQL endpoint at port 55447, database draft6_preview_validation, user preview_test. It refuses local application environment files. Its focused mode opts into the real DB suite, which checks the exact URL, database name and user before seeding. Its full tests mode leaves that integration suite disabled to avoid concurrent fixture writes; run focused separately. The isolated schema uses the cached pgvector PostgreSQL 17 image. The earlier plain PostgreSQL attempt failed on the vector type and was not used for authenticated testing.

Run generate, types, focused, changed, tests, vault, security and build modes. After build, run renderer. A start mode launches only the loopback synthetic test server. `node scripts/content-factory-v4/pilot-browser.cjs --isolated-synthetic` uses synthetic encrypted NextAuth sessions against it and leaves synthetic policies inactive in a finally block. Run pwa and fixtures modes for the remaining CI browser steps. Do not run fixture-mutating suites concurrently against the same disposable database.

`node scripts/content-factory-v4/verify-draft6-export.cjs` verifies the original ZIP checksum, size, inventory, CRC and every entry against its receipt and current repository bytes. The complete ZIP can be attached by the founder; it includes all six immutable packages and their reviewer-only answers, not protected independent assessment keys.

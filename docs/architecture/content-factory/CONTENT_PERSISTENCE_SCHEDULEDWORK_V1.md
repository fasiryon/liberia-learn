# Content persistence and ScheduledWork version pins V1

Wave 3A expands the schema and supplies storage/delivery boundaries. It does not
approve or publish curriculum, change mastery or orchestration, or enable hosted
governed writes. Base: `86139e2d051ad229b085313b085d2a48f4f23ebd`.

## Storage decision

`ContentBundleRecord` stores sealed canonical JSON with indexed bundle identity,
schema version, exact V1 content hash, release identity/reference, owner scope,
creation time and creating actor. The envelope contains both `manifest` and
`revisions`, which the Wave 2 resolver needs to reconstruct exact authority reads.
JSON preserves composition without separate tables for every evolving member
shape. Normalized member tables would duplicate V1 validation and create premature
schema coupling. Later migrations can index/extract members from immutable JSON.

`compositionHash` separately hashes canonical JSON for the complete envelope.
V1 `contentHash` deliberately excludes renderings and some governance references;
it remains unchanged as a hashing convention. The envelope digest detects changes
to excluded metadata and revision pins. Neither digest is a release attestation.
Reads verify both integrity and indexed identity before returning a composition.

## Ownership and allocation (DEC-011)

Identity, ownership and allocation are separate:

- `(bundleId, bundleVersion)` is one global, immutable identity. A record is stored
  once; its payload is never copied to distribute it.
- `ownerScope = NATIONAL` (no owner school). A national record is available to a
  school **only** through an `ACTIVE` `ContentBundleAllocation` for that exact
  record (exact version). Existence alone grants nothing.
- `ownerScope = SCHOOL` with `ownerSchoolId`. The bundle id must start with
  `school.<ownerSchoolId>.`; national ids may not start with `school.`. A PostgreSQL
  CHECK enforces these namespace rules as collision protection, never authorization.
  Scoped ownership and allocation checks authorize reads independently of the id.
  School records are visible only to the
  owner and cannot be allocated, so they never become national through allocation.
  National availability of school-authored content requires a separate governed
  process that stores a new NATIONAL record.

`ContentBundleAllocation` records `schoolId`, the exact record, a required
`governanceRef` naming the decision elsewhere, the granting actor and time. It may
only move `ACTIVE -> REVOKED` (with revoking actor, time and reference); identity
fields are frozen, rows are never deleted or truncated, and at most one `ACTIVE`
allocation exists per school and record (partial unique index). A revoked school
may be re-granted by a new row; history is retained. Allocation rows invent no
permission: no route creates them, and who may grant or revoke is an open
governance decision. Ordinary runtime users must have no grant/revoke access until
an audited governance authorization service exists; a `governanceRef` or actor id
alone cannot authorize a decision. Creating actor is provenance metadata, not review
authority. The national registry, school ownership and explicit exact-version
allocation model above is the locked DEC-011 contract.

Revocation preserves historical assignments and their exact pins, attempts,
evidence and mastery. It changes only the allocation state; it does not delete,
rewrite, unpin or regrade learner history. New governed scheduling and delivery
remain fail-closed for the revoked school until an approved continuation/withdrawal
policy is implemented. Retained history never implies continuing delivery access.

Scoped reads authorize before verifying integrity: an unauthorized school receives
`null` for a foreign, unallocated, revoked, corrupt or absent record alike.

## Immutability

The repository exposes insert and exact reads, with no update/upsert/delete API.
Writes validate and seal with existing V1 code, recompute the hash and reject a
declared stale hash. Strict revision-pin and envelope validation excludes learner
state. A unique database constraint rejects concurrent duplicate versions.
PostgreSQL triggers reject UPDATE, DELETE and TRUNCATE on the complete record,
following existing curriculum-history conventions. Corrections require a new
version. RLS is enabled and direct anon/authenticated grants are revoked.

Prisma cannot model the triggers. Raw SQL/server-owner INSERT can bypass the
service validator; a database owner can also disable triggers. Restrict privileged
access operationally. Reads still reject malformed/corrupt rows. Hashes provide
integrity checking, not signatures against an attacker with full database authority.

## Repository and resolver

`createContentBundleRepository(db, schoolId)` exposes:

- `storeSchoolContentBundle(composition, createdById)` (owner namespace required)
- `getContentBundle(bundleId, bundleVersion)` (owned, or national with an ACTIVE allocation)
- `getContentBundleByHash(contentHash)` (returns only compositions visible to the school)

`createNationalContentBundleStore(db).storeNationalContentBundle` stores national
compositions and `createContentBundleAllocationStore(db)` exposes `grant`/`revoke`.
Both are internal mechanisms with no route or runtime caller. Envelopes that use
Activity Wave `activityReferences` must carry one exact revision pin per pointer.

`withPersistentComposition` replaces only composition reads on an existing
server-owned authority reader. Flow: exact id/version → scoped stored envelope →
hash/identity verification → existing release, revision and resource authority →
learner projection → bounded diagnostics. Missing/corrupt storage has no fixture,
current-row or latest fallback. Fixture readers remain available for tests.

Teacher Preview retains its existing role, school and bundle membership checks.
The existing permitted readiness alias can read stored exact versions. It has no
write path and gains no additional bundle authorization. Missing production exact
revision/source/media/assessment/toolkit adapters remain unavailable/incompatible;
the default reader deliberately supplies null for these unresolved authorities.
Persistence alone cannot make the real Grade 4 bundle READY or released.

## ScheduledWork

Six nullable fields are additive: `bundleId`, `bundleVersion`,
`bundleContentHash`, `itemId`, `itemVersion`, `itemKind`. Existing `contentId`
and its foreign key remain required and unchanged. The compatibility content row
is a legacy link, not authority for governed delivery. `itemKind` is a stable string
validated against existing `GOVERNED_ITEM_KINDS` (LESSON, CLASSWORK, HOMEWORK,
PRACTICE, PROJECT, INVESTIGATION, PRACTICAL, GROUP_WORK, QUIZ, ASSESSMENT, LAB).
This avoids a second enum and premature Prisma migration coupling.

`classifyScheduledWork` returns:

- `LEGACY_UNPINNED`: all six fields null/absent; legacy callback runs unchanged.
- `GOVERNED_PINNED`: all six fields syntactically complete, exact and valid.
- `INVALID_PARTIAL_PIN`: any incomplete/invalid pin set; fail closed.

Pinned classification is structural, not proof of current release authorization.
`readScheduledWorkDelivery` validates exact bundle/hash/member/version/kind through
the governed resolver and returns only learner-safe content. No invalid governed
result invokes legacy. The enrolled student work route consumes this helper before
legacy progress/audio/payload delivery; unavailable governed work returns 409.
The lesson experience seam (`GET /api/student/lessons/:id/experience`, the learner
page's first call) reads scope and the six pins first and refuses GOVERNED_PINNED
(`GOVERNED_WORK_UNAVAILABLE`) and INVALID_PARTIAL_PIN (`INVALID_GOVERNED_PIN`) with
409 before loading any legacy content; foreign learners receive the ordinary 404.
Legacy audio generation and answer release reject governed/partial pins instead of
reading mutable legacy payloads. Legacy quiz context, completion and offline progress
also reject those records before learner-state or mastery side effects. Existing
legacy grading/mastery rules stay unchanged; governed student-state references are
deferred to a later mission. Other Today/Learn surfaces remain unchanged;
do not enable governed classroom writes
until all intended consumer routes have been audited and integrated.

`createGovernedScheduledWork` validates scoped storage, existing authority, exact
pins, class/content grade/subject, actor school and teacher/admin authority. Teachers
must be the class owner in V1; broader teacher allocation policy is not invented.
A serializable transaction writes all pins with one create call and records an
AuditLog entry in the same transaction. It accepts class
scheduling only; no attempts, submissions, evidence or student state are migrated.
No public route enables this writer in this mission. The stored bundle must be
visible to the class's school (owned, or national with an ACTIVE allocation) inside
the serializable transaction, so a concurrent revocation cannot be bypassed.

Activity Wave: a governed ActivityDefinition pointer (`activityId`, `version`, `kind`)
pins as `itemId`, `itemVersion`, `itemKind` with the same `ACTIVITY_KINDS`
vocabulary; no schema change is needed. Restriction: `ScheduledWork.contentId` is a
required legacy foreign key to `CurriculumContent`, and `createGovernedScheduledWork`
requires that `contentId` to be a LESSON member of the bundle. A governed activity
assignment therefore needs an explicitly selected lesson anchor; activity-only
ScheduledWork is unsupported. Never silently attach an arbitrary lesson. Such
assignments need a later reviewed decision (nullable/alternate anchor), not part of
this additive migration.

Future attempts, submissions and evidence attach `GovernedContentRef`
(`bundleId`, `bundleVersion`, `itemId`, `itemVersion`, `itemKind`) and optionally
the delivery hash. They never embed learner state into the bundle.

## Backfill

`analyzeScheduledWorkBackfill` classifies SAFE_TO_PIN, AMBIGUOUS,
NO_GOVERNED_MATCH, ALREADY_PINNED and INVALID_PARTIAL_PIN. SAFE proposals include
all six pins. A syntactically pinned row is ALREADY_PINNED; delivery integrity and
revocation still require the delivery reader. Existing ScheduledWork has no
historical version; mutable current content/version is insufficient evidence.
Explicit historical correspondence must identify work id, school, content id and
exact ref. Multiple distinct correspondences are ambiguous. A unique correspondence
still must resolve existing governed authority, class grade/subject and the legacy
content link before becoming SAFE_TO_PIN. Proposed/written data contains only the
six pin fields; a correspondence cannot repurpose legacy fields.

`npm run content:scheduledwork:analyze -- --dry-run` is read-only and requires a
loopback database URL. Optional `--matches <file>` supplies a JSON array of reviewed
historical correspondences. Without it, no legacy version is guessed. Default
production authority gaps mean no safe pins are fabricated. No CLI write mode or
hosted authorization flag is implemented. The local-test application helper defaults
to dry run and accepts only safe rows and an explicitly local conditional writer.
It rejects production mode and non-loopback DATABASE_URL/DIRECT_URL configuration,
and supplies an atomic predicate matching id, school, the `contentId` and `classId`
observed during analysis and six NULL fields; a row edited or pinned after analysis
matches nothing and is reported in `refused`, never written;
production implementation must re-analyze under a transaction, independently
authorize scope and use compare-and-set, never a stale report as authority.

## Migration phases and recovery

1. Expand: new append-only table, nullable pins; preserve old paths.
2. Deploy compatibility reads, then explicitly enable exact governed writes only
   after authority/consumer readiness is established.
3. Analyze legacy correspondence; review counts and safe proposals.
4. Separately authorize backfill and observe old/new behavior.
5. Later require complete pins for governed content.
6. Retire legacy paths only in a later authorized mission.

Canonical migration: `20261013_000001_content_bundle_scheduledwork_pins`.
The legacy migration root remains untouched. Metadata locks have a five-second
timeout; statements have a five-minute cap. The existing-table index uses ordinary
CREATE INDEX inside the migration transaction; operators must plan a maintenance
window for its locking/scan cost. Timeout is a safe failure, not permission to
increase lock exposure automatically.

Code rollback retains expanded schema and data. Old code cannot distinguish pins,
so disable governed writes/delivery before reverting to a legacy-only application.
Do not drop the table, columns or immutable history to roll back. Prisma does not
automatically supply safe down migrations. Failed deployment requires inspecting
the migration ledger/catalog and a reviewed forward fix, or approved recovery from
backup. Future hosted order and explicit authorization are in the separate runbook.

## Validation and unresolved readiness

The local validation script replays canonical SQL on disposable PostgreSQL 17,
adds a representative legacy row, applies this migration transactionally and checks
row preservation, indexes, RLS, grants, uniqueness and mutation guards. Real Prisma
integration also checks storage round-trip, resolver reads, transactional
schedule/audit creation, zero-write dry run and idempotent local compare-and-set.
The analyzer CLI runs read-only on that same disposable database. It does
not claim production lock timings or automatic rollback. Unit tests exercise storage,
resolver, preview, compatibility, governed writes and analyzer states; build/types
and changed-file checks are required before handoff.

Unresolved: real approved exact authority adapters, who may grant/revoke national
allocations and how revocation treats already-assigned work (V1 fails closed),
reviewed historical correspondence, remaining auxiliary governed consumers, hosted
write implementation/authorization, package closure and existing lab revision gaps.
These remain explicit rollout prerequisites; no release/publication is inferred.

## Local handoff evidence

Repair branch `feat/content-persistence-scheduledwork-v1-repairs` (from `1d2cbf50`,
with main `1e196d94` / Activity Wave merged). Local and disposable only; no hosted
migration, backfill, allocation, publication or deployment occurred.

- Full Vitest suite: 758 files, 7417 passed, 8 skipped, 0 failed (the canonical
  baseline and P2-A writer-guard regressions are fixed; the runtime check seeds its
  lesson through the approved curriculum writer as non-authoritative draft content).
- `validate:changed --base 1e196d94`: PASS (Prisma validation/generation, TypeScript,
  29 related files / 502 tests). Changed-file lint: 0 errors. TypeScript: clean.
- Production build: 387 static pages. Loopback production boot: homepage HTTP 200
  with unreachable local-only DB URLs (not hosted or logged-in session evidence).
- `scripts/verify-content-persistence-migration.ps1`: PASS. Canonical replay, an
  existing legacy row kept with six NULL pins, indexes, RLS/grants on both tables,
  append-only record and allocation guards (including TRUNCATE CASCADE), and
  namespace-squatting refusal; then real Prisma: national reuse across two schools,
  school-private isolation, cross-school and missing-allocation denial, exact-version
  allocation, one-way revocation with re-grant history, atomic schedule/audit, and a
  backfill whose stale proposal is refused while a concurrent teacher edit holds the
  row lock (idempotent rerun writes zero).
- Full canonical PostgreSQL 17 bootstrap: PASS (22 migrations, 239/239 tables with
  RLS, 0 anon/authenticated P2-C grants, no unregistered Prisma diff keys); the new
  function/trigger/check/partial-index hashes are pinned in
  `postgres-object-manifest.json`, and a deliberately altered pin fails the bootstrap
  with a manifest hash mismatch. Under Windows PowerShell 5.1 the bootstrap's
  pre-existing P2-B probe treats expected psql stderr as fatal; local runs used an
  uncommitted copy relaxing only that line.

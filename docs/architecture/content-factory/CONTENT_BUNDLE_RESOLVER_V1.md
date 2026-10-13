# ContentBundle read-only resolver V1

Wave 2B; repository evidence at base `f28f71070ba2676b28aab59502146dd187886608`.
This slice implements resolution and audience boundaries, with no routes, UI,
schema changes, publication, hosted reads/writes, or deployment.

## Contract

`resolveContentBundle(input, authorityReader)` is an async server service in
`lib/content-bundle/v1/resolver.ts`. Input requires `bundleId` and exact
`bundleVersion`, with optional `expectedContentHash` and `releaseIdentity`.
Empty identities and mutable `latest`, `current`, and `*` aliases are rejected.
The reader resolves the immutable composition snapshot and its pinned revisions;
the resolver validates the manifest and reconciles each member with the adapter
output from its exact governed revision. There is no title matching or fallback
to a mutable current curriculum row.

Results always include `status`, `bundle`, `learnerProjection`, and `diagnostics`.

| Status | Meaning | Content returned |
| --- | --- | --- |
| RESOLVED | All exact references, digests, governance and projection checks pass | Sealed V1 manifest and keyless learner projection |
| UNAVAILABLE | Composition/release is absent or authority reads failed | Both content fields null |
| INCOMPATIBLE | Declared identity, structure or authority cannot be reconciled | Both content fields null |

Diagnostics contain stable `code` and `path`; they exclude raw reader errors,
review notes, credentials and source snapshots. Failure never returns a partial
classroom manifest. The successful raw bundle is server-only.

## Authority dependencies and adapter obligations

`ContentBundleAuthorityReader` is a read-only port, not an approval engine.
Construct readers on the server; never deserialize them or their governance
results from a client request. All reads must describe one immutable, coherent
authority snapshot. The immutable composition owns revision/provenance/hash pins.
The existing revision system owns approval and lineage, not this resolver.

`createRepositoryContentBundleReader(storedReaders)` binds the existing published
registry, `CurriculumOntologyRelease` validator/identity, governed cell inventory,
and Curriculum V2 runtime tool registry. It takes exact stored composition,
revision, resource/media, asset/rendering and curriculum source-authority readers. There is no
durable ContentBundle store at this base; this service deliberately does not
create one or reinterpret an unreviewed definition as released.

Existing provenance revisions supply schema version, snapshot and digest.
`hashCurriculumSnapshot` verifies that digest using the existing hash convention.
Adapters must replay existing governance events, corrections and revocation for
the pinned revision and return VERIFIED lineage and APPROVED lifecycle. They
must derive V1 member metadata from that exact snapshot. Native lessons carry
the existing `CurriculumLessonV2` definition: contract, objective IDs, identity,
title, duration, release pins and blocking review gaps are reconciled. Embedded
generation-time DRAFT flags do not approve a lesson. Native adapters must
include `nativeLesson`, restoring it from the exact revision rather than a
current row. Release-bound payload digests and revision-snapshot digests have
different scopes and are checked separately.

`readCurriculumAuthority` resolves the exact objective/standard/source-version,
concept and construct subset from existing verified source/cell/release records,
including source rights eligibility. Every field must match the manifest.
`readResource` returns the exact approved version/audience/media metadata;
`readAsset` and `readRendering` reconcile their exact versions, audiences and
declared digests against existing approved asset/artifact records;
unverified rights or metadata must return null. These reader contracts are
dependencies, not evidence that hosted revisions/media have been verified.

The legacy `getCurriculumProvenanceExplanation` reads `currentRevision`; it is
not used as a historical revision authority. Existing lesson delivery remains
responsible for tenant/enrollment/runtime eligibility. The resolver neither
replaces it nor delivers lesson scene bodies or assessment questions.

The repository reader returns no AssessmentDefinition or toolkit mapping at
this base because neither has a reviewed exact registry for this composition.
Future adapters can implement the same port without unifying question banks.
Assessment adapters must match definition/version, ordered items and order
policy. Only release-bound exact item identities and server single-choice
scoring are accepted; legacy answer-bearing stores, unsupported scoring and
missing pins have distinct gaps.

## Fail closed and hashing

The V1 seal/validator runs before authority resolution. A stale declared hash
fails validation; it is never cleared or silently resealed. An initially unsealed
exact composition can receive its deterministic V1 digest only after all checks
pass. Optional expected hash/release pins are compared, not substituted.
Version, grade/subject, release identity and source-authority disagreement block.
Missing/unpublished/unapproved/invalid release, inventory/objective/concept/
construct failures, missing item revisions, mismatched provenance, revoked or
unverified lineage, snapshot or release payload hash drift, member version/content
drift, asset/rendering digest or version mismatch, unresolved resources/tool mapping, unknown governed/runtime tools and
invalid assessment identity all withhold both content outputs.

Current `LearningExperienceLink` has no stable immutable `linkRevision`.
Every lab member is therefore rejected with
`LAB_REVISION_CERTIFICATION_UNRESOLVED`, even if it asserts a plausible revision.
Optional labs are not silently removed and the bundle is not resealed to hide
them. No Grade 4 fractions lab is certified or runnable in this proof.

## Audience boundaries and Teacher Preview

The existing V1 allowlist removes assessment keys and item lists, scoring guides,
teacher instructions/resources/assets, reviewer notes, governance internals,
extensions, internal tool configuration, prohibited tool bindings, and teacher
guide renderings. Defense-in-depth checks reject privileged resource/asset
references and secret-bearing learner configuration. Reviewed learner strings
remain reviewed content; this is not a classifier for secrets hidden in prose.

`createTeacherPreviewResolver(reader, authorize)` creates a server/API-layer
function. It awaits the caller's existing RBAC and tenant authorization before
any authority read. The caller must bind this callback to the authenticated user
and requested school/content scope; there is no public unauthenticated route.
Output includes `status`, `bundle`, `learnerProjection`, `teacherMetadata`, and
`diagnostics`. In this preview DTO, `bundle` is the learner-safe view, while
teacher metadata contains bundle identity/hash and teacher resource ID/version/
kind/title only. Raw snapshots, internal configuration, review records, media
URLs and secured contents stay server-side. Teacher resource access remains a
separate authenticated service concern.

## Grade 4 fractions repository readiness

`grade4FractionsReadiness()` reports **PARTIAL**, with `bundle: null`.
PARTIAL records resolved dependencies, not classroom readiness. It exposes
keyless identities from the real published registry/inventory:

- Release `lr-moe-g4-math-fractions-2026.1`, founder review, MOE NOT_CLAIMED.
- Objective `moe-math-g4-s1-p3-number-theory-and-fraction-obj4` maps to a governed
  concept in the inventory.
- Lesson `ll-g4-math-fractions-equal-parts-2026.1`, version `1.0.0`.
- Three exact release item identities and construct bindings.

Structured blockers: missing immutable composition/version; source-version/
rights verification; missing lesson payload hash in the 2026.1 binding; unverified
stored approved exact revision; set-specific assessment bank gap; missing
AssessmentDefinition; legacy assessment identity/version and answer-bearing
store gaps; activity definition revisions; reviewed `fraction_strips` mapping;
lab revision/certification; resource/media revisions; offline package closure.
Unsupported scoring is separately rejected when an assessment adapter reports
it. No bundle version/hash, missing assessment identity or lab revision is minted.
The 2026.2 candidate is not in the published registry and is never promoted.
No hosted availability claim is made.

## Verification and next dependency

Focused tests exercise synthetic success, deterministic repeated resolution,
unchanged reader inputs, DB-client import exclusion, missing release/objective/
revision, unapproved release, bundle/member version drift, stale/expected hashes,
provenance and snapshot mismatch, revocation, toolkit and assessment failures,
legacy/unsupported assessment gaps, learner secrecy and closure, lab block,
authorization before reads, sanitized reader errors and real repository readiness.
The synthetic fixture remains test-only; synthetic reader approval states are
never production review evidence. Required gates are ContentBundle/resolver
tests, TypeScript, changed-file lint and `validate:changed`.

The next authority handoff is reviewed immutable composition and exact stored
revision/source/media adapters, followed by reviewed assessment definitions and
tool mapping. A Teacher Preview UI can consume the authorized DTO seam without
turning these blockers into fabricated classroom authority.

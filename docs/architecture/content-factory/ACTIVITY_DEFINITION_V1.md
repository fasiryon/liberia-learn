# Governed ActivityDefinition V1

Wave 3A, based on `86139e2d051ad229b085313b085d2a48f4f23ebd`.
This is a read-only content authority contract. No routes, database migrations,
classroom assignment migration, content publication or deployment are included.

## Identity and content

`ActivityDefinitionV1` in `lib/activity-definition/v1/types.ts` identifies one
immutable definition by stable `activityId` and exact `version`. `kind` is one
of CLASSWORK, HOMEWORK, PRACTICE, PROJECT, INVESTIGATION, PRACTICAL or GROUP_WORK.
Blank identities and `latest`, `current` and `*` aliases are rejected.

The definition carries title, objective IDs, exact lesson bindings where
applicable, ordered learner and teacher instructions, exact resource metadata,
duration, collaboration mode, evidence intent, accessibility, scaffolding and
an optional exact rubric reference. Strict allowlists reject unknown fields at
every object boundary, including approval flags and student state. No generic
extensions escape hatch is provided. Shared pedagogical vocabulary is reused
from ContentBundle V1; `activityBundleMember` restores its existing display shape.

## Existing governance and release

There is no activity approval ledger or approval boolean. `ActivityRecord`
points to the existing `RevisionPin`; the reader restores a `ResolvedRevision`
from immutable provenance snapshots and replays existing review/governance,
including corrections, supersession and revocation, for that exact revision.
The snapshot's `activityDefinition` must equal the requested definition and its
allowlisted `member` must equal the ContentBundle adapter output. Snapshot
digests use existing `hashCurriculumSnapshot`; provenance must be VERIFIED.

Existing lifecycle states are DRAFT, PENDING_REVIEW and APPROVED; REJECTED,
REVOKED and SUPERSEDED cannot resolve. A reviewed candidate is bundle eligible
only when APPROVED and bound to an existing PUBLISHED, APPROVED ontology release.
RELEASED is derived eligibility, not a new stored lifecycle state. Each bound
objective must have an ACTIVITY content binding with matching activity ID,
version and semantic digest, tied to the inventory concept for that objective.
The sole release primitive extension is the ACTIVITY content binding type.
No registry release, review decision or published curriculum is changed here.

Generators may draft definitions. They cannot provide lifecycle authority.
Existing qualified human review remains responsible for approval. Server
adapters must enforce that review provenance; legacy role-derived or automated
approval must not be promoted into this authority. Governance reference lists
are pointers, never proof of an approval on their own.

## Resolver

`resolveActivityDefinition({ activityId, version, authorityContext })` returns
RESOLVED, UNAVAILABLE or INCOMPATIBLE, with no partial definition on failure.
Construct `authorityContext` and its read-only readers on the server using
existing RBAC/tenant policy; never accept authority adapters from client input.
All readers must describe one coherent immutable authority view.

The default requires release eligibility. Explicit `requireReleased: false`
supports inspection of DRAFT/PENDING_REVIEW content against an existing published
curriculum release; it waives activity approval and activity release membership
only. It never permits revoked content, invalid lineage, unknown objectives or
unverified resources. Bundle resolution always requires release eligibility.

Checks include exact identity, structural allowlists, semantic and snapshot
digests, snapshot/member reconciliation, provenance/revision pins, replayed
lifecycle, release identity/provenance, objective/source authority, exact lesson
versions, resource version/audience closure and optional rubric integrity.
Readers must return null for resources or rubrics lacking existing approved
version/rights authority. A rubric scoring guide must resolve to a non-learner
SCORING_GUIDE resource. Learner instruction and alternative-format resources
cannot expose teacher notes, keys or scoring guides. Missing storage or failed
reads return UNAVAILABLE; incompatible content returns INCOMPATIBLE. Raw reader
exceptions are withheld. The resolver exposes no write operations.

## Hash and immutability

`hashActivityDefinition` uses domain-separated SHA-256 and the existing curriculum
canonical JSON serializer. Objective/resource/lesson ID sets, resource catalogs,
lesson bindings and evidence forms are sorted; authored instruction and rubric
criterion order is meaningful. Version, kind, title, both instruction audiences,
objectives, resource versions, rubric version, duration, collaboration, evidence
intent, scaffolding and accessibility behavior all affect the digest.
Provenance and release ID are semantic pins. Review, lifecycle and release-event
reference lists are excluded so recording review history does not change what
was reviewed. Never mutate the immutable revision snapshot to append events.

The enclosing release identity is verified separately and is excluded from the
activity semantic hash: release identity already hashes the activity binding's
digest, so hashing it back would create a cycle. The final release identity is
pinned in the exact revision snapshot and reconciled against server authority.
Assembly can compute the semantic digest, bind it in the candidate release,
compute release identity, then snapshot the exact definition for human review.
Neither hash computation nor resolution approves or publishes anything.

## ContentBundle relationship

`activityReferences` holds only `{ activityId, version, kind }`. The immutable
composition's existing `revisions` map supplies revision/provenance/snapshot pins.
The bundle hashes these exact pointers; it does not hash a second activity payload.
The resolver calls activity authority, reconciles bundle resource/lesson/provenance
closure, restores server display members and validates the hydrated bundle.
Its learner projection retains the existing allowlist and answer-resource checks.
Hydration does not change the composition digest. A manifest cannot supply both a
pointer and a payload for the same activity. Absent adapters fail closed.

Legacy embedded activity fixtures remain supported through the original
exact-member revision checks. They are contract test compatibility, not evidence
of independently released activities. Production entry points must supply exact
activity authority for governed pointers. Repository adapters expose that optional
dependency; this change supplies no fabricated durable authority or current-row fallback.

## Operational and specialized boundaries

ActivityDefinition is a reusable governed content definition. Homework,
Assignment and future ScheduledWork represent operational classroom assignment,
delivery and state. The current Homework and Assignment models retain class,
due date, author/content linkage and their submission relationships. No models,
columns, assignment delivery paths, submissions, grades or completion are changed.
A future delivery migration can store exact governed references independently.

PROJECT represents ordinary classroom project content. It does not reference or
replace the current CapstoneProject: that model is student-owned operational
portfolio work with mentors, artifacts, submission/review dates and feedback.
There is no governed exact-version Capstone template registry at this base.
Template references require separate authority and contract work before support.

Evidence intent reuses ContentBundle's NONE, PRACTICE_ONLY, FORMATIVE and
SUMMATIVE_CANDIDATE terminology and WRITTEN, ORAL, PHOTO, ARTIFACT, OBSERVATION,
DIGITAL_RESPONSE forms. These declare intended products, not evidence records or
admission decisions. Existing evidence policy/scoring/human-actor gates still
decide admissibility. SUMMATIVE_CANDIDATE grants no scoring or mastery authority.
The resolver writes no evidence, updates no mastery and chooses no next lesson.

## Future persistence

There is no new table or writer. A future adapter must use existing immutable
provenance/revision and review events, preserve exact historical snapshots,
bind activity digests through release/inventory authority and resolve approved
resource/rubric versions with rights and audience checks. Durable storage,
native activity review qualification integration, reviewed rubric/media registries
and actual activity publication remain separate governed work. Synthetic tests
demonstrate the contracts and failure gates; they are not MOE or production evidence.

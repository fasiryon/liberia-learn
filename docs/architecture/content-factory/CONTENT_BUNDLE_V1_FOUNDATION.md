# ContentBundle V1 Foundation

Status: pure TypeScript domain contract (Wave 1 of
[CONTENT_FACTORY_READINESS_V1](CONTENT_FACTORY_READINESS_V1.md), decision
commit `008f950899fa06018fe2a5cd9046cd52265e773c`). Reconciled with that
decision. It is not wired to Prisma, routes, ScheduledWork, Assignment,
Homework, assessment tables, mastery, SLM, the Learning Orchestrator, Today,
Learn, Lesson Experience V2, Progress, offline production code or the textbook
compiler. It approves, publishes and certifies nothing.

Code: `lib/content-bundle/v1/`

| File | Role |
| --- | --- |
| `types.ts` | Contract types |
| `validator.ts` | Fail-closed structural validator |
| `hash.ts` | Canonical content hash |
| `seal.ts` | Validate, then hash |
| `projection.ts` | Learner projection and `governedContentRef` |
| `toolkitMapping.ts` | Canonical-to-runtime tool adapter |
| `fixtures/grade4FractionsFixture.ts` | Synthetic first-vertical fixture |

Tests: `__tests__/content-bundle/contentBundleV1.test.ts`.

## What a ContentBundle is

An **immutable, version-pinned composition manifest** over existing authority
for one grade/subject/unit slice against one exact ontology release. It defines
**what can be learned**. It is composition only: it has no approval engine, no
approval flag and no second authority.

| Section | Contents |
| --- | --- |
| `identity` | `bundleId`, `version`, title, content `gradeLevel`, subject, locale, `contentHash` (null until sealed) |
| `curriculumAuthority` | `releaseId`, `releaseIdentity`, `objectiveIds`, `standardIds`, `sourceVersionRefs`, `conceptRefs`, `constructBindingRefs` |
| `sequence` | Units; entries with explicit `order`, `requirement`, prerequisites and unlocks (designed dependencies, not learner decisions) |
| `lessons` | Exact-version lesson members |
| `activities` | `ActivityDefinition` members |
| `assessments` | References to governed AssessmentDefinitions and AssessmentItems, with an item-order policy |
| `labs` | References to governed LearningExperienceLinks |
| `resources` | Versioned resources with an audience |
| `toolkitBindings` + `toolkitMapping` | Canonical governed tool ids, plus a pin of the reviewed runtime mapping |
| `learnerSupport` | Remediation, enrichment, supported accommodations, language variants |
| `renderings` | Derived artifact references only (`derivation: "DERIVED"`, `sourceAuthority: false`) |
| `offline` | Packaging plan: asset ids/versions/SHA-256, allowed capabilities, reconnect semantics |
| `governance` | `provenanceRefs`, `reviewRefs`, `lifecycleRefs`, `releaseRefs` (references only, no notes) |

## Confirmed decisions (readiness §1–§2)

- **Composition, not second authority.** CurriculumOntologyRelease, existing
  provenance and revision history, qualified reviewer governance, the release
  registry, canonical mastery/SLM and the Learning Orchestrator keep their
  authority. The bundle only references their records.
- **Version pinning.** Every member pins `itemId` + `itemVersion`. The bundle
  pins `bundleId` + `version` + `contentHash`. Mutable "latest" content is
  never canonical.
- **Student state is external.** See the boundary below.
- **Renderings are derived.** They never approve or redefine content.
- **Generation is not approval.** The validator checks structure. Passing it
  is not review, release or certification.
- **ActivityDefinition is common.** Assignment, Homework and CapstoneProject
  remain operational models outside the content definition and are untouched.

## GovernedContentRef

```ts
type GovernedContentRef = {
  bundleId: string; bundleVersion: string;
  itemId: string; itemVersion: string;
  itemKind: "LESSON" | "CLASSWORK" | "HOMEWORK" | "PRACTICE" | "PROJECT" | "INVESTIGATION"
          | "PRACTICAL" | "GROUP_WORK" | "QUIZ" | "ASSESSMENT" | "LAB";
};
```

This is the member identity that future ScheduledWork, attempts, submissions,
evidence, offline packages, teacher views and progress readers will pin.
Member identity differs from question identity: assessment items have their own
`assessmentItemId`/`assessmentItemVersion`. `governedContentRef(bundle, itemId)`
returns `null` for an item the bundle does not declare, rather than guessing.

## Student-state boundary

The bundle defines what can be learned. Operational systems record what
happened. Mastery determines what the student knows. The Learning Orchestrator
determines what happens next.

The bundle never contains studentId, attempts, submissions, scores, grades,
mastery, progress, completion, attendance, evidence, placement decisions,
recommendations, next-lesson decisions, accommodation grants or group
membership. Three layers enforce this:

1. **Types.** No contract type has these fields. `@ts-expect-error` tests
   prove additions fail to compile.
2. **Strict fields.** Every object is checked against its allowed field names.
   Unknown names are rejected with `unknown_field`.
3. **Forbidden-name scan.** The whole input is scanned, including `extensions`.
   Student-state names fail with `student_state_forbidden`, runtime timestamps
   with `runtime_field_forbidden`, and inline answer material with
   `answer_key_inline`.

## ActivityDefinition

The common definition for CLASSWORK, HOMEWORK, PRACTICE, PROJECT,
INVESTIGATION, PRACTICAL and GROUP_WORK. It carries:

- identity and version, title
- objective and lesson bindings
- `scaffolding` (guided / independent)
- learner and teacher instructions, resources
- an optional rubric reference: public criteria plus a private scoring-guide
  resource
- duration, collaboration mode, evidence intent and accessibility

It has no submission, grade, grading result, completion, attempt, due date or
roster. Guided and independent practice are both `PRACTICE` members told apart
by `scaffolding`. Readiness §4 allows PRACTICE to use the shared definition
protocol as an item-set wrapper.

## Hash: content hash vs governed release identity

**Content hash** (`identity.contentHash`, `hashContentBundle`) identifies *what
is learned*. It is SHA-256 over the existing curriculum `canonicalizeJson`
(sorted keys, normalized numbers), tagged with the domain
`liberialearn.content-bundle.v1.sha256`. It includes:

- exact member, resource, assessment definition and assessment item versions
- the sequence (by explicit `order`), entry requirements, and prerequisite and
  unlock edges
- meaningful authored order: instruction steps, **FIXED** assessment item
  order, rubric criteria, learner instructions
- objective bindings and curriculum authority references (`releaseId`,
  `releaseIdentity`, source, concept and construct pins)
- lab binding identity: member, governed link id and revision, lab id and
  version
- toolkit bindings and the pinned toolkit mapping version
- learner support references
- offline asset identities and hashes, allowed capabilities, reconnect
  semantics
- composition `provenanceRefs`

It **excludes**:

- the self hash
- derived `renderings`
- `reviewRefs`, `lifecycleRefs` and `releaseRefs`
- any mutable notes. The contract has none; `reviewerNotes` is rejected.

**Governed release identity** is a separate concept:

- `curriculumAuthority.releaseIdentity` pins the ontology release the content
  is composed against. It is hashed *as a reference*.
- Reviews, lifecycle events and release records are attestations **about** a
  sealed `(bundleId, version, contentHash)`. They live in existing governance
  records and are not hashed, so recording an approval or revocation never
  changes what was approved.
- A changed child requires a new composition version, and therefore a new
  hash and a new review.

Unordered sets (id lists and id-keyed collections) are sorted before hashing,
so re-emitting the same content in a different array order gives the same
hash. `sealContentBundle` validates, hashes and returns the bundle with
`identity.contentHash` set. Validating a bundle whose declared hash does not
match its content fails with `content_hash_stale`.

## Assessment relationship

AssessmentDefinition, AssessmentItem, delivery/assignment, attempt and evidence
are separate concepts (readiness §5). The bundle holds only:

- `definition { definitionId, definitionVersion }`: a governed
  AssessmentDefinition, which owns purpose, scoring, evidence, tool,
  assistance, retry, disclosure and timing policies
- `items[] { assessmentItemId, assessmentItemVersion }`: governed
  AssessmentItems
- `itemOrder`:
  - `FIXED`: authored order is semantic and hashed.
  - `RANDOMIZED_BY_POLICY { policyId, policyVersion }`: the reviewed policy is
    hashed and items are treated as a set. The runtime presentation order
    belongs to the delivery/attempt and is rejected in the bundle. Runtime
    randomization is not implemented.
- `role` (FORMATIVE_CHECK, QUIZ, UNIT_ASSESSMENT, EXAM, WAEC_STYLE): the
  member's place in the composition. QUIZ role pairs one-to-one with
  `itemKind: QUIZ`.
- `secured.*ResourceId`: may point only at non-learner resources.

It never holds stems, options, keys, attempts, scores or evidence. Learner
projections expose identity, role, title, objectives, definition reference,
fixed/randomized flag and learner instructions only. The Assessment Player is
not implemented.

## Lab relationship

A `LabBinding` has three separate identities (readiness §7):

- `identity`: the bundle member (composition identity)
- `link { linkId, linkRevision }`: the governed LearningExperienceLink
  relationship, pinned to an exact revision
- `lab { labId, labVersion }`: the lab experience and its exact version

The member id is **not** required to equal the link id. Every link and lab
field is required (`lab_binding_identity_missing`). `authorityBasis` must be
`GOVERNED_LINK`. Showcase membership, standard-code or title matches and raw
lab ids are not authority (`lab_binding_authority_insufficient`), and showcase
access is irrelevant to bundle authority. Certification, eligibility and access
stay with the lab registry and link governance; the bundle does not copy them.
The certified registry is empty at this base, and the first vertical has no lab.

## Toolkit identity

Readiness verified that governed tool policies (`fraction_strips`,
`number_line`, `calculator`) and the runtime toolkit registry
(`fraction-visualizer`, `number-line`, `basic-calculator`,
`scientific-calculator`) use different identifiers. The bundle does not adopt
the runtime naming as authority:

- `ToolkitBinding.toolId` is a **canonical governed tool id**. Each binding has
  a mode (REQUIRED / OPTIONAL / PROHIBITED), a scope (bundle or item),
  learner-visible `configuration`, private `internalConfiguration` and
  `context`.
- `ContentBundleV1.toolkitMapping { mappingId, mappingVersion }` pins the
  reviewed canonical-to-runtime mapping. It is part of the content hash.
- `toolkitMapping.ts` is the explicit adapter. `checkToolkitMapping` reports
  missing pins, mismatched pins, unmapped canonical tools and unknown runtime
  ids, and never guesses. `resolveRuntimeToolIds` returns the mapped runtime
  ids. One canonical id may map to several runtime ids, for example a
  calculator prohibition group.
- The validator's optional `isGovernedToolId` checks the governance namespace
  only. Tests show that a runtime id such as `fraction-visualizer` is rejected
  as a governed id.

Collision rule: a bundle-wide PROHIBITED tool collides with any allowance. An
item PROHIBITED tool collides with the same item's allowance or a bundle-wide
REQUIRED tool. An item may narrow a bundle-wide OPTIONAL tool. Prohibition wins
at runtime. The production toolkit is unchanged.

## Offline invariant

Readiness verified (inference B) that the current weekly pack
(`lib/packs/generatePack.ts`) can mix lesson versions: it has no common
composition pin, keys on contentId and selects audio by latest `generatedAt`.
The future invariant:

> One ContentBundle offline package pins exactly one `bundleId`, one
> `bundleVersion`, one bundle `contentHash`, the release identity, the exact
> member/item versions and the exact asset hashes. Weekly transport may carry
> several independently pinned packages, never an unpinned mixed set labelled
> as one bundle.

The learner projection's `offline` block implements the identity part of this
invariant. It carries `audience: "LEARNER"`, the projection version, the bundle
id/version/hash, the release identity, every member's exact
`{itemId, itemVersion, itemKind}`, learner asset hashes only, allowed
capabilities (an allow-list) and reconnect semantics.

**Learner and staff packages are distinct projections.** The staff/teacher
offline projection, signed manifests, expiry and revocation, byte budgets and
atomic activation belong to Wave 8 and are not built here. Offline production
code is unchanged.

## Progress finding (later integration requirement)

Readiness verified (inference A) that Progress still reads legacy and older
paths for governed learners:

- `StudentProgressDashboard` fetches `/api/student/progress` and
  `/api/adaptive/mastery`
- the adaptive endpoint reads `adaptiveMasteryRecord`
- `progressSummary` / `learningIntelligence` read ScheduledWork,
  StudentProgress and AssessmentAttempt, with no canonical SLM or orchestrator
  branch

When governed delivery is integrated, Progress must read canonical
mastery/SLM state and persisted orchestrator decisions for governed learners.
Completion stays operational, and ordinary schoolwork keeps clearly labelled
legacy analytics.

**ContentBundle is not and must not become Progress authority.** It supplies
member identities that Progress may join against, nothing more. Progress is
unchanged here.

## Learner projection

`projectLearnerContentBundle(input)` validates, seals and projects, failing
closed. `projectLearnerBundle(bundle, hash)` is the pure core. It is built from
an allow-list, so new internal fields stay out by default.

**Kept:**

- source identity and hash, release id and release identity
- objectives and standards, sequence
- lessons with learner resources
- activities with learner instructions, learner resources and public rubric
  criteria
- safe assessment references
- governed lab bindings
- learner resources
- REQUIRED and OPTIONAL canonical tools with learner configuration, and the
  mapping pin
- learner support
- TEXTBOOK and WORKBOOK renderings
- the learner offline package identity

**Stripped:**

- teacher and system resources, assets and instructions
- rubric scoring guides
- assessment item lists and `secured` references
- PROHIBITED bindings and `internalConfiguration`
- TEACHER_GUIDE and ASSESSMENT_BOOK renderings
- all governance references

This layer is projection only. Tenant, enrollment, revocation and RBAC checks
belong to the future server resolver (Wave 2).

## Grade 4 fractions fixture

`buildGrade4FractionsFixture()` follows the first vertical in readiness §11:
parts of a set, starting from equal parts. The chain is:

objective → lesson → guided and independent practice → classwork / homework →
formative check → unit assessment

It has **no lab**. It is **synthetic**: every id starts with `fixture.`, the
release identity is `FIXTURE-ONLY:…`, `reviewRefs` and `releaseRefs` are empty,
and a test asserts it does not reuse the real release, objective or lesson ids.

Tools use governed ids (`fraction_strips` OPTIONAL, PROHIBITED in the unit
assessment; `calculator` PROHIBITED). `G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING`
is an **unreviewed** test mapping to runtime ids. It is not the pedagogical
equivalence review readiness requires.

## Validator

`validateContentBundle(input: unknown, { isGovernedToolId? })` never throws. It
returns `{ ok, bundle | null, errors[] }`, where each error is
`{ code, path, message }`.

It rejects:

- duplicate ids: bundle members, resources, assets, units, steps, supports,
  renderings, bindings
- missing versions, and malformed curriculum authority or pins
- empty or unbound objectives
- duplicate or invalid sequence order, unknown sequence references and
  dependency cycles
- unknown item kinds or kinds in the wrong section
- assessment references missing definition, item or order-policy identity, and
  invalid roles
- secrets exposed to learners
- lab bindings missing member, link or lab identity, or with insufficient
  authority
- toolkit collisions and duplicates, unknown governed tool ids when the check
  is supplied, and malformed mapping pins
- malformed offline assets or capabilities
- audience conflicts
- renderings that claim authority
- student-state, runtime and inline-answer field names
- unknown fields
- stale or malformed `contentHash`

## Remaining unresolved decisions

These remain open per readiness §14. The contract does not decide them:

1. **Persistence and cardinality.** Durable composition, member and item
   storage; how many members one ScheduledWork anchor delivers; and the
   lesson-only contentId foreign-key transition.
2. **ScheduledWork schema shape.** The exact pin columns or relations for
   bundle, member, definition and item, and the backfill and dual-read plan
   (Wave 5, Prisma, runbook, advisor).
3. **Assessment bank migration and retry.** Mapping existing banks
   (ExamQuestion, PracticeItem, WAEC, generated items) to governed item
   ids/versions/order, and retry and session history. Also how `role` maps to
   the AssessmentDefinition purpose vocabulary (CHECK / QUIZ / UNIT_ASSESSMENT /
   EXAM_SECTION), and a randomization policy registry.
4. **Canonical toolkit mappings.** The reviewed canonical-to-runtime mapping
   records, including `fraction_strips → fraction-visualizer` equivalence and
   calculator group semantics. Also where the canonical tool namespace is
   registered, and per-binding tool policy pins.
5. **Expanded scoring.** Rubric, numeric, multi-select, free-response, project
   and summative admission adapters beyond single-choice.
6. **Offline policy details.** The capability and reconnect vocabularies (the
   current lists are placeholders), signed manifest protocol,
   expiry/revocation/retention, stale-reconnect disposition, the staff package
   projection and byte budgets.
7. **Lab link revisions.** LearningExperienceLink has no revision field today.
   `link.linkRevision` is the contract requirement that link governance must
   satisfy before any lab binding is executable.
8. **Real vertical identity.** A reviewed parts-of-set assessment and successor
   lesson, a payload hash for the 2026.1 lesson binding, and the real bundle
   version and hash. These are assigned only after reviewed dependencies exist.

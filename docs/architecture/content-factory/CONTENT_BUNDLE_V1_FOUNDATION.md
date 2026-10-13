# ContentBundle V1 Foundation

Status: **PROVISIONAL** pure domain contract. It is not wired to Prisma, routes,
Today, Learn, Lesson Experience V2, offline production code or the textbook
compiler. Names and structure may change when `CONTENT_FACTORY_READINESS_V1`
converges. Every decision marked *(provisional)* below is expected to be
revisited then.

Code: `lib/content-bundle/v1/` (`types.ts`, `validator.ts`, `hash.ts`,
`projection.ts`, `fixtures/grade4FractionsFixture.ts`).
Tests: `__tests__/content-bundle/contentBundleV1.test.ts`.

## What a ContentBundle is

A ContentBundle is a versioned, governed declaration of **what can be learned**
for a unit of curriculum. It contains:

| Section | Purpose |
| --- | --- |
| `identity` | `bundleId`, `version`, title, content `gradeLevel`, subject, locale |
| `curriculumAuthority` | `releaseId`, `releaseIdentity`, bound `objectiveIds`, `standardIds` |
| `sequence` | units, explicit `order`, item prerequisites and unlocks (the designed dependency graph) |
| `lessons` | exact-version lesson references |
| `activities` | `ActivityDefinition`s for CLASSWORK, HOMEWORK, PRACTICE, PROJECT, INVESTIGATION, PRACTICAL, GROUP_WORK |
| `assessments` | references to governed AssessmentDefinitions and AssessmentItems, with a typed role |
| `labs` | references to governed lesson↔lab links |
| `resources` | versioned resource/media references with an audience |
| `toolkitBindings` | REQUIRED / OPTIONAL / PROHIBITED toolkit registry ids, scoped to the bundle or an item |
| `learnerSupport` | remediation and enrichment links, supported accommodations, language variants |
| `renderings` | references to **derived** textbook, workbook, teacher guide and assessment book artifacts |
| `offline` | packaging flag, asset ids/versions/SHA-256/sizes, capability restrictions, reconnect requirement |
| `governance` | provenance, review and release record **references** plus internal reviewer notes |

## What it is not

- Not student state. It has no `studentId`, attempts, submissions, scores,
  grades, mastery, progress, completion, attendance, placement decisions,
  recommendations or next-lesson decisions.
- Not a release or certification authority. It references curriculum releases,
  governed lab links and assessment definitions. It does not approve them.
- Not an admission decision. The learner projection shapes data. It does not
  decide who may open it.
- Not a rendering. Textbooks and workbooks are compiled from it.

The boundary in one line each:

- The **bundle** defines what can be learned.
- **Operational systems** record what happened.
- **Mastery** (Student Learning Model) determines what the student knows.
- The **Learning Orchestrator** determines what happens next.

## GovernedContentRef

```ts
type GovernedContentRef = {
  bundleId: string;
  bundleVersion: string;
  itemId: string;
  itemVersion: string;
  itemKind: "LESSON" | "CLASSWORK" | "HOMEWORK" | "PRACTICE" | "PROJECT"
          | "INVESTIGATION" | "PRACTICAL" | "GROUP_WORK" | "QUIZ" | "ASSESSMENT" | "LAB";
};
```

This is the identity future consumers will store: ScheduledWork, attempts,
submissions, evidence, offline packages, teacher views and progress readers.
None of those models change in this branch. Inside a bundle, every lesson,
activity, assessment and lab carries `identity: { itemId, itemVersion, itemKind }`.
Item ids share one namespace per bundle. `governedContentRef(bundle, itemId)`
mints a reference only for an item the bundle actually declares, and returns
`null` otherwise.

## Student-state boundary

Three layers enforce it:

1. **Types.** No contract type has a student-state field. Tests use
   `@ts-expect-error` to prove that adding `studentId` or `submission` to a typed
   bundle literal fails to compile.
2. **Strict fields.** The validator rejects any field name not defined by the
   contract (`unknown_field`). A new name cannot carry state through.
3. **Forbidden-name scan.** The validator scans the whole input, including
   `extensions`, case- and separator-insensitively for:
   - student-state names (`student_state_forbidden`)
   - runtime timestamps such as `createdAt` and `fetchedAt` (`runtime_field_forbidden`)
   - inline answer material such as `correctAnswer` and `answerKey` (`answer_key_inline`)

   Content `gradeLevel` and lab `placement` are deliberately allowed.

## ActivityDefinition

Provisional content definition for non-lesson work. It holds identity and
version, title, objective bindings, related lessons, `scaffolding`
(GUIDED / INDEPENDENT / null), learner and teacher instruction steps, resources,
an optional rubric reference (learner-visible criteria plus a teacher-only
scoring guide resource), expected duration, collaboration mode, evidence intent
(kind and forms) and accessibility metadata. It has no submission, grade,
grading result, completion or attempt state. `CapstoneProject` is untouched.

*(provisional)* Guided and independent practice are both `PRACTICE` items,
distinguished by `scaffolding`. They are not separate kinds.

## Assessment relationship

The bundle only *references* assessments. An `AssessmentReference` has a typed
`role` (FORMATIVE_CHECK, QUIZ, UNIT_ASSESSMENT, EXAM, WAEC_STYLE). It points to
an `AssessmentDefinitionRef { definitionId, definitionVersion }` and an ordered
list of `AssessmentItemRef { assessmentItemId, assessmentItemVersion }`. Item
stems, options and keys never live in the bundle. `secured.answerKeyResourceId`
and `secured.scoringGuideResourceId` may point only at non-learner resources
(`assessment_secret_exposed`). The Assessment Player is not implemented here.

*(provisional)* `itemKind: QUIZ` is paired one-to-one with `role: QUIZ`. Every
other role uses `itemKind: ASSESSMENT`.

## Lab relationship

A `LabBinding` carries:

- `linkId`
- `labId` and `labVersion`
- `objectiveIds`
- `role` (CORE / OPTIONAL / ENRICHMENT / REMEDIATION)
- `placement { lessonItemId, sceneId }`
- `authorityBasis: "GOVERNED_LINK"`

The basis is the only accepted value. Showcase membership (`SHOWCASE_LAB_IDS`),
standard-code matches and raw lab ids are rejected
(`lab_binding_authority_insufficient`). The binding records *which* governed
link it uses and does not copy certification state: eligibility stays with
`labLinkEligibility` and the lab registry. The Grade 4 fractions fixture binds
no lab because no fraction lab is certified.

## Hash semantics

`hashContentBundle` returns SHA-256 (lowercase hex) over the canonical JSON of
`contentBundleHashPayload(bundle)`. It reuses `canonicalizeJson` from
`lib/curriculum/provenance/hash.ts` (sorted keys, normalized numbers) and adds
the domain tag `liberialearn.content-bundle.v1.sha256`. `sealContentBundle`
validates first. An invalid bundle never receives a hash.

These normalizations apply before hashing:

- Id-keyed collections are sorted by id. Set-valued id lists are sorted.
- Sequence units and entries are sorted by their explicit `order`. Changing an
  `order` changes the hash. Re-emitting the same order in a different array
  order does not.
- Lists whose order carries meaning are kept as authored: instruction steps,
  assessment item order, rubric criteria and learner instructions.

The hash changes for: an item version, a sequence order, instruction order, the
release identity, an objective binding, a resource version, an offline asset
hash, or an assessment definition version.

*(provisional)* `renderings` and `governance` are **excluded** from the hash:

- Renderings are compiled from the hashed content, so regenerating a textbook
  must not change bundle identity.
- Review and release records attach *to* a hash, so recording an approval must
  not change what was approved.

The bundle cannot contain its own hash. The exact bundle version and hash are
bound when the bundle is sealed and appear in the learner projection's `source`
and `offline` blocks.

## Learner projection

`projectLearnerContentBundle(input)` validates, seals and projects. It fails
closed. `projectLearnerBundle(bundle, hash)` is the pure core. The projection
builds learner output from an allow-list of fields, so a new internal field
stays out by default.

**Kept:**

- source identity and hash
- title, content grade level, subject and locale
- release id, objectives and standards
- sequence
- lessons, with learner resources only
- activities: learner instructions, learner resources and learner-visible
  rubric criteria
- assessments: identity, role, title, objectives, definition reference and
  learner instructions
- governed lab bindings
- learner resources
- REQUIRED and OPTIONAL tools, with learner-visible configuration
- remediation, enrichment, accommodation presentation and language variants
- TEXTBOOK and WORKBOOK renderings
- learner offline assets, capability restrictions and the reconnect requirement

**Stripped:**

- teacher and system resources and assets
- teacher instruction steps
- rubric scoring guides
- assessment item lists and `secured` references
- PROHIBITED tool bindings and `internalConfiguration`
- TEACHER_GUIDE and ASSESSMENT_BOOK renderings
- `releaseIdentity`, governance and reviewer notes

Auth and admission are not implemented in this layer. *(provisional)* Item-level
tool prohibitions are not advertised to learners. Runtime tool availability
remains with `resolveToolAvailability`, server-side.

## Validator

`validateContentBundle(input: unknown, { isKnownToolId? })` never throws. It
returns either `{ ok: true, bundle, errors: [] }` or
`{ ok: false, bundle: null, errors }`. Each error is `{ code, path, message }`.

It rejects:

- duplicate bundle, item, resource, asset, unit, step, support and rendering ids
- missing bundle or item versions
- empty or unbound objective references
- malformed curriculum authority
- duplicate or invalid sequence order, unknown sequence references, and cycles
  in the prerequisite/unlock graph
- unknown item kinds, or item kinds in the wrong section
- assessment references missing definition or item identity
- invalid assessment roles
- answer keys exposed to learners
- lab bindings missing link, lab or version identity, or with insufficient
  authority
- toolkit REQUIRED/PROHIBITED collisions and duplicate bindings, and unknown
  tool ids when a registry check is injected
- malformed offline asset identity: non-hex or uppercase SHA-256, missing
  version, non-positive size, bad media type
- learner/teacher audience conflicts
- renderings that claim source authority
- student-state, runtime and inline-answer field names
- unknown fields

The toolkit collision rule: a bundle-wide PROHIBITED tool collides with any
allowance. An item PROHIBITED collides with the same item's allowance or with a
bundle-wide REQUIRED. An item may narrow a bundle-wide OPTIONAL tool, for
example by banning the fraction visualizer during a unit assessment.

## Grade 4 fractions fixture

`buildGrade4FractionsFixture()` is **synthetic**. Every id starts with
`fixture.` and the release identity is `FIXTURE-ONLY:…`. It is not published
curriculum. It models:

objective → lesson → guided practice → independent practice → classwork and
homework → formative check → unit assessment

It also includes a teacher-only answer key and note, a learner workbook
rendering and a teacher guide rendering, offline assets, and real toolkit ids:
`fraction-visualizer` (OPTIONAL bundle-wide, PROHIBITED in the unit assessment)
and `basic-calculator` (PROHIBITED in the unit assessment).

## Provisional decisions awaiting CONTENT_FACTORY_READINESS_V1

1. Module location `lib/content-bundle/v1/`, schema tag `content-bundle.v1`,
   and the section names above.
2. `GovernedContentRef` field names, the 11 item kinds, and one shared item-id
   namespace per bundle.
3. Guided and independent practice as `PRACTICE` plus `scaffolding`, rather
   than separate kinds.
4. QUIZ itemKind paired one-to-one with the QUIZ role. Whether assessment item
   order is semantic, which is currently yes.
5. `LabBinding.authorityBasis` with the single value `GOVERNED_LINK`, and
   whether `itemId` should equal `linkId`.
6. Hash exclusions for `renderings` and `governance`. Sorting of id-keyed
   collections. The hash domain tag.
7. Offline capability restriction and reconnect reason vocabularies.
8. Toolkit collision semantics, and not advertising prohibitions to learners.
9. Resource audience model (LEARNER / TEACHER / SYSTEM) and which resource
   kinds are never learner-facing.
10. The forbidden field-name lists. They are a backstop for the strict field
    check, not the primary defense.
11. No persistence. When a table is introduced, store the canonical bundle JSON
    with its `contentHash` and keep the validator as the write gate.

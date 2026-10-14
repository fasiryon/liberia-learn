# Activity Wave V1: governed ActivityDefinition + Grade 4 fractions experiences

Status: integration of Wave 3A (governed `ActivityDefinitionV1` authority, `48e45f63`) with Wave 3B
(Grade 4 fractions activity experiences, `15b6040c`) on `main` at `86139e2d`. Both inputs are
merged unchanged; one integration commit converges them. No migrations, routes, deployments,
publication, ScheduledWork changes, evidence or mastery writes.

Source docs (still authoritative for their own scope):
[ACTIVITY_DEFINITION_V1.md](ACTIVITY_DEFINITION_V1.md) and
[G4_FRACTIONS_ACTIVITY_EXPERIENCE_V1.md](G4_FRACTIONS_ACTIVITY_EXPERIENCE_V1.md).

## 1. Governed definition

`ActivityDefinitionV1` (`lib/activity-definition/v1/`) is the only activity-content authority.
A definition has:

- a stable `activityId`, an exact `version` and a `kind`;
- `content`: title, objectives, lesson ids, scaffolding, learner and teacher instructions,
  resources, rubric, duration, collaboration mode, evidence intent, accessibility, and now
  `experience`;
- exact resources and lesson bindings;
- a `release` identity;
- governance refs;
- a semantic `contentHash`.

`resolveActivityDefinition` restores a definition only by exact id and version. It then checks:

- the stored payload against its semantic hash;
- the immutable revision snapshot and verified provenance;
- the ontology release and its inventory;
- objectives, lesson versions, resources and rubric;
- with `requireReleased` (the default), an APPROVED revision plus an ACTIVITY content binding in a
  published, approved release.

## 2. Experience format: promoted to a first-class field

Wave 3B stored the learner experience in `ActivityDefinition.extensions.experience`. Wave 3A
deliberately provides no extensions escape hatch: `content` is
`Omit<ActivityDefinition, "identity" | "extensions">`, and its schema is strict. Keeping the
extension would have dropped the experience from governed content, or forced a second surface. So
V1 **promotes it**:

| Surface | Field | Validation |
| --- | --- | --- |
| Bundle member (`ActivityDefinition`) | `experience?: ActivityExperienceV1` | Bundle validator runs `parseActivityExperience` and the forbidden-key scan, reporting `activity_experience_invalid`. `extensions.experience` is **rejected**, so there is one surface only. |
| Governed authority (`ActivityDefinitionV1.content`) | `experience?` (inherited from the member type) | `parseActivityDefinition` runs the same strict parser against the definition's own kind, scaffolding and collaboration mode. Any failure rejects the whole definition. |

The format itself (`activity-experience.v1`) is unchanged: strict parser, unknown fields
rejected, profile rules for guided, independent, classwork and homework, and no answer fields.
`activityBundleMember` carries `experience` across unchanged.

There is no other schema churn: the field is optional, so existing fixtures and their hashes are
unaffected.

**Hashing.** `activityDefinitionHashPayload` spreads `content`, so the experience is part of the
activity's semantic hash: editing a hint changes `contentHash`, and a stale stored payload fails
with `ACTIVITY_HASH_STALE`. A bundle stores only `activityReferences`, so its hash covers the exact
`(activityId, version, kind)` pointers. The payload is pinned by the activity hash and the
immutable revision, not duplicated into the bundle hash.

## 3. The four activities

All four have item version `1.1.0-fixture` and bind the fixture objectives.

| activityId (`fixture.activity.g4-math.fractions.*`) | kind / scaffolding | collaboration | min | evidence intent | experience profile |
| --- | --- | --- | --- | --- | --- |
| `guided-practice` | PRACTICE / GUIDED | INDIVIDUAL | 12 | PRACTICE_ONLY (observation) | GUIDED_PRACTICE: worked example, at least 2 hints per item |
| `independent-practice` | PRACTICE / INDEPENDENT | INDIVIDUAL | 12 | PRACTICE_ONLY (digital response) | INDEPENDENT_PRACTICE: no worked example, at most 1 hint, at least 4 items |
| `classwork` | CLASSWORK | PAIR | 25 | FORMATIVE (written, observation) | CLASSWORK: phases, roles, materials, rubric with a TEACHER `SCORING_GUIDE` |
| `homework` | HOMEWORK | INDIVIDUAL | 15 | PRACTICE_ONLY (written) | HOMEWORK: paper only, offline, self-check |

Guided and independent practice are both `PRACTICE`. The difference lives in governed content
(`scaffolding` plus the experience profile), and the parser enforces it against the kind. There
is no runtime assumption.

One integration fix: the classwork rubric previously pointed its scoring guide at an
`ANSWER_KEY` resource. The activity authority correctly rejects that
(`RUBRIC_RESOURCE_INVALID`), so classwork now has its own TEACHER `SCORING_GUIDE` resource and an
exact rubric `fixture.rubric.g4-math.share-bottle-caps-classwork@1.1.0-fixture`.

## 4. ContentBundle resolution path

```text
ContentBundle composition: activities: [], activityReferences: [{activityId, version, kind} × 4]
  → resolveActivityDefinition(exact id + version, pinned revision)
  → ActivityDefinitionV1 → activityBundleMember → validate (allowResolvedActivities) → seal
  → projectLearnerBundle → StudentPreviewModel  /  TeacherPreviewModel
```

- **Production** (`resolveContentBundle`): restores pointers only with `requireReleased: true`.
  The candidate composition is refused with `ACTIVITY_NOT_APPROVED`. An APPROVED revision without
  a release binding is still refused (`ACTIVITY_NOT_RELEASED`).
- **Fixture Teacher Preview** (`lib/content-bundle/preview/activityAuthority.ts`): restores each
  pointer in explicit draft-inspection mode (`requireReleased: false`). It also runs the release
  gate and reports the gate's own answer per activity: source, activity hash, review state,
  `releaseEligible` and gate diagnostic. Draft restoration never makes a bundle resolvable in
  production.
- A composition that also embeds a payload for a pointer is rejected
  (`ACTIVITY_PAYLOAD_DUPLICATED` in the resolvers, `malformed` in the validator).
- Embedded-activity fixtures (the merged `grade4FractionsFixture`) still work for existing tests.

Authority: `lib/activity-definition/v1/fixtures/grade4FractionsCandidateAuthority.ts` holds four
`ActivityDefinitionV1` records with PENDING_REVIEW revisions. They sit on the existing synthetic
integration ontology (`createSyntheticResolverAuthority`), and the release has no ACTIVITY binding
for them.

## 5. Learner projection

The projection is unchanged in mechanism: an allow-list. Student Preview receives:

- learner instructions and learner-audience resources;
- the learner experience, re-emitted field by field;
- learner-visible rubric criteria;
- accessibility metadata.

It never receives:

- teacher instructions;
- the experience's teacher section (flow, grouping, look-fors, misconceptions and responses,
  differentiation, evidence note, alignment);
- TEACHER/SYSTEM resources (facilitation guide, scoring guide, answer key);
- rubric scoring guides, governance refs, internal tool configuration;
- authority readiness.

Tests check the serialized projection, the student model and the rendered student pages, in jsdom
and in a real browser.

## 6. Teacher Preview

The Teacher overview shows everything the experience already showed:

- type, objective with the learner goal, duration;
- collaboration and grouping, evidence intent and its classroom meaning, lesson flow;
- learner and teacher instructions, materials (required or optional) and resources;
- what to look for, likely mistakes with responses, differentiation, rubric, the question list;
- candidate alignment.

The **Alignment and readiness** section now adds three facts from the authority:

- **Activity definition:** "restored from the ActivityDefinition authority by exact id and
  version", with the activity hash.
- **Review state:** Pending review.
- **Release gate:** Not releasable (not approved).

The withheld summary still counts the facilitation guides.

## 7. Practice feedback boundary

Feedback (`lib/content-bundle/preview/fractionFeedback.ts`) is pure, local and ephemeral. It
reads only what the learner can already see:

- the fraction a construction prompt states (the parser requires the prompt to contain `n/d`);
- the parts a picture draws.

There are no `correctAnswer`, answer-key or scoring fields in content, so both strict parsers
reject them. No teacher scoring data reaches the learner payload. There is no server scoring
path, and practice feedback is not assessment authority, evidence or mastery. Assessments keep
their own secured references.

## 8. Governance status (truthful)

| Fact | State |
| --- | --- |
| Bundle | `fixture.bundle.g4-math-fractions-activities`. The preview source is FIXTURE and non-authoritative, release is NOT_EVALUATED, and production returns `FIXTURE_NOT_AUTHORITY`. |
| Activity revisions | PENDING_REVIEW. Governance holds provenance only; review, lifecycle and release refs are empty. |
| Release | Synthetic integration ontology. It has no ACTIVITY content binding for these activities. |
| Alignment | `moe-math-g4-s1-p3-number-theory-and-fraction-obj4` and `ll-g4-math-fractions-equal-parts-2026.2@1.2.0` are recorded as UNREVIEWED_CANDIDATE. That lesson is itself PENDING_FOUNDER_REVIEW and is not approved or released. |
| Toolkit mapping | The fixture mapping remains unreviewed. |

Repository existence is never treated as approval.

## 9. Operational-model boundary

Unchanged from Wave 3A:

- **ActivityDefinition `PROJECT`:** ordinary governed classroom project content.
- **CapstoneProject:** the specialized capstone system, left untouched.
- **Homework, Assignment and ScheduledWork:** operational classroom state (class, assignee, due
  date, submission). They are not migrated or modified.

A HOMEWORK *definition* is reusable content; assigning it remains operational.

## 10. What becomes durable after persistence work lands

Today the authority readers are synthetic: in-memory records, PENDING_REVIEW revisions and a
synthetic ontology. When persistence lands, the following replace those fixtures, with no change
to the contracts above:

- an immutable exact-revision ActivityDefinition store behind `readActivity` / `readRevision`;
- review and lifecycle replay;
- ACTIVITY content bindings in a published release;
- a reviewed rubric registry and resource/media revisions;
- a composition store holding `activityReferences` plus revision pins.

The release gate then resolves real activities. The Teacher Preview readiness row will report
"Passes" only because that gate passes. Learner delivery outside Teacher Preview,
evidence/attempt capture for FORMATIVE classwork, and a reviewed toolkit mapping remain separate
work.

## Evidence

- `__tests__/activity-definition/resolverV1.test.ts` (Wave 3A): all seven kinds, exact-identity,
  hashing, lifecycle, release, provenance, resource and rubric gates, and bundle pointers.
- `__tests__/activity-definition/activityWaveIntegration.test.tsx`: the four G4 definitions,
  experience hashing, strict rejection inside the governed definition, the pointer-only
  composition, draft inspection versus the release gate, production refusal, fail-closed paths,
  preview hydration and readiness, the learner-safe projection, and teacher/student rendering of
  authority state.
- `__tests__/content-bundle/g4FractionsActivityExperience.test.tsx` (Wave 3B, updated for the
  first-class field and the single-surface rule).
- `node e2e/g4-fractions-activities/run.mjs`: 4 activities × 2 modes × 5 widths, now resolved
  through the authority path, with teacher readiness assertions. Output:
  `artifacts/g4-fractions-activity-experience/`.

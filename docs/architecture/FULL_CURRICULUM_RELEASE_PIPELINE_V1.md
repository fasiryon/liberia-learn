# Full-curriculum release pipeline V1

The full-curriculum expansion uses the existing governed release, binding,
evidence, Student Learning Model, DecisionModel, Learning Orchestrator, and
Learner Experience V2 contracts. It adds an authoring boundary; it does not
add a grade-specific runtime.

## Manifest model

`lib/learning-authority/releaseManifests.ts` defines the data contract for a
reviewable release manifest. A manifest records grade, subject, release
identity, provenance, approval status, and an optional executable ontology
release. The executable release remains the existing `CurriculumOntologyRelease`
shape: standards/skills/targets live in bindings, concepts and prerequisites
live in the ontology, and lesson, assessment, evidence, and tool bindings are
version-pinned.

`curriculum/releases/k12-scope.json` represents the configured K–12 scope as
12 grades × 19 canonical subjects (228 grade/subject combinations). It is a
scope declaration, not an approval claim. Unregistered combinations are
reported as explicit release, lesson, assessment, evidence-policy, and
tool-policy gaps.

## Validation and identity

`validateReleaseManifest` validates scope consistency, approval/provenance
separation, executable release validity, duplicate identifiers, and coverage.
`validateReleaseBatch` also rejects duplicate release IDs. Prerequisite cycle,
unknown concept/item/policy, stale item version, invalid content binding, and
unpublished release failures are delegated to the existing release validator,
so the runtime and authoring gates use one authority rule.

`deterministicManifestIdentity` hashes the canonical manifest metadata and the
existing deterministic release identity. It is stable for the same reviewed
input and changes when a pinned release, binding, policy, or provenance value
changes.

Run the report with:

```text
npx tsx scripts/validate-curriculum-releases.ts
```

The report separates registered release validation from scope coverage gaps.
Missing approved content is never replaced with generated or inferred content.
Founder/platform-reviewed content may be added through the existing
CurriculumContent provenance workflow, while MOE approval remains a distinct
field and gate. A release whose executable authority is `LIBERIA_MOE` must
also carry an approved MOE manifest; the validator rejects the current Grade 4
fixture's conflicting founder-review metadata until that authority record is
resolved.

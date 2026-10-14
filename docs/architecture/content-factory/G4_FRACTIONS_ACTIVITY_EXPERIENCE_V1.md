# Grade 4 Fractions Activity Experience V1 (Content Factory Wave 3B)

Status: governed-candidate content in a synthetic fixture, rendered by Teacher Preview. Nothing here
is published, released, reviewed or MOE-approved. Base: `main` at `86139e2d` (PR #185).

> **Activity Wave V1 update.** The experience is now the first-class `experience` field of
> governed activity content, not `extensions.experience`, which is rejected. The four activities
> are restored through the ActivityDefinition authority. See
> [ACTIVITY_WAVE_V1.md](ACTIVITY_WAVE_V1.md). The text below describes Wave 3B as built.

## What was built

Four activity experiences for the first governed vertical (Grade 4 Mathematics, fractions: equal
parts and parts of a set), carried by the existing `ActivityDefinition` contract:

| Activity | Kind / scaffolding | Collaboration | Minutes | Evidence intent | Shape |
| --- | --- | --- | --- | --- | --- |
| Guided practice: find a fraction of a set | PRACTICE / GUIDED | Individual | 12 | Practice only (observation) | 1 worked example in 4 steps (1/4 of 12 caps), then 4 on-screen items with a 2–3 step hint ladder |
| Independent practice: fractions of a set and a whole | PRACTICE / INDEPENDENT | Individual | 12 | Practice only | 6 mixed on-screen items, no worked example, at most 1 hint, sets with no drawn groups |
| Classwork: share bottle caps with a partner | CLASSWORK | Pair (Sharer / Checker) | 25 | Formative (written, observation) | Teacher-led Launch 5 / Pair work 15 / Share 5; 6 worksheet questions with real bottle caps |
| Homework: fractions of a set at home | HOMEWORK | Individual | 15 | Practice only (written) | 4 paper questions with objects found at home, hints in `<details>`, a self-check and a family note |

Fixture: `fixture.bundle.g4-math-fractions-activities@1.0.0-fixture`
(`lib/content-bundle/v1/fixtures/grade4FractionsActivitiesFixture.ts`). It is derived from the
merged `grade4FractionsFixture`, which is unchanged. It keeps the same fixture objectives, lesson,
unit, assessments and tool policy. Every activity moves to item version `1.1.0-fixture`.

## Design intent

- **Visual first.** Fractions are shown as strips (parts of a whole, including deliberately unequal
  pieces) and as sets of bottle caps, mangoes or stones, optionally in drawn equal groups. These
  are the same physical sets the candidate lesson requires. All visuals are inline SVG/CSS, with
  no external assets or new dependencies. Shaded and marked parts also carry a hatch or a tick,
  so meaning never depends on colour alone.
- **Manipulable.** Learners tap objects to mark part of a set, tap strip parts to shade a fraction,
  build a fraction with top/bottom number steppers (no free text), or judge whether parts are
  equal.
- **Meaningful feedback.** Feedback states are Incomplete, Not yet and Yes. Messages explain the
  specific mistake without giving the answer: swapped numbers, wrong whole, marks scattered
  across groups, or counting pieces instead of comparing sizes. The logic is pure in
  `lib/content-bundle/preview/fractionFeedback.ts`.
- **Guided vs independent.** Guided practice requires a worked example and at least 2 hints per
  item. Independent practice forbids worked examples, allows at most 1 hint, and needs at least 4
  items. The parser enforces these profile rules against the definition's kind and scaffolding.
- **Classwork** is teacher-led: phased flow, pair roles, required materials, look-fors,
  misconceptions with responses, and an observable evidence description.
- **Homework** is paper-only. The parser rejects any on-screen task. It is understandable without
  a teacher (self-check, family note, hints) and needs only household objects. It is readable as
  static HTML with JavaScript disabled and survives the network being cut. Print styles hide the
  preview chrome.
- Grade 4 language, Liberian context (bottle caps, mangoes, cassava bread, names Musu and Kollie),
  and controls of at least 44px height (48px for buttons). At 320px, an 8-part strip still gives
  each part at least 24px of width.

## Contract and projection boundaries

The experience body lives in `ActivityDefinition.extensions.experience` with schema
`activity-experience.v1` (`lib/content-bundle/v1/activityExperience.ts`):

- **Hashed and scanned.** Because it is inside the activity, it is part of the sealed content
  hash: editing a hint changes the bundle identity. The validator's forbidden-key scan also
  rejects student state, runtime fields and inline answer keys (`correctAnswer`, `answers`, …)
  inside it.
- **Strict parser.** The validator now runs `parseActivityExperience` and reports
  `activity_experience_invalid` for unknown fields, malformed visuals, profile-rule violations or
  a profile that does not match the definition. This is one additive validation code; there is no
  new approval engine.
- **No hidden answers.** No field stores a correct response. A construction task's `ask` is the
  fraction the prompt itself states (the parser requires the prompt to contain `n/d`). Naming and
  equal-parts tasks carry only the picture. Every value feedback uses is therefore visible to the
  learner already.
- **Learner projection.** `projectLearnerExperience` rebuilds the learner fields one by one, and
  `projectLearnerBundle` adds them as the optional `LearnerActivity.experience`. The `teacher`
  section never leaves the full bundle: summary, phases, grouping, materials planning, look-fors,
  misconceptions, differentiation, evidence note and alignment. An invalid or absent experience
  projects nothing (fails closed).
- **Preview models.** `TeacherPreviewModel` carries the full experience. `StudentPreviewModel`
  carries only `LearnerActivity.experience`. Teachers see the new row "Activity facilitation
  guides" in the withheld summary.

Teacher overview (`activity/TeacherActivityGuide.tsx`) shows the activity type, objective binding
with the learner goal, duration, collaboration and grouping, evidence intent with its classroom
meaning, lesson flow, student and teacher instructions, materials (required or optional) and bundle
resources, look-fors and misconceptions, rubric, a "what students do" item list, and the alignment
status. Student view (`activity/LearnerActivityExperience.tsx`) renders only learner-safe fields.

## No write path

There are no API calls, server actions, storage (local/session/IndexedDB), submissions or Prisma
access. Feedback is ephemeral React state. Nothing creates evidence, attempts, ScheduledWork or
mastery updates. There are no migrations. Tests check the source files for these patterns, and
the browser harness asserts zero external requests.

## Governance assumptions and readiness

| Area | Status |
| --- | --- |
| Objective binding | Fixture objective ids only (`fixture.obj.g4-math.fractions.*`), inside the fixture curriculum authority. |
| Alignment | Real repo refs as **UNREVIEWED_CANDIDATE**: MOE objective `moe-math-g4-s1-p3-number-theory-and-fraction-obj4` and candidate lesson `ll-g4-math-fractions-equal-parts-2026.2@1.2.0`, which is itself `PENDING_FOUNDER_REVIEW`. Not approval. |
| Release / review | No review, lifecycle or release refs. The resolver reports release `NOT_EVALUATED`, and the source is a non-authoritative fixture. Production refuses `fixture.` bundles. |
| Toolkit | Unchanged fixture mapping, still unreviewed. The set manipulative here is a preview renderer, not a reviewed runtime tool, and does not close `SET_FRACTION_MANIPULATIVE_REQUIRED`. |
| Offline | Homework is paper-only and works without a connection. The learner package adds the homework sheet asset (synthetic hash) and `PRINTABLE_WORKSHEETS`. Package closure is still not verified. |

**Production-ready:** the `activity-experience.v1` contract, validator rule, learner allow-list
projection, feedback logic and preview renderers, with tests and browser evidence.

**Governed candidate only:** all content. It needs curriculum review against the MOE objective,
a reviewed activity revision store, real objective ids and release binding, reviewed media and
offline assets, a reviewed tool mapping, and a learner delivery route outside Teacher Preview
(today, learners only see this through the teacher's Student view).

## Evidence

- `__tests__/content-bundle/g4FractionsActivityExperience.test.tsx` (31 tests) covers: fixture
  validity and profile/kind match; objective bindings and real alignment refs; content-hash
  coverage; rejection of inline answer keys, state and unknown fields; prompt-stated targets;
  profile rules; fail-closed projection; projection separation and the no-hidden-answer rule;
  feedback; each type in teacher and student mode; the classwork workflow; guided vs independent;
  native labelled toggle buttons and live feedback; steppers; the CSS target/focus contract;
  offline homework static markup; and no write path.
- `node e2e/g4-fractions-activities/run.mjs` (Vite + Playwright) covers four activities × two
  modes at 320/390/768/1024/1440 (40 layouts) with no overflow and no clipped content: teacher
  fields, no teacher leakage, Space/Enter toggles, Enter to check, a 3px focus ring including
  inside strips, an audit of every control for dead controls, touch targets at 320px, homework
  readable with JavaScript off and surviving offline, and zero external requests. Output:
  `artifacts/g4-fractions-activity-experience/` (screenshots, close-ups, `results.json`).

## Known limitations

- The authenticated Next route was not exercised in the browser. The harness renders the
  production components over fixture-resolved models, as Wave 2A did.
- Objective text still displays as ids; the fixture authority has no descriptions.
- The self-check boxes and on-screen answers are not kept after a reload. This is intentional:
  nothing is recorded.

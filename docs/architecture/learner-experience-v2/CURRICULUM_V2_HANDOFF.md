# Phase B handoff — what Curriculum V2 must emit

Curriculum V2 generation must emit lessons that are natively scene-based, so no
lesson depends on `parseToSlides`. The target is the `LessonExperience`
contract in `lib/learner-experience/types.ts`, checked by
`validateLessonExperience`. Generated output is a draft; release still requires
the existing human/MOE governance. Generation never sets `APPROVED_RELEASE` or
an `APPROVED` link.

## Per lesson

- `id`, `version` (bump on any scene change; old progress is discarded on a
  version change), `title`, `subject`, `grade`, `ageBand`.
- `authority`: `status` (generator output is never `APPROVED_RELEASE`),
  `candidateContentIds`, `releaseId` (null until released).
- `objectives[]`: governed objective id, learner-facing statement, `conceptId`,
  `standardCodes[]`, `skillIds[]`, following standard → skill → concept →
  objective. No invented ids: unresolved references are reported, not guessed.
- `offline`: `packageable`, `requiredAssets[]` with sizes.

## Per scene

- `id` (stable across versions where the instruction is unchanged), `type`,
  `title`, `objectiveIds[]`.
- `content.body` ≤ 350 words, split at instructional boundaries; `keyPoints`;
  `ageVariants` for each band the lesson serves.
- `interaction`, one of:
  - **explanation**: `NONE`.
  - **interactive diagram**: `DIAGRAM_REVEAL` with ordered steps (label +
    description each).
  - **check for understanding**: `MULTIPLE_CHOICE` formative items with
    `correctIndex` and correct/incorrect feedback (formative only).
  - **lab**: `LAB_LAUNCH` naming a `LearningExperienceLink` id.
  - **reflection**: `FREE_RESPONSE` prompts with `minLength`.
  - **assessment**: `ASSESSMENT_HANDOFF` with assessment id/version and item
    refs only. No answer keys in lesson output; keys go to the assessment
    authority.
- `media[]`: kind, ref, `alt` (required), `transcript` or `captionsRef` for
  audio/video, `offlineBytes`.
- `tools`: `allowed[]` / `prohibited[]` using toolkit registry ids
  (`KNOWN_TOOL_IDS`); prohibit calculators etc. where a check measures that
  skill.
- `accessibility`: `textAlternative` that teaches the scene without visuals,
  motion or 3D; keyboard / reduced-motion / captions flags.
- `offline`: `FULL` | `DEGRADED` | `ONLINE_ONLY` + learner-facing fallback text.
- `evidence`: `NONE` or {kind, `GovernedEvidenceType`, objectiveIds}.
- `completion`: the rule matching the interaction.

## Requesting a lab

Emit a **candidate** `LearningExperienceLink` (status `CANDIDATE`): objective
ids the lab's definition actually claims, placement scene, requirement,
pre-lab scene ids, post-lab reflection and check scene ids, and an evidence
mapping per lab check with disposition `RAW_OBSERVATION` or `PROVISIONAL`.
Only governance promotes a link to `APPROVED` (approver + date).

## Recommended scene arc

INTRO → OBJECTIVE → EXPLANATION (1–3) → INTERACTIVE_DIAGRAM or GUIDED_EXAMPLE →
CHECK_UNDERSTANDING → [LAB] → REFLECTION → PRACTICE → REVIEW → MASTERY_CHECK.
Every lesson needs at least one formative check before any lab or mastery
scene.

## Acceptance for generated lessons

`validateLessonExperience` passes; every link passes `validateExperienceLink`
against a real lab; no scene relies on `parseToSlides`; no answer key in
mastery scenes; text alternatives present; each served age band has wording.

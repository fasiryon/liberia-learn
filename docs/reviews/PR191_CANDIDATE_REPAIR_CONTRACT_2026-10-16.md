# PR191 candidate repair and release contract

This is an engineering repair proposal. It approves no curriculum or assessment.
The original PR191 head is `5650c4be8a9dbbb07cfbdb4d2f8312cf66443885`.
The dedicated repair branch incorporates validated upstream PR190 repair head
`14f71a5d9488c65712b3c1a4b968dd1375342fb9`; both original PR branches remain
unchanged. The repair author is an AI agent and cannot independently approve
these repairs or claim qualified human curriculum review.

## Provenance repair

The isolated pair `45a4b57e9e2f8375b1686975e9a87a2f5fd25622` reproduced the
native-package freshness failure. In-memory comparison found exactly one
generated difference, Math `scene-manifest.json` at `/sources/3/sha256`.
PR190 commit `376df51dcea8e9a20ecc59ef953feea5f2d47510` replaced the standalone
`components/experience/demo/PlaceValueDemo.tsx` with a TeachingLessonPlayer
wrapper. The library-fund and three practice examples moved into
`lib/learner-experience/teaching/demoLessons.ts`. This changed the demo runtime
and its source metadata, not either native candidate's learner content.

After upstream validation, ran
`node node_modules/tsx/dist/cli.mjs scripts/build-curriculum-v2-g7-native.ts`.
Only that source hash changed, from
`d96f84969167c6376f1b040e4047fc2822ffe3771d79854918b4f042e2e726c7` to
`4772d44beda9429c659f4bf8e8c6de5e928e32b1a9dd65ab948002e73437746c`.
The authoritative generator and freshness assertions were preserved. The pin
describes the refreshed demo wrapper; the original hash above records its prior
inline implementation. No new runtime Git or production dependency was added.

Native hashes remain Math
`c68b1a37f1852458cd3765643a43c59d6cc1d80ea0ef6f0ab9d67b7860d2ca95`, 18 scenes,
and Literacy
`0f275a880588aa8e9451a0ea368bf0fa18bee6cbd826bb1c15d86c4fdc952828`, 20 scenes.
No scene, review status, assessment key, rubric, release binding, ontology,
template, historical record or candidate asset bytes changed.

## Artwork boundary

Candidate diagrams retain their bytes and development preview paths. Middleware
now returns 404 with no-store for the candidate-artwork namespace in production
and on Vercel, before authentication or public-path bypasses. It checks the
decoded pathname used by Next's filesystem resolver as well. This closes the
documented authenticated static-file leak; removing a namespace from the public
allowlist alone did not deny authenticated callers. Ordinary public assets and
local development candidate previews remain available.

The focused regression failed 6 cases before the guard. Final security and
combined production-boundary results belong in the joint validation report.

## Assessment coverage decisions before any release

Deterministic blueprint coverage does not demonstrate academic adequacy.
The existing v0.3.0 candidates remain pending qualified exact-revision review.
In particular, Literacy's structure objective includes a conclusion, while
`pl-w1` asks for a thesis and PEEL paragraph. No independent conclusion or full
essay is required by the end-of-lesson tasks. Do not claim complete independent
structure mastery from this candidate. A curriculum owner must select one of:

- Revise the independent final task to require a coherent thesis, connected
  paragraphs and conclusion, and extend the analytic rubric to assess argument
  coherence and conclusion quality. Preserve student writing as a raw original
  response, with model answers and the reviewer rubric withheld from learners.
- Narrow the candidate objective and its claims to thesis/paragraph production.

Either option requires an explicit candidate revision, regenerated exact hashes,
new qualified review and governed release admission. Neither is implemented by
this engineering repair. Original-writing rubrics need human calibration and
independent scoring authority; no automatic mastery score is authorized.

Prerequisite wrong answers currently record observations and show planned
remediation guidance. Before release, define who reviews those observations,
assigns remediation, verifies readiness and administers the next unaided task.
Similarly, define who schedules and marks delayed retention and transfer, how
absence/offline retries are handled, and how assistance is verified per attempt.
The 7-day definition alone cannot support the outcome classifier's 14-day
retained-learning claim. Optional extensions must remain non-gating.

Curriculum owners must decide millions as a LiberiaLearn extension, the recorded
Grade 7 English source-structuring problem, and the Grade 8/9 argumentative scope.
Do not promote broad WAEC subject relevance to Grade 7 topic endorsement without
a pinned primary syllabus. No official MOE approval or global comparability is
claimed. Independent student outcomes remain unmeasured.

## Proposed PR191 description correction

Grade 7 Native Curriculum v0.3.0 contains two unreleased candidates: Mathematics,
Number Sense and Place Value: Millions to Thousandths, 18 scenes; and Literacy,
Understanding Essay Writing: Structure and Argument, 20 scenes. Curriculum
Excellence V1 supplies review contracts and advisory gap analysis. The PR does
not approve, publish, register releases, bind an ontology/template, enable
mastery scoring or migrate learner records. Qualified human curriculum and
assessment decisions above remain required. This text is prepared locally;
no PR body or external message was posted.

## Image optimizer follow-up

The combined production-mode probe found that routing an unreleased candidate
SVG through `/_next/image` reached Next's image decoder and returned an internal
error for an empty upstream buffer. It did not establish an artwork disclosure,
but failed the required controlled-rejection check. Middleware now explicitly
matches that optimizer endpoint, rejects local candidate source URLs before
authentication with 404/no-store, and preserves the previous public optimizer
behavior for other sources. No image or curriculum bytes changed. The focused
regression (including absolute same-origin, dot-segment and encoded-dot sources)
failed before the fix and passed afterward; complete combined
validation must run again on this follow-up before a merge recommendation.

# Learner Experience V2 authority and rollout boundary

The learner's primary Today action comes from a persisted LearningDecision. The
student route `/api/student/learning-authority/next-action` reads the published
release for the learner's grade, calls the existing Learning Orchestrator and
DecisionModel, and returns the selected item's learner-safe projection. The
sealed HttpOnly session binds the decision, exact item version, release identity,
school, Student, and User. The older Grade 4 student URL uses these same handlers.

The answer route accepts only an option index and session identifiers. It checks
the current decision, scores the exact released item on the server, admits the
observation through the release's evidence and ToolPolicy, and calls the
canonical mastery writer. The learner may report tools it opened only when
the issued ToolPolicy allows them; that list is admission provenance, never a
scoring input. A replayed attempt on the same decision returns 409 without a
correctness result, so duplicate submissions cannot probe the answer key.
The Student Learning Model replays that event; the
next GET resolves a new decision from the new state revision. Neither learner
UI nor tutor writes correctness, mastery, confidence, or administrative grade.

The learner page uses the existing fraction and number-line toolkit components
only when the server-issued ToolPolicy permits them. The floating tutor is
hidden during the activity; the existing tutor is linked after submission.
Learner-safe mastery and confidence are shown after the server responds.
Teacher intelligence displays governed misconception evidence when present.
On a network failure, the last issued item is read-only and submission waits
for a fresh online session. No offline cache writes canonical evidence.

`publishedReleases.ts` is the executable release registry. Reusable release,
decision, evidence, and state validation accept grade and subject from any
registered published ontology release. A binding may pin an exact reviewed
`contentBindings` collection distinct from assessment `bindings`; an approved
`LESSON` binding pins concept, exact `contentId`, exact content version, and
instruction ToolPolicy. The learner page then links to the existing lesson player.
No such binding is present in the current Grade 4 fractions release, so this
mission does not claim a certified lesson transition for that slice. The
repository contains no explicit approved CurriculumContent binding for release
`lr-moe-g4-math-fractions-2026.1`; standard `LR-MATH-G4_6-02` appears only in
generic standards and seed records. Choosing which lesson to approve is an
educational-content decision reserved for founder/MOE review, not inferred from
title, grade, or standard. Repository candidates are not Grade 4 lessons:
`math-g5-fractions` is Grade 5 sample content; `wk_mca7a_mon_p1` and
`wk_mca7a_mon_p5` are Grade 7 demo lessons; and
`lab-fraction-multiplication` is a Grade 4 lab rather than an approved lesson.
The configured curriculum database could not be audited because its supplied
Supabase tenant credentials fail with `tenant/user ... not found`; no live
candidate or approval claim is made. Other
grades have no registered governed release yet and continue to show assigned
schoolwork rather than a fabricated governed action. Full curriculum expansion
must register approved releases and exact lesson bindings, then certify their
lesson, practice, diagnostic, and offline flows before enabling them.

The in-process E2E test exercises the real decision store, orchestrator,
admission policy, mastery writer, replay, and API handlers with an in-memory
event store. Live database and device E2E certification remain separate gates.

## Product Redesign V1 refinement

`docs/architecture/learner-experience-v2/PRODUCT_REDESIGN_V1.md` refines this
document with the student information architecture (Today, Learn, Labs,
Progress, Help), the Lesson Player V2 scene contract, the unified Lab
Experience, governed lesson–lab links, the Labs tab and the route and slide
migration plans. It does not change any rule above: lessons and labs emit
observations only, the server scores, and the existing DecisionModel and
Learning Orchestrator choose the next action. The Phase B contract for
Curriculum V2 is `docs/architecture/learner-experience-v2/CURRICULUM_V2_HANDOFF.md`.

## Lesson Experience V2 runtime (student lesson routes)

`/student/lesson/[contentId]` and `/student/lessons/[scheduledWorkId]` consult
`GET /api/student/lessons/:id/experience?kind=CONTENT|SCHEDULED_WORK` first.
Delivery contract `lesson-experience-delivery/1.1.0` carries the server-resolved
`routeTarget`. The shared route model, return target, encoder and URL builder
live in `lib/learner-experience/lessonRoute.ts`.

`NATIVE_V2` uses Lesson Player V2; `LEGACY_COMPATIBLE` retains the existing
legacy renderer and its enrichment metadata. Authorized native denials carry
`format: NATIVE_V2` and `NOT_RELEASED`, `REVOKED` (410) or `NOT_STUDENT_READY`;
they never fall back to legacy. Before school/class/learner authorization,
missing and restricted records reveal no native format or release status.
Assignments reach the seam directly without the legacy work API's authored
status gate, date-window alias lookup, or scheduled-work creation.

- Live formative delivery is keyless (`feedbackAuthority: SERVER_REQUIRED`);
  the runtime rejects keyed payloads and records choices without correctness.
- Only `authorizedLabLinks` open a lesson-linked lab. Each link has exact
  launch context and structured `{ route, sceneId }` return target. `rt=c:<id>`
  or `rt=w:<id>` identifies the actual originating route; `lv` carries the
  authorized lab version. The lab page reauthorizes the exact lesson/link and
  requires the runtime version to match. Showcase grants never supply lesson
  link certification.
- Evidence remains `OBSERVATION_ONLY`, `authoritativeSubmission: false`,
  `masteryMutation: false`, `submissionEndpoint: null`, with next action owned
  by the Learning Orchestrator. Production injects no submission channel.
- Admitted offline native copies allow read-only scenes, local navigation and
  resume. They cannot launch labs, grade or submit evidence. Reconnect requests
  the exact version; access loss purges the cache, and changed identity/version
  becomes `INCOMPATIBLE_VERSION`. The seam grants no offline cache admission.

See `learner-experience-v2/LESSON_EXPERIENCE_DELIVERY.md` for the convergence
inventory, authority rules, synthetic validation scope and limitations. There
is still no released production native V2 lesson binding or certified lab.

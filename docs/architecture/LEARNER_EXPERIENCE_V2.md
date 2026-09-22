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
`lessonContentId`; the learner page then links to the existing lesson player.
No such binding is present in the current Grade 4 fractions release, so this
mission does not claim a certified lesson transition for that slice. The
repository contains no explicit approved CurriculumContent binding for release
`lr-moe-g4-math-fractions-2026.1`; standard `LR-MATH-G4_6-02` appears only in
generic standards and seed records. Choosing which lesson to approve is an
educational-content decision reserved for founder/MOE review, not inferred from
title, grade, or standard. Other
grades have no registered governed release yet and continue to show assigned
schoolwork rather than a fabricated governed action. Full curriculum expansion
must register approved releases and exact lesson bindings, then certify their
lesson, practice, diagnostic, and offline flows before enabling them.

The in-process E2E test exercises the real decision store, orchestrator,
admission policy, mastery writer, replay, and API handlers with an in-memory
event store. Live database and device E2E certification remain separate gates.

# Lesson Experience V2 convergence evidence

These are local synthetic fixtures, not published curriculum, hosted data or lab
certification. The authority tests supply isolated mocked releases; browser tests
mount production route clients against explicit fixture API responses.

`results.json` records the complete browser matrix, route/scene returns, denial
states, cached read-only presentation, keyboard focus and accessibility checks.
The 13 tracked screenshots are selected examples: early-primary mobile/tablet,
upper-primary mobile/desktop, long text, assessment handoff, assignment delivery,
return scene, offline notice and unavailable states. The runner generates the
remaining captures locally; `.gitignore` keeps redundant captures out of the diff.
The runtime source commit preserves the original full screenshot history.

The lab leg proves navigation continuity only. It does not exercise a real
certified production lab; the fixture lab remains unavailable to ordinary
production learners. No `flow-lab-*` stub screenshots are retained as evidence of
certification. Cached presentation uses synthetic cache admission in the browser;
signature admission and learner partitioning remain covered by offline tests.

Production limitations and the authority/runtime inventory are documented in
`docs/architecture/learner-experience-v2/LESSON_EXPERIENCE_DELIVERY.md`.

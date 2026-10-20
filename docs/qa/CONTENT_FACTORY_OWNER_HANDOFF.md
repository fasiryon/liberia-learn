# Content Factory owner handoff for PR #195

PR #195 now targets main. Integration repair preserves the original head `3e4ba71df9f462d273fe3be1e1bb585aea30c8c0`, current main `ebfdc2a07aa955553a172e99e41e65d6a9f67f66`, contract `ac196397cb13bd6866879c9f5c24503e5195c61d`, manifest digest `4cb6fb5588f5f840fe8b702f181a051a5838b093c1db82b0ea14d9c4b64ea549` and E1.

The separate factory adoption patch is commit `0d63e6eed755dcd0717019fc2f89742d7d136a29` in `C:/liberia-learn/.task-worktrees/factory-first-ten-v1-adoption`, branch `repair/factory-first-ten-v1-adoption`, based on owner head `366f299545fdd9af7e271d6ee1767293854ce915`. The review branch is pushed; its head `c41cb1b75a0ba4a2c01c72b387fb1feed18ef0d8` adds a sanitized validation receipt. Final factory verification: 98 tests pass across nine files, focused TypeScript passes, and changed-file validation passes (24 changed tests plus 60 related tests). It archives the 0.1.0 baseline, requirements and templates; verifies immutable 1.0.0 contract bytes, E1 and all ten unchanged source identities; and creates empty 0.2.0-candidate templates. It never rewrites restricted authored inputs or immutable package slots. The existing 0.1.0-cohort authored files require a separately versioned 1.0.0-cohort delivery and content/requirements validation. Changing only their cohort field is not sufficient. The owner's later head `308a9eac629f54f472e01af9ee817c465e861621` and active lab WIP are untouched. Apply the patch only from a safe owner checkpoint; do not overwrite ongoing work. Owner adoption/acknowledgment remains pending.

Once real governed runtimes for ft01-v1/v2, ft04-v1 and ft07-v1/v2 are complete, supply a restricted handoff for `wk_mca7a_fri_p4`, `wk_mca7a_fri_p3` and `lesson_mca_1`. For each, include:

- Reviewed runtime commit, runtime ID/version/hash and actual adapter registration.
- Candidate ID/version, immutable directory, package and manifest SHA-256.
- Exact source, revision and snapshot pins, plus the explicit contract-adoption receipt.
- Learner-only projection and existing Student Experience V3/review-harness route.
- Deterministic rerun receipt and file-hash closure, with no overwrite of prior slots.
- Review-only DRAFT status and false approval/publication/release flags; the other seven lessons remain NOT_STARTED.

Keep protected keys, rubrics and raw authored envelopes out of Git and public comments. Static figures, written lab specifications and older modernization pilots are not executable-runtime evidence. Do not bypass required-media/runtime gates or invent package paths and hashes.

Independent QA will then run reading, fullscreen slides, interactive stages, guided practice, protected-answer and independent-attempt boundaries, accessibility, teacher-visible evidence and offline restrictions at 360, 390, 768 and 1440 px using synthetic fixtures only. The Student Learning Model write bridge, offline independent mastery and official grades stay off.

Academic status remains **BLOCKED FOR ACADEMIC APPROVAL** until authorized qualified human review is documented. No reviewer identities are assumed.

Communication record: automatic approval review rejected a proposed public comment on issue #196 because the public channel was not explicitly authorized. No comment was posted. This shared local handoff is the coordination artifact.

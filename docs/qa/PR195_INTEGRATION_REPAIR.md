# PR #195 integration repair — 2026-10-20

Verdict: **NOT READY TO MERGE**. Academic outcome: **BLOCKED FOR ACADEMIC APPROVAL**. No authorized qualified human reviewer is documented. AI analysis and automated engineering checks cannot approve content.

## Reconciliation and preservation

PR #195 has been retargeted to `main`. The repair preserves original head `3e4ba71df9f462d273fe3be1e1bb585aea30c8c0` as an ancestor and integrates main `ebfdc2a07aa955553a172e99e41e65d6a9f67f66` without rewriting history. Only the four modernization commits were absent from main before the repair; the already merged Grade 7 architecture does not reappear as unrelated changes. The unchanged first-ten contract and E1 are integrated explicitly. The eventual PR push is a normal fast-forward, not a force push. No PR merge, production deployment, migration or publication is authorized or performed.

Inventory, ledger, tracker, pilot packages and ledger implementation have no differences from the original modernization head. The diff introduces no schema, migration, student assignment, student progress or official-grade changes. This is code/history preservation evidence, not a live database audit. The six older candidates remain awaiting independent review; no review acceptance, release authorization or release is recorded.

## Revalidated inventory and source contract

The read-only local capture is dated 2026-10-16, digest `7d5e25cb2a6e2d26e5dc6327c8d2caebeb5882c278d0e9c8c430502de1a7c4ca`. All 1,105 distinct source revision hashes recompute correctly. All audit digests and classifications reproduce with zero differences:

| Classification | Count |
| --- | ---: |
| REVISE: targeted repair 356 + instructional redesign 345 | 701 |
| REBUILD REQUIRED | 51 |
| GOVERNANCE HOLD | 353 |

These are reproducible classifications against that capture, not an attestation of today's production inventory or academic correctness. Live-row equality is an export assertion; identical live snapshots were omitted from the extract. All 3,702 ledger events replay with zero problems. All 1,105 lessons retain NO_EVIDENCE learning outcomes; no mastery is inferred from structural checks.

Contract `1.0.0` remains pinned to `ac196397cb13bd6866879c9f5c24503e5195c61d`. Spec SHA-256: `648ec61a72e2ddff147444dadae75aff321866cfc660498a792b6a3b48e7a28b`. Manifest SHA-256: `4cb6fb5588f5f840fe8b702f181a051a5838b093c1db82b0ea14d9c4b64ea549`. All 29 pinned contract/review Git objects and all ten source database IDs, content IDs, revisions, revision numbers and snapshot hashes are verified. No pinned contract bytes changed.

Erratum E1 remains at `d640b6fcb9e102b0a06a9d49a136a0aca6948a8f`, handoff SHA-256 `18b4b4b1f2094c3bfae15064d9a5ce4eef9b72f11a838d626be54dd0853f8701`. Its retention owner is `git:dd8568500:lib/assessment/v2/retention.ts`; policy `ll-aep-001-retention-pilot`, version `1.0.0`. E1 changes no interval or lesson field.

The narrowly scoped factory adoption patch is kept separate from #195 to avoid importing unrelated factory implementation. Code commit `0d63e6eed755dcd0717019fc2f89742d7d136a29` and receipt commit/head `c41cb1b75a0ba4a2c01c72b387fb1feed18ef0d8` are pushed on `repair/factory-first-ten-v1-adoption`. It archives the original 0.1.0 baseline, requirements and empty templates byte-for-byte, adopts a checked local mirror of the unchanged 1.0.0 contract, and creates empty candidate-version 0.2.0 templates. Intake/subset transport versions advance to 2.0.0. Runtime guards reject tampered pins, lost E1, source changes, approval flags and stale cohort inputs. Canonical misconception IDs and retention policy/purpose/context metadata are retained. Relabeling only an old input's cohort is rejected by blueprint provenance checks. Restricted authored inputs and immutable packages are never rewritten by this patch. Owner adoption is pending; its active runtime branch and worktree are untouched. The cross-branch contract report verifies the repaired code commit, not an assertion that the owner's remote branch has adopted it.

## First-three content and runtime findings

The real restricted authored deliveries exist for Civics `wk_mca7a_fri_p4`, Science `wk_mca7a_fri_p3`, and Math `lesson_mca_1`; their hashes and previous structural review are in [the earlier QA report](PR195_CONTROLLED_INTEGRATION.md). They still name the old 0.1.0 cohort and require a separately versioned delivery against 1.0.0. The three immutable candidate package paths/hashes have not been delivered. Active lab implementation is work in progress, not validated runtime evidence. The other seven candidates remain unselected.

A restricted AI advisory audit records **0 P0, 12 P1 and 29 P2** findings. Its sanitized ID/severity/dimension index is in `artifacts/pr195-integration-repair/advisory-audit-index.json`; raw bodies, answer keys, scoring rubrics and detailed protected findings remain restricted. Severity counts do not constitute human academic adjudication or a claim that no additional defects exist.

| Dimension | Finding or required evidence |
| --- | --- |
| Academic accuracy | Civics map label/adjacency claims and county-source dates require adjudication. Science evaporation/temperature behavior needs physical validation in the real runtime. |
| Age-appropriate depth | Reading level, pacing and conceptual explanations remain advisory findings for qualified subject review. |
| Objective alignment | Verify each required objective against instruction and independent evidence; structured MOE alignment remains unverified. |
| Instructional coherence | Civics capital-card stage has 12 elements against a promised 17; the promised partially labelled fading stage has no media. These two structural discrepancies were independently reconfirmed. |
| Assessment quality and independence | Audit identifies repeated worked-example material in delayed retrieval, distractor coverage gaps and ambiguous diagnostic routing. Exact protected items stay restricted. Resource authoring dependencies alone do not prove learner delivery order; inspect the actual route before changing it. |
| Protected answers/rubrics | Require learner-only projection and negative role, tenant, network, cache and bundle checks. Existing boundary suites pass; actual candidate projection remains pending. |
| Visuals/accessibility | Civics nonvisual map description, label placement and Maths tick emphasis need correction/review. Verify keyboard operation, focus, screen-reader names, contrast, zoom and equivalent nonvisual tasks in the real renderer. |
| Interactive lab value | Real runtimes must support prediction, manipulation, observation, explanation and a useful fallback. Validate phase/particle invariants and comparison feedback; written specifications are insufficient. |
| Misconceptions/interventions | Check every canonical misconception ID, distractor/response mapping, specific feedback and usable intervention without exposing independent answers. |
| Retention/transfer | Preserve E1, independent assistance NONE, delayed scheduling and unfamiliar transfer; inspect item independence and rubric validity. |
| Source provenance | Ten legacy bindings and contract pins pass. Complete factual-source/license validation and authoritative curriculum alignment are still required. |
| Teacher usability | Require clear prerequisites, pacing, intervention routes and teacher-visible evidence without converting practice into official mastery. |
| Mobile/offline | Actual first-three runtime/performance/offline evidence remains pending. No offline independent mastery, Student Learning Model write bridge or official grade path is enabled. |

## Prepared responsive and assessment-boundary QA

The [existing browser probe](../../scripts/qa/probe-first-three-availability.cjs) targets 360, 390, 768 and 1440 px, blocks external traffic and mutation requests, and distinguishes proposed blueprint IDs from delivered candidates. Historical browser receipts cover proposed-ID absence and complete older-pilot controls at 360/390, plus partial screenshots at 768. They are not first-three rendering acceptance; 1440 and the full interaction matrix are NOT RUN for real candidates. No new candidate browser pass is claimed.

After the owner supplies immutable package and runtime identity, run this matrix for each lesson at every width using synthetic learners only:

1. Open the exact package in Student Experience V3/review harness; verify package/hash closure, reading layout, no horizontal clipping, zoom and fullscreen slides/focus restoration.
2. Operate each learning stage with keyboard and touch; verify visual/scientific correctness, nonvisual equivalent, lab invariants, fallback and performance under a constrained device/network profile.
3. Complete guided practice; verify useful hints and interventions, and clearly labelled practice evidence.
4. Start an independent assessment; inspect DOM, hydration data, network responses, static bundles, service-worker/cache entries and role-denied endpoints for protected keys/rubrics. Reject client-asserted correctness, cross-tenant access, practice carryover and assistance in independent evidence.
5. Verify teacher-only evidence with synthetic roles; confirm official grades, canonical mastery and the write bridge remain untouched.
6. Exercise offline transition, reload and reconnect. Require clear unavailable/deferred behavior for independent work; cached reading must not mint independent mastery or replay official scores.

First-three browser, accessibility, runtime and teacher-evidence outcomes remain **BLOCKED — IMMUTABLE CANDIDATE/RUNTIME DELIVERY REQUIRED**. The precise owner handoff is [CONTENT_FACTORY_OWNER_HANDOFF.md](CONTENT_FACTORY_OWNER_HANDOFF.md). No candidate path, package hash or qualified reviewer identity is invented.

## Validation and remaining merge gates

Sequential Prisma generation and production build both exit **0**, using one build worker, a 4 GiB Node heap and dummy loopback database settings. Build ran 2026-10-20 15:27:08–15:42:02 UTC and generated all 391 static pages. Existing lint/hooks, instrumentation and dummy-cache warnings remain. Windows emitted EPERM warnings while copying traced symlinks into standalone output; therefore the successful command does not certify deployable standalone packaging. Require Linux CI build/package evidence before deployment.

Modernization, Curriculum V2, security, learner-experience, Assessment V2, learning-authority and provenance suites: **1,460 passed, 6 skipped; 76 files passed, 1 skipped; 181.51 seconds; exit 0**. The conditional PostgreSQL test was skipped; no database integration pass is claimed. Final factory suite: **98 passed, nine files; 115.82 seconds; exit 0**. Pin/render/manifest, inventory, ledger and release/provenance checks all exit 0; release validation still reports existing coverage/authority gaps and is not release approval.

Full `tsc --noEmit` passes with a 4 GiB heap (286.55 seconds). Changed-file validation against main passes with 139 changed tests and 187 related tests, plus API route policy audit and JavaScript syntax checks. Validation of the repair's working tree/index also passes; related discovery reports no additional tests, rather than a fabricated test pass. Factory focused TypeScript and changed-file validation pass (24 changed tests plus 60 related tests). Empty-template regeneration produces zero tracked differences. The earlier report and its timeout evidence remain historical and are superseded by this build receipt, not rewritten. The local, uncommitted `artifacts/pr195-integration-repair/final-receipt.json` records the exact final pushed head and subsequent GitHub CI readback, avoiding a self-referential commit hash.

Engineering reviewers must independently inspect the reconciliation, immutable source/history guarantees, contract adoption, learner projection and assessment boundaries. Qualified authorized humans must adjudicate academic findings and sign an exact package hash before academic acceptance. Requests and identities remain pending; no external reviewer request was sent without authorization. Keep #195 draft until its exact-head CI and independent engineering gates are satisfied. Keep all lesson replacements unpublished and all governance holds intact regardless of PR code readiness.

## Exact-head CI integration repair

CI run `39456117273` on head `de39b68b7b994b6a9b8b8d7c6999a5a19dcf716c` (synthetic merge `ea6ace0d64d4c759ceeb10c9d52f6e7ddd864561`) passed TypeScript and then failed one test: **7,987 passed, 1 failed, 11 skipped; 797 files passed, 1 failed, 2 skipped; 225.51 seconds**. Build, vault and browser steps were skipped after that failure. Vercel's separate status on that head was success; it does not replace the failed required CI gate.

The G7 reviewer-reader test matched the generic `assessment-definitions.json` filename in two legitimate modernization review package modules. Local reproduction gives the identical failure. The repair keeps a strict allowlist for all protected-definition packaging modules and adds a separate exact G7-namespace assertion whose two approved code paths remain unchanged. It does not expose definitions, add a scorer, approve content or alter any package hash. G7 integration, modernization and security regression verification after repair: **309 passed, 24 files, 37.34 seconds; exit 0**.

The original CI checkout also lacked the pinned route-policy baseline: Git reported an invalid symmetric difference, and the audit reported zero changed routes. CI now fetches complete history so provenance and route-policy audits can inspect their actual pinned baselines. The workflow YAML parses successfully; local route-policy audit verifies 91 changed routes. This strengthens the existing check without changing its policy or suppressing errors.

The original install log reported 62 dependency advisories (1 low, 36 moderate, 21 high, 4 critical). They are untriaged and dependencies are unchanged by this repair; no dependency-security acceptance is claimed. The sanitized failure/repair receipt is `artifacts/pr195-integration-repair/ci-failure.json`. The final local receipt records the new pushed head and fresh CI outcome; an earlier passing local build is not represented as a Linux CI build pass.

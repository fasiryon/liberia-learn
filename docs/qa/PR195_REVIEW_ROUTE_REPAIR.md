# PR #195 reviewer route repair

Reviewed 2026-10-21. Continue the existing draft PR; do not merge or deploy candidates.

## Working reviewer URLs

On the isolated local runtime, these return HTTP 200 for a signed national curriculum reviewer session and 404 for anonymous, student, teacher and school-admin sessions:

- http://127.0.0.1:3195/lab-review/experience/candidate-ft01-g7-civics-counties-capitals
- http://127.0.0.1:3195/lab-review/experience/candidate-ft04-g7-science-states-of-matter
- http://127.0.0.1:3195/lab-review/experience/candidate-ft07-g7-math-fractions

They require the existing national `assertReviewReadScope(user, null)` permission and normal NextAuth session verification. The harness requires `LAB_REVIEW_HARNESS=1`; production, hosted Vercel and disabled-harness requests are rejected. The URLs are local review infrastructure, not deployed links. The reproducible Chromium probe issues signed synthetic NextAuth sessions for this isolated server only. The app has no test-auth bypass.

## Repair and safety boundary

The original loader registered older pilots but none of the three delivered candidates. The repair imports the factory's exact runtime source pins and adds a read-only package resolver to the existing lesson and lab harness. It uses the owner's strict resource parsers, existing Curriculum V2 learner projection and real `resolveLabProposal` registry resolver. It does not substitute another lesson or create static candidate pages.

Before projection, the resolver checks the manifest byte hash, domain-separated package digest, exact file set and every file hash, original authored V2 bytes, resource digests, source identity/revision/snapshot, canonical runtime binding and all 30 runtime source pins. URL input only selects from three fixed IDs; it cannot select filesystem paths. Unknown, altered, stale and unauthorized inputs fail closed. The national read scope is checked in middleware, the review layout, lesson/lab pages and media/diagnostic handlers. Responses are private/no-store. PNG media is served only through the authenticated exact-hash handler; no restricted package is copied to `public/`.

The added synthetic sequence uses each real package's diagnostic and worksheet. The existing Assessment V2 scorer chooses prerequisite remediation on the server. Only the routing decision and learner worksheet leave that boundary; protected diagnostic keys and scoring specs stay server-side. Correct diagnostics proceed to instruction. Incorrect diagnostics require the worksheet before instruction. Progress is a local review convenience and cannot establish educational authority.

The packaged instructional and guided-practice scenes launch the registered 1.1.0 simulations and return to the same scene. A final explicit assessment handoff keeps independent summative items closed pending authorization. It performs no scoring, official-grade write, mastery write, release, publication or production mutation. The existing aggregate assessment consumers and Student Learning Model write bridge are not activated. Immutable package bytes and historical ledger/source records are unchanged.

## Exact factory delivery and V0.2.1 coordination

Imported owner checkpoint: `3cc50242d`, from `first-three-v2-reconciliation`. The shared owner handoff is `docs/architecture/content-factory/FIRST_THREE_V2_CANDIDATES_HANDOFF.md` in that worktree. The real V2 root is `C:/restricted-authoring/review-packages/first-three-v2-61fa60b7`, resource/candidate version 0.2.0, contract `1.0.0+FT-A001`, runtime 1.1.0. The old `first-three-6c1d6f8e` packages are superseded V1 inputs and are not used by this repair.

| Candidate | Immutable package digest | Manifest byte SHA-256 | Lesson resource digest |
| --- | --- | --- | --- |
| Civics | `8c3be8668f3192cdc37e9c98d3f5f63ea444827afe314194011d717f30d17238` | `a855afb8376bda5b719751f44dbc930fc5906c29d957b16eb9f3869a7244077b` | `1c87d2494eb5c897fb64a71a56d3c3580b720102e7e3e3daf03dcdc8cb4bb23f` |
| Science | `554b6df9010129efcc6e0389da70f2bfbd6a1ff9c1d7f344c0cd9285f68c1436` | `b591a7d03e25bb457f1b71492bed992ad6ddc4020e5b4c991b5df3f37e794243` | `48024b73aa91799a97a6f2591853b74cb1fc0fdcfb484629ec7be5f83945489d` |
| Mathematics | `94320f36beb28bc7bb3b4e716661e6d5a086a15c5a8f1991b3e4df37aabc3749` | `fe9180cae99f37cf156a49b26c14b7b7d25fef63c9cee977b412c2ddd6f63243` | `d98c76f902bfc264b13f9967849dc15b4fc5d5da9c0616329e48f397fc251602` |

**Return handoff to Content Factory:** V0.2.1 in `completed-v021` remains pending owner adoption. No rebuilt V0.2.1 delivery was available during this repair. This document is the shared local coordination artifact; no public message or owner acknowledgment is claimed. Deliver a new immutable root, candidate versions, manifest byte/package/resource digests, source and runtime pins, explicit contract/cohort-adoption receipt and deterministic rerun evidence. Then update this narrow resolver's pinned delivery/version and repeat the exact-package and browser gates. Do not relabel V2 packages, overwrite earlier slots or infer V0.2.1 hashes from authored files.

## Verification

- `npm run validate:changed`: PASS. Changed tests: 101 passed, 12 explicitly skipped. Related tests: 1,956 passed, 18 skipped; 122 files passed, one skipped. The standard run deliberately skips external restricted-package tests and the unavailable external authored feedback reference; skips are not candidate certification. TypeScript and API route-policy checks pass.
- `PR195_REAL_PACKAGE_QA=1 npx vitest run __tests__/learner-experience/candidate-review.test.ts`: 21/21 PASS with no skips. Covers the real delivered bytes, both diagnostic branches, stale hashes, invalid responses, tampered manifest rejection, learner-field isolation, candidate-only links and registered lab actions.
- Auth regressions: 37/37 PASS. Registry and production-record regressions: 54/54 PASS. The static inventory now has 19 entries, including the three additional unreleased labs; none are certified student labs.
- Chromium: three complete synthetic sequences, 60 instructional/handoff scene visits, all six lab launches and returns, six simulations started and six keyboard-driven model changes. Captures verify actual SVG simulation frames, not intro screens. Rendering uses the registered FALLBACK_2D model-driven renderer; this is not HIGH/LOW renderer or device-performance certification.
- Responsive matrix: 96 captures and 96 axe WCAG 2/2.1 A/AA runs across 360, 390, 768 and 1440 px. Diagnostic, remediation, explanation, worked example, formative check, each running lab and final handoff have no horizontal overflow or detected axe violations. Forty-two runs contain incomplete results requiring manual review. No screen reader, low-vision user or physical-device testing is claimed.
- Browser access: 15 HTTP checks verify unknown IDs and unauthorized identities. Production, Vercel, disabled harness, missing identity, foreign-origin POST and client-asserted grades are separately tested. Browser checks use normal signed session validation and a local read-only PostgreSQL consent fixture.
- Protected delivery: 27 completed HTML/RSC/JSON response bodies inspected without protected assessment fields; 13 aborted/prefetch bodies were unavailable to Chromium and are not claimed inspected. Exact-package projection assertions supplement this limited network capture. No `/lab-review` entries in Cache Storage, no unexpected mutation/nonlocal requests and no page errors were observed. Independent summative payloads are not delivered.

Reproduction scripts: `scripts/qa/pr195-review-db.cjs`, `pr195-review-server.cjs`, and `pr195-review-browser.cjs`. Local evidence and screenshots: `artifacts/pr195-review-route-repair/browser/evidence.json`. Logs are the local `artifacts-pr195-*.log` files. The application database role can only read the synthetic consent fixture and defaults to read-only transactions. It cannot write grades or student records.

The machine receipt `PR195_REVIEW_ROUTE_REPAIR.json` records source and evidence hashes. The exact-head GitHub CI result is reported separately after pushing this repair to PR #195's existing branch; the earlier green `6221975b` run does not certify this change.

The initial repair commit `3590bc894` passed TypeScript and 8,042 tests in [CI 39640276946](https://github.com/fasiryon/liberia-learn/actions/runs/39640276946), then failed one obsolete source assertion requiring anonymous harness access. That assertion is retired in favor of the behavioral access tests. The CI follow-up authenticates the existing capture and runtime-acceptance tools with real signed synthetic NextAuth sessions, restricted to explicit loopback development harnesses. Both automated and manual capture workflows seed a dedicated `lab_review_fixture` database; the app receives only a read-only consent role, and the admin URL exists only in the fixture setup step. Local fixture bootstrap and read-only verification pass; the existing capture tool passes authenticated LOW and FALLBACK_2D runs for `fixture-simple-circuit/current-starts` with 2 PASS and no errors. No renderer, shader, parity or determinism assertion is removed. The route/player/runtime package sources are unchanged by this CI follow-up.

## Remaining merge and release blockers

1. V0.2.1 adoption and a newly hashed delivery, followed by repeated integration QA. Separate factory adoption of the full 1.0.0 cohort baseline remains pending; the V2 amended contract pin alone does not resolve it.
2. Qualified authorized human subject review, source comparison/attestation, curriculum/objective mappings, correction-notice decisions and academic approval. No academic release is approved by this repair or its tests.
3. The V2 delivery's item/task attribution blockers remain: `ft01-a3/q3`, `ft04-a4/q5`, `ft01-a3-q5-tf` and `ft07-a5-order`. Multi-objective aggregate consumers must remain inactive until the owner-approved attribution contract and admission evidence are verified.
4. Manual accessibility review of axe incomplete results, screen-reader/low-vision and real-device QA, and CC-BY-3.0-IGO asset-policy review. Existing lab/governance release blockers remain attached to the immutable packages.
5. Exact-head CI must finish successfully. Keep PR #195 draft. No merge or deployment is authorized or performed.

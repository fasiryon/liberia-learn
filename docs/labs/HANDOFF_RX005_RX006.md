# Handoff: RX-005 / RX-006 acceptance closure (for the next agent)

Written 2026-10-06 by Claude Code when its usage ran out. Pick up from here on any machine. **No env files are needed**: every check runs in GitHub Actions with placeholder values.

## Where things are

- Branch `feat/rx005-rx006-acceptance-closure`, draft **PR #169**. The head when this note was written is `ae3a1ec0` (plus this note).
- RX-005 and RX-006 are **PROPOSED**. Do not mark them IMPLEMENTED, mark the PR ready, or merge it until the steps below pass.
- Mount Coffee stays **DRAFT, approval PENDING, unreleased, curriculum inactive, inaccessible to students**. This mission never releases it.
- The authoritative status lives in:
  - `docs/architecture/runtime-extensions/RX-005-immersive-high-renderer.md`, section "Acceptance record (2026-10-06)"
  - `RX-006-low-batching.md`, section "Acceptance record"
  - `docs/labs/mount-coffee-hydropower/ISSUE_LEDGER.md`, the R4 tables
  - `REVIEW_LOG.md` and `production.json`

## In flight when this was written

- Final full evidence sweep at `ae3a1ec0`: Mount Coffee run **37489886085** and circuit run **37489902558**, both from the `lab-review-capture.yml` workflow.
- PR CI `build` on `ae3a1ec0`.
- `lab-runtime-gate.yml` on `ae3a1ec0` already **passed**. Mount Coffee was 12/12 and the circuit 8/8; both runs were byte-identical, with no parity, three-request or shader failures.

## To finish

1. **Check the two sweep runs**:
   ```
   gh run view 37489886085
   gh run view 37489902558
   ```
   Every job should succeed: capture, determinism, runtime acceptance (remount, context loss, LOW buffer identity), the chunk abort on HIGH, and the walkthroughs. If one fails, download its artifact and fix the cause.
   - To re-dispatch, use the **full 40-character SHA** for `ref`. A short SHA fails checkout.
   - The reference command is in git history: search for `gh workflow run lab-review-capture.yml`.
2. **Check that PR CI `build` is green on the head.**
3. **Run one bounded `lab-performance-reviewer` re-check** of the changes since its last review at `c0e77a6d`:
   - the sprite shader fix and the capture shader-error gate;
   - WebGL2 gating and the load-failure upgrade block;
   - signature-cached flow tubes;
   - the A14 control-affordance token;
   - the A18 pose carry;
   - label anchoring and priority;
   - Fallback2D memoization;
   - `RENDERER_CHUNK_CEILINGS`;
   - the budget re-baselines recorded since (each in its own commit, with before and after values).

   Separately, get the design director's call on desktop shadow quality: the A7 amendment to 1024 px is accepted on cost grounds only.
4. **If everything is green and the reviewer accepts**:
   - set RX-005 and RX-006 to IMPLEMENTED in both RX docs, in `production.json` (`runtimeExtensions`) and in `docs/labs/IMMERSIVE_LABS_PROGRAMME.md`;
   - update the PR body;
   - mark the PR ready and confirm exact-head CI is green;
   - merge, then verify the final `origin/main` SHA.

   If the reviewer finds new P1s, fix them first. Never promote either extension partially.

## Known open items (not RX-005/006 acceptance blockers)

- P2: uncaught "Loading chunk failed" page errors during the chunk-abort walkthrough (dev server).
- Mount Coffee polish (sequence step B), tracked in the ledger:
  - HYDRO-R3D-001 to 005 and 009;
  - HYDRO-R4I-007: phone tap targets for the breakers and gauge bands are 6–16 px;
  - HYDRO-R4V-005: lit-city colour per profile, idle glyph size, unlabelled gauge strip;
  - HYDRO-R3D-007 and HYDRO-FOUNDER-IMMERSION-001: the art and immersion track.
- The per-lab dynamic definition registry is scheduled before programme Phase 4 (A19). A size test guards the 300 KB limit until then.
- After this mission comes step B (Mount Coffee P1 polish), then step C (Product Redesign V1).

## Working notes

- Lab tests: `npx vitest run __tests__/interactive-labs` (316 tests at `ae3a1ec0`). Scoped typecheck: `npx tsc --noEmit -p tsconfig.json`, or a scoped config if memory is tight.
- Any renderer or budget change needs a dedicated re-measure commit with before and after values:
  ```
  npx tsx scripts/labs/measure-renderer-chunks.ts
  npx tsx scripts/labs/update-lab-budget-baseline.ts
  ```
- Evidence from headless Chromium on SwiftShader proves accounting, routing, determinism and lifecycle only. Never claim device performance from it.
- Local branches, stashes and uncommitted worktree changes from the old desktop are archived on origin under `archive/local-2026-10-06/*`.

## Closure continuation — 2026-10-06

Both existing full sweeps are SUCCESS at ae3a1ec05967fb249b3490f4d3598f7989640611. Independent bounded performance reviewer ACCEPT and narrow A7 desktop shadow director ACCEPT recorded in REVIEW_LOG.md. RX-005/RX-006 acceptance records are IMPLEMENTED together. The historical instructions above are preserved; final documentation-head CI and merge verification are still mandatory. No Mount Coffee release. Physical-phone performance remains UNVERIFIED.

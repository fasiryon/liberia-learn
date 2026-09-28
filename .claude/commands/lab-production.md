---
description: Run the Interactive Lab Production Team for one high-fidelity LiberiaLearn lab (you are LAB-BUILDER)
argument-hint: <labId or lab brief> [stage: design|build|round-1|round-2|round-3|governance]
---
You are LAB-BUILDER, the main session of the LiberiaLearn Interactive Lab Production Team, for:
$ARGUMENTS

Read `docs/architecture/INTERACTIVE_LAB_PRODUCTION_TEAM.md` (the workflow, review protocol and
rollback rules) and `docs/architecture/HIGH_FIDELITY_INTERACTIVE_LABS.md` (the runtime contract)
before doing anything else. They are binding. Then:

1. **Isolate.** `git status`. Work on a feature branch in a dedicated worktree. Never reset, clean
   or stash a shared dirty worktree.
2. **Open the review log** at `docs/labs/<labId>/REVIEW_LOG.md` from the template in the
   production-team doc, or resume it. Resume from the first stage whose gate is not recorded.
3. **Design (no code yet).** Dispatch `lab-pedagogy-director` with the governed objective, grade,
   subject, prerequisites, approved lesson and evidence requirements (it also assigns the TIER). If it returns
   `BLOCKED_ON_AUTHORITY`, stop and report. Then `lab-experience-director` (storyboard and REFERENCE
   BENCHMARK), then `lab-simulation-architect` and `lab-asset-director`. Record each output in the log
   and start `docs/labs/<labId>/production.json` (`LabProductionRecord`, status `DRAFT`).
4. **Build.** Implement with the existing Interactive Lab Runtime V2 and `composeHighFidelity`
   only: definition, components/assemblies, cutaways, exploded views, flows, variables, the
   `SimulationModel`, camera presets, guided/explore/challenge/assessment, direct-manipulation
   checks, LOW and FALLBACK_2D, offline block. No bespoke parallel lab engine. A genuine runtime gap
   becomes a RUNTIME EXTENSION PROPOSAL (`docs/architecture/runtime-extensions/<id>.md`), is reviewed
   by `lab-performance-reviewer` and `lab-design-director`, and is implemented in the runtime with tests.
   Never quietly downgrade the experience; record deliberate trade-offs in `production.json`. Keep
   within the locked budgets (`npx tsx scripts/labs/update-lab-budget-baseline.ts` for a new lab). Turn the architect's fixtures into
   vitest cases. Register the lab's review scenarios in
   `lib/interactive-labs/v2/review/referenceScenarios.ts`. Run focused tests.
5. **Capture.** `LAB_REVIEW_HARNESS=1 npm run dev` in a separate terminal, then
   `npx tsx scripts/labs/capture-lab-review.ts --lab <labId> --label round-N --reduced-motion --probe --perf`.
6. **Review rounds.** Before each round, commit a checkpoint. Dispatch the round's reviewers in
   parallel with the capture folder path (and the harness URL for the interaction reviewer):
   The tier sets the loop (HERO = all three rounds + benchmark; STANDARD = round 1, then
   design director + science; DERIVATIVE = science + interaction + performance).
   - Round 1: `lab-visual-reviewer`, `lab-interaction-reviewer`, `lab-science-reviewer`
   - Round 2: `lab-visual-reviewer`, `lab-interaction-reviewer`, `lab-pedagogy-director`
   - Round 3: `lab-design-director`, `lab-performance-reviewer`, `lab-science-reviewer`
   Treat reviewer reports as claims: verify each P0 against the captures or code before acting.
   Fix every P0 and the worthwhile P1s, one isolated commit per fix. Re-capture, re-run focused
   tests, record findings, resolutions and disagreements in the log. Revert only an isolated fix
   that made the experience worse and cannot be corrected cleanly.
   Prove capture determinism once per lab: two consecutive runs, then
   `npx tsx scripts/labs/compare-lab-captures.ts <runA> <runB>`.
7. **Status.** A `SHIP` verdict that meets the benchmark ship rule makes the lab `SHIP_CANDIDATE`
   (validated by `__tests__/interactive-labs/lab-production-records.test.ts`). `SHIP_VERIFIED` needs a
   real pilot. Never claim it from agent review.
8. **Governance.** A `SHIP_CANDIDATE` lab may enter governed review. It does not
   approve, release or bind the lab. Leave `reviewState`/`approvalState` and authority mappings to
   the governed process and humans. Run `npm run validate:changed`, the related tests, and
   `npx tsc --noEmit`; open a PR whose description links the review log.

Report the stage reached, open findings by severity, and the next gate.

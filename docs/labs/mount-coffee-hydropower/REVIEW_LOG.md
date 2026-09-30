# mount-coffee-hydropower review log

Objective: proposed `hydropower-cause-and-effect` — explain how river flow, available turbine units and electricity demand affect hydropower generation and delivery · Grade 8 · SCIENCE · Release: fixture-unreleased (not approved)

## Design
- Pedagogy brief: [01-PEDAGOGY_BRIEF.md](design/01-PEDAGOGY_BRIEF.md) (2026-09-28)
- Storyboard and benchmark: [02-EXPERIENCE_STORYBOARD_AND_BENCHMARK.md](design/02-EXPERIENCE_STORYBOARD_AND_BENCHMARK.md) (2026-09-28)
- Simulation spec: [03-SIMULATION_SPEC.md](design/03-SIMULATION_SPEC.md) (2026-09-28)
- Asset spec: [04-ASSET_SPEC.md](design/04-ASSET_SPEC.md) (2026-09-28)
- Runtime extensions RX-001 through RX-004: implemented at checkpoint `a3426aba`; captures and round review remain pending.

## Round 1 — partial; overall OPEN
- Clean checkpoint: `e89075d3`. Overview still matrix: `artifacts/lab-review/mount-coffee-hydropower/1.0.0/round-1-e89075d3-stills/`; perf metadata: `.../round-1-e89075d3-perf/`; automated interaction probe: `.../round-1-e89075d3-interaction-probe/`. All four profiles × desktop/mobile. SwiftShader software rendering supports composition and label review only; every perf row has `signOffValid: false`.
- Science follow-up: overview P0 resolved. All four unit water paths visibly return through the common tailrace to the Saint Paul River in WebGL and FALLBACK_2D. No new overview science finding. Dry-season, overload/trip, cutaway, repair, assessment and motion states remain unreviewed.
- Visual follow-up: the former right-edge white slab now reads as separate city structures and remains within scene bounds. The mobile explanation panel shows “Scroll this panel for more details”; the still supports discoverability, while live scroll behavior remains untested. Distance, tower and Homes labels are separated; fallback halos remain clear.
- Interaction follow-up: automated overview probe reports zero visible targets below 44 px for HIGH/FALLBACK_2D on desktop/mobile. FALLBACK_2D trace targets are 65×65 desktop and 53×53 mobile. Three heuristic “unnamed” controls are River flow, Units online and Explode sliders; each has an associated DOM label. No live input, keyboard, guided-task, challenge, assessment or scroll test was run.
- Overall Round 1 remains OPEN because the full 23-scenario matrix predates later fixes, and the selected correction recaptures do not cover every scenario or live input.

### Round 1 focused correction rechecks

- Full baseline recapture at `853dbc96`: eight still-only profile/viewport directories, 23 scenarios each (184 stills). It exposed the seeded challenge starting already met, assessment previews out of order, an incorrectly framed exploded stack, mobile cutaway label clipping, fallback 2D label collisions, and an S7 capture that showed the machine task instead of the energy chain.
- Correction set at `8a5f2573`: `artifacts/lab-review/mount-coffee-hydropower/1.0.0/round-1-8a5f2573-corrections/`, 40 stills across five selected scenarios, four profiles and two viewports. Visual review confirms the exploded stack is readable and the S7 task matches its title. Science review confirms the challenge-start state is unmet and its status is consistent with the synthetic model.
- Final wording and repair-state set at `cdf990e5`: `.../round-1-cdf990e5-final-corrections/`, 16 stills for S7 and assessment repair across all profiles/viewports. S7 explicitly names gravitational potential energy and kinetic energy; the explanation panel presents the same chain. Assessment repair is the next task and no longer carries success feedback from the prior check.
- Assembly-copy set at `3fd19aee`: `.../round-1-3fd19aee-repair-copy/`, eight repair stills across all profiles/viewports. The control says “Pick up a part” / “All parts placed,” which works for the runner, shaft and generator.
- Remaining visual findings: some peripheral labels clip around the LOW mobile powerhouse cutaway; the Fallback 2D assessment capture still clips a transmission-tower label at the scene edge. The central exploded stack is readable. These P2 findings remain open.
- Interaction review used replay assertions and seeded stills. It did not exercise live touch, keyboard input, active assessment completion or scrolling. Reduced-motion stills also cannot prove turbine animation. The latest correction sets are composition/label evidence only from SwiftShader software rendering.
- No P0 was identified in these focused rechecks. Round 1 remains OPEN: the latest source has not been recaptured across all 23 scenarios and all profiles/viewports, the two P2 label findings remain, and live interaction evidence is missing.

## Round 2 — not run
No reviewer verdict is recorded.

## Round 3 — not run
No benchmark scores or design director verdict are recorded.

Disagreements:
- Simulation architect proposed `u1-generator`; the asset director and builder selected `u3-generator` for the single detailed internal stack. Recorded in `production.json`.
- Asset director requested a persistent spin glyph; the e89075d3 stills show it across all profiles. The visual reviewer confirms desktop legibility but cannot establish individual glyph legibility on mobile; revisit in later review.
- Shared inactive flow is `#779ab2` after the palette gate showed that `#94a3b8` could not meet both color-separation constraints with the shared highlight.

## Runtime performance review follow-up

- `lab-performance-reviewer` returned APPROVE_WITH_CHANGES (0 P0, 2 P1, 1 P2). It identified a highlight gate that checked only the maximum rim, a decor gate that inspected only initial simulation state, and per-frame marker typed-array allocation.
- The shared runtime now adapts the highlight's base mix per material to retain a minimum Delta E 00 of 15, and gates both its minimum effective mix and maximum rim. It sweeps replayed review scenarios for state-driven decor and uses reusable CPU/GPU marker storage.
- Validation: the runtime extensions, review scenarios, hydro definition and hydro model suites passed (4 files, 53 tests); `validate:changed -- --no-types` passed (61 tests); ESLint on all changed TS/TSX files passed. A subsequent `validate:changed` attempt passed tests but stalled during type-checking and was cancelled; full type-check is not certified by this run.
- No GPU/device performance run was performed. Performance, memory, battery, and real-device frame rate remain NOT MEASURED. This code follow-up does not close the open round 1 label findings or the round 2/3 review gates.

Reverted fixes: none.

## Round 3 verdict
Design director: not run.
Open P0: not assessed.

## Governance handoff
Curriculum alignment remains PROPOSED, not governed. All five checks remain RAW_OBSERVATION. The lab is DRAFT, fixture-bound, unapproved and unreleased. `SHIP_CANDIDATE` requires completed three-round HERO review and benchmark scoring. `SHIP_VERIFIED` requires a separately authorized real-school pilot; this team cannot approve, release or bind the lab.

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

### Round 1 focused visual corrections after review checkpoint 56758033

- `78afa069` changes FALLBACK_2D to omit removed cutaway solids and draws active instructional paths above SVG component geometry. The focused 16-image capture at `artifacts/lab-review/mount-coffee-hydropower/1.0.0/round-1-78afa069-corrections-retry/` has zero page/console errors. The flood route is visible in FALLBACK_2D.
- `ba3c05c2` adds a valley camera action to the all-passed assessment scenario after the unit 3 inspection. The eight-image assessment capture at `artifacts/lab-review/mount-coffee-hydropower/1.0.0/round-1-ba3c05c2-assessment-correction/` shows the powerhouse and city within FALLBACK_2D frame with no pale cutaway slab. The former transmission-tower edge issue is improved; visual reviewer still reports partial right-edge clipping (P2).
- `9161bca3` draws WebGL process lines above solids; `25d722f2` routes the spillway along the dam face with the active-water palette; `a6caa9ad` also places fixed particle cues above solids in reduced-motion captures. The newest eight-image flood set is `artifacts/lab-review/mount-coffee-hydropower/1.0.0/round-1-a6caa9ad-spillway-cues/`. Until a reviewer confirms the paused WebGL spill stream is unmistakable, the flood consequence finding remains OPEN.
- A new full 184-image recapture attempt at `round-1-ba3c05c2-full-stills-probe-perf` did not complete; only two images were written before the local Node processes disappeared. Do not use that incomplete set as evidence. A repeatable cold dev-route compilation bottleneck remains. The focused correction manifests are SwiftShader software rendering and support composition/labels only.
- Round 1 remains OPEN. Live keyboard/touch/task completion, a complete latest-source matrix, and the final WebGL flood visibility review remain outstanding.

### Latest focused verification

- Science reviewer rechecked `round-1-a6caa9ad-spillway-cues/` (eight stills, four profiles × desktop/mobile, reduced motion, SwiftShader). The cyan spillway trail is visible in HIGH/STANDARD/LOW and clearer in FALLBACK_2D; the prior flood visibility P1 is closed. The stills show placement/state, not animated water movement.
- `e604f1a2` widened valley framing; `e09cb4ee` refined the target while preserving scene scale. The eight-image `round-1-e09cb4ee-final-camera-fit/` shows pylons in frame and no cutaway slab. A fresh visual review says several fallback desktop labels (Intake, Unit 1/2 housing, Generator, Switchyard) remain crowded (P2).
- Latest production finding statuses are in `production.json`. Round 1 remains OPEN because the full latest-source 184-still matrix did not complete and live interaction checks remain unperformed.

## v1.1 immersive pass — opened 2026-10-01

Trigger: founder hands-on review of v1.0 on the local review harness (HIGH, desktop), recorded as `HYDRO-FOUNDER-IMMERSION-001` (P1, DESIGN, OPEN) in round 1 of `production.json`.

> "Impressed but a little disappointed. The water animation has to be better, and the interface and interactiveness. It's more like a 2D than a 3D immersive lab."

Builder diagnosis (verified in code, not inferred from captures):
- Water is `gl.LINES` (1 px) plus `gl.POINTS` square particles (`WebGLScene.tsx` flow batch). There is no water surface, volume, foam or current, so water reads as a diagram.
- The whole HIGH renderer is a ~270-line hand-written WebGL pass: one directional light, Lambert plus weak specular, flat colours, no shadows, sky, fog or textures, and only procedural box/cylinder/cone primitives.
- Camera constraints are yaw ±1 rad and pitch -0.4..0.8, and most views come from presets, so the plant behaves like a diorama.
- Causes are driven from `LabControlPanel` sliders. The scene supports picking and tracing, but not operating the gate, units or feeders.
- v1.0 recorded this as a deliberate trade-off ("procedural primitives rather than photoreal terrain or fluid simulation") for TARGET_LOW_DEVICE. That bar was too low for a HERO lab on capable devices.

Founder decision (2026-10-01): adopt **three.js as the HIGH-profile renderer** through a runtime extension (RX-005). STANDARD follows HIGH only where the budgets allow. LOW and FALLBACK_2D stay on the existing renderers. The simulation model, checks, evidence boundary, authority status (PROPOSED, DRAFT, RAW_OBSERVATION) and "no unconstrained free camera" (principle 10) are unchanged.

Gate progress (2026-10-01):
- Design deltas recorded: [05 pedagogy](design/05-V1_1_PEDAGOGY_DELTA.md), [06 simulation](design/06-V1_1_SIMULATION_DELTA.md), [07 experience](design/07-V1_1_EXPERIENCE_DELTA.md), [08 asset](design/08-V1_1_ASSET_DELTA.md).
- Founder decision: fix the blind-toggle P0 with smaller feeder blocks (specified in 06).
- RX-005 review: `lab-design-director` APPROVE_WITH_CHANGES (P0 1, P1 13, P2 4); `lab-performance-reviewer` APPROVE_WITH_CHANGES (P0 3, P1 9, P2 6). Every P0 was verified by the builder; performance P0-3 was already fixed on `main` by PR #163. The binding amendments A1–A19 are in RX-005. RX-006 is split into its own proposal.
- Founder decisions are recorded: the approved experience references and principle 10 camera wording. The A1 geometry P0 re-check is complete; see the Phase 0 proposal gate record below.

Original gate list:
1. Design deltas: pedagogy (in-scene manipulation), experience storyboard and immersive REFERENCE BENCHMARK, simulation (water quantities the renderer may show), asset direction (glTF vs procedural, textures, three.js budgets).
2. RX-005 proposal reviewed by `lab-performance-reviewer` and `lab-design-director`.
3. Build in the shared runtime with tests, then three review rounds on new captures, including a `--gpu` or real-device run before any fidelity or performance sign-off.

## Round 2 — not run
No reviewer verdict is recorded.

## RX-005 / RX-006 proposal gates — 2026-10-01

These are runtime-extension proposal reviews, separate from Mount Coffee's product rounds. They do not close Round 1, certify implementation, grant a product verdict, or alter governance.

| Proposal / reviewer | Verdict | Recorded disposition |
|---|---|---|
| RX-005 A1 · lab-design-director | APPROVE_WITH_CHANGES; amended proposal APPROVED | Added typed descriptor schemas, coordinate and degeneracy rules, deterministic count/budget requirements, bounded quality presets, four-profile variants and semantic cues, RenderList/SVG mapping, and WebGL1 16-bit split policy. |
| RX-005 A20 · lab-design-director | REJECT | glTF remains deferred in RX-005 V1; a future loader must be separately scoped/reviewed with bounded formats, costs, fallbacks, provenance and fixtures. |
| RX-005 A20 · lab-performance-reviewer | APPROVE_WITH_CHANGES | Identified missing byte/triangle/texture/decoder accounting, local loading/failure lifecycle, and LOW/2D no-request proof; all stay mandatory for any future proposal. |
| RX-006 · lab-design-director | APPROVE_WITH_CHANGES; amended proposal APPROVED | Added state synchronization/invalidation, cross-profile actionable identity/cue parity, deterministic picking, and ANGLE-path parity tests. |
| RX-006 · lab-performance-reviewer | APPROVE_WITH_CHANGES; amended proposal APPROVED | Added deterministic batch/planner rules, memory and WebGL1 bounds, exact budget parity, lifecycle/allocation and representative state captures. |

RX-005 and RX-006 implementation remains incomplete. No device performance, GPU performance, or battery claim is made.

### Phase 0 runtime increment 0.1 — 2026-10-01

- Profile selection begins at LOW when WebGL is available and FALLBACK_2D otherwise; a manual/remembered choice is honored. Save-Data, slow connection types, and known memory below 4 GB veto upgrades. With available headroom, 30 consecutive LOW samples averaging at most 12 ms permit HIGH, or STANDARD under reduced motion. The resolved profile is remembered under the RX-005 runtime key.
- The performance sampler counts only frames that continue a scheduled render loop. An idle gap or intentional skipped frame resets the window; genuinely slow continuously scheduled frames remain eligible for downgrade.
- The WebGL pass handles context loss by preventing default and moving to FALLBACK_2D; it releases buffers/programs and requests context loss on teardown. Renderer chunk loading retries once, then an error boundary serves FALLBACK_2D with a status notice.
- Validation: `npm run validate:changed` passed (7 selected test files / 75 tests, API route policy audit, and TypeScript check). A final focused profile/high-fidelity/budget/production-record run passed (4 files / 43 tests).
- NOT MEASURED: GPU performance, physical-device performance, memory, and battery. The Three.js renderer, RX-005h geometry/kits implementation, RX-006 batching implementation, and Mount Coffee production rounds remain outstanding.

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

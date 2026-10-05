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

## Round 2 — 2026-10-02

- **Captures:** GitHub Actions `lab-review-capture.yml`, SwiftShader software GL (composition and labels only, never performance). Renderer identity was verified per scenario:
  - STANDARD, LOW and FALLBACK_2D: 54/54 PASS at 3fe1837a and 6050f0f1.
  - HIGH: 43/51 at 6050f0f1; the missing stills were recaptured after the held-clock and screenshot-timeout fixes.
- **Reviewers:** `lab-visual-reviewer` (3 P0, 13 P1, several P2) and `lab-pedagogy-director` (1 P0, 8 P1, P2s). The keyboard walkthrough and probe ran on CI at 81dc28c7: HIGH, STANDARD and LOW passed. FALLBACK_2D failed 9 steps from a harness naming collision, not a lab defect (see ledger).
- **Builder verification of the P0s:**
  - The inside-unit and vanishing-unit P0 was reproduced from code. Its root cause was transparent-sort plus depth-write on the shell.
  - The feedback-readability P0 and the mobile P0 were confirmed on the stills.
- **Fixes:** 7a409dfe (renderer), 0a409a6f (modeStart, HUD, control values), 4ccd8966 (hydro pedagogy and visual), 2717eb52 (fixtures), ad4f47cb (walkthrough scope), ecf8952c (skip link). Every P0 and every P1 is fixed or partly fixed with a test. Each finding, status and evidence is in `ISSUE_LEDGER.md`.
- **Deferred P2s, with rationale:**
  - Rainy and flood widths follow the approved √ mapping.
  - Route lines remain the trace affordance.
  - Decor salience goes to the Round 3 design director.
- **Founder decision (2026-10-02): overload trips are LATCHED** (closes P1-1). See "Latched trip" below.
- **Re-capture for verification:** run 37059436767 at ad4f47cb: 28 scenarios × 4 profiles × desktop/mobile, 224/224 stills PASS renderer identity, 8/8 keyboard walkthroughs with 0 failed steps.

### Round 2 final verification — 2026-10-02
- `lab-visual-reviewer` checked every Round 2 fix on run 37059436767. Result: 9 VERIFIED, 9 PARTLY, 0 REGRESSED.
- It raised 3 P0s, 10 P1s and 7 P2s (HYDRO-R3V-*):
  - P0: the S2 fixture showed a tripped plant; FALLBACK_2D had no lit/dark city; phone-portrait 2D was unreadable.
  - P1s: labels, markers, framing.
- All P0s and P1s were fixed at 22c5a2ed and bcb40c42. They were verified on the r3-final capture: the S2 fixture is untripped and unit 1 generates; 2D lit homes are warm; the 2D phone city is framed; cutaway parts are labelled. HYDRO-R3V-012 gauge row labels are deferred to P2. Each finding is in ISSUE_LEDGER.md.

### Latched trip — founder decision 2026-10-02
Load and unit changes apply immediately. An overload trips the plant: generation delivered goes to 0, the city goes dark, and the trip latches. While tripped the learner may still change loads and units and inspect. Power never returns automatically. **Reset plant** (HUD and panel) is accepted only when demand ≤ available generation and a unit is generating; otherwise it stays focusable, and the reason is shown and used as its description ("Reset unavailable: demand is still 2 MW above available generation."). Learner choices are preserved. There is no commit-load workflow.

How it is built:
- Engine: generic `spec.protection` and a `reset-protection` action (a91d3a80). Mode and guided-step starts clear the latch.
- Model 1.2.0: `tripped = overload ∨ latched`.
- Tests: `hydropower-protection.test.ts`.
- Keyboard walkthrough: trip → refused reset → correct → reset → challenge met, on every profile.
- Scenarios: corrected-not-reset, reset-restored, tripped unit change, challenge trip/correct/reset.
- Captures: run 37061766748 at b1df62a6 (15 scenarios × 4 profiles, motion, probe, walkthroughs, all PASS) and run 37065728208 at 1ab0a316.

### Interaction review — 2026-10-02
`lab-interaction-reviewer` (runs 37061766748 / 37065728208; walkthrough JSON, probe, stills, engine replays) returned PASS_WITH_FIXES: 0 P0, 6 P1, 8 P2.
- All 8 walkthroughs pass. The panel is 33–38 Tabs from the top, the skip link is the 2nd stop, and no focus trap was found.
- All 6 P1s were fixed at 22c5a2ed:
  - guided-step start states;
  - a tripped-check hint;
  - a focused "power restored" status;
  - the Hospital chip state;
  - an opaque lab focus ring;
  - "Restart lab (clears progress)" with an inline confirm.
- P2s are fixed or deferred as listed in the ledger.
- Not verified: real touch, screen readers, physical devices.

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

## Round 3 — 2026-10-02/03

**Final capture.** r3-final, run 37073814606 at 8898c3ab, plus the HIGH-mobile top-up run 37080819114: 32 scenarios × HIGH/STANDARD/LOW/FALLBACK_2D × desktop/mobile.
- 256/256 stills PASS renderer identity, with 0 console errors.
- 8/8 keyboard walkthroughs, 0 failed steps.
- LOW at most 34 draws.

The HIGH job's first pass hit its 80-minute timeout three stills short; the top-up run captured them. City-label follow-up: run 37086350967 at 0a40f111.

**Interpreting the evidence.** It is all SwiftShader software GL, so it shows composition, labels, layout and automation only.

| Reviewer | Verdict | Counts | Outcome |
|---|---|---|---|
| `lab-science-reviewer` (model 1.2.0) | PASS_WITH_FIXES; no STOP | P0 2, P1 2, P2 7 (42 claims: 28 accurate, 9 simplification, 4 misleading, 1 incorrect) | The latched trip is accepted as an honest, caveated simplification. Both P0s (max-served overclaim, bottle-cap speed misconception) and both P1s (latch caveat, gauge length) were fixed at bcb40c42, with tests |
| `lab-performance-reviewer` | PASS_WITH_FIXES | P0 0, P1 5, P2 4 | Within every static and offline budget (HIGH 79/120, STANDARD 59/90, LOW 34/40 draws; package 59 KB/96 KB). Fixed: downgrade ceiling, overlay throttle, idle monitor, dedicated baseline commit 8898c3ab. OPEN: planner/`renderer.info` parity (R3P-003). **RX-005 and RX-006 stay PROPOSED**: their acceptance lists are incomplete |
| `lab-design-director` | **DO_NOT_SHIP** | P0 0, P1 9, P2 4 | Scene consequence at the city too weak; phone city and exploded framing; runner salience; guided prompts contradicting fixture states; desktop right column clips Next; phone objective below the fold; grey-box dominance (founder immersion finding still open); idle units indistinguishable; benchmark references missing. Coverage was partial (16 HIGH stills; STANDARD, LOW and 2D not inspected before its turn limit) |

**Benchmark.**
- Local relevance BEATS.
- Five qualities MATCH.
- Cutaway/exploded clarity and Camera choreography are BELOW with no trade-off.
- Reach on LOW/FALLBACK_2D is UNSCORED.
- The six reference captures are not on disk, so every score is UNVERIFIED-REFERENCE.

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

## Round 3 verdict — DO_NOT_SHIP (2026-10-03)

This is a product-quality readiness verdict only. It is not curriculum approval, founder approval or MOE approval, and it does not release anything.

| Item | Status |
|---|---|
| Open P0 | **0**. Every P0 from Rounds 1–3 is fixed and verified on new captures or by tests |
| Open P1 | **12**: HYDRO-R3D-001 to -009 (R3D-002 partly fixed), HYDRO-R3P-003, HYDRO-R3P-005 (partly fixed), HYDRO-FOUNDER-IMMERSION-001 |
| Deferred P2 | Listed in ISSUE_LEDGER.md: R3V-015 to -020, R3I-007/008/009/012/013/014, R3S-005, R3P-006 to -008, R3D-010 to -013, R2 rain/flood and route lines |
| Profiles | HIGH, STANDARD, LOW and FALLBACK_2D all render, route and complete by keyboard (256/256 stills, 8/8 walkthroughs). The director did not inspect STANDARD, LOW or 2D, and LOW/2D reach is unscored |
| Accessibility | Keyboard complete on every profile; opaque lab focus ring; focusable aria-disabled Reset plant with its reason; skip link. Screen readers, real touch and forced-colors are NOT tested |
| Performance | Within all static and offline budgets on software GL. Planner/`renderer.info` parity is OPEN. RX-005/RX-006 are PROPOSED |
| Science | PASS_WITH_FIXES; both P0s and both P1s fixed; the latched trip is accepted as a caveated simplification |
| Physical devices | **UNVERIFIED.** No real device or `--gpu` run; no frame-rate, memory, battery or thermal claim |
| Design director | DO_NOT_SHIP |
| Runtime governance | `validateProductionRecord` refuses SHIP_CANDIDATE while RX-005/RX-006 are PROPOSED. This is an independent blocker |

**To reach SHIP_CANDIDATE:**
1. Close the design-director P1s.
2. Restore the benchmark references and re-score every quality (no BELOW, LOW/2D scored).
3. Run a full director pass over all profiles.
4. Complete the RX-005 and RX-006 acceptance items, starting with planner parity, the remount leak test, the determinism proof, chunk accounting and the abort harness.

Mount Coffee remains DRAFT, approval PENDING, unreleased, curriculum linkage inactive and student-inaccessible.

## Governance handoff
Curriculum alignment remains PROPOSED, not governed. All five checks remain RAW_OBSERVATION. The lab is DRAFT, fixture-bound, unapproved and unreleased. `SHIP_CANDIDATE` requires completed three-round HERO review and benchmark scoring. `SHIP_VERIFIED` requires a separately authorized real-school pilot; this team cannot approve, release or bind the lab.

## RX-005 / RX-006 implementation continuation — 2026-10-05

Work resumed on `feat/rx005-rx006-acceptance-closure` from `18eed1b0`. Added output-driven status lamps, confirmed drag assembly controls, the mobile controls sheet and objective peek, WebGL matrix scratch reuse, WebGL1-safe LOW batch caps, per-vertex LOW color/emission, and cached LOW batch membership. LOW batches now retain source-item ranges; color and emission changes update only those ranges with `bufferSubData`, and live render-list records are refreshed in the reused plan so labels and picks do not go stale.

The final focused batch planner/state-range run passed 20/20 tests. The latest full interactive-labs suite passed 229/229 tests across 25 files on commit `99636991`, including the updated chunk and package-budget gates. The local 20× Chromium lifecycle run did not complete: the dev server attempted to fetch Inter from Google Fonts and outbound network access was denied. TypeScript and ESLint commands also stalled without results. No fresh CI capture or reviewer re-check has run, so RX-005 and RX-006 remain PROPOSED.

RX-005 A8 renderer chunk remeasurement, in its own change: prior `webglPass` 54,952 stored / 18,462 Brotli bytes; current 60,549 / 19,688 (+10.19% / +6.64%). `threeRenderer` moved from 601,056 / 130,179 to 602,273 / 130,558 (+0.20% / +0.29%). The `webglPass` increase includes the RX-006 required per-component color/emission ranges and persistent membership metadata, plus the resumed RX slices since the previous recorded measurement. This is a measured re-baseline proposal, not reviewer acceptance; the >5% change needs fresh CI and performance-reviewer re-check. The CI tolerance remains 5% from the newly recorded values.

Shared offline-package budget remeasurement, in its own change: the renderer chunk is part of every WebGL lab's measured package, so the registered lab baselines changed as follows (stored bytes; HIGH/STANDARD and LOW respectively):

| Lab | HIGH/STANDARD stored bytes before → after | HIGH/STANDARD transfer bytes before → after | LOW stored bytes before → after | LOW transfer bytes before → after | LOW draws before → after |
|---|---:|---:|---:|---:|---:|
| fixture-simple-circuit | 666,648 → 673,462 | 159,281 → 160,886 | 65,592 → 71,189 | 29,102 → 30,328 | 8 → 5 |
| g4-solid-figures | 670,890 → 677,704 | 163,523 → 165,128 | 69,834 → 75,431 | 33,344 → 34,570 | 8 → 5 |
| mount-coffee-hydropower | 714,993 → 721,807 | 207,626 → 209,231 | 113,937 → 119,534 | 77,447 → 78,673 | 34 → 26 |

The LOW package increases are the shared WebGL chunk cost; LOW draw counts fall because compatible opaque parts now share batches with per-vertex state. HIGH/STANDARD draw counts remain unchanged after the planner split. The final LOW-state upload helper added 90 stored / 52 transfer bytes to each affected profile's just-recorded package baseline; this latest before/after is recorded in the same dedicated baseline change. The absolute static ceilings and 5% regression tolerance are unchanged. G4 LOW's cumulative baseline increase exceeds 5% from its prior recorded value and remains subject to performance-reviewer re-check.

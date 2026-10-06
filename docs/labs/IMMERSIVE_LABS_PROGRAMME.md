# Immersive labs programme

Status: PLAN, opened 2026-10-01 by founder direction. Owner: LAB-BUILDER under the [Interactive Lab Production Team](../architecture/INTERACTIVE_LAB_PRODUCTION_TEAM.md). This plan changes no curriculum authority, evidence rule or student route by itself. Every lab below still goes through its own production loop and governed review.

## Why

The founder reviewed `mount-coffee-hydropower` 1.0.0 and found that it "reads as 2D, not an immersive 3D lab" (`HYDRO-FOUNDER-IMMERSION-001`). The founder then widened the goal: **every 2D lab on the platform should be improved, not only hydro.**

Today the platform has two lab systems:

| System | Labs | Renderer | Evidence |
|---|---|---|---|
| Interactive Lab Runtime V2 (`lib/interactive-labs/v2`) | 4: `g4-solid-figures` (IN_REVIEW), `fixture-lever`, `series-circuit-ohms-law`, `mount-coffee-hydropower` (DRAFT) | hand-written WebGL + SVG fallback | governed path, only `check` actions, no mastery writes |
| Legacy labs (`lib/labs`, `components/labs`) | 17, all **Canvas 2D or SVG** | per-lab hand-written canvas code | session scores stored as PROVISIONAL / RAW_OBSERVATION, `masteryUpdated: false` |

The 17 legacy labs:
- **12 are catalogued** at `/student/labs`, grouped by subject (Physics, Biology, Chemistry, Earth Science).
- **5 are embedded in lessons** through `LessonLabPanel`.

## Building blocks (shared runtime, every lab inherits)

| Id | Capability | Status |
|---|---|---|
| RX-001 to RX-004 | State-driven motion, batched flows, isolated decor, rim highlight | IMPLEMENTED (PR #161) |
| **RX-005** | three.js HIGH/STANDARD renderer, quantity-bound water/surfaces and emitters, in-scene controls, camera rails and widened constraints, scene-first player shell, output-driven poses and status lamps, budget accounting | PROPOSED: most items implemented and CI-proven; exact unmet items in the RX-005 acceptance record (2026-10-06) |
| **RX-006** | LOW instanced batching with CPU picking (LOW is already at 38 of 40 draw calls) | PROPOSED: batching, picking and buffer identity proven; tests 3 and 8 open (RX-006 acceptance record) |
| **RX-007** | **Time axis ("4D")**: a learner-controlled timeline to scrub, pause, rewind and change speed, plus "find the moment when…" checks | PLANNED, after RX-005 |
| RX-008 | Haptics and sound: vibration on faults and trips, captioned ambient audio, with an off switch | PLANNED, after RX-007 |

### RX-007: time axis (summary for planning; full proposal later)

**Idea.** Many objectives are about *change over time*:
- plates drifting over millions of years;
- the phases of one heartbeat;
- mitosis stages;
- a pendulum period;
- a wave passing;
- a river through a year of seasons;
- a reaction proceeding.

Today those are either canned animation (forbidden by the standard when the state can be modelled) or a single variable slider.

**Shape**, fitting the existing contract:
- **`TimelineDefinition`.** A lab declares a time variable: its unit, range, a display scale ("1 s = 10 million years") and named keyframes or phases.
- **The model stays pure.** `SimulationModel` takes time as an input, so every moment is reproducible. Scrubbing replays state; it never invents it.
- **Player shell scrubber.** Play, pause, step, rewind, speed (0.1× to 10×) and phase markers. Keyboard: arrows, Home, End, Space.
- **Reduced motion.** It steps between keyframes instead of playing.
- **New check.** A `reach-moment` direct-manipulation check, e.g. "stop the heart when the ventricles are contracting", "find when the plates first collide". It is evaluated from the model, like `reach-target`.
- **Evidence.** Scrubbing is RAW_OBSERVATION, and only `check` produces evidence.
- **Profiles.** Works on all four, including FALLBACK_2D, because the scrubber is a shared control and the state is the model's.

**Proof lab.** `human-heart` (cardiac cycle), with `tectonic-plates` and `cell-division` next. In Mount Coffee, an optional "a year on the Saint Paul River" scrub may follow, but it is not required for v1.1.

## Phases

### Phase 0: RX-005 + RX-006 in the shared runtime
- Implement and test them as specified, after their reviews.
- Prove determinism: two byte-identical capture runs.
- Gate: performance and design reviewers' verdicts are recorded, all suites are green, and budgets are re-baselined with review.

### Phase 1: Mount Coffee 1.1.0 (HERO, the proof)
- Feeder-block model (founder P0 decision), in-scene controls, immersive water, scene-first shell.
- Full three review rounds plus the immersion benchmark.
- A `--gpu` or real-device run before any fidelity or performance claim.
- Exit: `SHIP_CANDIDATE` (agent loop) and **founder hands-on re-review**. The founder's verdict is the real gate for the immersion bar.

### Phase 2: existing V2 labs re-reviewed on the new renderer
- `g4-solid-figures`, `fixture-lever` and `series-circuit-ohms-law` get RX-005 automatically.
- Each gets a DERIVATIVE review (science, interaction, performance) on new captures before its status claims change.

### Phase 3: RX-007 time axis, proved on `human-heart`

### Phase 4: legacy migration, subject heroes first
- Each subject gets one HERO that sets its visual and interaction patterns (heart for biology, molecules for chemistry, tectonics for earth science; hydro and the circuit fixture already cover physics).
- Then STANDARD and DERIVATIVE labs reuse those patterns.

## Legacy lab migration table

Tiers are the builder's **proposals**. The pedagogy director assigns the tier at each lab's start, and may decide (per "WHY INTERACTIVE") that 3D adds nothing. In that case the lab moves to V2 with the new shell but stays 2D-first. Grade bands come from `lib/labs/registry.ts`.

| # | Lab | Subject | Grades | Where | Proposed tier | Builds on | Time axis (RX-007) | Phase |
|---|---|---|---|---|---|---|---|---|
| 1 | human-heart | Biology | 8–10 | catalogue | **HERO** | RX-005 surfaces (blood flow), cutaway | yes, cardiac cycle (proof lab) | 3–4 |
| 2 | molecule-motion | Chemistry | 9–11 | catalogue | **HERO** | emitters, instancing | yes, temperature over time | 4 |
| 3 | tectonic-plates | Earth sci. | 8–10 | catalogue | **HERO** | terrain heightfield, cutaway | yes, millions of years | 4 |
| 4 | electric-circuit | Physics | 9–11 | catalogue | DERIVATIVE | `series-circuit-ohms-law` fixture | no | 4 |
| 5 | cell-division | Biology | 9–11 | catalogue | STANDARD | heart patterns, cutaway | yes, mitosis stages | 4 |
| 6 | chemical-reaction | Chemistry | 10–12 | catalogue | STANDARD | molecule-motion | yes, reaction progress | 4 |
| 7 | wave-motion | Physics | 10–12 | catalogue | STANDARD | surfaces | yes, wave passing | 4 |
| 8 | pendulum-lab | Physics | 7–9 | catalogue | STANDARD | RX-001 motion | yes, period | 4 |
| 9 | gravity-explorer | Physics | 7–9 | catalogue | STANDARD | rails, motion | yes, orbit | 4 |
| 10 | weather-system | Earth sci. | 7–9 | catalogue | STANDARD | hydro sky/water rig | yes, day/season | 4 |
| 11 | ecosystem-balance | Biology | 7–9 | catalogue | STANDARD | instanced scatter | yes, populations over time | 4 |
| 12 | periodic-table | Chemistry | 9–12 | catalogue | STANDARD, **likely 2D-first** | shell only | no | 4 |
| 13 | water-cycle | Earth sci. | lesson | embedded | DERIVATIVE | hydro water rig + weather | yes | 4 |
| 14 | simple-machines | Physics | lesson | embedded | DERIVATIVE | `fixture-lever` | no | 4 |
| 15 | earthquake-waves | Earth sci. | lesson | embedded | DERIVATIVE | tectonics + waves | yes | 4 |
| 16 | cell-structure | Biology | lesson | embedded | DERIVATIVE | cell-division | no | 4 |
| 17 | light-and-shadow | Physics | lesson | embedded | STANDARD | new optics pattern (rays) | no | 4 |

Totals: 3 HERO, 9 STANDARD, 5 DERIVATIVE (17). Review cost scales with tier: HERO runs three rounds plus the benchmark, STANDARD runs two, and DERIVATIVE runs one.

## Legacy disposition: KEEP / UPGRADE / REBUILD / RETIRE

Audit of `components/labs/` (2026-10-02, branch `feat/mount-coffee-review-closure`). Every one of the 17 legacy labs is a single 2D `<canvas>` page (one is a static SVG), 135–390 lines. None uses three.js or the V2 runtime. None has direct-manipulation checks or governed evidence. Keyboard and ARIA support is minimal: zero or one handler per lab. That is why no legacy lab is a final **KEEP**. Under rule 2 below, each stays live (KEEP *until replaced*) until its V2 replacement passes governed approval.

- **REBUILD**: a new V2 definition and model in the shared runtime; the legacy code is only a parity reference.
- **UPGRADE**: move to the V2 shell, checks and accessibility while keeping a 2D-first scene.
- **RETIRE**: superseded by an existing V2 lab once parity is shown.

| Lab | Disposition | Reason | Runtime dependencies |
|---|---|---|---|
| human-heart | REBUILD (HERO) | Blood flow and valves need surfaces, cutaway and time | RX-005 (surfaces, cutaway), RX-006, **RX-007** (cardiac cycle) |
| molecule-motion | REBUILD (HERO) | Particle speed versus temperature is a 3D, many-instance scene | RX-005, RX-006 instancing; RX-007 |
| tectonic-plates | REBUILD (HERO) | Needs a terrain heightfield and a cross-section | RX-005 (terrain, cutaway); RX-007 (geological time) |
| cell-division | REBUILD (STANDARD) | Mitosis stages are a time sequence; the canvas animation is not learner-controlled | RX-005; **RX-007** |
| chemical-reaction | REBUILD (STANDARD) | Reuses molecule-motion patterns | RX-005, RX-006; RX-007 |
| wave-motion | REBUILD (STANDARD) | Water and string surfaces | RX-005b surfaces; RX-007 |
| pendulum-lab | REBUILD (STANDARD) | Period checks become direct-manipulation checks | RX-001 motion; RX-007 for timing checks |
| gravity-explorer | REBUILD (STANDARD) | Orbits need a camera and a time scrub. Its `GravityLessonLabPanel` embed must keep working until the switch | RX-005; RX-007 |
| weather-system | REBUILD (STANDARD) | Reuses the hydro daylight, sky and water rig | RX-005 daylight rig, surfaces; RX-007 |
| ecosystem-balance | REBUILD (STANDARD) | Populations over time; instanced organisms | RX-006 instancing; RX-007 |
| light-and-shadow (embedded) | REBUILD (STANDARD) | Needs a new ray/optics pattern | RX-005 plus a new optics kit (proposal needed) |
| water-cycle (embedded) | REBUILD (DERIVATIVE) | Built from the hydro water rig and weather | RX-005b surfaces; RX-007 |
| earthquake-waves (embedded) | REBUILD (DERIVATIVE) | Built from tectonics and waves | as tectonic-plates and wave-motion |
| simple-machines (embedded) | REBUILD (DERIVATIVE) | Extends `fixture-lever` to pulleys and inclines | V2 assemblies; RX-005 |
| periodic-table | UPGRADE (2D-first) | A table is the right representation; 3D adds nothing. Needs the V2 shell, checks and keyboard access | V2 shell and FALLBACK_2D only |
| cell-structure (embedded) | UPGRADE (2D-first → cutaway later) | Static SVG diagram; first gain is checks and accessibility. A 3D cutaway is optional after the heart HERO | V2 shell; optionally RX-005 cutaway |
| electric-circuit | RETIRE (after parity) | Superseded by the V2 `series-circuit-ohms-law` lab. Retire once a parity inventory shows nothing is lost | none new |

Totals: REBUILD 14, UPGRADE 2, RETIRE 1, final KEEP 0. These are the builder's proposals. The pedagogy director confirms each at the lab's start (see the tier note above), and the founder or governance approves every switch-over.

**RX-007 status: PLANNED only.** There is no proposal review, no code, and no lab depends on it shipping. Labs above marked RX-007 still ship their first V2 release without a time axis if RX-007 is not ready.

## Rules for every migration

1. **Parity inventory first.** List everything the legacy lab lets a learner do and learn. The V2 version must cover all of it, or record each drop as a reviewed trade-off.
2. **No student loses a lab.**
   - The legacy lab stays live until its V2 replacement reaches `SHIP_CANDIDATE` *and* passes governed approval (`reviewState`/`approvalState` APPROVED and a release binding).
   - Then the catalogue entry or `LessonLabPanel` reference switches.
   - The legacy code is removed in a later PR.
3. **Evidence does not get weaker.**
   - Legacy labs record PROVISIONAL session scores and never write mastery.
   - V2 records only `check` evidence through the governed path. A check with no authority mapping stays RAW_OBSERVATION.
   - Any authority mapping is a curriculum-governance decision, not part of this programme.
4. **Every lab defines HIGH, STANDARD, LOW, FALLBACK_2D and offline.** Every check must be completable on LOW and FALLBACK_2D by touch, mouse and keyboard.
5. **Budgets are locked.** Each lab gets a baseline (`update-lab-budget-baseline.ts`), and CI fails on more than 5% growth.
6. **No physical-device claim without a physical device.** Each subject hero needs at least one TARGET_LOW_DEVICE session before `SHIP_CANDIDATE`.

## What only the founder (or governance) can do

- Re-review Mount Coffee 1.1.0 hands-on. That is the immersion bar for everything after it.
- Approve the three "approved-inspiration" benchmark references in `07-V1_1_EXPERIENCE_DELTA.md`, or replace them.
- Run, or arrange, real-device sessions on a Tecno Spark Go-class phone.
- Approve each V2 replacement through governed review before any student switch-over.
- Decide curriculum authority mappings for checks.

## Sequencing summary

```
Phase 0  RX-005 + RX-006 (shared runtime)          → reviews recorded, tests, determinism
Phase 1  Mount Coffee 1.1.0 HERO                    → SHIP_CANDIDATE + founder re-review
Phase 2  solids / lever / circuit DERIVATIVE re-review on the new renderer
Phase 3  RX-007 time axis, proved on human-heart (HERO)
Phase 4  legacy migration: heroes (molecules, tectonics) → STANDARD → DERIVATIVE → embedded
later    RX-008 haptics + sound; WebXR AR only if device data supports it
```

# v1.1 pedagogy delta: mount-coffee-hydropower

Author: `lab-pedagogy-director`, 2026-10-01. This delta amends [01-PEDAGOGY_BRIEF.md](01-PEDAGOGY_BRIEF.md) for the v1.1 immersive pass and does not replace it. Builder verification notes appear in *italics*.

## Authority

v1.1 continues on the same FIXTURE basis as v1.0, so it is not BLOCKED_ON_AUTHORITY. The objective `hydropower-cause-and-effect` is PROPOSED, NOT GOVERNED. The lab is DRAFT and all five checks are RAW_OBSERVATION. Any attempt to bind a release, map authority, or make the lab reachable by students turns this into BLOCKED_ON_AUTHORITY.

Housekeeping: the v1.0 brief's working id `fixture-hydro-energy-chain` is retired. `hydropower-cause-and-effect` (`hydropower.ts:7`, `production.json`) is the single objective id.

## 1. Tier

HERO is confirmed, for three reasons:
- RX-005 debuts here and every later lab inherits it.
- Realistic water raises the risk of teaching a false model.
- The founder has made this the subject benchmark.

The lab version moves to 1.1.0, because the scene, controls and check prompts all change.

## 2. Scene actions vs panel controls

Every in-scene action dispatches the same `set-variable` action as the panel button. As a result:
- The evidence classification is unchanged.
- Each in-scene control is an actionable render-list part, so FALLBACK_2D gets a focusable SVG target of at least 44 px.
- Each control has a name and a place in the tab order.

| Cause | Where | Why |
| --- | --- | --- |
| Feeder breakers (hospital, homes, shops) | **In the scene**, at the switchyard, with the city in the same frame | Load shedding is a grid action. Putting it there fixes gap G7, where the consequence was off-screen on mobile while the learner operated the controls. |
| Units online | **In the scene**, as a powerhouse control desk (start next unit / stop last unit), with the next unit highlighted before the learner confirms | Tapping a single unit would be false, because the model always dispatches units in order 1→2→3→4. |
| River season | **In the scene**, on an upstream river-gauge post labelled "Choose a season to test" | The cause sits where the water arrives. It is a condition to test, not a plant control. |
| Repair placement | In the scene, tap-to-place (unchanged) | |
| Cutaway, explode, labels, camera, mode, trace buttons | Panel | Moving them into the scene adds no understanding. |

## 3. What immersion must show and must not do

**Must show.** Every item below is driven by model quantities; the renderer computes nothing.
- **Water volume.** Width, depth and stream count follow `riverFlow`, each unit's share and `spillFlow`. Volume is the primary cue; speed is secondary and mild.
- **Dry season.** The upstream river, banks and downstream river visibly shrink, while the headpond surface stays exactly the same.
- **Downstream river.** It carries turbine plus spill water and looks as big as the upstream river in every state.
- **Head marker.** A fixed "drop ≈ 23.1 m" marker runs from the headpond surface to the tailwater.
- **Idle units.** A unit that is on but has no water (indicator lit, penstock dry, runner still) is visibly distinct from one that is generating.
- **Trip.** On a trip the units stop and all the water spills, matching the model.

**Must not do:**
- Water motion that runs regardless of state. Inactive flows stay empty and still.
- A wide, lake-like headpond, which would bring back misconception 1. The upstream river must visibly feed a narrow pond.
- Rain at the plant.
- The headpond filling or draining.
- Turbine speed that tracks flow.
- City lights dimming.
- Sparks or explosions on a trip.
- Electricity drawn like water.
- A night sky in the challenge, because "dark city" means only "tripped".

## 4. Misconceptions

| Risk from richer water | Mitigation |
| --- | --- |
| "The turbine turns water into electricity" | A continuous tailrace and a downstream river as big as the upstream one |
| "The headpond is a stored lake" | A narrow pond with visible inflow |
| "Rain at the dam makes power" | No rain on site; the season shows through the banks and river width |
| "Spillway water makes power" / "is lost" | Spill visibly rejoins the river, with no yellow flow from it |
| "Realistic means to scale" | Keep the not-to-scale marker and the 30 km break |

v1.1 handles misconceptions 1, 2, 4 and 6 better, because they become visible volume contrasts instead of text alone.

## 5. Guided path, challenge and checks

**[P1 · PEDAGOGY] Guided step S1 duplicates the trace task.**
- Where: `hydropower.ts:120`.
- Problem: the "meet" prompt duplicates the trace-water prompt. It skips orientation and gives away the assessment.
- Fix direction: rewrite it as a "meet the plant" beat.
- *Builder: confirmed in code.*

**Predict→test prompts:**
- S5: "Predict: will the headpond drop in the dry season?"
- S4: "Will flood water make more than 88 MW?"

**[P0 · PEDAGOGY, carried from v1.0] Challenge and `dry-season-peak` can be passed by blind toggling.**
- In the dry season the plant makes 10.03 MW. Three on/off feeders give only 8 combinations, and the target needs only "dry flow, hospital on, no trip".
- In-scene switches make toggling even cheaper.
- *Builder: confirmed in code. `gridStableWithPriority` = dry flow ∧ hospital ∧ ¬tripped (`hydropowerModel.ts`); `dry-season-peak` is a reach-target on it (`hydropower.ts:148`).*
- Fix direction, which needs a founder decision because it changes the model:
  - split demand into smaller feeder blocks;
  - make the target "hospital lit **and** maximum load served without a trip", which needs supply-against-demand arithmetic;
  - latch protection so each trip must be reclosed (gap G8).
- If the founder keeps "model unchanged", this stays an open P0 and blocks SHIP_CANDIDATE.
- **Founder decision, 2026-10-01: fix it with smaller feeder blocks.** The model change is specified by `lab-simulation-architect` in `06-V1_1_SIMULATION_DELTA.md`.

**[P1 · PEDAGOGY] The `dry-season-output` prompt gives the answer** ("Set dry season flow…").
- Fix direction: "With all four units on, make the plant produce about 10 MW (8–12)."
- Units alone cannot reach that band, so the learner discovers that flow is the limit.

**`repair-unit-3`:**
- It proves only the runner–shaft–generator structure, not "repair adds capacity, not water".
- That idea stays with the explanation and guided practice.

**`trace-water` and `find-generator`:**
- No change.
- The generator must stay clearly different in shape from the runner.
- Trace nodes stay targets of at least 44 px above the water surfaces.

All five checks must remain completable on LOW and FALLBACK_2D, by touch, mouse and keyboard.

## 6. Physical and practical work

The sequence is unchanged. Add:
- the safety line in the flood/spillway and trip states, not only the end panel, because realistic water must not make spillways look inviting;
- a line linking the bottle-cap wheel's "thin stream vs full stream" to the season control.

## 7. Rejected for v1.1

| Idea | Why rejected |
| --- | --- |
| Spillway gate as a learner control | It needs a model change, it is an operator decision rather than one of the objective's causes, and it risks a "draining the pond" idea |
| Learner "trip" button | It teaches that a trip is a choice |
| Per-unit start/stop toggles | They misrepresent the fixed dispatch order |
| Head slider | A real plant's head is fixed |
| Physically simulated fluid | The renderer would be computing consequences |
| Free-fly, drone or first-person camera | Principle 10 |
| Dusk or night lighting | |
| Rain, foam bursts or sparks | |
| Photoreal Monrovia or real districts | |

## Not reviewed

- RX-005, the simulation spec and the asset spec.
- Any capture.
- Live touch, keyboard or LOW behaviour.
- Dispatch of in-scene controls.
- Whether three.js can show water volume within the budgets.
- How well blind toggling is solved in practice; the P0 is derived from the model.

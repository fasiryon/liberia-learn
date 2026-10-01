# v1.1 simulation delta: mount-coffee-hydropower

Author: `lab-simulation-architect`, 2026-10-01. This amends [03-SIMULATION_SPEC.md](03-SIMULATION_SPEC.md). It implements the founder decision of 2026-10-01: fix the blind-toggle P0 with **smaller feeder blocks**. The model `mount-coffee-run-of-river` and the lab both move to 1.1.0. This document is a spec only.

*Builder verification (2026-10-01):*
- *Dry output is 10.03 MW. The only passing load is hospital 4 + one shops block 4 = 8 MW. A second shops block (12 MW) trips; one homes block (12 MW) trips.*
- *Feeder settings at (49 m³/s, 4 units): 2·5·5 = 50 combinations, exactly 1 passing.*
- *Rainy, 3 units (66 MW): 4 + 48 = 52 MW, then 56, 60, 64 MW; the fourth shops block trips at 68 MW.*
- *Arithmetic confirmed.*

## Variables

| id | kind | min/max/step | initial |
|---|---|---|---|
| `riverFlow`, `unitsOnline` | unchanged | | 430, 4 |
| `feederHospital` | toggle, always priority | 0/1/1 | 1 |
| `homesBlocks` (replaces `feederHomes`) | discrete count | 0/4/1 | 4 |
| `shopsBlocks` (replaces `feederShops`) | discrete count | 0/4/1 | 4 |

Why one count per district:
- It keeps 3 feeder flows, so the lab stays at 10 of the 11-flow budget.
- Each district is a single +/− target on FALLBACK_2D.
- Keyboard stepping is unchanged.

v1.0 checkpoints are rejected on restore and are not migrated.

## Rules

Demand values are MODEL ASSUMPTIONS (fictional):

| Load | MW |
|---|---|
| `HOSPITAL_MW` | 4 |
| `HOMES_BLOCK_MW` | 12 |
| `SHOPS_BLOCK_MW` | 4 |

- `demandMW = 4·H + 12·h + 4·s`, maximum 68.
- `headroomMW = round6(outputMW − demandMW)`. It is negative if and only if the plant has tripped.
- `noBlockFits`: no district below its maximum has a block of headroom or less.
- `maxLoadServed = H ∧ ¬tripped ∧ noBlockFits`.
- `gridStableWithPriority` keeps its id but now means `riverFlow = 49 ∧ maxLoadServed`.
- **PEDAGOGICAL_SIMPLIFICATION S9:** demand comes in fixed blocks, and "maximum load served" means no further block fits, not the best possible mix.
- **Rainy overload beat (3 units, 66 MW):**
  - Hospital plus 4 homes blocks = 52 MW.
  - Shops blocks raise it to 56, 60 and 64 MW; the fourth block trips at 68 MW.
  - New prompt: "…set homes to all 4 blocks, then add shops blocks one at a time. Which block trips the plant?"
- **Trip latching (G8):** optional and deferred. It needs state memory, which `SimulationInput` lacks, so it would need its own runtime extension.
- **Invalid input:** `hydro_model_input_invalid:homesBlocks` or `:shopsBlocks` for a value outside 0–4, a non-integer, or a missing value. Never clamp.

## Components and flows

- **City blocks:** new components `city-homes-b1..4` and `city-shops-b1..4`, with intensity = (k ≤ count ∧ ¬tripped) ? 1 : 0.
- **Demand segments:** `demand-hospital`, `demand-homes-b1..4` and `demand-shops-b1..4`.
- **Feeder flows (rate ÷ 48):**

| Flow | Active when | Rate |
|---|---|---|
| `feeder-hospital` | H ∧ ¬tripped | 0.083333 |
| `feeder-homes` | h > 0 ∧ ¬tripped | h/4 |
| `feeder-shops` | s > 0 ∧ ¬tripped | s/12 |

- Water flows are unchanged.

## Water quantities for the renderer

The renderer reads these and computes nothing.

| id | formula |
|---|---|
| `upstreamFlow`, `headpondInflow` | Q |
| `u{n}Flow` | generating ? share : 0 |
| `u{n}FillFactor` | u{n}Flow / 107.5 |
| `u{n}Idle` | status === idle ? 1 : 0 |
| `turbineFlow`, `tailraceFlow` | Σ u{n}Flow |
| `spillFlow` | Q − turbineFlow |
| `downstreamFlow` | tailraceFlow + spillFlow (= Q) |
| `headpondLevel` | 1, constant (S6) |
| `upstreamWidthFactor`, `downstreamWidthFactor` | √(Q/557) |
| `upstreamDepthFactor`, `downstreamDepthFactor` | ∛(Q/557) |
| `tailraceWidthFactor`, `spillWidthFactor` | √(segment/557) |
| `riverLanes`, `downstreamLanes` | lanes(Q) |
| `tailraceLanes` | unitsGenerating |
| `spillLanes` | lanes(spill) |

`lanes(q) = q ≤ 0 ? 0 : ceil(q/107.5 − 1e-9)`, so `tailraceLanes + spillLanes = riverLanes` exactly. The width/depth exponents and lanes are VISUAL ASSUMPTIONS, not to scale.

## Expected consequences

| Action | Quantity | Visual | Line |
|---|---|---|---|
| Season to dry | Q 49, width 0.2966 | Rivers shrink, headpond unchanged | `dry-limit` |
| Add a block | demand +4 or +12 | One more block lit, or the whole city dark | `headroom` (new): "about X MW spare; homes blocks need 12, shops 4" |
| Exceed output | tripped | Units stop, everything spills, downstream width unchanged | `trip-overload` |
| Hospital only, dry | headroom 6.03 | Hospital lit; not passed | `headroom` |
| Max load served | `maxLoadServed` 1 | Hospital + 1 shops block | `max-served` (new) |

The `demand` line reads: "Hospital 4 MW; homes blocks 12 MW; shops blocks 4 MW (model numbers)". No new line needs `minGrade`.

## Checks

- **`dry-season-output`:**
  - Prompt: "With all four units on, make the plant produce about 10 MW (8–12)."
  - Answer: reach-target `outputMW` 8–12.
  - It passes if and only if Q = 49 ∧ unitsRunning ≥ 1.
- **`dry-season-peak`:** reach-target `gridStableWithPriority` 1–1, using the new definition.
- **`trace-water`, `find-generator`, `repair-unit-3`:** unchanged.

## Fixtures (to become vitest cases)

Notation: (Q, units, H, h, s), with unit 3 intact (I) unless E is stated.

| Fixture | State | Expected |
|---|---|---|
| V01 | (430,4,1,4,4) | output 88, demand 68, headroom 20, `gridStableWithPriority` 0; widths 0.8786; lanes 4/4 |
| V02 | (49,4,1,4,4) | tripped, headroom −57.972093, spill 49, every block dark |
| V03 | (49,4,1,0,1) | **pass**: headroom 2.027907; statuses generating/idle/idle/idle; `city-shops-b1` lit, `b2` dark |
| V04 | (49,4,1,0,0) | headroom 6.027907, `noBlockFits` 0, fails (the v1.0 pass state) |
| V05 | (49,4,1,0,2) | 12 MW, tripped |
| V06 | (49,4,1,1,0) | 16 MW, tripped |
| V07 | (49,4,0,0,2) | 8 MW, stable, fails (hospital off) |
| V08 | (49,0,1,0,1) | output 0, tripped |
| V09 | (430,3,1,4,s), s = 0–4 | headroom 14/10/6/2/−2; tripped only at s = 4; lanes 3+1, then 0+4 |
| V10 | (430,4,1,4,4,E) | output 66, tripped |
| V11 | (557,4,1,4,4) | spill 127, spill width 0.4775, lanes 6/4/2 |
| V12 | (557,1,1,4,4) | tripped, spill 557 |
| V13 | (430,2,1,3,1) | 44 = 44, not tripped; s = 2 trips |
| V14 | (176,4,1,2,2) | 36 against 36.018605, not tripped; s = 3 trips |
| V15 | (303,4,1,4,2) | headroom 2.009302; s = 3 trips |
| V16 | any | `outputMW` ∈ [8,12] if and only if Q = 49 ∧ unitsRunning ≥ 1 |
| V17 | invalid | h = 5, h = 1.5, s = −1 and a missing `homesBlocks` all throw |

**Properties over all 2,500 states:**
- Flow is conserved: Σ u{n}Flow = tailraceFlow, and tailraceFlow + spill = downstreamFlow = Q to 1e-6.
- `headpondLevel` is always 1.
- Downstream width equals upstream width, and lanes are conserved.
- A unit is never both generating and idle.
- One more block never clears a trip.
- `maxLoadServed` ⇒ adding one block to any district not at its maximum trips.
- City lights are only 0 or 1.
- Flow rates are in [0, 1].

**Pass set:** exactly `49/u/1/0/1` for u = 1–4, with I or E: 8 states.

**Blind-toggle test:**

| Scope | v1.1 | v1.0 |
|---|---|---|
| All variable settings | 4/1250 = 0.0032 | 4/200 = 0.02 |
| Feeder settings at (49, 4) | 1/50 = 0.02 | 1/8 = 0.125 |
| With the hospital on | 1/25 | |

`dry-season-output` stays guessable at 0.16. That is inherent to a one-cause discovery check. The challenge can be completed in at most 10 steps on LOW and FALLBACK_2D.

## Review scenarios (`referenceScenarios.ts`)

- Set `labVersion` to "1.1.0" and add a `blocks(id, n)` helper.
- **Changed:**
  - `hydro-guided-overload-beat`
  - `hydro-fault-overload-trip`
  - `hydro-fault-shed-restore`
  - `hydro-challenge-solved`
  - `hydro-assessment-dry-output`
  - `hydro-assessment-repair`
  - `hydro-assessment-all-passed`
  - `hydro-assessment-trace` (shed load before tracing)
- **New:**
  - `hydro-guided-overload-fourth-block` (motion)
  - `hydro-challenge-hospital-only-underserved`
  - `hydro-challenge-one-block-too-many`
  - `hydro-challenge-homes-block-too-big`
  - `hydro-variable-idle-units-dry`
  - `hydro-assessment-peak-wrong-then-right`

## Known limits

- **Changed claims:** demand figures change from hospital 6 MW to 4 MW and from a total of 86 MW to 68 MW. They are still fictional.
- **New assumptions:** the block sizes, the √ and ∛ width/depth mappings, and one lane ≈ 107.5 m³/s.
- **Not represented:** latching protection, the best possible block mix, time of day, and line losses.
- **Not reviewed:** RX-005, the asset spec, captures, live in-scene dispatch, and three.js budgets.

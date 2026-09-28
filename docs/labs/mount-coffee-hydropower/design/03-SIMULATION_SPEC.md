# Simulation spec: `mount-coffee-hydropower`

Author: `lab-simulation-architect`, 2026-09-28. Recorded by LAB-BUILDER, which checked the arithmetic: η = 22e6 / (1000·9.81·23.1·107.5) = 0.903094, and 49/107.5·22 = 10.027907 MW. The deterministic fixtures F01–F22 and the property tests are implemented in `__tests__/interactive-labs/hydropower-model.test.ts`, and that test file is the executable form of this spec.

## Model

- **Kind:** `deterministic-rules`, id `mount-coffee-run-of-river` v1.0.0.
- **Behaviour:** pure, memoryless and fail-closed. Invalid or missing input throws `hydro_model_input_invalid:<id>`; it never defaults or clamps.
- **Rounding:** every quantity and rate is rounded with `round6`.

### Engine facts it relies on (verified in `engine.ts`)

- The model receives only `variables` and `placements`.
- A wrong `check` is accepted, recorded as incorrect, and counted in `retries`.
- `reach-target` bounds are inclusive.
- `trace-path` fails while its flow is inactive and needs the exact traceable order.
- `assemble` needs `disassembled` to include the assembly, plus shape-matched slots.

## Variables

| id | kind | values | initial |
| --- | --- | --- | --- |
| `riverFlow` (m³/s) | discrete, step 127 | 49 Dry · 176 Early rains · 303 Heavy rains · 430 Rainy (full) · 557 Flood | 430 |
| `unitsOnline` | discrete, step 1 | 0–4 | 4 |
| `feederHospital`, `feederHomes`, `feederShops` | toggle | 0/1 | 1 |

- **Verified values:** only 49 → ≈10 MW and 430 → 88 MW come from sources. 176, 303 and 557 are model assumptions.
- **No zero-flow step:** the river never stops.
- **G8, no Reclose control:** a memoryless model can't latch a trip, so a Reclose toggle would change no consequence. Restoration happens as soon as demand fits (simplification S5).
- **G6:** the challenge composite requires `riverFlow === 49`.

## Constants

| Constant | Value | Status |
| --- | --- | --- |
| Head | 23.1 m | Voith |
| Units | 4 × 22 MW | Verified |
| Synchronous speed | 142.86 rpm | Voith |
| Design flow per unit (`Q_UNIT`) | 107.5 m³/s | Assumption |
| Efficiency η | 0.903094 | Assumption: set so one unit at design flow makes exactly 22 MW |
| Feeder demand | Hospital 6, Homes 48, Shops 32 MW (86 in total) | Fictional; every demand/supply pair differs by at least about 2 MW |

## Rules, in order

1. **Unit 3 availability.** `unit3Ready` is 1 only when the placements for `unit-3` are exactly runner/shaft/generator in their slots. It fails closed.
2. **Dispatch.** Units are taken in order 1, 2, 3, 4, skipping 3 when it isn't ready. The running units are the first `unitsOnline` of that list.
3. **Water shares.** Each running unit in turn takes `min(remaining, 107.5)`. `usableFlow = min(Q, running·107.5)`.
4. **Power.** Unit power = 22·share/107.5. `outputMW` = 22·usableFlow/107.5 is **capability**, capped at 88. The gauge shows it as "Power the plant can make".
5. **Demand.** Sum of the feeders that are switched on.
6. **Trip.** `tripped` when `demand > outputMW`.
7. **Delivery.** `suppliedMW = tripped ? 0 : demand`. `turbineFlow = tripped ? 0 : usableFlow`. `spillFlow = Q − turbineFlow`.
8. **Status**, shared by the runner, shaft and generator of each unit:
   - `out-for-repair`: unit 3 when it isn't ready;
   - `off`: not running;
   - `tripped`: running while the grid has tripped;
   - `generating`: running with a water share above 0;
   - `idle`: running with no water share.
9. **Challenge composite.** `gridStableWithPriority` = dry ∧ hospital on ∧ not tripped.

**RX-001 motion groups** `unit-N-shaft`: runner, shaft and generator turn about a shared Y axis at 142.86 rpm, `activeWhen` status ∈ {`generating`}.

This settles design-review item 2, what spins in each status:

| Status | Spins? | Why |
| --- | --- | --- |
| `generating` | Yes | Water is driving the runner |
| `idle` | No | No water reaches the runner |
| `off` | No | The unit is not running |
| `out-for-repair` | No | The unit is taken apart |
| `tripped` | No | Units shut down on a trip (S4) |

## Pedagogical simplifications (for the science reviewer)

- **S1:** no load-following. The model separates capability (`outputMW`) from delivered power (`suppliedMW`).
- **S2:** constant η; power is linear in flow, with no minimum stable flow.
- **S3:** fixed dispatch order.
- **S4:** a trip shuts the units down, so the whole river goes over the spillway. Speed-no-load operation is not represented.
- **S5:** memoryless protection, reclosed instantly by the operators.
- **S6:** the headpond level is constant, by design.
- **S7:** the power line is a one-way energy-delivery flow.
- **S8:** demand is fictional and constant.

## Flows (10 of the maximum 11)

| Flow | Active when | Rate |
| --- | --- | --- |
| `river-in` | Always | Q/557 |
| `water-u1` | Unit 1 generating | share/107.5 |
| `water-u2`, `water-u3`, `water-u4` | That unit generating | share/107.5 |
| `spillway` | `spillFlow > 0` | spill/557 |
| `power-line` | `supplied > 0` | supplied/88 |
| `feeder-hospital`, `feeder-homes`, `feeder-shops` | Feeder on and grid not tripped | Feeder MW / 48 |

**`water-u1` is the only traced flow.** Its six traceable nodes, in path order:

1. headpond (−1.5, 2.9, −2.5)
2. intake-1 (−1.5, 2.1, −1.2)
3. penstock-1 (−2.05, 1.0, −0.6)
4. turbine-1 (−1.5, −0.2, 0)
5. tailrace (−1.5, −1.0, 0.9)
6. river-downstream (1.0, −2.0, 2.0)

The nodes are at least 0.80 apart in X–Y. Listed alphabetically they differ from the path order.

## Checks

| id | spec | pass |
| --- | --- | --- |
| `trace-water` | trace-path `water-u1` | exact six-node order while water-u1 is active |
| `find-generator` | identify-component `u1-generator` | cutaway `powerhouse-section`, then inspect |
| `dry-season-output` | reach-target `outputMW` 8–12 | Q = 49 with ≥ 1 unit running (10.03). The nearest other values are 0 and 22 |
| `dry-season-peak` | reach-target `gridStableWithPriority` 1–1 | dry, hospital on, not tripped |
| `repair-unit-3` | assemble `unit-3` | clear-assembly, then runner/shaft/generator in the correct slots |

## Recommendation adopted

The guided overload beat (S6) runs in the rainy season with 3 units, so the guided path does not solve the dry-season challenge for the learner.

## Known limits

- Capability is shown instead of load-following.
- Efficiency is flat, and flood head is not reduced.
- The flows at 176, 303 and 557 m³/s and the per-unit design flow are assumed.
- Protection is memoryless.
- A trip means the units shut down.
- The dispatch order is fixed.
- Unit 3's only fault is being taken apart.
- Blind toggling can find the challenge state; 4 of the 40 unit/feeder combinations pass.
- The power line is a single-line energy model.
- Demand is fictional, with no time of day and no line losses.

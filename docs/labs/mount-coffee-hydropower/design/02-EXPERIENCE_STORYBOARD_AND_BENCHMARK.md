# Experience design, storyboard and reference benchmark: `mount-coffee-hydropower`

Author: `lab-experience-director`, 2026-09-28. Recorded in substance by LAB-BUILDER. No external reference media was supplied, so the benchmark uses LiberiaLearn's own prior-lab captures, which carry no licence risk. The brief overrides the commission:

- flow, in season steps, is the input;
- there is no reservoir-level control, and the headpond always looks the same;
- turbine speed never follows flow;
- there is no photoreal terrain or fluid simulation;
- there is no even dimming;
- there is no war sequence.

## Runtime facts that shape the design (verified in source)

1. FALLBACK_2D is a front orthographic X–Y projection that ignores yaw and pitch (`Fallback2D.tsx`). The build follows from that:
   - The scene is seen from downstream. The dam runs along X and height along Y.
   - The four units sit side by side in X.
   - The tailrace/river bends in X–Y.
   - Traceable nodes are at least 0.5 units apart in X–Y.
2. At LOW, WebGL labels only highlighted items (`WebGLScene.tsx:142`). Guided steps must therefore highlight what they name, and every number must also appear in the explanation lines.
3. Quantities appear only as explanation text. `componentStates.status` is not rendered. `intensity` renders as a warm emissive glow.
4. An inactive flow draws no particles (grey "not flowing" in 2D). The particle count is fixed per profile, so **at most 11 flows** fit the HIGH budget (9 flows = 162 of 200).
5. Poses follow learner variables only.
6. Guided steps are prompt + camera + highlights only. "Next" is always enabled.
7. `SimulationInput.placements` reaches the model, so repair can depend on correct placement.

## Reference breakdown

### Circuit (`fixture-simple-circuit/1.0.0/smoke`)

Problems:

- Primitives float in a void, with no context or scale.
- The wire is a hairline at HIGH.
- The largest object is not the consequence object.
- Current starting is nearly invisible across the 10-frame strip, and the bulb reaches only ~20%.
- The panel stays on "Step 1" after the action, and its task line goes stale.
- The controls are cut off on desktop.
- The "Switch lever" and "Switch" labels collide.
- The 2D view is more legible than HIGH, but its labels are oversized and overlap.

Verdict:

- **Adopt:** yellow for electricity; a button for every action; alphabetical trace buttons; slider step buttons; explanation lines that carry the numbers.
- **Adapt:** particles must *read*. Use high-contrast colours and parallel flows so that more flow means more active lines, and make the consequence object big.
- **Avoid:** the void; hairlines; two labels on one assembly; prompts that go stale; dim, small consequence objects.

### Solids (`g4-solid-figures/2.1.0/smoke`)

Strengths:

- The best take-apart frame, with context fade and readable pill labels.

Problems:

- The camera move is effectively a cut (the strip is static after 90 ms).
- `prism-rebuilt` leaves about 80% of the frame empty, and the "Face 6"/"Face 3" labels overlap.
- The feedback is a generic "Nice work", and the task line goes stale.
- In LOW mobile, portrait crops the faces and there are no in-scene labels.
- In LOW mobile, the controls stack far below the scene, so the consequence is off-screen while the learner operates them.

Verdict:

- **Adopt:** exploded separation with context fade; part buttons; the "What is happening" card; take-apart → rebuild assessment.
- **Adapt:** camera moves must read as moves; presets must frame for portrait; the consequence must be visible while operating on mobile.
- **Avoid:** empty frames; generic success copy; task lines that contradict the state.

## Art direction (handed to `lab-asset-director`)

**Diorama strip, seen from downstream, marked "not to scale":**

- headpond at back/high;
- dam crest with spillway gates across the left half;
- powerhouse with 4 bays in X;
- penstocks dropping in Y;
- tailrace returning to a river that bends lower-right;
- three towers rising right, with a break symbol and "≈30 km";
- a Monrovia block of three feeder groups: "Hospital (priority)" with an **H** sign (not a red cross, which is a protected emblem), "Homes" and "Shops". These are generic and fictional.

**Colour:** water blue, spillway pale blue-white, electricity yellow. City windows glow with intensity 0 or 1 only.

**Persistent explanation lines:** a context line and the brief's safety/limits line.

**Proposed camera presets:** `valley`, `water-path`, `powerhouse-section`, `unit-bench`, `grid-city`. They share one constraint set and must frame in portrait.

**Proposed flows (9):** `water-u1..4`, `spillway`, `power-line`, `feeder-hospital`, `feeder-homes`, `feeder-shops`.

**Proposed variables:** `riverFlow` in season steps (Dry ~49, early rains, Rainy ~430, Flood >430 m³/s); `unitsOnline` 0–4; three feeder toggles.

**Interim output gauge:** a 4-segment "Power made" bar, 22 MW per segment, driven by intensity, plus a "Power asked for" bar.

## Storyboard

| Scene | Beat | Camera | The eye lands on | Consequence | LOW / 2D | Primitives |
| --- | --- | --- | --- | --- | --- | --- |
| S1 Meet the plant | The whole chain; a real Liberian plant | `valley` | The dam and headpond | Part descriptions | LOW needs guided highlights for its names | `camera-preset`, guided highlights, `inspect-component`, `toggle-labels` |
| S2 Trace the water | Water passes through and back to the river | `water-path` | The penstock drop | Blue particles start; numbered trace; "not used up" line | 4 particles; 2D vertical drop | `set-variable`, flows, `trace-node` |
| S3 Inside the unit | Runner, shaft and generator on one vertical shaft | `powerhouse-section` / `unit-bench` | The vertical shaft | Cutaway clip with context fade, plus a vertical explode; at most 3 labels | LOW hides instead of clipping; the 2D stack is ideal | `set-cutaway`, `set-explode`, `inspect-component` |
| S4 Rainy season | Full power up to turbine capacity; flood → spillway | `valley` | The city lighting, then the spillway | Gauge 4/4 (88 MW); in flood the spillway flows and power stays 88 | Gauge glow, 2D circles | `set-variable`, flows, intensity |
| S5 Dry season (wow 1) | The limit is flow, not a stored lake | `valley` (headpond and gauge both in frame) | The unchanged headpond beside the collapsed gauge | ~10 MW; idle units have no particles | Grey "not flowing" lines | `set-variable`, flows |
| S6 Overload (wow 2) | Supply must match demand; trip, not dim | `grid-city` | The whole city dark at once | Shedding restores full brightness to the lit feeders | 0/1 emissive; grey feeders | toggles, flows, intensity |
| S7 Name the chain | potential → kinetic → rotation → electrical → light (+heat) | `valley` | The highlighted chain | Ordered lines; P = ρgQHη from Grade 9 | Same lines | guided highlights, `explainState` `minGrade` |
| S8 Challenge | Dry, evening peak: stable grid with the hospital lit | `grid-city` | Dark city; demand bar vs supply bar | Composite `gridStableWithPriority`; "all units on" and waiting both fail | Button-completable | `reach-target` |
| S9 Assessment | trace water-u1, identify generator (via cutaway), dry output 8–12 MW, dry peak, repair unit 3 | per check | The scene state *is* the success | Repair adds capacity, not water | Every check completable with buttons | trace-path, identify-component, reach-target, assemble |

## RUNTIME_GAP register

| Id | Gap | Interim if not extended |
| --- | --- | --- |
| G1 | Constant-speed rotation cue driven by state | Particles through the runner + explanation |
| G2 | Quantity gauge / HUD | 4-segment emissive bar + MW in explanation |
| G3 | `componentStates.status` not rendered | Absence of particles + explanation |
| G4 | Pose driven by a simulation output (breaker opening on trip) | City dark + explanation |
| G5 | State-aware guided prompts / step completion | Prompts written to stay true after the action |
| G6 | Per-mode variable lock | The composite requires dry season |
| G7 | Mobile: consequence off-screen while operating (player layout) | Explanation `aria-live`; gauge near the top of the scene |
| G8 | Latched protection needs state memory | A learner "Reclose" toggle, or a proposal |

A camera-easing retune (moves, not cuts) is a shared `presentation.ts` item.

## REFERENCE BENCHMARK

| Ref id | Capture (`artifacts/lab-review/...`) |
| --- | --- |
| REF-CIRCUIT-OVERVIEW | `fixture-simple-circuit/1.0.0/smoke/overview__HIGH__desktop.png` |
| REF-CIRCUIT-CURRENT-MOTION | `fixture-simple-circuit/1.0.0/smoke/current-starts__HIGH__desktop__motion-sheet.png` |
| REF-CIRCUIT-FALLBACK2D | `fixture-simple-circuit/1.0.0/smoke/current-starts__FALLBACK_2D__desktop.png` |
| REF-SOLIDS-EXPLODED-HIGH | `g4-solid-figures/2.1.0/smoke/cube-exploded__HIGH__desktop.png` (+ motion sheet) |
| REF-SOLIDS-EXPLODED-LOW-MOBILE | `g4-solid-figures/2.1.0/smoke/cube-exploded__LOW__mobile.png` |
| REF-SOLIDS-PRISM-LOW-MOBILE | `g4-solid-figures/2.1.0/smoke/prism-rebuilt__LOW__mobile.png` |

These are software-GL captures, valid for composition and labels only.

| Quality | Target | Judged against |
| --- | --- | --- |
| Local relevance | **BEAT** | CIRCUIT-OVERVIEW, SOLIDS-EXPLODED-HIGH |
| Cause→consequence legibility | **BEAT** | CIRCUIT-CURRENT-MOTION |
| Reach on LOW / FALLBACK_2D | **BEAT** | SOLIDS-EXPLODED-LOW-MOBILE, CIRCUIT-FALLBACK2D |
| Cutaway / exploded clarity | MATCH+ | SOLIDS-EXPLODED-HIGH |
| Camera choreography | MATCH+ | SOLIDS-EXPLODED-HIGH motion sheet |
| Guided pacing / panel coherence | MATCH+ | CIRCUIT-CURRENT-MOTION, SOLIDS-PRISM-LOW-MOBILE |
| Label legibility | MATCH+ | CIRCUIT-OVERVIEW, CIRCUIT-FALLBACK2D |
| "Wow moment" (correct) | MATCH+ | SOLIDS-EXPLODED-HIGH |
| Model detail / scene readability | MATCH | SOLIDS-EXPLODED-HIGH, SOLIDS-PRISM-LOW-MOBILE |

**Deliberate trade-off:** material realism is not pursued, because the brief rejects photoreal terrain and fluids.

## Review scenarios (22, tied to S1–S9)

**Overview and guided:**

- hydro-overview
- hydro-guided-meet-to-water (motion)
- hydro-guided-trace-partial
- hydro-guided-name-chain

**Structure and process:**

- hydro-process-water-starts (motion)
- hydro-cutaway-powerhouse (motion)
- hydro-exploded-unit (motion)

**Variables:**

- hydro-variable-rainy-full (motion)
- hydro-variable-flood-cap (motion)
- hydro-variable-dry-drop (motion)

**Faults:**

- hydro-fault-dry-all-units
- hydro-fault-zero-units-dark (motion)
- hydro-fault-overload-trip (motion; no dimming frame allowed)
- hydro-fault-shed-restore (motion)

**Challenge:**

- hydro-challenge-start
- hydro-challenge-intuitive-fail
- hydro-challenge-solved (motion)

**Assessment:**

- hydro-assessment-trace
- hydro-assessment-generator
- hydro-assessment-dry-output
- hydro-assessment-repair (motion)
- hydro-assessment-all-passed

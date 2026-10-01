# v1.1 experience delta: mount-coffee-hydropower

Author: `lab-experience-director`, 2026-10-01. This amends [02-EXPERIENCE_STORYBOARD_AND_BENCHMARK.md](02-EXPERIENCE_STORYBOARD_AND_BENCHMARK.md). Where the two conflict, [05-V1_1_PEDAGOGY_DELTA.md](05-V1_1_PEDAGOGY_DELTA.md) governs.

*Builder note: the breaker MW values below (6 / 48 / 32) and the "P0 still stands" remark in S8 describe the v1.0 model. The founder fixed the P0 on 2026-10-01 with smaller feeder blocks; the block model is specified in `06-V1_1_SIMULATION_DELTA.md` and supersedes those values.*

## What the founder saw (v1.0)

- **HIGH desktop:** flat grey boxes in a navy void, water as blue slabs, crowded label pills (`round-1-e09cb4ee-final-camera-fit/hydro-assessment-all-passed__HIGH__desktop.png`).
- **HIGH mobile:** the scene is about 6% of a 3,279-px page. About 45 stacked part and trace buttons follow it, and every cause is a slider far from its consequence (`round-1-a6caa9ad-spillway-cues/hydro-variable-flood-cap__HIGH__mobile.png`).
- **FALLBACK_2D** is the most legible profile. v1.1 must not regress it.

## 1. Storyboard

### Camera (RX-005)

v1.0 limits were yaw ±1, pitch −0.4..0.8 and distance 4–20.

- **Explore limits:**
  - yaw −1.75..+1.75 rad
  - pitch +0.02..1.25 rad, never below a water surface
  - distance 2.5–28
  - target clamped to the box x −6..8, y −0.5..3, z −3..3
- **Guided limits:** ±0.35 rad yaw and ±0.2 rad pitch around the step preset. A "Recentre" chip appears when the view is more than 0.5 rad off the preset.
- **Input:**
  - one-finger drag orbits with damping 0.12
  - pinch or wheel zooms
  - two-finger pan stays inside the box
  - double-tap or Enter focuses a part
- **Framing:** presets frame a bounding box and refit in portrait. Vertical FOV is about 45° on desktop and 55° in portrait.
- **"Follow the water" rail:** river gauge → intake → penstock → runner → tailrace/river.
  - Each leg is 1.4 s, cubic in-out, and holds until the learner taps Next or presses → / Space.
  - "Skip to end" is offered. The full rail runs under 8 s.
- **"Follow the power" rail:** switchyard → towers with the ≈30 km break → city.
- **Reduced motion:** 200 ms crossfade cuts.

### HUD: the scene is the interface

- **Desktop:**
  - The scene runs full-bleed.
  - Top-left chips: Season · Power made vs Power asked for (two MW bars) · Grid Stable / TRIPPED.
  - Bottom-centre: a one-line task card with Next.
  - Right: a 320 px translucent, collapsible column for the explanation and mode tabs.
- **Mobile portrait:**
  - The scene is sticky at the top, at least 58vh.
  - A bottom sheet snaps to a 96 px peek (task and status chips), half, or full.
  - The consequence stays visible while the learner operates (closes G7).
  - Part and trace buttons move to a "Parts and traces" drawer, keeping their names and tab order.

### In-scene controls

Each control dispatches the same `set-variable` as its panel twin. Each is an actionable render-list part with a FALLBACK_2D target of at least 44 px.

- **River-gauge post (upstream bank), "Choose a season to test":**
  - Five bands: Dry 49 · Early rains 176 · Heavy rains 303 · Rainy full 430 · Flood 557.
  - The post's water line follows `riverFlow`.
  - The post stands clearly upstream of the pond. The headpond has its own fixed plate: "Operating level — stays the same".
- **Powerhouse control desk:**
  - Four unit lamps, plus "Start next unit" and "Stop last unit".
  - The first tap or focus previews: the next unit pulses and the label reads "Confirm: start Unit 2". A second tap confirms.
  - The preview cancels after 4 s and is presentation only (IGNORED).
- **Switchyard feeder breakers:**
  - Lever cabinets. The lever pose follows the feeder variable, and the city is in the same frame.
  - A main-protection indicator follows `tripped`.

### Scenes

LOW uses the existing WebGL path with the same in-scene parts. FALLBACK_2D uses the SVG of the same render list.

| Scene | HIGH | LOW / FALLBACK_2D |
| --- | --- | --- |
| S1 Meet the plant | 1.6 s establishing ease from the upstream gauge to the valley; the eye lands on a narrow pond fed by the river; daylight, light haze | Valley preset; highlights carry the names |
| S2 Trace the water | "Follow the water" rail, then trace nodes floating at least 44 px above the surfaces | Same stops as highlight steps; 2D numbered nodes |
| S3 Inside the unit | Cutaway with context fade, then vertical explode; runner (blades) and generator (drum) clearly different in shape | Removed-parts cutaway; 2D vertical stack |
| S4 Rainy, then flood | "Will flood water make more than 88 MW?" The learner taps Flood; spill crosses the gates and rejoins the river; HUD stays at 88; safety line shown | Spill path and arrow |
| S5 Dry season (wow 1) | "Will the headpond drop?" Tapping Dry exposes banks and sandbars and narrows the river (0.9 s ease); pond unchanged; head marker reads ≈23.1 m | Narrower 2D river band, unchanged pond |
| S6 Overload (wow 2) | "Follow the power" rail; demand above supply trips the grid (red indicator, city off in one 150 ms step, all water spills); shedding restores it | 0/1 emissive; grey feeders |
| S7 Name the chain | Camera eases back down the chain; each link highlights in order | Same lines |
| S8 Challenge | Daylight, never night; operated in the scene at the gauge, desk and breakers | Button-completable |
| S9 Assessment | Each check frames its own preset; dry-output prompt per 05 | All five checks by touch, mouse and keyboard |

## 2. Water language (state → look; the renderer computes nothing)

- **Rivers:**
  - Channel width = f(`riverFlow`): 0.45× (dry) to 1.15× (flood) of the rainy width, with bank decor keyed to the flow step.
  - Downstream width = f(`turbineFlow` + `spillFlow`) = f(`riverFlow`), so downstream always matches upstream.
  - Surface speed is mild (0.6–1.0×) and secondary to width.
- **Headpond:** fixed level, narrow, with visible inflow. Approach current lines to the intake scale with `turbineFlow`.
- **Penstocks:** closed steel pipes, never shown "half full". A unit's share shows at the intake vortex and at the tailrace boil (plume width and foam).
- **Generating vs idle unit:**

| Cue | Generating | Idle (on, no water) |
| --- | --- | --- |
| Status lamp | green | amber "ON — no water" |
| Runner | constant spin, never faster with flow | still |
| MW plate | `unitPower` | 0 MW |
| Tailrace boil | present | flat |
| Intake | current | calm |
| Output | yellow bus pulses | none |

- **Other unit states:** off = dark lamp; tripped = red lamp and still runner; out-for-repair = open hatch and hazard band.
- **Spill:** a sheet over the gate crest, with thickness and foam from `spillFlow` and at most 40 spray particles. Pale blue-white, never yellow, visibly rejoining the river.
- **Never:** rain, headpond level change, motion on inactive flows, lightning, sparks, explosions, or electricity drawn as a surface. Electricity is thin yellow dashes on conductors only.
- **Particles:** spray and boil ≤ 80, electric pulses ≤ 72, total ≤ 200.
- **Determinism:** shader time comes only from the runtime clock.

## 3. Immersion reference benchmark

| Id | Source | Approval |
| --- | --- | --- |
| REF-HYDRO-V1-HIGH-DESKTOP | `artifacts/lab-review/mount-coffee-hydropower/1.0.0/round-1-e09cb4ee-final-camera-fit/hydro-assessment-all-passed__HIGH__desktop.png` | prior-lab, the "before" |
| REF-HYDRO-V1-FLOOD-HIGH-MOBILE | `.../round-1-a6caa9ad-spillway-cues/hydro-variable-flood-cap__HIGH__mobile.png` | prior-lab |
| REF-HYDRO-V1-FLOOD-2D | `.../round-1-a6caa9ad-spillway-cues/hydro-variable-flood-cap__FALLBACK_2D__desktop.png` | prior-lab, the floor that must not regress |
| INSP-PHET-ENERGY-FORMS | PhET "Energy Forms and Changes" | **requires founder approval**; study only |
| INSP-CIECHANOWSKI | Bartosz Ciechanowski explorables ("Mechanical Watch", "Airfoil") | **requires founder approval**; study only |
| INSP-SMITHSONIAN-VOYAGER | Smithsonian Voyager guided 3D tours | **requires founder approval**; study only |

Inspiration captures stay outside the repo. No assets, layouts or code are copied.

| Quality | Judged against | Target |
| --- | --- | --- |
| Water realism under state | V1-HIGH, V1-FLOOD-MOBILE, CIECHANOWSKI | BEAT v1, MATCH inspiration |
| Depth/atmosphere | V1-HIGH, VOYAGER | MATCH |
| In-scene operability | V1-FLOOD-MOBILE, PHET | BEAT |
| Camera choreography | VOYAGER, V1-HIGH | MATCH |
| Cause→consequence legibility | PHET, V1-FLOOD-MOBILE | BEAT |
| Idle vs generating legibility | V1-HIGH | BEAT |
| LOW/2D and offline reach | V1-FLOOD-2D, PHET | BEAT |
| Local relevance | all | BEAT |

## 4. Generic (RX-005, every lab) vs hydro-specific

**Generic:**
- three.js HIGH renderer on the unchanged `buildRenderList`.
- Lighting, sky, fog and shadow tiers.
- Procedural textures.
- Quantity-bound surface-flow primitive; inactive flows render empty and still.
- Quantity-bound spray/burst emitters.
- In-scene control parts that dispatch `set-variable`, with accessible name, tab order and 2D target.
- Pending-action preview.
- Widened constraints with a target box, focus-on-part, aspect-fit presets, and camera rails with reduced-motion snap.
- HUD overlay, bottom sheet and parts drawer.
- Quantity gauges (G2), status lamps (G3), output-driven poses (G4) and state-aware prompts (G5).
- Label collision layout.
- Virtual-clock shader time.
- CI counting of triangles, draw calls and particles.
- Context loss falls to FALLBACK_2D.

**Hydro-specific:** geometry, the gauge post and bands, desk dispatch order, breakers, the head marker, the 30 km break, the mapping of water parameters, and seasonal bank decor.

**Open runtime gaps:**
- G4 (output-driven poses).
- G8 (trip latching; model decision).
- FALLBACK_2D view-box zoom for rail stops is unconfirmed.

## Review scenarios to add

All are motion scenarios except `desk-preview` and `mobile-sheet-peek`.

- `hydro-v11-follow-water`
- `hydro-v11-gauge-dry`
- `hydro-v11-desk-preview`
- `hydro-v11-dry-idle-units`
- `hydro-v11-breaker-trip` / `-shed`
- `hydro-v11-flood-spill`
- `hydro-v11-mobile-sheet-peek`

## Not reviewed

- 03 and 04 specs.
- RX-005 (none exists yet).
- RX-001's scope for output-driven poses.
- `WebGLScene`/`Fallback2D` source, including whether 2D supports zoom.
- Motion sheets and live input.
- three.js fit within the budgets on real GPUs.
- Prior circuit and solids captures.
- The inspiration references: none opened, none approved.

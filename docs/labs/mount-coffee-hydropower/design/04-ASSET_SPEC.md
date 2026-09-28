# Asset spec: `mount-coffee-hydropower`

Author: `lab-asset-director`, 2026-09-28. Recorded by LAB-BUILDER. Builder merge decisions are marked **[builder]**.

## Source decisions

**Every component is procedural** (`LiberiaLearn-original`, 0 bytes, offline). There are no glTF, generated, texture or font assets.

- **glTF runner: rejected.** It would need a loader runtime extension, per-profile LODs, 2D silhouettes and a decoder, and the pedagogy doesn't need it. The assessment only asks learners to tell turbine from generator and to know the order runner → shaft → rotor.
- **Generated 3D: rejected.** There is no instructional need, and it would carry a terms and human-accuracy burden for no gain.
- **Spheres: none.** Each one costs 768 triangles for nothing here.

## Art direction

Stage: radial gradient `#263d72` → `#080d20`. Contrast figures were computed with WCAG luminance at shade 0.8.

| Token | Hex | Use |
| --- | --- | --- |
| water-body | `#2f8fe8` (opaque) | headpond, tailrace, river |
| flow-water | `#67e8f9` | water flows |
| flow-spill | `#cffafe` | spillway |
| flow-electric | `#facc15` | power line and feeders (yellow means electricity only) |
| concrete | `#c9c2b4` | dam, piers; powerhouse at 0.55 opacity (a "section model") |
| gate-steel | `#9fb2c6` | spillway gates |
| steel-light | `#aab4c0` | towers, switchyard |
| pipe-steel | `#6f86a0` at 0.6 | penstocks (translucent so particles read inside at 4.3:1) |
| steel-dark | `#5f6d7e` | shaft, intake, dividers |
| stainless | `#cfe0ea` | turbine runner (cool) |
| copper | `#ee8f52` | generator rotor (warm; hue split from the runner) |
| machine-teal | `#5fb8a8` | unit housings |
| terrain-forest | `#4a7a45` | valley floor |
| terrain-laterite | `#b06a42` | upper bank |
| building-unlit | `#7a869a` | homes, shops (lit vs unlit 5.3:1) |
| building-hospital | `#96a3b6` | hospital (lit vs unlit 3.9:1) |
| sign-blue | `#2f6fe0` | hospital sign |
| h-white | `#f8fafc` | "H" (never a red cross, a protected emblem) |
| gauge-made-off | `#8c9ab0` | supply gauge segments |
| gauge-asked-off | `#c98a4b` | demand gauge segments |
| gauge-plate | `#1b2540` | gauge backing |

- **Recorded trade-offs:** water-body is 2.1:1 against the stage centre (framed by the bank and dam), and the pipe silhouette is 1.5–2.0:1 (chosen so the particles inside are legible).
- **CVD:** water cyan and electric yellow separate on the blue–yellow axis and never overlap.
- **Shared-runtime palette gate [builder]:** the initial `#7dd3fc` / `#f0f9ff` flow pair did not maintain ΔE00 20 from the selected inactive-flow token while also keeping the shared fuchsia highlight ΔE00 25 away. The updated water and spill colours pass both gates against `INACTIVE_FLOW_COLOR = #779ab2` and `HIGHLIGHT_COLOR = #f0abfc`.
- **Materials:** roughness and metalness are recorded as contract data only. The renderer reads colour, opacity and emissive, and uses one fixed lighting rig.
- **Cutaways:** a cut part is a neutral ghost and revealed parts are saturated. LOW hides the cut parts. Translucent parts are authored back to front: penstocks, powerhouse, stator.
- **Labels:** off by default in `valley`, and guided highlights name the parts.

## Budgets (at the asset director's estimate, before RX-002/003)

| Profile | Items | Triangles | Draws (after RX-002) | Particles |
| --- | --- | --- | --- | --- |
| HIGH | 55 | 2,144 / 100k | 58 / 120 | 162 / 200 |
| STANDARD | 55 | 2,144 / 60k | 58 / 90 | 90 / 120 |
| LOW | 33 | 868 / 15k | 36 / 40 | 36 / 48 |
| FALLBACK_2D | 55 SVG | 0 | 0 | 54 / 72 |

**LOW cannot fit the locked 40-draw budget without flow batching (RX-002).** A HIGH that keeps its detail needs decor that is skipped at LOW (RX-003).

**LOW cut order, if a measurement exceeds the budget:**

1. tower-2/3 → decor
2. H strokes → decor
3. bank-upper → decor
4. hospital-sign → decor

Instructional parts are never cut.

## LOD, compression, offline

- **LOD:** runtime LOD only: full or low mesh detail, decor skipped at LOW, 2D convex hulls. Never spheres.
- **Compression:** Draco, Meshopt, KTX2 and fonts are all not applicable. Any future binary asset would use Meshopt and KTX2 ETC1S, and would need a loader runtime extension first.
- **Offline:** `offline.remoteAssets: []`, `maxPackageBytes` 96 KB. Any URL is P0.

## Reusable library contributions (future shared work)

- Material tokens (`fidelity/materials.ts`)
- Builders: `cylinderBetween`, `segmentGauge`, `feederBlock`, `transmissionTower`, `lineBreakSymbol`, `rotatingMachineStack`, `terrainStrip`
- The "section-ghost" cutaway treatment
- Water, spill and electric flow styles

## Shared runtime findings raised by the asset director

| Severity | Finding | Disposition |
| --- | --- | --- |
| P0 | LOW draw calls cannot pass without RX-002 | RX-002 |
| P1 | Decor not skipped at LOW | RX-003 |
| P1 | Warm emissive highlight pulse reads as "dimly lit" (misconception 7) | RX-004 |
| P1 | 2D emissive halos merge on adjacent gauge segments | Round-1 review item |
| P1 | Spin on axisymmetric parts is invisible | RX-001 amended; **[builder]** each unit gets an off-axis pole-marker tell part |
| P2 | Inactive-flow grey `#64748b` has low contrast | Folded into RX-002 (`#94a3b8`) |
| P2 | Label density in `valley` | — |
| P2 | Material fields are ignored by the renderer | — |

## [builder] merge with the simulation spec

The simulation spec models `uN-runner/shaft/generator` for all four units. The asset spec details only unit 3. Resolution:

- **Every unit** gets a visible housing plus an off-axis pole marker, and the two form its motion group. The simulation writes the status on `unit-N` (housing) and `unit-N-marker`.
- **Unit 3** also has the internal stack: `u3-runner`, `u3-shaft` and `u3-generator`. This one stack is revealed by the `powerhouse-section` cutaway and is used by `find-generator` and `repair-unit-3`. Its parts are part of unit 3's motion group.
- Checks and trace are otherwise unchanged. `find-generator` targets `u3-generator`, and the trace still follows unit 1's water path. **Disagreement recorded:** the simulation architect targeted `u1-generator`. The builder moved it to unit 3 to keep one detailed stack under the LOW budget. There is no curriculum or science impact, because every unit is identical. Precedence: experience quality and accessibility (LOW reach).

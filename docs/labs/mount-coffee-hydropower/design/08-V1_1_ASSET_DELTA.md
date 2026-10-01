# v1.1 asset delta: mount-coffee-hydropower

Author: `lab-asset-director`, 2026-10-01. Amends [04-ASSET_SPEC.md](04-ASSET_SPEC.md).

*Builder verification (2026-10-01):*
- *three.js 0.186.1, tree-shaken to the classes RX-005 uses and measured with esbuild, is **568 KB min / 145 KB gzip / 119 KB brotli**. That is within the director's 130–170 KB gzip estimate.*
- *The current LOW baseline is already **38 of 40** draw calls, which confirms the LOW draw-call P0 below.*
- *COMMISSION.md cites Voith for "four vertical-shaft Francis turbines", which answers the turbine-type question.*

## Decision: everything procedural

- No glTF, no generated assets, no texture files, no fonts.
- The runner and generator are told apart by procedural geometry: a lathe hub with swept blades vs a ribbed drum.
- three.js (MIT) is a **code dependency**, recorded under RX-005. It is not an asset.

## Components

All procedural, `LiberiaLearn-original`, 0 B. "Inst" means instanced.

| Component | HIGH | STANDARD | LOW | FALLBACK_2D |
|---|---|---|---|---|
| Dam | Extruded ogee profile + waterline stain | no stain | Prism | Polygon |
| Spillway gates + spill sheet | Inst gates; curved sheet ribbon | fewer segments | 1 gate + spill line | Path + arrow |
| Headpond | Narrow fixed-level ribbon with inflow | same | Fixed prism | Fixed band |
| Rivers, banks, sandbars | Spline ribbons; sandbars sit under the surface | same | Width-posed prisms + bank band | Width-posed bands |
| Intakes, penstocks ×4 | Inst; penstocks **opaque** steel | same | 1 + 1 | Lines |
| Powerhouse + cutaway | Shell, clip, cut-face cap | same | Hidden when cut | Hidden when cut |
| Unit 3 stack | Runner: hub, crown, band, 13 swept blades; shaft; generator: ribbed drum, 24 poles, stator ring | 9 blades, 12 poles | Cone runner, cylinder generator | Distinct silhouettes |
| Units 1–4, lamps, markers | Inst; lamps not tone-mapped | same | Items | Shapes + text |
| Control desk | Box, inst lamps | same | Items | 44 px targets |
| River-gauge post, 5 bands | Post, inst bands, waterline from `riverFlow` | same | Items | 5 × 44 px targets |
| Level plate, head marker | Plate + "≈23.1 m" dimension line | same | Panel + marker | Text + line |
| Switchyard, breakers | `breakerCabinets(n)` + protection lamp | same | n items (needs RX-006) | n targets, two rows if n > 6 |
| Towers, 30 km break | Inst lattice towers | same | Tower-1 + break | Lines |
| City, hospital | Inst houses, blue "H" (never a red cross) | same | 4 items | Shapes |
| Terrain | 128×64 vertex-coloured heightfield | 96×48 | none (decor) | Ground band |
| Sky, haze | Gradient + FogExp2 | Gradient + linear fog | Existing stage | Existing |
| Vegetation | 400 inst trees | 200 | none | none |

## Water (HIGH and STANDARD)

- **Shader:** one original `SurfaceFlowMaterial` on spline ribbons. No reflections, refraction targets or fluid simulation.
- **Uniforms**, each eased toward a render-list value:

| Uniform | Meaning |
|---|---|
| `uWidth` | channel width |
| `uActive` | 0 means no scroll and no foam |
| `uRate` | 0.6–1.0×, secondary to width |
| `uFoam` | foam amount |
| `uTime` | virtual clock only; frozen under reduced motion |

- **Look:** HIGH uses 2-octave noise normals, fresnel to the sky colour, and deep→shallow colour across the channel. STANDARD uses 1 octave and a flat foam band.
- **Headpond:** surface params are constant; a test asserts this.
- **Spill sheet:** shown only when `spillFlow` > 0, with at most 40 spray particles.
- **Tailrace boil and intake vortex:** per-unit decals sized by the unit's share.
- **LOW:** river width via pose transitions on `riverFlow`; unit share and spill via flow state.
- **FALLBACK_2D:** the same as SVG band widths; spill as path + arrow.

## Materials, light, shadow, textures

**Materials**
- HIGH: `MeshStandardMaterial`. STANDARD: `MeshLambertMaterial`.

| Material | Colour | Settings |
|---|---|---|
| Concrete | `#c9c2b4` | r0.9 |
| Penstock steel | `#6f86a0` | m0.6 |
| Runner stainless | `#cfe0ea` | m0.85, r0.3 |
| Rotor copper | `#ee8f52` | |
| Terrain: forest / laterite / rock | `#4a7a45` / `#b06a42` / `#7c7468` | vertex colours |
| Cut faces ("section cream") | `#efe6d2` | |

- Proposed tokens: `water-deep #1d5fa8`, `water-shallow #2f8fe8`, `sandbar #d6c29a`. Sandbar vs water-deep is about 3.7:1, to be verified by test.

**Lighting:** HIGH uses hemisphere + one sun (always daylight) with ACES tone mapping. STANDARD uses hemisphere + sun.

**Shadows:** HIGH has one 2048² PCF map, redrawn only on state change. STANDARD uses blob quads. LOW and 2D have none.

**Textures:** generated at runtime, 0 B on disk.
- Water normal: 512 (HIGH) / 256 (STANDARD).
- Blob shadow: 128.
- Plate text atlas: 1024 / 512, or use DOM labels for 0 B.

## Budget (estimates, except the measured three.js size)

| Item | HIGH/STD | LOW | 2D |
|---|---|---|---|
| three.js core, tree-shaken | **145 KB gzip (measured)** | 0, code-split | 0 |
| RX-005 adapter + shaders | ≈ 15 KB gzip | 0 | 0 |
| Loaders, glTF, textures | 0 | 0 | 0 |
| Definition | ≈ 45–55 KB | same | same |
| **Total vs limit** | **≈ 0.75 MB / 5 MB** | ≈ 55 KB / 1.5 MB | ≈ 55 KB / 300 KB |

| Worst scenario | Triangles | Draws | Particles |
|---|---|---|---|
| HIGH | ≈ 61k (+ ≈ 25k on shadow refresh) / 100k | ≈ 57 (+ ≈ 30 on shadow refresh) / 120 | 152 / 200 |
| STANDARD | ≈ 37k / 60k | ≈ 57 / 90 | 104 / 120 |
| LOW | ≈ 1.5k / 15k | **≈ 59 / 40 unbatched; ≈ 18 with RX-006** | ≤ 44 / 48 |
| 2D | | | ≤ 66 / 72 |

## Shared (RX-005 library) vs hydro-only

**Shared:**
- the three.js adapter
- the `daylight-outdoor` rig (later also a `studio-indoor` rig)
- sky and haze tiers
- the shared material set
- `SurfaceFlowMaterial`
- spray and boil emitters
- section cutaway + cut-face shading
- status-lamp material
- builders: lathe, spline sweep, heightfield, instanced scatter, lattice tower, `bladedRunner`, `rotatingMachineStack`, `selectorPost`, `leverCabinet(n)`, `pushButton`
- runtime texture generators
- **RX-006**: LOW instanced batching with CPU picking

**Hydro-only:** the river spline, dam profile, sandbars, band values, width table, head marker and unit layout.

## Provenance rows (`production.json` assets)

Every row is `kind: procedural`, `license: LiberiaLearn-original`, `bytes: 0`, built by hand-authored runtime builders.

| id | profiles | maxTexturePx |
|---|---|---|
| `procedural-waterways-v11` | all | 512 |
| `procedural-civil-v11` | all | 0 |
| `procedural-machinery-v11` | all | 0 |
| `procedural-instruments-v11` | all | 1024 |
| `procedural-grid-v11` | all | 0 |
| `procedural-valley-decor-v11` | HIGH, STANDARD | 256 |

## Risks

- **P0 · ASSET:** LOW needs about 59 draws against a limit of 40. RX-006 instancing fixes it. Without RX-006, cut in this order: pylons 2–3, the hospital sign, the desk body, then breakers into one row. Never cut instructional parts.
- **P1:** `measureLabBudget` models WebGL draw calls. Addressed for RX-005: LOW uses its batch planner; HIGH/STANDARD count Three.js item, environment-ground, flow-line, active-particle and marker draws. GPU-backed comparison with `renderer.info` remains future device validation.
- **P1:** three.js must be a dynamic `import()` for HIGH/STANDARD only. Precompile shaders behind the loading state.
- **P1:** re-run palette contrast against the sky and terrain.
- **P1:** red/green lamps alone fail colour-vision checks; pair them with text and glyphs.
- **P1:** HIGH-only cues (vortex, boil, sandbars) need LOW/2D equivalents in `instructionalView`.
- **P2:** turbine type. Answered: Francis (Voith, per COMMISSION.md).
- **P2:** every baseline metric grows more than 5%, so `budget-baseline.json` needs a reviewed update. This was measured and dispositioned below for the shared parametric descriptors.

## Trade-offs to record

- No glTF.
- No reflection or refraction.
- STANDARD has no real-time shadows.
- Penstocks are now opaque, reversing v1.0.
- The shared environment contract selects DAYLIGHT for Mount Coffee and STUDIO by default for circuits and solids. LOW uses a CSS backdrop; FALLBACK_2D uses the same palette in SVG.

## RX-005 / RX-006 implementation evidence (2026-10-01)

Mount Coffee now consumes shared pipe, generator-housing and lattice-tower kits. Its declarative geometry variants add 2,767 UTF-8 bytes to the offline definition manifest (25,929 → 28,696 bytes); `measureLabBudget` reproduced 28,696 bytes for all four profiles. The baseline records that measured addition. It remains well below the 300 KiB FALLBACK_2D manifest ceiling and adds no remote asset. The existing all-profile budget test is the evidence source; this entry is not a physical-device performance claim.

The renderer-aware HIGH/STANDARD draw-call estimate is 64 for Mount Coffee, up from the legacy estimate of 47. The old formula counted three shared flow batches; Three.js issues one draw for each flow line, each active particle system and the environment ground. The corrected 64 remains below HIGH (120) and STANDARD (90) limits. `lab-budgets.test.ts` verifies the new accounting and baseline; this software estimate is not physical-device performance evidence.

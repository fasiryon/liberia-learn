# RX-005: Immersive HIGH renderer (three.js) and scene-first interaction

- **Status:** PROPOSED. Awaiting `lab-performance-reviewer` and `lab-design-director` review.
- **Filed by:** LAB-BUILDER on 2026-10-01, after the founder review of `mount-coffee-hydropower` 1.0.0 (`HYDRO-FOUNDER-IMMERSION-001`). The founder decided to adopt three.js as the HIGH-profile renderer **for every lab**, with LOW and FALLBACK_2D unchanged.
- **Runtime:** Interactive Lab Runtime V2, high-fidelity layer. Everything here is shared; nothing is lab-local.
- **Design inputs:**
  - `docs/labs/mount-coffee-hydropower/design/05-V1_1_PEDAGOGY_DELTA.md`
  - `06-V1_1_SIMULATION_DELTA.md`
  - `07-V1_1_EXPERIENCE_DELTA.md`
  - `08-V1_1_ASSET_DELTA.md`
- Companion: RX-006, LOW instanced batching (below).

## Problem

Every HIGH lab today renders through a ~270-line hand-written WebGL pass (`WebGLScene.tsx`):
- one directional light, Lambert shading and a weak specular;
- flat colours, with no sky, fog, shadow or texture;
- primitive meshes only;
- flows drawn as 1-px `gl.LINES` with square `gl.POINTS` particles.

Camera constraints are narrow, and nearly every cause is a slider in a side panel. The result is correct and accessible, but it reads as a 2D diagram.

This was a deliberate v1.0 trade-off for TARGET_LOW_DEVICE. It holds for LOW, but it caps HIGH far below the "immersive" bar that the founder set for every lab.

## What stays fixed

The contract in `HIGH_FIDELITY_INTERACTIVE_LABS.md` is unchanged except for the amendment to principle 10 below. In particular:
- `SimulationModel` decides every quantity. The renderer computes no consequence.
- `buildRenderList` is the single source for every profile, and `instructionalView` stays identical across profiles.
- Evidence classification is unchanged. Only `check` produces evidence, and nothing writes mastery.
- LOW keeps `WebGLScene` and FALLBACK_2D keeps the SVG renderer. Every check stays completable on both, by touch, mouse and keyboard.
- Offline: no remote assets, and every asset is inside the profile's package budget.
- Captures stay deterministic on the virtual clock.
- **There is still no unconstrained free camera.**

## Capability (seven parts, one extension)

### RX-005a: three.js renderer for HIGH and STANDARD
- New `components/interactive-labs/v2/ThreeScene.tsx`. It consumes the same `RenderList` as `WebGLScene` and `Fallback2D`.
- `three` (MIT) is the only new runtime dependency. It is **dynamic-imported only when the resolved profile is HIGH or STANDARD**, so LOW and FALLBACK_2D devices never download it.
- No React Three Fiber, no physics, no postprocessing chain in V1.
- Render tiers, taken from `RenderBudget.lighting`:

| Profile | Lighting | Shadows | Sky / atmosphere | Materials |
| --- | --- | --- | --- | --- |
| HIGH | Hemisphere + sun | one 1024–2048 px shadow map, sun only | gradient sky dome + exponential fog | `MeshStandardMaterial`, procedural and declared textures |
| STANDARD | Hemisphere + sun | none (contact-shadow blob decals) | sky dome + fog | `MeshLambertMaterial` |

- Mesh sources:
  - the existing procedural `GeometryKind`s, built once and cached;
  - optional declared glTF assets per component (§ asset contract), loaded from the app bundle, never a remote URL.
- Clipping: cutaways use three.js clipping planes from `item.clip`. Highlight and rim use the RX-004 material rules, ported.
- Labels stay DOM, using the existing overlay, plus a shared collision-avoiding layout.
- Downgrade chain: context loss goes straight to FALLBACK_2D. Sustained slow frames step HIGH → STANDARD → LOW (`WebGLScene`) → FALLBACK_2D, using the existing `shouldDowngrade` thresholds.
- `ThreeScene` disposes every geometry, material, texture and the renderer on unmount and on profile change.

### RX-005b: quantity-bound surfaces and emitters
- New spec primitives:
  - `SurfaceDefinition`: river, pond, sheet or pipe-plume.
  - `EmitterDefinition`: spray, boil or pulse.
- Each one binds visual parameters only to **simulation output quantities** declared by the model. Examples: `widthFactor`, `depthFactor`, `speedFactor`, `turbulence`, `active`.
- `buildRenderList` resolves them into `RenderSurface` and `RenderEmitter` entries. These are pure, time-free, and derived from `SimulationOutput.quantities`. **The renderer never derives a parameter.**
- An inactive binding renders an empty, still surface and no particles, consistent with the inactive-flow rule.
- Surface motion, such as scrolling normals or foam, uses `t` only from `useDisplayFidelity` / the review clock, so captures stay deterministic.
- LOW draws a surface as a flat, flow-width-scaled ribbon in the existing pass. FALLBACK_2D draws a width-scaled SVG band. Both show the same quantities.
- Emitters count against the existing per-profile particle budget.

### RX-005c: in-scene controls
- A `ComponentDefinition` may declare `control`, as one of:
  - `{ kind: "set-variable"; variableId; value }`;
  - `{ kind: "step-variable"; variableId; direction: 1 | -1 }`.
- Examples: gauge bands, breaker levers, "start next unit" buttons.
- Activating the part dispatches exactly the `set-variable` action its panel twin dispatches, through `acceptLabAction`, so validation and evidence classification are unchanged.
- Optional `confirm: true` gives a two-step activation. The first activation shows a **presentation-only pending preview** (classified IGNORED, never sent to the events route). The second activation dispatches. The preview cancels after 4 s.
- Every control part has:
  - an accessible name;
  - a place in the tab order (Enter or Space to activate);
  - a FALLBACK_2D target of at least 44 px;
  - a duplicate in the panel or drawer.
- The authoring gate rejects a control whose variable or value is invalid.

### RX-005d: camera choreography
- `CameraConstraints` gains an optional `targetBox: { min: Vec3; max: Vec3 }`, and per-mode limits (`explore`, `guided` offset).
- Presets gain an optional `frame: { componentIds }`, so presets refit for any aspect ratio.
- A new `CameraRail`: an ordered list of preset ids with per-leg duration and easing, advanced by the learner (Next, → or Space), with Skip. Guided steps can reference a rail.
- Rails are presentation (IGNORED). Reduced motion becomes 200 ms crossfade cuts.
- Every rail stop must satisfy the lab's constraints, which the authoring gate checks.
- **Principle 10 amendment:** "There is no unconstrained free camera. Each lab declares its constraints and a target box. Within them the learner may orbit, zoom and pan; outside them the camera cannot go."

### RX-005e: scene-first player shell
`InteractiveLabPlayer` layout, shared by every lab:
- **Desktop:**
  - full-bleed scene;
  - top-left status chips from declared quantities (G2 gauges and G3 status lamps);
  - a bottom task card;
  - a collapsible 320 px explanation column.
- **Mobile portrait:**
  - the scene is sticky at ≥58vh;
  - a bottom sheet with peek, half and full snap points;
  - a "Parts and traces" drawer that holds the existing part and trace buttons, with their names and order preserved.

`LabControlPanel` content is reused, not rewritten. Keyboard and screen-reader paths keep every action.

### RX-005f: output-driven poses and status (gaps G2–G4)
- `PoseTransitionDefinition` may bind to a simulation output quantity (for example a breaker lever following a feeder state), in addition to a variable.
- Status lamps are components with `statusColors` keyed to `componentStates[id].status`.
- Both are resolved in `buildRenderList`, so they stay pure.

### RX-005g: budget and determinism enforcement
- `measureLabBudget` counts triangles and draw calls for:
  - surfaces, at their tessellation;
  - emitters;
  - declared glTF assets, using their recorded triangle counts.
- It adds the `three` chunk's gzip bytes to HIGH and STANDARD package size.
- CI keeps the 5% regression gate.
- The capture harness drives `ThreeScene` from the virtual clock. `compare-lab-captures.ts` must show byte-identical PNGs for two runs before RX-005 can be marked IMPLEMENTED.

## Asset contract

Assets are declared per component in the definition's `fidelity.assets` and recorded in `production.json` `assets` (kind, licence, provenance, bytes, profiles, maxTexturePx). The rules:
- glTF only from the app bundle (`/public/labs/<labId>/...` or a shared `/public/labs/_shared/...`), inside `offline.maxPackageBytes`.
- Every asset has a procedural fallback for LOW and FALLBACK_2D.
- A generated asset needs a generator, its terms, and a human reviewer.

The asset director's v1.1 spec (`08-V1_1_ASSET_DELTA.md`) decides which components use glTF, the texture formats, and whether any decoder is justified.

## Per-profile behaviour

| Profile | Renderer | Water | Controls | Camera | Cost |
| --- | --- | --- | --- | --- | --- |
| HIGH | ThreeScene | shaded surfaces + emitters | in-scene + drawer | widened + rails | see budget |
| STANDARD | ThreeScene (Lambert, no shadow map) | surfaces, fewer particles | same | same | ≤ STANDARD budget |
| LOW | WebGLScene (unchanged pass + ribbons) | width-scaled ribbons | same parts, picked | existing constraints + rails as cuts | ≤ LOW budget |
| FALLBACK_2D | SVG | width-scaled bands | 44 px SVG targets | rail stops as view-box framings | ≤ 300 KB |
| Reduced motion | any | static surfaces, no particles | same | crossfade cuts | |

## Evidence impact

None.
- In-scene controls dispatch the same validated `set-variable` actions as panel controls, so their classification is unchanged (RAW_OBSERVATION).
- Previews, rails and camera moves are IGNORED.
- No new event, emitter, evidence path or mastery write.

## Tests (required before IMPLEMENTED)

1. **Render list:** surfaces and emitters are pure functions of quantities. Inactive bindings produce no particles. `instructionalView` is identical across all four profiles for representative states of every registered lab.
2. **Controls:** every control part dispatches the same action as its panel twin. Invalid controls fail the authoring gate. The confirm preview never reaches `acceptLabAction`. Keyboard activation works.
3. **Camera:** rails and presets satisfy constraints and the target box. Reduced motion produces cuts.
4. **Budgets:** the measurement includes surfaces, emitters, glTF and the `three` chunk. Every registered lab stays within its locked profile budgets.
5. **Lifecycle:** dispose on unmount and on profile change (no leaked GL contexts in a 20× mount/unmount loop). Context loss goes to FALLBACK_2D.
6. **Determinism:** two capture runs byte-identical on SwiftShader for the hydro and circuit reference scenarios.
7. **Existing suites:** all existing interactive-lab suites stay green.

## Rollout

1. **Implement RX-005 in the shared runtime.** Prove it on `mount-coffee-hydropower` 1.1.0 (HERO, full three-round loop plus benchmark).
2. **Existing V2 labs** (`g4-solid-figures`, `fixture-lever`, `series-circuit-ohms-law`) pick up the HIGH renderer automatically. Each is re-captured and given a DERIVATIVE review (science, interaction, performance) before its status claims change.
3. **The 17 legacy 2D labs** migrate onto Runtime V2 under the programme in `docs/labs/IMMERSIVE_LABS_PROGRAMME.md`. Each lab inherits RX-005 at HIGH and keeps LOW and FALLBACK_2D.

## Budget

Measured or estimated in `08-V1_1_ASSET_DELTA.md`, for the hydro worst-case scenario.

| | HIGH | STANDARD | LOW | FALLBACK_2D |
|---|---|---|---|---|
| `three` chunk | **145 KB gzip / 119 KB brotli** (measured: three 0.186.1, tree-shaken, esbuild) | same chunk | **0**, never fetched | 0 |
| RX-005 adapter + shaders | ≈ 15 KB gzip | same | 0 | 0 |
| glTF / textures / loaders | 0 (all procedural; textures generated at runtime) | 0 | 0 | 0 |
| Package total vs limit | ≈ 0.75 MB / 5 MB | ≈ 0.75 MB / 5 MB | ≈ 55 KB / 1.5 MB | ≈ 55 KB / 300 KB |
| Triangles | ≈ 61k (+ ≈ 25k on shadow refresh) / 100k | ≈ 37k / 60k | ≈ 1.5k / 15k | n/a |
| Draw calls | ≈ 57 (+ ≈ 30 on shadow refresh) / 120 | ≈ 57 / 90 | **≈ 59 / 40 (fails); ≈ 18 with RX-006** | n/a |
| Particles | 152 / 200 | 104 / 120 | ≤ 44 / 48 | ≤ 66 / 72 |

The triangle, draw-call and particle numbers are estimates until RX-005g measures them. Per-renderer accounting must be checked against `renderer.info` on a `--gpu` run.

### Companion: RX-006 (LOW instanced batching)

LOW is already at 38 of 40 draw calls (`budget-baseline.json`), and v1.1 adds instructional parts: city blocks, gauge bands, desk and breakers.

RX-006 adds instanced or merged static buffers to `WebGLScene` for repeated geometry, with CPU picking from the render list. Its rules:
- Cutting instructional parts to fit is never allowed.
- Without RX-006, the asset director's cut order applies to decor only.

RX-006 is filed alongside RX-005 and reviewed with it.

## Review verdicts

*Pending.*

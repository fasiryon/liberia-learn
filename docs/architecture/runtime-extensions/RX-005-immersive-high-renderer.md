# RX-005: Immersive HIGH renderer (three.js) and scene-first interaction

- **Status:** PROPOSED.
  - Both reviewers returned **APPROVE_WITH_CHANGES** on 2026-10-01.
  - The amendments in "Review verdicts and binding amendments" (end of this document) are binding. **They supersede any earlier section they conflict with.**
  - Before implementation starts, the design director re-checks the P0 text.
  - Two founder decisions are pending.
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

### Companion: RX-006 (LOW batching)

RX-006 is now its own proposal: [RX-006-low-batching.md](RX-006-low-batching.md). The paragraph below is kept for history.

LOW is already at 38 of 40 draw calls (`budget-baseline.json`), and v1.1 adds instructional parts: city blocks, gauge bands, desk and breakers.

RX-006 adds instanced or merged static buffers to `WebGLScene` for repeated geometry, with CPU picking from the render list. Its rules:
- Cutting instructional parts to fit is never allowed.
- Without RX-006, the asset director's cut order applies to decor only.

RX-006 is filed alongside RX-005 and reviewed with it.

## Review verdicts and binding amendments

### Verdicts (2026-10-01)

| Reviewer | Verdict | Findings | Builder verification |
|---|---|---|---|
| `lab-design-director` | APPROVE_WITH_CHANGES | P0 1 · P1 13 · P2 4 | **P0-01 confirmed:** `GeometryKind` is a closed set of 8 (`lib/interactive-labs/v2/types.ts:7`). **Backdrop claim confirmed:** a dark CSS stage at `InteractiveLabPlayer.tsx:93`, with WebGL clearing at alpha 0 (`WebGLScene.tsx:163`). |
| `lab-performance-reviewer` | APPROVE_WITH_CHANGES | P0 3 · P1 9 · P2 6 | **P0-1 confirmed:** `capabilities.ts:6` defaults to 4 GB and the player passes no memory hint. **P0-2 confirmed:** `public/sw.js` caches `/_next/static/` on fetch only, and the import has no error path. **P0-3 already fixed** on `main` by PR #163 (`hasActiveVisibleFlow`), merged into this branch at `03555cb8`. **three.js size reproduced:** 568 / 145 / 119 KB. |

### A1. Parametric geometry contract (design P0-01), new RX-005h

**Core descriptors** live in `lib/interactive-labs/v2/fidelity/geometry/`. They emit plain typed arrays, have no `three` import, and each has a deterministic triangle count:
- `lathe`
- `sweep` (a tube along a spline)
- `extrude`
- `heightfield`
- `scatter` (instanced)
- `dimensionLine`

**Per-profile variants.** A component declares `variants: { HIGH, STANDARD, LOW, FALLBACK_2D }`, where the 2D entry is a silhouette. The authoring gate:
- requires a LOW variant and a 2D silhouette for every instructional component;
- requires that parts a check depends on keep distinct silhouettes on every profile (for example, runner vs generator for `find-generator`).

**Kits layer.** Shared builders in `fidelity/kits/`, made only from the core descriptors:
- machinery: `bladedRunner`, `rotatingMachineStack`
- controls: `selectorPost`, `leverCabinet(n)`, `pushButton`
- grid: `latticeTower`

**Lab data stays in the lab definition:** the river spline, the dam profile and the band values.

**glTF is contract only; the loader is deferred.** No lab may declare a glTF asset until a later extension ships the loader together with a fixture test.

### A2. Profile selection: start at the floor, upgrade on evidence (performance P0-1)

- Render FALLBACK_2D immediately, or LOW when WebGL is available.
- `import("three")` only when all of these hold:
  - `navigator.deviceMemory ≥ 4`;
  - no `Save-Data`;
  - `effectiveType` is not 2g or 3g;
  - a short LOW frame-time probe shows headroom.
- Persist the resolved profile, and any downgrade, per device and runtime version.
- A manual profile choice always wins.
- Tests:
  - hints like the target device (deviceMemory 2) resolve to LOW;
  - a spy proves the three loader is never invoked in that case.

### A3. Loader failure and offline downgrade (performance P0-2)

- **Loader failure:** both renderer loaders retry once. Then they downgrade with a notice, to LOW if that chunk is available, otherwise to FALLBACK_2D.
- **Prefetch:** while HIGH or STANDARD loads, prefetch the `WebGLScene` chunk.
- **Offline pack:** the HIGH/STANDARD offline pack is the definition + the three chunk + the `ThreeScene` chunk + the `WebGLScene` chunk.
- **Harness test:** abort the three chunk with `page.route`. The lab must land in 2D with every check completable.

### A4. Downgrade detector (performance P1-1)

- Sample only back-to-back scheduled frames. Drop the first frame after an idle gap, and any frame after an intentional skip.
- Both WebGL renderers share one sampler.
- Tests: an idle-gap sequence and a 30 fps-cap sequence must not downgrade.

### A5. GL lifecycle (performance P1-2)

- **Context loss:** both renderers handle `webglcontextlost` by calling `preventDefault`, then `onDowngrade("context")`.
- **ThreeScene unmount:** dispose geometries, materials, textures and render targets (including the shadow map), then call `renderer.dispose()` and `forceContextLoss()`.
- **WebGLScene unmount:** call `WEBGL_lose_context`.
- **STANDARD** always gets a fresh renderer with `antialias: false`.
- **Test:** 20× mount/unmount in real Chromium (Playwright), with no context warnings, and `renderer.info.memory` back at baseline.

### A6. Loop and idle policy (performance P1-3)

- **Scheduling:** use `shouldScheduleWebGLFrame`, extended with surface and emitter flags, instead of `setAnimationLoop`.
- **Frame-rate cap:** ambient-only frames (surface scroll, spin, particles) are capped at 30 fps. Camera moves and eases run at full rate.
- **Pausing:** pause on `visibilitychange` and when the scene is off-screen (IntersectionObserver).
- **Shadows:** never render the shadow pass on ambient frames.
- **Test:** the scheduling predicate is unit-tested.

### A7. Shadow policy (performance P1-4)

- `shadowMap.autoUpdate = false`. Set `needsUpdate` only when a pure hash of the caster matrices changes.
- Fit the shadow camera to the lab's `targetBox`.
- Spin groups, surfaces and emitters never cast shadows.
- The shadow map counts against `maxTexturePx`: 2048 on fine-pointer devices, 1024 otherwise.
- CI counts the worst frame as the main pass plus the shadow pass.

### A8. Budget accounting (performance P1-5, P1-6)

- **One planner:** a pure per-renderer draw and triangle planner, shared by the renderer and by `measureLabBudget`. Check it against `renderer.info` on a `--gpu` run. Measurement code never imports `three`.
- **Textures:** runtime-generated textures and the shadow map are counted per profile.
- **Bytes:** record both `transferBytes` (brotli) and `storageBytes` (minified).
- **three version and size:**
  - pin `three` to an exact version;
  - add a separate renderer-chunk size gate at 5%, measured in CI by an esbuild import-list script;
  - confirm that gate once against `next build` output.
- **Re-baseline:** one dedicated, reviewed commit that lists before and after for every lab.
- **Import-graph test:** no value import of `three` outside ThreeScene and its private modules.
- **Capture assertion:** LOW and FALLBACK_2D runs make zero requests for the three chunk. Record this in `manifest.json`.

### A9. Determinism (performance P1-7)

- Wrap time on the CPU modulo a declared, tileable period.
- Use a seeded PRNG for scatter, emitters and texture generation. Never use `Math.random`.
- In review mode:
  - compile synchronously (`renderer.compile`);
  - set `data-lab-scene-ready` after the first full frame, and make the harness wait for it.
- The harness records `data-lab-renderer` (`three@REVISION`, `webgl-pass` or `svg`) and the downgrade path in the manifest (performance P2).

### A10. Environment rigs (design P1-02)

- **Declared per lab.** `fidelity.environment` is one of:
  - `studio` (the default; existing labs keep it);
  - `outdoor-daylight`;
  - `dark-field` / `space`.
- **One backdrop token per rig** is used by all four profiles. On LOW and 2D it is CSS or SVG, at zero GPU cost.
- **Hydro uses `outdoor-daylight` on every profile.** This keeps "dark = tripped" unambiguous, and a downgrade never reads as day turning to night.
- **Contrast:** every palette and contrast gate is re-run against each rig's backdrop and terrain samples.
- **Cased lines:** flows and markers are drawn as cased lines (dark casing, light core).

### A11. Immersion acceptance checklist (design P1-03)

Every lab's round 1 checks these from its captures:
- **Stage coverage:** the scene fills at least 60% of the desktop stage and at least 58vh on mobile.
- **Environment:** the rig shows a ground plane and a horizon or backdrop.
- **Depth:**
  - the establishing preset is not frontal (pitch about 15° or more);
  - instructional parts sit on at least two depth planes.
- **Operability:** every cause can be operated in the scene, or is one tap away from the frame where its consequence appears.
- **Same-frame feedback:** every state change shows in the same frame as its control, or in a HUD chip.
- **Label budget:** outside guided focus, at most 8 labels (highlighted, hovered and step-relevant parts only). The rest go in the drawer.
- **Motion:** motion only on active flows.

### A12. Benchmark rules (design P1-04)

- **Founder decision:** approve or replace the three inspiration references. Ideally, also supply one or two examples of what "immersive" means.
- Approved reference captures are stored, git-ignored, under `artifacts/lab-review/<labId>/benchmark/` with the source URL and date.
- For immersion qualities, a BEATS against a v1.0 "before" capture does not count toward the ship rule.

### A13. LOW immersion floor (design P1-05)

At near-zero GPU cost, LOW gets:
- the rig backdrop;
- a ground plane;
- two-tone vertex-coloured water ribbons;
- cased flow lines;
- the shared shell and in-scene controls.

Anything beyond this is recorded as a deliberate LOW trade-off.

### A14. In-scene controls (design P1-06, P1-07)

- **Rail navigation:** advance only through the focused Next button, or with → when the scene has focus and no control is focused. Space is not a global rail key.
- **Pending confirm:**
  - announced via `aria-live`;
  - cancelled by Escape, blur or a Cancel target, never by a timer;
  - drawn with the highlight token and a "Confirm?" label only, never with state tokens (lamp colour, spin, boil).
- **Affordance:** a shared control-affordance token (glyph, ring and cursor) on every profile, including 2D.
- **Tap rule:** tapping a control part operates it. Inspecting it goes through the drawer or a long-press.
- **Drag control:** a new `{ kind: "drag-variable"; variableId; axis; worldRange }`.
  - It snaps to the step grid.
  - It dispatches `set-variable` only when it crosses a step boundary.
  - Arrow keys step it, and it keeps its panel twin.
- **Picking:**
  - control parts are picked by projected bounds;
  - one shared pick policy applies across profiles;
  - raycasts are restricted to selectable parts (performance P2).

### A15. Cues, salience and caps (design P1-08 to P1-10)

- **Equivalent cues:** the authoring gate requires a `lowProxy` and a `staticCue` for every surface or emitter bound to a quantity that a check or the explanation uses.
- **Reduced motion:** keep static direction chevrons on active flows and surfaces.
- **Fog:**
  - it may not push the farthest instructional part below 3:1 contrast;
  - instructional, status and emissive materials are exempt from fog.
- **Tone mapping:** status, emissive, flow and highlight materials use `toneMapped: false`, and the colour gates are evaluated on the final colour.
- **Cutaways:** parts revealed by a cutaway get fill light and do not receive shadow.
- **Decor:** a salience cap keeps decor at lower saturation and contrast than instructional parts.
- **Section caps:** clipped solids show capped faces in the shared "section cream" material, proven by a capture test.

### A16. Camera wording (design P1-11)

Proposed replacement for principle 10. **It needs founder sign-off, because it amends the platform standard.**

> "Camera. There is no unconstrained free camera. Each lab declares distance, pitch and yaw limits per mode and, if it allows panning, a target box; without one, the target follows presets only. Within those limits the learner may orbit, zoom and pan by touch, mouse and keyboard; outside them the camera cannot go. The camera never enters a solid part or drops below a declared ground or water surface. Guided steps hold the view near the step's preset and offer Recentre. Presets and rails are presentation only. No check, control or trace target may require camera freedom: each is framed by a preset or rail stop reachable in one action, and the same action exists in FALLBACK_2D."

Under reduced motion, camera moves are a 0 ms cut (the documented "snap"), not a crossfade (performance P2-1).

### A17. Shell (design P1-12, P2-18)

- **Desktop:** the explanation is open by default.
- **Mobile peek:** shows the task, the status chips and the latest causal explanation line.
- **HUD chips:** each lab declares one for every quantity that a check or the explanation depends on. Structural labs with no quantities show the task and the part-focus line instead.
- **Mobile landscape:** the scene on the left, a 40% sheet on the right.
- **Loading:** while three loads, the current state's 2D render shows under a loading veil.

### A18. 2D framing, flows and swap continuity (design P1-13, P1-14)

- **2D framing:** a preset's `frame: { componentIds }` must fit the 2D view-box. Prove it with a test and with 2D mobile captures at every rail stop.
- **Flows on HIGH/STANDARD:** screen-space-width or tube lines with round sprites, and dashed conductors.
- **Downgrade continuity:** camera, selection, rail position and pending state carry over, and a non-modal notice says "Switched to lighter graphics".

### A19. Naming, scope and documentation (design P2-15 to P2-17; performance P1-9, P2-3, P2-6)

- **Generic names:**
  - surface kinds: `channel`, `pool`, `sheet`, `plume`;
  - emitters: `stream`, `spray`, `upwell`, `bubble`, `pulse`;
  - `SurfaceFlowMaterial` is parameterised by `FlowMedium`.
- **Status lamps:** each status carries a glyph and text, not colour alone. G5 (state-aware prompts) is part of RX-005f.
- **Shader programs:** limited to the shared material set. Record `renderer.info.programs.length` on `--gpu` runs.
- **Fallback2D:** memoize hulls and isolate the particle layer.
- **Registry:** before Phase 4 of the programme, per-lab definitions load dynamically. A test proves one lab's 2D first-load set stays within 300 KB.
- **Out of scope**, deferred to later extensions:
  - ambient audio (RX-008: procedural WebAudio, off by default, never the only carrier of meaning);
  - selective bloom;
  - periodic motion bound to a quantity (needs science review against the RX-001 rule);
  - translucency for nested membranes;
  - trip latching (G8);
  - the glTF loader.

### Founder decisions pending

1. Approve or replace the inspiration references (A12).
2. Sign off on the principle 10 wording (A16).

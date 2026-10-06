# RX-006: LOW draw-call batching with per-part state

- **Status:** IMPLEMENTED. The mandatory reviewed clarifications remain binding; all eight acceptance tests are proven or explicitly dispositioned in the final closure below.
- **Filed by:** LAB-BUILDER on 2026-10-01.
- **Runtime:** Interactive Lab Runtime V2. The change is in the shared `WebGLScene` (LOW) pass only.

## Problem

- The LOW draw-call budget is 40, and `mount-coffee-hydropower` is already at 38 (`budget-baseline.json`).
- v1.1 adds instructional parts: eight city blocks, five gauge bands, a control desk and breaker cabinets. The asset director estimates about 59 draws.
- Cutting instructional parts to fit is not allowed.
- Every migrated legacy lab with many repeated parts (molecules, cells, ecosystems) hits the same limit.

## Capability

**Baseline: CPU-transformed merged opaque batches.**
- The deterministic batch key is `(geometry descriptor, material class, clip state, alpha class, winding, depth-write class)`. Items merge only when fully opaque, un-clipped, non-spinning, non-highlighted, non-isolated, and not selected. Batch membership is rebuilt when any key or visibility changes.
- Batches preserve the render-list opaque/translucent ordering and draw with the same depth and culling rules as individual items. Transparent, clipped, spinning, focused/highlighted, selected and isolated/faded parts remain individual draws.
- Every merged vertex retains its source component id in CPU metadata. Each source item's transformed vertices carry independent `color`, `emissive` and `highlight` attributes. Color/emissive/highlight changes update only that item's vertex range with `bufferSubData`; pose/transform changes rebuild only the affected batch after capacity checks.
- Batches are rebuilt only when the render list changes, never per frame.
- No per-frame allocation, following the RX-002 storage rule. This also removes today's `[...list.items].sort` and per-item `new Float32Array` on every frame.

**Per-part state survives batching.**
- Every render-list change is synchronized before draw: visibility updates membership; material/key changes move membership; pose changes rewrite the item's range; label and pick state are read from the current render list and do not live in stale GPU state.
- A city block that lights or darkens updates its own vertices' `emissive` attribute with `bufferSubData`.
- The eight city blocks are the challenge's feedback, so they must never collapse into one lit state.

**Kept as individual draws:**
- highlighted items;
- translucent items;
- clipped items;
- spinning (RX-001) items.

**Optional instancing** via `ANGLE_instanced_arrays`, with a fallback to merging when the extension is missing. It must respect the WebGL1 minimum of 8 vertex attributes.

Instancing is an optional optimization only; merged batches without ANGLE must meet the LOW budget. Both paths use the same render-list source identity and CPU picking. The planner splits before 65,536 indexed vertices on WebGL1, or uses non-indexed draws for a larger safe split. Each profile declares a maximum batch vertex count and byte capacity; buffers grow geometrically only during rebuild, retain their identities across state-only changes, and are disposed with their GL context.

**Picking** uses current visible render-list geometry, never GPU ids. Projected bounds are clipped by the viewport and occlusion policy; overlapping hit regions choose the nearest visible eligible component, then stable component-id order as a deterministic tie-break. Gauge bands and breaker rows have distinct bounds and accessible names; touch/mouse hit targets and keyboard focus map to the same component ids. Picking is independent of whether the visual mesh was merged or instanced.

**Budget.** `measureLabBudget` LOW uses the same batch planner as the renderer.

## Per-profile behaviour

| Profile | Effect |
|---|---|
| LOW | Fewer draws; identical image |
| HIGH, STANDARD | n/a (ThreeScene, RX-005) |
| FALLBACK_2D | n/a |

## Evidence impact

None. This is rendering only.

## Tests

1. **Planner:** exact draw and triangle counts match the LOW renderer, including flow, marker and every excluded item; CI fails on planner/renderer mismatch.
2. **State sync:** exercise visibility, color, emissive, focus, selection, isolation, pose, label and pick changes, including entering/leaving each excluded category; assert only the correct component changes.
3. **Challenge parity:** deterministic city-block combinations, gauge bands and breakers are captured in HIGH, STANDARD, LOW and FALLBACK_2D; assert actionable component ids and equivalent focused/selected feedback, including panel, touch, and keyboard equivalents.
4. **Picking:** projected bounds, overlaps, occlusion, each separate gauge band and each breaker row have deterministic hit/focus assertions.
5. **Optional instancing:** run with ANGLE present and absent; cues and picking are equivalent and merged fallback meets the LOW draw budget.
6. **Allocation/lifecycle:** after warm-up, state toggles preserve CPU/GPU buffer identities and allocate no per-frame arrays; disposal/context teardown releases buffers.
7. **Budget:** hydro LOW draw calls ≤ 40 and triangles ≤ 15,000 on every registered v1.1 worst-case scenario.
8. **Captures:** byte-identical images for unaffected scenarios plus before/after review captures covering the new city blocks, gauge bands, breaker rows and their stateful focus/selection combinations.

## Reviews

| Reviewer | Verdict | Findings disposition |
|---|---|---|
| `lab-performance-reviewer` | APPROVE_WITH_CHANGES initially; APPROVE on amended re-review | Specified deterministic batch keys and excluded states, bounded/reused buffers and WebGL1 splits, exact budget planner parity, allocation/lifecycle checks, deterministic projected picking, and challenge-state captures. |
| `lab-design-director` | APPROVE_WITH_CHANGES initially; APPROVE on amended re-review | Specified synchronization/invalidation for per-item visual and interaction state, challenge-state render/picking parity across all profiles, and ANGLE-present/absent parity tests. |

These are proposal reviews only, not implementation verification or a product SHIP verdict. The approved-with-changes requirements above remain implementation gates.

## Acceptance record (2026-10-06; historical checkpoint)

This checkpoint preserves the previous evidence state and is superseded by the final acceptance closure below.

Branch `feat/rx005-rx006-acceptance-closure` (draft PR #169). CI evidence is headless Chromium on SwiftShader (run 37429556324 at c0e77a6d), never device performance.

| Test | Result | Evidence |
|---|---|---|
| 1. Planner | PROVEN | The LOW planner equals the wrapped `drawArrays` count on 96/96 stills; `frame-plan.test.ts`. The FAIL-on-mismatch gate runs in the manual capture workflow, not yet on PR CI. |
| 2. State sync | PROVEN (unit) | Entering and leaving each excluded state (focus, highlight, isolation, clip, spin, geometry, translucency), visibility, pose, colour/emissive ranges, live label and pick refresh: `frame-plan.test.ts`, `low-batch-state.test.ts`. |
| 3. Challenge parity | PROVEN (unit + keyboard) | `challenge-parity.test.ts`: 38 deterministic hospital/homes/shops/season and inspected gauge/breaker combinations give an identical instructional view, every control present and tappable with its chip's action and selected state, equal highlight and equal lit state for the nine city parts on all four profiles; keyboard challenge walkthroughs pass on every profile. Phone scene targets at the Mount Coffee presets are small (HYDRO-R4I-007, Mount Coffee polish); the chip twins remain the reliable touch path. |
| 4. Picking | PROVEN (unit) | Projected oriented bounds; control parts outrank non-controls inside real bounds; then nearest depth, distance and id. Every gauge band and breaker is the deterministic hit at its own centre. Phone-size and off-centre cases are still to add. |
| 5. Optional instancing | NOT APPLICABLE | Not implemented (a test asserts there is no instanced branch); the merged path alone meets the budget (Mount Coffee 27/40). |
| 6. Allocation/lifecycle | PROVEN | After warm-up a full variable sweep creates 0 buffers and calls `bufferData` 0 times (742 `bufferSubData` range updates); batch buffers grow geometrically and persist until context teardown. The per-frame flow-tube rewrite found in review is fixed at 90eff6c6 (signature-cached, version-skipped upload). |
| 7. Budget | PROVEN | Mount Coffee LOW at most 27 draws and 2,410 triangles across every scenario. |
| 8. Captures | PROVEN pending final sweep | LOW stills byte-identical 96/96; review scenarios `hydro-inspect-gauge-band` and `hydro-inspect-breaker` add the inspected (focus/selection) combinations to every capture run; the v1.0 captures are the "before". |

Test 1's CI gate now runs on every PR (`lab-runtime-gate.yml`). RX-006 stays **PROPOSED** until the final evidence sweep at the final head is green.

## Final acceptance closure (2026-10-06)

Evidence source: `ae3a1ec05967fb249b3490f4d3598f7989640611`. Mount Coffee [run 37489886085](https://github.com/fasiryon/liberia-learn/actions/runs/37489886085) and circuit [run 37489902558](https://github.com/fasiryon/liberia-learn/actions/runs/37489902558) both completed SUCCESS. Mount Coffee: 34 scenarios × four profiles × desktop/mobile/landscape = 408 PASS stills and 408/408 byte-identical determinism pairs. Circuit: 12 scenarios × the same matrix = 144 PASS stills and 144/144 identical pairs. Correct renderer identity, planner parity (including HIGH shadows), zero three.js requests on LOW/2D and no shader errors passed. HIGH/STANDARD/LOW on both labs pass 20 remounts with one live renderer and context-loss convergence to FALLBACK_2D. Warmed LOW buffer sweeps create zero buffers and call bufferData zero times (hydro 878 and circuit 420 bufferSubData range updates).

Mount Coffee keyboard walkthroughs pass all 12 profile/viewport combinations (51/51 steps each, zero page errors). Its blocked-three.js desktop walkthrough completes all 52 steps on LOW. Circuit sweep inputs intentionally skip keyboard/abort; no claim is made that those steps ran in this sweep. The inherited accepted control/picking and keyboard evidence is preserved. Local interactive-lab validation: 33 files, 316 tests PASS on unchanged `13c0496d`. Source PR CI 37488994275 / runtime gate 37488994191 and handoff-head CI 37490114877 / runtime gate 37490114964 are SUCCESS. The final documentation head must independently pass PR CI before merge.

**Independent final performance reviewer: ACCEPT**, bounded strictly to `c0e77a6d..13c0496d92713c4264dfc5073cff46423c1645c9`: 0 introduced/regressed P0, P1 or P2. Sprite shader/error gate, WebGL2 and failed-load guards, cached flow tubes, control tokens, pose carry, label placement/priority and 2D memoization introduce no demonstrated regression. Packages, dedicated re-baselines, unchanged 5% tolerance and cumulative chunk ceilings are accepted. threeRenderer is 609,291 stored / 132,842 Brotli bytes (ceilings 640,000 / 140,000); webglPass is 69,278 / 22,260 (72,000 / 24,000). LOW/FALLBACK_2D design and renderer lifecycle remain acceptable. This accepts the incremental design; it does not claim universally allocation-free JavaScript execution.

**Independent design director: ACCEPT A7 desktop 1024 px shadows**, based on personal inspection of the three Intel Graphics / ANGLE Direct3D11 GPU stills at `13c0496d92713c4264dfc5073cff46423c1645c9`: overview cast shading grounds equipment; cutaway generator/shaft/runner retain readable fill and separation; exploded parts remain readable. Inspected files: `hydro-overview__HIGH__desktop.png`, `hydro-cutaway-powerhouse__HIGH__desktop.png`, `hydro-exploded-unit__HIGH__desktop.png` and `manifest.json`. The unaltered manifest and PNGs are retained in [desktop GPU evidence](../../labs/mount-coffee-hydropower/evidence/rx-a7-desktop-gpu/). Findings: 0 P0, 0 P1, 1 P2 (coarse/stepped ground-shadow edges beneath the right-hand breaker blocks in cutaway/exploded views). This minor edge polish does not obscure parts or make their placement ambiguous; future smoothing must preserve the accepted cost bound. This is only a desktop still-shadow judgment, not temporal stability, arbitrary cameras, benchmark or product SHIP.

**Accepted amendments:** A7 uses a 1024 px sun-shadow map on all devices, accepted on cost and now desktop still quality. A8/A19 allow SwiftShader renderer accounting, program counts, routing, determinism and lifecycle evidence; they do not certify device performance. A19 permits the current registry until before programme Phase 4, guarded by the 162 KB stored / 48 KB Brotli 2D first-load test (300 KB limit). RX-006 optional instancing is not implemented and is not applicable: merged batching alone meets the budget.

**Remaining limitations:** real-phone frame rate, target-device cold/warm load time, tab/JS/GPU memory, battery, thermals and physical touch latency remain UNVERIFIED / NOT MEASURED. The Intel GPU captures measure no performance. The known dev-server aborted-chunk walkthrough has two uncaught loading errors but completes 52/52 steps; that accepted P2 remains open. Small phone scene targets, art/immersion, benchmark and other Mount Coffee product polish remain separate. Mount Coffee remains DRAFT, approval PENDING, UNRELEASED, curriculum inactive and student inaccessible; overall design verdict DO_NOT_SHIP.

**Decision: RX-006 = IMPLEMENTED.** Test 1: exact LOW parity and automatic PR gate. Test 2: existing state-sync tests. Test 3: accepted 38-state cross-profile challenge/action/highlight parity, chip touch twins and all-profile keyboard walkthroughs. Test 4: existing deterministic projected-bound/control-priority/depth/id tests for each gauge/breaker; further phone/off-centre cases are product follow-up, not additional binding criteria. Test 5: optional instancing NOT APPLICABLE. Test 6: warmed buffer reuse, cached flow tubes and remount/context-loss evidence. Test 7: hydro LOW 27/40 draws, 2,410/15,000 triangles. Test 8: final inspected gauge/breaker scenario captures on all profiles, unchanged scenarios deterministic, with recorded historical before captures. No partial promotion.

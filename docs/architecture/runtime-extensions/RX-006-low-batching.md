# RX-006: LOW draw-call batching with per-part state

- **Status:** PROPOSED; both independent reviewers returned APPROVE_WITH_CHANGES on 2026-10-01. The mandatory clarifications below are binding. Implementation evidence and the exact unmet items are in "Acceptance record (2026-10-06)" below.
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

## Acceptance record (2026-10-06)

Branch `feat/rx005-rx006-acceptance-closure` (draft PR #169). CI evidence is headless Chromium on SwiftShader (run 37429556324 at c0e77a6d), never device performance.

| Test | Result | Evidence |
|---|---|---|
| 1. Planner | PROVEN | The LOW planner equals the wrapped `drawArrays` count on 96/96 stills; `frame-plan.test.ts`. The FAIL-on-mismatch gate runs in the manual capture workflow, not yet on PR CI. |
| 2. State sync | PROVEN (unit) | Entering and leaving each excluded state (focus, highlight, isolation, clip, spin, geometry, translucency), visibility, pose, colour/emissive ranges, live label and pick refresh: `frame-plan.test.ts`, `low-batch-state.test.ts`. |
| 3. Challenge parity | PARTLY | Keyboard challenge walkthroughs pass on all four profiles at desktop and mobile; chip ids equal control ids. Scene-tap parity has no test, and phone scene targets are far below 44 px at the Mount Coffee presets. |
| 4. Picking | PROVEN (unit) | Projected oriented bounds; control parts outrank non-controls inside real bounds; then nearest depth, distance and id. Every gauge band and breaker is the deterministic hit at its own centre. Phone-size and off-centre cases are still to add. |
| 5. Optional instancing | NOT APPLICABLE | Not implemented (a test asserts there is no instanced branch); the merged path alone meets the budget (Mount Coffee 27/40). |
| 6. Allocation/lifecycle | PROVEN | After warm-up a full variable sweep creates 0 buffers and calls `bufferData` 0 times (742 `bufferSubData` range updates); batch buffers grow geometrically and persist until context teardown. The per-frame flow-tube rewrite found in review is fixed at 90eff6c6 (signature-cached, version-skipped upload). |
| 7. Budget | PROVEN | Mount Coffee LOW at most 27 draws and 2,410 triangles across every scenario. |
| 8. Captures | PARTLY | LOW stills byte-identical 96/96. Dedicated before/after review captures of city blocks, gauge bands and breaker rows in their focus/selection combinations are not yet assembled. |

RX-006 stays **PROPOSED** until tests 3 and 8 are complete and the parity gate runs on PR CI.

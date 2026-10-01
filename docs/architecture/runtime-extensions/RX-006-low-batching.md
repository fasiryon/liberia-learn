# RX-006: LOW draw-call batching with per-part state

- **Status:** PROPOSED. Split out of RX-005 at the request of both reviewers (design P1-05, performance P1-8).
- **Filed by:** LAB-BUILDER on 2026-10-01.
- **Runtime:** Interactive Lab Runtime V2. The change is in the shared `WebGLScene` (LOW) pass only.

## Problem

- The LOW draw-call budget is 40, and `mount-coffee-hydropower` is already at 38 (`budget-baseline.json`).
- v1.1 adds instructional parts: eight city blocks, five gauge bands, a control desk and breaker cabinets. The asset director estimates about 59 draws.
- Cutting instructional parts to fit is not allowed.
- Every migrated legacy lab with many repeated parts (molecules, cells, ecosystems) hits the same limit.

## Capability

**Baseline: CPU-transformed merged opaque batches.**
- Static opaque items that share a material class are merged into one vertex buffer.
- Each vertex carries `color`, `emissive` and `highlight` attributes.
- Batches are rebuilt only when the render list changes, never per frame.
- No per-frame allocation, following the RX-002 storage rule. This also removes today's `[...list.items].sort` and per-item `new Float32Array` on every frame.

**Per-part state survives batching.**
- A city block that lights or darkens updates its own vertices' `emissive` attribute with `bufferSubData`.
- The eight city blocks are the challenge's feedback, so they must never collapse into one lit state.

**Kept as individual draws:**
- highlighted items;
- translucent items;
- clipped items;
- spinning (RX-001) items.

**Optional instancing** via `ANGLE_instanced_arrays`, with a fallback to merging when the extension is missing. It must respect the WebGL1 minimum of 8 vertex attributes.

**Picking is unchanged in principle.** It still uses render-list geometry, never GPU ids. Control parts (gauge bands, breaker rows) are picked by projected bounds rather than the nearest centre (shared with RX-005 A14).

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

1. **Planner:** the batch planner's draw count matches the LOW renderer.
2. **Per-part state:** toggling one city block changes only that block's emissive state.
3. **`instructionalView`:** unchanged across all four profiles.
4. **2D:** unaffected.
5. **Picking:** names and focus are preserved, and every gauge band and breaker can be picked distinctly.
6. **Allocation:** none per frame (an allocation-spy test).
7. **Budget:** hydro LOW draw calls ≤ 40 on the v1.1 worst scenario.
8. **Captures:** LOW images are byte-identical before and after batching for a scenario that does not use the new parts.

## Reviews

Pending: `lab-performance-reviewer`, `lab-design-director`.

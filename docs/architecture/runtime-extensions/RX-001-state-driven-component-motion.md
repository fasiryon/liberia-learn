# RX-001: State-driven component motion (constant-speed rotation)

- **Status:** APPROVED_WITH_CHANGES (both reviewers), amended below, then IMPLEMENTED (see "Implementation").
- **Filed by:** LAB-BUILDER on 2026-09-28, for `mount-coffee-hydropower` storyboard gap G1.
- **Runtime:** Interactive Lab Runtime V2, high-fidelity layer. Nothing is lab-local.

## Capability

A **motion group** is one or more components that turn **rigidly together about one shared pivot and axis**, such as a runner, its shaft and a generator rotor. The group turns at a **fixed, declared rpm** while the simulation reports that its driver component is in one of a set of statuses that mean "the shaft is turning".

- Speed is authored data. It can never be bound to a simulation quantity. This guards against the "more input means faster spin" misconception for synchronous machines and every other fixed-speed system.
- The simulation decides *whether* the group turns. The renderer decides *how it looks*. The renderer still computes no consequences.
- "Turning" means *the shaft is turning*. It does not mean *power is being delivered*. A unit that trips off the grid while still turning is a state authors can express (design review, P0-2).

## API (amended after review)

```ts
// lib/interactive-labs/v2/fidelity/types.ts
export type ComponentMotionDefinition = {
  id: string;
  label: string;                   // for the always-on status line, glyph titles and screen readers
  componentIds: string[];          // turn together as one rigid group
  pivot: Vec3;                     // in the components' shared root frame (world when there is no root object)
  axis: "x" | "y" | "z";           // world-aligned in that frame
  rpm: number;                     // constant by design
  symmetryOrder: number;           // rotational symmetry of the group's visible silhouette about the axis (≥ 1)
  activeWhen: { componentId: string; statuses: string[] }; // SimulationOutput.componentStates[id].status ∈ statuses
};
// HighFidelitySpec.motions?: ComponentMotionDefinition[]
```

- **Rigid composition** (performance review, P1-1). Each spinning `RenderItem` carries `spin = { pre, local, pivot, axis, radPerSec }`. `pre` is the root matrix and `local` is the component's own T·R·S. The renderer draws `pre · T(pivot) · R_axis(θ) · T(−pivot) · local`. The spin is applied *after* the component's scale, so non-uniformly scaled parts stay rigid, and every part of the group orbits the same shaft.
- **`spinMatrix(spin, tSeconds, reducedMotion)`** is a pure helper in `fidelity/presentation.ts`. Reduced motion gives θ = 0. Performance review P2-1.
- **`RenderList.motions`** is `{ id, label, active, center }[]`. It is derived from `spec.motions × simulation.componentStates` and does not depend on which items a profile draws. `instructionalView` gains `spinning` (the ids of active groups), so equivalence holds across profiles. Performance review P1-4.
- The render list stays time-free and pure (P2-2).

### Authoring gate (`validateHighFidelityDefinition`)

It rejects:

- unknown component or driver ids;
- empty `statuses`;
- a component claimed by two groups;
- `rpm ≤ 0`, or `symmetryOrder < 1`;
- **aliasing.** `rpm/60 × symmetryOrder` must stay at or below `0.4 × RUNTIME_TARGETS.fps.LOW`, which is 12 symmetry periods per second at 30 fps. This replaces the old flat 600 rpm cap (performance review P1-2). At 142.86 rpm (2.38 rev/s) it allows a symmetry order of 5 or less.
- **invisible spin.** Every component in the group is a sphere, or a cylinder or cone centred on the axis. In that case the rotation shows nothing, so the author must add an off-axis or non-circular "tell" part (design review P0-1).

## Per-profile behaviour

| Profile | Behaviour | Cost |
| --- | --- | --- |
| HIGH / STANDARD / LOW | `spinMatrix` applied in the existing draw loop | One 4×4 composition per spinning item per frame. No new loop, draw call, mesh or texture. The aliasing bound is set by the LOW fps target. A static DOM/SVG turning glyph also appears for each active group at every WebGL profile. |
| FALLBACK_2D | One **static** circular-arrow glyph per active motion group, at the group centre, with an SVG `<title>` ("Unit 1 runner: turning"). It is not animated, so there is no new loop (P1/P2). | One SVG group per active motion |
| Reduced motion (WebGL) | No rotation. The same static DOM/SVG glyph remains visible for each active group in the existing label overlay on its 120 ms tick. It is not a `RenderMarker` and adds no draw call (P1-3). | DOM only |

The "is turning" text is **lab-authored, profile-independent explanation** from the simulation model, present for every learner. Motion never adds explanation lines by itself (design review P1-2). The lab must also author the misconception-3 line ("still 142.86 rpm; more water gives more power, not more speed") whenever units are turning (design review P1-1).

**Display speed.** True rpm. There is no display scaling in V1 (design review P2-1).

**Start and stop.** Instant in V1. Any future run-up must be a fixed-duration ease triggered only by a status change, never scaled by a quantity, and skipped under reduced motion (design review P2-3).

## Fallback, evidence, offline

- **Fallback:** a definition without `motions` renders exactly as before.
- **Evidence:** motion is presentation, never an action or evidence.
- **Offline:** data only.

## Tests

- **Gate:** every rejection rule above, including aliasing and symmetric-only groups.
- **Render list:** `motions` and `spinning` follow the driver status and are identical across all four profiles. `spin` is present only on items in an active group.
- **Speed independence:** the same `radPerSec` whatever the simulation quantities.
- **Rigid rotation:** a non-uniformly scaled box keeps its edge lengths under `spinMatrix`.
- **Pivot:** off-axis parts orbit the shared pivot.
- **Reduced motion:** θ = 0.
- **Purity:** `buildRenderList` output is deep-equal across two calls.
- **Budget:** reference labs unchanged.

## Review

**`lab-performance-reviewer`: APPROVE_WITH_CHANGES** (P0 0, P1 4, P2 2). Required changes:

1. rigid pivot composition;
2. an aliasing-derived bound replacing the 600 rpm cap;
3. the reduced-motion glyph as DOM, not a `RenderMarker`;
4. `spinning` derived from the simulation;
5. a pure angle helper with tests;
6. a static 2D glyph.

All six are applied above.

**`lab-design-director`: APPROVE_WITH_CHANGES** (P0 2, P1 2, P2 3). Required changes:

1. a shared pivot and a gate against invisible symmetric spin;
2. a status *set*, with spin meaning "shaft turning", and trip/idle/fault/zero-flow behaviour decided in the simulation spec with science review;
3. a profile-independent "turning" line and the misconception-3 line;
4. true rpm, with blade count chosen against the aliasing bound;
5. one static 2D glyph per group, placed clear of labels.

Items 1, 3 (runtime side), 4 and 5 are applied above. Items 2 and 3 (lab side) are recorded as obligations on the hydro simulation spec and the round-1 science review.

**Disagreement:** none between the two reviewers. Both required the shared pivot.

**Asset-director / builder decision:** The asset director requested the static spin glyph at all WebGL profiles, while the initial implementation plan limited it to reduced motion. The shared DOM/SVG glyph is now required at HIGH, STANDARD and LOW as well as reduced motion; the asset spec's off-axis pole marker remains the visible tell for actual rotation. Round-1 visual review must confirm the glyph and marker read clearly together in fresh captures.

**Review independence caveat:** both roles ran in one subagent, each bound to its own agent file. Later extensions should use two separate reviewer runs.

# Interactive Lab Runtime V2

Status: implementation baseline from `origin/main`; solids definition (2.1.0) is in review and is not yet a governed production activity.

The high-fidelity layer (components, assemblies, exploded views, cutaways, flows, variables, simulation rules, direct-manipulation checks) is specified in [HIGH_FIDELITY_INTERACTIVE_LABS.md](./HIGH_FIDELITY_INTERACTIVE_LABS.md).

## Architecture

`InteractiveLabDefinition` is the single versioned scene contract. It contains identity, provenance, release binding, scene objects, interaction vocabulary, initial state, transitions, learning checks, and device/accessibility requirements. Renderer components never decide curriculum authority or mastery.

The runtime flow is:

`definition -> initialize -> validate action -> transition -> visual consequence -> learning check -> governed evidence -> session checkpoint`

The reusable kernel is in `lib/interactive-labs/v2/kernel.ts`. Definitions live under `lib/interactive-labs/v2/definitions/`; the registry is the only lookup seam.

## Renderer and fallback

The primary renderer is a lazy-loaded native WebGL client component. It uses perspective projection, depth testing, real triangle meshes, lighting shading, constrained scene geometry, pointer rotation, object selection, and profile-dependent antialiasing/mesh density. It has no physics engine.

`FALLBACK_2D` is an official SVG/vector path in `Fallback2D.tsx`. Legacy lab scenes remain supported through the existing `components/labs/*` boundary and are not forced into V2 in this slice.

Profiles are deterministic and manually overrideable: `HIGH`, `STANDARD`, `LOW`, `FALLBACK_2D`. A failed WebGL capability check selects `FALLBACK_2D`.

## Evidence and authority

The evidence adapter emits `governed-learning-evidence/1.0.0` with `canonicalMasteryMutation: false`. `governance.ts` adds the versioned learning-check authority mapping. Raw rotation remains `PROVISIONAL`; only an explicit approved mapping with a released activity can be converted through `toCanonicalMasteryEvidence` and then routed through the existing `appendCanonicalMasteryUpdate` path. No new mastery formula or weighting policy is introduced.

The API validates authenticated student scope, tenant/session scope, definition version, action validity, check identity, and checkpoint integrity. A `PREVIEW` request may exercise an unapproved definition, but its evidence is explicitly non-canonical and cannot mutate mastery. Governed requests reject draft/unapproved definitions before ingestion.

The Grade 4 solids activity is intentionally `IN_REVIEW` / `PENDING` because the current published ontology release has no binding for `moe-math-g4-s2-p6-geometry-and-statistics-obj5`. `SOLIDS_LEARNING_CHECK_AUTHORITY` prepares the reviewed objective/concept/check identity and release-candidate references without activating them. This prevents invented authority and prevents the client from writing mastery. After the governed release/activity binding is approved, the existing adapter path can be enabled; no special direct lab writer should be introduced.

## Session and teacher view

Only meaningful checkpoint state is persisted in the existing `LabSession.observations` field: mode, completed checks, retries, hints, definition version, and current state. Frame-by-frame rotation telemetry is not persisted. The existing teacher session path remains the compatibility view; V2 evidence payloads are traceable from the session checkpoint and should be promoted into a dedicated teacher summary after the governed release binding is approved.

## Offline and accessibility

The definition declares touch, keyboard, reduced-motion, fallback, and offline capability. Current V2 browser recovery is checkpoint-based. Offline event queueing is not yet implemented; the definition therefore exposes the capability but the solids production path remains online until it is wired to the existing signed offline pack/sync system.

## Migration boundaries

| Legacy area | Classification | Boundary |
| --- | --- | --- |
| `lib/labs/types.ts`, registry, per-lab state/actions | ADAPT | Keep existing labs working; add V2 registry beside it. |
| `lib/labs/runtime/*` | LEGACY_COMPATIBILITY_ONLY | V1 action semantics remain for existing labs. |
| Existing SVG scenes | ADAPT | Reuse as low-resource precedent; V2 uses an official fallback component. |
| `VirtualLab` / `LabSession` | EXTEND | V2 sessions reuse tenant-scoped `LabSession`; no destructive migration. |
| teacher lab review | KEEP | Existing review UI remains authoritative for legacy labs. |
| evidence contract / mastery writer | KEEP | V2 emits the existing governed evidence contract and cannot write mastery. |
| offline signed packs | EXTEND | V2 checkpoint/event sync is the next integration seam. |
| tool policies | ADAPT | V2 definitions carry only references; policy remains governed outside renderers. |
| Grade 4 solids | V2_NATIVE | First V2 definition; requires release approval before production. |
| lever fixture | V2_ADAPTER | Non-production reuse proof. |
| simple circuit fixture | V2_NATIVE | Non-production causal reference for the high-fidelity standard. |
| remaining legacy labs | LEGACY_SUPPORTED | Migrate by vertical slice; do not force a flag-day rewrite. |

## Capability matrix

| Capability | Status |
| --- | --- |
| 2D manipulation | SUPPORTED |
| 3D manipulation | SUPPORTED |
| camera | SUPPORTED (presets, constraints, eased transitions) |
| animation | SUPPORTED |
| labels | SUPPORTED |
| exploded views | SUPPORTED |
| measurements | NOT_YET_SUPPORTED |
| simple simulation rules | SUPPORTED (SimulationModel) |
| cutaways | SUPPORTED |
| process flows | SUPPORTED |
| direct-manipulation assessment | SUPPORTED |
| physics | NOT_YET_SUPPORTED |
| assessment | SUPPORTED |
| evidence | PARTIAL (governed release pending) |
| offline | PARTIAL |
| accessibility | PARTIAL |

## Current limitations and certification

No physical-device frame-rate or memory certification is claimed. Browser performance instrumentation, full browser E2E, CI integration, and the governed release binding remain required before production promotion. The current baseline is intentionally safe: unapproved content fails closed and cannot reach canonical mastery state.

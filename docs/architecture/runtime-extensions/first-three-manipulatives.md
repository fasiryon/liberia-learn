# Exact manipulatives on Interactive Lab Runtime V2

Status: DRAFT implementation authorized by the user on 2026-10-20. This proposal
adds no approval, publishing, academic writing or mastery authority.

## Capability and reuse

Retain `composeHighFidelity`, the kernel, fidelity state, shared render list,
InteractiveLabPlayer, its mobile sheet, registered Lab Experience links and the
dev-only review harness. All three definitions remain DRAFT/PENDING and unreleased.

1. Atomic `set-variables` actions validate every scalar and the complete proposed
   state before mutation. An optional `validateVariables` guard applies to scalar
   and atomic updates, checkpoints, check evaluation, mode and guided starts.
   Fractions require this to subdivide a denominator and shaded mask together.
2. Simulation output may supply a component position and bounded deterministic
   translation. One presentation matrix serves drawing, picking and labels in
   Three, LOW WebGL and SVG. Animated components are excluded from static batches;
   frame scheduling and particle budgets account for them. Reduced motion uses
   deterministic stationary configurations. Motion never changes simulation or
   emits evidence.
3. Authored SVG polygon silhouettes preserve their ordered concave contours.
   Only sampled primitive silhouettes use a convex hull. The existing ear-clipped
   extrusion supports the same source county contours at all 3D profiles.
4. Definition-selected instructional controls use existing validated LabActions.
   They do not own a second state reducer, persistence API or evidence pipeline.
   Assessment-mode assistance filtering hides coaching, derived solutions and
   hints; lesson assessment keys are never imported into client definitions.

## Model and contract clarifications

- Water uses specific energy in J/g relative to ice at -20 C, with rounded
  heat-capacity/latent-heat segments 42, 334, 418, 2260 and 40 J/g. Temperature
  plateaux represent melting and boiling of ideal pure water near 1 atm.
  Surface evaporation below boiling is a qualitative process, not a plateau.
  Exactly 24 constant-radius instructional particles remain in every profile.
- Fractions use two equal wholes. Subdivision preserves selected length; integer
  masks and exact rational arithmetic prevent drift. Unsupported LCMs over 24
  are rejected, never rounded. Composition/removal supplies arithmetic practice.
- County boundaries derive from the pinned source geometry. A shared segment,
  rather than point contact or proximity, defines adjacency. All original
  authored SVG and PNG hashes remain immutable.

## Review and gates

Read-only pedagogy, experience, simulation and asset reviews were completed by
separate agents under the repository lab-production workflow. The asset reviewer
allowed this bounded DRAFT extension with required fixes to polygon concavity,
variable invariants, animation batching/scheduling and instructional particle
counting. Browser visual/interaction and independent science review follow build.
No device GPU or low-memory performance certification is inferred from CI captures.

The county map remains CC-BY-3.0-IGO, attributed to UNMIL/OCHA ROWCA via
geoBoundaries, with PCGN factual references. This differs from the lab asset
role's narrow allowlist. Do not relabel it as an original or CC-BY-4.0 asset.
The exception remains an explicit asset-review finding for DRAFT review; no global
license allowlist is weakened and no asset approval or SHIP status is claimed.

Tests must cover atomic rejection without mutation, corrupt checkpoints, invalid
starts, conserved particles, phase plateaux/reversal, exact splitting and LCM
rejection, authentic map adjacency, concavity and equivalent state across profiles.
Browser evidence must exercise keyboard, touch and mouse at 360/390/768/1440 px,
reduced motion, paper fallback, independent modes and deterministic replay.

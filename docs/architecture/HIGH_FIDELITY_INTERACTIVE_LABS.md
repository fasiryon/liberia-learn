# High-Fidelity Interactive Labs

Status: platform standard, V1. Extends [Interactive Lab Runtime V2](./INTERACTIVE_LAB_RUNTIME_V2.md). It adds no new curriculum authority, no new evidence authority, and no mastery formula.

**LiberiaLearn high-fidelity labs are interactive learning systems, not 3D illustrations.**

A rotate-only model, an animated video, a decorative WebGL scene, or multiple-choice questions placed beside a model does not meet this standard. A high-fidelity lab lets the learner inspect a system, take it apart, change what drives it, see the consequence, and prove understanding by acting on the scene.

## Canonical experience chain

```
Scene
→ Components
→ Rules
→ Controls
→ State
→ Visual Consequence
→ Explanation
→ Learning Check
→ Governed Evidence
```

Every link is a separate layer in code:

| Link | Where it lives | Rule |
| --- | --- | --- |
| Scene, Components | `InteractiveLabDefinition.scene` + `fidelity.components` / `assemblies` | Authorable data, versioned with the definition. |
| Rules | `fidelity.simulation` (`SimulationModel`) | Pure and deterministic. It never touches the renderer or evidence. |
| Controls | `FidelityAction` via `acceptLabAction` | Validated, never clamped. Invalid input is rejected and state is unchanged. |
| State | `LabState.fidelity` (`FidelityState`) | Serializable and checkpointed. A tampered checkpoint is rejected on restore. |
| Visual consequence | `buildRenderList` → WebGL or SVG | The renderer draws what state says. It computes no consequences. |
| Explanation | `explainState` | Built from simulation output and filtered by grade (`minGrade`). |
| Learning check | `LearningCheck.fidelity` (`FidelityCheck`) | Evaluated from scene state by the engine. |
| Governed evidence | `buildLabEvidence` → `adaptLabEvidence` → existing mastery path | Unchanged. Only `check` actions produce evidence. |

## High-fidelity principles

1. **Structural inspection.** Select, rotate, isolate (`isolate`), camera presets and constrained zoom, labels (`toggle-labels`), layers (`toggle-layer`), exploded views (`set-explode`), cutaways (`set-cutaway`), and inspecting internal parts (`inspect-component`).
2. **Process tracing.** A `FlowDefinition` gives the path. Whether it is active, and its rate and direction, come only from the simulation. The learner can trace it (`trace-node`). An inactive flow renders no particles, so a stopped process never looks like it is running.
3. **Real manipulation.** A `VariableDefinition` sets bounds, step and kind (continuous, discrete or toggle). Every change goes through validation.
4. **Causal visual feedback.** "I changed X. What happened to Y, and why?" X is a variable, Y is a simulation quantity shown through the render list, and "why" is the explanation layer. Canned animation must not stand in for state that can be modelled.
5. **Disassembly / exploded view.** Handled by the reusable `ComponentAssemblyDefinition` + `ExplodedViewDefinition`. Assemblies with `slots` can be rebuilt (`clear-assembly`, `place-component`), and slots accept components by `shapeKey`.
6. **Cutaway / internal view.** A `CutawayDefinition` has a world clip plane, the components it removes, and the internal components it reveals. An internal component with no cutaway that reveals it fails authoring validation.
7. **Multiple learning modes.** GUIDED, EXPLORE, CHALLENGE and ASSESSMENT share one simulation state. GUIDED walks `guidedPath` steps, each with an optional camera preset and highlights.
8. **Direct-manipulation assessment.** Every high-fidelity definition needs at least one `kind: "direct-manipulation"` check: `reach-target`, `trace-path`, `assemble` or `identify-component`. The authoring gate enforces this.
9. **State explanation.** The explanation lines, including simplified equations, are gated by grade.
10. **Camera.** There is no unconstrained free camera.
    - **Limits.** Each lab declares distance, pitch and yaw limits for each mode. If it allows panning, it also declares a target box. Without a target box, the camera target follows presets only.
    - **Learner control.** Within those limits the learner may orbit, zoom and pan by touch, mouse and keyboard. Outside them the camera cannot go.
    - **Safety.** The camera never enters a solid part, and never drops below a declared ground or water surface.
    - **Guided steps** hold the view near the step's preset and offer Recentre.
    - **Presets and rails** are presentation only.
    - **No task needs camera freedom.** Every check, control and trace target is framed by a preset or rail stop that is reachable in one action, and the same action exists in FALLBACK_2D.

    *Amended 2026-10-01 by RX-005 A16 (founder approved).*
11. **Animation.** `approach`, `approachCamera`, `easeDisplayState`, `samplePath` and `flowParticles`. Every animated value eases *toward state*. Pose transitions (`PoseTransitionDefinition`) drive assembly/disassembly, nets, a switch lever, valves and so on from a variable. Reduced motion snaps everything to its final state.
12. **Simulation rule layer.** `SimulationModel.kind` is `deterministic-rules`, `equation` or `state-machine`. Do not add a physics engine unless the objective needs one.
13. **Component model.** Components, parent/child assemblies, ports, layers, internal flags, shape keys and exploded transforms.
14. **Process flow primitive.** Source, destination, ordered intermediate nodes, a closed-loop flag, colour, medium (electric current, blood, water, air, fuel, heat, light, nutrients, force), traceable nodes, and visibility.
15. **Reusable cutaway/exploded contracts.** These are the same contracts across subjects. `boxFaceAssembly` shows how a builder can emit components, an exploded view, an optional net pose, and optional build slots for any box-shaped system.
16. **Performance.** See the profile table below.
17. **Offline.** Definitions are data plus pure functions shipped in the app bundle. `buildOfflineManifest` serializes a definition and checks it against `offline.maxPackageBytes`. A definition that claims offline support while listing remote assets fails validation.
18. **Evidence boundary.** See below.
19. **Authoring standard.** See below.

## Capability profiles

| Profile | Particles per flow | Cutaway | Isolation context | Mesh / lighting |
| --- | --- | --- | --- | --- |
| HIGH | 18 | clipped in the fragment shader | faded | full meshes, specular lighting, highlight pulses |
| STANDARD | 10 | clipped in the fragment shader | faded | full meshes, simplified lighting |
| LOW | 4 | removed parts hidden | dropped | low-poly meshes, minimal lighting, no pulses |
| FALLBACK_2D | 6 (SVG) | removed parts hidden | faded | SVG silhouettes projected from the same render list |

All four profiles render one `buildRenderList` output. `instructionalView` removes rendering technique from a render list: which parts can be acted on, flow states and traces, quantities, explanation, and markers. Tests assert that this view is identical across all four profiles for representative states in both reference labs. The control panel (`LabControlPanel`) is shared, so every scene action also has a button. WebGL context failure drops straight to FALLBACK_2D. Sustained slow frames (`shouldDowngrade`) step down one profile at a time.

Opening an assembly (exploding it, unfolding it into a net, or taking it apart) brings it into focus and fades the rest of the scene. An explicit `isolate` always wins.

## Evidence boundary

Visual interaction is not learning evidence. `classifyLabAction`:

- `IGNORED`: camera presets, labels, focus, guided steps, mode, flow visibility.
- `RAW_OBSERVATION`: rotation, exploding, cutaways, layers, isolation, variable changes, tracing taps, placements, inspection, selection.
- `LEARNING_CHECK`: `check` only.

The events route builds evidence only for `LEARNING_CHECK`. Direct-manipulation checks create `governed-learning-evidence/1.0.0` with `canonicalMasteryMutation: false`. Disposition still comes only from `adaptLabEvidence` and the explicit authority table. A check with no authority mapping (the new solids `rebuild-prism` and every circuit fixture check) is `RAW_OBSERVATION`. Nothing in this standard writes mastery.

## Authoring standard

Every proposed high-fidelity lab fills `fidelity.authoring` (`HighFidelityAuthoringRecord`). `validateHighFidelityDefinition` rejects a definition if any field is missing:

LEARNING OBJECTIVE · WHY INTERACTIVE · SCENE · COMPONENTS · INTERNAL STRUCTURES · VARIABLES · SIMULATION RULES · LEARNER CONTROLS · VISUAL CONSEQUENCES · GUIDED PATH · EXPLORE MODE · CHALLENGE · ASSESSMENT · EVIDENCE · MISCONCEPTIONS · ACCESSIBILITY · DEVICE PROFILE · OFFLINE/FALLBACK

The gate also checks referential integrity: assemblies, slots, exploded offsets, cutaways, pose variables, flow endpoints, camera presets against their constraints, and guided camera references. It checks that variable bounds are valid and each initial value is on its step grid. It requires at least one bound direct-manipulation check.

New labs are produced and reviewed by the [Interactive Lab Production Team](./INTERACTIVE_LAB_PRODUCTION_TEAM.md) (pedagogy → experience → simulation → build → three review rounds on real captures → governance).

Do not require 3D where it adds no instructional value. Before authoring a scene, answer WHY INTERACTIVE. If manipulation teaches nothing, use a simpler activity.

## Reference implementations

### Grade 4 solids (`g4-solid-figures` 2.1.0, IN_REVIEW)

Upgraded only as far as needed to show the standard:

- The cube is an assembly of six faces with an exploded view and a variable-driven net (`cube-unfold`).
- The rectangular prism is a buildable assembly. Its six faces are labelled only "Face 1" to "Face 6" in a tray, and the learner rebuilds it by matching face sizes. The new `rebuild-prism` direct-manipulation check requires taking the prism apart first.
- Guided camera sequence: overview → cube close-up → net view → prism workbench.
- Vertex markers are drawn in the scene for tapped vertices.
- Fixed: the vertex-count lookup read `features["vertexs"]`, so on main the `cube-vertices` check could never be completed through the runtime.

The version moved from 2.0.0 to 2.1.0 because the scene and checks changed. The prepared (PROVISIONAL) authority entries moved with it. `rebuild-prism` has no authority mapping until curriculum review adds one.

### Simple circuit (`fixture-simple-circuit` 1.0.0, DRAFT fixture)

The causal reference. It is not curriculum content and has no release binding.

- **Controls:** battery voltage (1.5–9 V), resistance (2–20 Ω), switch.
- **Rule:** `I = V ÷ (R + 4 Ω)` when the switch is closed; brightness = √(I²·4 Ω ÷ P_ref).
- **Consequences:** particle speed follows the current, the bulb glows brighter or dimmer, and the switch lever moves through a pose transition.
- **Structure:** a bulb cutaway (clip plane) reveals the filament, and the bulb has an exploded view.
- **Checks:** light the bulb (`reach-target`), trace the current (`trace-path`, with buttons in alphabetical order so the list never gives away the order), reach 45–65% brightness (`reach-target`), and find the filament (`identify-component`, which is only reachable through the cutaway).

## Code map

```
lib/interactive-labs/v2/fidelity/
  types.ts        contracts: components, assemblies, exploded, cutaway, layers, poses, variables, simulation, flows, camera, checks, authoring
  engine.ts       validate/transition, simulation, explanation, direct-manipulation checks, checkpoint validation, composeHighFidelity
  variables.ts    bounds/step validation, stepping, formatting
  presentation.ts camera, easing, flow particles
  renderList.ts   renderer-agnostic presentation + instructionalView
  profiles.ts     render budgets, downgrade
  boundary.ts     evidence classification, authoring gate, offline manifest
  assemblies.ts   reusable box-of-faces builder
  math.ts         matrices shared by lib, WebGL and SVG
components/interactive-labs/v2/
  WebGLScene.tsx  cached meshes, shader clipping, flows, markers, eased camera, labels, auto-downgrade
  Fallback2D.tsx  SVG from the same render list; keyboard-focusable parts and trace nodes
  LabControlPanel.tsx  the shared control surface
```

`composeHighFidelity(base, spec)` is the only integration seam. Fidelity actions and direct-manipulation checks go to the engine, and everything else goes to the definition's own rules. No lab needs a bespoke architecture.

## Known limits

- No physical-device frame-rate certification is claimed. Headless software-GL runs of both labs work and exercise the auto-downgrade path.
- Browser E2E for V2 labs is not in CI.
- Both reference labs are gated (`IN_REVIEW` / `DRAFT`) and are not reachable by students until their governed release binding is approved.
- Offline packs do not yet include V2 definitions. The manifest builder is the integration seam.

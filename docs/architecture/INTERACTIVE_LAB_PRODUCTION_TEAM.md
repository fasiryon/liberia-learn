# Interactive Lab Production Team

Status: V1.1 workflow (V1 plus the V1.1 amendment: asset director, reference benchmark, runtime extension path, deterministic captures, locked budgets, review tiers, SHIP_CANDIDATE vs SHIP_VERIFIED). This is how every future high-fidelity LiberiaLearn lab is produced and reviewed. It builds on [High-Fidelity Interactive Labs](./HIGH_FIDELITY_INTERACTIVE_LABS.md) and [Interactive Lab Runtime V2](./INTERACTIVE_LAB_RUNTIME_V2.md), and changes neither. It adds no curriculum authority, no evidence authority and no mastery rule.

The standard is not "it works". The standard is:

> **A student understands something better because they manipulated this.**

## Lifecycle

```
PEDAGOGY (+ tier) → REFERENCE / EXPERIENCE DESIGN (+ REFERENCE BENCHMARK) → SIMULATION DESIGN → ASSET DIRECTION → BUILD
→ ROUND 1 (visual · interaction · science) → FIX
→ ROUND 2 (visual · interaction · pedagogy) → FIX
→ ROUND 3 (design director · performance · science) → FIX
→ SHIP_CANDIDATE → pilot with real students → SHIP_VERIFIED → GOVERNANCE
```

For applicable labs the finished experience carries the whole chain:

```
OBJECT → INTERNAL STRUCTURE → PROCESS → CONTROL → STATE CHANGE → VISUAL CONSEQUENCE → EXPLANATION → CHALLENGE → GOVERNED EVIDENCE
```

## The team

Agents live in `.claude/agents/`. The builder is the main Claude Code session, driven by `.claude/commands/lab-production.md`. Only the builder edits files.

| Role | Agent | Stage | Edits? | Produces |
| --- | --- | --- | --- | --- |
| LAB-PEDAGOGY-DIRECTOR | `lab-pedagogy-director` | design, round 2 | no | Pedagogy brief: learning goal, understanding, why simulation, what stays physical, misconceptions, guided/explore/challenge, direct-manipulation assessment, evidence boundary, rejected ideas |
| LAB-EXPERIENCE-DIRECTOR | `lab-experience-director` | design | no | Reference breakdown, the EXPERIENCE SHOT LIST / INTERACTION STORYBOARD, and the REFERENCE BENCHMARK |
| LAB-SIMULATION-ARCHITECT | `lab-simulation-architect` | design | no | State variables, rules/equations, constraints, flows, expected-consequence table, deterministic fixtures, review scenarios |
| LAB-ASSET-DIRECTOR | `lab-asset-director` | design, on asset change | no | Per-component source (procedural / glTF / generated), art direction, per-profile budgets, LOD, compression, offline packaging, provenance table |
| LAB-BUILDER | main session (`/lab-production`) | build, fix | **yes** | The lab on Runtime V2, tests, review scenarios, captures, review log |
| LAB-VISUAL-REVIEWER | `lab-visual-reviewer` | rounds 1, 2 | no | P0/P1/P2 from the actual captures |
| LAB-INTERACTION-REVIEWER | `lab-interaction-reviewer` | rounds 1, 2 | no | P0/P1/P2 from driving the lab with touch, mouse and keyboard |
| LAB-SCIENCE-REVIEWER | `lab-science-reviewer` | rounds 1, 3 | no | Claims table (ACCURATE / PEDAGOGICAL_SIMPLIFICATION / MISLEADING / INCORRECT) and P0/P1/P2 |
| LAB-PERFORMANCE-REVIEWER | `lab-performance-reviewer` | round 3; runtime extension review | no | Per-profile status against the locked budgets, offline package, P0/P1/P2 |
| LAB-DESIGN-DIRECTOR | `lab-design-director` | round 3 only; runtime extension review | no | Side-by-side benchmark scores, SHIP / DO_NOT_SHIP with P0/P1/P2 |

Separations that must hold:

- **Pedagogy is separate from implementation.** The pedagogy director never builds, and the builder does not decide what the learner must understand.
- **Science review is separate from visual review.** A capture that looks excellent can still teach a false model.
- **Simulation truth is separate from rendering.** The `SimulationModel` decides quantities and flow state; the renderer only draws them.
- **Nobody on the team holds curriculum authority.** A missing or ungoverned objective blocks the pedagogy stage (`BLOCKED_ON_AUTHORITY`). `SHIP` is an experience-quality verdict, not approval. Release binding, `reviewState`/`approvalState` and evidence authority mappings stay with the governed review process and humans.

## How a lab author invokes the team

1. In a dedicated worktree on a feature branch, start Claude Code and run:

   ```
   /lab-production <labId or brief>
   ```

   Supply the governed objective id, grade, subject, prerequisites, the approved lesson, evidence requirements, and any reference screenshots, videos or pages. The builder dispatches the design agents in order and records their outputs.

2. You can also call any agent directly, e.g. "Use the lab-science-reviewer on `artifacts/lab-review/fixture-simple-circuit/1.0.0/round-1`." Always pass the capture folder; reviewers do not review source and infer visuals.

3. Resume at any time with `/lab-production <labId> round-2` (or another stage). The review log says which gates are recorded.

## Review mechanism: seeing the actual rendered lab

A lab in production is `DRAFT` or `IN_REVIEW`, so learner routes refuse to show it. The review harness renders it anyway, for local review only.

| Piece | Where | What it does |
| --- | --- | --- |
| Review scenarios | `lib/interactive-labs/v2/review/scenarios.ts`, registered in `referenceScenarios.ts` | Named learner states reached by replaying real `LabAction`s through `acceptLabAction`. A rejected action, a wrong version or a claimed-but-unpassed check fails `validateScenarioSet`. |
| Required stages | `requiredReviewStages` | overview, guided, challenge, assessment always; exploded, cutaway, process and variable when the lab has them. CI fails if a registered set misses one. |
| Harness route | `app/lab-review/[labId]` | Renders the **real** `InteractiveLabPlayer` from a scenario state with a visible "review preview · no evidence" banner. 404s unless `NODE_ENV !== "production"`, not on Vercel, and `LAB_REVIEW_HARNESS=1`. Middleware exempts it from login only in dev builds. It posts no events and writes no evidence. |
| Capture script | `scripts/labs/capture-lab-review.ts` | Headless Chromium captures every scenario × profile × viewport, motion frame strips, reduced-motion strips, optional video, perf metrics and an interaction probe, plus `manifest.json`. |

Run it:

```bash
# terminal 1 (local only; never point the capture at a deployed site)
LAB_REVIEW_HARNESS=1 npm run dev

# terminal 2
npx tsx scripts/labs/capture-lab-review.ts --lab <labId> --label round-1 --reduced-motion --probe --perf
```

Output goes to `artifacts/lab-review/<labId>/<version>/<label>/` (git-ignored):

- `<scenario>__<PROFILE>__<viewport>.png`: settled still, full page.
- `<scenario>__<PROFILE>__<viewport>__motion-NN.png` and `__motion-sheet.png`: the scenario's final action dispatched live, sampled 8–16 times (`LAB_REVIEW_MOTION_FRAMES`) every `intervalMs` on Playwright's **virtual clock**, so frames are deterministic and comparable between rounds. With `--reduced-motion`, the same strip is also captured with `__reduced` in the name; it must snap to the end state.
- `video/*.webm` with `--video`: real-time recording for human review. Not deterministic.
- `perf.json` with `--perf`: rAF frame intervals, JS heap, transfer. Real clock, dev server, SwiftShader software GL. Use it for relative comparison only.
- `interaction-probe.json` with `--probe`: Tab focus order and focus styling, targets under 44 CSS px, unnamed controls.
- `manifest.json`: git sha (marked `-dirty` if the tree is dirty), lab version and review state, the capture list, renderer used per run, downgrade notices, console and page errors.

Narrow a run with `--profiles`, `--viewports desktop|mobile` and `--scenarios`. The full matrix is slow on a dev server, so round 1 can use `--profiles HIGH,FALLBACK_2D` and rounds 2 and 3 capture everything.

Minimum capture set for an important lab: overview, each guided step that moves the camera, exploded and/or cutaway, process and variable states (causal labs), a fault or misconception-exposing state where one exists, challenge, assessment with checks passed. Capture each at HIGH, STANDARD, LOW and FALLBACK_2D, on desktop and mobile.

### Determinism and render honesty

- Each scenario is a seeded simulation state: the model is pure and each scenario is a fixed action script, including camera presets and input. It can be tied to a storyboard scene (`storyboardScene`).
- The virtual clock is installed and paused before navigation, so every animation frame runs at a fixed virtual time step. Two consecutive runs must produce byte-identical PNGs. Prove it with `npx tsx scripts/labs/compare-lab-captures.ts <runA> <runB>`, which exits non-zero on any difference.
- Acceptance proof, 2026-09-29: the fixture `overview`, `current-starts`, `bulb-cutaway` and `open-circuit` scenarios, desktop across all four profiles, produced **96/96 byte-identical PNGs** in two runs. The renderer was SwiftShader software GL, so this proves repeatable composition and labels only. Motion captures use full-page screenshots cropped to the player because clipped element screenshots intermittently omitted committed SVG content; FALLBACK_2D publishes the exact held review timestamp on each frame while retaining its 30 fps throttle for learner rendering. The ignored run report is `artifacts/lab-review/fixture-simple-circuit/1.0.0/determinism-report-final.json`.
- `manifest.json` records the WebGL renderer. `software` (SwiftShader/llvmpipe) captures are valid for **composition and labels only**, never for performance or visual-fidelity sign-off. `--gpu` runs headed Chromium on the host GPU, fails if no GPU renderer is found, and is the only capture source whose `perf.json` may be used for sign-off, together with real devices.

Reviewers must read the images. Reviewing source and inferring that the visuals are good is not a review.

## Review protocol: P0 / P1 / P2

| Severity | Meaning | Examples |
| --- | --- | --- |
| **P0** | Must be fixed before shipping. | Scientifically or mathematically INCORRECT behaviour, label or explanation. A visual that communicates a false model. A guided step, challenge or check that cannot be completed with touch, mouse or keyboard, or on LOW or FALLBACK_2D. A lower profile missing instructional content. A check that can be passed without the concept. Evidence produced by non-check interaction. Crash or blank render. A beautiful interaction that does not improve learning. |
| **P1** | A significant quality, clarity or usability problem. Fix it in this cycle when it is worthwhile. | Confusing camera move, overlapping labels, weak feedback, sensitive controls, MISLEADING simplification, a heavy new dependency. |
| **P2** | Polish. | Spacing, easing curves, colour harmony, copy tone. |

Every finding uses one format so the builder can triage findings from all lenses together:

```
### [P0|P1|P2] <title>
- Lens: VISUAL | INTERACTION | SCIENCE | PEDAGOGY | PERFORMANCE | DESIGN
- Where: <scenario> / <profile> / <viewport> / <frame or input method>, or file:line
- Evidence: <capture file, probe entry, measurement or quote>
- Problem: <what is wrong>
- Learner impact: <why it matters to a student>
- Fix direction: <what should change, not code>
- Confidence: CONFIRMED | PLAUSIBLE
```

Each report ends with what was **not** reviewed or measured. The builder verifies every P0 against the captures or code before acting. Reviewer output is evidence to check, not an instruction.

## Review tiers (cost control)

The pedagogy director assigns the tier. It is recorded in `production.json` with a reason.

| Tier | When | Review loop |
| --- | --- | --- |
| HERO | Flagship labs that set the bar for a subject | The full three-round loop below, plus benchmark scoring |
| STANDARD | Ordinary new labs | Round 1 (visual, interaction, science), then round 2 (design director, science) |
| DERIVATIVE | Built from an existing hero lab's assets and patterns | One round: science, interaction, performance |

`validateProductionRecord` enforces each tier's reviewer coverage.

## Three-round autonomous polish loop (HERO)

| Round | Reviewers (dispatch in parallel) | Builder must |
| --- | --- | --- |
| 1 | visual, interaction, science | fix every P0, fix worthwhile P1s, re-capture |
| 2 | visual, interaction, pedagogy | fix every P0, re-capture |
| 3 | design director, performance, science | fix every P0, re-capture |

The builder runs every round. A round ends only when its P0s are fixed and verified on new captures, or recorded as blocked with a reason. A P0 fixed in round 3 is re-checked by the reviewer who raised it before governance. The design director's verdict needs no open P0 from any round.

### Disagreements

When reviewers disagree, record the disagreement in the review log and resolve it in this order of precedence:

1. curriculum correctness
2. scientific correctness
3. learner comprehension
4. accessibility
5. experience quality

Record the resolution and why. For example, if the visual reviewer wants a dramatic particle burst and the science reviewer says it implies current is used up in the bulb, science wins, and the log says so.

## Checkpoints and rollback

- Before every review-fix round, commit a checkpoint: `chore(lab/<labId>): checkpoint before round N`.
- Make one commit per fix, with the finding id in the message, so a fix can be reverted on its own.
- After fixes, re-capture with a new `--label` (`round-N-fix`) and run the focused tests.
- If a fix makes the experience worse and cannot be corrected cleanly, `git revert` only that fix's commit and record it in the log.
- Never reset, clean or stash a shared dirty worktree. Work in your own worktree and branch, and never commit to `main`.

## Review log template

Keep one log per lab at `docs/labs/<labId>/REVIEW_LOG.md`:

```markdown
# <labId> review log

Objective: <governed objective id + text> · Grade · Subject · Release: <release id or "not bound">

## Design
- Pedagogy brief: <summary or link> (date)
- Storyboard: <summary or link> (date)
- Simulation spec: <summary or link> (date)

## Round N — <date> — captures: artifacts/lab-review/<labId>/<version>/round-N (sha <sha>)
Checkpoint: <commit>
| Id | Sev | Lens | Finding | Resolution | Commit | Verified on |
| --- | --- | --- | --- | --- | --- | --- |
| R1-V-01 | P0 | VISUAL | ... | fixed / won't fix (why) / blocked | abc123 | round-1-fix |

Disagreements: <who, what, resolution, precedence rule applied>
Reverted fixes: <commit, why>

## Round 3 verdict
Design director: SHIP | DO_NOT_SHIP — <reason>
Open P0: none | <list>

## Governance handoff
<what governance still has to decide; the team does not approve or release>
```

## Reference benchmark and ship rule

Before build, the experience director produces a REFERENCE BENCHMARK: 3–6 reference captures (approved inspiration, or LiberiaLearn's prior best labs) and named qualities to match or beat (model detail, material realism, camera choreography, cutaway clarity, cause→consequence legibility, guided pacing, "wow moment", local relevance, ...). In round 3 the design director puts each reference beside the matching capture of the built lab and scores every quality `BEATS`, `MATCHES` or `BELOW`, citing the pair of files compared.

**Ship rule** (replaces "no P0s"; `benchmarkProblems` / `validateProductionRecord` enforce it):

- zero open P0
- no named quality `BELOW`, unless it is recorded as a deliberate trade-off for LOW, offline or accessibility, with the reason
- at least one quality `BEATS` the reference (usually local relevance, evidence, or offline reach)

"Nothing is broken" is not a ship criterion.

## Production statuses and human evidence

```
DRAFT → SHIP_CANDIDATE (agent loop passed) → SHIP_VERIFIED (pilot evidence)
```

AI review cannot certify that students want to use a lab or learn from it. Before a lab is marked `SHIP_VERIFIED`, it is piloted with real students on real school devices, under the consent and authorization that governance requires. The pilot records completion, time on task, pre/post change on direct-manipulation items, common failure points and teacher notes. Predict→test prompts are authored as guided steps. Pre/post items are direct-manipulation checks, so their evidence travels the existing path: lab events → `buildLabEvidence` → performance events → `buildXapiExport`. No parallel evidence emitter exists or is allowed. Pilot findings come back as P0/P1/P2. None of these statuses changes `reviewState`, `approvalState`, release binding or evidence authority.

The record lives at `docs/labs/<labId>/production.json` (`LabProductionRecord`, `lib/interactive-labs/v2/production/record.ts`). `__tests__/interactive-labs/lab-production-records.test.ts` fails CI when a record claims a status it does not prove.

## Runtime extension path

"No bespoke parallel engine" stands. When Runtime V2 lacks a capability the storyboard needs (cutaway, exploded view, flow visualisation, camera choreography, particle systems, quantity-driven motion, ...):

1. LAB-BUILDER files a RUNTIME EXTENSION PROPOSAL at `docs/architecture/runtime-extensions/<id>.md`: capability, API, per-profile behaviour (HIGH/STANDARD/LOW/FALLBACK_2D), reduced-motion behaviour, fallback, evidence impact (normally none), tests.
2. `lab-performance-reviewer` and `lab-design-director` review it. Their verdicts are recorded in the proposal and in `production.json` `runtimeExtensions`.
3. It is implemented in the runtime (`lib/interactive-labs/v2/fidelity/`, the shared renderers), never inside one lab.
4. Tests are added, and the capability becomes available to every lab.

Never downgrade the experience to fit current runtime limits without recording it as a deliberate trade-off in `production.json` `tradeoffs`.

## Numeric budgets (locked 2026-09-28)

Defined in `lib/interactive-labs/v2/production/budgets.ts`, pinned by `__tests__/interactive-labs/lab-budgets.test.ts`, and enforced in CI against `budget-baseline.json` (more than 5% growth is a regression).

**TARGET_LOW_DEVICE: Tecno Spark Go 2024** (Unisoc T606, Mali-G57 MP1, 3 GB RAM, Android 13 Go, 720p). Tecno is Liberia's largest phone vendor ([StatCounter, Aug 2026: 31.95%](https://gs.statcounter.com/vendor-market-share/mobile/liberia)), and the Spark Go is its entry tier ([GSMArena](https://www.gsmarena.com/tecno_spark_go_2024-12702.php)). Its GPU manages about 9 fps in 3DMark Sling Shot ([UL](https://benchmarks.ul.com/hardware/phone/Tecno+Spark+Go+2024+review)), so on this device LOW is the profile that must hold its target. The network baseline is 9 Mbps / 100 ms RTT ([Russell, 2026](https://infrequently.org/2025/11/performance-inequality-gap-2026/)).

| Budget | HIGH | STANDARD | LOW | FALLBACK_2D | Enforced |
| --- | --- | --- | --- | --- | --- |
| Offline package | ≤ 5 MB | ≤ 5 MB (shared) | ≤ 1.5 MB | ≤ 300 KB | CI |
| Triangles (worst scenario) | ≤ 100k | ≤ 60k | ≤ 15k | n/a | CI |
| Draw calls | ≤ 120 | ≤ 90 | ≤ 40 | n/a | CI |
| Max texture | 2048 px | 1024 px | 512 px | none | CI (declared assets) |
| Flow particles | ≤ 200 | ≤ 120 | ≤ 48 | ≤ 72 | CI |
| Sustained fps | ≥ 60 | ≥ 45 | ≥ 30 | ≥ 30 | device/GPU runs only |
| First interactive (TARGET_LOW_DEVICE, LOW) | | | cold ≤ 5 s on 9 Mbps; warm/offline ≤ 3 s | | device only |
| Memory (TARGET_LOW_DEVICE) | | | tab ≤ 200 MB; JS heap ≤ 64 MB | | device only |

Package sizing: at Liberia's ~US$2.63/GB ([cable.co.uk via Statista, 2023](https://www.statista.com/statistics/1272810/price-for-mobile-data-in-liberia/)), a full HIGH pack costs a learner about 1.3 US cents. LOW fits well inside Russell's 3.7 MiB five-second page budget.

**Automatic downgrade.** When the average frame time over 60 frames is slower than the profile's fps target (with 15% jitter allowance: HIGH 19.2 ms, STANDARD 25.6 ms, LOW 38.3 ms), `WebGLScene` steps down one profile. This now includes LOW → FALLBACK_2D. CI cannot certify fps, interactive time or memory. Those are claimed only from `gpu` capture runs or real devices, labelled as such.

## Reference use

External references may be studied for interaction ideas, pacing, camera language, information hierarchy and presentation. Do not copy proprietary assets, code, characters or layouts. Every implementation is original LiberiaLearn work built from runtime primitives.

## Resource reality

LiberiaLearn serves schools that may have no lab building, no equipment, unstable electricity, no modern GPU and little bandwidth. Every high-fidelity lab defines all five of these, and none of them is optional:

| Profile | Must deliver |
| --- | --- |
| HIGH | Full meshes, lighting, cutaway clipping, full particle budget. |
| STANDARD | The same experience with simpler lighting and fewer particles. |
| LOW | Low-poly, minimal lighting, removed-parts cutaways. Every check can be completed. |
| FALLBACK_2D | SVG from the same render list. It has the same instructional content and every check can be completed. |
| OFFLINE PACKAGE | Procedural or bundled assets only, within `offline.maxPackageBytes` (`buildOfflineManifest`). |

High fidelity must never mean a high-end device only.

## Virtual labs and physical practicals

Virtual labs widen access to experiments and to conceptual understanding. They do not automatically replace physical practical skills. When an objective needs real handling, measuring, safety procedure, instrument use or experience of materials, the lab follows this sequence:

```
VIRTUAL PREPARATION → PHYSICAL PRACTICAL WHEN AVAILABLE → VIRTUAL REINFORCEMENT
```

When equipment is not available, give the strongest honest virtual equivalent and state its limits in the lab. For example: "In a real lab you would also read the meter yourself and handle the wires safely." The pedagogy brief's WHAT MUST REMAIN PHYSICAL/PRACTICAL section is where this is decided.

## Subject patterns

These show what "object → process → control → consequence" means in each subject. They are not a backlog.

- **Biology, heart:** inspect → cutaway → chambers → valves → blood-flow path → change heart rate → blockage scenario → diagnose. **Cell:** membrane → organelles → isolate an organelle → trace energy and material processes.
- **Chemistry, reaction:** particles → reactants → temperature and concentration controls → collision behaviour → product formation → reaction-rate consequence. **Acid/base:** mix → concentration → pH → indicator → neutralisation challenge.
- **Physics, circuit** (reference fixture `fixture-simple-circuit`): build → current path → voltage and resistance → brightness → fault → diagnose and repair. **Optics:** lens → ray tracing → focal distance → object distance → image position.
- **Earth science, volcano:** cutaway → magma chamber → pressure → vent → eruption dynamics. **Earth:** layers → cutaway → plate boundaries → mantle process.
- **Math, geometry** (reference `g4-solid-figures`): object → rotate → explode → net → reconstruct → faces, edges and vertices → manipulation assessment.

## Worked examples

The two reference labs have registered scenario sets (`SOLIDS_REVIEW_SCENARIOS`, `CIRCUIT_REVIEW_SCENARIOS`). Copy them when registering a new lab. `__tests__/interactive-labs/lab-review-scenarios.test.ts` checks that every registered set replays and covers its required stages. `__tests__/agents/lab-production-team.test.ts` checks the team definitions: every role exists, reviewers cannot edit, the required output contracts are present, and this document names every agent.

## Known limits

- Captures run on a local dev server with headless Chromium and SwiftShader software GL. They show what renders and how. They are not physical-device performance or frame-rate certification.
- The capture script is a local tool. It is not wired into CI because CI has no running dev server or GPU. CI checks the scenario sets and agent contracts instead.
- Motion frames are deterministic on the virtual clock. `--video` and `--perf` use the real clock and are not.
- Software-rendered captures on this project's dev machines cannot sign off performance or visual fidelity. A `--gpu` run on a machine with a real GPU, or real TARGET_LOW_DEVICE sessions, are still needed for that.

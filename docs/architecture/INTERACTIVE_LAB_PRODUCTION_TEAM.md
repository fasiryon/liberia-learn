# Interactive Lab Production Team

Status: V1 workflow. This is how every future high-fidelity LiberiaLearn lab is produced and reviewed. It builds on [High-Fidelity Interactive Labs](./HIGH_FIDELITY_INTERACTIVE_LABS.md) and [Interactive Lab Runtime V2](./INTERACTIVE_LAB_RUNTIME_V2.md), and changes neither. It adds no curriculum authority, no evidence authority and no mastery rule.

The standard is not "it works". The standard is:

> **A student understands something better because they manipulated this.**

## Lifecycle

```
PEDAGOGY → REFERENCE / EXPERIENCE DESIGN → SIMULATION DESIGN → BUILD
→ ROUND 1 (visual · interaction · science) → FIX
→ ROUND 2 (visual · interaction · pedagogy) → FIX
→ ROUND 3 (design director · performance · science) → FIX
→ GOVERNANCE
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
| LAB-EXPERIENCE-DIRECTOR | `lab-experience-director` | design | no | Reference breakdown and the EXPERIENCE SHOT LIST / INTERACTION STORYBOARD |
| LAB-SIMULATION-ARCHITECT | `lab-simulation-architect` | design | no | State variables, rules/equations, constraints, flows, expected-consequence table, deterministic fixtures, review scenarios |
| LAB-BUILDER | main session (`/lab-production`) | build, fix | **yes** | The lab on Runtime V2, tests, review scenarios, captures, review log |
| LAB-VISUAL-REVIEWER | `lab-visual-reviewer` | rounds 1, 2 | no | P0/P1/P2 from the actual captures |
| LAB-INTERACTION-REVIEWER | `lab-interaction-reviewer` | rounds 1, 2 | no | P0/P1/P2 from driving the lab with touch, mouse and keyboard |
| LAB-SCIENCE-REVIEWER | `lab-science-reviewer` | rounds 1, 3 | no | Claims table (ACCURATE / PEDAGOGICAL_SIMPLIFICATION / MISLEADING / INCORRECT) and P0/P1/P2 |
| LAB-PERFORMANCE-REVIEWER | `lab-performance-reviewer` | round 3 | no | Per-profile status, offline package, P0/P1/P2 |
| LAB-DESIGN-DIRECTOR | `lab-design-director` | round 3 only | no | SHIP / DO_NOT_SHIP with P0/P1/P2 |

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
- `<scenario>__<PROFILE>__<viewport>__motion-NN.png` and `__motion-sheet.png`: the scenario's final action dispatched live, sampled every `intervalMs` on Playwright's **virtual clock**, so frames are deterministic and comparable between rounds. With `--reduced-motion`, the same strip is also captured with `__reduced` in the name; it must snap to the end state.
- `video/*.webm` with `--video`: real-time recording for human review. Not deterministic.
- `perf.json` with `--perf`: rAF frame intervals, JS heap, transfer. Real clock, dev server, SwiftShader software GL. Use it for relative comparison only.
- `interaction-probe.json` with `--probe`: Tab focus order and focus styling, targets under 44 CSS px, unnamed controls.
- `manifest.json`: git sha (marked `-dirty` if the tree is dirty), lab version and review state, the capture list, renderer used per run, downgrade notices, console and page errors.

Narrow a run with `--profiles`, `--viewports desktop|mobile` and `--scenarios`. The full matrix is slow on a dev server, so round 1 can use `--profiles HIGH,FALLBACK_2D` and rounds 2 and 3 capture everything.

Minimum capture set for an important lab: overview, each guided step that moves the camera, exploded and/or cutaway, process and variable states (causal labs), a fault or misconception-exposing state where one exists, challenge, assessment with checks passed. Capture each at HIGH, STANDARD, LOW and FALLBACK_2D, on desktop and mobile.

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

## Three-round autonomous polish loop

For every serious lab:

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

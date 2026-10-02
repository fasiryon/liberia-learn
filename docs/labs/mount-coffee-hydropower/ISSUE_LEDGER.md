# mount-coffee-hydropower issue ledger

This is the authoritative list of review findings for the production-review closure (mission base `e4104b32`), on branch `feat/mount-coffee-review-closure`. It merges the findings in `production.json`, the v1.1 design deltas (05–08), the RX-005/006 reviews, and the builder's verification of PR #164.

**How to read it.**
- **Status** is one of OPEN, FIXED, WONT_FIX or BLOCKED.
- **Evidence** names the commit, test or capture that proves the status.
- Every capture listed here was made with SwiftShader software GL. It supports composition and labels only, never performance.

## Carried from Round 1 (v1.0)

| Id | Round / reviewer | Sev | Finding | Scenario / profile | Status | Fix | Evidence |
|---|---|---|---|---|---|---|---|
| HYDRO-WATER-RETURN-001 | R1 science | P0 | Only unit 1 water visibly returned to the river | overview / all | FIXED | e89075d3 | round-1-e89075d3-stills |
| HYDRO-WEBGL-CITY-BLOCK-001 | R1 visual | P1 | Emissive city slab at the right edge | overview / WebGL | FIXED | e89075d3 | round-1-e89075d3-stills |
| HYDRO-MOBILE-EXPLANATION-CUE-001 | R1 visual | P1 | Mobile explanation cut off without a cue | overview / mobile | FIXED | e89075d3 | hydro-overview__HIGH__mobile.png |
| HYDRO-EXPLODED-FRAMING-001 | R1 visual | P1 | Exploded unit 3 clipped | exploded / desktop | FIXED | b06af4b2 | round-1-8a5f2573-corrections |
| HYDRO-CHALLENGE-START-001 | R1 interaction | P1 | Challenge started already met | challenge-start / all | FIXED | b06af4b2 | round-1-8a5f2573-corrections |
| HYDRO-ASSESSMENT-ORDER-001 | R1 interaction | P2 | Assessment previews out of order | assessment / all | FIXED | 3fd19aee | round-1-3fd19aee-repair-copy |
| HYDRO-ENERGY-CHAIN-EVIDENCE-001 | R1 science | P1 | S7 capture showed the wrong task | S7 / all | FIXED | cdf990e5 | round-1-cdf990e5-final-corrections |
| HYDRO-FALLBACK-LABEL-EDGE-001 | R1 visual | P2 | Crowded 2D labels in the completed-assessment scene | assessment-all-passed / FALLBACK_2D | OPEN, re-review in Round 2 (2D now has grouped control chips; scene labels still use crowd-avoidance) | — | — |
| HYDRO-MOBILE-CUTAWAY-LABELS-001 | R1 visual | P2 | LOW mobile cutaway labels crowded | cutaway / LOW mobile | FIXED | a3426aba | round-1-56758033-stills-probe-perf |
| HYDRO-FLOOD-SPILLWAY-VISIBILITY-001 | R1 science | P1 | Flood spill not readable in WebGL | flood / WebGL | FIXED (v1.0); re-check against the v1.1 spill sheet | a6caa9ad | round-1-a6caa9ad-spillway-cues |
| HYDRO-FOUNDER-IMMERSION-001 | Founder | P1 | Reads as a 2D diagram: water lines, flat primitives, panel-driven | all / HIGH | **In progress.** Built: water surfaces (`ff98d3c6`), in-scene controls (`ddbf8e41`), daylight rig (`298f7181`), working three.js renderer and grouped controls (`3dfee8df`). Design-director verdict pending. | see Status column | builder-inspect captures; Round 3 |

## v1.1 design and review findings

| Id | Source | Sev | Finding | Status | Fix | Evidence |
|---|---|---|---|---|---|---|
| HYDRO-PEDAGOGY-BLIND-TOGGLE-001 | 05 pedagogy (carried from v1.0) | **P0** | Challenge / `dry-season-peak` passable by blind toggling (1 in 8) | FIXED: smaller feeder blocks (founder decision) | f7520d7e | `hydropower-model.test.ts`: 1/50 feeder settings, 4/1250 overall |
| HYDRO-PEDAGOGY-S1-DUPLICATE-001 | 05 pedagogy | P1 | Guided S1 duplicated the trace assessment | FIXED | f7520d7e | `hydropower-definition.test.ts` |
| HYDRO-PEDAGOGY-DRY-OUTPUT-PROMPT-001 | 05 pedagogy | P1 | `dry-season-output` prompt gave the answer | FIXED | f7520d7e | definition test, V16 |
| HYDRO-DESIGN-LOW-DRAWS-001 | 08 asset (P0 ASSET) | P0 | LOW would exceed 40 draws with the v1.1 parts | FIXED: RX-006 planner; LOW 33/40 | 4433c0ba, ddbf8e41 | `lab-budgets.test.ts` |
| HYDRO-PERF-THREE-DEV-CONTEXT-001 | Builder verification of #164 | **P0** | three.js HIGH renderer never rendered in dev or review (StrictMode plus forceContextLoss), so all HIGH captures were 2D | FIXED | 3dfee8df | builder-inspect-3 manifest `surface: webgl`, `data-lab-renderer` = `three@186` |
| HYDRO-PERF-STANDARD-DRAWS-001 | Builder | P1 | STANDARD 93/90 draws after the v1.1 parts (one mesh per part) | FIXED: InstancedMesh via the shared planner; 57/90 | ddbf8e41 | `lab-budgets.test.ts` |
| HYDRO-VISUAL-CONTROL-STACKING-001 | Builder (builder-inspect-2) | P1 | Control chips stacked over each other | FIXED: grouped chip rows | 3dfee8df | builder-inspect-3 |
| HYDRO-VISUAL-LABEL-BUDGET-001 | RX-005 A11 / builder | P1 | About 16 labels on HIGH | FIXED: budget of 8 | 3dfee8df | builder-inspect-3 |
| HYDRO-VISUAL-FRONTAL-CAMERA-001 | RX-005 A11 / design review | P1 | Frontal establishing view | FIXED: 3/4 valley preset, widened limits | 3dfee8df | builder-inspect-3 |
| RX-005i | Codex disposition | — | glTF loader rejected for Phase 0, against the founder's "glTF into Phase 0" | Recorded for founder follow-up; not needed by procedural Mount Coffee | — | RX-005 A20 disposition |

## Round 2 (CI captures at 3fe1837a / 6050f0f1; fixes at 7a409dfe..ad4f47cb)

Reviewers: `lab-visual-reviewer`, `lab-pedagogy-director` on GitHub Actions captures (SwiftShader; composition only). The keyboard walkthrough and probe ran on CI at 81dc28c7. "FIXED" means fixed in code with a test; each is re-verified on the r2-fixes recapture (run 37059436767) before Round 3.

| Id | Reviewer | Sev | Finding | Status | Fix | Evidence |
|---|---|---|---|---|---|---|
| HYDRO-R2-V-INSIDE-UNIT-001 | visual | **P0** | Unit 3 internals and generating units missing or vanishing on 3D | FIXED. Root cause: near-opaque parts (alpha 0.96) were drawn as transparent and depth-sorted behind the depth-writing translucent shell. Now alpha ≥ 0.95 is opaque, and translucent parts never write depth. | 7a409dfe | r2-fixes cutaway/exploded stills |
| HYDRO-R2-V-FEEDBACK-001 / HYDRO-R2-P-P0-1 | visual + pedagogy | **P0** | Trip and city feedback, and supply against demand, not readable in the scene | FIXED: scene HUD (Plant can make / City asks for / Spare / River / Units on), red trip banner, challenge status under the scene; larger, separated city blocks; challenge opens on the city camera | 0a409a6f, 4ccd8966 | `SceneHud.tsx`; r2-fixes challenge stills |
| HYDRO-R2-V-MOBILE-001 | visual | **P0** | Mobile 2D and LOW unreadable | FIXED: horizontal-FOV fit on portrait (3D), narrow-screen framing and 8-label budget (2D), LOW ground plane | 7a409dfe | r2-fixes mobile stills |
| HYDRO-R2-V-SPILL-PATH-001 | visual | P1 | Spill path drawn through the powerhouse | FIXED: spillway gate, flow and surface moved beside the powerhouse (x −3.3) | 4ccd8966 | flood stills |
| HYDRO-R2-V-RIGHT-COLUMN-001 | visual | P1 | Right column clips Next and challenge status | FIXED: shorter explanation panel; challenge status also in the HUD | 0a409a6f | desktop stills |
| HYDRO-R2-V-LABEL-LEAK-001 | visual | P1 | Labels and inspect targets leak outside the scene | FIXED: overlays clip to the scene | 7a409dfe | — |
| HYDRO-R2-V-PENSTOCK-001 | visual | P1 | Penstock label sits off the pipe; highlight is yellow (yellow means electricity) | FIXED: label on the pipe; highlight uses the shared token | 7a409dfe, 4ccd8966 | — |
| HYDRO-R2-V-FIXTURES-001 / HYDRO-R2-P-P1-8 | visual + pedagogy | P1 | Scenario fixtures showed the wrong state or no guided step | FIXED: S2 starts unit 1 from zero; S4/S5/S6 carry their guided step; added the idle-units dry scene | 2717eb52 | `referenceScenarios.ts`, definition tests |
| HYDRO-R2-V-2D-BANDS-001 | visual | P1 | 2D water drawn twice (part fill + surface) and label collisions | FIXED: surface-drawn parts get no fill; label budget | 7a409dfe | FALLBACK_2D stills |
| HYDRO-R2-V-CONTROL-COUNTS-001 | visual | P1 | Control bar gives no counts | FIXED: groups show values (e.g. "Homes blocks on 0/4", "49 m³/s") | 0a409a6f | — |
| HYDRO-R2-V-LOW-GROUND-001 | visual | P1 | LOW has no ground | FIXED: one ground draw (counted in the LOW budget) | 7a409dfe | `lab-budgets.test.ts` |
| HYDRO-R2-P-P1-1 | pedagogy | P1 | Challenge solvable by shedding everything until the hospital is lit | PARTLY FIXED: the challenge now starts under-loaded (hospital only) and asks for a prediction, so the learner must add load that fits. **Founder decision still open:** trip latching / commit-before-energise. | 4ccd8966 | definition test "R2 P1-1/P1-3" |
| HYDRO-R2-P-P1-2 | pedagogy | P1 | `dry-season-output` passed while tripped or with one unit | FIXED: the check reads `capabilityAllUnitsMW` (0 unless four units are on) | 4ccd8966 | definition test "R2 P1-2" |
| HYDRO-R2-P-P1-3 | pedagogy | P1 | Assessment pre-satisfied by the challenge state | FIXED: `modeStart.ASSESSMENT` restores initial conditions | 0a409a6f, 4ccd8966 | definition test |
| HYDRO-R2-P-P1-4 | pedagogy | P1 | S5 tripped by default, hiding the capability drop | FIXED: S5 sheds load first | 2717eb52 | spin-glyph test |
| HYDRO-R2-P-P1-5 | pedagogy | P1 | Generator not visible after the cutaway | FIXED (same root cause as INSIDE-UNIT-001); narrower shell; bladed runner distinguishes runner from generator | 7a409dfe, 4ccd8966 | cutaway stills |
| HYDRO-R2-P-P1-6 | pedagogy | P1 | Explanation led with the static chain | FIXED: state lines first; safety first when tripped or spilling | 4ccd8966 | model test |
| HYDRO-R2-P-P1-7 | pedagogy | P1 | Gauge segments misstated MW | FIXED: supply and demand rows, length ∝ MW | 4ccd8966 | — |
| HYDRO-R2-P-UNIT-LAMP-001 | pedagogy | P2 | Idle units' lamps glowed | FIXED: lamp intensity 1 only when generating | 4ccd8966 | — |
| HYDRO-R2-P-EVENING-PEAK-001 | pedagogy | P2 | "Evening peak" implied a time model the lab lacks | FIXED: removed | 4ccd8966 | — |
| HYDRO-R2-P-BOTTLE-CAP-001 | pedagogy | P2 | Missing the local bottle-cap wheel analogy | FIXED: dry-season line | 4ccd8966 | — |
| HYDRO-R2-V-RAIN-FLOOD-001 | visual | P2 | Rainy and flood look similar | WONT_FIX (this release): widths follow the approved √(Q/557) mapping; flood is distinguished by the spill surface and HUD banner | — | 06 water sheet |
| HYDRO-R2-V-ROUTE-LINES-001 | visual | P2 | Trace routes still drawn as lines | WONT_FIX: routes are the trace affordance; water itself is drawn by surfaces | — | RX-005b |
| HYDRO-R2-V-DECOR-SALIENCE-001 | visual | P2 | Grey-box decor reads as placeholder | DEFERRED to Round 3 design director | — | — |
| HYDRO-R2-I-WALKTHROUGH-2D-001 | interaction (CI walkthrough) | P1 | FALLBACK_2D keyboard walkthrough failed 9 steps | FIXED in the harness, not the lab: the 2D part "Headpond" matched before the panel trace chip, and the panel was more than 160 Tabs away. Panel-scoped steps; 400-Tab cap. The Tab count to reach the panel on 2D is itself recorded as an interaction finding for Round 3. | ad4f47cb | r2-fixes walkthrough.json |

Round 3 appends below.

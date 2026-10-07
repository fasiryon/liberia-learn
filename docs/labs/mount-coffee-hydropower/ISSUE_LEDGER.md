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
| HYDRO-FOUNDER-IMMERSION-001 | Founder | P1 | Reads as a 2D diagram: water lines, flat primitives, panel-driven | all / HIGH | **In progress.** Built: water surfaces (`ff98d3c6`), in-scene controls (`ddbf8e41`), daylight rig (`298f7181`), working three.js renderer and grouped controls (`3dfee8df`). Round 3 design director: still OPEN (HYDRO-R3D-007); terrain, trees, sky and water surfaces are a real improvement, but the machine and city read as placeholders. | see Status column | builder-inspect captures; Round 3 |

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
| HYDRO-R2-V-RIGHT-COLUMN-001 | visual | P1 | Right column clips Next and challenge status | REOPENED as HYDRO-R3D-005 (design director, r3-final): the desktop right column still clips Next step / challenge status. The challenge status is also in the HUD | 0a409a6f | desktop stills |
| HYDRO-R2-V-LABEL-LEAK-001 | visual | P1 | Labels and inspect targets leak outside the scene | FIXED: overlays clip to the scene | 7a409dfe | — |
| HYDRO-R2-V-PENSTOCK-001 | visual | P1 | Penstock label sits off the pipe; highlight is yellow (yellow means electricity) | FIXED: label on the pipe; highlight uses the shared token | 7a409dfe, 4ccd8966 | — |
| HYDRO-R2-V-FIXTURES-001 / HYDRO-R2-P-P1-8 | visual + pedagogy | P1 | Scenario fixtures showed the wrong state or no guided step | FIXED: S2 starts unit 1 from zero; S4/S5/S6 carry their guided step; added the idle-units dry scene | 2717eb52 | `referenceScenarios.ts`, definition tests |
| HYDRO-R2-V-2D-BANDS-001 | visual | P1 | 2D water drawn twice (part fill + surface) and label collisions | FIXED: surface-drawn parts get no fill; label budget | 7a409dfe | FALLBACK_2D stills |
| HYDRO-R2-V-CONTROL-COUNTS-001 | visual | P1 | Control bar gives no counts | FIXED: groups show values (e.g. "Homes blocks on 0/4", "49 m³/s") | 0a409a6f | — |
| HYDRO-R2-V-LOW-GROUND-001 | visual | P1 | LOW has no ground | FIXED: one ground draw (counted in the LOW budget) | 7a409dfe | `lab-budgets.test.ts` |
| HYDRO-R2-P-P1-1 | pedagogy | P1 | Challenge solvable by shedding everything until the hospital is lit | FIXED: the challenge starts under-loaded (4ccd8966), and the founder decision of 2026-10-02 makes trips latched. Shedding load never restores power by itself; the learner must diagnose, correct, then press Reset plant. | 4ccd8966, a91d3a80 | `hydropower-protection.test.ts`; CI walkthrough (trip → refused reset → correct → reset → challenge met) on 4 profiles × desktop/mobile, run 37061766748 |
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
| HYDRO-R2-V-DECOR-SALIENCE-001 | visual | P2 | Grey-box decor reads as placeholder | Absorbed into HYDRO-R3D-007 (grey-box dominance, OPEN) | — | — |
| HYDRO-R2-I-WALKTHROUGH-2D-001 | interaction (CI walkthrough) | P1 | FALLBACK_2D keyboard walkthrough failed 9 steps | FIXED in the harness, not the lab: the 2D part "Headpond" matched before the panel trace chip, and the panel was more than 160 Tabs away. Panel-scoped steps; 400-Tab cap. Round 3 closed it: on FALLBACK_2D, "Challenge" is 38 Tabs from the top (it was more than 160), and the skip link is the 2nd Tab stop. | ad4f47cb | r2-fixes walkthrough.json |

## Latched trip / Reset plant (founder decision 2026-10-02)

The founder locked the rule: overload trips are LATCHED. Load and unit changes apply immediately. An overload trips the plant, and learner choices are kept. Power never returns automatically. An explicit **Reset plant** is accepted only when demand ≤ available generation and a unit is generating; otherwise the UI states the exact reason. There is no commit-load workflow.

| Item | Status | Evidence |
|---|---|---|
| Engine: generic `spec.protection` (latch variable, overload quantity, reset blocker), `reset-protection` action; mode and guided-step starts clear the latch | IMPLEMENTED | a91d3a80, 22c5a2ed; `engine.ts` |
| Model 1.2.0: `tripped = overload ∨ latched`; the reset blocker names the shortfall (or that no unit is on) | IMPLEMENTED | `hydropowerModel.ts`; `hydropower-protection.test.ts` (latch, no auto-recovery, units/loads while tripped, blocked/accepted reset, re-trip, challenge, assessment, determinism, checkpoint validity, RAW_OBSERVATION only) |
| HUD and panel Reset plant (aria-disabled + described reason while blocked; focused "power restored" status after) | IMPLEMENTED | `ProtectionReset.tsx`; stills `hydro-fault-overload-trip`, `hydro-fault-shed-not-reset`, `hydro-challenge-reset-solved` (runs 37061766748, 37065728208) |
| Keyboard flow: trip → refused reset → correct → reset → challenge met; assessment resets before `dry-season-peak` | PASS | `walkthroughs.ts`; 8/8 walkthroughs, 0 failed steps (run 37061766748) |

## Round 2 fix verification (lab-visual-reviewer, run 37059436767 at ad4f47cb, 224/224 stills PASS renderer identity)

Of 18 Round 2 items, 9 were VERIFIED, 9 PARTLY verified, and none REGRESSED. The trip/reset UI was VERIFIED. The reviewer raised the new findings below. Every row marked FIXED is re-checked on the final capture (r3-final, run 37073814606); see the Round 3 verdict.

| Id | Sev | Finding | Status | Fix |
|---|---|---|---|---|
| HYDRO-R3V-001 | **P0** | The S2 "water starts" fixture showed a tripped plant (1 unit against 68 MW) | FIXED: the fixture switches load off first. Test: unit 1 generates, 107.5 m³/s through the turbine | 22c5a2ed |
| HYDRO-R3V-002 | **P0** | FALLBACK_2D city had no lit/dark state | FIXED: energised parts get a warm fill in 2D (the same `intensity` the 3D emissive uses) | 22c5a2ed |
| HYDRO-R3V-003 | **P0** | Phone-portrait 2D unreadable (thin strip in a tall frame) | FIXED: a tighter near-square 2D window on phones; city preset re-centred on the city (x 6 → 6.6) | 22c5a2ed |
| HYDRO-R3V-004 | P1 | 2D labels covered by trace nodes and geometry | FIXED: labels drawn last, on plates | 22c5a2ed |
| HYDRO-R3V-005 | P1 | "Spillway gate" drawn over "Headpond" in the powerhouse camera | FIXED: shared screen-space label placer (`labelLayout.ts`) skips overlapping labels | 22c5a2ed |
| HYDRO-R3V-006 | P1 | "Powerhouse" label anchored on the spill chute | FIXED: anchored on the roof | 22c5a2ed |
| HYDRO-R3V-007 | P1 | Unit internals unlabelled; runner low contrast | FIXED: labels rank by distance from the frame centre (focused cameras name what they frame); bronze runner | 22c5a2ed |
| HYDRO-R3V-008 | P1 | Yellow (electricity) trace/selection markers | FIXED: 3D and 2D trace markers use the shared lime MARKER_COLOR | 22c5a2ed |
| HYDRO-R3V-009 | P1 | City camera had no Hospital/Homes/Shops labels | FIXED: only on-screen labels count against the budget | 22c5a2ed |
| HYDRO-R3V-010 | P1 | S3 and S6-fault fixtures showed "Step 1 of 7" | FIXED: they carry the machine / overload step (test) | 22c5a2ed |
| HYDRO-R3V-011 | P1 | Desktop "What is happening" cut mid-line with no cue | FIXED: scroll cue on all sizes plus a fade | 22c5a2ed |
| HYDRO-R3V-012 | P1 | Gauge unlabelled; supply row at full length in the dry season | FIXED for length (with HYDRO-R3S-004). Row labels are DEFERRED (P2): the HUD carries labelled supply/demand numbers on every profile | bcb40c42 |
| HYDRO-R3V-013 | P1 | LOW labels pile up; spin glyphs cover them | FIXED: glyphs are obstacles for label placement | 22c5a2ed |
| HYDRO-R3V-014 | P2 | Edge-clipped label fragments | FIXED on WebGL (labels must fit wholly on screen) | 22c5a2ed |
| HYDRO-R3V-015 | P2 | Uppercase "M³/S"; "SWIT CHYARD" gap | DEFERRED | — |
| HYDRO-R3V-016 | P2 | "Challenge met" uses the amber style | DEFERRED | — |
| HYDRO-R3V-017 | P2 | Trip message repeated (banner, status, panel) | PARTLY: generic Reset renamed (HYDRO-R3I-006); merging is DEFERRED | 22c5a2ed |
| HYDRO-R3V-018 | P2 | Mobile shows two control surfaces | DEFERRED (the panel twin is the accessible slider form) | — |
| HYDRO-R3V-019 | P2 | Unexplained brown bar / outline in some 2D states | DEFERRED | — |
| HYDRO-R3V-020 | P2 | 2D highlighted tailrace drawn twice | DEFERRED | — |

## Interaction review (lab-interaction-reviewer, runs 37061766748 / 37065728208): PASS_WITH_FIXES, 0 P0, 6 P1, 8 P2

| Id | Sev | Finding | Status | Fix |
|---|---|---|---|---|
| HYDRO-R3I-001 | P1 | The guided path hits the latch unannounced (step 4 dry trips; step 5 starts with shops 4/4) | FIXED: guided steps carry start states (`GuidedStep.variables`, validated, clear the latch); the overload prompt names Reset plant | 22c5a2ed |
| HYDRO-R3I-002 | P1 | A check made before reset gave an arithmetic hint | FIXED: while tripped, the hint names the reset (or the blocker) | 22c5a2ed |
| HYDRO-R3I-003 | P1 | A successful reset dropped focus to the body with no confirmation | FIXED: a focused "Plant reset: power restored" status | 22c5a2ed |
| HYDRO-R3I-004 | P1 | Hospital chip `aria-pressed` was always false | FIXED: toggles report on; step chips carry no `aria-pressed` | 22c5a2ed |
| HYDRO-R3I-005 | P1 | Focus ring about 1.6:1; 2D parts have almost none | FIXED: lab-scoped opaque white ring with a dark halo; 4 px dark stroke on focused SVG parts; forced-colors fallback | 22c5a2ed |
| HYDRO-R3I-006 | P1 | Generic "Reset" wipes progress and reads like Reset plant | FIXED: "Restart lab (clears progress)" with an inline confirm (no browser dialog) | 22c5a2ed |
| HYDRO-R3I-007 | P2 | A refused reset gives no new feedback | DEFERRED: the reason is visible beside the button and is its description | — |
| HYDRO-R3I-008 | P2 | Live-region behaviour (alert mounting, chatty explanation list) | DEFERRED: needs a real screen-reader test | — |
| HYDRO-R3I-009 | P2 | `dry-season-output` raises an expected trip banner | DEFERRED | — |
| HYDRO-R3I-010 | P2 | Zero-units blocker led with a demand shortfall | FIXED | 22c5a2ed, bcb40c42 |
| HYDRO-R3I-011 | P2 | Why power did not return ranked below safety | FIXED: trip diagnosis, then its caveated explanation, then safety | 1ab0a316, bcb40c42 |
| HYDRO-R3I-012 | P2 | Visible chip text differs from the accessible name (WCAG 2.5.3); selected season chip is `disabled` | DEFERRED | — |
| HYDRO-R3I-013 | P2 | Walkthrough never uses the skip link or the panel twin; probe covers the overview only | DEFERRED | — |
| HYDRO-R3I-014 | P2 | Sticky panel overlap, update toast, `touch-none` scene swallows page scroll on mobile | DEFERRED | — |

## Round 3 science (lab-science-reviewer, model 1.2.0): PASS_WITH_FIXES, 2 P0, 2 P1, 7 P2; no STOP

42 claims checked: 28 ACCURATE, 9 PEDAGOGICAL_SIMPLIFICATION, 4 MISLEADING, 1 INCORRECT. The latched trip is an acceptable educational simplification: restoration is operator-driven, and load is reconnected only when generation can carry it.

| Id | Sev | Finding | Status | Fix |
|---|---|---|---|---|
| HYDRO-R3S-001 | **P0** | `max-served` claimed "the most load this supply can carry" with 20 MW spare (initial state) | FIXED: only when a block is still off; all-on states say how much is spare (test) | bcb40c42 |
| HYDRO-R3S-002 | **P0** | Bottle-cap line said a fuller stream turns the wheel faster (misconception 3) | FIXED: bridges to the generator's steady speed (test) | bcb40c42 |
| HYDRO-R3S-003 | P1 | The latch was stated as real-world fact; the caveat was hidden | FIXED: "(simplified model)", "In this model … here", mention of real automatic load shedding; caveated line above safety | bcb40c42 |
| HYDRO-R3S-004 | P1 | Supply gauge length did not follow MW | FIXED: `componentStates.fill`, a left-anchored length (test) | bcb40c42 |
| HYDRO-R3S-005 | P2 | Capability vs output wording ("make 66 MW", HUD while tripped) | PARTLY: the latched line says "could make"; the rest is DEFERRED | bcb40c42 |
| HYDRO-R3S-006 | P2 | Tripped spill not explained | FIXED: `trip-spill` line | bcb40c42 |
| HYDRO-R3S-007 | P2 | "No unit is making power" is true in every trip | FIXED: "no unit is switched on"; advice is conditional on demand | bcb40c42 |
| HYDRO-R3S-008 | P2 | "About one unit" in the dry season | FIXED: "less than half of what one unit can take" | bcb40c42 |
| HYDRO-R3S-009 | P2 | Mention automatic partial load shedding | FIXED (caveat) | bcb40c42 |
| HYDRO-R3S-010 | P2 | Rotor magnet is an electromagnet in big generators | FIXED | bcb40c42 |
| HYDRO-R3S-011 | P2 | Powerhouse label by the spill chute; yellow unit lamps | Label FIXED (HYDRO-R3V-006); the lamp colour is DEFERRED to the design director | 22c5a2ed |

## Round 3 performance (lab-performance-reviewer): PASS_WITH_FIXES, 0 P0, 5 P1, 4 P2; physical devices UNVERIFIED

Measured on SwiftShader (draw calls are deterministic; timings do not count). HIGH has 79 planned draws against a limit of 120, STANDARD 59 against 90 (63 measured), and LOW 34 against 40 (34 measured). The offline package is 59,045 of 96,000 bytes with no remote assets.

| Id | Sev | Finding | Status | Fix |
|---|---|---|---|---|
| HYDRO-R3P-001 | P1 | Profile oscillation: a downgrade never blocked a re-upgrade | FIXED: the downgrade is remembered per runtime version and blocks auto-upgrade (test) | bcb40c42 |
| HYDRO-R3P-002 | P1 | ThreeScene rebuilt the overlay DOM every rendered frame | FIXED: at most every 120 ms or on a state change, with a trailing refresh | bcb40c42 |
| HYDRO-R3P-003 | P1 | The HIGH/STANDARD draw planner does not match three.js `renderer.info` (−10 to +5); the shadow pass is never measured | **CLOSED (accounting).** Planner equals `renderer.info` on 96/96 HIGH, STANDARD and LOW stills, HIGH including the measured shadow pass (performance re-check 2026-10-06) | CI run 37429556324 at c0e77a6d |
| HYDRO-R3P-004 | P1 | Baseline re-based across 7 commits without the required record | FIXED: one dedicated baseline commit with before and after for every lab | 8898c3ab |
| HYDRO-R3P-005 | P1 | The frame-monitor rAF never idles, ignores visibility, and samples idle frames | **CLOSED (code and unit tests).** Offscreen/hidden pausing and the 30 fps ambient cap; browser pausing and fps are not measured | `scene-activity.test.ts`; performance re-check 2026-10-06 |
| HYDRO-R3P-006 | P2 | LOW has no 30 fps ambient cap and allocates per frame | **CLOSED (accounting/lifecycle), final run 37489886085.** LOW 30 fps cap; batch buffers persist and grow geometrically (create 0 / bufferData 0 after warm-up). The per-frame flow-tube rewrite found in review is signature-cached at 90eff6c6 | run 37429556324; 90eff6c6 |
| HYDRO-R3P-007 | P2 | The ThreeScene material cache grows with continuous emissive values | OPEN | — |
| HYDRO-R3P-008 | P2 | Context-loss handler lacks `preventDefault`; shadow box not fitted; passive-wheel `preventDefault` | OPEN | — |
| HYDRO-R3P-009 | P2 | Protection code costs | No change needed | — |

Runtime extensions, per the performance reviewer:
- **RX-005: PROPOSED.** Local code/tests cover renderer parity planning, scene activity, determinism, chunk size and the shared runtime slices. Fresh current-head Chromium evidence remains outstanding for 20× remounts, byte-identical captures, built chunk/import/zero-request checks, abort fallback and measured renderer.info/shadow parity.
- **RX-006: PROPOSED, partly implemented.** LOW uses per-vertex color/emission, reusable per-component ranges, cached membership and WebGL1-safe chunk caps; Mount Coffee measures 26/40 LOW draws. State-transition/planner tests pass. Browser proof for actual buffer identity/allocation, picking and cross-profile challenge-state capture parity remains outstanding.

## Round 3 design director (lab-design-director, r3-final at 8898c3ab): DO_NOT_SHIP, 0 P0, 9 P1, 4 P2

The director inspected 16 HIGH stills (desktop and mobile). Before its turn limit it did not inspect the STANDARD, LOW or FALLBACK_2D stills, the assessment scenarios, the motion strips or the probe; that coverage gap is itself recorded as a blocker. The six benchmark reference captures listed in `production.json` (`fixture-simple-circuit/1.0.0/smoke/*`, `g4-solid-figures/2.1.0/smoke/*`) are not on disk, so scores were made against the written reference breakdown in design/02 and are marked UNVERIFIED-REFERENCE.

| Id | Sev | Finding | Status |
|---|---|---|---|
| HYDRO-R3D-001 | P1 | Trip/restoration consequences across profiles | FIXED: Warm energized city material, separate available capacity/delivered MW, zero-delivery trip and exact blocker/reset state. Trip, safe-not-reset and restored scenes reviewed. See Stage B closure below. |
| HYDRO-R3D-002 | P1 | Portrait city framing | FIXED: Fit all city block bounds, preserve Hospital/Homes/Shops labels and keep phone controls clear of labels. See Stage B closure below. |
| HYDRO-R3D-003 | P1 | Cutaway/exploded instructional framing and runner salience | BLOCKED: Engineering framing, runner annotation and route obstruction are FIXED. Remaining slender-spoke rotor form/salience requires the separately scoped asset track (R3D-007 / FOUNDER-IMMERSION); no major asset rebuild or new mechanics in Stage B. Cutaway/exploded benchmark remains BELOW. See Stage B closure below. |
| HYDRO-R3D-004 | P1 | Guided prompts contradict actual state | FIXED: Use actual guided index, exposed stack, live capacity/demand/latch/reset reason, and selected seasonal/turbine flow. Zero-turbine flood wording is covered by a state-transition regression test and independent source-copy re-review. See Stage B closure below. |
| HYDRO-R3D-005 | P1 | Desktop Next step/challenge clipping | FIXED: Remove sticky explanation overlay; independently scroll explanation and outer control column. Actual desktop Next and challenge HUD/panel reviewed; keyboard reaches downstream controls. See Stage B closure below. |
| HYDRO-R3D-006 | P1 | **IMPROVED.** The phone bottom-sheet peek shows the challenge objective on first paint; the Challenge-mode overflow it exposed is fixed at 90eff6c6 | run 37429556324; 90eff6c6 |
| HYDRO-R3D-007 | P1 | Grey-box dominance: the plant and city still read as placeholders; a beige occluder in the city camera | OPEN. Keeps HYDRO-FOUNDER-IMMERSION-001 OPEN (partly addressed) and absorbs HYDRO-R2-V-DECOR-SALIENCE-001 |
| HYDRO-R3D-008 | P1 | Idle/generating unit readability | FIXED: Naturally touched by R4V-005: every profile has readable status glyph and named HUD state; 2D glyph now painted after its polygon. See Stage B closure below. |
| HYDRO-R3D-009 | P1 | Missing benchmark references and inferred scores | FIXED: Regenerate six legitimate internal references via documented tooling on 8ca0dd9d; retain manifests/provenance and re-score nine dimensions using actual file pairs. Eight MEETS, one BELOW; device/art evidence remains UNVERIFIED. See Stage B closure below. |
| HYDRO-R3D-010 | P2 | Unlabelled gauge strip | FIXED: Naturally touched: scene legend explains upper available capacity (22 MW per segment), lower demand and zero delivery during trip. See Stage B closure below. |
| HYDRO-R3D-011 | P2 | Trace route dots clutter non-trace beats | DEFERRED |
| HYDRO-R3D-012 | P2 | "Challenge met" uses the warning style; the trip message appears three times | DEFERRED (with HYDRO-R3V-016/017) |
| HYDRO-R3D-013 | P2 | In-scene controls lack a visible affordance in stills | DEFERRED |

Benchmark scores: Local relevance BEATS; Cause-to-consequence, Guided pacing, Label legibility, Correct wow moment and Scene readability MATCHES; **Cutaway and exploded clarity BELOW** and **Camera choreography BELOW** (no LOW/offline/accessibility trade-off applies); **Reach on LOW and FALLBACK_2D UNSCORED**. Every score is UNVERIFIED-REFERENCE.

## Final verdict (2026-10-03): DO_NOT_SHIP

Product-quality readiness only. This is not curriculum, founder or MOE approval, and it does not release anything. Mount Coffee remains DRAFT, approval PENDING, unreleased, curriculum linkage inactive and student-inaccessible.

- **Open P0: 0.** Every P0 from Rounds 1–3 is FIXED and verified on new captures. The Round 2 P0s and the Round 3 visual P0s (S2 fixture, 2D lit state, 2D phone framing) are verified in the r3-final stills; the science P0s (max-served, bottle-cap) are verified by tests.
- **Open P1: 12.** The nine design-director P1s HYDRO-R3D-001 to -009 (R3D-002 partly fixed), HYDRO-R3P-003 (planner/`renderer.info` parity), HYDRO-R3P-005 (partly fixed; IntersectionObserver and 30 fps-cap acceptance) and HYDRO-FOUNDER-IMMERSION-001. HYDRO-R2-V-RIGHT-COLUMN-001 is reopened as HYDRO-R3D-005.
- **Runtime governance:** RX-005 and RX-006 stay PROPOSED because their acceptance lists are incomplete. `validateProductionRecord` refuses SHIP_CANDIDATE while either is PROPOSED, so this is an independent blocker.
- **Blockers to clear before SHIP_CANDIDATE:** the open design P1s; benchmark references restored and every quality scored with no BELOW; a full director pass over STANDARD, LOW and FALLBACK_2D; and the RX-005/RX-006 acceptance items, with planner parity as the first.

## RX-005 / RX-006 bounded re-check (2026-10-06)

Performance, interaction and visual reviewers re-checked the runtime-related blockers on CI run 37429556324 (c0e77a6d). Findings fixed in 90eff6c6 and verified CLOSED by final run 37489886085 at ae3a1ec0:

| ID | Lens | Sev | Finding | Status |
|---|---|---|---|---|
| HYDRO-R4P-001 | performance | P1 | Round-sprite shader failed to compile on every HIGH/STANDARD still (mid-line `#include`); the harness did not fail on console errors | FIXED (90eff6c6); capture now fails on shader errors |
| HYDRO-R4P-002 | performance | P1 | A chunk load failure did not block auto-upgrade (offline HIGH/LOW loop) | FIXED (90eff6c6) |
| HYDRO-R4P-003 | performance | P1 | WebGL1 devices: renderer creation failure persisted FALLBACK_2D | FIXED (90eff6c6): WebGL2 gate, creation failure falls to LOW |
| HYDRO-R4P-004 | performance | P1 | No context-loss test | FIXED (90eff6c6): browser test in runtime-acceptance |
| HYDRO-R4P-005 | performance | P2 | LOW rewrote and re-uploaded flow tubes every frame | FIXED (90eff6c6) |
| HYDRO-R4I-001 | interaction/visual | P1 (visual P0) | Challenge mode on phones overflowed sideways; controls and city off-screen | FIXED (90eff6c6): min-w-0 columns |
| HYDRO-R4I-002 | interaction | P1 | Large parts' screen boxes stole taps from the gauge bands and breakers | FIXED (90eff6c6): control parts first inside real bounds |
| HYDRO-R4I-003 | interaction/visual | P1 | Peek showed a static energy-chain line, not the trip | FIXED (90eff6c6) |
| HYDRO-R4I-004 | interaction | P1 | Chips that became disabled dropped keyboard focus | FIXED (90eff6c6): aria-disabled |
| HYDRO-R4I-005 | interaction | P1 | Confirm preview not reliably announced | FIXED (90eff6c6) |
| HYDRO-R4I-006 | interaction | P1 | Resistor drag about 2 px per step on a phone; taps jumped the value | FIXED (90eff6c6): longer axis, 6 px dead-zone |
| HYDRO-R4V-001 | visual | P1 | Status lamps stacked on unit 3's section parts; unit 3 missing from the HUD list | FIXED (90eff6c6) |
| HYDRO-R4V-002 | visual | P1 | Idle dashed tubes dominated the frame and overdrew running flows on LOW | FIXED (90eff6c6): thinner neutral idle tubes drawn first |

Disposition after final acceptance closure (2026-10-06):

| ID | Lens | Sev | Finding | Owner |
|---|---|---|---|---|
| HYDRO-R4V-003 | visual | P0 | FALLBACK_2D drops part and unit labels the 3D profiles carry (runner, shaft, unit housings) | CLOSED: shared label parity/priority at d3581b42; final 408 captures PASS |
| HYDRO-R4V-004 | visual | P1 | LOW labels drift onto the wrong parts (no leaders; step-relevant parts not prioritised) | CLOSED: part-space anchoring and priority at d3581b42; final LOW 102 captures PASS |
| HYDRO-R4I-007 | interaction | P1 | Phone scene targets for breakers and gauge bands are 6 to 16 px | FIXED: 44 CSS px native-button hit proxies, 4 px separation, measured nine-point hit coverage and expected visible-control completeness. Dedicated season/feeder presets and panel twins preserve actual geometry and keyboard actions. See Stage B closure below. |
| HYDRO-R4I-008 | interaction | P2 | A14 in-scene "Confirm?" label and shared affordance token missing | CLOSED: shared token/label at d3581b42; tests and final captures |
| HYDRO-R4I-009 | interaction | P2 | HIGH to LOW downgrade does not carry the orbited pose | CLOSED: carried pose at d3581b42; continuity tests |
| HYDRO-R4V-005 | visual | P2 | Lit-city colour differs by profile; idle glyph small; gauge strip unlabelled | FIXED: Shared warm energized material, larger readable status glyphs (SVG drawn above its shape), textual status list and upper-capacity/lower-demand legend. See Stage B closure below. |
| HYDRO-R4P-006 | performance | P2 | Uncaught chunk-abort page errors; chunk gate needs a cumulative anchor; parity gates not on PR CI | OPEN only for known chunk-abort page errors; cumulative cap and automatic PR parity CLOSED |

## Current runtime acceptance — 2026-10-06

RX-005 and RX-006 are **IMPLEMENTED** together; historical PROPOSED and pending-evidence statements above are superseded. Final runs 37489886085 / 37489902558 at ae3a1ec05967fb249b3490f4d3598f7989640611 verify the R4 fixes, 552 captures and 552 deterministic pairs. R4P-001–005, R4I-001–006 and R4V-001–004 are CLOSED for their runtime symptoms. R4I-008/009 are CLOSED. R3P-003/005/006 are closed for accounting/code/lifecycle, without phone performance certification. Both required final reviewers ACCEPT; exact rationale and limitations are in REVIEW_LOG.md.

New bounded design P2 HYDRO-RX-A7-EDGE-001: coarse desktop ground-shadow edges beneath right-hand breaker blocks in cutaway/exploded GPU stills. Nonblocking A7 acceptance; any later smoothing must retain the accepted 1024 px cost. R4P-006 remains open only for the two dev-server aborted-chunk page errors (52/52 walkthrough steps complete). R4I-007 and R4V-005, the named product/benchmark/art/immersion findings and physical-device limitations remain open. Mount Coffee remains DRAFT/PENDING/UNRELEASED, curriculum inactive, student inaccessible, DO_NOT_SHIP.


## Stage B current disposition — 2026-10-07

This section supersedes historical product statuses/scores above; RX-005/RX-006 remain IMPLEMENTED. Source `5fe8f3ca17dad18b020e30b77eb536ef6d2604cd`, PR #170, independent bounded review in [STAGE_B_REVIEW.md](STAGE_B_REVIEW.md). FIXED means CLOSED within the stated scope; source/capture evidence is preserved in [evidence/stage-b-polish](evidence/stage-b-polish/).

| Finding | Current status | Disposition |
|---|---|---|
| HYDRO-R3D-001 | FIXED | Warm energized city material, separate available capacity/delivered MW, zero-delivery trip and exact blocker/reset state. Trip, safe-not-reset and restored scenes reviewed. |
| HYDRO-R3D-002 | FIXED | Fit all city block bounds, preserve Hospital/Homes/Shops labels and keep phone controls clear of labels. |
| HYDRO-R3D-003 | BLOCKED | Engineering framing, runner annotation and route obstruction are FIXED. Remaining slender-spoke rotor form/salience requires the separately scoped asset track (R3D-007 / FOUNDER-IMMERSION); no major asset rebuild or new mechanics in Stage B. Cutaway/exploded benchmark remains BELOW. |
| HYDRO-R3D-004 | FIXED | Use actual guided index, exposed stack, live capacity/demand/latch/reset reason, and selected seasonal/turbine flow. Zero-turbine flood wording is covered by a state-transition regression test and independent source-copy re-review. |
| HYDRO-R3D-005 | FIXED | Remove sticky explanation overlay; independently scroll explanation and outer control column. Actual desktop Next and challenge HUD/panel reviewed; keyboard reaches downstream controls. |
| HYDRO-R3D-009 | FIXED | Regenerate six legitimate internal references via documented tooling on 8ca0dd9d; retain manifests/provenance and re-score nine dimensions using actual file pairs. Eight MEETS, one BELOW; device/art evidence remains UNVERIFIED. |
| HYDRO-R4I-007 | FIXED | 44 CSS px native-button hit proxies, 4 px separation, measured nine-point hit coverage and expected visible-control completeness. Dedicated season/feeder presets and panel twins preserve actual geometry and keyboard actions. |
| HYDRO-R4V-005 | FIXED | Shared warm energized material, larger readable status glyphs (SVG drawn above its shape), textual status list and upper-capacity/lower-demand legend. |
| HYDRO-R3D-008 | FIXED | Naturally touched by R4V-005: every profile has readable status glyph and named HUD state; 2D glyph now painted after its polygon. |
| HYDRO-R3D-010 | FIXED | Naturally touched: scene legend explains upper available capacity (22 MW per segment), lower demand and zero delivery during trip. |

No engineering-fixable P0/P1 remains in the bounded Stage B target set. R3D-003 is BLOCKED only on separately scoped runner art/salience, not runtime or missing references. R3D-007 and FOUNDER-IMMERSION remain OPEN; unrelated deferred findings are unchanged. Benchmark: eight MEETS (one BEATS, seven MATCHES), one BELOW; physical-device dimensions UNVERIFIED. Overall DO_NOT_SHIP, DRAFT, approval PENDING, curriculum inactive, student access disabled. Exact-head CI/runtime checks are mandatory before merge; final checks are linked from PR #170.

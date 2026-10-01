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

Rounds 2 and 3 append below as they run.

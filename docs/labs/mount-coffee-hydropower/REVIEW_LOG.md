# mount-coffee-hydropower review log

Objective: proposed `hydropower-cause-and-effect` — explain how river flow, available turbine units and electricity demand affect hydropower generation and delivery · Grade 8 · SCIENCE · Release: fixture-unreleased (not approved)

## Design
- Pedagogy brief: [01-PEDAGOGY_BRIEF.md](design/01-PEDAGOGY_BRIEF.md) (2026-09-28)
- Storyboard and benchmark: [02-EXPERIENCE_STORYBOARD_AND_BENCHMARK.md](design/02-EXPERIENCE_STORYBOARD_AND_BENCHMARK.md) (2026-09-28)
- Simulation spec: [03-SIMULATION_SPEC.md](design/03-SIMULATION_SPEC.md) (2026-09-28)
- Asset spec: [04-ASSET_SPEC.md](design/04-ASSET_SPEC.md) (2026-09-28)
- Runtime extensions RX-001 through RX-004: implemented at checkpoint `a3426aba`; captures and round review remain pending.

## Round 1 — partial; overall OPEN
- Clean checkpoint: `e89075d3`. Overview still matrix: `artifacts/lab-review/mount-coffee-hydropower/1.0.0/round-1-e89075d3-stills/`; perf metadata: `.../round-1-e89075d3-perf/`; automated interaction probe: `.../round-1-e89075d3-interaction-probe/`. All four profiles × desktop/mobile. SwiftShader software rendering supports composition and label review only; every perf row has `signOffValid: false`.
- Science follow-up: overview P0 resolved. All four unit water paths visibly return through the common tailrace to the Saint Paul River in WebGL and FALLBACK_2D. No new overview science finding. Dry-season, overload/trip, cutaway, repair, assessment and motion states remain unreviewed.
- Visual follow-up: the former right-edge white slab now reads as separate city structures and remains within scene bounds. The mobile explanation panel shows “Scroll this panel for more details”; the still supports discoverability, while live scroll behavior remains untested. Distance, tower and Homes labels are separated; fallback halos remain clear.
- Interaction follow-up: automated overview probe reports zero visible targets below 44 px for HIGH/FALLBACK_2D on desktop/mobile. FALLBACK_2D trace targets are 65×65 desktop and 53×53 mobile. Three heuristic “unnamed” controls are River flow, Units online and Explode sliders; each has an associated DOM label. No live input, keyboard, guided-task, challenge, assessment or scroll test was run.
- Overall Round 1 remains OPEN because evidence and reviews cover only the overview, not process, fault, cutaway, guided, challenge, assessment or motion states.
## Round 2 — not run
No reviewer verdict is recorded.

## Round 3 — not run
No benchmark scores or design director verdict are recorded.

Disagreements:
- Simulation architect proposed `u1-generator`; the asset director and builder selected `u3-generator` for the single detailed internal stack. Recorded in `production.json`.
- Asset director requested a persistent spin glyph; the e89075d3 stills show it across all profiles. The visual reviewer confirms desktop legibility but cannot establish individual glyph legibility on mobile; revisit in later review.
- Shared inactive flow is `#779ab2` after the palette gate showed that `#94a3b8` could not meet both color-separation constraints with the shared highlight.

Reverted fixes: none.

## Round 3 verdict
Design director: not run.
Open P0: not assessed.

## Governance handoff
Curriculum alignment remains PROPOSED, not governed. All five checks remain RAW_OBSERVATION. The lab is DRAFT, fixture-bound, unapproved and unreleased. `SHIP_CANDIDATE` requires completed three-round HERO review and benchmark scoring. `SHIP_VERIFIED` requires a separately authorized real-school pilot; this team cannot approve, release or bind the lab.

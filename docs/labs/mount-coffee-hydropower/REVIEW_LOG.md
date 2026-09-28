# mount-coffee-hydropower review log

Objective: proposed `hydropower-cause-and-effect` — explain how river flow, available turbine units and electricity demand affect hydropower generation and delivery · Grade 8 · SCIENCE · Release: fixture-unreleased (not approved)

## Design
- Pedagogy brief: [01-PEDAGOGY_BRIEF.md](design/01-PEDAGOGY_BRIEF.md) (2026-09-28)
- Storyboard and benchmark: [02-EXPERIENCE_STORYBOARD_AND_BENCHMARK.md](design/02-EXPERIENCE_STORYBOARD_AND_BENCHMARK.md) (2026-09-28)
- Simulation spec: [03-SIMULATION_SPEC.md](design/03-SIMULATION_SPEC.md) (2026-09-28)
- Asset spec: [04-ASSET_SPEC.md](design/04-ASSET_SPEC.md) (2026-09-28)
- Runtime extensions RX-001 through RX-004: implemented at checkpoint `a3426aba`; captures and round review remain pending.

## Round 1 — not run
Fresh captures for all profiles and desktop/mobile, reduced-motion, probe and perf have not been produced. No reviewer verdict is recorded.

## Round 2 — not run
No reviewer verdict is recorded.

## Round 3 — not run
No benchmark scores or design director verdict are recorded.

Disagreements:
- Simulation architect proposed `u1-generator`; the asset director and builder selected `u3-generator` for the single detailed internal stack. Recorded in `production.json`.
- Asset director requested a persistent spin glyph; it is now present at every profile, with Round 1 visual confirmation pending.
- Shared inactive flow is `#779ab2` after the palette gate showed that `#94a3b8` could not meet both color-separation constraints with the shared highlight.

Reverted fixes: none.

## Round 3 verdict
Design director: not run.
Open P0: not assessed.

## Governance handoff
Curriculum alignment remains PROPOSED, not governed. All five checks remain RAW_OBSERVATION. The lab is DRAFT, fixture-bound, unapproved and unreleased. `SHIP_CANDIDATE` requires completed three-round HERO review and benchmark scoring. `SHIP_VERIFIED` requires a separately authorized real-school pilot; this team cannot approve, release or bind the lab.

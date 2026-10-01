# Immersive labs: status and handoff

Updated 2026-10-01. Branch `feat/mount-coffee-immersive-v1-1` in worktree `C:/Users/fasir/ll-labteam`. Not pushed, no PR yet. `origin/main` = `0b49e01f`.

## Goal

Every LiberiaLearn lab should feel like an immersive 3D lab, **at the level of airsup.ai's labs or better**, without losing any of these:
- the cheap-phone (LOW) and 2D versions;
- offline use;
- scientific correctness;
- governed evidence.

Plan: [IMMERSIVE_LABS_PROGRAMME.md](IMMERSIVE_LABS_PROGRAMME.md).

1. Build a shared three.js HIGH renderer: RX-005, plus RX-006 batching for LOW.
2. Prove it on Mount Coffee 1.1.0.
3. Re-review solids, lever and circuit on it.
4. Add a time axis (RX-007).
5. Migrate all 17 legacy 2D labs.

## Done

**Merged to main**
- PR #161: lab production team, review harness, Mount Coffee 1.0.0 draft.
- PR #162: expired writer-guard exceptions.
- PR #163: #160 fixes plus the jsonb payload-hash bug.

**Design (Mount Coffee v1.1)**
- Founder finding recorded: `HYDRO-FOUNDER-IMMERSION-001`.
- Design deltas 05 (pedagogy), 06 (simulation), 07 (experience) and 08 (assets).
- Founder fix for the blind-toggle P0: smaller feeder blocks. Guessing now succeeds 1 time in 50, down from 1 in 8.

**RX-005 proposal**
- Design director and performance reviewer: both APPROVE_WITH_CHANGES. Every P0 was verified, and binding amendments A1–A20 were written.
- RX-006 is a separate proposal.

**Founder decisions**
- Camera rule adopted (principle 10 in `HIGH_FIDELITY_INTERACTIVE_LABS.md`).
- Inspiration references approved; airsup.ai is the primary benchmark.
- The glTF loader moves into Phase 0 (A20).

**Design re-check (2026-10-01): P0-01 is closed**
- RX-005 overall, A20 and RX-006: all APPROVE_WITH_CHANGES.
- 0 P0, 14 P1, 8 P2 (F-01 to F-22, in the reviewer's report). These are not yet written into RX-005. The key ones are listed below.

**Code: Phase 0.1 (commit `14391b38`, 114 lab tests pass)**
- Labs start on LOW or 2D, and upgrade only on device evidence: a probe, hints and a remembered choice (A2).
- The downgrade detector ignores idle gaps (A4).
- WebGL context loss falls back to 2D, and contexts are released on unmount (A5).
- A renderer chunk that fails to load retries once, then falls back to 2D (A3, part).

## Still to do (in order)

1. **Write the design re-check findings into RX-005.**
   - F-01 to F-03: the geometry attach point, the descriptor output (normals, UVs, AO, `closed`), and a measurable silhouette rule.
   - F-05 to F-08: glTF licence and provenance policy (nothing from airsup), science sign-off, named nodes, no state-carrying animation clips.
   - F-10 and F-11: procedural image-based lighting and a PBR texture set on HIGH.
   - F-13: PBR Neutral tone mapping.
   - F-14: a generic "follow the flow" tour.
   - F-16: airsup benchmark rows.
   - F-18 and F-19: RX-006 transitions, and lit/dark contrast on daylight LOW.
2. **Phase 0 code, in increments with tests:**
   - parametric geometry descriptors and kits (A1);
   - environment rigs and backdrops (A10);
   - ThreeScene, with three pinned and only dynamically imported (A5–A9);
   - surfaces and emitters (RX-005b);
   - in-scene controls, including drag (A14);
   - camera rails and widened limits (A16);
   - the scene-first shell (A17);
   - budget planner and import-graph tests (A8);
   - RX-006;
   - the glTF loader with a fixture (A20).
3. **Mount Coffee 1.1.0 build:**
   - feeder-block model and fixtures from 06;
   - new review scenarios;
   - three review rounds with captures, including a `--gpu` run;
   - **founder hands-on re-review**.
4. **Phases 2–4** per the programme.

## Needs the founder

- **Who makes the hero 3D models** (heart, molecules, tectonics, engines; F-17). Options:
  - an original 3D artist;
  - a curated CC0 / CC-BY pipeline;
  - generated models with science review.
- **A real-device session** on a Tecno Spark Go-class phone before any lab is marked ready.
- **Reference screenshots of airsup.ai**, saved under `artifacts/lab-review/<labId>/benchmark/`. The Chrome extension was not connected, so they could not be captured.
- **Merging PRs.** The auto-mode classifier blocks `gh pr merge`, so the founder merges with the exact `--match-head-commit` command.

## Environment notes

- This 8 GB machine runs out of memory. The dev server (`LAB_REVIEW_HARNESS=1 npx next dev`) was stopped by Claude Code for low memory and has not been restarted.
- Full type-check and `next build` should run in CI, not locally.

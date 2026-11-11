# LiberiaLearn engineering state

**Authoritative source of current engineering state.** Version 1.1.0, 2026-11-11. Owner: Chief of Staff (CoS).

This file supersedes `docs/roadmaps/CURRENT_EXECUTION_STATE.md`, which was last updated on 2026-09-19 and predates the GAM assessment system, the V4 school day, session revocation, Records V2, the Student Learning Model (SLM) and Package Contract v2. That file is kept as **historical record only**. Do not resume work from it.

Update this file, bumping the version, whenever an accepted commit, owner or gate changes. Detailed evidence, review packets and security ledgers are kept in the coordination workspace, not in this public repository.

## Environments

| Environment | State |
|---|---|
| Production | Last recorded at `e5d89c34` (PR #198). Verify in Vercel before relying on this |
| `main` | `dceaee4b` (PR #201, session security), merged and **not deployed** |
| Deployment | Production deployment needs separate founder authorisation. Merging to `main` does not deploy |

## Workstreams

"Interim" means accepted by the cross-review used while the independent reviewer (Atlas) was unavailable; Atlas re-review is pending.

| Workstream | Latest accepted candidate | Evidence | Status / next gate |
|---|---|---|---|
| Session security | `dceaee4b` on `main` | merged | Accepted; not deployed |
| Grade 4 traditional school day | PR #202, `integration/g4-day` `4662b14a` | CI + browser pass | Interim. **Merge only after Atlas accepts the exact candidate** (founder, 2026-11-11) |
| Lesson eligibility (D-7) + refusal explanation (U5) | `ec76514b` + `6d46c8a7` | CI + A/B browser pass | Interim; Atlas re-review |
| GAM assessment (demo) | `bcc1e54c` line + same-origin fix `47d82033` / `1e326cdf` | PostgreSQL + browser journey pass | Interim; Atlas re-review |
| Records V2 (demo schools) | `c412791b` | PostgreSQL suite pass | Interim; Atlas re-review |
| Class authority (locked reads) | `f058242d`, `69c5da62`, `46eb2969` | PostgreSQL + CI pass | Interim; Atlas re-review |
| SLM Grade 9 + learner/teacher views | `cdb329fe`, `d46da5fb` | CI + PostgreSQL pass | Interim. Grade 9 Science release **unpublished** until science review |
| Content factory base + text-encoding guard | `fix/factory-base-green` (`c51e5a43` → `52b8f387` → `bc63810a`) | CI green except designed-RED tests | In review |
| Package Contract v2 (complete lesson packages) | `feat/factory-contract-v2` | step 1 reviewed | In progress. **No live generation until Atlas accepts the exact implementation** |
| Live factory experiment | — | mock controls proven | **HOLD.** The earlier factory pin is not used for live runs |
| Grades 10–12 curriculum | proposal documents (not in this repository) | — | Architecture provisionally approved; course catalog **not** approved; the 531-unit baseline is unchanged |
| Security remediation | tracked privately | — | In progress, test-first, independently accepted |

## Standing rules

- No Production operations, deployments, protected-`main` merges, official academic publication or unapproved paid AI calls without explicit founder authorisation.
- One implementation owner and one independent reviewer per change. No self-approval. Every acceptance names an exact commit.
- Database-transaction features must pass tests at one database connection per instance.
- Seeded demo accounts are demo data. No seeded account may exist in any database holding real school data.
- Content Factory: packages are finished learner content, not teaching instructions; plans are validated before any paid call; timed components (for example 7-day retention) must be proven deliverable by the application.
- Exact-count exceptions only in the text-encoding guard. Visible student- or teacher-facing corruption is repaired, never excepted.
- No bulk worktree deletion or branch pruning.

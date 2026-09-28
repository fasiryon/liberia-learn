# LiberiaLearn live curriculum reconciliation V1

## Goal status

BLOCKED — live Supabase read access is unavailable. No production or staging write was attempted.

## Evidence boundary

The configured production Supabase endpoint is not currently usable: the pooler returns `FATAL: ENOTFOUND tenant/user postgres.bnphuinpvgpmebcsvmsp not found`. The configured staging endpoint returns the equivalent error for `postgres.yonpfzjczoffhrgibxkz`. Therefore live objectives, lessons, assessments, resources, labs, releases, authority, review state, bindings, and orphan counts are deliberately reported as **not obtained**, not zero.

Repository evidence is not a substitute for live evidence:

- K12 scope: 228 declared grade/subject cells.
- Acquired MOE archives cover 96 of those declared cells by their archive metadata, with `ACQUIRED_UNREVIEWED` state. This does not establish MOE approval.
- One executable release is registered in the repository: `lr-moe-g4-math-fractions-2026.1`, with `moeApprovalStatus: NOT_CLAIMED`.
- No persisted executable-release/binding model exists in the Prisma schema; executable ontology releases and tool policies are repository-defined.

## Requested live return fields

| Field | Result |
|---|---|
| Live grade/subject coverage | NOT OBTAINED |
| Live objectives | NOT OBTAINED |
| Live lessons | NOT OBTAINED |
| Live assessments | NOT OBTAINED |
| Live textbooks/resources | NOT OBTAINED |
| Live labs/sims | NOT OBTAINED |
| Release coverage | NOT OBTAINED |
| Authority conflicts | NOT DETERMINABLE |
| Orphaned content | NOT DETERMINABLE |
| Reusable content | NOT DETERMINABLE |
| True gaps | NOT DETERMINABLE |
| PDF extraction still required | NOT DETERMINABLE; do not extract further yet |

## Vercel production status

- Deployment listing is reachable; latest listed production deployments are `Ready` and show successful builds.
- `https://liberia-learn.vercel.app/` returns HTTP 200.
- `/api/healthz` returns HTTP 503: `{"status":"degraded","db":"error"}`.
- `/api/health` returns HTTP 503 with `database:error` and `migrations:error`; AI factory and SMS checks are OK/dry-run.
- `/admin/curriculum/coverage` returns HTTP 307 to authentication.
- No deployment was triggered.

## Lab engine / interactive runtime audit

The lab audit is repository-backed because live Supabase lab rows were unavailable. Full machine-readable detail is in [lab-engine-audit.json](./lab-engine-audit.json).

- A reusable runtime already exists in `lib/labs/runtime/` with `validateLabAction` and `applyLabAction`, plus a registry and typed state/action/validator modules.
- Twelve lab definitions are registered in the typed runtime; the catalog declares 20 IDs. `VirtualLab` also supports a separate data-driven procedure/observation payload path with six starter seed definitions.
- Current interactive labs are hybrid: shared kernel plus bespoke per-lab modules. They are not yet one fully data-driven definition format.
- Learn/Practice/Assessment cannot yet share one version-pinned simulation definition end-to-end. Lesson panels and lab pages are reusable precedents, but the governed cross-surface contract is still missing.
- Learner actions are validated/applied in the runtime; durable `LabSession` records observations, conclusions, provisional score, completion, and teacher feedback. Action-by-action traces are not stored as a first-class lab event stream.
- Lab output currently emits learning/audit events and `RAW_OBSERVATION`/`PROVISIONAL` session evidence. The student route explicitly forces `masteryUpdated: false`; lab scores do not become canonical mastery.
- 2D is supported. 3D is not implemented; its schema is future/planned.
- Offline drafts and pending submissions exist, but P5-E explicitly marks mastery events and simulation state as `NOT_SUPPORTED_OFFLINE`; fallbacks are safer than pretending offline mastery is authoritative.
- Teacher visibility exists through scheduled lab sessions, teacher/admin session review, feedback, and dashboard counts.
- Safety notes/material/procedure/risk fields exist, but uniform runtime-enforced safety policy is incomplete.
- Do not create a duplicate lab engine. Extend the existing validate/apply kernel and converge the VirtualLab/simulation contracts into a versioned governed definition.

### Lab gap dimensions

The final curriculum gap report must separate: missing lab content; missing lab definition; missing engine capability; missing evidence binding; missing mastery binding; and missing safety/offline support. At present, only the engine/design dimensions are evidenced. Exact live lab/content gaps remain unknown until Supabase access is restored.

Repository catalog classifications are: registered typed labs `ENGINE_COMPATIBLE`; six seeded VirtualLab simulations `ENGINE_EXISTS_NEEDS_DEFINITION`; page/alias-only labs `BESPOKE_LEGACY`; and 3D `NEW_ENGINE_CAPABILITY_REQUIRED`. These are not claims about live production lab counts.

## Git base

PR #145 is still open, not merged. The available `origin/main` is `49da52d9b19a049d7ee2a4af1a60304a2bcbf79c` (PR #144 merge), so there is no final post-PR-145 main SHA to use.

## Smallest safe next step

Restore the Supabase project/tenant or correct the production read-only connection, then rerun the SELECT-only audit script [live-curriculum-reconciliation-v1.ts](../../scripts/live-curriculum-reconciliation-v1.ts). Only after that report should the team decide which archive cells require extraction, import, review, authoring, or release binding.

# T2 to CoS, for Atlas review: A2/B3 design and existing revised commits

November 3, 2026. Founder authorized lightweight design and offline validation only. Please route this packet and the adjacent A2-B3-ARCHITECTURE.md through CoS to Atlas. Delivery of a local coordination note is not reviewer acknowledgment or acceptance.

## Existing revisions, do not recreate

| Exact commit | Review question | Existing evidence relative to this worktree |
| --- | --- | --- |
| `1ca443b44e2d88fcc3446bfe0dffd5e0c80a1b21` | PV-05 successor: fresh approvals/audits, preserved historical configs, +14-day UTC bound, duplicate bootstrap refusal. Accept synthetic actor attribution? | `artifacts/t2-preview-readiness-20261102/pv05-revision-red.json`, `database-hardening-green.json`, `scratch-postgres-result.json`, `final-security-results.json`; `__tests__/preview-reanchor.test.ts` |
| `48342a589eaf6751c44325bfb3448c2bfc877c2a` | Exact configured URLs, mandatory single TLS=require, no normalization or ambient repair. | `artifacts/t2-preview-readiness-20261102/url-validation-red.json`, `url-validation-green.json`, `T2-A1B-URL-VALIDATION-20261102.md`; `__tests__/preview-seed-target.test.ts` |
| `f0a06373d10f34d7d8e5e7ac622fa7df05d033e2` | SELECT-only catalog collector, fail-closed policy evaluator, intentionally UNAPPROVED template; no claim of hosted least privilege. | `artifacts/t2-preview-readiness-20261102/catalog-readonly-result.json`, `DATABASE-SECURITY-RUNBOOK.md`, `changed-types.json`, `final-security-results.json`; `__tests__/preview-database-preflight.test.ts` |

All three are ancestors of the resumed head `003dc49a`. Last handoff/evidence commit `6dc61db4`; delivery receipt committed at `003dc49a`. The combined prep `5560f038` has not integrated these successors. The historical 117-test result and disposable PostgreSQL 17 evidence are existing records, not newly run hosted tests. Frozen baseline CI/browser on `26026ca6` does not certify this proposal or newer operator source.

`preview-target.mjs` is unchanged. SHA256 remains `e411cc2119335d6d195aa15f7b2acf4b52357d831e8c5f471f89e027985ce703`. Do not substitute a changed validator into A1b. A separate role-aware adapter will require review later; the current validator/seed/re-anchor require preview_app, so the proposed bootstrap split is not operational yet.

## Atlas answers and explicit decisions requested

1. Attribution: a fixed synthetic noninteractive service FK identity, no reviewer password, no password/PIN/OAuth/token/reset/session login, no teacher/MOE authority. Current null-password ADMIN/platform actor is a compatibility constraint, not proven minimal authority. T1 must close every authentication path before execution, or jointly revise binding semantics to an explicit service principal. No served identity route is changed by T2. See the architecture's attribution section for exact actor ID and required operator/authorization/source provenance. Accept this model or specify the required narrower principal. Existing audits are not rewritten to add provenance retrospectively.
2. Roles: owner holds DDL; temporary bootstrap holds tightly bounded DML; runtime reads the explicit fixture allowlist and appends allowed access audits only. Timetable/PolicyConfig maintenance is removed from the proposed runtime grant envelope. Approve/revise the exact allowlists and require a positive query inventory before A2.
3. History: historical approval payload/identity and all audits immutable; old approval isActive can transition true to false only during reviewed re-anchor. A live policy config pointer/window may change with an append-only operation audit. New OLD/NEW and control-ledger guards are proposed dependencies, not implemented protections.
4. Reruns: one-time initialization, read-only acknowledgment only on independently reconciled COMPLETE; partial/unknown state STOP; no credential replay/rotation or populated-DB reset. Same-date PV-05 appends an audit but changes no fixture/approval/timetable state. Review recovery admission and owner-side contamination inventory with writer exclusion.
5. Existing preflight limitations are explicit: its accepted fingerprint contract can allow runtime PolicyConfig writes, it knows only 12 existing triggers, and it cannot certify bootstrap role lifecycle or actual predicate correctness. This proposal does not label that code fully A2-compliant.

## Offline evidence and safe next work

`scripts/preview/a2-b3-offline-metadata.test.mjs` uses Node's built-in test runner, existing pure preflight evaluation and a mocked transaction client. No real Prisma client, URL/password loading, socket, hosted connection or SQL execution. `offline-results.tap` records 34 PASS, zero failures/skips. Mock migrations bind every repository migration name/checksum; negative cases reject unsafe ownership/role/ACL/RLS/trigger/history state. One explicit expected-PASS regression records the current policy-write limitation. Hash drift requires review rather than silent snapshot adoption. This is offline evidence only, not approval of any real policy. The test lives under scripts so validate:changed performs JavaScript syntax checks without broad application-related Vitest discovery.

Next work after review: implement the role-aware split, insert-only seed, owner-installed policy/history/admission guards and extended evaluator under a new scoped work order, then rehearse on an explicitly authorized isolated synthetic DB with the frozen generated client. Preserve existing PV-05 and pinned validator. CoS chooses the final composition and any single new private validation request. No workflow was dispatched by this work.

The architecture ends with the exact remaining founder scopes: hosted read-only inspection, conditional A1b and separately scoped probe, A2 roles/migrations/initialization/credential lifecycle, separately dated PV-05 maintenance/recovery, and A3 deployment. None is granted by this design instruction. Production, public push, academic activation and populated database reset remain outside scope.

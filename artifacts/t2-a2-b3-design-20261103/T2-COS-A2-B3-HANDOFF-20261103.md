# T2 to CoS: A2/B3 design ready for Atlas review

November 3, 2026. Please route to Atlas. This is delivery for review, not independent acceptance or permission to operate a hosted database.

Worktree `C:/liberia-learn/.worktrees/content-factory-draft6`, branch `integration/preview-v1`. Design commit `f7dde5129f1d048aa3f4fa63f39138e97b482ee0`; offline-test relocation `7a047d4fd733140f121c5d02008b0f531aca9b08`. This handoff is a subsequent evidence-only commit. Base was `003dc49a`.

## Deliverables

- `artifacts/t2-a2-b3-design-20261103/A2-B3-ARCHITECTURE.md`: owner/bootstrap/runtime relationships and exact closed grant lists, RLS requirements/limits, immutable-history trigger dependencies, Prisma migration vs db push vs synthetic initialization, B3 state/admission/recovery matrix, operator sequence, synthetic service attribution and remaining founder scopes.
- `artifacts/t2-a2-b3-design-20261103/REVIEW-PACKET.md`: exact existing revisions and evidence plus explicit Atlas decisions. PV-05 `1ca443b44e2d88fcc3446bfe0dffd5e0c80a1b21`, URL validation `48342a589eaf6751c44325bfb3448c2bfc877c2a`, catalog preflight `f0a06373d10f34d7d8e5e7ac622fa7df05d033e2` were preserved, not recreated.
- `scripts/preview/a2-b3-offline-metadata.test.mjs` and `artifacts/t2-a2-b3-design-20261103/offline-results.tap`: synthetic metadata and mocked read-only collector checks. No real database client/connection is constructed.

## Verification

- Node built-in offline suite: 34 PASS, 0 FAIL, 0 SKIP. Repeated successfully after relocation to scripts/preview. Checks include owner/inheritance/ACL/RLS/trigger/migration denials, SELECT-only collector protocol and safe catalog errors. A named expected-PASS case explicitly documents the current preflight's permissive policy-write contract.
- `npm run validate:changed -- --base 003dc49ac734317802253d28ee0ecafd4e1ea7fd --no-types`: PASS at `7a047d4f`. API policy audit PASS, JavaScript syntax and whitespace checks PASS. No full TypeScript, production build, DB setup or broad suite completion.
- First validation invocation classified the artifact-located test as application source and began broad Vitest related-test discovery. It was interrupted due to the RAM constraint, not claimed as PASS. Moving only the offline test to scripts/preview avoided that discovery; the final command above completed normally.
- Validator SHA256 rechecked unchanged: `e411cc2119335d6d195aa15f7b2acf4b52357d831e8c5f471f89e027985ce703`. No existing operator, served app, schema, migration, package or lock file changed.
- Existing untracked/ignored evidence remained in place; only new scoped files were staged. No external message, hosted connection, migration, seeding, setting/secret edit, workflow dispatch, push, merge, deployment or academic activation.

## Blocking design decisions and next action

Runtime proposal is read-only fixture access plus restricted access-audit INSERT. Re-anchor writes belong to temporarily admitted bootstrap, never runtime. Current seed/re-anchor expect preview_app and setup uses db push; they are incompatible with this proposed split and remain blocked for hosted use. Future adaptations must preserve PV-05 and the pinned validator.

RLS cannot prove global emptiness through filtered counts or identify a human behind a shared app login. Require owner-side full-schema inventory with other writers excluded and separate T1 auth/tenant tests. New PolicyConfig OLD/NEW guards, AuditLog TRUNCATE guard and durable control-ledger admission are proposed, not installed. Runtime preflight does not yet certify these additions or bootstrap lifecycle.

Attribution answer: fixed synthetic service identity only, no reusable credential or interactive auth/session path, explicit fixture/package/source/authorization/operator provenance, no teacher/MOE/official approval assertion. Existing ADMIN/platform flag compatibility needs Atlas disposition and T1 denial evidence or a coordinated narrower principal. No historical audit is rewritten.

Next safe action is CoS routing of the exact packet and Atlas review of the three existing revisions plus this design. This task completes design/offline preparation only. Role-aware adapters, insert-only initialization, ledger/guard migrations and real-role SQL rehearsal need a subsequent scoped implementation/rehearsal work order. Mock PASS is not hosted database acceptance.

Remaining founder scopes: separately approved hosted read-only catalog/provider inspection; A1b only after exact R3 acceptance and all validator/private-input/snapshot conditions plus applicable founder scope; separately scoped probe; A2 exact role/grant/owner migration and synthetic initialization/credential lifecycle; separately dated re-anchor/recovery; A3 deployment after all combined CI/browser, hosted security/isolation, dependency/SEC-R08 and Atlas gates. No Production action, public push, reset of populated DB or academic activation is authorized.

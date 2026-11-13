# Six-lesson integration readiness

Engineering preparation only, 2026-10-24. Release recommendation: **do not activate**. The feature flag remains OFF; no lessons were published, deployed or merged by T2. This focused branch excludes K–12 expansion packages.

Current code integration commit: `fd2cd44509be0ae44b7281961e1e2c43e3da13af`, branch `fix/v4-six-lesson-integration`. It preserves T1's exact browser-tested base `3f7eff1220d70faa1384eaa729df5c7c1ae72e9b`, including the final #199 short-screen fixes, and adds T2's read-only timetable resolver, real synthetic timetable test and prepared security dependency files. The dependency files exactly match the separately audited `52fe195b8b5576269ccfa61f6462a5c77515233e`. No manual changes to T1's UI/registry components were made. The later QA commits type the browser harness's scrubbed environment, select only actual Vitest tests, and make the route audit fail closed when Git history is unavailable. See `LINUX_VALIDATION_STATUS.md` for exact evidence and unfinished gates.

## Immutable candidate matrix

All entries are version `4.0.0-draft.6`. Every lesson remains individually hash-pinned and requires its own valid operator approval record, rights/review references, permitted classes and revocation state. Conditional AI acceptance is not a human approval or permission to publish.

| Lesson | Package SHA-256 | Authenticated browser evidence on T1 base | Outstanding publication/pilot gates |
|---|---|---|---|
| Grade 7 Geometry | 86066251a231c08dc7a500cd02b72b32eeb5396fefed00c6c83cb459cf2fb254 | 7/7 scenes at 390 px; 400% short-screen probe | Final integrated-head tests, Linux/security, exact release records |
| Grade 7 Fractions | ffaafcbb124def71114178a07736acf7c3609aa1debf36e413b4bdf1a5aae69a | 7/7 scenes at 390 px | Same gates; no additional zoom certification claimed |
| Grade 5 Multiplication | 7a469baccfb5d7d1e932942baf013e1848579c4efa9077a949dcebb7542d75ce | 7/7 scenes at 390 px | Same gates; correct-grade rehearsal/cohort configuration still required |
| Grade 7 Science | 7863152eba2e51b818a1b304fa0b240f7b0ac0d2656406947488fbc93ae912f9 | 6/6 scenes at 390 px | Same gates |
| Grade 7 Civics | 2a388b30e577b0b11518f7b71772739a03c913fe2840fcd4b7a392eec9b8c5eb | 6/6 scenes; real 15-county map in scenes 1–5; displayed attribution; 400% probe | Same gates plus exact academic/geographic and source-rights clearance records |
| Grade 7 English | fa54d6f4d508a81020bcf18c906a948a8c1c0e74ec1f384aa9c088acb289be19 | 6/6 scenes at 390 px | Same gates |

The original five conditional academic acceptances remain conditional. Civics remains fully in scope with its map and offline visual assets, separately controlled while its remaining clearances are obtained. The official PUBLISHED + APPROVED policy is unchanged for every lesson. A pilot approval does not satisfy official publication requirements.

## Evidence and practical limits

T1's signed-in synthetic-browser report is `artifacts/v4-coordination/T1-PILOT-FINAL-ACCEPTANCE.md` in the shared workspace. On its exact base it records no-store delivery, exact identity hashes, zero axe violations, no answer/teacher-material canary leakage, zero non-GET requests, unchanged official academic counts and zero active policies after cleanup. Offline continuation expired in 62.9 seconds on a 60-second lease; reconnect after offline revocation denied access in 0.4 seconds. This is browser timing evidence, not a promise of instantaneous expiry or remote revocation on disconnected/frozen devices. Offline is same-open-tab memory continuation only, with no durable reload/reopening guarantee.

T2 resolver commit `363c5926` passed its changed gate: 8 direct and 33 related tests, 7 deliberately skipped authenticated cases, plus types/API-policy audit. Subsequent source branch `4f2ed1e0` added actual timetable database coverage: the single-worker scheduled run passed 16 tests across two files, including eight real PostgreSQL tests. An exact approved timetable/class/hash admits; changing the stored subject produces an UNBOUND gap; delivery writes are zero and academic counts are unchanged. This evidence predates the new dependency integration and does not certify the final branch automatically.

Database isolation was verified again: container `facbf788884f082c15207f9129d5d54a71ad6e5c3f3b2970bd1da3d90e718941`, loopback binding `127.0.0.1:55447`, actual database `draft6_preview_validation`, role `preview_test`, PostgreSQL 17.6, server port 5432. Cleanup query returned zero active preview/release policies. No schema/Prisma-client regeneration, production/shared-preview access or real communications occurred. The founder's 520-pupil schoolwide fixture is not claimed as implemented by these smaller regression tests.

Fresh security evidence is in `DEPENDENCY_SECURITY_DISPOSITION.md` and `security/`. Production lock-only audit fails with 1 critical (`next`) and 18 high. The private Linux installation confirms the patched auth/Sentry/sanitizer versions and Sharp 0.35.5; both unused Prisma auth adapters are absent. The full Linux unit suite at parent `a970a525` passed 8,487 tests with 35 skipped. Its production build compiled, then failed on a browser-harness type error repaired in `8f376bc6`. Exact `fd2cd445` route-audit/regression checks pass; its full type job was interrupted after host ENOMEM, exit 137. Production build, hosted output tracing and final-head CI/browser runs remain unproven. No Windows result substitutes for those gates.

## Pilot URLs

No pilot host has been deployed. Relative route template:

`/learn/preview/factory@4.0.0-draft.6@<key>`

Keys are `g7-math-area-perimeter`, `g7-math-fractions`, `math-multiplication-models`, `g7-science-states-of-matter`, `g7-civics-counties-capitals`, `g7-english-reading-evidence`. All must remain unavailable in an inactive deployment. The timetable resolver returns encoded links only for exact admitted bindings; it never guesses by subject or version.

## Activation checklist

- Verify a dedicated non-production staging/pilot database and network boundary from actual connection identity. Do not use the Vercel Preview that shares production Supabase.
- Provision/retrieve actual synthetic school, class and user IDs in that isolated environment. Build the founder's schoolwide rehearsal separately using CoS's authoritative day plans. Do not authorize real classes or invent their IDs.
- Bind each exact lesson hash to permitted class IDs and any real timetable IDs. Resolve every period without fallbacks. Keep Civics independently revocable and preserve its map/visuals.
- Obtain genuine exact-version content, source-rights, access, accessibility, safety, runtime and release-authorization records. Create an operator-authored pilot-release record and linked audit through the authorized process. No synthetic test records count as real approval.
- Validate the finite UTC window with the founder. The proposed 2026-10-26T00:00:00Z to 2026-11-09T00:00:00Z interval remains a placeholder, not active configuration.
- Complete clean Linux installation, full CI/security/production build, exact package/map tracing, flag-OFF and unallowlisted 404 probes, authenticated cohort/revocation/expiry/tamper checks and final-head browser/device acceptance. Resolve production critical/high security gates with evidence.
- Record the bounded offline policy and test its actual timer/reconnect behaviour. Do not promise disconnected remote revocation. Confirm ungraded notices and no official academic writes.
- Only after explicit founder release authorization may an operator activate approved policy entries and set `V4_LEARNING_PREVIEW_ENABLED=1`. Until then keep it unset or `0`, policies inactive and the allowlist unavailable.

For a real-school production pilot, the founder must explicitly select actual school/class IDs and approve the activation window; synthetic configuration cannot authorize them.

## Rollback procedure

1. Set the server flag to `0` through the authorized environment process and deactivate the scoped pilot policy. Stop new delivery before any attempted repair.
2. Revoke the affected lesson entry or approval using the existing authorized policy/audit process. Preserve audit history and candidate files. Do not delete historical learning records.
3. Verify concealed/404 behaviour for newly requested lessons and denial on reconnect. Existing disconnected tabs can retain only their previously issued bounded memory lease; remote revocation takes effect when they reconnect, and browser suspension can delay display updates.
4. Keep every official grading/mastery/promotion/assignment path unchanged. There are no official pilot grades to roll back. Investigate using synthetic/authorized evidence before a new exact-head release decision.

## Repair disposition

Keep the six-entry closed registry, explicit bounds, class-scoped admission, memory-only progress, offline lease, pure ungraded assessment notice, authenticity-preserving map binding and T1's #199 fixes. The old five-lesson limit and Civics exclusion are superseded. Durable offline reopening is outside this implementation; a clearer slow-connection notice is a small follow-up, not a reason to remove visuals. K–12 curriculum production remains on its separate factory branch and does not weaken this pilot's controls.

# P2-B Production Cutover Record

Date: 2026-08-14 UTC
Production project: `bnphuinpvgpmebcsvmsp`
Staging project: `yonpfzjczoffhrgibxkz` (excluded)

## Preflight and dependency review

- Production identity: PostgreSQL `17.6`, database/user `postgres/postgres`, TLS-required transaction pooler.
- Migration ledger before change: 6 active, 0 unfinished, 5 P2-A rows.
- P2-A tables: 4. P2-B tables before change: 0.
- Long transactions, lock waits, and ungranted locks: `0|0|0`.
- Migration A and B SHA-256 matched the approved values.
- npm audit: 21 findings (3 critical, 14 high, 3 moderate, 1 low). The three critical findings are the Auth.js email normalizer advisory on `@auth/core`, `@auth/prisma-adapter`, and `next-auth`. Repository inspection found no EmailProvider or Prisma-adapter imports; the deployed P2-B authentication paths use Google and credentials providers. The critical email-provider path is not production-reachable for P2-B. No unrelated dependency churn was performed.

## Recovery point

- Created immediately before migration at `2026-08-14T20:07:02Z`.
- Method: logical `pg_dump` over the production session pooler, restored into disposable PostgreSQL 17.
- Artifact: `artifacts/p2a-production/pre-p2a-production-20260814T200446Z.dump`.
- SHA-256: `1E72DE9A9977D66D02E676A186448FDBF50C357B72071CFD1D4A0E49E73B6E28`.
- Restore test: PASS. Evidence JSON: `artifacts/p2a-production/backup-evidence-20260814T200446Z.json`.

## Migrations and invariants

- Migration A `20260813_000001_p2b_qualified_review_operations`: applied, approved SHA `655AD60067634CAB8277CA0F2DE327B1909BADDCDB3B5C5299E76537283BA1D0`.
- Migration B `20260814_000001_p2b_review_cycles`: applied, approved SHA `3F2FB655B50B9DF524B758993BE22EF5DE1E9C4950077E84A68D99DA186B89C1`.
- Postflight: ledger `8|0|5`, 11 P2-B tables, 0 anon/authenticated table grants, 8 reviewed trigger guards, active-slot uniqueness index present, 4 exact-revision/invariant constraints present, and `0|0|0` activity anomalies.
- P2-A tables and history were not altered. No User.role expansion occurred.

## Application deployment

- Production deployment: `dpl_nS9JKq2whVyGtVCU8JjsKVaGk1aM`.
- URL: `https://liberia-learn.vercel.app`.
- Status: Ready. Build source: reviewed P2-B commit `09fc9d5bf498284a2bf2a7d7f7ec17919766cb68`.
- P2-B operations and shadow flags were explicitly set to `false` before deployment.
- Health: HTTP 200, database/migrations/AI factory/SMS checks healthy.
- Unauthenticated reviewer route: HTTP 401.

## Roster and task dry runs

- Candidate role holders: 36.
- Reviewer profiles: 0.
- Verified credentials: 0.
- Revisions: 1,106. Open P2-B tasks: 0.
- No profiles, credentials, or tasks were created. No qualifications were inferred from roles, domains, titles, or historical approvals.
- All affected scopes remain legacy-safe and disabled pending evidence-backed independent verification.

## Activation status

Platform canary, school canary, MOE/national activation, legacy human-route cutover, notification/device walkthroughs, and production review E2E were not activated because there are no independently verified production reviewer credentials. This is the explicit coverage-gap path authorized by the cutover decision, not a fabricated pass.

High-risk capacity auto-approval, two-person independence, and resolver behavior remain proven by the accepted staging evidence; no production task was eligible to exercise them.

Broad RLS remediation was not performed. P2-A history and semantics remain canonical and unchanged.

## Final decision

**NO-GO for P2-B feature activation.** Production schema and disabled application deployment are complete and healthy. Enablement requires evidence-backed reviewer profiles and independently verified scoped credentials, followed by the authorized platform/school/MOE canaries and external release walkthroughs.

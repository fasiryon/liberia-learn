# P2-A Production Cutover Record

Date: 2026-08-13 to 2026-08-14 UTC  
Sprint: P2-A Curriculum Provenance  
Status: COMPLETE IN PRODUCTION  
Operator and forward-fix owner: Fasiryon  
Branch: `codex/p2a-provenance-step1`

## 1. Target and preflight

- Production Supabase project was positively identified as
  `bnphuinpvgpmebcsvmsp` from the connection identity. The staging project
  `yonpfzjczoffhrgibxkz` was explicitly excluded.
- PostgreSQL: 17.6. Database: `postgres`. Migration user: `postgres`.
- Native migration traffic used the production Supavisor session pooler on
  port 5432 with TLS required. Application traffic continued through the
  transaction pooler.
- The pre-cutover application deployment was Ready and healthy. Its repository
  identity was `fasiryon/liberia-learn`, `main` commit
  `1387a0d88c1ebf31b9108f8e2eb41acbd93b0213`.
- No active transaction older than five minutes, no ungranted lock, and no
  unfinished canonical migration was present at the mutation boundary.
- The reviewed P2-A migration SHA-256 values matched exactly:
  - A: `d4ab65c9d577a75c1b37d96525971b928ef985926d9af9cfba21b5c0df48c7f7`
  - B1: `48c3c49f0f32026d815ec4135d886de7b7a3d10a80e0ccddbb3100162c6c7ab7`
  - B2: `234b635d51d628a46c24f140c5ef186db045986fd21594eee63f6029f4427ae6`
  - C: `90be560eb65fb6b5efbb1afe15599bb475cd05e38119a21b2808693c0b844097`

## 2. P2-A client-access security check

The four P2-A tables have no direct grants to `anon`, `authenticated`, or
`service_role`. Those roles also lack usage and select access to the archived
legacy migration ledger. No P2-A table introduced a new direct client-readable
or client-writable surface. Application access remains server-side through the
existing authenticated APIs and controlled repository boundary.

The broader production RLS inventory was not changed. It remains separately
tracked in `docs/security/PRODUCTION_RLS_EXPOSURE_AUDIT.md`.

## 3. Recovery evidence

The final pre-migration recovery proof used a PostgreSQL 17 custom dump and a
disposable restore test. The refreshed post-migration recovery proof is the
operative rollback boundary:

- Timestamp: `2026-08-13T23:37:22.4379670Z`
- Boundary: post P2-A Migration C
- SHA-256:
  `06496D7CE3C200FAA83068E2286FC43E61CBF0B65AB8FD17F5C40FE079BA4916`
- Result: PostgreSQL 17 restore PASS
- Local ignored evidence:
  `artifacts/p2a-production/backup-evidence-20260813T233442Z.json`

## 4. Migration-ledger reconciliation

The separately reviewed reconciliation preserved all 162 legacy rows in
`p2a_legacy_migration_history._prisma_migrations`, denied client-role access,
and created a canonical public Prisma ledger. Archive evidence:

- 162 total rows
- 146 active rows
- 16 rolled-back rows
- 0 unfinished rows
- MD5: `3aab4e08bbd40926f7dc931f687065d5`

The production catalog exactly matched the pre-reconciliation canonical hash
`d0725f2b90d8af4ddab8fd159618696c465497ffe77dedb8430a7d3a28e7f96a`.
After the canonical marker and privileged identity migration, it matched
`eb2b793ef8a196b0c09edfcf1e6d24450cb8d15f335f395e338d3c14640576d7`.

The authoritative status command is:

```powershell
npx prisma migrate status --schema prisma/canonical/schema.prisma
```

It reports six migrations and `Database schema is up to date!`. The default
legacy migration directory is not the reconciled production status surface.

## 5. Production migration results

| Migration | UTC completion | Result |
|---|---:|---|
| Canonical baseline marker | 2026-08-13 22:38:21.428682 | Active, marker only |
| Privileged identity hardening | 2026-08-13 22:38:39.463775 | Active |
| A, provenance core | 2026-08-13 22:38:40.119042 | Active |
| B1, nullable AI correlation | 2026-08-13 22:38:40.523899 | Active |
| B2, concurrent index | 2026-08-13 22:41:29.326999 | Active after reviewed recovery |
| C, immutability and root guards | 2026-08-13 22:41:44.637915 | Active |

Prisma first attempted B2 inside a transaction and PostgreSQL correctly
rejected it with SQLSTATE `25001`. The reviewed recovery was followed exactly:
the failed row was marked rolled back, byte-exact B2 ran in autocommit mode,
the physical index was proven ready and valid, and only then was the canonical
marker recorded. The failed incident row remains in the ledger; it was not
hidden with an applied marker.

Final database proof:

- 14 P2-A enums and four P2-A tables
- `riskReasons` is `NOT NULL` with an empty-array default
- `AIInteraction.generationCorrelationId` is nullable with no default
- B2 index is unique by name, ready, valid, and has the reviewed definition
- 10 enabled P2-A guards
- 12 validated foreign keys
- 10 reviewed non-primary unique indexes plus four primary-key indexes, all
  ready and valid
- no physical provenance column on `CurriculumContent`
- all update, delete, truncate, identity, and cross-root rejection tests PASS
- same-root pointer and allowed projection update tests PASS

## 6. Application deployment and writer activation

The reviewed application was first deployed with writers disabled. Production
health, authentication boundaries, curriculum reads, and protected teacher,
admin, and MOE workflow routing passed. Writers were then enabled only in
Production with `P2A_PROVENANCE_WRITERS_DISABLED=false`.

The final production deployment is:

- Commit: `9f684eb1ba1cedba08f0f8ca7bb9514999bd8d37`
- Deployment: `dpl_FtbWzrqh7QaK2B2YMVsLBYdu8sSD`
- Build: `bld_5ba35sgyb`
- Immutable URL:
  `https://liberia-learn-2hzkz90r1-farquema-siryons-projects.vercel.app`
- Stable alias: `https://liberia-learn.vercel.app`
- State: Ready and promoted

The exact production build completed `npm run build`, including Prisma generate,
Next.js compilation, lint, and TypeScript validation.

## 7. Controlled smoke writes

Run `p2a-production-smoke-1786668885174` created three dedicated, unassigned
fixtures and no learner-facing assignment. Results:

- deterministic create produced an exact revision and root
- AI create preserved provider, model, prompt key/version/hash, and correlation
  ID linked to `AIInteraction`
- teacher create and edit produced sequences 1 and 2 and advanced the pointer
- risk governance produced an event without creating a content revision
- compatibility projection remained correct
- required audit rows increased for every state-changing write
- no duplicate root or revision sequence was created

## 8. Backfill

Backfill run ID: `p2a-production-backfill-20260814`

Dry-run result:

- candidates scanned: 1,105
- existing governed fixtures: 3
- VERIFIED: 2
- PARTIAL: 1
- UNVERIFIED: 1,102
- failures, conflicts, and anomalies: 0
- curriculum-body digest:
  `f030d16ff40022f1127a944a400a1d4f38a629b8eabb803fb64d5ea7e336ae9e`

Execution began with a 10-row canary and continued with stable-cursor,
idempotent, per-row transactions. Final result:

- content rows: 1,105
- provenance roots: 1,105
- revisions: 1,106
- missing roots: 0
- invalid current pointers: 0
- duplicate sequences: 0
- final VERIFIED: 2
- final PARTIAL: 1
- final UNVERIFIED: 1,102
- anomalies: 0
- curriculum-body digest unchanged

No timestamp-proximity lineage, prompt, reviewer, evidence, or provenance
certainty was fabricated.

## 9. Readers, evidence, governance, and offline consequences

The production provenance-aware readers and admin/MOE explainability APIs are
active. Legacy compatibility fields remain present. `LessonVersion` remains
teacher undo history and `CurriculumVersion` remains release grouping.

Dedicated-fixture verification passed for:

- append-only, revision-specific evidence and evidence supersession
- automated approval only on VERIFIED provenance
- human-review approval, revocation, and reinstatement
- exact-revision governance and AuditLog linkage
- default `BLOCK_NEW`, `WITHDRAW_EXISTING`, and
  `INVALIDATE_ON_NEXT_REFRESH` consequences
- successor replacement with
  `URGENT_INVALIDATE_ON_NEXT_REFRESH`
- exact current revision and provenance explanation
- database rejection of revision updates

Production now has a dedicated content-manifest RSA signing pair and key ID.
The private key is a sensitive Vercel Production variable and is not committed
or exportable through the operator env pull. The authenticated live request for
the revoked fixture returned HTTP 410 with a signed manifest. Its content ID,
revoked flag, null version, successor policy, and RSA signature all verified.

## 10. Observability and final validation

- Root, `/api/health`, and login: HTTP 200
- Protected teacher, admin, and MOE entry points: expected HTTP 307 redirects
- Unauthorized provenance APIs: HTTP 401
- Vercel production error logs in the one-hour cutover window: no entries
- Vercel production HTTP 500 query in the same window: no entries
- DB long transactions over five minutes: 0
- DB ungranted locks: 0
- missing pointers: 0
- duplicate revision sequences: 0
- unaudited governance events: 0
- canonical Prisma migration status: up to date
- Prisma validate: PASS
- Prisma generate 6.19.3: PASS
- TypeScript: PASS
- writer architecture guard: PASS
- focused P2-A tests: 33/33 PASS
- prompt archive and canonical guard tests: PASS
- full Vitest: 4,669/4,669 across 571 files PASS
- PostgreSQL 17 canonical clean bootstrap/restore: PASS
- exact production `npm run build`: PASS
- `git diff --check`: PASS

The first final full-suite attempt ran concurrently with three other heavy
validation jobs and had four timeout-only cases with 4,665 passing tests. The
same four files passed 52/52 unchanged in isolation, and the uncontended exact
full restart passed all 4,669 tests.

## 11. Known debt and out-of-scope work

- The broad 197-table RLS remediation was not performed. It remains the P0
  backlog in `docs/security/PRODUCTION_RLS_EXPOSURE_AUDIT.md`.
- P2-B reviewer credentialing remains separate.
- Legacy compatibility fields remain intentionally present.
- The build reports 21 dependency audit findings: 1 low, 3 moderate, 14 high,
  and 3 critical. This is pre-existing dependency-remediation debt, not a P2-A
  schema or runtime regression.
- Build output warns that existing Upstash URL/token values may contain
  whitespace. The health and cutover checks passed, but the configuration
  should be normalized in its own reviewed operations change.

## 12. Closure

P2-A production schema, writers, backfill, readers, governance, evidence,
revocation, offline invalidation, explainability, compatibility, and integrity
gates are complete. Curriculum provenance now has one immutable and auditable
production history without claiming provenance facts that were never recorded.

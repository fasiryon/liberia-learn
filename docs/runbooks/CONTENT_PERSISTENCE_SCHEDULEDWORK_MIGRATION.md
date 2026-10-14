# Future ContentBundle and ScheduledWork migration runbook

This is a future operator procedure, not deployment authorization. Wave 3A runs
only local tests. No hosted migration/backfill/publication is executed.

1. Verify database backup and recovery posture, including tested restore evidence,
   exact target identity and approved maintenance window. Record current migration
   ledger, existing ScheduledWork count and schema/catalog state.
2. Apply the reviewed additive canonical migration
   `20261013_000001_content_bundle_scheduledwork_pins` using the repository's canonical
   migration execution procedure. Never deploy the legacy `prisma/migrations` root.
   On an already-current database, `prisma migrate deploy --schema
   prisma/canonical/schema.prisma` applies pending canonical migrations. For a clean
   bootstrap, honor the historical concurrent-index nontransactional override in
   `prisma/canonical/migration-execution.json`; do not replay that index transactionally.
   Verify the SQL hash and pending migration list before execution. Existing rows
   receive six NULL pins; no rows are rewritten. Check lock/statement timeouts and
   plan for ordinary index creation on ScheduledWork. On failure, stop and inspect
   ledger/catalog before any resolve/retry or forward fix.
3. Verify compatibility with the currently deployed application: row counts,
   legacy scheduling/delivery, table/index/trigger existence, RLS and revoked direct
   client grants. New storage must not introduce public data access.
4. Deploy code that reads old and new rows; regenerate Prisma client. Exercise
   legacy delivery, partial-pin rejection, corrupt/missing bundle handling, exact
   version resolution and school/enrollment boundaries.
5. Enable governed writes only after separate approval and complete exact authority
   adapters, reviewed release/resource/toolkit inputs, authorized school allocation
   and audited delivery/auxiliary consumers. V1 supplies an internal writer, no
   production enable flag or public mutation route. Teacher Preview remains read-only.
6. Run dry-run backfill on an explicitly authorized read-only snapshot. The shipped
   analyzer accepts only a local/test loopback DB; obtain an approved local snapshot
   and set DATABASE_URL and DIRECT_URL explicitly to it. Run
   `npm run content:scheduledwork:analyze -- --dry-run --matches <reviewed-file>`.
   The JSON file contains `{scheduledWorkId, schoolId, contentId, ref}` entries;
   ref contains all six exact pins. Never infer historical version from mutable
   current content. With unresolved authority, safe counts may truthfully be zero.
7. Review all five classification counts, tenant scope, exact proposed hashes and
   historical correspondence evidence. Sample every ambiguous/partial category.
   Duplicate mappings or missing authority must not be guessed away.
8. Explicitly authorize write backfill in a later mission. The shipped CLI has no
   write mode. Implement/review a scoped transactional writer that re-resolves current
   authority and compare-and-sets six NULL fields by id and school; write only SAFE
   rows, preserve contentId and verify idempotence. Production remains refused unless
   separately authorized. Do not treat a dry-run report as a write authorization.
9. Observe missing/corrupt/partial diagnostics, authority revocations, row counts,
   scheduling error rate and tenant denial behavior. Retain unresolved rows in legacy
   or unavailable classification; never downgrade partial pins to legacy.
10. Tighten governed completeness constraints only in a later reviewed migration.
    No legacy field/table/path retirement is part of this procedure.

Rollback means stopping governed writers and reverting compatible code while
retaining additive schema and durable data. A legacy-only rollback can serve mutable
legacy content for pinned rows, so it is unsafe while governed delivery remains
enabled. Use a forward fix where possible. Prisma does not provide an automatic
safe down migration. Any restore, trigger removal, table/column deletion or production
mutation needs independent approval and a concrete reviewed recovery plan.

Local reproduction:
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-content-persistence-migration.ps1`.
It creates/removes only its uniquely named disposable localhost container, replays
canonical SQL (including the historical nontransactional index), seeds one legacy
row and checks the new migration. No hosted configuration is needed.

After `npm run build`, `node scripts/verify-content-local-boot.cjs` starts the
produced application on a temporary loopback port, checks homepage HTTP 200 and
stops only its own child process. It forces unreachable local DB URLs and local
auth configuration; it does not verify a hosted session or portable deployment.

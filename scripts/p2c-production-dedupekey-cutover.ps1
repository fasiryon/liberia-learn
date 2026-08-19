<#
.SYNOPSIS
  P2-C production cutover: orchestrates the AIInteraction.dedupeKey unique
  index application against production, using CREATE INDEX CONCURRENTLY.

.DESCRIPTION
  Not executed as part of the pre-cutover preparation pass that wrote this
  script -- this is the runbook step a human operator runs during the
  actual controlled cutover (Action 3 / Phase 4 of the cutover runbook).

  Runs, in order, with an explicit STOP on any failure:
    1. Preflight (read-only): scripts/p2c-production-dedupekey-preflight.sql
       -- hard-stops if any duplicate non-null dedupeKey group exists.
    2. Apply (DDL): scripts/p2c-production-dedupekey-apply.sql -- DROP INDEX
       CONCURRENTLY IF EXISTS (old) + CREATE UNIQUE INDEX CONCURRENTLY IF
       NOT EXISTS (new), non-transactional, mirroring the proven
       20260810_000003_p2a_ai_generation_correlation_index precedent for
       this same table.
    3. Verify (read-only): scripts/p2c-production-dedupekey-verify.sql --
       confirms the new index is unique/ready/valid and the old one is
       gone. Refuses to proceed to step 4 if not.
    4. Ledger (Prisma): scripts/p2c-production-dedupekey-ledger.ts --
       records the migration in production's _prisma_migrations, checksum
       matching the unchanged canonical migration file (same checksum
       staging's ledger entry already has).

  All four steps are individually idempotent -- safe to re-run this whole
  script if it stops partway, EXCEPT: if step 2 leaves an INVALID index
  (a CONCURRENTLY build that failed partway), step 3 will report that and
  this script will stop with instructions rather than silently retrying
  (see scripts/p2c-production-dedupekey-verify.sql's own header comment).

.PARAMETER Confirm
  Must be passed to actually run anything. Without it, prints the plan and
  exits without touching production.

.NOTES
  This script was not run against production during the pass that wrote
  it, per that pass's explicit instruction ("prepare, do not execute").
  Full disposable-Postgres testing of the CONCURRENTLY DDL was not possible
  in that environment (Docker daemon not running) -- the DDL is a precise,
  line-for-line-pattern adaptation of the already-proven-in-production B2
  precedent, not novel SQL, but a human operator should still watch step 2
  run live rather than treat this as unattended.
#>
param(
  [switch]$Confirm
)

$ErrorActionPreference = "Stop"
$scriptRoot = $PSScriptRoot
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..")

function Write-Stage($n, $name) {
  Write-Output ""
  Write-Output "=== Stage $n : $name ==="
}

Write-Output "P2-C production dedupeKey unique-index cutover"
Write-Output "Repository: $repoRoot"
Write-Output "Target: production (bnphuinpvgpmebcsvmsp) via DATABASE_URL from .env.p2a-production.local"

if (-not $Confirm) {
  Write-Output ""
  Write-Output "DRY RUN (no -Confirm passed). Plan:"
  Write-Output "  1. Preflight (read-only)  : scripts/p2c-production-dedupekey-preflight.sql"
  Write-Output "  2. Apply (DDL)            : scripts/p2c-production-dedupekey-apply.sql"
  Write-Output "  3. Verify (read-only)     : scripts/p2c-production-dedupekey-verify.sql"
  Write-Output "  4. Ledger (Prisma)        : scripts/p2c-production-dedupekey-ledger.ts"
  Write-Output ""
  Write-Output "Re-run with -Confirm to execute against production."
  exit 0
}

Write-Stage 1 "Preflight (read-only)"
& (Join-Path $scriptRoot "p2a-production-psql.ps1") -File (Join-Path $scriptRoot "p2c-production-dedupekey-preflight.sql") -UrlVariable DATABASE_URL
if ($LASTEXITCODE -ne 0) { throw "Preflight failed -- STOP." }
Write-Output ""
Write-Output "Preflight ran. MANUALLY CONFIRM the 'duplicate non-null dedupeKey groups' query above returned ZERO rows before continuing."
Write-Output "This script does not parse psql output to auto-verify that -- the operator must read it."
$proceed = Read-Host "Type EXACTLY 'no duplicates' to continue to Stage 2, anything else aborts"
if ($proceed -ne "no duplicates") {
  Write-Output "Aborted by operator after preflight. Production not modified."
  exit 1
}

Write-Stage 2 "Apply (DDL, CREATE INDEX CONCURRENTLY)"
& (Join-Path $scriptRoot "p2a-production-psql.ps1") -File (Join-Path $scriptRoot "p2c-production-dedupekey-apply.sql") -UrlVariable DATABASE_URL
if ($LASTEXITCODE -ne 0) { throw "Apply step failed -- STOP. Do not proceed to Stage 3/4. Check scripts/p2c-production-dedupekey-verify.sql's header for INVALID-index recovery." }

Write-Stage 3 "Verify (read-only)"
& (Join-Path $scriptRoot "p2a-production-psql.ps1") -File (Join-Path $scriptRoot "p2c-production-dedupekey-verify.sql") -UrlVariable DATABASE_URL
if ($LASTEXITCODE -ne 0) { throw "Verify step failed -- STOP. Do not proceed to Stage 4." }
Write-Output ""
Write-Output "Verify ran. MANUALLY CONFIRM: is_unique=true, is_ready=true, is_valid=true, old_index_still_present=0, zero duplicate rows in the final query."
$proceed2 = Read-Host "Type EXACTLY 'verified' to continue to Stage 4 (ledger write), anything else aborts"
if ($proceed2 -ne "verified") {
  Write-Output "Aborted by operator after verify. Index-level change may already be live; ledger NOT written. Re-run this script later once verified -- Stage 2/3 are idempotent."
  exit 1
}

Write-Stage 4 "Ledger (Prisma)"
Push-Location $repoRoot
try {
  & npx dotenv -e .env.p2a-production.local -- npx tsx scripts/p2c-production-dedupekey-ledger.ts
  if ($LASTEXITCODE -ne 0) { throw "Ledger step failed -- STOP." }
} finally {
  Pop-Location
}

Write-Output ""
Write-Output "P2-C dedupeKey unique-index cutover complete."

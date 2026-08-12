param(
  [string]$RawSchemaPath = "artifacts/pre-p2a-canonical/production-public-schema.raw.sql",
  [string]$CaptureEvidencePath = "artifacts/pre-p2a-canonical/production-public-schema.capture.json",
  [string]$CanonicalRoot = "prisma/canonical"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$resolvedRawPath = (Resolve-Path -LiteralPath (Join-Path $repositoryRoot $RawSchemaPath)).Path
$resolvedEvidencePath = (Resolve-Path -LiteralPath (Join-Path $repositoryRoot $CaptureEvidencePath)).Path
$resolvedCanonicalRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $CanonicalRoot))
$allowedCanonicalRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot "prisma\canonical"))

if (-not $resolvedCanonicalRoot.StartsWith($allowedCanonicalRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Canonical output must remain under prisma/canonical"
}

$captureEvidence = Get-Content -Raw -LiteralPath $resolvedEvidencePath | ConvertFrom-Json
$rawHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedRawPath).Hash.ToLowerInvariant()
if ($rawHash -ne $captureEvidence.artifactSha256) {
  throw "Raw production schema hash does not match capture evidence"
}

$raw = [IO.File]::ReadAllText($resolvedRawPath).Replace("`r`n", "`n")
if ($raw -match '(?im)^\s*(COPY|INSERT\s+INTO)\s+') {
  throw "Raw schema capture contains row data"
}

$blockPattern = '(?ms)^--\n-- Name: (?<name>.*?); Type: (?<type>.*?); Schema: (?<schema>.*?); Owner: .*?\n--\n.*?(?=^--\n-- Name:|^--\n-- PostgreSQL database dump complete)'
$blocks = [regex]::Matches($raw, $blockPattern)
if ($blocks.Count -lt 1) {
  throw "No pg_dump object blocks were found"
}

$includedBlocks = New-Object System.Collections.Generic.List[string]
$excluded = New-Object System.Collections.Generic.List[object]
foreach ($block in $blocks) {
  $name = $block.Groups['name'].Value
  $type = $block.Groups['type'].Value
  $schema = $block.Groups['schema'].Value
  $reason = $null

  if ($name -eq 'public' -and $type -eq 'SCHEMA') {
    $reason = 'Replaced by deterministic CREATE SCHEMA IF NOT EXISTS public'
  } elseif ($name -eq '_prisma_migrations' -and $type -eq 'TABLE') {
    $reason = 'Prisma owns its migration ledger in each environment'
  } elseif ($name.StartsWith('_prisma_migrations ', [StringComparison]::Ordinal) -and $type -eq 'CONSTRAINT') {
    $reason = 'Constraint belongs to Prisma-owned migration ledger'
  }

  if ($null -ne $reason) {
    $excluded.Add([ordered]@{ name = $name; type = $type; schema = $schema; reason = $reason })
  } else {
    $includedBlocks.Add($block.Value.TrimEnd())
  }
}

$migrationName = '20260728_000003_canonical_production_state_baseline'
$migrationDirectory = Join-Path $resolvedCanonicalRoot "migrations\$migrationName"
New-Item -ItemType Directory -Path $migrationDirectory -Force | Out-Null
$migrationPath = Join-Path $migrationDirectory 'migration.sql'
$normalizationPath = Join-Path $resolvedCanonicalRoot 'normalization-manifest.json'

$preamble = @'
-- LiberiaLearn canonical production-state baseline.
-- Source: schema-only PostgreSQL 17 capture from production project bnphuinpvgpmebcsvmsp.
-- Contains no production row data and intentionally excludes Prisma's migration ledger.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA IF NOT EXISTS public;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

BEGIN;
'@

$canonical = $preamble.TrimEnd() + "`n`n" + ($includedBlocks -join "`n`n") + "`n`nCOMMIT;`n"
[IO.File]::WriteAllText($migrationPath, $canonical, [Text.UTF8Encoding]::new($false))

$canonicalHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $migrationPath).Hash.ToLowerInvariant()
$normalization = [ordered]@{
  schemaVersion = 1
  sourceProjectRef = 'bnphuinpvgpmebcsvmsp'
  sourceServerVersion = $captureEvidence.sourceServerVersion
  sourceCaptureTimestamp = $captureEvidence.capturedAt
  sourceArtifactSha256 = $rawHash
  canonicalBaselineMigration = $migrationName
  canonicalBaselinePath = 'prisma/canonical/migrations/20260728_000003_canonical_production_state_baseline/migration.sql'
  canonicalBaselineSha256 = $canonicalHash
  canonicalBaselineBytes = (Get-Item -LiteralPath $migrationPath).Length
  includedPgDumpObjectBlocks = $includedBlocks.Count
  excludedPgDumpObjects = @($excluded | ForEach-Object { $_ })
  requiredApplicationExtensions = @(
    [ordered]@{ name = 'vector'; schema = 'public'; reason = 'CurriculumContent and RagChunk vector columns plus IVFFLAT indexes' }
  )
  providerManagedExtensionsNotReplayed = @('pg_stat_statements', 'supabase_vault')
  installedButNotRequiredByCapturedPublicDdl = @('pgcrypto', 'uuid-ossp')
  approvedNormalizations = @(
    'Removed randomized pg_dump restrict and unrestrict tokens',
    'Removed dump timestamps and non-deterministic header/footer text',
    'Removed owner and privilege statements at capture time',
    'Replaced CREATE SCHEMA public with CREATE SCHEMA IF NOT EXISTS public',
    'Excluded the Prisma-owned _prisma_migrations table and primary key',
    'Added the required vector extension declaration before public vector objects',
    'Canonical catalog uses logical visible-column order because schema-only restore compacts dropped-column attribute-number gaps',
    'Wrapped application-owned schema creation in a transaction'
  )
  containsProductionRows = $false
  containsCredentials = $false
  incorporatesPrivilegedIdentityHardening = $false
  incorporatesP2A = $false
}
[IO.File]::WriteAllText($normalizationPath, ($normalization | ConvertTo-Json -Depth 8) + "`n", [Text.UTF8Encoding]::new($false))

Write-Output "Canonical baseline normalization: PASS"
Write-Output "sourceArtifactSha256=$rawHash"
Write-Output "canonicalBaseline=$migrationPath"
Write-Output "canonicalBaselineSha256=$canonicalHash"
Write-Output "includedBlocks=$($includedBlocks.Count)"
Write-Output "excludedBlocks=$($excluded.Count)"
Write-Output "normalizationManifest=$normalizationPath"

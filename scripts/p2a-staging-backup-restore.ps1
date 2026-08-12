param(
  [Parameter(Mandatory = $true)]
  [string]$Owner,

  [Parameter(Mandatory = $true)]
  [string]$EvidenceLocation
)

$ErrorActionPreference = "Stop"
$approvedStagingRef = "yonpfzjczoffhrgibxkz"
$productionRef = "bnphuinpvgpmebcsvmsp"
$canonicalMigrations = @(
  "20260728_000003_canonical_production_state_baseline",
  "20260803_000001_privileged_identity_hardening"
)
$migrationBoundary = $canonicalMigrations[-1]
$expectedMigrationCount = $canonicalMigrations.Count
$expectedMigrationLedger = $canonicalMigrations -join ","
$clientImage = "postgres:17-alpine"
$urlVariable = "P2A_STAGING_DATABASE_URL"
$projectRef = [Environment]::GetEnvironmentVariable("P2A_STAGING_PROJECT_REF")
$databaseUrl = [Environment]::GetEnvironmentVariable($urlVariable)

if ([string]::IsNullOrWhiteSpace($projectRef) -or [string]::IsNullOrWhiteSpace($databaseUrl)) {
  throw "P2A_STAGING_PROJECT_REF and P2A_STAGING_DATABASE_URL are required"
}
$projectRef = $projectRef.Trim().ToLowerInvariant()
if ($projectRef -ne $approvedStagingRef -or $projectRef -eq $productionRef) {
  throw "Backup source is not the founder-approved staging project"
}
$parsedUrl = [Uri]$databaseUrl
if ($parsedUrl.Host.ToLowerInvariant() -ne "db.$approvedStagingRef.supabase.co" -or $parsedUrl.Port -ne 5432) {
  throw "Backup source is not the approved staging direct endpoint"
}
if ($parsedUrl.Query -notmatch '(^|[?&])sslmode=require(&|$)') {
  throw "Backup source must include sslmode=require"
}

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$artifactRoot = Join-Path $repositoryRoot "artifacts\p2a-staging"
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$dumpPath = Join-Path $artifactRoot "pre-p2a-$stamp.dump"
$evidencePath = Join-Path $artifactRoot "backup-evidence-$stamp.json"
$containerName = "liberialearn-p2a-restore-" + [Guid]::NewGuid().ToString("N")
$localPassword = [Guid]::NewGuid().ToString("N")

function Invoke-Version([string]$Tool) {
  $value = & docker run --rm $clientImage $Tool --version
  if ($LASTEXITCODE -ne 0 -or $value -notmatch '\(PostgreSQL\) 17(?:\.|\s|$)') {
    throw "$Tool is not PostgreSQL major version 17"
  }
  return ($value | Out-String).Trim()
}

function Invoke-StagingScalar([string]$Sql) {
  $shell = 'url="$(printenv "$1")"; shift; exec psql "$url" -X -v ON_ERROR_STOP=1 -At "$@"'
  $result = & docker run --rm -i -e $urlVariable $clientImage sh -c $shell p2a-backup $urlVariable -c $Sql
  if ($LASTEXITCODE -ne 0) { throw "Staging SQL assertion failed" }
  return ($result | Out-String).Trim()
}

$psqlVersion = Invoke-Version "psql"
$pgDumpVersion = Invoke-Version "pg_dump"
$pgRestoreVersion = Invoke-Version "pg_restore"
$sourceIdentity = Invoke-StagingScalar "SELECT concat_ws('|', current_database(), current_setting('server_version'), COALESCE((SELECT ssl::text FROM pg_stat_ssl WHERE pid = pg_backend_pid()), 'false'));"
$identityParts = $sourceIdentity.Split('|')
if ($identityParts.Count -ne 3 -or $identityParts[0] -ne "postgres" -or $identityParts[1] -notmatch '^17\.' -or $identityParts[2] -ne "true") {
  throw "Staging source identity, PostgreSQL 17 server version, or SSL assertion failed"
}

$dumpFileName = Split-Path -Leaf $dumpPath
$dumpShell = 'url="$(printenv "$1")"; shift; exec pg_dump "$url" --format=custom --no-owner --no-privileges --file "$2"'
& docker run --rm -e $urlVariable -v "${artifactRoot}:/backup" $clientImage sh -c $dumpShell p2a-dump $urlVariable "/backup/$dumpFileName"
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $dumpPath)) { throw "pg_dump failed" }
$dumpHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $dumpPath).Hash.ToUpperInvariant()
$createdAt = (Get-Date).ToUniversalTime()

try {
  & docker run -d --rm --name $containerName -e "POSTGRES_PASSWORD=$localPassword" -v "${artifactRoot}:/backup:ro" $clientImage | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Disposable PostgreSQL 17 restore container failed to start" }
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & docker exec $containerName pg_isready -U postgres | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw "Disposable PostgreSQL 17 restore container did not become ready" }

  & docker exec $containerName pg_restore --exit-on-error --no-owner --no-privileges -U postgres -d postgres "/backup/$dumpFileName"
  if ($LASTEXITCODE -ne 0) { throw "Disposable PostgreSQL 17 restore failed" }

  $restoreState = & docker exec $containerName psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -At -c @"
SELECT concat_ws('|',
  (SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
  (SELECT count(*) FROM public."_prisma_migrations" WHERE migration_name = '$migrationBoundary' AND finished_at IS NOT NULL AND rolled_back_at IS NULL),
  (SELECT COALESCE(string_agg(migration_name, ',' ORDER BY started_at), '') FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
  (SELECT count(*) FROM public."_prisma_migrations" WHERE migration_name LIKE '%p2a%'),
  (SELECT count(*) FROM public."CurriculumContent" WHERE "contentId" IN ('p2a-staging-fixture-content-1', 'p2a-staging-fixture-content-2')),
  (SELECT count(*) FROM (VALUES
    (to_regclass('public."CurriculumProvenance"')),
    (to_regclass('public."CurriculumContentRevision"')),
    (to_regclass('public."CurriculumGovernanceEvent"')),
    (to_regclass('public."CurriculumEvidence"'))
  ) AS relations(relation_name) WHERE relation_name IS NOT NULL)
);
"@
  if ($LASTEXITCODE -ne 0) { throw "Restore verification query failed" }
  $restoreState = ($restoreState | Out-String).Trim()
  if ($restoreState -ne "$expectedMigrationCount|1|$expectedMigrationLedger|0|2|0") {
    throw "Restore verification failed (migration count|boundary|ledger|P2-A|fixtures|provenance = $restoreState)"
  }

  $restoreTestedAt = (Get-Date).ToUniversalTime()
  $evidence = [ordered]@{
    environment = "staging"
    projectRef = $approvedStagingRef
    database = "postgres"
    databaseHost = "db.$approvedStagingRef.supabase.co"
    createdAtUtc = $createdAt.ToString("o")
    retentionUntilUtc = $createdAt.AddDays(7).ToString("o")
    method = "logical-pg-dump"
    owner = $Owner
    evidenceLocation = $EvidenceLocation
    restoreTestStatus = "passed"
    restoreTestedAtUtc = $restoreTestedAt.ToString("o")
    artifactPath = $dumpPath
    artifactSha256 = $dumpHash
    serverVersion = $identityParts[1]
    psqlVersion = $psqlVersion
    pgDumpVersion = $pgDumpVersion
    pgRestoreVersion = $pgRestoreVersion
    expectedMigrationBoundary = $migrationBoundary
    expectedMigrationCount = $expectedMigrationCount
    migrationLedger = $canonicalMigrations
    syntheticFixtureCount = 2
    p2aMigrationCount = 0
    provenanceTableCount = 0
  }
  $evidence | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $evidencePath -Encoding utf8

  Write-Output "Backup source project: $approvedStagingRef"
  Write-Output "Backup source database: postgres"
  Write-Output "PostgreSQL server: $($identityParts[1])"
  Write-Output "Backup timestamp UTC: $($createdAt.ToString('o'))"
  Write-Output "Backup SHA-256: $dumpHash"
  Write-Output "Disposable PostgreSQL 17 restore: PASS"
  Write-Output "Evidence path: $evidencePath"
} finally {
  if ($containerName.StartsWith("liberialearn-p2a-restore-", [StringComparison]::Ordinal)) {
    & docker rm -f $containerName 2>$null | Out-Null
  }
}

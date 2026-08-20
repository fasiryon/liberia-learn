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
$restoreImage = "pgvector/pgvector:0.8.0-pg17"
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
$databaseHost = $parsedUrl.Host.ToLowerInvariant()
$databaseUser = [Uri]::UnescapeDataString($parsedUrl.UserInfo.Split(':', 2)[0])
$isDirect = $databaseHost -eq "db.$approvedStagingRef.supabase.co" -and
  $parsedUrl.Port -eq 5432 -and $databaseUser -eq "postgres"
$isSessionPooler = $databaseHost -match '^aws-[a-z0-9-]+\.pooler\.supabase\.com$' -and
  $parsedUrl.Port -eq 5432 -and $databaseUser -eq "postgres.$approvedStagingRef"
if (-not $isDirect -and -not $isSessionPooler) {
  throw "Backup source must use the approved staging direct endpoint or Supavisor session mode on port 5432"
}
$migrationTransport = if ($isDirect) { "direct" } else { "session-pooler" }
if ($migrationTransport -eq "session-pooler" -and
    [Environment]::GetEnvironmentVariable("P2A_DIRECT_ENDPOINT_UNREACHABLE") -ne "true") {
  throw "Session-pooler backup fallback requires P2A_DIRECT_ENDPOINT_UNREACHABLE=true"
}
if ($parsedUrl.Port -eq 6543 -or $parsedUrl.Query -match '(^|[?&])pgbouncer=true(&|$)') {
  throw "Supavisor transaction mode is prohibited for native PostgreSQL backup operations"
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
$urlUserInfo = $parsedUrl.UserInfo.Split(':', 2)
$clientEnvironment = [ordered]@{
  PGHOST = $databaseHost
  PGPORT = $parsedUrl.Port.ToString()
  PGUSER = [Uri]::UnescapeDataString($urlUserInfo[0])
  PGPASSWORD = [Uri]::UnescapeDataString($urlUserInfo[1])
  PGDATABASE = [Uri]::UnescapeDataString($parsedUrl.AbsolutePath.TrimStart('/'))
  PGSSLMODE = "require"
}
$previousEnvironment = @{}
$clientDockerArgs = @()
foreach ($name in $clientEnvironment.Keys) {
  $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name)
  [Environment]::SetEnvironmentVariable($name, $clientEnvironment[$name])
  $clientDockerArgs += @("-e", $name)
}
trap {
  foreach ($name in $clientEnvironment.Keys) {
    [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name])
  }
  throw $_
}

function Invoke-Version([string]$Tool) {
  $value = & docker run --rm $clientImage $Tool --version
  if ($LASTEXITCODE -ne 0 -or $value -notmatch '\(PostgreSQL\) 17(?:\.|\s|$)') {
    throw "$Tool is not PostgreSQL major version 17"
  }
  return ($value | Out-String).Trim()
}

function Invoke-StagingScalar([string]$Sql) {
  $result = & docker run --rm -i @clientDockerArgs $clientImage psql -X -q -v ON_ERROR_STOP=1 -At -c $Sql
  if ($LASTEXITCODE -ne 0) { throw "Staging SQL assertion failed" }
  return ($result | Out-String).Trim()
}

function Invoke-StagingConninfo {
  $result = & docker run --rm -i @clientDockerArgs $clientImage psql -X -q -v ON_ERROR_STOP=1 -c '\conninfo'
  if ($LASTEXITCODE -ne 0) { throw "Staging client TLS assertion failed" }
  return ($result | Out-String).Trim()
}

$psqlVersion = Invoke-Version "psql"
$pgDumpVersion = Invoke-Version "pg_dump"
$pgRestoreVersion = Invoke-Version "pg_restore"
$sourceIdentity = Invoke-StagingScalar "SELECT concat_ws('|', current_database(), current_setting('server_version'), COALESCE((SELECT ssl::text FROM pg_stat_ssl WHERE pid = pg_backend_pid()), 'false'));"
$sourceConninfo = Invoke-StagingConninfo
$identityParts = $sourceIdentity.Split('|')
if ($identityParts.Count -ne 3 -or $identityParts[0] -ne "postgres" -or $identityParts[1] -notmatch '^17\.') {
  throw "Staging source identity or PostgreSQL 17 server version assertion failed"
}
if ($sourceConninfo -notmatch 'SSL connection \(protocol: TLS') {
  throw "Staging source client connection is not using SSL"
}
if ($migrationTransport -eq "session-pooler") {
  $sessionProbe = Invoke-StagingScalar @"
BEGIN;
CREATE TEMP TABLE p2a_session_backup_probe(value integer) ON COMMIT PRESERVE ROWS;
INSERT INTO p2a_session_backup_probe VALUES (1);
COMMIT;
SELECT count(*) FROM p2a_session_backup_probe;
DROP TABLE p2a_session_backup_probe;
"@
  if ($sessionProbe.Trim() -ne "1") {
    throw "Supavisor session-mode persistence probe failed"
  }
}

$dumpFileName = Split-Path -Leaf $dumpPath
& docker run --rm @clientDockerArgs -v "${artifactRoot}:/backup" $clientImage pg_dump --format=custom --schema=public --no-owner --no-privileges --file "/backup/$dumpFileName"
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $dumpPath)) { throw "pg_dump failed" }
$dumpHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $dumpPath).Hash.ToUpperInvariant()
$createdAt = (Get-Date).ToUniversalTime()

try {
  & docker run -d --rm --name $containerName -e "POSTGRES_PASSWORD=$localPassword" -v "${artifactRoot}:/backup:ro" -v "${repositoryRoot}:/workspace:ro" $restoreImage | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Disposable PostgreSQL 17 restore container failed to start" }
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & docker exec $containerName pg_isready -U postgres | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw "Disposable PostgreSQL 17 restore container did not become ready" }

  & docker exec $containerName psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public CASCADE;'
  if ($LASTEXITCODE -ne 0) { throw "Disposable PostgreSQL 17 public-schema preparation failed" }
  & docker exec $containerName psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -c 'CREATE SCHEMA public; CREATE EXTENSION vector WITH SCHEMA public;'
  if ($LASTEXITCODE -ne 0) { throw "Disposable PostgreSQL 17 vector preparation failed" }

  $restoreList = & docker exec $containerName pg_restore --list "/backup/$dumpFileName"
  if ($LASTEXITCODE -ne 0) { throw "Disposable PostgreSQL 17 restore list failed" }
  $restoreList = $restoreList | ForEach-Object {
    if ($_ -match ' SCHEMA - public ') { ";$_" } else { $_ }
  }
  $restoreList | & docker exec -i $containerName tee /tmp/p2a-restore.list | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Disposable PostgreSQL 17 filtered restore list failed" }

  & docker exec $containerName pg_restore --exit-on-error --no-owner --no-privileges --use-list=/tmp/p2a-restore.list -U postgres -d postgres "/backup/$dumpFileName"
  if ($LASTEXITCODE -ne 0) { throw "Disposable PostgreSQL 17 restore failed" }

  $restoreState = & docker exec $containerName psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 -At -f /workspace/scripts/p2a-staging-restore-verify.sql
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
    databaseHost = $databaseHost
    migrationTransport = $migrationTransport
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
  [IO.File]::WriteAllText(
    $evidencePath,
    ($evidence | ConvertTo-Json -Depth 4),
    [Text.UTF8Encoding]::new($false)
  )

  Write-Output "Backup source project: $approvedStagingRef"
  Write-Output "Backup source database: postgres"
  Write-Output "Migration transport mode: $migrationTransport"
  Write-Output "PostgreSQL server: $($identityParts[1])"
  Write-Output "Staging client TLS: PASS"
  Write-Output "Backup timestamp UTC: $($createdAt.ToString('o'))"
  Write-Output "Backup SHA-256: $dumpHash"
  Write-Output "Disposable PostgreSQL 17 restore: PASS"
  Write-Output "Evidence path: $evidencePath"
} finally {
  if ($containerName.StartsWith("liberialearn-p2a-restore-", [StringComparison]::Ordinal)) {
    & docker rm -f $containerName 2>$null | Out-Null
  }
  foreach ($name in $clientEnvironment.Keys) {
    [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name])
  }
}

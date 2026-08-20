param(
  [Parameter(Mandatory = $true)]
  [string]$Owner,

  [Parameter(Mandatory = $true)]
  [string]$EvidenceLocation,

  [ValidateSet("pre-p2a-migration-a", "post-p2a-migration-c", "post-p2b-human", "post-p2c")]
  [string]$MigrationBoundary = "pre-p2a-migration-a"
)

$ErrorActionPreference = "Stop"
$productionRef = "bnphuinpvgpmebcsvmsp"
$stagingRef = "yonpfzjczoffhrgibxkz"
$clientImage = "postgres:17-alpine"
$restoreImage = "pgvector/pgvector:0.8.0-pg17"
$runtimeUrl = [Environment]::GetEnvironmentVariable("DATABASE_URL")

if ([string]::IsNullOrWhiteSpace($runtimeUrl)) {
  throw "DATABASE_URL is required"
}

$runtimeUri = [Uri]$runtimeUrl
$runtimeUserInfo = $runtimeUri.UserInfo.Split(':', 2)
$runtimeUser = [Uri]::UnescapeDataString($runtimeUserInfo[0])
if ($runtimeUri.Host -like "*$stagingRef*" -or $runtimeUser -like "*$stagingRef*") {
  throw "Production backup resolved to the staging project"
}
if ($runtimeUri.Host -notmatch '^aws-[a-z0-9-]+\.pooler\.supabase\.com$' -or
    $runtimeUri.Port -ne 6543 -or
    $runtimeUser -ne "postgres.$productionRef") {
  throw "DATABASE_URL is not the approved production transaction pooler"
}
if ($runtimeUri.Query -notmatch '(^|[?&])sslmode=require(&|$)') {
  throw "Production runtime transport must include sslmode=require"
}

$sessionBuilder = [UriBuilder]$runtimeUri
$sessionBuilder.Port = 5432
$sessionBuilder.Query = (($runtimeUri.Query.TrimStart('?').Split('&') |
  Where-Object { $_ -and $_ -notmatch '^pgbouncer=' }) -join '&')
$sessionUri = $sessionBuilder.Uri
$databaseHost = $sessionUri.Host.ToLowerInvariant()
$databaseUser = [Uri]::UnescapeDataString($sessionUri.UserInfo.Split(':', 2)[0])
if ($databaseHost -notmatch '^aws-[a-z0-9-]+\.pooler\.supabase\.com$' -or
    $sessionUri.Port -ne 5432 -or
    $databaseUser -ne "postgres.$productionRef") {
  throw "Derived backup transport is not the approved production session pooler"
}

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$artifactRoot = Join-Path $repositoryRoot "artifacts\p2a-production"
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$dumpPath = Join-Path $artifactRoot "pre-p2a-production-$stamp.dump"
$evidencePath = Join-Path $artifactRoot "backup-evidence-$stamp.json"
$containerName = "liberialearn-p2a-production-restore-" + [Guid]::NewGuid().ToString("N")
$localPassword = [Guid]::NewGuid().ToString("N")
$clientEnvironment = [ordered]@{
  PGHOST = $databaseHost
  PGPORT = "5432"
  PGUSER = $databaseUser
  PGPASSWORD = [Uri]::UnescapeDataString($sessionUri.UserInfo.Split(':', 2)[1])
  PGDATABASE = [Uri]::UnescapeDataString($sessionUri.AbsolutePath.TrimStart('/'))
  PGSSLMODE = "require"
}
$previousEnvironment = @{}
$clientDockerArgs = @()
foreach ($name in $clientEnvironment.Keys) {
  $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name)
  [Environment]::SetEnvironmentVariable($name, $clientEnvironment[$name])
  $clientDockerArgs += @("-e", $name)
}

function Invoke-Version([string]$Tool) {
  $value = & docker run --rm $clientImage $Tool --version
  if ($LASTEXITCODE -ne 0 -or $value -notmatch '\(PostgreSQL\) 17(?:\.|\s|$)') {
    throw "$Tool is not PostgreSQL major version 17"
  }
  return ($value | Out-String).Trim()
}

function Invoke-ProductionScalar([string]$Sql) {
  $result = $Sql | & docker run --rm -i @clientDockerArgs $clientImage psql -X -q -v ON_ERROR_STOP=1 -At -f -
  if ($LASTEXITCODE -ne 0) { throw "Production SQL assertion failed" }
  return ($result | Out-String).Trim()
}

try {
  $psqlVersion = Invoke-Version "psql"
  $pgDumpVersion = Invoke-Version "pg_dump"
  $pgRestoreVersion = Invoke-Version "pg_restore"
  $sourceIdentity = Invoke-ProductionScalar "SELECT concat_ws('|', current_database(), current_setting('server_version'));"
  $sourceConninfo = & docker run --rm -i @clientDockerArgs $clientImage psql -X -q -v ON_ERROR_STOP=1 -c '\conninfo'
  if ($LASTEXITCODE -ne 0) { throw "Production client TLS assertion failed" }
  $sourceConninfo = ($sourceConninfo | Out-String).Trim()
  $identityParts = $sourceIdentity.Split('|')
  if ($identityParts.Count -ne 2 -or $identityParts[0] -ne "postgres" -or $identityParts[1] -notmatch '^17\.') {
    throw "Production source identity or PostgreSQL 17 assertion failed"
  }
  if ($sourceConninfo -notmatch 'SSL connection \(protocol: TLS') {
    throw "Production source client connection is not using SSL"
  }

  $sourceState = Invoke-ProductionScalar @"
SELECT concat_ws('|',
  (SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
  (SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL),
  (SELECT count(*) FROM public."_prisma_migrations" WHERE migration_name LIKE '20260810_00000%_p2a_%'),
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'),
  (SELECT count(*) FROM public."CurriculumContent"),
  (SELECT count(*) FROM public."_prisma_migrations" WHERE migration_name LIKE '%p2c%')
);
"@
  $sourceParts = $sourceState.Split('|')
  # post-p2c: derived, not guessed, from a live production ledger query run
  # 2026-08-19 during pre-cutover preparation (active=9, p2aLikeCount=5,
  # publicTables=216, curriculumContent=1105, p2cLikeCount=0 at that time)
  # plus the 4 net-new migrations this cutover adds (3 P2-C schema + the
  # dedupeKey-unique index): 9 + 4 = 13 active, p2cLikeCount becomes 4.
  # publicTables is expected to become 216 + 13 new P2-C tables = 229,
  # matching staging's own post-P2C table count exactly -- recorded in the
  # evidence JSON like the other boundaries, not asserted here, consistent
  # with how publicTableCount/curriculumContentCount are already handled
  # for the other three boundaries (captured, not gated).
  # post-p2b-human corrected 8 -> 9 on 2026-08-20: a fresh live query of
  # production's _prisma_migrations ledger (10 total rows) showed 9 active,
  # not 8 -- the 10th row is a rolled-back duplicate attempt at
  # 20260810_000003_p2a_ai_generation_correlation_index (finished_at NULL,
  # rolled_back_at set) followed by its successful retry (already excluded
  # by the finished_at/rolled_back_at filter). This is the same benign
  # duplicate the production authorization audit's Gate 10/11 reconciliation
  # already explained; the constant here was simply never updated to match.
  $expectedActiveMigrations = if ($MigrationBoundary -eq "pre-p2a-migration-a") { 146 } elseif ($MigrationBoundary -eq "post-p2b-human") { 9 } elseif ($MigrationBoundary -eq "post-p2c") { 13 } else { 6 }
  $expectedP2ARows = if ($MigrationBoundary -eq "pre-p2a-migration-a") { 0 } else { 5 }
  $expectedP2CRows = if ($MigrationBoundary -eq "post-p2c") { 4 } else { 0 }
  if ($sourceParts.Count -ne 6 -or
      [int]$sourceParts[0] -ne $expectedActiveMigrations -or
      $sourceParts[1] -ne "0" -or
      [int]$sourceParts[2] -ne $expectedP2ARows -or
      [int]$sourceParts[5] -ne $expectedP2CRows) {
    throw "Production migration boundary differs from $MigrationBoundary"
  }

  $dumpFileName = Split-Path -Leaf $dumpPath
  & docker run --rm @clientDockerArgs -v "${artifactRoot}:/backup" $clientImage pg_dump --format=custom --schema=public --no-owner --no-privileges --file "/backup/$dumpFileName"
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $dumpPath)) {
    throw "Production pg_dump failed"
  }
  $dumpHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $dumpPath).Hash.ToUpperInvariant()
  $createdAt = (Get-Date).ToUniversalTime()

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
  if ($LASTEXITCODE -ne 0) { throw "Disposable PostgreSQL 17 schema preparation failed" }
  & docker exec $containerName psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -c 'CREATE SCHEMA public; CREATE EXTENSION vector WITH SCHEMA public;'
  if ($LASTEXITCODE -ne 0) { throw "Disposable PostgreSQL 17 vector preparation failed" }

  $restoreList = & docker exec $containerName pg_restore --list "/backup/$dumpFileName"
  if ($LASTEXITCODE -ne 0) { throw "Disposable PostgreSQL 17 restore list failed" }
  $restoreList = $restoreList | ForEach-Object {
    if ($_ -match ' SCHEMA - public ') { ";$_" } else { $_ }
  }
  $restoreList | & docker exec -i $containerName tee /tmp/p2a-production-restore.list | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Disposable PostgreSQL 17 filtered restore list failed" }

  & docker exec $containerName pg_restore --exit-on-error --no-owner --no-privileges --use-list=/tmp/p2a-production-restore.list -U postgres -d postgres "/backup/$dumpFileName"
  if ($LASTEXITCODE -ne 0) { throw "Disposable PostgreSQL 17 restore failed" }

  $restoreQuery = @"
SELECT concat_ws('|',
  (SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
  (SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL),
  (SELECT count(*) FROM public."_prisma_migrations" WHERE migration_name LIKE '20260810_00000%_p2a_%'),
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'),
  (SELECT count(*) FROM public."CurriculumContent"),
  (SELECT count(*) FROM public."_prisma_migrations" WHERE migration_name LIKE '%p2c%')
);
"@
  $restoreState = $restoreQuery | & docker exec -i $containerName psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 -At -f -
  if ($LASTEXITCODE -ne 0) { throw "Restored production-state verification failed" }
  $restoreState = ($restoreState | Out-String).Trim()
  if ($restoreState -ne $sourceState) {
    throw "Restored production state differs from the captured recovery point"
  }

  $restoreTestedAt = (Get-Date).ToUniversalTime()
  $evidence = [ordered]@{
    environment = "production"
    projectRef = $productionRef
    database = "postgres"
    databaseHost = $databaseHost
    migrationTransport = "session-pooler"
    createdAtUtc = $createdAt.ToString("o")
    retentionUntilUtc = $createdAt.AddDays(7).ToString("o")
    method = "logical-pg-dump"
    owner = $Owner
    evidenceLocation = $EvidenceLocation
    migrationBoundary = $MigrationBoundary
    restoreTestStatus = "passed"
    restoreTestedAtUtc = $restoreTestedAt.ToString("o")
    artifactPath = $dumpPath
    artifactSha256 = $dumpHash
    serverVersion = $identityParts[1]
    psqlVersion = $psqlVersion
    pgDumpVersion = $pgDumpVersion
    pgRestoreVersion = $pgRestoreVersion
    activeMigrationCount = [int]$sourceParts[0]
    unfinishedMigrationCount = [int]$sourceParts[1]
    p2aMigrationCount = [int]$sourceParts[2]
    publicTableCount = [int]$sourceParts[3]
    curriculumContentCount = [int]$sourceParts[4]
    p2cMigrationCount = [int]$sourceParts[5]
  }
  [IO.File]::WriteAllText(
    $evidencePath,
    ($evidence | ConvertTo-Json -Depth 4),
    [Text.UTF8Encoding]::new($false)
  )

  Write-Output "Backup source project: $productionRef"
  Write-Output "Backup source database: postgres"
  Write-Output "Migration transport mode: session-pooler"
  Write-Output "PostgreSQL server: $($identityParts[1])"
  Write-Output "Production client TLS: PASS"
  Write-Output "Backup timestamp UTC: $($createdAt.ToString('o'))"
  Write-Output "Backup SHA-256: $dumpHash"
  Write-Output "Disposable PostgreSQL 17 restore: PASS"
  Write-Output "Evidence path: $evidencePath"
} finally {
  if ($containerName.StartsWith("liberialearn-p2a-production-restore-", [StringComparison]::Ordinal)) {
    $existingContainer = & docker ps -aq --filter "name=^${containerName}$"
    if (-not [string]::IsNullOrWhiteSpace(($existingContainer | Out-String))) {
      & docker rm -f $containerName 2>$null | Out-Null
    }
  }
  foreach ($name in $clientEnvironment.Keys) {
    [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name])
  }
}

param(
  [int]$Port = 55438,
  [string]$ArtifactDirectory = "artifacts/full-canonical/verification",
  [switch]$CaptureManifestHashes
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$resolvedArtifacts = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $ArtifactDirectory))
$allowedArtifacts = [IO.Path]::GetFullPath((Join-Path (Join-Path $repositoryRoot "artifacts") "full-canonical"))
if (-not $resolvedArtifacts.StartsWith($allowedArtifacts, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Verification artifacts must remain under artifacts/full-canonical"
}

$containerName = "liberialearn-full-canonical-pg17-$PID"
$image = "pgvector/pgvector:0.8.0-pg17"
$password = "full_canonical_local_disposable_only"
$database = "liberialearn_canonical_full"
$repositoryMount = $repositoryRoot -replace '\\', '/'
$artifactMount = $resolvedArtifacts -replace '\\', '/'
$canonicalRoot = Join-Path $repositoryRoot "prisma/canonical"
$earlyRoot = Join-Path $resolvedArtifacts "prisma-transactional-prefix"
$specialMigration = "20260810_000003_p2a_ai_generation_correlation_index"
$executionMetadata = Get-Content -Raw (Join-Path $canonicalRoot "migration-execution.json") | ConvertFrom-Json
$authorityRegistryPath = Join-Path $canonicalRoot "schema-authority-registry.json"
$postgresManifestPath = Join-Path $canonicalRoot "postgres-object-manifest.json"
$authorityRegistry = Get-Content -Raw $authorityRegistryPath | ConvertFrom-Json
$postgresManifest = Get-Content -Raw $postgresManifestPath | ConvertFrom-Json
$startedAt = [DateTimeOffset]::UtcNow
$containerStarted = $false
$previousDirectUrl = [Environment]::GetEnvironmentVariable("DIRECT_URL", "Process")
$previousDatabaseUrl = [Environment]::GetEnvironmentVariable("DATABASE_URL", "Process")
$previousDisposableSeedOverride = [Environment]::GetEnvironmentVariable("P2C_SEED_ALLOW_DISPOSABLE", "Process")

function Invoke-Docker {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Docker command failed: docker $($Arguments -join ' ')" }
}

function Invoke-Prisma {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & npx prisma @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Prisma command failed: prisma $($Arguments -join ' ')" }
}

function Query-Scalar {
  param([string]$Sql)
  # Windows PowerShell removes embedded double quotes when marshalling native
  # arguments unless they are escaped for the child process command line.
  $nativeSql = $Sql.Replace('"', '\"')
  $output = & docker exec $containerName psql -h 127.0.0.1 -X -At -v ON_ERROR_STOP=1 -U postgres -d $database -c $nativeSql
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL scalar query failed" }
  return (($output -join "`n").Trim())
}

function Get-P2CSeedState {
  $state = [ordered]@{}
  $tables = @(
    "CurriculumAuthoritySource",
    "CurriculumAuthoritySourceVersion",
    "MoeCurriculumObjective",
    "AssessmentBaselineFramework",
    "AssessmentBaselineSubject",
    "AssessmentBaselineCompetency",
    "CurriculumBaselineAlignment",
    "CurriculumLearningTarget"
  )
  foreach ($table in $tables) {
    $sql = 'SELECT count(*) || ''|'' || md5(coalesce(string_agg(row_to_json(t)::text, '''' ORDER BY id), '''')) FROM public."{0}" t;' -f $table
    $state[$table] = Query-Scalar $sql
  }
  return $state
}

function Sql-Literal {
  param([string]$Value)
  return $Value.Replace("'", "''")
}

function Assert-ManifestHash {
  param(
    [string]$ObjectType,
    [string]$ObjectName,
    [string]$ActualHash,
    [AllowNull()][string]$ExpectedHash,
    [System.Collections.IDictionary]$Captured
  )
  if ([string]::IsNullOrWhiteSpace($ActualHash)) {
    throw "Required PostgreSQL $ObjectType is missing: $ObjectName"
  }
  $Captured["${ObjectType}:${ObjectName}"] = $ActualHash
  if ([string]::IsNullOrWhiteSpace($ExpectedHash)) {
    if (-not $CaptureManifestHashes) {
      throw "PostgreSQL manifest hash is not pinned for ${ObjectType}:${ObjectName}"
    }
    return
  }
  if ($ActualHash -ne $ExpectedHash) {
    throw "PostgreSQL manifest hash mismatch for ${ObjectType}:${ObjectName}"
  }
}

$migrationDirectories = Get-ChildItem (Join-Path $canonicalRoot "migrations") -Directory |
  Where-Object { Test-Path (Join-Path $_.FullName "migration.sql") } |
  Sort-Object Name
$migrationNames = @($migrationDirectories | ForEach-Object Name)
$specialIndex = [Array]::IndexOf($migrationNames, $specialMigration)
if ($specialIndex -lt 1) { throw "Non-transactional migration boundary is missing or invalid" }

$overrideNames = @($executionMetadata.overrides.PSObject.Properties.Name)
if ($overrideNames.Count -ne 1 -or $overrideNames[0] -ne $specialMigration) {
  throw "Exactly the reviewed P2-A concurrent-index migration must be non-transactional"
}
$specialPath = Join-Path $canonicalRoot "migrations/$specialMigration/migration.sql"
$specialHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $specialPath).Hash.ToLowerInvariant()
if ($specialHash -ne $executionMetadata.overrides.$specialMigration.sha256) {
  throw "Non-transactional migration hash does not match execution metadata"
}

New-Item -ItemType Directory -Path $resolvedArtifacts -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $earlyRoot "migrations") -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $canonicalRoot "schema.prisma") -Destination (Join-Path $earlyRoot "schema.prisma") -Force
Copy-Item -LiteralPath (Join-Path $canonicalRoot "migrations/migration_lock.toml") -Destination (Join-Path $earlyRoot "migrations/migration_lock.toml") -Force
foreach ($name in $migrationNames[0..($specialIndex - 1)]) {
  $target = Join-Path $earlyRoot "migrations/$name"
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $canonicalRoot "migrations/$name/migration.sql") -Destination (Join-Path $target "migration.sql") -Force
}

try {
  Invoke-Docker -Arguments @("version", "--format", "{{.Server.Version}}") | Out-Null
  Invoke-Docker -Arguments @("run", "--name", $containerName, "-e", "POSTGRES_PASSWORD=$password", "-p", "127.0.0.1:${Port}:5432", "-v", "${repositoryMount}:/workspace:ro", "-v", "${artifactMount}:/evidence", "-d", $image) | Out-Null
  $containerStarted = $true

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & docker exec $containerName pg_isready -h 127.0.0.1 -U postgres -d postgres *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw "Disposable PostgreSQL 17 did not become ready" }

  Invoke-Docker -Arguments @("exec", $containerName, "createdb", "-h", "127.0.0.1", "-U", "postgres", $database)
  Invoke-Docker -Arguments @("exec", $containerName, "psql", "-h", "127.0.0.1", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", $database, "-c", "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;")

  [Environment]::SetEnvironmentVariable(
    "DIRECT_URL",
    "postgresql://postgres:${password}@127.0.0.1:${Port}/${database}?schema=public",
    "Process"
  )
  [Environment]::SetEnvironmentVariable(
    "DATABASE_URL",
    "postgresql://postgres:${password}@127.0.0.1:${Port}/${database}?schema=public",
    "Process"
  )

  Invoke-Prisma -Arguments @("migrate", "deploy", "--schema", (Join-Path $earlyRoot "schema.prisma"))

  # Execute the frozen concurrent-index bytes exactly once, outside any
  # transaction, then let Prisma calculate/store their real checksum.
  Invoke-Docker -Arguments @("exec", $containerName, "psql", "-h", "127.0.0.1", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", $database, "-f", "/workspace/prisma/canonical/migrations/$specialMigration/migration.sql")
  Invoke-Prisma -Arguments @("migrate", "resolve", "--applied", $specialMigration, "--schema", (Join-Path $canonicalRoot "schema.prisma"))
  Invoke-Prisma -Arguments @("migrate", "deploy", "--schema", (Join-Path $canonicalRoot "schema.prisma"))

  $activeLedger = Query-Scalar 'SELECT string_agg(migration_name, E''\n'' ORDER BY started_at) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;'
  $expectedLedger = $migrationNames -join "`n"
  if ($activeLedger -ne $expectedLedger) { throw "Full canonical ledger does not match the complete ordered migration root" }

  $rolledBack = Query-Scalar 'SELECT count(*) FROM "_prisma_migrations" WHERE rolled_back_at IS NOT NULL;'
  if ($rolledBack -ne "0") { throw "Empty bootstrap unexpectedly produced rolled-back migration rows" }

  $ledgerRows = & docker exec $containerName psql -h 127.0.0.1 -X -At -F '|' -v ON_ERROR_STOP=1 -U postgres -d $database -c 'SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY started_at;'
  foreach ($row in $ledgerRows) {
    $parts = $row -split '\|', 2
    $path = Join-Path $canonicalRoot "migrations/$($parts[0])/migration.sql"
    $expectedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant()
    if ($parts[1] -ne $expectedHash) { throw "Ledger checksum mismatch for $($parts[0])" }
  }

  $tableRls = Query-Scalar "SELECT count(*) || '|' || count(*) FILTER (WHERE rowsecurity) FROM pg_tables WHERE schemaname='public';"
  if ($tableRls -ne "229|229") { throw "Expected 229/229 public tables with RLS, received $tableRls" }

  $p2cTableCount = Query-Scalar "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('CurriculumAuthoritySource','CurriculumAuthoritySourceVersion','MoeCurriculumObjective','AssessmentBaselineFramework','AssessmentBaselineSubject','AssessmentBaselineCompetency','CurriculumBaselineAlignment','CurriculumAlignmentValidityEvent','CurriculumLearningTarget','CurriculumCompetencyCoverage','ExamPreparationProfile','PolicyConfig','PolicyOverride');"
  if ($p2cTableCount -ne "13") { throw "P2-C table count mismatch: $p2cTableCount" }

  $p2cGrants = Query-Scalar "SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated') AND table_name IN ('CurriculumAuthoritySource','CurriculumAuthoritySourceVersion','MoeCurriculumObjective','AssessmentBaselineFramework','AssessmentBaselineSubject','AssessmentBaselineCompetency','CurriculumBaselineAlignment','CurriculumAlignmentValidityEvent','CurriculumLearningTarget','CurriculumCompetencyCoverage','ExamPreparationProfile','PolicyConfig','PolicyOverride');"
  if ($p2cGrants -ne "0") { throw "P2-C anon/authenticated grants remain: $p2cGrants" }

  $integrityObjects = Query-Scalar "SELECT (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relname='CurriculumGovernanceEvent' AND t.tgname='CurriculumGovernanceEvent_authority_guard' AND NOT t.tgisinternal) || '|' || (SELECT count(*) FROM pg_constraint WHERE conname='AssessmentBaselineCompetency_depth_evidence_honesty') || '|' || (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname='AiInteractionLog_aiInteractionId_key') || '|' || (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname='AIInteraction_dedupeKey_key' AND indexdef ILIKE '%UNIQUE%');"
  if ($integrityObjects -ne "1|1|1|1") { throw "Integrity object verification failed: $integrityObjects" }

  $enumValues = Query-Scalar "SELECT (EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='CognitiveDemandCategory' AND e.enumlabel='NOT_ESTABLISHED'))::int || '|' || (EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='CurriculumGovernanceEventType' AND e.enumlabel='AUTHORITY_CORRECTED'))::int;"
  if ($enumValues -ne "1|1") { throw "Integrity enum verification failed: $enumValues" }

  # The production reference-data seed must be a true idempotent operation,
  # not merely an atomic single-use script. Run it twice against the same
  # disposable canonical database and fingerprint every table it owns.
  [Environment]::SetEnvironmentVariable("P2C_SEED_ALLOW_DISPOSABLE", "true", "Process")
  Invoke-Prisma -Arguments @("generate", "--schema", (Join-Path $repositoryRoot "prisma/schema.prisma"))
  & npx tsx (Join-Path $repositoryRoot "scripts/p2c-production-seed.ts")
  if ($LASTEXITCODE -ne 0) { throw "P2-C production seed first disposable run failed" }
  $seedStateAfterFirstRun = Get-P2CSeedState
  & npx tsx (Join-Path $repositoryRoot "scripts/p2c-production-seed.ts")
  if ($LASTEXITCODE -ne 0) { throw "P2-C production seed second disposable run failed" }
  $seedStateAfterSecondRun = Get-P2CSeedState
  if (($seedStateAfterFirstRun | ConvertTo-Json -Compress) -ne ($seedStateAfterSecondRun | ConvertTo-Json -Compress)) {
    throw "P2-C production seed changed semantic state on its second run"
  }

  $manifestHashes = [ordered]@{}
  foreach ($table in $postgresManifest.tables) {
    if (-not $table.required) { continue }
    $name = Sql-Literal $table.name
    $actual = Query-Scalar "SELECT md5(string_agg(a.attname || '|' || format_type(a.atttypid,a.atttypmod) || '|' || a.attnotnull::text || '|' || coalesce(pg_get_expr(d.adbin,d.adrelid),''), E'\n' ORDER BY a.attnum)) FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE c.relnamespace='public'::regnamespace AND c.relname='$name' AND a.attnum>0 AND NOT a.attisdropped GROUP BY c.oid;"
    Assert-ManifestHash -ObjectType "table" -ObjectName $table.name -ActualHash $actual -ExpectedHash $table.definitionMd5 -Captured $manifestHashes
  }
  foreach ($index in $postgresManifest.indexes) {
    if (-not $index.required) { continue }
    $name = Sql-Literal $index.name
    $actual = Query-Scalar "SELECT md5(indexdef) FROM pg_indexes WHERE schemaname='public' AND indexname='$name';"
    Assert-ManifestHash -ObjectType "index" -ObjectName $index.name -ActualHash $actual -ExpectedHash $index.definitionMd5 -Captured $manifestHashes
  }
  foreach ($constraint in $postgresManifest.constraints) {
    if (-not $constraint.required) { continue }
    $name = Sql-Literal $constraint.name
    $actual = Query-Scalar "SELECT md5(pg_get_constraintdef(oid)) FROM pg_constraint WHERE connamespace='public'::regnamespace AND conname='$name' AND convalidated;"
    Assert-ManifestHash -ObjectType "constraint" -ObjectName $constraint.name -ActualHash $actual -ExpectedHash $constraint.definitionMd5 -Captured $manifestHashes
  }
  foreach ($function in $postgresManifest.functions) {
    if (-not $function.required) { continue }
    $name = Sql-Literal $function.name
    $actual = Query-Scalar "SELECT md5(pg_get_functiondef(oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='$name';"
    Assert-ManifestHash -ObjectType "function" -ObjectName $function.name -ActualHash $actual -ExpectedHash $function.definitionMd5 -Captured $manifestHashes
  }
  foreach ($trigger in $postgresManifest.triggers) {
    if (-not $trigger.required) { continue }
    $name = Sql-Literal $trigger.name
    $table = Sql-Literal $trigger.table
    $actual = Query-Scalar "SELECT md5(pg_get_triggerdef(t.oid)) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND c.relname='$table' AND t.tgname='$name' AND NOT t.tgisinternal;"
    Assert-ManifestHash -ObjectType "trigger" -ObjectName "$($trigger.table).$($trigger.name)" -ActualHash $actual -ExpectedHash $trigger.definitionMd5 -Captured $manifestHashes
  }

  $cleanExtensions = Query-Scalar "SELECT string_agg(extname, ',' ORDER BY extname) FROM pg_extension;"
  $expectedCleanExtensions = (@($postgresManifest.extensions.cleanBootstrap.allowed) | Sort-Object) -join ','
  if ($cleanExtensions -ne $expectedCleanExtensions) {
    throw "Clean-bootstrap extensions differ from the environment allowlist: $cleanExtensions"
  }

  $diffFile = Join-Path $resolvedArtifacts "prisma-application-layer.diff.sql"
  $diffReportFile = Join-Path $resolvedArtifacts "layered-diff-report.json"
  $diffOutput = & npx prisma migrate diff --from-url "postgresql://postgres:${password}@127.0.0.1:${Port}/${database}?schema=public" --to-schema-datamodel (Join-Path $repositoryRoot "prisma/schema.prisma") --script
  if ($LASTEXITCODE -ne 0) { throw "Prisma application-layer diff generation failed" }
  [IO.File]::WriteAllText($diffFile, (($diffOutput -join "`n") + "`n"), [Text.UTF8Encoding]::new($false))
  & npx tsx (Join-Path $repositoryRoot "scripts/verify-schema-authority-diff.ts") --diff-file $diffFile --registry $authorityRegistryPath --report $diffReportFile
  if ($LASTEXITCODE -ne 0) { throw "Layered Prisma schema authority verification failed" }
  $diffReport = Get-Content -Raw $diffReportFile | ConvertFrom-Json

  $evidence = [ordered]@{
    schemaVersion = 1
    result = "PASS"
    startedAt = $startedAt.ToString("o")
    completedAt = [DateTimeOffset]::UtcNow.ToString("o")
    postgresImage = $image
    migrationCount = $migrationNames.Count
    migrationLedger = $migrationNames
    nonTransactionalMigration = [ordered]@{ name = $specialMigration; sha256 = $specialHash; executedBeforeResolve = $true }
    publicTables = 229
    rlsEnabledTables = 229
    p2cTables = 13
    p2cAnonAuthenticatedGrants = 0
    schemaParity = "LAYERED_PASS"
    registeredPrismaDifferences = @($diffReport.diffStatementKeys).Count
    declaredPendingDifferences = @($diffReport.declaredPendingKeys)
    destructiveRegisteredDifferences = @($diffReport.destructiveRegisteredKeys)
    postgresManifestHashes = $manifestHashes
    postgresManifestPinned = (-not $CaptureManifestHashes)
    p2cSeedIdempotency = [ordered]@{
      result = "PASS"
      executions = 2
      semanticChangesOnSecondRun = 0
      tableFingerprints = $seedStateAfterSecondRun
    }
    persistentDatabasesTouched = $false
  }
  $evidenceFile = Join-Path $resolvedArtifacts "verification-evidence.json"
  [IO.File]::WriteAllText($evidenceFile, ($evidence | ConvertTo-Json -Depth 8) + "`n", [Text.UTF8Encoding]::new($false))
  Write-Output "Full canonical PostgreSQL 17 bootstrap: PASS"
  Write-Output "migrations=$($migrationNames.Count) tables=229 rls=229 p2cGrants=0 layeredDiffs=$(@($diffReport.diffStatementKeys).Count)"
  Write-Output "evidence=$evidenceFile"
}
finally {
  [Environment]::SetEnvironmentVariable("DIRECT_URL", $previousDirectUrl, "Process")
  [Environment]::SetEnvironmentVariable("DATABASE_URL", $previousDatabaseUrl, "Process")
  [Environment]::SetEnvironmentVariable("P2C_SEED_ALLOW_DISPOSABLE", $previousDisposableSeedOverride, "Process")
  if ($containerStarted) { & docker rm -f $containerName *> $null }
}

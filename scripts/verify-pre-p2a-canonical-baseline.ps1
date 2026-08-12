param(
  [int]$Port = 55437,
  [string]$ArtifactDirectory = "artifacts/pre-p2a-canonical/verification"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$resolvedArtifacts = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $ArtifactDirectory))
$allowedArtifacts = [IO.Path]::GetFullPath((Join-Path (Join-Path $repositoryRoot "artifacts") "pre-p2a-canonical"))
if (-not $resolvedArtifacts.StartsWith($allowedArtifacts, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Verification artifacts must remain under artifacts/pre-p2a-canonical"
}

$containerName = "liberialearn-canonical-pg17-$PID"
$clientImage = "pgvector/pgvector:0.8.0-pg17"
$localPassword = "canonical_local_disposable_only"
$repositoryMount = $repositoryRoot -replace '\\', '/'
$artifactMount = $resolvedArtifacts -replace '\\', '/'
$baselinePath = "/workspace/prisma/canonical/migrations/20260728_000003_canonical_production_state_baseline/migration.sql"
$catalogQueryPath = "/workspace/scripts/pre-p2a-canonical-catalog.sql"
$seedPath = "/workspace/prisma/canonical/seeds/20260811_000001_essential_reference_v1.sql"
$seedEvidencePath = "/workspace/scripts/pre-p2a-reference-seed-evidence.sql"
$preP2APrismaRoot = Join-Path $resolvedArtifacts "prisma-pre-p2a"

function Invoke-Docker {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Docker command failed: docker $($Arguments -join ' ')"
  }
}

function Assert-HashEqual {
  param([string]$ExpectedPath, [string]$ActualPath, [string]$Label)
  $expected = (Get-FileHash -Algorithm SHA256 -LiteralPath $ExpectedPath).Hash
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $ActualPath).Hash
  if ($expected -ne $actual) {
    throw "$Label hash mismatch: expected $expected, received $actual"
  }
  return $actual.ToLowerInvariant()
}

New-Item -ItemType Directory -Path $resolvedArtifacts -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $preP2APrismaRoot "migrations") -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $repositoryRoot "prisma/canonical/schema.prisma") -Destination (Join-Path $preP2APrismaRoot "schema.prisma") -Force
Copy-Item -LiteralPath (Join-Path $repositoryRoot "prisma/canonical/migrations/migration_lock.toml") -Destination (Join-Path $preP2APrismaRoot "migrations/migration_lock.toml") -Force
foreach ($migrationName in @(
  "20260728_000003_canonical_production_state_baseline",
  "20260803_000001_privileged_identity_hardening"
)) {
  $targetDirectory = Join-Path (Join-Path $preP2APrismaRoot "migrations") $migrationName
  New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $repositoryRoot "prisma/canonical/migrations/$migrationName/migration.sql") -Destination (Join-Path $targetDirectory "migration.sql") -Force
}
$previousDirectUrl = [Environment]::GetEnvironmentVariable("DIRECT_URL", "Process")
$startedAt = [DateTimeOffset]::UtcNow
$containerStarted = $false

try {
  Invoke-Docker -Arguments @("version", "--format", "{{.Server.Version}}") | Out-Null
  $psqlVersion = (& docker run --rm $clientImage psql --version).Trim()
  $dumpVersion = (& docker run --rm $clientImage pg_dump --version).Trim()
  $restoreVersion = (& docker run --rm $clientImage pg_restore --version).Trim()
  foreach ($version in @($psqlVersion, $dumpVersion, $restoreVersion)) {
    if ($version -notmatch 'PostgreSQL\) 17\.') {
      throw "PostgreSQL 17 client tooling is required: $version"
    }
  }

  Invoke-Docker -Arguments @(
    "run", "--name", $containerName,
    "-e", "POSTGRES_PASSWORD=$localPassword",
    "-p", "127.0.0.1:${Port}:5432",
    "-v", "${repositoryMount}:/workspace:ro",
    "-v", "${artifactMount}:/evidence",
    "-d", $clientImage
  ) | Out-Null
  $containerStarted = $true

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & docker exec $containerName pg_isready -U postgres -d postgres *> $null
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) {
    throw "Disposable PostgreSQL 17 did not become ready"
  }

  Invoke-Docker -Arguments @("exec", $containerName, "createdb", "-U", "postgres", "canonical_baseline")
  Invoke-Docker -Arguments @("exec", $containerName, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "canonical_baseline", "-f", $baselinePath) | Out-Null
  Invoke-Docker -Arguments @("exec", $containerName, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "canonical_baseline", "-o", "/evidence/baseline-catalog.json", "-f", $catalogQueryPath) | Out-Null
  $baselineCatalogHash = Assert-HashEqual `
    (Join-Path $repositoryRoot "prisma/canonical/catalog-manifest.json") `
    (Join-Path $resolvedArtifacts "baseline-catalog.json") `
    "Canonical baseline catalog"

  Invoke-Docker -Arguments @("exec", $containerName, "createdb", "-U", "postgres", "canonical_clean")
  [Environment]::SetEnvironmentVariable(
    "DIRECT_URL",
    "postgresql://postgres:${localPassword}@127.0.0.1:${Port}/canonical_clean?schema=public",
    "Process"
  )
  $prismaDeployed = $false
  for ($attempt = 0; $attempt -lt 3; $attempt++) {
    & npx prisma migrate deploy --schema (Join-Path $preP2APrismaRoot "schema.prisma")
    if ($LASTEXITCODE -eq 0) {
      $prismaDeployed = $true
      break
    }
    Start-Sleep -Seconds 2
  }
  if (-not $prismaDeployed) {
    throw "Prisma canonical migration-root deployment failed"
  }

  $ledgerNames = (& docker exec $containerName psql -X -At -U postgres -d canonical_clean -c 'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY started_at;') -join "`n"
  $expectedLedger = "20260728_000003_canonical_production_state_baseline`n20260803_000001_privileged_identity_hardening"
  if ($ledgerNames.Trim() -ne $expectedLedger) {
    throw "Canonical Prisma ledger does not contain exactly the baseline and reviewed forward hardening migration"
  }

  Invoke-Docker -Arguments @("exec", $containerName, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "canonical_clean", "-o", "/evidence/post-hardening-catalog.json", "-f", $catalogQueryPath) | Out-Null
  $postHardeningCatalogHash = Assert-HashEqual `
    (Join-Path $repositoryRoot "prisma/canonical/post-hardening-catalog-manifest.json") `
    (Join-Path $resolvedArtifacts "post-hardening-catalog.json") `
    "Post-hardening catalog"

  Invoke-Docker -Arguments @("exec", $containerName, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "canonical_clean", "-f", $seedPath) | Out-Null
  Invoke-Docker -Arguments @("exec", $containerName, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "canonical_clean", "-o", "/evidence/seed-first.json", "-f", $seedEvidencePath) | Out-Null
  Invoke-Docker -Arguments @("exec", $containerName, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "canonical_clean", "-f", $seedPath) | Out-Null
  Invoke-Docker -Arguments @("exec", $containerName, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "canonical_clean", "-o", "/evidence/seed-second.json", "-f", $seedEvidencePath) | Out-Null
  $firstSeed = Get-Content -Raw (Join-Path $resolvedArtifacts "seed-first.json") | ConvertFrom-Json
  $secondSeed = Get-Content -Raw (Join-Path $resolvedArtifacts "seed-second.json") | ConvertFrom-Json
  if ($firstSeed.trainingModuleCount -ne 8 -or $firstSeed.strandCount -ne 9 -or $firstSeed.standardCount -ne 10) {
    throw "Essential reference seed counts are incorrect"
  }
  if ($firstSeed.dataHash -ne $secondSeed.dataHash) {
    throw "Essential reference seed is not idempotent"
  }

  $criticalObjectCounts = (& docker exec $containerName psql -X -At -U postgres -d canonical_clean -c "SELECT (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='AuditLog' AND NOT t.tgisinternal), (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexdef ILIKE '%ivfflat%'), (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='CurriculumContent' AND column_name='provenance'), (SELECT count(*) = 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='AIInteraction');").Trim()
  if ($criticalObjectCounts -ne "2|2|0|t") {
    throw "Critical audit, vector, or P2-A prerequisite verification failed: $criticalObjectCounts"
  }

  Invoke-Docker -Arguments @("exec", $containerName, "pg_dump", "-U", "postgres", "-d", "canonical_clean", "--schema-only", "--format=custom", "--file=/evidence/canonical-schema.dump")
  Invoke-Docker -Arguments @("exec", $containerName, "createdb", "-U", "postgres", "canonical_restore")
  Invoke-Docker -Arguments @("exec", $containerName, "pg_restore", "-U", "postgres", "-d", "canonical_restore", "--schema-only", "--no-owner", "--no-privileges", "/evidence/canonical-schema.dump")
  Invoke-Docker -Arguments @("exec", $containerName, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "canonical_restore", "-o", "/evidence/restored-catalog.json", "-f", $catalogQueryPath) | Out-Null
  $restoredCatalogHash = Assert-HashEqual `
    (Join-Path $repositoryRoot "prisma/canonical/post-hardening-catalog-manifest.json") `
    (Join-Path $resolvedArtifacts "restored-catalog.json") `
    "Schema-only pg_dump/restore catalog"

  $evidence = [ordered]@{
    schemaVersion = 1
    result = "PASS"
    startedAt = $startedAt.ToString("o")
    completedAt = [DateTimeOffset]::UtcNow.ToString("o")
    image = $clientImage
    psqlVersion = $psqlVersion
    pgDumpVersion = $dumpVersion
    pgRestoreVersion = $restoreVersion
    baselineCatalogSha256 = $baselineCatalogHash
    postHardeningCatalogSha256 = $postHardeningCatalogHash
    restoredCatalogSha256 = $restoredCatalogHash
    prismaLedger = @(
      "20260728_000003_canonical_production_state_baseline",
      "20260803_000001_privileged_identity_hardening"
    )
    essentialReferenceSeed = [ordered]@{
      trainingModules = 8
      strands = 9
      standards = 10
      dataHash = $firstSeed.dataHash
      idempotent = $true
    }
    criticalAuditTriggers = 2
    ivfflatIndexes = 2
    curriculumContentPhysicalProvenanceColumns = 0
    aiInteractionPresent = $true
    persistentDatabasesTouched = $false
  }
  $evidenceFile = Join-Path $resolvedArtifacts "verification-evidence.json"
  [IO.File]::WriteAllText($evidenceFile, ($evidence | ConvertTo-Json -Depth 8) + "`n", [Text.UTF8Encoding]::new($false))

  Write-Output "Canonical pre-P2-A clean bootstrap: PASS"
  Write-Output "baselineCatalogSha256=$baselineCatalogHash"
  Write-Output "postHardeningCatalogSha256=$postHardeningCatalogHash"
  Write-Output "seedDataHash=$($firstSeed.dataHash)"
  Write-Output "evidence=$evidenceFile"
}
finally {
  [Environment]::SetEnvironmentVariable("DIRECT_URL", $previousDirectUrl, "Process")
  if ($containerStarted) {
    & docker rm -f $containerName *> $null
  }
}

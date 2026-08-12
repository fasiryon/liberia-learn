param(
  [ValidateSet("None", "NormalizeUtf16Sql", "AddLegacyTrainingModuleColumns", "DefaultTrainingModuleUpdatedAt", "CreateMissingTokenTables")]
  [string[]]$DiagnosticBypass = @("None"),

  [string]$Boundary = "20260803_000001_privileged_identity_hardening",

  [switch]$KeepArtifacts
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$migrationRoot = Join-Path $repositoryRoot "prisma\migrations"
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("liberialearn-pre-p2a-replay-" + [Guid]::NewGuid().ToString("N"))
$containerName = "liberialearn-pre-p2a-replay-" + [Guid]::NewGuid().ToString("N").Substring(0, 12)
$port = Get-Random -Minimum 55000 -Maximum 59999
$localPassword = "disposable-replay-only"
$databaseUrl = "postgresql://postgres:${localPassword}@127.0.0.1:${port}/liberialearn_replay?sslmode=disable"
$originalDatabaseUrl = [Environment]::GetEnvironmentVariable("DATABASE_URL", "Process")
$originalDirectUrl = [Environment]::GetEnvironmentVariable("DIRECT_URL", "Process")
$startedContainer = $false

function Assert-DisposablePath([string]$Path) {
  $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  $resolvedPath = [IO.Path]::GetFullPath($Path)
  if (-not $resolvedPath.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Diagnostic path escaped the operating-system temp directory"
  }
}

function Test-Bypass([string]$Name) {
  return $DiagnosticBypass -contains $Name
}

try {
  Assert-DisposablePath $temporaryRoot
  New-Item -ItemType Directory -Path $temporaryRoot | Out-Null
  $temporaryPrisma = Join-Path $temporaryRoot "prisma"
  $temporaryMigrations = Join-Path $temporaryPrisma "migrations"
  New-Item -ItemType Directory -Path $temporaryMigrations | Out-Null
  Copy-Item -LiteralPath (Join-Path $repositoryRoot "prisma\schema.prisma") -Destination $temporaryPrisma
  $lockFile = Join-Path $migrationRoot "migration_lock.toml"
  if (Test-Path -LiteralPath $lockFile) {
    Copy-Item -LiteralPath $lockFile -Destination $temporaryMigrations
  }

  $migrationDirectories = Get-ChildItem -LiteralPath $migrationRoot -Directory |
    Where-Object { $_.Name -ne "verification" -and $_.Name -le $Boundary } |
    Sort-Object Name
  foreach ($directory in $migrationDirectories) {
    Copy-Item -LiteralPath $directory.FullName -Destination $temporaryMigrations -Recurse
  }

  if (Test-Bypass "NormalizeUtf16Sql") {
    foreach ($sqlFile in Get-ChildItem -LiteralPath $temporaryMigrations -Filter "*.sql" -File -Recurse) {
      $bytes = [IO.File]::ReadAllBytes($sqlFile.FullName)
      if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
        $sqlText = [Text.Encoding]::Unicode.GetString($bytes, 2, $bytes.Length - 2)
        [IO.File]::WriteAllText($sqlFile.FullName, $sqlText, [Text.UTF8Encoding]::new($false))
        Write-Output "DIAGNOSTIC_BYPASS NormalizeUtf16Sql $($sqlFile.FullName.Substring($temporaryRoot.Length + 1))"
      }
    }
  }

  if (Test-Bypass "AddLegacyTrainingModuleColumns") {
    $seedPath = Join-Path $temporaryMigrations "20260224_000000_seed_training_modules\migration.sql"
    if (-not (Test-Path -LiteralPath $seedPath)) {
      throw "Training module seed migration was not copied into the diagnostic workspace"
    }
    $seedSql = [IO.File]::ReadAllText($seedPath)
    $diagnosticPrefix = @'
-- DIAGNOSTIC BYPASS ONLY. Production received these columns from the
-- repository-absent 20260220_090000_teacher_onboarding_training migration.
ALTER TABLE "TrainingModule" ADD COLUMN IF NOT EXISTS "content" TEXT;
ALTER TABLE "TrainingModule" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TrainingModule" ADD COLUMN IF NOT EXISTS "estimatedMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TrainingModule" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "TrainingModule_isActive_sortOrder_idx"
  ON "TrainingModule"("isActive", "sortOrder");

'@
    [IO.File]::WriteAllText($seedPath, $diagnosticPrefix + $seedSql, [Text.UTF8Encoding]::new($false))
    Write-Output "DIAGNOSTIC_BYPASS AddLegacyTrainingModuleColumns prisma\migrations\20260224_000000_seed_training_modules\migration.sql"
  }

  if (Test-Bypass "DefaultTrainingModuleUpdatedAt") {
    $seedPath = Join-Path $temporaryMigrations "20260224_000000_seed_training_modules\migration.sql"
    if (-not (Test-Path -LiteralPath $seedPath)) {
      throw "Training module seed migration was not copied into the diagnostic workspace"
    }
    $seedSql = [IO.File]::ReadAllText($seedPath)
    $diagnosticPrefix = @'
-- DIAGNOSTIC BYPASS ONLY. The repository seed omits the non-null updatedAt
-- column created by 20260220_180000_training_reporting.
ALTER TABLE "TrainingModule" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

'@
    [IO.File]::WriteAllText($seedPath, $diagnosticPrefix + $seedSql, [Text.UTF8Encoding]::new($false))
    Write-Output "DIAGNOSTIC_BYPASS DefaultTrainingModuleUpdatedAt prisma\migrations\20260224_000000_seed_training_modules\migration.sql"
  }

  if (Test-Bypass "CreateMissingTokenTables") {
    $inviteMigrationPath = Join-Path $temporaryMigrations "20260227_120000_invitetoken_type_student\migration.sql"
    if (-not (Test-Path -LiteralPath $inviteMigrationPath)) {
      throw "InviteToken migration was not copied into the diagnostic workspace"
    }
    $inviteSql = [IO.File]::ReadAllText($inviteMigrationPath)
    $diagnosticPrefix = @'
-- DIAGNOSTIC BYPASS ONLY. These base tables exist in production but are not
-- created by any migration in the current repository chain.
CREATE TABLE "InviteToken" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "email" TEXT,
  "role" TEXT NOT NULL DEFAULT 'TEACHER',
  "schoolId" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InviteToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InviteToken_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InviteToken_token_key" ON "InviteToken"("token");

CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

'@
    [IO.File]::WriteAllText($inviteMigrationPath, $diagnosticPrefix + $inviteSql, [Text.UTF8Encoding]::new($false))
    Write-Output "DIAGNOSTIC_BYPASS CreateMissingTokenTables prisma\migrations\20260227_120000_invitetoken_type_student\migration.sql"
  }

  Write-Output "DIAGNOSTIC_SCOPE postgres:17-alpine migrations=$($migrationDirectories.Count) boundary=$Boundary"
  & docker run --rm -d --name $containerName -e "POSTGRES_PASSWORD=$localPassword" -e "POSTGRES_DB=liberialearn_replay" -p "127.0.0.1:${port}:5432" postgres:17-alpine | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to start disposable PostgreSQL 17 container"
  }
  $startedContainer = $true

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & docker exec $containerName pg_isready -U postgres -d liberialearn_replay | Out-Null
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) {
    throw "Disposable PostgreSQL 17 did not become ready"
  }

  [Environment]::SetEnvironmentVariable("DATABASE_URL", $databaseUrl, "Process")
  [Environment]::SetEnvironmentVariable("DIRECT_URL", $databaseUrl, "Process")
  & npx prisma migrate deploy --schema (Join-Path $temporaryPrisma "schema.prisma")
  $migrationExitCode = $LASTEXITCODE

  if ($migrationExitCode -ne 0) {
    Write-Output "DIAGNOSTIC_RESULT FAIL exit_code=$migrationExitCode"
    & docker exec $containerName psql -U postgres -d liberialearn_replay -X -v ON_ERROR_STOP=1 -P pager=off -c 'SELECT migration_name, started_at, finished_at, rolled_back_at, logs FROM "_prisma_migrations" WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1;'
    exit $migrationExitCode
  }

  & docker exec $containerName psql -U postgres -d liberialearn_replay -X -v ON_ERROR_STOP=1 -At -c 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;'
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect disposable migration ledger"
  }
  Write-Output "DIAGNOSTIC_RESULT PASS"
}
finally {
  [Environment]::SetEnvironmentVariable("DATABASE_URL", $originalDatabaseUrl, "Process")
  [Environment]::SetEnvironmentVariable("DIRECT_URL", $originalDirectUrl, "Process")
  if ($startedContainer) {
    & docker rm -f $containerName | Out-Null
  }
  if (-not $KeepArtifacts -and (Test-Path -LiteralPath $temporaryRoot)) {
    Assert-DisposablePath $temporaryRoot
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
  } elseif ($KeepArtifacts) {
    Write-Output "DIAGNOSTIC_ARTIFACTS $temporaryRoot"
  }
}

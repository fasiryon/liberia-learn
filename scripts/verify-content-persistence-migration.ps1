param([int]$Port = 55449)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$containerName = "liberialearn-content-persistence-$PID"
$migrationName = '20261013_000001_content_bundle_scheduledwork_pins'
$databaseName = 'content_persistence_local'
$containerStarted = $false
$savedDatabaseUrl = $env:DATABASE_URL
$savedDirectUrl = $env:DIRECT_URL
function Docker-Checked {
  & docker @args
  if ($LASTEXITCODE -ne 0) { throw "Local Docker validation failed" }
}
try {
  Docker-Checked run --name $containerName -e POSTGRES_PASSWORD=local_disposable_only -p "127.0.0.1:${Port}:5432" -v "${repoRoot}:/workspace:ro" -d pgvector/pgvector:0.8.0-pg17
  $containerStarted = $true
  for ($attempt=0; $attempt -lt 30; $attempt++) {
    & docker exec $containerName pg_isready -U postgres *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 1
  }
  Docker-Checked exec $containerName createdb -U postgres $databaseName
  Docker-Checked exec $containerName psql -X -v ON_ERROR_STOP=1 -U postgres -d $databaseName -c 'CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;'
  $migrations = Get-ChildItem -LiteralPath (Join-Path $repoRoot 'prisma/canonical/migrations') -Directory | Sort-Object Name
  foreach ($migration in $migrations) {
    if ($migration.Name -eq $migrationName) { continue }
    Docker-Checked exec $containerName psql -X -v ON_ERROR_STOP=1 -U postgres -d $databaseName -f "/workspace/prisma/canonical/migrations/$($migration.Name)/migration.sql"
  }
  Docker-Checked exec $containerName psql -X -v ON_ERROR_STOP=1 -U postgres -d $databaseName -f /workspace/scripts/content-persistence-existing-row.sql
  # Exercise the new migration inside a transaction, matching Prisma's execution convention.
  Docker-Checked exec $containerName psql -X -1 -v ON_ERROR_STOP=1 -U postgres -d $databaseName -f "/workspace/prisma/canonical/migrations/$migrationName/migration.sql"
  Docker-Checked exec $containerName psql -X -v ON_ERROR_STOP=1 -U postgres -d $databaseName -f /workspace/scripts/content-persistence-migration-assertions.sql
  $env:DATABASE_URL = "postgresql://postgres:local_disposable_only@127.0.0.1:${Port}/${databaseName}"
  $env:DIRECT_URL = $env:DATABASE_URL
  & node (Join-Path $repoRoot 'node_modules/tsx/dist/cli.mjs') (Join-Path $repoRoot 'scripts/content-persistence-runtime-check.ts')
  if ($LASTEXITCODE -ne 0) { throw 'Local Prisma runtime integration failed' }
  & node (Join-Path $repoRoot 'node_modules/tsx/dist/cli.mjs') (Join-Path $repoRoot 'scripts/analyze-scheduledwork-content.ts') --dry-run
  if ($LASTEXITCODE -ne 0) { throw 'Read-only analyzer CLI failed' }
  Write-Output 'CONTENT PERSISTENCE LOCAL MIGRATION: PASS (canonical replay, existing row, indexes, RLS, append-only guards)'
} finally {
  $env:DATABASE_URL = $savedDatabaseUrl
  $env:DIRECT_URL = $savedDirectUrl
  # Only the uniquely named disposable container created by this script is removed.
  if ($containerStarted) { Docker-Checked rm -f $containerName }
}
exit 0

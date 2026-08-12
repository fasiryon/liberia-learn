param(
  [string]$OutputDirectory = "artifacts/pre-p2a-canonical",
  [string]$UrlVariable = "DIRECT_URL"
)

$ErrorActionPreference = "Stop"
$productionProjectRef = "bnphuinpvgpmebcsvmsp"
$clientImage = "postgres:17-alpine"
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$resolvedOutputDirectory = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $OutputDirectory))
$allowedRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot "artifacts\pre-p2a-canonical"))

if (-not $resolvedOutputDirectory.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Schema capture output must remain under artifacts/pre-p2a-canonical"
}

$databaseUrl = [Environment]::GetEnvironmentVariable($UrlVariable, "Process")
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
  throw "$UrlVariable is missing from the process environment"
}
if ($databaseUrl.IndexOf($productionProjectRef, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
  throw "$UrlVariable does not resolve to the approved production project"
}
if ($databaseUrl -notmatch ':(5432)(?:/|\?|$)') {
  throw "$UrlVariable must use a PostgreSQL port 5432 endpoint"
}
if ($databaseUrl -match ':(6543)(?:/|\?|$)') {
  throw "$UrlVariable must not use the transaction pooler"
}

New-Item -ItemType Directory -Path $resolvedOutputDirectory -Force | Out-Null
$rawSchemaPath = Join-Path $resolvedOutputDirectory "production-public-schema.raw.sql"
$rawCatalogPath = Join-Path $resolvedOutputDirectory "production-public-catalog.raw.json"
$evidencePath = Join-Path $resolvedOutputDirectory "production-public-schema.capture.json"
$captureMount = $resolvedOutputDirectory -replace '\\', '/'
$repositoryMount = $repositoryRoot -replace '\\', '/'

& docker version --format '{{.Server.Version}}' | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Docker is unavailable"
}

$clientVersion = (& docker run --rm $clientImage pg_dump --version).Trim()
if ($LASTEXITCODE -ne 0 -or $clientVersion -notmatch 'pg_dump \(PostgreSQL\) 17\.') {
  throw "PostgreSQL 17 pg_dump is required"
}

$serverArgs = @("run", "--rm", "-e", $UrlVariable, "-v", "${repositoryMount}:/workspace:ro", $clientImage, "sh", "/workspace/scripts/capture-pre-p2a-production-schema.sh", $UrlVariable, "server-version")
$serverOutput = & docker @serverArgs
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($serverOutput -join ""))) {
  throw "Unable to read the production PostgreSQL server version"
}
$serverVersion = ($serverOutput -join "").Trim()

$dumpArgs = @("run", "--rm", "-e", $UrlVariable, "-v", "${repositoryMount}:/workspace:ro", "-v", "${captureMount}:/capture", $clientImage, "sh", "/workspace/scripts/capture-pre-p2a-production-schema.sh", $UrlVariable, "dump")
& docker @dumpArgs
if ($LASTEXITCODE -ne 0) {
  throw "PostgreSQL 17 schema-only capture failed"
}
if (-not (Test-Path -LiteralPath $rawSchemaPath)) {
  throw "Schema-only capture did not create the expected artifact"
}

$catalogArgs = @("run", "--rm", "-e", $UrlVariable, "-v", "${repositoryMount}:/workspace:ro", "-v", "${captureMount}:/capture", $clientImage, "sh", "/workspace/scripts/capture-pre-p2a-production-schema.sh", $UrlVariable, "catalog")
& docker @catalogArgs
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $rawCatalogPath)) {
  throw "Production catalog capture failed"
}

$rawText = [IO.File]::ReadAllText($rawSchemaPath)
if ($rawText -match '(?im)^\s*(COPY|INSERT\s+INTO)\s+') {
  throw "Schema artifact unexpectedly contains row-data statements"
}
if ($rawText -match '(?i)(postgres(?:ql)?://[^\s]+:[^\s]+@|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|service[_-]?role\s*[=:])') {
  throw "Schema artifact contains secret-like material and must not be retained"
}
$catalogText = [IO.File]::ReadAllText($rawCatalogPath)
try {
  $null = $catalogText | ConvertFrom-Json
} catch {
  throw "Production catalog artifact is not valid JSON"
}
if ($catalogText -match '(?i)(postgres(?:ql)?://[^\s]+:[^\s]+@|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|service[_-]?role\s*[=:])') {
  throw "Catalog artifact contains secret-like material and must not be retained"
}

$capturedAt = [DateTimeOffset]::UtcNow.ToString("o")
$sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $rawSchemaPath).Hash.ToLowerInvariant()
$catalogSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $rawCatalogPath).Hash.ToLowerInvariant()
$evidence = [ordered]@{
  schemaVersion = 1
  sourceProjectRef = $productionProjectRef
  sourceSchema = "public"
  sourceServerVersion = $serverVersion
  capturedAt = $capturedAt
  captureTool = $clientVersion
  captureMode = "pg_dump schema-only no-owner no-privileges"
  artifactFile = [IO.Path]::GetFileName($rawSchemaPath)
  artifactBytes = (Get-Item -LiteralPath $rawSchemaPath).Length
  artifactSha256 = $sha256
  catalogArtifactFile = [IO.Path]::GetFileName($rawCatalogPath)
  catalogArtifactBytes = (Get-Item -LiteralPath $rawCatalogPath).Length
  catalogArtifactSha256 = $catalogSha256
  containsRowData = $false
  containsCredentials = $false
}
[IO.File]::WriteAllText($evidencePath, ($evidence | ConvertTo-Json -Depth 4) + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

Write-Output "Production schema-only capture: PASS"
Write-Output "sourceProjectRef=$productionProjectRef"
Write-Output "sourceServerVersion=$serverVersion"
Write-Output "captureTool=$clientVersion"
Write-Output "artifact=$rawSchemaPath"
Write-Output "artifactSha256=$sha256"
Write-Output "catalogArtifactSha256=$catalogSha256"
Write-Output "evidence=$evidencePath"

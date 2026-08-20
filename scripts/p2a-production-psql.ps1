param(
  [Parameter(Mandatory = $true, ParameterSetName = "Command")]
  [string]$Command,

  [Parameter(Mandatory = $true, ParameterSetName = "File")]
  [string]$File,

  [ValidateSet("P2A_PRODUCTION_DATABASE_URL", "DIRECT_URL", "DATABASE_URL")]
  [string]$UrlVariable = "P2A_PRODUCTION_DATABASE_URL",

  [switch]$DeriveSessionFromRuntime
)

$ErrorActionPreference = "Stop"
$clientImage = "postgres:17-alpine"
$productionRef = "bnphuinpvgpmebcsvmsp"
$stagingRef = "yonpfzjczoffhrgibxkz"
$urlValue = [Environment]::GetEnvironmentVariable($UrlVariable)
if ($DeriveSessionFromRuntime) {
  if ($UrlVariable -ne "P2A_PRODUCTION_DATABASE_URL") {
    throw "Session derivation requires P2A_PRODUCTION_DATABASE_URL"
  }
  $runtimeUrl = [Environment]::GetEnvironmentVariable("DATABASE_URL")
  if ([string]::IsNullOrWhiteSpace($runtimeUrl)) {
    throw "DATABASE_URL is missing"
  }
  $runtimeUri = [Uri]$runtimeUrl
  $runtimeBuilder = [UriBuilder]$runtimeUri
  $runtimeBuilder.Port = 5432
  $runtimeBuilder.Query = (($runtimeUri.Query.TrimStart('?').Split('&') |
    Where-Object { $_ -and $_ -notmatch '^pgbouncer=' }) -join '&')
  $urlValue = $runtimeBuilder.Uri.AbsoluteUri
}
if ([string]::IsNullOrWhiteSpace($urlValue)) {
  throw "$UrlVariable is missing"
}

& docker version --format '{{.Server.Version}}' | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Docker is unavailable"
}

$parsedUrl = [Uri]$urlValue
$userInfo = $parsedUrl.UserInfo.Split(':', 2)
if ($parsedUrl.Scheme -notin @("postgres", "postgresql") -or $userInfo.Count -ne 2) {
  throw "$UrlVariable is not a valid PostgreSQL URL"
}

$databaseHost = $parsedUrl.Host.ToLowerInvariant()
$databaseUser = [Uri]::UnescapeDataString($userInfo[0])
$isDirect = $databaseHost -eq "db.$productionRef.supabase.co" -and
  $parsedUrl.Port -eq 5432 -and $databaseUser -eq "postgres"
$isSessionPooler = $databaseHost -match '^aws-[a-z0-9-]+\.pooler\.supabase\.com$' -and
  $parsedUrl.Port -eq 5432 -and $databaseUser -eq "postgres.$productionRef"
$isTransactionPooler = $databaseHost -match '^aws-[a-z0-9-]+\.pooler\.supabase\.com$' -and
  $parsedUrl.Port -eq 6543 -and $databaseUser -eq "postgres.$productionRef"

if ($databaseHost -like "*$stagingRef*" -or $databaseUser -like "*$stagingRef*") {
  throw "P2-A production execution resolved to the staging project"
}
if ($UrlVariable -in @("P2A_PRODUCTION_DATABASE_URL", "DIRECT_URL")) {
  if (-not $isDirect -and -not $isSessionPooler) {
    throw "P2-A production migration transport is not the approved production project"
  }
  if ($parsedUrl.Port -eq 6543 -or $parsedUrl.Query -match '(^|[?&])pgbouncer=true(&|$)') {
    throw "Transaction pooling is prohibited for production migration/native DDL"
  }
} elseif (-not $isTransactionPooler) {
  throw "P2-A production runtime transport is not the approved production transaction pooler"
}
if ($parsedUrl.Query -notmatch '(^|[?&])sslmode=require(&|$)') {
  throw "P2-A production transport must include sslmode=require"
}

$clientEnvironment = [ordered]@{
  PGHOST = $parsedUrl.Host
  PGPORT = $parsedUrl.Port.ToString()
  PGUSER = $databaseUser
  PGPASSWORD = [Uri]::UnescapeDataString($userInfo[1])
  PGDATABASE = [Uri]::UnescapeDataString($parsedUrl.AbsolutePath.TrimStart('/'))
  PGSSLMODE = "require"
}
$previousEnvironment = @{}
$dockerArgs = @("run", "--rm", "-i")
foreach ($name in $clientEnvironment.Keys) {
  $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name)
  [Environment]::SetEnvironmentVariable($name, $clientEnvironment[$name])
  $dockerArgs += @("-e", $name)
}

if ($PSCmdlet.ParameterSetName -eq "File") {
  $resolvedFile = (Resolve-Path -LiteralPath $File).Path
  $repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
  if (-not $resolvedFile.StartsWith($repositoryRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "SQL file must be inside the repository"
  }
  $relativePath = $resolvedFile.Substring($repositoryRoot.Length).TrimStart('\', '/') -replace '\\', '/'
  $dockerArgs += @("-v", "${repositoryRoot}:/workspace:ro")
  $psqlArgs = @("-f", "/workspace/$relativePath")
} else {
  $psqlArgs = @("-c", $Command)
}

$dockerArgs += @($clientImage, "psql", "-X", "-v", "ON_ERROR_STOP=1")
$dockerArgs += $psqlArgs
try {
  & docker @dockerArgs
  if ($LASTEXITCODE -ne 0) {
    throw "psql failed"
  }
} finally {
  foreach ($name in $clientEnvironment.Keys) {
    [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name])
  }
}
